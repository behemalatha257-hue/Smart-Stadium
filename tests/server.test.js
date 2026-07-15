import assert from 'assert';
import app from '../server.js';
import http from 'http';

// Clear the API Key for tests to ensure local fallback runs deterministically
delete process.env.GEMINI_API_KEY;

const PORT = 0; // Dynamic ports

console.log('🧪 Running Server security and API integration tests...');

const srv = http.createServer(app);

await new Promise((resolve) => srv.listen(PORT, resolve));
const address = srv.address();
assert(address && typeof address === 'object', 'Server address should be defined');
const port = address.port;

function fetchJson(path, options = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      { hostname: '127.0.0.1', port, path, method: options.method || 'GET', headers: options.headers || {} },
      (res) => {
        let body = '';
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () => {
          try {
            const parsedBody = body ? JSON.parse(body) : {};
            resolve({ status: res.statusCode, headers: res.headers, body: parsedBody });
          } catch (err) {
            reject(err);
          }
        });
      }
    );

    req.on('error', reject);
    if (options.body) req.write(options.body);
    req.end();
  });
}

try {
  // Test Case 1: Health Check Endpoint and Secure Custom Headers
  const health = await fetchJson('/api/health');
  assert.strictEqual(health.status, 200);
  assert.strictEqual(health.body.status, 'ok');
  assert.strictEqual(health.headers['x-content-type-options'], 'nosniff');
  assert.strictEqual(health.headers['x-frame-options'], 'DENY');
  assert.strictEqual(health.headers['referrer-policy'], 'no-referrer');
  assert(health.headers['content-security-policy'], 'CSP should be defined');
  
  // Security score verification: HSTS, COOP, CORP headers
  assert.strictEqual(health.headers['strict-transport-security'], 'max-age=63072000; includeSubDomains; preload');
  assert.strictEqual(health.headers['cross-origin-opener-policy'], 'same-origin');
  assert.strictEqual(health.headers['cross-origin-resource-policy'], 'same-origin');
  console.log('✅ Test Case 1 Passed: Health endpoint and security headers (including HSTS, COOP, CORP)');

  // Test Case 2: Chat API Local Fallback (Fan Role)
  const chatFan = await fetchJson('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: 'Show accessibility info',
      role: 'fan',
      lang: 'en',
      simulationContext: { concessionsFood: 8, concessionsDrink: 4 }
    })
  });
  assert.strictEqual(chatFan.status, 200);
  assert(chatFan.body.reply.includes('Accessibility Assistance'), 'Fan role query should trigger accessibility responses');
  console.log('✅ Test Case 2 Passed: Chat API local fallback (Fan / Accessibility)');

  // Test Case 3: Chat API Local Fallback (Staff Role & Language Translation check)
  const chatStaffEs = await fetchJson('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: 'alertas del personal',
      role: 'staff',
      lang: 'es',
      simulationContext: { activeIncident: 'Slip hazard on corridor' }
    })
  });
  assert.strictEqual(chatStaffEs.status, 200);
  assert(chatStaffEs.body.reply.includes('StadiumPulse AI (Modo Demo Local)'), 'Spanish language query should return Spanish indicators');
  console.log('✅ Test Case 3 Passed: Chat API local fallback (Staff / Spanish translation)');

  // Test Case 4: Chat API input validation limits (large payload rejection check)
  const hugeMessage = 'a'.repeat(20000); 
  const validationError = await fetchJson('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: hugeMessage })
  });
  assert.strictEqual(validationError.status, 413);
  console.log('✅ Test Case 4 Passed: JSON payload size enforcement limits');

  // Test Case 5: Chat API missing message validation (400 Bad Request)
  const missingMsgError = await fetchJson('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ role: 'fan', lang: 'en' })
  });
  assert.strictEqual(missingMsgError.status, 400);
  assert.strictEqual(missingMsgError.body.error, 'Input message is required');
  console.log('✅ Test Case 5 Passed: Missing message payload validation error');

  // Test Case 6: Chat API role/lang allowlist fallback validation
  const invalidRoleLangResponse = await fetchJson('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: 'hello',
      role: 'hacker-role', // should fallback to 'fan'
      lang: 'ru',          // should fallback to 'en'
      simulationContext: { gateA: 20 }
    })
  });
  assert.strictEqual(invalidRoleLangResponse.status, 200);
  assert(invalidRoleLangResponse.body.reply.includes('StadiumPulse AI (Local Demo Mode)'), 'Invalid role/lang should fall back to English/Fan defaults');
  console.log('✅ Test Case 6 Passed: Role and Lang allowlist fallbacks');

  // Test Case 7: Crowd Intelligence Recommendation API endpoint
  const crowdIntel = await fetchJson('/api/crowd-intelligence', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      lang: 'en',
      simulationContext: { gateD: 85, concessionsFood: 20 }
    })
  });
  assert.strictEqual(crowdIntel.status, 200);
  assert.strictEqual(crowdIntel.body.severity, 'high');
  assert(Array.isArray(crowdIntel.body.recommendations), 'recommendations should be an array');
  assert.strictEqual(crowdIntel.body.recommendations.length, 3);
  assert.strictEqual(crowdIntel.body.crowdFlow, 'critical');
  console.log('✅ Test Case 7 Passed: /api/crowd-intelligence recommendations logic');

  console.log('🎉 All Server and Security tests completed successfully!\n');
  srv.close();
  process.exit(0);
} catch (e) {
  console.error('❌ Server security and API integration tests Failed!');
  console.error(e);
  srv.close();
  process.exit(1);
}

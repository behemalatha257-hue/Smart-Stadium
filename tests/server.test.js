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
  console.log('✅ Test Case 1 Passed: Health endpoint and security headers');

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
  // Large message payload exceeding limits
  const hugeMessage = 'a'.repeat(20000); 
  const validationError = await fetchJson('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: hugeMessage })
  });
  // Express body-parser limit triggers 413 Payload Too Large
  assert.strictEqual(validationError.status, 413);
  console.log('✅ Test Case 4 Passed: JSON payload size enforcement limits');

  console.log('🎉 All Server and Security tests completed successfully!\n');
  srv.close();
  process.exit(0);
} catch (e) {
  console.error('❌ Server security and API integration tests Failed!');
  console.error(e);
  srv.close();
  process.exit(1);
}

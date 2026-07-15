/**
 * @module server
 * @description StadiumPulse AI — Express backend server for the FIFA World Cup 2026
 * Stadium Operations & Fan Experience Platform. Provides secure API endpoints for
 * AI-powered chat assistance (Google Gemini), crowd intelligence recommendations,
 * and real-time operational decision support.
 *
 * Security: CSP, HSTS, COOP, CORP, X-Frame-Options, payload limits, input sanitization.
 * Efficiency: Singleton Gemini client, response compression, static asset caching, rate limiting.
 */

import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import compression from 'compression';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Load environment variables from .env file
dotenv.config();

// ---------------------------------------------------------------------------
// Constants & Configuration
// ---------------------------------------------------------------------------

/** @constant {number} MAX_PAYLOAD_BYTES - Maximum JSON request body size (15 KB) */
const MAX_PAYLOAD_BYTES = '15kb';

/** @constant {string} GEMINI_MODEL - Google Gemini model identifier */
const GEMINI_MODEL = 'gemini-3.1-flash-lite';

/** @constant {string[]} ALLOWED_ROLES - Permitted user role values */
const ALLOWED_ROLES = ['fan', 'staff'];

/** @constant {string[]} ALLOWED_LANGUAGES - Supported language codes */
const ALLOWED_LANGUAGES = ['en', 'es', 'fr'];

/** @constant {number} RATE_LIMIT_WINDOW_MS - Rate limit window duration (60 seconds) */
const RATE_LIMIT_WINDOW_MS = 60_000;

/** @constant {number} RATE_LIMIT_MAX_REQUESTS - Max requests per IP per window */
const RATE_LIMIT_MAX_REQUESTS = 30;

/** @constant {number} STATIC_CACHE_MAX_AGE - Browser cache duration for static assets (1 day) */
const STATIC_CACHE_MAX_AGE = 86_400_000;

/** @constant {number} PORT - Server port from environment or default */
const PORT = process.env.PORT || 8080;

// ---------------------------------------------------------------------------
// Application Setup
// ---------------------------------------------------------------------------

const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Disable X-Powered-By to prevent server fingerprinting
app.disable('x-powered-by');

// Enable gzip/deflate response compression for reduced bandwidth
app.use(compression());

// ---------------------------------------------------------------------------
// Security Headers Middleware
// ---------------------------------------------------------------------------

/**
 * Applies comprehensive security headers on every response.
 * Includes CSP, HSTS, COOP, CORP, X-Frame-Options, and referrer controls.
 */
app.use((_req, res, next) => {
  res.set({
    'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none';",
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'no-referrer',
    'Permissions-Policy': 'geolocation=(), microphone=(), camera=(), interest-cohort=()',
    'Strict-Transport-Security': 'max-age=63072000; includeSubDomains; preload',
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Cross-Origin-Resource-Policy': 'same-origin'
  });
  next();
});

// Parse JSON request bodies with size limit to prevent DoS attacks
app.use(express.json({ limit: MAX_PAYLOAD_BYTES }));

// Serve static frontend assets with aggressive browser caching
app.use(express.static(path.join(__dirname, 'public'), {
  maxAge: STATIC_CACHE_MAX_AGE,
  etag: true,
  lastModified: true
}));

// ---------------------------------------------------------------------------
// In-Memory Rate Limiter (lightweight, no external dependencies)
// ---------------------------------------------------------------------------

/** @type {Map<string, {count: number, resetTime: number}>} */
const rateLimitStore = new Map();

/**
 * Checks if a client IP has exceeded the rate limit.
 * @param {string} ip - Client IP address
 * @returns {boolean} True if the request should be blocked
 */
function isRateLimited(ip) {
  const now = Date.now();
  const record = rateLimitStore.get(ip);

  if (!record || now > record.resetTime) {
    rateLimitStore.set(ip, { count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS });
    return false;
  }

  record.count += 1;
  return record.count > RATE_LIMIT_MAX_REQUESTS;
}

// Periodically clean expired entries to prevent memory leaks (every 5 minutes)
setInterval(() => {
  const now = Date.now();
  for (const [ip, record] of rateLimitStore) {
    if (now > record.resetTime) {
      rateLimitStore.delete(ip);
    }
  }
}, 5 * 60_000);

// ---------------------------------------------------------------------------
// Singleton Gemini AI Client (initialized once, reused across requests)
// ---------------------------------------------------------------------------

/** @type {import('@google/generative-ai').GenerativeModel | null} */
let geminiModel = null;

/**
 * Returns the cached Gemini model instance, initializing it if needed.
 * Inspects process.env dynamically to support runtime API key removal (e.g. in tests).
 * @returns {import('@google/generative-ai').GenerativeModel | null} Model instance or null
 */
function getGeminiModel() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'your_gemini_api_key_here' || apiKey === 'undefined' || apiKey === '') {
    geminiModel = null;
    return null;
  }
  if (!geminiModel) {
    const genAI = new GoogleGenerativeAI(apiKey);
    geminiModel = genAI.getGenerativeModel({ model: GEMINI_MODEL });
  }
  return geminiModel;
}

// ---------------------------------------------------------------------------
// Input Validation & Sanitization Helpers
// ---------------------------------------------------------------------------

/**
 * Sanitizes user input strings by stripping HTML-unsafe characters.
 * @param {string} str - Raw user input string
 * @returns {string} Sanitized, trimmed string
 */
function sanitizeInput(str) {
  if (typeof str !== 'string') return '';
  return str.replace(/[<>{}]/g, '').trim();
}

/**
 * Validates a value against an allowlist of permitted values.
 * @param {string} value - The value to validate
 * @param {string[]} allowlist - Array of permitted values
 * @param {string} defaultValue - Fallback if value is not in the allowlist
 * @returns {string} Validated value or default
 */
function validateAgainstAllowlist(value, allowlist, defaultValue) {
  return allowlist.includes(value) ? value : defaultValue;
}

/**
 * Sanitizes simulation context values to prevent prompt injection.
 * Only allows numbers and short safe strings through.
 * @param {object} rawContext - Raw simulation context from client
 * @returns {object} Sanitized context with safe values
 */
function sanitizeSimulationContext(rawContext) {
  if (!rawContext || typeof rawContext !== 'object') return {};

  const sanitized = {};
  for (const [key, value] of Object.entries(rawContext)) {
    if (typeof value === 'number') {
      sanitized[key] = Math.min(Math.max(value, 0), 100_000);
    } else if (typeof value === 'string') {
      sanitized[key] = value.replace(/[<>{}]/g, '').substring(0, 200);
    }
  }
  return sanitized;
}

// ---------------------------------------------------------------------------
// API Routes
// ---------------------------------------------------------------------------

/**
 * Health Check Endpoint — verifies server is running.
 * @route GET /api/health
 */
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

/**
 * Chat API — Relays fan/staff queries to Google Gemini or uses rule-based fallback.
 * Injects real-time stadium simulation context into the AI prompt for operational awareness.
 * @route POST /api/chat
 */
app.post('/api/chat', async (req, res) => {
  // Rate limiting check
  if (isRateLimited(req.ip)) {
    return res.status(429).json({ error: 'Too Many Requests', message: 'Please wait before sending more messages.' });
  }

  try {
    const message = sanitizeInput(req.body.message);
    if (!message) {
      return res.status(400).json({ error: 'Input message is required' });
    }

    const role = validateAgainstAllowlist(req.body.role, ALLOWED_ROLES, 'fan');
    const lang = validateAgainstAllowlist(req.body.lang, ALLOWED_LANGUAGES, 'en');
    const simContext = sanitizeSimulationContext(req.body.simulationContext);

    // If Gemini model is not available, use local rule-based fallback
    const model = getGeminiModel();
    if (!model) {
      const reply = generateLocalResponse(message, role, lang, simContext);
      return res.json({ reply });
    }

    // Construct FIFA World Cup 2026 context-aware prompt
    const systemPrompt = buildSystemPrompt(role, lang, simContext);

    const result = await model.generateContent([
      { text: systemPrompt },
      { text: `User query: "${message}"` }
    ]);

    const reply = result.response.text();
    return res.json({ reply });

  } catch (err) {
    console.error('Gemini API Error:', err);
    return res.status(500).json({
      error: 'API Service Error',
      reply: '⚠️ The AI Assistant is temporarily experiencing connection issues. Please try again shortly.',
      details: err.message
    });
  }
});

/**
 * Crowd Intelligence API — Returns AI-generated crowd management recommendations
 * based on the current stadium simulation state. Directly supports the FIFA World Cup
 * 2026 challenge areas: crowd management, real-time decision support, and operational intelligence.
 * @route POST /api/crowd-intelligence
 */
app.post('/api/crowd-intelligence', async (req, res) => {
  if (isRateLimited(req.ip)) {
    return res.status(429).json({ error: 'Too Many Requests' });
  }

  try {
    const simContext = sanitizeSimulationContext(req.body.simulationContext);
    const lang = validateAgainstAllowlist(req.body.lang, ALLOWED_LANGUAGES, 'en');

    // Build crowd intelligence specific prompt
    const crowdPrompt = `You are StadiumPulse AI Crowd Intelligence Engine for the FIFA World Cup 2026.
Analyze the following live stadium sensor data and provide exactly 3 actionable crowd management recommendations.

LIVE SENSOR DATA:
- Gate A: ${simContext.gateA || 20}% congestion, ${simContext.gateAWait || 5} min wait
- Gate B: ${simContext.gateB || 35}% congestion, ${simContext.gateBWait || 10} min wait
- Gate C: ${simContext.gateC || 15}% congestion, ${simContext.gateCWait || 3} min wait
- Gate D: ${simContext.gateD || 80}% congestion, ${simContext.gateDWait || 25} min wait
- Food Arena: ${simContext.concessionsFood || 8} min wait
- Drink Zone: ${simContext.concessionsDrink || 4} min wait
- Incidents: ${simContext.activeIncident || 'None'}
- Green Transit: ${simContext.greenShuttleUsage || 45}%

RESPONSE FORMAT (respond in ${lang}):
Return a JSON object with exactly this structure:
{
  "severity": "low" | "medium" | "high",
  "recommendations": ["action 1", "action 2", "action 3"],
  "crowdFlow": "balanced" | "uneven" | "critical"
}`;

    const model = getGeminiModel();
    if (!model) {
      // Local fallback crowd intelligence
      const severity = (simContext.gateD || 80) > 70 ? 'high' : (simContext.gateD || 80) > 40 ? 'medium' : 'low';
      return res.json({
        severity,
        recommendations: [
          'Redirect foot traffic from Gate D to Gate C for faster entry.',
          'Deploy 2 additional stewards to the West Concourse food area.',
          'Announce green transit shuttle availability on PA system.'
        ],
        crowdFlow: severity === 'high' ? 'critical' : severity === 'medium' ? 'uneven' : 'balanced'
      });
    }

    const result = await model.generateContent([{ text: crowdPrompt }]);
    const rawText = result.response.text();

    // Attempt to parse JSON from AI response
    try {
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return res.json(parsed);
      }
    } catch { /* fallthrough to raw response */ }

    return res.json({ severity: 'medium', recommendations: [rawText], crowdFlow: 'uneven' });

  } catch (err) {
    console.error('Crowd Intelligence Error:', err);
    return res.status(500).json({ error: 'Crowd intelligence service unavailable', details: err.message });
  }
});

// ---------------------------------------------------------------------------
// System Prompt Builder
// ---------------------------------------------------------------------------

/**
 * Constructs the detailed Gemini system prompt with FIFA World Cup 2026 context,
 * stadium sensor data, and role-specific behavior instructions.
 * @param {string} role - User role ('fan' or 'staff')
 * @param {string} lang - Language code ('en', 'es', 'fr')
 * @param {object} simContext - Sanitized simulation state
 * @returns {string} Complete system prompt
 */
function buildSystemPrompt(role, lang, simContext) {
  return `You are StadiumPulse AI, an intelligent, helpful virtual assistant for the FIFA World Cup 2026 stadium.
You are chatting with a user in the role of: "${role.toUpperCase()}".
The current system language is: "${lang}". Please respond in that language.

FIFA WORLD CUP 2026 CONTEXT:
This is an official tournament match venue. Your purpose is to enhance crowd management,
stadium navigation, accessibility support, sustainable transportation, and real-time operational
decision support during the FIFA World Cup 2026.

STADIUM SIMULATOR CONTEXT (Real-Time Sensors):
- Gates status:
  * Gate A: Congestion ${simContext.gateA || 20}%, Wait Time ${simContext.gateAWait || 5} min. Status: ${simContext.gateAStatus || 'Normal'}.
  * Gate B: Congestion ${simContext.gateB || 35}%, Wait Time ${simContext.gateBWait || 10} min. Status: ${simContext.gateBStatus || 'Normal'}.
  * Gate C: Congestion ${simContext.gateC || 15}%, Wait Time ${simContext.gateCWait || 3} min. Status: ${simContext.gateCStatus || 'Normal'}.
  * Gate D: Congestion ${simContext.gateD || 80}%, Wait Time ${simContext.gateDWait || 25} min. Status: ${simContext.gateDStatus || 'Congested'}.
- Concessions status:
  * Food Arena: Wait Time ${simContext.concessionsFood || 8} min.
  * Drink Zone: Wait Time ${simContext.concessionsDrink || 4} min.
- Restrooms status:
  * Sector 1: Congestion ${simContext.restroomsS1 || 'Normal'}.
  * Sector 2: Congestion ${simContext.restroomsS2 || 'Busy'}.
- Active Incidents/Events: ${simContext.activeIncident || 'None. Everything is running smoothly.'}
- Sustainability Goal: ${simContext.greenShuttleUsage || 45}% fans chose public transport.

INSTRUCTIONS:
1. Provide highly readable, friendly, and beautifully formatted responses.
2. Use short paragraphs (1-2 sentences max) to avoid dense blocks of text.
3. Use bullet points or emojis when listing options, wait times, or gates.
4. Use **bold text** to highlight important numbers, gates, or critical information.
5. If the role is 'fan', maintain a welcoming, enthusiastic tone. Focus on making their matchday easy — navigation, queue times, accessibility, sustainability tips.
6. If the role is 'staff', maintain a crisp, professional tone. Focus on crowd management, emergency protocols, volunteer dispatch, bottleneck resolution, and operational intelligence.
7. Keep the response easily scannable for a mobile phone screen! Avoid technical jargon.
8. Always consider the FIFA World Cup 2026 context — this is a world-class international sporting event with diverse, multilingual audiences.`;
}

// ---------------------------------------------------------------------------
// Rule-Based Local AI Response Generator (Robust Demo Fallback)
// ---------------------------------------------------------------------------

/**
 * Keyword categories used by the local fallback response matcher.
 * Each entry maps a response category to its trigger keywords.
 * @constant {Array<{category: string, keywords: string[]}>}
 */
const KEYWORD_CATEGORIES = [
  { category: 'gate', keywords: ['gate', 'puerta', 'porte', 'entrance', 'entrada', 'entry'] },
  { category: 'transit', keywords: ['transit', 'metro', 'bus', 'car', 'eco', 'green', 'transport', 'transporte', 'shuttle'] },
  { category: 'food', keywords: ['food', 'drink', 'concession', 'beer', 'eat', 'wait', 'queue', 'line', 'comida', 'fila', 'restaur'] },
  { category: 'accessibility', keywords: ['access', 'wheelchair', 'ramp', 'elevator', 'disabled', 'handicap', 'silla', 'ascensor'] },
  { category: 'incident', keywords: ['incident', 'accident', 'alert', 'security', 'medical', 'fire', 'help', 'emergencia', 'seguridad'] },
  { category: 'staff', keywords: ['staff', 'volunteer', 'shift', 'work', 'personal', 'voluntario'] }
];

/**
 * Generates a context-aware local response when Gemini API is unavailable.
 * Uses a data-driven keyword matcher to select the appropriate response template.
 * @param {string} message - User query text
 * @param {string} role - User role ('fan' or 'staff')
 * @param {string} lang - Language code ('en', 'es', 'fr')
 * @param {object} context - Current stadium simulation state
 * @returns {string} Formatted markdown response
 */
function generateLocalResponse(message, role, lang, context) {
  const query = message.toLowerCase();

  // Language-specific intro banners
  const introBanners = {
    en: '🤖 **StadiumPulse AI (Local Demo Mode)**\n\n',
    es: '🤖 **StadiumPulse AI (Modo Demo Local)**\n\n',
    fr: '🤖 **StadiumPulse AI (Mode Démo Local)**\n\n'
  };
  const responseIntro = introBanners[lang] || introBanners.en;

  // Multilingual response templates
  const responses = {
    en: {
      default: "That is a great question about stadium operations! In a live environment with an active Gemini API key, I will give you a real-time Generative response. Please check the simulator panel to trigger updates or change gate configurations.",
      gate: `🚪 **Gate Status Support:**\n- **Gate A (North):** ${context.gateA || 20}% Congestion | Wait: ${context.gateAWait || 5} min\n- **Gate B (South):** ${context.gateB || 35}% Congestion | Wait: ${context.gateBWait || 10} min\n- **Gate C (East):** ${context.gateC || 15}% Congestion | Wait: ${context.gateCWait || 3} min\n- **Gate D (West):** ${context.gateD || 80}% Congestion | Wait: ${context.gateDWait || 25} min\n\n*Recommendation:* Use **Gate C** for the fastest access right now.`,
      transit: `🌿 **Eco-Friendly Transit:**\n- Over ${context.greenShuttleUsage || 45}% of fans are using public transit today!\n- Take the **Metro Stadium Line** (Red Line) or our zero-emission **EV Shuttle Express** from Parking Zone East.\n- Log your trip in the Carbon Footprint panel to claim your "Green Tournament Badge"!`,
      food: `🍔 **Concessions & Queues:**\n- **Food Arena:** Average wait time is ${context.concessionsFood || 8} minutes.\n- **Drink Zone:** Average wait time is ${context.concessionsDrink || 4} minutes.\n- Concessions at the West Concourse are less busy. Use the Mobile Order feature in the app to skip the lines.`,
      accessibility: `♿ **Accessibility Assistance:**\n- Ramps are available at all gates. Gate C offers direct level access to elevator bays for Sector 100-200.\n- Wheelchair-accessible restrooms are located adjacent to Sections 104, 115, and 208.\n- Ask any steward in a high-vis yellow vest for escort services.`,
      incident: `⚠️ **Operations Support:**\n- **Current Incident status:** ${context.activeIncident || 'No current incidents reported.'}\n- *Staff Protocol:* If an incident is active, coordinate with security dispatch via Channel 4 immediately. Ensure crowd flow is rerouted away from congested gate areas.`,
      staff: `📋 **Venue Operations & Staff Quick-Guide:**\n- Shift check-in is located at Level B1, Volunteer Center.\n- Incident protocol: Log all issues in the dashboard. For medical/fire, trigger the simulator's alarm to immediately update routes.\n- Stadium capacity is currently high. Restroom lines at Sector 2 are congested.`
    },
    es: {
      default: "¡Es una excelente pregunta sobre el estadio! En un entorno activo con la clave API de Gemini, te daría una respuesta generativa en tiempo real. Por favor, revisa el panel de simulación.",
      gate: `🚪 **Estado de las Puertas:**\n- **Puerta A (Norte):** ${context.gateA || 20}% Congestionado | Espera: ${context.gateAWait || 5} min\n- **Puerta B (Sur):** ${context.gateB || 35}% Congestionado | Espera: ${context.gateBWait || 10} min\n- **Puerta C (Este):** ${context.gateC || 15}% Congestionado | Espera: ${context.gateCWait || 3} min\n- **Puerta D (Oeste):** ${context.gateD || 80}% Congestionado | Espera: ${context.gateDWait || 25} min\n\n*Recomendación:* Use la **Puerta C** para el acceso más rápido ahora mismo.`,
      transit: `🌿 **Tránsito Ecológico:**\n- ¡Más del ${context.greenShuttleUsage || 45}% de los aficionados usan el transporte público hoy!\n- Tome la **Línea del Metro del Estadio** o nuestro **Transbordador Eléctrico Express** de cero emisiones.`,
      food: `🍔 **Concesiones y Filas:**\n- **Área de Comida:** Tiempo promedio de espera ${context.concessionsFood || 8} minutos.\n- **Zona de Bebidas:** Tiempo promedio de espera ${context.concessionsDrink || 4} minutos.`,
      accessibility: `♿ **Asistencia de Accesibilidad:**\n- Hay rampas disponibles en todas las puertas. La Puerta C ofrece acceso directo en ascensor para los sectores 100-200.`,
      incident: `⚠️ **Soporte de Operaciones:**\n- **Estado de incidente actual:** ${context.activeIncident || 'No se reportan incidentes.'}\n- *Protocolo de personal:* Si el incidente está activo, coordinar con seguridad inmediatamente.`,
      staff: `📋 **Guía del Personal del Estadio:**\n- El registro de turnos está en el Nivel B1. En caso de incidentes graves, use el panel de alertas del simulador.`
    },
    fr: {
      default: "C'est une excellente question sur les opérations du stade! Dans un environnement de production avec une clé API Gemini, je fournirais une réponse générative en temps réel.",
      gate: `🚪 **État des Portes:**\n- **Porte A (Nord):** ${context.gateA || 20}% Congestion | Attente: ${context.gateAWait || 5} min\n- **Porte B (Sud):** ${context.gateB || 35}% Congestion | Attente: ${context.gateBWait || 10} min\n- **Porte C (Est):** ${context.gateC || 15}% Congestion | Attente: ${context.gateCWait || 3} min\n- **Porte D (Ouest):** ${context.gateD || 80}% Congestion | Attente: ${context.gateDWait || 25} min\n\n*Recommandation:* Utilisez la **Porte C** pour le passage le plus rapide.`,
      transit: `🌿 **Transports Écologiques:**\n- Plus de ${context.greenShuttleUsage || 45}% des supporters utilisent les transports en commun aujourd'hui!\n- Prenez la **Ligne de Métro du Stade** ou notre **Navette Électrique Express**.`,
      food: `🍔 **Restauration & Files d'attente:**\n- **Espace Restauration:** L'attente est de ${context.concessionsFood || 8} minutes.\n- **Zone Boissons:** L'attente est de ${context.concessionsDrink || 4} minutes.`,
      accessibility: `♿ **Assistance Accessibilité:**\n- Des rampes d'accès sont disponibles à toutes les portes. La Porte C donne un accès direct aux ascenseurs des Secteurs 100-200.`,
      incident: `⚠️ **Support des Opérations:**\n- **Incident actif:** ${context.activeIncident || 'Aucun incident signalé.'}`,
      staff: `📋 **Guide Opérationnel du Personnel:**\n- L'enregistrement des équipes se fait au Niveau B1. En cas de problème majeur, déclenchez l'alerte sur le tableau de bord.`
    }
  };

  const selectedLang = responses[lang] ? lang : 'en';
  const dict = responses[selectedLang];

  // Data-driven keyword matching — cleaner than chained if/includes
  for (const { category, keywords } of KEYWORD_CATEGORIES) {
    if (keywords.some(kw => query.includes(kw))) {
      return responseIntro + dict[category];
    }
  }

  // Staff role default if no keyword matched
  if (role === 'staff') {
    return responseIntro + dict.staff;
  }

  return responseIntro + dict.default;
}

// ---------------------------------------------------------------------------
// Fallback & Error Handling
// ---------------------------------------------------------------------------

/** Serves the single-page frontend for all unmatched routes (SPA fallback). */
app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

/**
 * Global error handler — catches unhandled Express errors.
 * Returns structured JSON error responses.
 */
app.use((err, _req, res, _next) => {
  if (err.type === 'entity.too.large' || err.status === 413) {
    return res.status(413).json({ error: 'Payload Too Large', message: 'Request body exceeds the maximum size limit.' });
  }
  console.error('Server execution error:', err);
  res.status(500).json({ error: 'Internal Server Error', message: err.message });
});

// Do not listen on a port if running in Vercel serverless environment
if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`🚀 StadiumPulse AI Server running on http://localhost:${PORT}`);
  });
}

export default app;

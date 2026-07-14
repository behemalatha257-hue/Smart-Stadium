import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 8080;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Disable X-Powered-By to prevent fingerprinting
app.disable('x-powered-by');

// Apply secure custom headers (equivalent to Helmet basic protections)
app.use((req, res, next) => {
  res.set({
    'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none';",
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'no-referrer',
    'Permissions-Policy': 'geolocation=(), microphone=(), camera=(), interest-cohort=()'
  });
  next();
});

// Impose JSON payload body limits to prevent Denial of Service attacks
app.use(express.json({ limit: '15kb' }));

// Serve static frontend assets from public directory
app.use(express.static(path.join(__dirname, 'public')));

// Health Check API
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Helper function to sanitize user strings
function sanitizeInput(str) {
  if (typeof str !== 'string') return '';
  return str.replace(/[<>]/g, '').trim();
}

// Chat API Route (Relays requests to Google Gemini or operates fallback)
app.post('/api/chat', async (req, res) => {
  try {
    const rawMessage = req.body.message;
    const rawRole = req.body.role || 'fan'; // 'fan' or 'staff'
    const rawLang = req.body.lang || 'en'; // language support
    const simContext = req.body.simulationContext || {};

    const message = sanitizeInput(rawMessage);
    if (!message) {
      return res.status(400).json({ error: 'Input message is required' });
    }

    const apiKey = process.env.GEMINI_API_KEY;

    // Check if Gemini API key is missing, placeholder, or invalid
    if (!apiKey || apiKey === 'your_gemini_api_key_here' || apiKey === 'undefined' || apiKey === '') {
      // Use local rule-based response generator utilizing simulation context
      const reply = generateLocalResponse(message, rawRole, rawLang, simContext);
      return res.json({ reply });
    }

    // Call Google Gemini API
    const { GoogleGenerativeAI } = await import('@google/generative-ai');
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-3.1-flash-lite' });

    // Construct detailed prompt injecting simulator context for operational awareness
    const systemPrompt = `You are StadiumPulse AI, an intelligent, helpful virtual assistant for the FIFA World Cup 2026 stadium.
You are chatting with a user in the role of: "${rawRole.toUpperCase()}".
The current system language is: "${rawLang}". Please respond in that language.

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
1. Provide accurate assistance based on the context above.
2. If the role is 'fan', focus on safety, queue times, sustainability, accessibility, and public transit.
3. If the role is 'staff', focus on emergency protocols, volunteer dispatch, bottleneck resolution, and operations guidance.
4. Keep the response clear, structured, and friendly. Avoid excessive length. Use markdown formatting.`;

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

// Rule-based Local AI Response Generator (Robust Demo Fallback)
function generateLocalResponse(message, role, lang, context) {
  const query = message.toLowerCase();
  
  // Set up language specific introductions
  let responseIntro = '';
  if (lang === 'es') {
    responseIntro = '🤖 **StadiumPulse AI (Modo Demo Local)**\n\n';
  } else if (lang === 'fr') {
    responseIntro = '🤖 **StadiumPulse AI (Mode Démo Local)**\n\n';
  } else {
    responseIntro = '🤖 **StadiumPulse AI (Local Demo Mode)**\n\n';
  }

  // Response Content Dictionary
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

  if (query.includes('gate') || query.includes('puerta') || query.includes('porte') || query.includes('entrance') || query.includes('entrada')) {
    return responseIntro + dict.gate;
  }
  if (query.includes('transit') || query.includes('metro') || query.includes('bus') || query.includes('car') || query.includes('eco') || query.includes('green') || query.includes('transport') || query.includes('transporte')) {
    return responseIntro + dict.transit;
  }
  if (query.includes('food') || query.includes('drink') || query.includes('concession') || query.includes('beer') || query.includes('eat') || query.includes('wait') || query.includes('queue') || query.includes('line') || query.includes('comida') || query.includes('fila') || query.includes('restaur')) {
    return responseIntro + dict.food;
  }
  if (query.includes('access') || query.includes('wheelchair') || query.includes('ramp') || query.includes('elevator') || query.includes('disabled') || query.includes('handicap') || query.includes('silla') || query.includes('ascensor')) {
    return responseIntro + dict.accessibility;
  }
  if (query.includes('incident') || query.includes('accident') || query.includes('alert') || query.includes('security') || query.includes('medical') || query.includes('fire') || query.includes('help') || query.includes('emergencia') || query.includes('seguridad')) {
    return responseIntro + dict.incident;
  }
  if (role === 'staff' || query.includes('staff') || query.includes('volunteer') || query.includes('shift') || query.includes('work') || query.includes('personal') || query.includes('voluntario')) {
    return responseIntro + dict.staff;
  }

  return responseIntro + dict.default;
}

// Serves the single page frontend (fallback)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Global error handler
app.use((err, req, res, next) => {
  if (err.type === 'entity.too.large' || err.status === 413) {
    return res.status(413).json({ error: 'Payload Too Large', message: 'Request body exceeds the maximum size limit.' });
  }
  console.error('Server execution error:', err);
  res.status(500).json({ error: 'Internal Server Error', message: err.message });
});

if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log(`🚀 StadiumPulse AI Server running on http://localhost:${PORT}`);
  });
}

export default app;

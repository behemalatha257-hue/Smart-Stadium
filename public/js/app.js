/**
 * Main Application Orchestrator
 * Connects the DOM, SVG Map, Sustainability module, Simulation states, and AI Gateway.
 */

import { getSimulationState, setScenario, getWaitTimeRating, adjustGreenShuttleUsage } from './simulation.js';
import { calculateCarbonFootprint, convertToTreeOffset } from './transit.js';
import { sendMessageToAI, speakResponse, startVoiceRecognition } from './gemini.js';

// Local State
let currentRole = 'fan';
let currentLang = 'en';
let speechInstance = null;
let isListening = false;

// Dictionary for UI Translations and Greeting Alerts
const TRANSLATIONS = {
  en: {
    systemGreet: "Welcome to the FIFA World Cup 2026 Stadium Hub! 🏆\n\nI am your Generative AI assistant, aware of real-time stadium queues, gates, accessibility pathways, and sustainable routes. How can I help you today?",
    fanTitle: "Smart Fan Companion",
    staffTitle: "Operations Co-Pilot",
    waitLabel: "Wait",
    minLabel: "min",
    incidentLabel: "Incident",
    normalStatus: "Normal Matchday operations active. Everything is running smoothly.",
    halftimeStatus: "[SYSTEM ALERT] Halftime Concession & Restroom Congestion Surge triggered.",
    gatedStatus: "[SYSTEM ALERT] Gate D Scanner failure causing severe queue buildup. Redirecting fans.",
    incidentStatus: "[SYSTEM ALERT] Local slip hazard reported at West Concourse Sector 102.",
    transitStatus: "[SYSTEM ALERT] Metro Line outage. Operations launching additional EV Shuttles.",
    placeholder: "Ask StadiumPulse AI...",
    listening: "Listening...",
    systemAlertPrefix: "[SYSTEM ALERT]: ",
    carbonDesc: "Equivalent to planting {num} trees!",
    carbonLogged: "Eco-journey logged! Green transit share updated.",
    chips: {
      fan: [
        "🚪 How do I get to Gate C?",
        "🍔 Concessions wait times?",
        "♿ Accessible seating paths",
        "🌿 Green transport options"
      ],
      staff: [
        "🚨 Report incident Sector 102",
        "📦 Lost and Found protocol",
        "👮 Dispatch stewards to Gate D",
        "🔥 Evacuation protocols"
      ]
    }
  },
  es: {
    systemGreet: "¡Bienvenido al Centro del Estadio de la Copa Mundial de la FIFA 2026! 🏆\n\nSoy tu asistente de IA Generativa. Tengo conocimiento en tiempo real de las filas, puertas, accesibilidad y rutas ecológicas. ¿Cómo puedo ayudarte hoy?",
    fanTitle: "Acompañante de Aficionados",
    staffTitle: "Co-Piloto de Operaciones",
    waitLabel: "Espera",
    minLabel: "min",
    incidentLabel: "Incidente",
    normalStatus: "Operaciones normales del día de partido activas.",
    halftimeStatus: "[ALERTA] Gran congestión de alimentos y sanitarios en el entretiempo.",
    gatedStatus: "[ALERTA] Fallo del escáner en Puerta D. Filas de espera largas.",
    incidentStatus: "[ALERTA] Peligro de resbalón reportado en Sector 102.",
    transitStatus: "[ALERTA] Interrupción del Metro. Activando transbordadores eléctricos.",
    placeholder: "Pregunta a StadiumPulse AI...",
    listening: "Escuchando...",
    systemAlertPrefix: "[ALERTA DEL SISTEMA]: ",
    carbonDesc: "¡Equivalente a plantar {num} árboles!",
    carbonLogged: "¡Viaje ecológico registrado! Se actualizó la cuota verde.",
    chips: {
      fan: [
        "🚪 ¿Cómo llego a la Puerta C?",
        "🍔 ¿Tiempos de espera de comida?",
        "♿ Rutas para silla de ruedas",
        "🌿 Opciones de transporte ecológico"
      ],
      staff: [
        "🚨 Reportar incidente Sector 102",
        "📦 Protocolo de objetos perdidos",
        "👮 Enviar personal a Puerta D",
        "🔥 Protocolos de evacuación"
      ]
    }
  },
  fr: {
    systemGreet: "Bienvenue sur le Hub Opérations du Stade de la Coupe du Monde de la FIFA 2026 ! 🏆\n\nJe suis votre assistant IA générative, informé des files d'attente, des accès PMR et des transports écologiques. Comment puis-je vous aider ?",
    fanTitle: "Compagnon des Supporters",
    staffTitle: "Co-Pilote des Opérations",
    waitLabel: "Attente",
    minLabel: "min",
    incidentLabel: "Incident",
    normalStatus: "Opérations normales du match actives. Tout se passe bien.",
    halftimeStatus: "[ALERTE] Forte affluence aux buvettes et sanitaires à la mi-temps.",
    gatedStatus: "[ALERTE] Panne de scanner à la Porte D. File d'attente importante.",
    incidentStatus: "[ALERTE] Risque de glissade signalé au Secteur 102.",
    transitStatus: "[ALERTE] Panne de métro. Déploiement de navettes électriques supplémentaires.",
    placeholder: "Demandez à StadiumPulse AI...",
    listening: "Écoute en cours...",
    systemAlertPrefix: "[ALERTE SYSTÈME] : ",
    carbonDesc: "Équivalent à planter {num} arbres !",
    carbonLogged: "Trajet écolo enregistré ! Part de transport vert mise à jour.",
    chips: {
      fan: [
        "🚪 Comment aller à la Porte C ?",
        "🍔 Temps d'attente buvette ?",
        "♿ Chemins d'accès fauteuil",
        "🌿 Navettes écologiques"
      ],
      staff: [
        "🚨 Signaler incident Secteur 102",
        "📦 Protocole Objets Trouvés",
        "👮 Envoyer stewards Porte D",
        "🔥 Procédures d'évacuation"
      ]
    }
  }
};

// DOM Elements
const selectLang = document.getElementById('select-lang');
const btnFontToggle = document.getElementById('btn-font-toggle');
const btnContrastToggle = document.getElementById('btn-contrast-toggle');

const valAttendance = document.getElementById('val-attendance');
const valTransit = document.getElementById('val-transit');
const valWait = document.getElementById('val-wait');
const valWaitGate = document.getElementById('val-wait-gate');
const valIncidents = document.getElementById('val-incidents');
const indicatorIncident = document.getElementById('indicator-incident');

const btnSimNormal = document.getElementById('btn-sim-normal');
const btnSimHalftime = document.getElementById('btn-sim-halftime');
const btnSimGated = document.getElementById('btn-sim-gated');
const btnSimIncident = document.getElementById('btn-sim-incident');
const btnSimTransit = document.getElementById('btn-sim-transit');

const selectTransitType = document.getElementById('select-transit-type');
const inputDistance = document.getElementById('input-distance');
const btnCalcCarbon = document.getElementById('btn-calc-carbon');
const carbonVal = document.getElementById('carbon-val');
const carbonDisplayDesc = document.getElementById('carbon-display-desc');
const pledgeMetro = document.getElementById('pledge-metro');
const pledgeRecycle = document.getElementById('pledge-recycle');

const titleAiAssistant = document.getElementById('title-ai-assistant');
const tabFan = document.getElementById('tab-fan');
const tabStaff = document.getElementById('tab-staff');
const chatViewport = document.getElementById('chat-viewport');
const chipsContainer = document.getElementById('chips-container');
const chatForm = document.getElementById('chat-form');
const chatInput = document.getElementById('chat-input');
const btnMic = document.getElementById('btn-mic');

// SVG Map Nodes
const gateA = document.getElementById('gate-a');
const gateB = document.getElementById('gate-b');
const gateC = document.getElementById('gate-c');
const gateD = document.getElementById('gate-d');
const nodeFood = document.getElementById('node-food');
const nodeDrink = document.getElementById('node-drink');
const nodeRestroom1 = document.getElementById('node-restroom-1');
const nodeRestroom2 = document.getElementById('node-restroom-2');
const sectorNorth = document.getElementById('sector-north');
const sectorSouth = document.getElementById('sector-south');
const sectorEast = document.getElementById('sector-east');
const sectorWest = document.getElementById('sector-west');

/**
 * Bootstraps the application event lifecycle
 */
document.addEventListener('DOMContentLoaded', () => {
  initAccessibility();
  initLanguages();
  initRoleTabs();
  initSimulator();
  initCarbonTracker();
  initChatConsole();

  // Draw initial state
  renderDashboard(getSimulationState());
});

/* ==========================================================================
   Accessibility Services
   ========================================================================== */
function initAccessibility() {
  btnFontToggle.addEventListener('click', () => {
    document.body.classList.toggle('font-large');
    const isLarge = document.body.classList.contains('font-large');
    btnFontToggle.setAttribute('aria-pressed', isLarge.toString());
  });

  btnContrastToggle.addEventListener('click', () => {
    document.body.classList.toggle('high-contrast');
    const isHC = document.body.classList.contains('high-contrast');
    btnContrastToggle.setAttribute('aria-pressed', isHC.toString());
  });
}

/* ==========================================================================
   Multilingual Localization Settings
   ========================================================================== */
function initLanguages() {
  selectLang.addEventListener('change', (e) => {
    currentLang = e.target.value;
    updateLanguageUI();
  });
}

function updateLanguageUI() {
  const dict = TRANSLATIONS[currentLang];
  
  // Set placeholders and titles
  chatInput.placeholder = dict.placeholder;
  titleAiAssistant.textContent = currentRole === 'fan' ? dict.fanTitle : dict.staffTitle;
  
  // Reload chips
  renderSuggestionChips();

  // Update greeting voice parameters
  renderSystemNotification(`${dict.systemAlertPrefix}Language changed to ${selectLang.options[selectLang.selectedIndex].text}.`);
}

/* ==========================================================================
   Role Tabs (Fan vs. Staff)
   ========================================================================== */
function initRoleTabs() {
  tabFan.addEventListener('click', () => {
    if (currentRole === 'fan') return;
    currentRole = 'fan';
    tabFan.classList.add('active');
    tabStaff.classList.remove('active');
    tabFan.setAttribute('aria-selected', 'true');
    tabStaff.setAttribute('aria-selected', 'false');
    
    updateLanguageUI();
    
    // Add Welcome Greet for role
    addChatBubble(TRANSLATIONS[currentLang].systemGreet, 'ai');
  });

  tabStaff.addEventListener('click', () => {
    if (currentRole === 'staff') return;
    currentRole = 'staff';
    tabStaff.classList.add('active');
    tabFan.classList.remove('active');
    tabStaff.setAttribute('aria-selected', 'true');
    tabFan.setAttribute('aria-selected', 'false');
    
    updateLanguageUI();
    
    // Add Welcome Greet for role
    const staffWelcome = currentLang === 'es' 
      ? '📋 **Co-Piloto de Operaciones de Estadio**\n\nHola personal de operaciones. Tengo visibilidad de todos los sensores y los niveles de congestión. Estoy listo para ayudarte con redirecciones de flujos, reportar incidentes y protocolos de seguridad.' 
      : currentLang === 'fr'
      ? '📋 **Co-Pilote des Opérations de Stade**\n\nBonjour équipe opérationnelle. J\'ai la visibilité sur tous les capteurs de congestion. Je suis prêt à vous assister pour les réorientations de foule et les protocoles de sécurité.'
      : '📋 **Operations Co-Pilot Active**\n\nHello operations team member. I have full visibility of sensor values, gate lines, and concession states. Ask me for crowd redirections, incident protocol guidelines, and task allocation support.';
    addChatBubble(staffWelcome, 'ai');
  });
}

/* ==========================================================================
   Simulator Controls & Map State Visuals
   ========================================================================== */
function initSimulator() {
  const simButtons = [
    { btn: btnSimNormal, name: 'normal', msgKey: 'normalStatus' },
    { btn: btnSimHalftime, name: 'halftime', msgKey: 'halftimeStatus' },
    { btn: btnSimGated, name: 'gated', msgKey: 'gatedStatus' },
    { btn: btnSimIncident, name: 'incident', msgKey: 'incidentStatus' },
    { btn: btnSimTransit, name: 'transit', msgKey: 'transitStatus' }
  ];

  simButtons.forEach(({ btn, name, msgKey }) => {
    btn.addEventListener('click', () => {
      // Toggle active classes
      simButtons.forEach(b => {
        b.btn.classList.remove('active');
        b.btn.classList.remove('incident-active');
      });

      if (name === 'normal') {
        btn.classList.add('active');
      } else {
        btn.classList.add('incident-active');
      }

      const updatedState = setScenario(name);
      renderDashboard(updatedState);

      // Log alert system prompt
      const dict = TRANSLATIONS[currentLang];
      renderSystemNotification(dict[msgKey]);
    });
  });
}

/**
 * Updates DOM statistics and updates SVG Map colors
 * @param {object} state - Current simulation state
 */
function renderDashboard(state) {
  valAttendance.textContent = state.attendance.toLocaleString();
  valTransit.textContent = `${state.greenShuttleUsage}%`;
  valIncidents.textContent = state.activeIncidentCount;

  // Set warning severity badge
  if (state.activeIncidentCount > 0) {
    indicatorIncident.textContent = 'Incident Active';
    indicatorIncident.className = 'stat-indicator alert';
  } else {
    indicatorIncident.textContent = 'Clear';
    indicatorIncident.className = 'stat-indicator';
  }

  // Find gate with maximum wait time
  const gates = [
    { label: 'Gate A', wait: state.gateAWait, target: gateA, congestion: state.gateA },
    { label: 'Gate B', wait: state.gateBWait, target: gateB, congestion: state.gateB },
    { label: 'Gate C', wait: state.gateCWait, target: gateC, congestion: state.gateC },
    { label: 'Gate D', wait: state.gateDWait, target: gateD, congestion: state.gateD }
  ];

  gates.sort((x, y) => y.wait - x.wait);
  valWait.textContent = `${gates[0].wait} min`;
  valWaitGate.textContent = gates[0].label;

  // Repaint SVG Gate indicators
  gates.forEach(g => {
    g.target.classList.remove('gate-normal', 'gate-warning', 'gate-critical');
    
    if (g.congestion < 30) {
      g.target.classList.add('gate-normal');
    } else if (g.congestion < 70) {
      g.target.classList.add('gate-warning');
    } else {
      g.target.classList.add('gate-critical');
    }
  });

  // Repaint Restroom nodes
  nodeRestroom1.style.fill = state.restroomsS1 === 'Busy' ? '#ff1744' : '#e040fb';
  nodeRestroom2.style.fill = state.restroomsS2 === 'Busy' ? '#ff1744' : '#e040fb';

  // Repaint concessions nodes
  nodeFood.style.fill = state.concessionsFood > 15 ? '#ff1744' : '#d4af37';
  nodeDrink.style.fill = state.concessionsDrink > 10 ? '#ff1744' : '#00b0ff';

  // Pulse sectors if they contain incident (Sector 102 corresponds to South / East interface)
  sectorSouth.classList.remove('active-incident');
  if (state.activeIncident.includes('Sector 102')) {
    sectorSouth.classList.add('active-incident');
  }
}

/* ==========================================================================
   Sustainability Tracker Panel
   ========================================================================== */
function initCarbonTracker() {
  btnCalcCarbon.addEventListener('click', () => {
    const mode = selectTransitType.value;
    const distance = parseFloat(inputDistance.value) || 0;

    if (distance <= 0) return;

    const co2 = calculateCarbonFootprint(mode, distance);
    const trees = convertToTreeOffset(co2);

    carbonVal.textContent = `${co2} kg`;

    const dict = TRANSLATIONS[currentLang];
    carbonDisplayDesc.textContent = dict.carbonDesc.replace('{num}', trees.toString());

    // Update green transit usage if user selected clean transport modes
    if (mode === 'ev-shuttle' || mode === 'metro') {
      const updatedState = adjustGreenShuttleUsage(2);
      renderDashboard(updatedState);
      renderSystemNotification(dict.carbonLogged);
    }
  });

  // Checkbox pledges trigger small updates
  pledgeMetro.addEventListener('change', (e) => {
    const updatedState = adjustGreenShuttleUsage(e.target.checked ? 1 : -1);
    renderDashboard(updatedState);
  });

  pledgeRecycle.addEventListener('change', (e) => {
    const updatedState = adjustGreenShuttleUsage(e.target.checked ? 1 : -1);
    renderDashboard(updatedState);
  });
}

/* ==========================================================================
   AI Chat Assistant Console & Prompt Chips
   ========================================================================== */
function initChatConsole() {
  renderSuggestionChips();

  // Send message from input form
  chatForm.addEventListener('submit', (e) => {
    e.preventDefault();
    submitUserQuery();
  });

  // Voice Speech to Text Recognition
  btnMic.addEventListener('click', () => {
    if (isListening) {
      if (speechInstance) speechInstance.stop();
      return;
    }

    btnMic.classList.add('listening');
    btnMic.textContent = '🔴';
    isListening = true;
    chatInput.placeholder = TRANSLATIONS[currentLang].listening;

    speechInstance = startVoiceRecognition(
      (transcript) => {
        chatInput.value = transcript;
        submitUserQuery();
      },
      () => {
        isListening = false;
        btnMic.classList.remove('listening');
        btnMic.textContent = '🎤';
        chatInput.placeholder = TRANSLATIONS[currentLang].placeholder;
      },
      (err) => {
        console.error('STT Error: ', err);
        renderSystemNotification('Speech recognition failed. Please try typing.');
      }
    );
  });
}

/**
 * Handles user form submissions or chip clicks
 */
async function submitUserQuery(textQuery) {
  const query = textQuery || chatInput.value.trim();
  if (!query) return;

  // Clear input
  chatInput.value = '';

  // Add user bubble
  addChatBubble(query, 'user');

  // Insert loading typing indicator
  const loader = insertTypingIndicator();

  // Get current simulation state to pass as prompt context
  const context = getSimulationState();

  // Send to backend endpoint
  const response = await sendMessageToAI(query, currentRole, currentLang, context);

  // Remove typing indicator loader
  loader.remove();

  // Render response
  addChatBubble(response.reply, 'ai');
}

/**
 * Populates suggestions chips dynamically
 */
function renderSuggestionChips() {
  chipsContainer.innerHTML = '';
  const chips = TRANSLATIONS[currentLang].chips[currentRole];

  chips.forEach(c => {
    const btn = document.createElement('button');
    btn.className = 'chip';
    btn.textContent = c;
    btn.addEventListener('click', () => submitUserQuery(c));
    chipsContainer.appendChild(btn);
  });
}

/**
 * Appends a bubble to the chat logs
 */
function addChatBubble(text, sender) {
  const bubble = document.createElement('div');
  bubble.className = `chat-bubble ${sender}`;

  // Simple Markdown parsing for formatting paragraphs, bold texts and lists in AI responses
  const formattedHtml = parseMarkdownToHtml(text);
  bubble.innerHTML = formattedHtml;

  // If AI sender, append a text-to-speech option button
  if (sender === 'ai') {
    const audioBtn = document.createElement('button');
    audioBtn.className = 'chat-audio-btn';
    audioBtn.textContent = '🔊 Read Aloud';
    audioBtn.setAttribute('aria-label', 'Read response aloud');
    audioBtn.addEventListener('click', () => speakResponse(text, currentLang));
    bubble.appendChild(audioBtn);
  }

  chatViewport.appendChild(bubble);
  chatViewport.scrollTop = chatViewport.scrollHeight;
}

/**
 * Formats basic markdown elements into HTML for cleaner presentation
 */
function parseMarkdownToHtml(text) {
  // Convert linebreaks to paragraphs
  let html = text
    .replace(/\r\n/g, '\n')
    .replace(/\n\n/g, '</p><p>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>');

  // Handle simple bullet list tags
  if (html.includes('- ')) {
    const lines = html.split('\n');
    let insideList = false;
    let listHtml = '';
    
    lines.forEach(line => {
      if (line.trim().startsWith('- ')) {
        if (!insideList) {
          listHtml += '<ul>';
          insideList = true;
        }
        listHtml += `<li>${line.trim().substring(2)}</li>`;
      } else {
        if (insideList) {
          listHtml += '</ul>';
          insideList = false;
        }
        listHtml += line + '\n';
      }
    });
    if (insideList) listHtml += '</ul>';
    html = listHtml;
  }

  return `<p>${html}</p>`;
}

/**
 * Creates visual system alert indicators in chat logs
 */
function renderSystemNotification(msgText) {
  const alertDiv = document.createElement('div');
  alertDiv.className = 'chat-bubble user';
  alertDiv.style.background = 'rgba(255, 145, 0, 0.1)';
  alertDiv.style.borderColor = 'var(--accent-orange)';
  alertDiv.style.alignSelf = 'center';
  alertDiv.style.maxWidth = '95%';
  alertDiv.innerHTML = `<p style="color:var(--accent-orange); font-weight:600; font-size:0.8rem;">${msgText}</p>`;
  
  chatViewport.appendChild(alertDiv);
  chatViewport.scrollTop = chatViewport.scrollHeight;
}

/**
 * Renders bouncing loading dots while fetching reply
 */
function insertTypingIndicator() {
  const container = document.createElement('div');
  container.className = 'chat-bubble ai';
  container.innerHTML = `
    <div class="typing-indicator" aria-label="AI is generating response">
      <div class="typing-dot"></div>
      <div class="typing-dot"></div>
      <div class="typing-dot"></div>
    </div>
  `;
  chatViewport.appendChild(container);
  chatViewport.scrollTop = chatViewport.scrollHeight;
  return container;
}

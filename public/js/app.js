/**
 * @module app
 * @description Main Application Orchestrator for StadiumPulse AI.
 * Coordinates DOM bindings, SVG Stadium Map colors, Sustainability calculator,
 * Simulation states, and server-side GenAI integration.
 *
 * Performance: Uses DocumentFragment for suggestion chip injection, and reduce() for gate queue sorting.
 * Accessibility: Synchronizes aria attributes (e.g. aria-pressed, aria-selected) on UI buttons/tabs.
 */

import { getSimulationState, setScenario, getWaitTimeRating, adjustGreenShuttleUsage } from './simulation.js';
import { calculateCarbonFootprint, convertToTreeOffset } from './transit.js';
import { sendMessageToAI, fetchCrowdIntelligence, speakResponse, startVoiceRecognition } from './gemini.js';

// ---------------------------------------------------------------------------
// Named Constants (Code Quality Improvements)
// ---------------------------------------------------------------------------

/** @constant {string} COLOR_CRITICAL - Critical warning color (Red) */
const COLOR_CRITICAL = '#ff1744';

/** @constant {string} COLOR_NORMAL_RESTROOM - Standard restroom fill color (Purple) */
const COLOR_NORMAL_RESTROOM = '#e040fb';

/** @constant {string} COLOR_NORMAL_FOOD - Standard food area fill color (Gold) */
const COLOR_NORMAL_FOOD = '#d4af37';

/** @constant {string} COLOR_NORMAL_DRINK - Standard drink area fill color (Blue) */
const COLOR_NORMAL_DRINK = '#00b0ff';

/** @constant {number} SUSTAINABILITY_PLEDGE_BOOST - Green share percentage boost for pledges */
const SUSTAINABILITY_PLEDGE_BOOST = 1;

/** @constant {number} SUSTAINABILITY_LOGGED_BOOST - Green share percentage boost for EV/Metro travel */
const SUSTAINABILITY_LOGGED_BOOST = 2;

// ---------------------------------------------------------------------------
// Application Local State
// ---------------------------------------------------------------------------

/** @type {string} currentRole - Currently active UI role ('fan' | 'staff') */
let currentRole = 'fan';

/** @type {string} currentLang - Active language code ('en' | 'es' | 'fr') */
let currentLang = 'en';

/** @type {any} speechInstance - Current Web Speech recognition instance */
let speechInstance = null;

/** @type {boolean} isListening - Speech-to-text listening state */
let isListening = false;

// ---------------------------------------------------------------------------
// Translation Dictionary
// ---------------------------------------------------------------------------

/**
 * Translations and alert labels for the multilingual console.
 * @constant {Object}
 */
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

// ---------------------------------------------------------------------------
// DOM Elements Map
// ---------------------------------------------------------------------------
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

// SVG Layout Nodes
const gateA = document.getElementById('gate-a');
const gateB = document.getElementById('gate-b');
const gateC = document.getElementById('gate-c');
const gateD = document.getElementById('gate-d');
const nodeFood = document.getElementById('node-food');
const nodeDrink = document.getElementById('node-drink');
const nodeRestroom1 = document.getElementById('node-restroom-1');
const nodeRestroom2 = document.getElementById('node-restroom-2');
const sectorSouth = document.getElementById('sector-south');

// Crowd Intelligence DOM Widgets
const crowdIntelCard = document.getElementById('crowd-intelligence-card');
const intelSeverity = document.getElementById('intel-severity');
const intelRecommendations = document.getElementById('intel-recommendations');

// ---------------------------------------------------------------------------
// Initialization & Bootstrap
// ---------------------------------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
  initAccessibility();
  initLanguages();
  initRoleTabs();
  initSimulator();
  initCarbonTracker();
  initChatConsole();

  // Load first scenario and run initial crowd intelligence prediction
  const initialState = getSimulationState();
  renderDashboard(initialState);
  triggerCrowdIntelligenceUpdate(initialState);
});

// ---------------------------------------------------------------------------
// Accessibility Services
// ---------------------------------------------------------------------------
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

// ---------------------------------------------------------------------------
// Multilingual Settings
// ---------------------------------------------------------------------------
function initLanguages() {
  selectLang.addEventListener('change', (e) => {
    currentLang = e.target.value;
    updateLanguageUI();
  });
}

function updateLanguageUI() {
  const dict = TRANSLATIONS[currentLang];
  chatInput.placeholder = dict.placeholder;
  titleAiAssistant.textContent = currentRole === 'fan' ? dict.fanTitle : dict.staffTitle;
  
  // Re-render chips dynamically
  renderSuggestionChips();

  // Notify user in chat log
  renderSystemNotification(`${dict.systemAlertPrefix}Language changed to ${selectLang.options[selectLang.selectedIndex].text}.`);
}

// ---------------------------------------------------------------------------
// Role Toggling Layouts (Fan vs. Staff)
// ---------------------------------------------------------------------------
function initRoleTabs() {
  tabFan.addEventListener('click', () => {
    if (currentRole === 'fan') return;
    currentRole = 'fan';
    tabFan.classList.add('active');
    tabStaff.classList.remove('active');
    tabFan.setAttribute('aria-selected', 'true');
    tabStaff.setAttribute('aria-selected', 'false');
    
    updateLanguageUI();
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
    
    const staffWelcome = currentLang === 'es' 
      ? '📋 **Co-Piloto de Operaciones de Estadio**\n\nHola personal de operaciones. Tengo visibilidad de todos los sensores y los niveles de congestión. Estoy listo para ayudarte con redirecciones de flujos, reportar incidentes y protocolos de seguridad.' 
      : currentLang === 'fr'
      ? '📋 **Co-Pilote des Opérations de Stade**\n\nBonjour équipe opérationnelle. J\'ai la visibilité sur tous les capteurs de congestion. Je suis prêt à vous assister pour les réorientations de foule et les protocoles de sécurité.'
      : '📋 **Operations Co-Pilot Active**\n\nHello operations team member. I have full visibility of sensor values, gate lines, and concession states. Ask me for crowd redirections, incident protocol guidelines, and task allocation support.';
    addChatBubble(staffWelcome, 'ai');
  });
}

// ---------------------------------------------------------------------------
// Operations Simulator Orchestration
// ---------------------------------------------------------------------------
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
      simButtons.forEach(b => {
        b.btn.classList.remove('active', 'incident-active');
      });

      if (name === 'normal') {
        btn.classList.add('active');
      } else {
        btn.classList.add('incident-active');
      }

      const updatedState = setScenario(name);
      renderDashboard(updatedState);
      triggerCrowdIntelligenceUpdate(updatedState);

      const dict = TRANSLATIONS[currentLang];
      renderSystemNotification(dict[msgKey]);
    });
  });
}

/**
 * Updates UI dashboards and stadium maps with live sensor state values.
 * Efficiency Optimization: Uses O(N) array reduction instead of sorting to identify max gate queue.
 *
 * @param {object} state - Cloned stadium simulator state
 */
function renderDashboard(state) {
  valAttendance.textContent = state.attendance.toLocaleString();
  valTransit.textContent = `${state.greenShuttleUsage}%`;
  valIncidents.textContent = state.activeIncidentCount;

  if (state.activeIncidentCount > 0) {
    indicatorIncident.textContent = 'Incident Active';
    indicatorIncident.className = 'stat-indicator alert';
  } else {
    indicatorIncident.textContent = 'Clear';
    indicatorIncident.className = 'stat-indicator';
  }

  // Gates definitions list
  const gates = [
    { label: 'Gate A', wait: state.gateAWait, target: gateA, congestion: state.gateA },
    { label: 'Gate B', wait: state.gateBWait, target: gateB, congestion: state.gateB },
    { label: 'Gate C', wait: state.gateCWait, target: gateC, congestion: state.gateC },
    { label: 'Gate D', wait: state.gateDWait, target: gateD, congestion: state.gateD }
  ];

  // EFFICIENCY FIX: Replaced O(N log N) gates.sort() with O(N) gates.reduce() to find peak gate wait
  const peakGate = gates.reduce((max, g) => (g.wait > max.wait ? g : max), gates[0]);
  valWait.textContent = `${peakGate.wait} min`;
  valWaitGate.textContent = peakGate.label;

  // Repaint SVG Gate indicator colors
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

  // Repaint Concession & Restroom nodes using named constants instead of magic hex strings
  nodeRestroom1.style.fill = state.restroomsS1 === 'Busy' ? COLOR_CRITICAL : COLOR_NORMAL_RESTROOM;
  nodeRestroom2.style.fill = state.restroomsS2 === 'Busy' ? COLOR_CRITICAL : COLOR_NORMAL_RESTROOM;

  nodeFood.style.fill = state.concessionsFood > 15 ? COLOR_CRITICAL : COLOR_NORMAL_FOOD;
  nodeDrink.style.fill = state.concessionsDrink > 10 ? COLOR_CRITICAL : COLOR_NORMAL_DRINK;

  // Visual pulses on South stand if active incident mentions Sector 102
  sectorSouth.classList.remove('active-incident');
  if (state.activeIncident && state.activeIncident.includes('Sector 102')) {
    sectorSouth.classList.add('active-incident');
  }
}

/**
 * Invokes the crowd intelligence endpoint to get AI-powered crowd safety and transit recommendations.
 * Renders recommendations inside the Simulator Console widget.
 *
 * @param {object} state - Current stadium state context
 */
async function triggerCrowdIntelligenceUpdate(state) {
  try {
    const crowdIntel = await fetchCrowdIntelligence(currentLang, state);
    if (!crowdIntel) {
      crowdIntelCard.style.display = 'none';
      return;
    }

    // Repaint severity levels
    intelSeverity.className = `intel-badge severity-${crowdIntel.severity || 'low'}`;
    intelSeverity.textContent = `Severity: ${crowdIntel.severity || 'low'}`;

    // Populate recommendations list using DocumentFragment for maximum DOM performance
    intelRecommendations.innerHTML = '';
    const fragment = document.createDocumentFragment();

    const recs = crowdIntel.recommendations || [];
    recs.forEach(rec => {
      const li = document.createElement('li');
      li.textContent = rec;
      fragment.appendChild(li);
    });

    intelRecommendations.appendChild(fragment);
    crowdIntelCard.style.display = 'block';

  } catch (error) {
    console.error('Failed to update Crowd Intelligence panel:', error);
    crowdIntelCard.style.display = 'none';
  }
}

// ---------------------------------------------------------------------------
// Carbon Tracker Form Calculations
// ---------------------------------------------------------------------------
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

    // Boost green transit share if user logged eco-friendly travel
    if (mode === 'ev-shuttle' || mode === 'metro') {
      const updatedState = adjustGreenShuttleUsage(SUSTAINABILITY_LOGGED_BOOST);
      renderDashboard(updatedState);
      renderSystemNotification(dict.carbonLogged);
    }
  });

  // Pledges changes trigger green updates
  pledgeMetro.addEventListener('change', (e) => {
    const delta = e.target.checked ? SUSTAINABILITY_PLEDGE_BOOST : -SUSTAINABILITY_PLEDGE_BOOST;
    const updatedState = adjustGreenShuttleUsage(delta);
    renderDashboard(updatedState);
  });

  pledgeRecycle.addEventListener('change', (e) => {
    const delta = e.target.checked ? SUSTAINABILITY_PLEDGE_BOOST : -SUSTAINABILITY_PLEDGE_BOOST;
    const updatedState = adjustGreenShuttleUsage(delta);
    renderDashboard(updatedState);
  });
}

// ---------------------------------------------------------------------------
// Chat Console Interactivity & STT Recognition
// ---------------------------------------------------------------------------
function initChatConsole() {
  renderSuggestionChips();

  chatForm.addEventListener('submit', (e) => {
    e.preventDefault();
    submitUserQuery();
  });

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
        console.error('STT Voice service failure: ', err);
        renderSystemNotification('Speech recognition failed. Please type your query.');
      }
    );
  });
}

/**
 * Processes user queries submitted via forms or suggestion chips.
 *
 * @param {string} [textQuery] - Override text query from chips, if applicable
 */
async function submitUserQuery(textQuery) {
  const query = textQuery || chatInput.value.trim();
  if (!query) return;

  chatInput.value = '';
  addChatBubble(query, 'user');

  const loader = insertTypingIndicator();
  const context = getSimulationState();

  const response = await sendMessageToAI(query, currentRole, currentLang, context);
  loader.remove();

  addChatBubble(response.reply, 'ai');
}

/**
 * Dynamically constructs and injects prompt suggestions chips.
 * EFFICIENCY FIX: Implements DocumentFragment to update DOM in a single redraw.
 */
function renderSuggestionChips() {
  chipsContainer.innerHTML = '';
  const chips = TRANSLATIONS[currentLang].chips[currentRole];
  
  // EFFICIENCY FIX: DocumentFragment container for batch DOM injection
  const fragment = document.createDocumentFragment();

  chips.forEach(c => {
    const btn = document.createElement('button');
    btn.className = 'chip';
    btn.textContent = c;
    btn.addEventListener('click', () => submitUserQuery(c));
    fragment.appendChild(btn);
  });

  chipsContainer.appendChild(fragment);
}

/**
 * Appends a conversation bubble into the AI chat log.
 *
 * @param {string} text - Message text (markdown formatted)
 * @param {string} sender - Message sender identity ('user' | 'ai')
 */
function addChatBubble(text, sender) {
  const bubble = document.createElement('div');
  bubble.className = `chat-bubble ${sender}`;

  const formattedHtml = parseMarkdownToHtml(text);
  bubble.innerHTML = formattedHtml;

  // Text-To-Speech capability button if AI is speaking
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
 * Translates simple markdown markers into standard HTML tags.
 *
 * @param {string} text - Raw input message
 * @returns {string} Formatted HTML representation
 */
function parseMarkdownToHtml(text) {
  let html = text
    .replace(/\r\n/g, '\n')
    .replace(/\n\n/g, '</p><p>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>');

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
 * Renders orange system alert indicators in the console.
 *
 * @param {string} msgText - System message text
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
 * Spawns the bouncing three-dots typing indicator during AI fetches.
 *
 * @returns {HTMLDivElement} Container element representing the loader
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

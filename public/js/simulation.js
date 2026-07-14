/**
 * Live Stadium Simulation Engine
 * Manages wait times, gate status, and operational incident scenarios.
 */

// Initial Simulation State
let state = {
  attendance: 74200,
  capacityLimit: 80000,
  gateA: 20,       // Congestion %
  gateAWait: 5,    // Wait Time in mins
  gateAStatus: 'Normal',
  gateB: 35,
  gateBWait: 10,
  gateBStatus: 'Normal',
  gateC: 15,
  gateCWait: 3,
  gateCStatus: 'Normal',
  gateD: 40,
  gateDWait: 12,
  gateDStatus: 'Normal',
  concessionsFood: 8,   // Wait Time in mins
  concessionsDrink: 4,
  restroomsS1: 'Normal', // Congestion 'Normal' | 'Busy'
  restroomsS2: 'Normal',
  activeIncident: 'None. All systems green.',
  activeIncidentCount: 0,
  greenShuttleUsage: 45 // Percentage (0-100)
};

// Scenario Database
const SCENARIOS = {
  normal: {
    attendance: 74200,
    gateA: 20, gateAWait: 5, gateAStatus: 'Normal',
    gateB: 35, gateBWait: 10, gateBStatus: 'Normal',
    gateC: 15, gateCWait: 3, gateCStatus: 'Normal',
    gateD: 40, gateDWait: 12, gateDStatus: 'Normal',
    concessionsFood: 8, concessionsDrink: 4,
    restroomsS1: 'Normal', restroomsS2: 'Normal',
    activeIncident: 'None. All systems green.',
    activeIncidentCount: 0,
    greenShuttleUsage: 45
  },
  halftime: {
    attendance: 78500,
    gateA: 10, gateAWait: 2, gateAStatus: 'Normal',
    gateB: 15, gateBWait: 3, gateBStatus: 'Normal',
    gateC: 8, gateCWait: 1, gateCStatus: 'Normal',
    gateD: 12, gateDWait: 3, gateDStatus: 'Normal',
    concessionsFood: 25, concessionsDrink: 15,
    restroomsS1: 'Busy', restroomsS2: 'Busy',
    activeIncident: 'Halftime concessions and restroom congestion surge.',
    activeIncidentCount: 1,
    greenShuttleUsage: 48
  },
  gated: {
    attendance: 75800,
    gateA: 25, gateAWait: 6, gateAStatus: 'Normal',
    gateB: 40, gateBWait: 11, gateBStatus: 'Normal',
    gateC: 18, gateCWait: 4, gateCStatus: 'Normal',
    gateD: 95, gateDWait: 45, gateDStatus: 'Critical',
    concessionsFood: 7, concessionsDrink: 3,
    restroomsS1: 'Normal', restroomsS2: 'Normal',
    activeIncident: 'Gate D scanner malfunction causing severe entry bottleneck. Security redirecting fans to Gate C.',
    activeIncidentCount: 1,
    greenShuttleUsage: 44
  },
  incident: {
    attendance: 73900,
    gateA: 30, gateAWait: 8, gateAStatus: 'Normal',
    gateB: 85, gateBWait: 35, gateBStatus: 'Busy',
    gateC: 15, gateCWait: 3, gateCStatus: 'Normal',
    gateD: 20, gateDWait: 5, gateDStatus: 'Normal',
    concessionsFood: 6, concessionsDrink: 3,
    restroomsS1: 'Normal', restroomsS2: 'Busy',
    activeIncident: 'Slip hazard on North-East corridor Sector 102. Area cordoned off; dispatching cleanup crew.',
    activeIncidentCount: 1,
    greenShuttleUsage: 43
  },
  transit: {
    attendance: 74100,
    gateA: 45, gateAWait: 15, gateAStatus: 'Normal',
    gateB: 50, gateBWait: 18, gateBStatus: 'Busy',
    gateC: 40, gateCWait: 12, gateCStatus: 'Normal',
    gateD: 45, gateDWait: 15, gateDStatus: 'Normal',
    concessionsFood: 8, concessionsDrink: 4,
    restroomsS1: 'Normal', restroomsS2: 'Normal',
    activeIncident: 'Metro Transit Grid failure. Expect heavy delays. Operations deploying supplementary EV Shuttles.',
    activeIncidentCount: 1,
    greenShuttleUsage: 22
  }
};

/**
 * Returns copy of the current state of the simulation.
 */
export function getSimulationState() {
  return { ...state };
}

/**
 * Updates the state based on the selected scenario.
 * @param {string} scenarioName - 'normal' | 'halftime' | 'gated' | 'incident' | 'transit'
 * @returns {object} - Updated state
 */
export function setScenario(scenarioName) {
  if (SCENARIOS[scenarioName]) {
    state = { ...state, ...SCENARIOS[scenarioName] };
  }
  return getSimulationState();
}

/**
 * Returns wait time rating (text representation) based on threshold
 * @param {number} waitMins - wait time in minutes
 * @returns {string} - 'low' | 'medium' | 'high'
 */
export function getWaitTimeRating(waitMins) {
  if (waitMins <= 5) return 'low';
  if (waitMins <= 15) return 'medium';
  return 'high';
}

/**
 * Updates green shuttle percentage dynamically based on user pledges.
 * @param {number} deltaPercent - change to apply
 * @returns {object} - Updated state
 */
export function adjustGreenShuttleUsage(deltaPercent) {
  state.greenShuttleUsage = Math.min(100, Math.max(0, state.greenShuttleUsage + deltaPercent));
  return getSimulationState();
}

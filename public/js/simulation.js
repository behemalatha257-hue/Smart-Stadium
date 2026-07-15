/**
 * @module simulation
 * @description Live Stadium Simulation Engine for the FIFA World Cup 2026 venue.
 * Manages live stadium state including attendance, gate congestion, queue wait times,
 * restroom utilization, active incidents, and green transit usage ratios.
 */

/**
 * @typedef {Object} SimulationState
 * @property {number} attendance - Total number of fans currently in the stadium
 * @property {number} capacityLimit - Absolute maximum capacity of the match venue
 * @property {number} gateA - Gate A congestion percentage (0 to 100)
 * @property {number} gateAWait - Gate A wait time in minutes
 * @property {string} gateAStatus - Gate A warning status ('Normal' | 'Busy' | 'Critical')
 * @property {number} gateB - Gate B congestion percentage (0 to 100)
 * @property {number} gateBWait - Gate B wait time in minutes
 * @property {string} gateBStatus - Gate B warning status
 * @property {number} gateC - Gate C congestion percentage (0 to 100)
 * @property {number} gateCWait - Gate C wait time in minutes
 * @property {string} gateCStatus - Gate C warning status
 * @property {number} gateD - Gate D congestion percentage (0 to 100)
 * @property {number} gateDWait - Gate D wait time in minutes
 * @property {string} gateDStatus - Gate D warning status
 * @property {number} concessionsFood - Concessions food queue wait time in minutes
 * @property {number} concessionsDrink - Concessions drink queue wait time in minutes
 * @property {string} restroomsS1 - Restrooms Sector 1 utilization ('Normal' | 'Busy')
 * @property {string} restroomsS2 - Restrooms Sector 2 utilization ('Normal' | 'Busy')
 * @property {string} activeIncident - Explanatory description of any current active issues
 * @property {number} activeIncidentCount - Count of ongoing active warning indicators (0 or 1)
 * @property {number} greenShuttleUsage - Ratio of fans opting for eco-friendly transit (0 to 100)
 */

/**
 * Live simulation state storage. Protected from direct reference leak by copy clones.
 * @type {SimulationState}
 */
let state = {
  attendance: 74200,
  capacityLimit: 80000,
  gateA: 20,
  gateAWait: 5,
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
  concessionsFood: 8,
  concessionsDrink: 4,
  restroomsS1: 'Normal',
  restroomsS2: 'Normal',
  activeIncident: 'None. All systems green.',
  activeIncidentCount: 0,
  greenShuttleUsage: 45
};

/**
 * Scenario Database containing preconfigured matchday events and incidents.
 * @constant {Object<string, Partial<SimulationState>>}
 */
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
 * Returns a cloned copy of the current state of the stadium simulation.
 * Avoids reference leak to protect state isolation.
 *
 * @returns {SimulationState} Deep copy of simulation state
 */
export function getSimulationState() {
  return JSON.parse(JSON.stringify(state));
}

/**
 * Updates the active simulator state based on the selected scenario identifier.
 * Safe against unknown scenario names.
 *
 * @param {string} scenarioName - Predefined key ('normal' | 'halftime' | 'gated' | 'incident' | 'transit')
 * @returns {SimulationState} Copy of the newly updated state
 */
export function setScenario(scenarioName) {
  if (SCENARIOS[scenarioName]) {
    state = { ...state, ...SCENARIOS[scenarioName] };
  }
  return getSimulationState();
}

/**
 * Maps a gate queue wait duration in minutes to a simple rating classification.
 *
 * @param {number} waitMins - Queue time in minutes
 * @returns {string} Rating tag ('low' | 'medium' | 'high')
 */
export function getWaitTimeRating(waitMins) {
  const safeWait = Math.max(0, Number(waitMins) || 0);
  if (safeWait <= 5) return 'low';
  if (safeWait <= 15) return 'medium';
  return 'high';
}

/**
 * Adjusts green transit usage percentage boundaries (0% to 100%) based on fan pledges.
 *
 * @param {number} deltaPercent - Positive or negative shift percentage
 * @returns {SimulationState} Copy of the newly updated state
 */
export function adjustGreenShuttleUsage(deltaPercent) {
  const parsedDelta = Number(deltaPercent) || 0;
  state.greenShuttleUsage = Math.min(100, Math.max(0, state.greenShuttleUsage + parsedDelta));
  return getSimulationState();
}

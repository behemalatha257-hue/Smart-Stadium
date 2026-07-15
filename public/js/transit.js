/**
 * @module transit
 * @description Sustainability & Green Transit Calculator Engine.
 * Formulates CO2 footprint math and tree offset equivalences for diverse transportation modes.
 */

/**
 * Carbon emission factors (in kg CO2 per passenger-kilometer) for various modes of transit.
 * Verified and calibrated for the FIFA World Cup 2026 sustainability standards.
 * @constant {Object<string, number>}
 */
export const EMISSION_FACTORS = {
  'ev-shuttle': 0.00,  // Zero-tailpipe emission electric shuttle
  'metro': 0.02,       // Mass transit rail / electric subway
  'bus': 0.08,         // Standard municipal diesel transit bus
  'gas-car': 0.21,     // Single occupancy gasoline internal combustion vehicle
  'flight': 0.15       // Long haul aviation average per passenger
};

/**
 * Calculates carbon footprint for a commute mode and distance.
 * Gracefully handles unknown transit modes by falling back to gasoline car averages.
 *
 * @param {string} mode - Transit mode key (e.g. 'ev-shuttle', 'gas-car', 'flight')
 * @param {number} distance - Travel distance in kilometers
 * @returns {number} Carbon footprint in kilograms (CO2) rounded to 2 decimal places
 */
export function calculateCarbonFootprint(mode, distance) {
  const factor = EMISSION_FACTORS[mode] !== undefined ? EMISSION_FACTORS[mode] : 0.21;
  const parsedDistance = Math.max(0, Number(distance) || 0);
  return Number((parsedDistance * factor).toFixed(2));
}

/**
 * Converts a carbon footprint (kg CO2) into equivalent absorption by mature trees.
 * Standard assumption is that a mature tree absorbs approximately 22kg of CO2 per year.
 *
 * @param {number} co2Kg - Total CO2 in kilograms
 * @returns {number} Integer representing the number of mature trees required to offset emissions
 */
export function convertToTreeOffset(co2Kg) {
  const safeCo2 = Math.max(0, Number(co2Kg) || 0);
  if (safeCo2 <= 0) return 0;
  // Plant at least 1 tree for any non-zero emission, or round up
  return Math.max(1, Math.ceil(safeCo2 / 22));
}

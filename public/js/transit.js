/**
 * Sustainability & Green Transit Calculator Engine
 * Handles CO2 footprint math and equivalent offsets.
 */

// Carbon emissions factors (in kg CO2 per passenger-kilometer)
export const EMISSION_FACTORS = {
  'ev-shuttle': 0.00,  // Zero-tailpipe shared electric shuttle
  'metro': 0.02,       // Mass transit rail / electric subway
  'bus': 0.08,         // Standard municipal diesel transit bus
  'gas-car': 0.21,     // Single occupancy gasoline internal combustion vehicle
  'flight': 0.15       // Long haul aviation average per passenger
};

/**
 * Calculates carbon footprint for a one-way commute.
 * @param {string} mode - Mode of transit
 * @param {number} distance - Distance in kilometers
 * @returns {number} - CO2 emissions in kg
 */
export function calculateCarbonFootprint(mode, distance) {
  const factor = EMISSION_FACTORS[mode] !== undefined ? EMISSION_FACTORS[mode] : 0.21;
  const parsedDistance = Math.max(0, Number(distance) || 0);
  // Round to 2 decimal places
  return Number((parsedDistance * factor).toFixed(2));
}

/**
 * Converts carbon footprint (kg CO2) into equivalent absorption by mature trees.
 * A mature tree absorbs approximately 22kg of CO2 per year.
 * @param {number} co2Kg - CO2 amount in kilograms
 * @returns {number} - Number of trees needed to offset
 */
export function convertToTreeOffset(co2Kg) {
  if (co2Kg <= 0) return 0;
  // Plant at least 1 tree for any non-zero emission, or round up
  return Math.max(1, Math.ceil(co2Kg / 22));
}

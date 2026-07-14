import assert from 'assert';
import { calculateCarbonFootprint, convertToTreeOffset } from '../public/js/transit.js';

console.log('🧪 Running Sustainability Calculation Tests...');

try {
  // Test Case 1: EV Shuttle (Zero emission check)
  const co2Shuttle = calculateCarbonFootprint('ev-shuttle', 50);
  assert.strictEqual(co2Shuttle, 0.00);
  console.log('✅ Test Case 1 Passed: EV Shuttle zero-emission footprint');

  // Test Case 2: Gas Car (15 km)
  // 15 * 0.21 = 3.15 kg
  const co2Car = calculateCarbonFootprint('gas-car', 15);
  assert.strictEqual(co2Car, 3.15);
  console.log('✅ Test Case 2 Passed: Gasoline car footprint');

  // Test Case 3: Aviation flight (1000 km)
  // 1000 * 0.15 = 150 kg
  const co2Flight = calculateCarbonFootprint('flight', 1000);
  assert.strictEqual(co2Flight, 150.00);
  console.log('✅ Test Case 3 Passed: Aviation footprint');

  // Test Case 4: Tree offset calculation (small emission)
  // 3.15 kg CO2 should require 1 tree planted (since 3.15 <= 22)
  const treesCar = convertToTreeOffset(3.15);
  assert.strictEqual(treesCar, 1);
  console.log('✅ Test Case 4 Passed: Tree offset for small emissions');

  // Test Case 5: Tree offset calculation (large emission)
  // 150 kg CO2 / 22 = 6.81 -> should round up to 7 trees
  const treesFlight = convertToTreeOffset(150.00);
  assert.strictEqual(treesFlight, 7);
  console.log('✅ Test Case 5 Passed: Tree offset for large emissions');

  console.log('🎉 All Sustainability Calculation Tests Passed!\n');
} catch (e) {
  console.error('❌ Sustainability Calculation Tests Failed!');
  console.error(e);
  process.exit(1);
}

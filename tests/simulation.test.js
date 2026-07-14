import assert from 'assert';
import { getWaitTimeRating, setScenario, getSimulationState, adjustGreenShuttleUsage } from '../public/js/simulation.js';

console.log('🧪 Running Stadium Simulation Model Tests...');

try {
  // Test Case 1: Wait time rating mapping
  assert.strictEqual(getWaitTimeRating(3), 'low');
  assert.strictEqual(getWaitTimeRating(10), 'medium');
  assert.strictEqual(getWaitTimeRating(25), 'high');
  console.log('✅ Test Case 1 Passed: getWaitTimeRating classifications');

  // Test Case 2: Scenario state transition (Halftime)
  const halftimeState = setScenario('halftime');
  assert.strictEqual(halftimeState.attendance, 78500);
  assert.strictEqual(halftimeState.concessionsFood, 25);
  assert.strictEqual(halftimeState.restroomsS1, 'Busy');
  console.log('✅ Test Case 2 Passed: setScenario("halftime") transitions');

  // Test Case 3: Scenario state transition (Gate Bottleneck)
  const gatedState = setScenario('gated');
  assert.strictEqual(gatedState.gateD, 95);
  assert.strictEqual(gatedState.gateDWait, 45);
  assert.strictEqual(gatedState.gateDStatus, 'Critical');
  console.log('✅ Test Case 3 Passed: setScenario("gated") transitions');

  // Test Case 4: Green shuttle adjustment limits
  // Active state green transit starts at 44 in Gated scenario.
  adjustGreenShuttleUsage(10);
  assert.strictEqual(getSimulationState().greenShuttleUsage, 54);
  
  // Upper boundary test
  adjustGreenShuttleUsage(60);
  assert.strictEqual(getSimulationState().greenShuttleUsage, 100);

  // Lower boundary test
  adjustGreenShuttleUsage(-120);
  assert.strictEqual(getSimulationState().greenShuttleUsage, 0);
  console.log('✅ Test Case 4 Passed: adjustGreenShuttleUsage boundary limits');

  console.log('🎉 All Stadium Simulation Model Tests Passed!\n');
} catch (e) {
  console.error('❌ Stadium Simulation Model Tests Failed!');
  console.error(e);
  process.exit(1);
}

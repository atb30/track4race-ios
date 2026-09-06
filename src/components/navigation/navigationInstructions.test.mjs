import test from 'node:test';
import assert from 'node:assert/strict';
import { compensateNavigationDistance, formatNavigationDistance, maneuverPhase, roundaboutExitFromBearings, roundaboutExitFromSweep, turnAction } from './navigationInstructions.mjs';

test('left and right actions are never mirrored', () => {
  assert.equal(turnAction({ type: 'normal', direction: 'left' }), 'Gira a la izquierda');
  assert.equal(turnAction({ type: 'normal', direction: 'right' }), 'Gira a la derecha');
});
test('instruction phases are stable around thresholds', () => {
  assert.equal(maneuverPhase(35), 'Ahora'); assert.equal(maneuverPhase(36), 'Prepárate'); assert.equal(maneuverPhase(121), 'En');
});
test('distances use readable navigation rounding', () => {
  assert.deepEqual(formatNavigationDistance(1234), { value: '1.2', unit: 'km' });
  assert.deepEqual(formatNavigationDistance(283), { value: '300', unit: 'm' });
  assert.deepEqual(formatNavigationDistance(82), { value: '80', unit: 'm' });
});

test('roundabout exits follow the approach and departure bearings', () => {
  assert.equal(roundaboutExitFromBearings(0, 90), 1);
  assert.equal(roundaboutExitFromBearings(0, 5), 2);
  assert.equal(roundaboutExitFromBearings(0, 270), 3);
  assert.equal(roundaboutExitFromBearings(0, 180), 4);
  assert.equal(turnAction({ type: 'roundabout', exit: 3 }), 'En la rotonda, toma la 3.ª salida');
});

test('GPS sample delay is compensated without runaway prediction', () => {
  assert.equal(compensateNavigationDistance(1000, 36, 2000), 1020);
  assert.equal(compensateNavigationDistance(1000, 36, 10000), 1040);
  assert.equal(compensateNavigationDistance(1000, 0, 3000), 1000);
});

test('roundabout exit uses the arc travelled when GPX departure heading is sparse', () => {
  assert.equal(roundaboutExitFromSweep(90), 1);
  assert.equal(roundaboutExitFromSweep(129), 1);
  assert.equal(roundaboutExitFromSweep(165), 1);
  assert.equal(roundaboutExitFromSweep(180), 2);
  assert.equal(roundaboutExitFromSweep(270), 3);
  assert.equal(roundaboutExitFromSweep(360), 4);
});

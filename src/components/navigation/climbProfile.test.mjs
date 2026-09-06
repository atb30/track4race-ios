import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildClimbProfiles } from './climbProfile.mjs';

const route = (start, end) => ({ waypoints: [{ distance: start, elevation: 100 }, { distance: end, elevation: 100 + (end - start) * 50 }], climb_segments: [{ start_km: start, end_km: end }] });
test('10 km climb has ten 1 km bins at 5 percent', () => {
  const [c] = buildClimbProfiles(route(3, 13));
  assert.equal(c.step, 1); assert.equal(c.segments.length, 10); assert.equal(c.grade, 5);
  for (const s of c.segments) assert.ok(Math.abs(s.grade - 5) < 1e-8);
});
test('short climb and final partial bin retain correct slope', () => {
  const [c] = buildClimbProfiles(route(18.123, 18.543));
  assert.equal(c.step, .05); assert.equal(c.segments.length, 9);
  for (const s of c.segments) assert.ok(Math.abs(s.grade - 5) < 1e-7);
});
test('interpolates boundaries between GPX samples', () => {
  const r = route(0, 10); r.climb_segments = [{start_km: 1.25, end_km: 4.75}];
  const [c] = buildClimbProfiles(r);
  assert.equal(c.profile[0].elevation, 162.5); assert.equal(c.profile.at(-1).elevation, 337.5);
  assert.equal(c.grade, 5);
});
test('invalid or missing climbs do not produce invented profiles', () => {
  assert.deepEqual(buildClimbProfiles(null), []);
  assert.deepEqual(buildClimbProfiles(route(1, 1)), []);
  const r = route(0, 10); r.climb_segments = [{start_km: -1, end_km: 2}];
  assert.deepEqual(buildClimbProfiles(r), []);
});

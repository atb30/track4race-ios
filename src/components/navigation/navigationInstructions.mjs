export function formatNavigationDistance(meters) {
  const distance = Math.max(0, Number(meters) || 0);
  if (distance >= 1000) return { value: (distance / 1000).toFixed(distance >= 10000 ? 0 : 1), unit: 'km' };
  if (distance >= 200) return { value: String(Math.round(distance / 50) * 50), unit: 'm' };
  if (distance >= 50) return { value: String(Math.round(distance / 10) * 10), unit: 'm' };
  return { value: String(Math.max(10, Math.round(distance / 5) * 5)), unit: 'm' };
}

export function turnAction(turnType) {
  if (turnType?.type === 'roundabout') {
    const exit = Math.max(1, Number(turnType.exit) || 1);
    return `En la rotonda, toma la ${exit}.ª salida`;
  }
  if (turnType?.type === 'straight') return 'Continúa recto';
  const side = turnType?.direction === 'right' ? 'a la derecha' : 'a la izquierda';
  if (turnType?.type === 'slight') return `Mantente ligeramente ${side}`;
  if (turnType?.type === 'sharp') return `Giro cerrado ${side}`;
  return `Gira ${side}`;
}

export function roundaboutExitFromBearings(entryBearing, exitBearing) {
  let change = (Number(exitBearing) || 0) - (Number(entryBearing) || 0);
  while (change > 180) change -= 360;
  while (change < -180) change += 360;
  if (Math.abs(change) >= 135) return 4;
  if (change >= 45) return 1;
  if (change > -45) return 2;
  return 3;
}

export function roundaboutExitFromSweep(sweepDegrees) {
  const sweep = Math.max(0, Number(sweepDegrees) || 0);
  // Sparse GPX points tend to include part of the entry/exit curve in the
  // roundabout arc. Wider boundaries avoid turning a first exit into a second.
  if (sweep < 170) return 1;
  if (sweep < 250) return 2;
  if (sweep < 330) return 3;
  return 4;
}

export function maneuverPhase(distanceMeters) {
  if (distanceMeters <= 35) return 'Ahora';
  if (distanceMeters <= 120) return 'Prepárate';
  return 'En';
}

export function compensateNavigationDistance(trackDistance, speedKmh, sampleAgeMs) {
  const distance = Math.max(0, Number(trackDistance) || 0);
  const speed = Math.min(80, Math.max(0, Number(speedKmh) || 0)) / 3.6;
  const ageSeconds = Math.min(4, Math.max(0, Number(sampleAgeMs) || 0) / 1000);
  return distance + speed * ageSeconds;
}

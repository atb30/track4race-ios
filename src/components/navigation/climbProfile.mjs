const numeric = value => value !== null && value !== '' && Number.isFinite(Number(value));

export function routePositionAt(track, km) {
  const points = track?.waypoints || [];
  if (!points.length || km < Number(points[0].distance) || km > Number(points.at(-1).distance)) return null;
  let lo = 0, hi = points.length - 1;
  while (lo < hi) { const mid = (lo + hi) >> 1; if (Number(points[mid].distance) < km) lo = mid + 1; else hi = mid; }
  const b = points[lo], a = points[Math.max(0, lo - 1)];
  if (![a.lat, a.lng, b.lat, b.lng].every(numeric)) return null;
  const span = Number(b.distance) - Number(a.distance);
  const ratio = span > 0 ? Math.max(0, Math.min(1, (km - Number(a.distance)) / span)) : 0;
  return { lat: Number(a.lat) + (Number(b.lat) - Number(a.lat)) * ratio, lng: Number(a.lng) + (Number(b.lng) - Number(a.lng)) * ratio };
}

// Route distances and climb limits are stored in km; elevations are metres.
export function elevationAt(points, km) {
  if (!points.length || km < points[0].distance || km > points.at(-1).distance) return null;
  let lo = 0, hi = points.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (points[mid].distance < km) lo = mid + 1;
    else hi = mid;
  }
  const right = points[lo];
  if (right.distance === km || lo === 0) return right.elevation;
  const left = points[lo - 1];
  return left.elevation + (right.elevation - left.elevation) * (km - left.distance) / (right.distance - left.distance);
}

export function buildClimbProfiles(track) {
  const points = (Array.isArray(track?.waypoints) ? track.waypoints : [])
    .filter(p => p && numeric(p.distance) && numeric(p.elevation))
    .map(p => ({ distance: Number(p.distance), elevation: Number(p.elevation) }))
    .sort((a, b) => a.distance - b.distance)
    .filter((p, i, all) => !i || p.distance !== all[i - 1].distance);
  if (points.length < 2) return [];
  return (Array.isArray(track?.climb_segments) ? track.climb_segments : []).flatMap((climb, index) => {
    if (!climb || !numeric(climb.start_km) || !numeric(climb.end_km)) return [];
    const start = Number(climb.start_km), end = Number(climb.end_km), length = end - start;
    if (length <= 0) return [];
    const startElevation = elevationAt(points, start), endElevation = elevationAt(points, end);
    if (startElevation === null || endElevation === null) return [];
    const step = [0.05, 0.1, 0.2, 0.25, 0.5, 1, 2, 5, 10, 20, 50].find(s => length / s <= 10 + 1e-8) || Math.ceil(length / 10);
    const segments = [];
    for (let offset = 0; offset < length - 1e-8; offset += step) {
      const finish = Math.min(offset + step, length);
      const grade = (elevationAt(points, Math.min(end, start + finish)) - elevationAt(points, start + offset)) / ((finish - offset) * 1000) * 100;
      segments.push({ from: offset, to: finish, grade });
    }
    // Locate each climb by binary search instead of scanning the whole GPX
    // once per climb. Keep allocations bounded to the chart resolution.
    let low = 0, high = points.length;
    while (low < high) { const mid = (low + high) >> 1; if (points[mid].distance <= start) low = mid + 1; else high = mid; }
    const first = low;
    high = points.length;
    while (low < high) { const mid = (low + high) >> 1; if (points[mid].distance < end) low = mid + 1; else high = mid; }
    const last = low;
    // Keep the chart light for large GPX files; segment grades use full-resolution data.
    const stride = Math.max(1, Math.ceil((last - first) / 500));
    const profile = [{ km: 0, elevation: startElevation }];
    for (let i = first; i < last; i += stride) profile.push({ km: points[i].distance - start, elevation: points[i].elevation });
    profile.push({ km: length, elevation: endElevation });
    return [{ id: `${index}-${start}-${end}`, number: index + 1, start, end, length, step, grade: (endElevation - startElevation) / (length * 1000) * 100, profile, segments }];
  });
}

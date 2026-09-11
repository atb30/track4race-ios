import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Navigation as NavIcon, ArrowUp, ArrowUpRight, ArrowUpLeft, CornerUpRight, CornerUpLeft, Flag } from "lucide-react";
import { compensateNavigationDistance, formatNavigationDistance, maneuverPhase, roundaboutExitFromSweep, turnAction } from './navigationInstructions.mjs';

const calculateBearing = (lat1, lon1, lat2, lon2) => {
  const toRad = (deg) => deg * Math.PI / 180;
  const toDeg = (rad) => rad * 180 / Math.PI;
  const φ1 = toRad(lat1);
  const φ2 = toRad(lat2);
  const λ1 = toRad(lon1);
  const λ2 = toRad(lon2);
  const y = Math.sin(λ2 - λ1) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(λ2 - λ1);
  let brng = toDeg(Math.atan2(y, x));
  return (brng + 360) % 360;
};

const normalizeAngleDiff = (diff) => {
  while (diff > 180) diff -= 360;
  while (diff < -180) diff += 360;
  return diff;
};

const distanceBetween = (lat1, lon1, lat2, lon2) => {
  const toRad = (value) => value * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const getTurnType = (angleDiff) => {
  const abs = Math.abs(angleDiff);
  const direction = angleDiff > 0 ? "right" : "left";
  if (abs < 25) return { type: "straight", direction: null, angle: abs };
  if (abs < 45) return { type: "slight", direction, angle: abs };
  if (abs < 110) return { type: "normal", direction, angle: abs };
  return { type: "sharp", direction, angle: abs };
};

const getTurnIcon = (turnType) => {
  if (turnType.type === "roundabout") return null;
  if (turnType.type === "straight") return ArrowUp;
  if (turnType.type === "slight") return turnType.direction === "right" ? ArrowUpRight : ArrowUpLeft;
  if (turnType.type === "normal") return turnType.direction === "right" ? CornerUpRight : CornerUpLeft;
  if (turnType.type === "sharp") return turnType.direction === "right" ? CornerUpRight : CornerUpLeft;
  return ArrowUp;
};

function RoundaboutIcon({ exit, className = "w-12 h-12" }) {
  const rotation = { 1: 70, 2: 0, 3: -70, 4: 180 }[exit] ?? 0;
  return (
    <div className={`relative ${className}`} aria-label={`Rotonda, ${exit}.ª salida`}>
      <svg viewBox="0 0 64 64" className="w-full h-full" fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M32 57V43" />
        <path d="M32 43a15 15 0 1 1 12-6" />
        <path d="M44 37l8-1-2 8" />
        <path d="M32 21V8" transform={`rotate(${rotation} 32 32)`} />
        <path d="M27 13l5-5 5 5" transform={`rotate(${rotation} 32 32)`} />
      </svg>
      <span className="absolute right-0 top-0 min-w-5 h-5 px-1 rounded-full bg-white text-blue-700 text-xs font-black flex items-center justify-center">{exit}</span>
    </div>
  );
}

const getTurnInstruction = (turnType, distanceMeters, language = 'es') => {
  const distText = distanceMeters < 1000 ? `${Math.round(distanceMeters)} m` : `${(distanceMeters / 1000).toFixed(1)} km`;

  if (turnType.type === "straight") {
    return language === 'en' ? (distanceMeters < 30 ? 'Continue straight' : `Continue straight for ${distText}`) : (distanceMeters < 30 ? "Continúa recto" : `Continúa recto ${distText}`);
  }

  const dirText = turnType.direction === "right" ? "derecha" : "izquierda";
  const action = turnType.type === "slight" ? "Gira ligeramente" : turnType.type === "sharp" ? "Gira bruscamente" : "Gira";

  if (distanceMeters < 30) {
    return `${action} a la ${dirText}`;
  }
  return language === 'en' ? `In ${distText}, ${action.toLowerCase()} ${turnType.direction === 'right' ? 'right' : 'left'}` : `En ${distText}, ${action.toLowerCase()} a la ${dirText}`;
};

export default function TurnByTurnNavigator({ gpxTrack, currentPosition, currentSpeed = 0, isOffTrack, remoteRoute = null, language = 'es' }) {
  const [maneuverIndex, setManeuverIndex] = useState(0);
  const [navigationNow, setNavigationNow] = useState(() => Date.now());
  const closestApproachRef = useRef({ index: -1, distance: Infinity });

  useEffect(() => {
    const timer = window.setInterval(() => setNavigationNow(Date.now()), 500);
    return () => window.clearInterval(timer);
  }, []);

  const livePosition = useMemo(() => {
    if (!currentPosition) return null;
    return {
      ...currentPosition,
      distance: compensateNavigationDistance(
        currentPosition.distance,
        currentSpeed,
        navigationNow - (currentPosition.receivedAt || navigationNow)
      ),
    };
  }, [currentPosition, currentSpeed, navigationNow]);

  const maneuvers = useMemo(() => {
    const remote = remoteRoute?.trip?.legs?.flatMap((leg) => leg.maneuvers || []) || [];
    const isRoundaboutManeuver = (item) => {
      const raw = String(item.type ?? '').toLowerCase();
      // Valhalla exposes roundabout enter/exit as enum values 26/27 in some responses.
      return raw.includes('roundabout') || raw === '26' || raw === '27' || raw === '28';
    };
    if (remote.length) return remote.map((item, index) => ({
      lat: Number(item.lat) || gpxTrack.waypoints[Math.min(item.begin_shape_index || 0, gpxTrack.waypoints.length - 1)].lat,
      lng: Number(item.lon) || gpxTrack.waypoints[Math.min(item.begin_shape_index || 0, gpxTrack.waypoints.length - 1)].lng,
      distance: Number(item.begin_shape_index || index),
      distanceMeters: Number(item.length || 0) * 1000,
      instruction: item.verbal_pre_transition_instruction || item.verbal_post_transition_instruction || item.instruction || 'Continúa por la ruta',
      type: isRoundaboutManeuver(item) ? 'roundabout' : 'normal',
      direction: String(item.type).toLowerCase().includes('right') ? 'right' : String(item.type).toLowerCase().includes('left') ? 'left' : null,
      exit: item.exit_number ?? item.exit ?? item.roundabout_exit_count ?? item.roundabout_exit,
    }));
    if (!gpxTrack?.waypoints || gpxTrack.waypoints.length < 3) return [];
    const waypoints = gpxTrack.waypoints;

    // Sample waypoints at regular intervals to reduce GPS noise
    const sampled = [];
    const SAMPLE_DIST = 50; // meters
    let lastSampleDist = -Infinity;
    for (const wp of waypoints) {
      const distM = (wp.distance || 0) * 1000;
      if (distM - lastSampleDist >= SAMPLE_DIST || sampled.length === 0) {
        sampled.push(wp);
        lastSampleDist = distM;
      }
    }
    if (sampled.length < 3) return [];

    // Calculate bearings between consecutive sampled points
    const bearings = [];
    for (let i = 0; i < sampled.length - 1; i++) {
      bearings.push(calculateBearing(sampled[i].lat, sampled[i].lng, sampled[i + 1].lat, sampled[i + 1].lng));
    }

    // Ignore GPS noise and gentle bends; announce only a meaningful change.
    const MIN_TURN = 32; // degrees
    const MIN_DIST_BETWEEN = 150; // meters
    const result = [];
    let lastManeuverDist = -Infinity;

    for (let i = 1; i < bearings.length; i++) {
      const diff = normalizeAngleDiff(bearings[i] - bearings[i - 1]);
      if (Math.abs(diff) >= MIN_TURN) {
        const wp = sampled[i];
        const distM = (wp.distance || 0) * 1000;
        if (distM - lastManeuverDist < MIN_DIST_BETWEEN) continue;

        const turnType = getTurnType(diff);
        result.push({
          lat: wp.lat,
          lng: wp.lng,
          distance: distM,
          turnType,
          instruction: getTurnInstruction(turnType, distM, language),
          bearingBefore: bearings[i - 1],
          bearingAfter: bearings[i],
        });
        lastManeuverDist = distM;
      }
    }

    // Detect compact, sustained circular curves in either direction. Recorded
    // GPX tracks can be traversed in reverse, so the sign cannot be assumed.
    // Exit number is derived from approach/departure headings.
    const fineSampled = [];
    let lastFineDistance = -Infinity;
    for (const waypoint of waypoints) {
      const distance = (waypoint.distance || 0) * 1000;
      if (distance - lastFineDistance >= 5 || fineSampled.length === 0) {
        fineSampled.push(waypoint);
        lastFineDistance = distance;
      }
    }
    const fineBearings = [];
    for (let index = 0; index < fineSampled.length - 1; index++) {
      fineBearings.push(calculateBearing(fineSampled[index].lat, fineSampled[index].lng, fineSampled[index + 1].lat, fineSampled[index + 1].lng));
    }

    const roundabouts = [];
    for (let start = 1; start < fineBearings.length - 3; start++) {
      const startDistance = (fineSampled[start]?.distance || 0) * 1000;
      let cumulativeLeft = 0;
      let cumulativeRight = 0;
      let leftSegments = 0;
      let rightSegments = 0;
      const leftIndices = [];
      const rightIndices = [];
      let firstCurveDistance = null;
      let lastCurveDistance = null;
      let end = start;
      for (let cursor = start; cursor < Math.min(fineBearings.length, start + 20); cursor++) {
        const cursorDistance = (fineSampled[cursor]?.distance || 0) * 1000;
        if (cursorDistance - startDistance > 200) break;
        const curve = normalizeAngleDiff(fineBearings[cursor] - fineBearings[cursor - 1]);
        const isCurve = Math.abs(curve) > 6;
        if (!isCurve && firstCurveDistance === null && cursorDistance - startDistance > 60) break;
        if (isCurve && lastCurveDistance !== null && cursorDistance - lastCurveDistance > 60) break;
        if (isCurve) {
          if (firstCurveDistance === null) firstCurveDistance = cursorDistance;
          lastCurveDistance = cursorDistance;
        }
        if (curve < -6) { cumulativeLeft += Math.abs(curve); leftSegments += 1; leftIndices.push(cursor); }
        else if (curve > 6) { cumulativeRight += curve; rightSegments += 1; rightIndices.push(cursor); }
        end = cursor;
      }
      const dominantCurve = Math.max(cumulativeLeft, cumulativeRight);
      const secondaryCurve = Math.min(cumulativeLeft, cumulativeRight);
      const dominantSegments = cumulativeLeft >= cumulativeRight ? leftSegments : rightSegments;
      // A roundabout must contain a sustained circular sweep. These stricter
      // thresholds prevent ordinary bends or hairpins being announced as one.
      if (dominantSegments >= 6 && dominantCurve >= 120 && dominantCurve >= secondaryCurve * 2.2 && end > start) {
        const dominantIndices = cumulativeLeft >= cumulativeRight ? leftIndices : rightIndices;
        // The first small deflection is commonly the approach lane rather than
        // the roundabout itself. Confirm entry on the second circular segment.
        const entryIndex = dominantIndices[Math.min(1, dominantIndices.length - 1)];
        const exitIndex = dominantIndices[dominantIndices.length - 1];
        const entryDistance = (fineSampled[entryIndex]?.distance || 0) * 1000;
        const exit = roundaboutExitFromSweep(dominantCurve);
        roundabouts.push({
          lat: fineSampled[entryIndex].lat,
          lng: fineSampled[entryIndex].lng,
          distance: entryDistance,
          roundaboutEndDistance: (fineSampled[exitIndex]?.distance || 0) * 1000,
          turnType: { type: 'roundabout', direction: cumulativeLeft >= cumulativeRight ? 'left' : 'right', exit },
          bearingBefore: fineBearings[Math.max(0, entryIndex - 1)],
          bearingAfter: fineBearings[Math.min(exitIndex + 1, fineBearings.length - 1)],
        });
        start = exitIndex + 1;
      }
    }

    if (roundabouts.length) {
      const withoutInternalTurns = result.filter((maneuver) => !roundabouts.some((roundabout) =>
        maneuver.distance >= roundabout.distance - 30 && maneuver.distance <= roundabout.roundaboutEndDistance + 40
      ));
      return [...withoutInternalTurns, ...roundabouts].sort((a, b) => a.distance - b.distance);
    }

    return result;
  }, [gpxTrack, remoteRoute, language]);

  useEffect(() => {
    const currentDistance = livePosition?.distance || 0;
    const foundIndex = maneuvers.findIndex((maneuver) => maneuver.distance >= currentDistance - 15);
    const initialIndex = foundIndex >= 0 ? foundIndex : maneuvers.length;
    setManeuverIndex(initialIndex);
    closestApproachRef.current = { index: initialIndex, distance: Infinity };
  }, [gpxTrack?.id, maneuvers]);

  useEffect(() => {
    if (!livePosition || !maneuvers.length) return;
    setManeuverIndex((previousIndex) => {
      let index = previousIndex;
      while (index < maneuvers.length) {
        const maneuver = maneuvers[index];
        const pointDistance = distanceBetween(livePosition.lat, livePosition.lng, maneuver.lat, maneuver.lng);
        if (closestApproachRef.current.index !== index) {
          closestApproachRef.current = { index, distance: pointDistance };
        } else {
          closestApproachRef.current.distance = Math.min(closestApproachRef.current.distance, pointDistance);
        }
        const passedByTrack = livePosition.distance > maneuver.distance + 6;
        const passedByPosition = closestApproachRef.current.distance <= 40
          && pointDistance >= closestApproachRef.current.distance + 15
          && livePosition.distance >= maneuver.distance - 70;
        const nextIsCloser = index + 1 < maneuvers.length
          && pointDistance > 60
          && distanceBetween(livePosition.lat, livePosition.lng, maneuvers[index + 1].lat, maneuvers[index + 1].lng) + 25 < pointDistance
          && livePosition.distance >= maneuver.distance - 30;
        if (!passedByTrack && !passedByPosition && !nextIsCloser) break;
        index += 1;
        closestApproachRef.current = { index, distance: Infinity };
      }
      return index;
    });
  }, [livePosition, maneuvers]);

  const nextManeuver = useMemo(() => {
    const maneuver = maneuvers[maneuverIndex];
    if (!maneuver) return null;
    return { ...maneuver, distanceToManeuver: Math.max(0, maneuver.distance - (livePosition?.distance || 0)) };
  }, [maneuvers, maneuverIndex, livePosition]);

  const followingManeuver = useMemo(() => {
    if (!maneuvers.length || !nextManeuver) return null;
    if (maneuverIndex >= 0 && maneuverIndex < maneuvers.length - 1) {
      const next = maneuvers[maneuverIndex + 1];
      return { ...next, distanceToManeuver: Math.max(0, next.distance - (livePosition?.distance || 0)) };
    }
    return null;
  }, [maneuvers, maneuverIndex, nextManeuver, livePosition]);

  const totalDistanceMeters = (gpxTrack?.total_distance || 0) * 1000;
  const currentDistance = livePosition?.distance || 0;
  const distanceToFinish = Math.max(0, totalDistanceMeters - currentDistance);

  if (isOffTrack || !livePosition) {
    return (
      <div className="bg-slate-800 text-white rounded-xl shadow-2xl p-3 flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-slate-600 flex items-center justify-center flex-shrink-0">
          <NavIcon className="w-5 h-5" />
        </div>
        <div>
          <p className="font-semibold text-sm">Esperando GPS...</p>
          <p className="text-xs text-slate-300">
            {isOffTrack ? "Vuelve a la ruta para navegación" : "Buscando tu posición"}
          </p>
        </div>
      </div>
    );
  }

  // If no upcoming maneuvers (near end or route with no turns)
  if (!nextManeuver) {
    return (
      <div className="bg-green-600 text-white rounded-xl shadow-2xl p-3 flex items-center gap-3">
        <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
          <Flag className="w-6 h-6" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-base">Continúa hasta la meta</p>
          <p className="text-sm text-green-100">
            {distanceToFinish < 1000 ? `${Math.round(distanceToFinish)} m` : `${(distanceToFinish / 1000).toFixed(1)} km`} restantes
          </p>
        </div>
      </div>
    );
  }

  const TurnIcon = getTurnIcon(nextManeuver.turnType);
  const phase = maneuverPhase(nextManeuver.distanceToManeuver);
  const distance = formatNavigationDistance(nextManeuver.distanceToManeuver);
  const isNow = phase === 'Ahora';
  const nextGap = followingManeuver ? formatNavigationDistance(followingManeuver.distance - nextManeuver.distance) : null;

  return (
    <div className={`rounded-2xl shadow-2xl overflow-hidden border border-white/20 ${isNow ? "bg-blue-600" : "bg-slate-900"} text-white`} role="status" aria-live="polite">
      <div className="flex items-center gap-4 p-3 sm:p-4">
        {/* Turn icon */}
        <div className={`w-16 h-16 sm:w-20 sm:h-20 rounded-2xl ${isNow ? "bg-white/20" : "bg-blue-600"} flex items-center justify-center flex-shrink-0`}>
          {nextManeuver.turnType.type === 'roundabout'
            ? <RoundaboutIcon exit={nextManeuver.turnType.exit} className="w-12 h-12 sm:w-14 sm:h-14" />
            : <TurnIcon className="w-10 h-10 sm:w-12 sm:h-12" aria-hidden="true" />}
        </div>

        {/* Distance + instruction */}
        <div className="flex-1 min-w-0">
          <p className={`uppercase tracking-wider font-semibold ${isNow ? 'text-white' : 'text-cyan-300'} text-xs sm:text-sm`}>{phase}</p>
          <p className="text-xl sm:text-2xl font-bold leading-tight">{turnAction(nextManeuver.turnType, language)}</p>
          {!isNow && <div className="flex items-baseline gap-1 mt-1"><span className="text-3xl sm:text-4xl font-bold leading-none">{distance.value}</span><span className="text-base font-semibold">{distance.unit}</span></div>}
        </div>
      </div>

      {/* Following maneuver preview */}
      {followingManeuver && (
        <div className="bg-black/25 px-3 sm:px-4 py-2.5 flex items-center gap-2 border-t border-white/10">
          <span className="text-xs text-slate-300">Después, en {nextGap.value} {nextGap.unit}:</span>
          {(() => {
            const NextIcon = getTurnIcon(followingManeuver.turnType);
            return followingManeuver.turnType.type === 'roundabout'
              ? <RoundaboutIcon exit={followingManeuver.turnType.exit} className="w-6 h-6 flex-shrink-0" />
              : <NextIcon className="w-4 h-4 flex-shrink-0" />;
          })()}
          <span className="text-xs sm:text-sm text-white truncate">{turnAction(followingManeuver.turnType, language)}</span>
        </div>
      )}

      {/* Distance to finish */}
      <div className="bg-black/30 px-3 py-1.5 flex items-center justify-between border-t border-white/10">
        <span className="text-xs text-slate-300 flex items-center gap-1">
          <Flag className="w-3 h-3" />
          Meta
        </span>
        <span className="text-xs font-medium">
          {distanceToFinish < 1000 ? `${Math.round(distanceToFinish)} m` : `${(distanceToFinish / 1000).toFixed(1)} km`}
        </span>
      </div>
    </div>
  );
}

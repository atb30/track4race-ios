import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { GpxTrack, Poi, PoiType, LiveLocation, Team } from "@/entities/all"; import { useAuth } from "@/lib/AuthContext";
import { getTraccarData } from "@/functions/getTraccarData";
import { getWeatherData } from "@/functions/getWeatherData";
import { getGoogleMapsApiKey } from "@/functions/getGoogleMapsApiKey";
import { getStreetViewMetadata } from "@/functions/getStreetViewMetadata";
import { MapPin, Mountain, Navigation as NavIcon, Route, ChevronDown, Maximize, Minimize, Milestone, BarChart3, Lock, Users, Settings, Compass, LocateFixed, Layers, Check, ChevronRight, Send, Plus, Minus, ArrowRight, RotateCcw, RotateCw, Wind, ArrowBigUp, X, CloudRain } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel
} from "@/components/ui/dropdown-menu";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import MapView from "../components/navigation/MapView";
import ElevationProfile from "../components/navigation/ElevationProfile";
import ElevationSegmentViewer from "../components/navigation/ElevationSegmentViewer";
import WeatherPanel from "../components/navigation/WeatherPanel";
import MapControlsBar from "../components/navigation/MapControlsBar";
import TurnByTurnNavigator from "../components/navigation/TurnByTurnNavigator";
import { compensateNavigationDistance } from "../components/navigation/navigationInstructions.mjs";
import PoiIcon from "../components/pois/PoiIcon";
import AppLogo from "../components/common/AppLogo";
import LoadingScreen from "../components/common/LoadingScreen";
import NavigationLoadingScreen from "../components/navigation/NavigationLoadingScreen";
import ClimbExplorer from "../components/navigation/ClimbExplorer";
import QuickPoiDialog from "../components/navigation/QuickPoiDialog";
import OrientationWarning from "../components/common/OrientationWarning";
import AdminMenu from "../components/common/AdminMenu";

async function withNavigationTimeout(request) {
  let timer;
  try {
    return await Promise.race([request, new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error('Navigation request timed out')), 20000);
    })]);
  } finally {
    clearTimeout(timer);
  }
}

// Helper functions for geolocation calculations - Moved outside the component to ensure stability and avoid re-creation
const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371e3; // metres
  const φ1 = lat1 * Math.PI/180;
  const φ2 = lat2 * Math.PI/180;
  const Δφ = (lat2-lat1) * Math.PI/180;
  const Δλ = (lon2-lon1) * Math.PI/180;

  const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ/2) * Math.sin(Δλ/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

  return R * c; // in metres
};

// NEW: Helper function to calculate bearing between two points
const calculateBearing = (lat1, lon1, lat2, lon2) => {
  const toRad = (deg) => deg * Math.PI / 180;
  const toDeg = (rad) => rad * 180 / Math.PI;

  const φ1 = toRad(lat1);
  const φ2 = toRad(lat2); // Fix: this should be lat2, not lon2
  const λ1 = toRad(lon1);
  const λ2 = toRad(lon2);

  const y = Math.sin(λ2 - λ1) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) -
            Math.sin(φ1) * Math.cos(φ2) * Math.cos(λ2 - λ1);
  let brng = toDeg(Math.atan2(y, x));
  brng = (brng + 360) % 360; // Normalize to 0-360
  return brng;
};

const normalizeHeadingDifference = (first, second) => {
  let difference = Number(first) - Number(second);
  while (difference > 180) difference -= 360;
  while (difference < -180) difference += 360;
  return difference;
};


// ENHANCED: Improved track position detection for routes with loops/overlaps
const findSmartPositionOnTrack = (gpsLat, gpsLng, waypoints, heading, speed, previousTrackPositions = []) => {
  if (!waypoints || waypoints.length < 2) return null;

  // First, get all potential matches (points within reasonable distance)
  const potentialMatches = [];
  const MAX_REASONABLE_DISTANCE = 200; // meters

  for (let i = 0; i < waypoints.length - 1; i++) {
    const p1 = waypoints[i];
    const p2 = waypoints[i + 1];

    // Project the user's point onto the line segment
    const p1LatRad = p1.lat * Math.PI / 180;
    const p1LngRad = p1.lng * Math.PI / 180;
    const p2LatRad = p2.lat * Math.PI / 180;
    const p2LngRad = p2.lng * Math.PI / 180;
    const gpsLatRad = gpsLat * Math.PI / 180;
    const gpsLngRad = gpsLng * Math.PI / 180;

    const dx = p2LngRad - p1LngRad;
    const dy = p2LatRad - p1LatRad;
    
    const lenSq = dx * dx + dy * dy;
    if (lenSq === 0) continue;

    const t = ((gpsLngRad - p1LngRad) * dx + (gpsLatRad - p1LatRad) * dy) / lenSq;
    const clampedT = Math.max(0, Math.min(1, t));

    const segmentClosestLatRad = p1LatRad + clampedT * dy;
    const segmentClosestLngRad = p1LngRad + clampedT * dx;
    
    const segmentClosestLat = segmentClosestLatRad * 180 / Math.PI;
    const segmentClosestLng = segmentClosestLngRad * 180 / Math.PI;
    
    const dist = calculateDistance(gpsLat, gpsLng, segmentClosestLat, segmentClosestLng);

    // Only consider reasonable matches
    if (dist <= MAX_REASONABLE_DISTANCE) {
      const interpolatedDistanceKm = p1.distance + (p2.distance - p1.distance) * clampedT;
      const interpolatedElevation = p1.elevation + (p2.elevation - p1.elevation) * clampedT;

      // Calculate the bearing of this route segment
      const routeBearing = calculateBearing(p1.lat, p1.lng, p2.lat, p2.lng);

      potentialMatches.push({
        lat: segmentClosestLat,
        lng: segmentClosestLng,
        elevation: interpolatedElevation,
        distance: interpolatedDistanceKm * 1000, // in meters
        distanceFromTrack: dist,
        routeBearing: routeBearing,
        segmentIndex: i,
        t: clampedT
      });
    }
  }

  if (potentialMatches.length === 0) return null;

  // If only one match, return it
  if (potentialMatches.length === 1) {
    return potentialMatches[0];
  }

  // ENHANCED SMART SELECTION FOR LOOPS
  // console.log(`🔄 MULTIPLE OPTIONS: Found ${potentialMatches.length} potential positions`);
  
  // Strategy 1: Use previous position history for logical progression
  if (previousTrackPositions.length > 0) {
    const lastPosition = previousTrackPositions[previousTrackPositions.length - 1];
    const lastDistanceMeters = lastPosition.distance;
    
    // console.log(`   📍 Last known position: Km ${(lastDistanceMeters/1000).toFixed(2)}`);
    
    // ENHANCED: More conservative progression limits for loop detection
    const timeElapsed = Date.now() - lastPosition.timestamp; // milliseconds
    const maxSpeedKmh = Math.max(speed || 0, 50); // Assume max 50 km/h if no speed
    const maxPossibleDistance = (maxSpeedKmh / 3.6) * (timeElapsed / 1000); // meters
    
    // Very conservative limits - prioritize continuity
    const CONSERVATIVE_BACKWARD_METERS = -50; // Allow only 50m backward (GPS noise)
    const CONSERVATIVE_FORWARD_METERS = Math.min(maxPossibleDistance + 100, 1000); // Max 1km forward jump
    
    // console.log(`   🎯 Allowed progression: ${CONSERVATIVE_BACKWARD_METERS}m to ${CONSERVATIVE_FORWARD_METERS.toFixed(0)}m`);
    
    // Filter to only logically valid progressions
    const validProgressionCandidates = potentialMatches.filter(match => {
      const progressMeters = match.distance - lastDistanceMeters;
      const isValidProgress = progressMeters >= CONSERVATIVE_BACKWARD_METERS && progressMeters <= CONSERVATIVE_FORWARD_METERS;
      
      // console.log(`   📊 Km ${(match.distance/1000).toFixed(2)}: progress ${progressMeters.toFixed(0)}m - ${isValidProgress ? 'VALID' : 'INVALID'}`);
      
      return isValidProgress;
    });
    
    if (validProgressionCandidates.length > 0) {
      const expectedProgress = Math.max(0, (Number(speed) || 0) / 3.6 * (timeElapsed / 1000));
      // Prefer the segment that is genuinely closest to the GPS fix. Continuity
      // and heading are tie-breakers, not the primary criterion; otherwise a
      // nearby parallel/curved segment can keep navigation pinned behind us.
      validProgressionCandidates.sort((a, b) => {
        const progressA = a.distance - lastDistanceMeters;
        const progressB = b.distance - lastDistanceMeters;
        const headingPenaltyA = Number.isFinite(heading) ? Math.abs(normalizeHeadingDifference(heading, a.routeBearing)) * 0.12 : 0;
        const headingPenaltyB = Number.isFinite(heading) ? Math.abs(normalizeHeadingDifference(heading, b.routeBearing)) * 0.12 : 0;
        const scoreA = a.distanceFromTrack * 3 + Math.abs(progressA - expectedProgress) * 0.12 + headingPenaltyA + (progressA < -8 ? 35 : 0);
        const scoreB = b.distanceFromTrack * 3 + Math.abs(progressB - expectedProgress) * 0.12 + headingPenaltyB + (progressB < -8 ? 35 : 0);
        return scoreA - scoreB;
      });
      
      const selected = validProgressionCandidates[0];
      // const progressMeters = selected.distance - lastDistanceMeters;
      // console.log(`   ✅ SELECTED: Km ${(selected.distance/1000).toFixed(2)} (progress: ${progressMeters.toFixed(0)}m, logical progression)`);
      
      return selected;
    } else {
      // console.log(`   ⚠️  No valid progression candidates - likely at a loop junction`);
    }
  }
  
  // Strategy 2: If no valid progression or no history, use advanced heuristics
  // console.log(`   🧭 Using advanced heuristics for loop detection`);
  
  // Group candidates by their approximate position on route
  const grouped = {};
  potentialMatches.forEach(match => {
    const kmGroup = Math.floor(match.distance / 100) * 100; // Group by 100m segments
    if (!grouped[kmGroup]) grouped[kmGroup] = [];
    grouped[kmGroup].push(match);
  });
  
  // If we have previous positions, favor the group closest to logical progression
  if (previousTrackPositions.length > 0) {
    const lastDistance = previousTrackPositions[previousTrackPositions.length - 1].distance;
    
    let bestGroup = null;
    let bestGroupScore = Infinity;
    
    Object.keys(grouped).forEach(kmGroup => {
      const avgDistance = grouped[kmGroup].reduce((sum, m) => sum + m.distance, 0) / grouped[kmGroup].length;
      const progressionScore = Math.abs(avgDistance - lastDistance - 200); // Expect ~200m progress
      
      if (progressionScore < bestGroupScore) {
        bestGroupScore = progressionScore;
        bestGroup = kmGroup;
      }
    });
    
    if (bestGroup && grouped[bestGroup].length > 0) {
      const candidates = grouped[bestGroup];
      candidates.sort((a, b) => a.distanceFromTrack - b.distanceFromTrack);
      
      const selected = candidates[0];
      // console.log(`   🎯 ADVANCED SELECTION: Km ${(selected.distance/1000).toFixed(2)} (grouped heuristic)`);
      
      return selected;
    }
  }

  // Strategy 3 (Final Fallback): Closest distance but prefer forward movement
  potentialMatches.sort((a, b) => {
    // Primary: distance from GPS position
    const distDiff = a.distanceFromTrack - b.distanceFromTrack;
    if (Math.abs(distDiff) > 5) {
      return distDiff;
    }
    
    // Secondary: if distances are similar, prefer earlier position on route (less likely to be a wrong loop)
    if (previousTrackPositions.length > 0) {
      const lastDistance = previousTrackPositions[previousTrackPositions.length - 1].distance;
      const progressA = a.distance - lastDistance;
      const progressB = b.distance - lastDistance;
      
      // Prefer forward progress
      if (progressA >= 0 && progressB < 0) return -1;
      if (progressA < 0 && progressB >= 0) return 1;
      
      return Math.abs(progressA) - Math.abs(progressB);
    }
    
    return a.distance - b.distance;
  });
  
  const fallbackSelected = potentialMatches[0];
  // console.log(`   🔄 FALLBACK SELECTED: Km ${(fallbackSelected.distance/1000).toFixed(2)} (closest with forward bias)`);
  
  return fallbackSelected;
};

// NEW: Helper function to get lat/lng for a given distance on the track
const getCoordsAtDistance = (trackWaypoints, targetDistanceKm) => {
  if (!trackWaypoints || trackWaypoints.length < 2) return null;

  // Find the segment that contains the targetDistance
  for (let i = 0; i < trackWaypoints.length - 1; i++) {
    const p1 = trackWaypoints[i];
    const p2 = trackWaypoints[i + 1];

    // Ensure targetDistance is within the segment's bounds, considering potential floating point inaccuracies
    const minSegmentDist = Math.min(p1.distance, p2.distance);
    const maxSegmentDist = Math.max(p1.distance, p2.distance);

    if (targetDistanceKm >= minSegmentDist && targetDistanceKm <= maxSegmentDist) {
      // Interpolate latitude, longitude, and elevation
      const segmentDistance = p2.distance - p1.distance;
      const t = segmentDistance === 0 ? 0 : (targetDistanceKm - p1.distance) / segmentDistance;

      const lat = p1.lat + (p2.lat - p1.lat) * t;
      const lng = p1.lng + (p2.lng - p1.lng) * t;
      const elevation = p1.elevation + (p2.elevation - p1.elevation) * t;

      return { lat, lng, elevation, distance: targetDistanceKm };
    }
  }

  // If targetDistance is beyond the end of the track, return the last point
  const lastPoint = trackWaypoints[trackWaypoints.length - 1];
  if (targetDistanceKm > lastPoint.distance) {
    return { lat: lastPoint.lat, lng: lastPoint.lng, elevation: lastPoint.elevation, distance: lastPoint.distance };
  }
  // If targetDistance is before the start of the track, return the first point
  const firstPoint = trackWaypoints[0]; // FIX: Define firstPoint here
  if (targetDistanceKm < firstPoint.distance) {
    return { lat: firstPoint.lat, lng: firstPoint.lng, elevation: firstPoint.elevation, distance: firstPoint.distance };
  }

  return null; // Should not happen if logic is correct for well-formed tracks
};


// Constants moved outside component - Reduced cache duration for POIs
const STATIC_DATA_CACHE_DURATION = 5 * 60 * 1000; // Reducido de 1 hora a 5 minutos para POIs
const DYNAMIC_DATA_CACHE_DURATION = 5 * 60 * 1000; // 5 minutes for dynamic data (LiveLocation, Runners)
const RUNNER_UPDATE_INTERVAL = 60000; // 1 minute for runners (reduced frequency)
const LOCATION_UPDATE_INTERVAL = 30000; // 30 seconds for location updates (reduced frequency)
const CACHE_KEY_STATIC = 'mirat_static_cache';
const CACHE_KEY_DYNAMIC = 'mirat_dynamic_cache';
const OFF_TRACK_THRESHOLD = 500; // 500 metros
// NEW: Constant for minimum weather fetch interval
const MIN_WEATHER_FETCH_INTERVAL = 10 * 60 * 1000; // Open-Meteo: consulta moderada cada 10 minutos
const LIVE_LOCATION_TIMEOUT = 8000; // REDUCED: 8 second timeout
const LIVE_LOCATION_MAX_FAILURES = 3; // NEW: Max consecutive failures before circuit breaker
// NEW: Master switch to disable LiveLocation
const LIVE_LOCATION_ENABLED = false; // Master switch to disable LiveLocation

const formatDistanceToPoiData = (distanceKm) => {
  // distanceKm debe ser siempre positivo para POIs que están adelante
  const absDistanceKm = Math.abs(distanceKm);

  if (absDistanceKm < 0.05) { // Menos de 50 metros
    return { value: 'Aquí', unit: '' };
  }

  if (absDistanceKm < 1) {
    const distanceM = Math.round(absDistanceKm * 1000);
    return {
      value: `${distanceM}`,
      unit: `m`,
      prefix: 'en ',
      suffix: ''
    };
  } else {
    const distanceKmFormatted = absDistanceKm.toFixed(1);
    return {
      value: `${distanceKmFormatted}`,
      unit: `${distanceKmFormatted.includes('.') ? '' : ''}km`, // Don't add km if already in value
      prefix: 'en ',
      suffix: ''
    };
  }
};

export default function Navigation() {
  const [checkingRoutes, setCheckingRoutes] = useState(true);
  const [routeLoadError, setRouteLoadError] = useState(null);
  const [visibleTrackId, setVisibleTrackId] = useState(null);
  const [mapLoadTimedOut, setMapLoadTimedOut] = useState(false);
  const [activeTrack, setActiveTrack] = useState(null);
  const [currentPosition, setCurrentPosition] = useState(null);
  const [selectedPoint, setSelectedPoint] = useState(null);
  const [pois, setPois] = useState([]);
  const [poiTypes, setPoiTypes] = useState([]);
  const [quickPoiOpen, setQuickPoiOpen] = useState(false);
  const [quickPoiSnapshotKm, setQuickPoiSnapshotKm] = useState(0);
  const [quickPoiSaving, setQuickPoiSaving] = useState(false);
  const [quickPoiError, setQuickPoiError] = useState('');
  const [nearbyPois, setNearbyPois] = useState([]);
  const { user } = useAuth();
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [gpsError, setGpsError] = useState(null);
  const [isOffTrack, setIsOffTrack] = useState(false); // Nuevo estado
  const [showKmMarkers, setShowKmMarkers] = useState(true);
  const [showPois, setShowPois] = useState(true);
  const [showElevationProfile, setShowElevationProfile] = useState(true);
  const [showRunners, setShowRunners] = useState(true);
  const [showRouteArrows, setShowRouteArrows] = useState(false); // New state for route arrows
  const [showTurnByTurn, setShowTurnByTurn] = useState(false); // Turn-by-turn navigation mode
  const [isNativeFullscreen, setIsNativeFullscreen] = useState(false);
  const [currentSpeed, setCurrentSpeed] = useState(0);
  const [previousPositions, setPreviousPositions] = useState([]);
  const [positionUpdateCount, setPositionUpdateCount] = useState(0);
  
  // MODIFIED: Renamed state for clarity
  const [showWindArrowsOnMap, setShowWindArrowsOnMap] = useState(false);
  const [showRainRadar, setShowRainRadar] = useState(false); // NEW: State for rain radar
  const [windData, setWindData] = useState(null);
  const [rainForecast, setRainForecast] = useState(null);
  const [isFetchingWeather, setIsFetchingWeather] = useState(false); // MERGED
  const [weatherError, setWeatherError] = useState(null); // MERGED
  // windUpdateInterval ref is no longer directly used for scheduling, but lastWindFetchTime is used for throttling.
  // const windUpdateInterval = useRef(null);

  const [runners, setRunners] = useState([]);
  const [runnersOnTrack, setRunnersOnTrack] = useState([]); // New state for runners with track data
  const [teams, setTeams] = useState([]);
  const [lastLocationUpdate, setLastLocationUpdate] = useState(null);
  const [mapOrientation, setMapOrientation] = useState('north-up'); // 'north-up', 'heading-up', 'manual'
  const [followMode, setFollowMode] = useState(false); // CHANGED: Start with follow mode disabled
  const [mapType, setMapType] = useState('google'); // 'google', 'satellite', 'hybrid', 'terrain', 'street'
  const [mapInstance, setMapInstance] = useState(null); // New state for map instance
  const [manualRotation, setManualRotation] = useState(0); // New state for manual rotation angle

  // NEW: Track position history for smart detection
  const [trackPositionHistory, setTrackPositionHistory] = useState([]); const previousPositionsRef = useRef([]); const trackPositionHistoryRef = useRef([]); const lastGpsTimeRef = useRef(Date.now());

  // NEW: Mobile orientation states
  const [showOrientationWarning, setShowOrientationWarning] = useState(false);
  const [orientationWarningDismissed, setOrientationWarningDismissed] = useState(false);

  // NEW: State for Street View position
  const [streetViewPosition, setStreetViewPosition] = useState(null);
  const [googleApiKey, setGoogleApiKey] = useState(null);

  // NEW: Pegman drag state and refs
  const [isPegmanDragging, setIsPegmanDragging] = useState(false);
  const [dragTargetPosition, setDragTargetPosition] = useState(null); // NEW: Position for the target focus
  const pegmanRef = useRef(null);
  const dragOffset = useRef({ x: 0, y: 0 });
  const dragClone = useRef(null); // NEW: Reference for the draggable clone
  const streetViewTargetRef = useRef(null);
  const streetViewCheckTimerRef = useRef(null);
  const streetViewRequestRef = useRef(0);

  // NEW: Wake Lock state and ref
  const [wakeLockEnabled, setWakeLockEnabled] = useState(false);
  const wakeLockRef = useRef(null);

  // NEW: State for elevation segment view
  const [elevationSegmentView, setElevationSegmentView] = useState('full'); // 'full', '500m', '1k', '2km', '5km', '10km', '25km', '50km'
  
  // NEW: State for selection mode in elevation profile
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedSegmentRange, setSelectedSegmentRange] = useState(null); // { startKm, endKm }

  // Add refs for cleanup and caching
  const locationUpdateAbortController = useRef(null);
  const lastLoadRunnersCall = useRef(0);
  const liveLocationIdCache = useRef(null); // NEW: Cache the LiveLocation record ID
  const liveLocationFailureCount = useRef(0); // NEW: Track consecutive failures
  const liveLocationCircuitBreakerOpen = useRef(false); // NEW: Circuit breaker

  // Separate caches for static and dynamic data
  const staticCache = useRef({
    data: null,
    timestamp: 0,
    loaded: false
  });
  
  const dynamicCache = useRef({
    data: null,
    timestamp: 0,
    loaded: false
  });

  // NEW: Refs for weather throttling (merged wind and rain)
  const lastWeatherFetchTime = useRef(0);

  // Helper function to identify abort errors
  const isAbortError = useCallback((error) => {
    return error && (
      error.name === 'AbortError' ||
      error.code === 'ABORT_ERR' ||
      (typeof error.message === 'string' && error.message.toLowerCase().includes('abort')) ||
      (typeof error.message === 'string' && error.message.toLowerCase().includes('cancel')) ||
      (typeof error.toString === 'function' && error.toString().toLowerCase().includes('abort'))
    );
  }, []);

  // Function to invalidate static cache (useful when POIs might have changed)
  const invalidateStaticCache = useCallback(() => {
    localStorage.removeItem(CACHE_KEY_STATIC);
    staticCache.current = {
      data: null,
      timestamp: 0,
      loaded: false
    };
    console.log("Static cache invalidated - will reload fresh data");
  }, []);

  // Function to load static cached data from localStorage
  const loadStaticCachedData = useCallback(() => {
    try {
      const cached = localStorage.getItem(CACHE_KEY_STATIC);
      if (cached) {
        const parsedCache = JSON.parse(cached);
        
        if (parsedCache.data && parsedCache.timestamp) {
          // Check if cache is still valid (now only 5 minutes for POIs)
          const now = Date.now();
          if ((now - parsedCache.timestamp) < STATIC_DATA_CACHE_DURATION) {
            console.log("Loading static cached data from localStorage");
            staticCache.current = parsedCache;
            
            const cachedData = parsedCache.data;
            setActiveTrack(cachedData.activeTrack || null);
            setPois(cachedData.pois || []);
            setPoiTypes(cachedData.poiTypes || []);
            setTeams(cachedData.teams || []);
            return true;
          } else {
            console.log("Static cache expired, will load fresh data");
            invalidateStaticCache();
          }
        }
      }
    } catch (error) {
      console.warn("Error loading static cached data:", error);
    }
    return false;
  }, [invalidateStaticCache]);

  // Function to save static data to localStorage
  const saveStaticCachedData = useCallback((data) => {
    try {
      const cacheData = {
        data,
        timestamp: Date.now(),
        loaded: true
      };
      localStorage.setItem(CACHE_KEY_STATIC, JSON.stringify(cacheData));
      staticCache.current = cacheData;
      // console.log("Static data cached for 5 minutes");
    } catch (error) {
      console.warn("Error saving static data to localStorage:", error);
    }
  }, []);

  // Function to load dynamic cached data
  const loadDynamicCachedData = useCallback(() => {
    try {
      const cached = localStorage.getItem(CACHE_KEY_DYNAMIC);
      if (cached) {
        const parsedCache = JSON.parse(cached);
        
        if (parsedCache.data && parsedCache.timestamp) {
          const now = Date.now();
          if ((now - parsedCache.timestamp) < DYNAMIC_DATA_CACHE_DURATION) {
            console.log("Loading dynamic cached data from localStorage");
            dynamicCache.current = parsedCache;
            // setRunners(parsedCache.data.runners || []); // This line is commented out as runners are now fetched live from Traccar
            return true;
          }
        }
      }
    } catch (error) {
      console.warn("Error loading dynamic cached data:", error);
    }
    return false;
  }, []);

  // Function to save dynamic data
  const saveDynamicCachedData = useCallback((data) => {
    try {
      const cacheData = {
        data,
        timestamp: Date.now(),
        loaded: true
      };
      localStorage.setItem(CACHE_KEY_DYNAMIC, JSON.stringify(cacheData));
      dynamicCache.current = cacheData;
      // console.log("Dynamic data cached for 5 minutes");
    } catch (error) {
      console.warn("Error saving dynamic data to localStorage:", error);
    }
  }, []);
  
  const loadStaticData = useCallback(async ({ force = false } = {}) => {
    const now = Date.now();
    
    // Check if static cached data is still valid (now only 5 minutes)
    if (!force && staticCache.current.loaded && 
        (now - staticCache.current.timestamp) < STATIC_DATA_CACHE_DURATION && 
        staticCache.current.data) {
      
      console.log("Using static cached data (valid for 5 minutes)");
      const cached = staticCache.current.data;
      setActiveTrack(cached.activeTrack);
      setPois(cached.pois || []);
      setPoiTypes(cached.poiTypes || []);
      setTeams(cached.teams || []);
      return;
    }

    try {
      console.log("Loading fresh static data from API");
      const [allTracks, poisData, poiTypesData, teamsData] = await withNavigationTimeout(Promise.all([
        GpxTrack.list(),
        Poi.list().catch(err => {
          console.warn("Error loading POIs:", err.message);
          return [];
        }),
        PoiType.list().catch(err => {
          console.warn("Error loading POI types:", err.message);
          return [];
        }),
        Team.list().catch(err => {
          console.warn("Error loading teams:", err.message);
          return [];
        })
      ]));

      const activeTracks = allTracks.filter(t => t.is_active === true || t.is_active === 'true');
      const activeTrackSummary = activeTracks.find(t => user?.role === 'admin' || !t.allowed_user_emails?.length || t.allowed_user_emails.includes(user?.email)) || activeTracks[0] || null;
      const activeTrackData = activeTrackSummary
        ? await withNavigationTimeout(GpxTrack.get(activeTrackSummary.id))
        : null;
      
      console.log("Loaded tracks:", allTracks.length, "Active tracks:", activeTracks.length);
      
      setActiveTrack(activeTrackData);
      setPois(poisData);
      setPoiTypes(poiTypesData);
      setTeams(teamsData);

      const freshData = { activeTrack: activeTrackData, allTracks, pois: poisData, poiTypes: poiTypesData, teams: teamsData };
      
      saveStaticCachedData(freshData);
      
    } catch (error) {
      console.error("Error loading static data:", error);
      setRouteLoadError('No hemos podido comprobar las rutas. Revisa tu conexión y vuelve a intentarlo.');
      
      // Enhanced rate limit handling for static data
      if (error.response?.status === 429 || error.message?.includes('429')) {
        console.warn("Rate limit exceeded for static data. Using any available cached data.");
        
        // Use cached data even if it's older than normal cache duration
        if (staticCache.current.loaded && staticCache.current.data) {
          console.log("Using stale static cached data due to rate limit");
          const cached = staticCache.current.data;
          setActiveTrack(cached.activeTrack);
          setPois(cached.pois || []);
          setPoiTypes(cached.poiTypes || []);
          setTeams(cached.teams || []);
        } else if (loadStaticCachedData()) {
          console.log("Loaded fallback static data from localStorage due to rate limit");
        } else {
          console.warn("No static cached data available and rate limit exceeded");
          setActiveTrack(null);
          setPois([]);
          setPoiTypes([]);
          setTeams([]);
        }
        return;
      }
    }
  }, [loadStaticCachedData, saveStaticCachedData, user]);

  const checkAuthAndLoadData = useCallback(async () => {
    if (!user) return;
    setCheckingRoutes(true);
    setRouteLoadError(null);
    try {
      // Load static cached data first to show something immediately
      if (!staticCache.current.loaded) {
        loadStaticCachedData();
      }
      
      // Then try to load fresh static data
      await loadStaticData({ force: true });
    } catch (error) {
      console.error("Data load error:", error);
      setRouteLoadError('No hemos podido comprobar las rutas. Vuelve a intentarlo.');
    } finally {
      setCheckingRoutes(false);
    }
  }, [loadStaticData, loadStaticCachedData, user]);

  // MODIFIED: Disabled LiveLocation - now just a no-op
  const updateLiveLocation = useCallback(async (position, distanceOnRoute, speed) => {
    // LiveLocation is disabled to prevent database timeouts
    if (!LIVE_LOCATION_ENABLED) {
      return;
    }

    if (!user || !activeTrack) return;

    // Circuit breaker: if we've had too many failures, stop trying for a while
    if (liveLocationCircuitBreakerOpen.current) {
      // Reset circuit breaker after 5 minutes of being open, or if lastLocationUpdate is very old/null
      const now = Date.now();
      if (!lastLocationUpdate || (now - lastLocationUpdate) > 5 * 60 * 1000) { // Using 5 min as a reset period
        console.log('🔄 LiveLocation circuit breaker reset, will retry');
        liveLocationCircuitBreakerOpen.current = false;
        liveLocationFailureCount.current = 0;
      } else {
        return; // Skip silently if circuit breaker is open and hasn't timed out yet
      }
    }

    const now = Date.now();
    
    // Throttle location updates to once every 30 seconds
    if (lastLocationUpdate && (now - lastLocationUpdate) < LOCATION_UPDATE_INTERVAL) {
      return;
    }

    try {
      // Cancel any pending location update
      if (locationUpdateAbortController.current) {
        try {
          locationUpdateAbortController.current.abort();
        } catch (e) {
          // Ignore errors if controller is already aborted or invalid
          console.warn("Error aborting previous LiveLocation request:", e);
        }
      }

      // Create new abort controller for this request
      locationUpdateAbortController.current = new AbortController();
      const { signal } = locationUpdateAbortController.current;

      const timeoutId = setTimeout(() => {
        try {
          locationUpdateAbortController.current?.abort();
        } catch (e) {
          // Ignore errors if already aborted or invalid
        }
      }, LIVE_LOCATION_TIMEOUT); // Use the new, shorter timeout

      const locationData = {
        user_name: user.full_name || user.email,
        latitude: position.lat,
        longitude: position.lng,
        elevation: position.elevation || 0,
        speed: speed || 0,
        distance_on_route: distanceOnRoute,
        gpx_track_id: activeTrack.id,
        last_update: new Date().toISOString()
      };

      try {
        // If we have a cached ID, try to update directly (fastest path)
        if (liveLocationIdCache.current) {
          try {
            await LiveLocation.update(liveLocationIdCache.current, locationData, { signal });
            clearTimeout(timeoutId);
            setLastLocationUpdate(now);
            liveLocationFailureCount.current = 0; // Reset failure count on SUCCESS
            return; // Exit early if successful
          } catch (updateError) {
            if (isAbortError(updateError)) {
              // This was a timeout/abort, not a hard failure. Adjust count.
              liveLocationFailureCount.current = Math.max(0, liveLocationFailureCount.current - 0.5);
              clearTimeout(timeoutId);
              return;
            }
            // If update fails (e.g., 404, server error), the record might have been deleted, clear cache and try filter
            console.warn('Cached LiveLocation ID invalid or update failed, will search for record:', updateError.message);
            liveLocationIdCache.current = null;
          }
        }

        // If no cached ID or previous update failed, search for existing record or create new
        const existingLocations = await LiveLocation.filter(
          { created_by: { eq: user.email } },
          { signal }
        );

        if (existingLocations && existingLocations.length > 0) {
          liveLocationIdCache.current = existingLocations[0].id;
          await LiveLocation.update(existingLocations[0].id, locationData, { signal });
        } else {
          const newRecord = await LiveLocation.create(locationData, { signal });
          liveLocationIdCache.current = newRecord?.id;
        }

        clearTimeout(timeoutId);
        setLastLocationUpdate(now);
        liveLocationFailureCount.current = 0;

      } catch (entityError) {
        clearTimeout(timeoutId);

        liveLocationFailureCount.current++;
        
        if (isAbortError(entityError)) {
          liveLocationFailureCount.current = Math.max(0, liveLocationFailureCount.current - 0.5);
          return;
        }
        
        if (liveLocationFailureCount.current >= LIVE_LOCATION_MAX_FAILURES) {
          console.warn(`⚡ LiveLocation circuit breaker opened after ${LIVE_LOCATION_MAX_FAILURES} failures. Disabling updates temporarily.`);
          liveLocationCircuitBreakerOpen.current = true;
        } else {
          const errorType = entityError.message?.includes('Network') ? 'Network' :
                           entityError.message?.includes('timeout') ? 'Timeout' :
                           entityError.response?.status === 429 ? 'RateLimit' : 'Unknown';
          console.warn(`LiveLocation ${errorType} error (failure ${liveLocationFailureCount.current}/${LIVE_LOCATION_MAX_FAILURES}). Message: ${entityError.message}`);
        }
      }
    } catch (error) {
      if (!isAbortError(error)) {
        liveLocationFailureCount.current++;
        if (liveLocationFailureCount.current >= LIVE_LOCATION_MAX_FAILURES) {
          console.warn(`⚡ LiveLocation circuit breaker opened (outer catch) after ${LIVE_LOCATION_MAX_FAILURES} failures. Disabling updates temporarily.`);
          liveLocationCircuitBreakerOpen.current = true;
        }
        console.warn('Error in updateLiveLocation (outer catch):', error.message);
      }
    }
  }, [user, activeTrack, lastLocationUpdate, isAbortError]);

  // MODIFIED: loadRunners now fetches from Traccar and filters by team access
  const loadRunners = useCallback(async () => {
    if (!user) return;

    const now = Date.now();
    if (now - lastLoadRunnersCall.current < RUNNER_UPDATE_INTERVAL) {
      return;
    }
    lastLoadRunnersCall.current = now;

    try {
      const [teamsData, traccarResponse] = await Promise.all([
        Team.list(),
        getTraccarData()
      ]);

      setTeams(teamsData);

      if (traccarResponse.error || traccarResponse.data?.error) {
        console.warn("Traccar connection issue:", traccarResponse.error || traccarResponse.data?.error);
        setRunners([]);
        return;
      }
      
      let allTraccarRunners = traccarResponse.data?.data || [];

      if (user.role !== 'admin') {
        const accessibleTeams = teamsData.filter(team => 
          team.allowed_user_emails && team.allowed_user_emails.includes(user.email)
        );
        const accessibleTeamIds = new Set(accessibleTeams.map(t => t.id));
        
        const filteredRunners = allTraccarRunners.filter(runner => 
          accessibleTeamIds.has(runner.team_id)
        );
        
        setRunners(filteredRunners);
      } else {
        setRunners(allTraccarRunners);
      }
      
    } catch (error) {
      if (error.message?.includes('429')) {
        console.warn("Rate limit reached for runners, skipping update.");
      } else {
        console.warn("Error loading runners from Traccar:", error.message);
      }
      setRunners([]);
    }
  }, [user]);

  // MODIFIED: Weather data (Wind & Rain) is now fetched together
  const fetchWeatherData = useCallback(async () => {
    const now = Date.now();
    // Throttle requests: only one request every MIN_WEATHER_FETCH_INTERVAL
    if (now - lastWeatherFetchTime.current < MIN_WEATHER_FETCH_INTERVAL) {
      return;
    }

    // Only fetch if we have current position, an active track, and a valid speed (or no speed to predict from)
    if (!currentPosition || !activeTrack?.waypoints) {
      return; 
    }

    setIsFetchingWeather(true);
    setWeatherError(null);
    lastWeatherFetchTime.current = now;

    try {
      // 1. Predict future position (30 minutes ahead)
      // currentPosition.distance is in METERS
      // currentSpeed is in KM/H
      const speedKmh = currentSpeed || 0; // Use 0 if speed is null/undefined to predict current spot
      
      // Distance to travel in the next 30 minutes (0.5 hours), in METERS
      const distanceToTravelMeters = (speedKmh * 1000) * 0.5;
      const predictedDistanceOnRoute = currentPosition.distance + distanceToTravelMeters; // in METERS

      // 2. Find coordinates for that future position
      const waypoints = activeTrack.waypoints;
      let predictedLat = currentPosition.lat; // Default to current position
      let predictedLng = currentPosition.lng;

      // Find the waypoint segment where the predicted distance falls
      let targetWaypoint = waypoints.find(wp => wp.distance * 1000 >= predictedDistanceOnRoute);
      
      if (targetWaypoint) {
        predictedLat = targetWaypoint.lat;
        predictedLng = targetWaypoint.lng;
      } else {
        // If prediction is beyond the end of the route, use the last waypoint
        const lastWp = waypoints[waypoints.length - 1];
        if (lastWp) {
          predictedLat = lastWp.lat;
          predictedLng = lastWp.lng;
        }
      }

      // 3. Call the backend function with predicted coordinates
      const response = await getWeatherData({
        latitude: predictedLat,
        longitude: predictedLng,
      });

      if (response.data?.success && response.data?.data) {
        const { wind, rain } = response.data.data;
        if (wind && typeof wind.speedKmh === 'number' && typeof wind.direction === 'number') {
          setWindData(wind);
        } else {
          setWindData(null);
        }
        if (rain && typeof rain.probability === 'number' && typeof rain.intensity === 'string') {
          setRainForecast(rain);
        } else {
          setRainForecast(null);
        }
        setWeatherError(null);
      } else {
        const errorMsg = response.data?.error || "No disponible.";
        setWeatherError(errorMsg);
        setWindData(null);
        setRainForecast(null);
      }
    } catch (error) {
      if (error.response?.status === 429) {
        setWeatherError("Límite alcanzado");
        lastWeatherFetchTime.current = now; // Reset to allow retry after interval
      } else {
        setWeatherError("Error de conexión");
      }
      setWindData(null);
      setRainForecast(null);
    } finally {
      setIsFetchingWeather(false);
    }
  }, [currentPosition, activeTrack, currentSpeed]);

  // Inicializar geolocalización
  const initializeGeolocation = useCallback(() => {
    if (!navigator.geolocation) {
      setGpsError("Geolocalización no disponible en este dispositivo");
      return;
    }

    // Mejorado: Calcular velocidad promediando múltiples muestras para suavizar
    const calculateSmoothSpeed = (newPosition, prevPositions) => {
      if (prevPositions.length < 3) return 0;
      
      // Usar las últimas 5 posiciones para calcular velocidad promedio
      const recentPositions = prevPositions.slice(-5);
      const speeds = [];
      
      for (let i = 1; i < recentPositions.length; i++) {
        const current = recentPositions[i];
        const previous = recentPositions[i - 1];
        const timeDiff = (current.timestamp - previous.timestamp) / 1000;
        
        if (timeDiff > 0 && timeDiff < 10) { // Evitar cálculos con tiempos muy largos o muy cortos
          const distance = calculateDistance(
            previous.lat, previous.lng,
            current.lat, current.lng
          );
          const speedMs = distance / timeDiff;
          const speedKmh = speedMs * 3.6;
          
          // Solo incluir velocidades realistas (< 80 km/h para ciclismo)
          if (speedKmh >= 0 && speedKmh <= 80) {
            speeds.push(speedKmh);
          }
        }
      }
      
      // Calcular velocidad con la nueva posición y la última de las previas
      const lastRelevantPos = recentPositions[recentPositions.length - 1]; // Last of the 5
      const timeDiffFromLastRelevant = (newPosition.timestamp - lastRelevantPos.timestamp) / 1000;
      
      if (timeDiffFromLastRelevant > 0 && timeDiffFromLastRelevant < 10) {
        const distance = calculateDistance(
          lastRelevantPos.lat, lastRelevantPos.lng,
          newPosition.lat, newPosition.lng
        );
        const speedMs = distance / timeDiffFromLastRelevant;
        const speedKmh = speedMs * 3.6;
        
        if (speedKmh >= 0 && speedKmh <= 80) {
          speeds.push(speedKmh);
        }
      }
      
      if (speeds.length === 0) return 0;
      
      // Promedio ponderado dando más peso a las velocidades más recientes
      let weightedSum = 0;
      let totalWeight = 0;
      
      speeds.forEach((speed, index) => {
        const weight = index + 1; // Las más recientes tienen más peso
        weightedSum += speed * weight;
        totalWeight += weight;
      });
      
      const averageSpeed = weightedSum / totalWeight;
      return averageSpeed < 1 ? 0 : averageSpeed; // Redondear a 0 si es muy lento
    };

    const options = { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 };

    const handleSuccess = (position) => {
      const { latitude, longitude, altitude, speed, heading } = position.coords;
      const timestamp = position.timestamp;
      
      const newPosition = {
        lat: latitude,
        lng: longitude,
        elevation: altitude || 0, // Initial elevation from GPS
        timestamp: timestamp,
        heading: heading,
      };
      
      let calculatedSpeed = 0;
      if (speed !== null && speed >= 0 && speed <= 22) { 
        calculatedSpeed = speed * 3.6; // Convert m/s to km/h
      } else {
        calculatedSpeed = calculateSmoothSpeed(newPosition, previousPositionsRef.current);
      }
      setCurrentSpeed(Math.max(0, calculatedSpeed));
      const updatedPrevPositions = [...previousPositionsRef.current, newPosition].slice(-8);
      previousPositionsRef.current = updatedPrevPositions;
      setPreviousPositions(updatedPrevPositions);
      
      let finalPosition = null;
      let distanceForLiveUpdate = 0; // Distance to send to LiveLocation
      let offTrackStatus = true; // Default to off-track

      if (activeTrack?.waypoints) {
        // Use the smart position detection
        const smartPosition = findSmartPositionOnTrack(
          latitude, 
          longitude, 
          activeTrack.waypoints, 
          heading, 
          calculatedSpeed,
          trackPositionHistoryRef.current
        );
        
        if (smartPosition && smartPosition.distanceFromTrack < OFF_TRACK_THRESHOLD) {
          // USER IS ON TRACK
          offTrackStatus = false;
          let deviceElevation = altitude !== null && altitude !== undefined ? altitude : smartPosition.elevation;
          
          const previousTrackDistance = trackPositionHistoryRef.current[trackPositionHistoryRef.current.length - 1]?.distance;
          const stableTrackDistance = Number.isFinite(previousTrackDistance)
            ? Math.max(smartPosition.distance, previousTrackDistance - 3)
            : smartPosition.distance;
          const navigationDistance = compensateNavigationDistance(
            stableTrackDistance,
            calculatedSpeed,
            Math.max(0, Date.now() - timestamp)
          );

          finalPosition = {
            lat: latitude,
            lng: longitude,
            elevation: deviceElevation,
            distance: navigationDistance, // Current distance with bounded GPS-latency compensation
            distanceFromTrack: smartPosition.distanceFromTrack,
            heading: heading,
            receivedAt: Date.now(),
          };
          distanceForLiveUpdate = smartPosition.distance;

          // Update position history for future smart detection
          const newTrackHistory = [...trackPositionHistoryRef.current, {
            distance: smartPosition.distance,
            timestamp: timestamp,
            lat: latitude,
            lng: longitude
          }].slice(-5);
          trackPositionHistoryRef.current = newTrackHistory;
          setTrackPositionHistory(newTrackHistory);

        } else {
          // USER IS OFF TRACK (but active track exists)
          offTrackStatus = true;
          finalPosition = {
            lat: latitude,
            lng: longitude,
            elevation: altitude || 0, // Use GPS altitude, track elevation not relevant
            distance: 0, // Reset distance to 0 when off-track
            distanceFromTrack: smartPosition ? smartPosition.distanceFromTrack : null, // Use null instead of Infinity
            heading: heading,
          };
          distanceForLiveUpdate = 0; // Send 0 distance when off-track
          
          // Clear history when off track
          trackPositionHistoryRef.current = []; setTrackPositionHistory([]);
        }
      } else {
        // NO ACTIVE TRACK - User is effectively off-track
        offTrackStatus = true;
        finalPosition = {
          lat: latitude,
          lng: longitude,
          elevation: altitude || 0,
          distance: 0, // Always 0 if no active track
          distanceFromTrack: null, // Use null instead of Infinity
          heading: heading,
        };
        distanceForLiveUpdate = 0; // Send 0 distance
        trackPositionHistoryRef.current = []; setTrackPositionHistory([]);
      }

      setCurrentPosition(finalPosition);
      setIsOffTrack(offTrackStatus);
      setPositionUpdateCount(prev => prev + 1); lastGpsTimeRef.current = Date.now();
      setGpsError(null);

      // MODIFIED: Only call updateLiveLocation if enabled (it won't do anything anyway)
      if (LIVE_LOCATION_ENABLED) {
        updateLiveLocation(finalPosition, distanceForLiveUpdate, calculatedSpeed).catch(err => {
          console.warn('LiveLocation update failed silently:', err.message);
        });
      }
    };

    const handleError = (error) => {
      if (error.code === error.TIMEOUT) return; // Keep last position on timeout
      let msg = error.code === error.PERMISSION_DENIED ? "Permiso de geolocalización denegado"
        : error.code === error.POSITION_UNAVAILABLE ? "Posición GPS no disponible"
        : `Error desconocido (${error.code})`;
      setGpsError(msg);
      setCurrentSpeed(0); setIsOffTrack(true); setCurrentPosition(null);
      trackPositionHistoryRef.current = []; setTrackPositionHistory([]);
    };

    let watchId = navigator.geolocation.watchPosition(handleSuccess, handleError, options);
    const watchdog = setInterval(() => {
      if (Date.now() - lastGpsTimeRef.current > 45000) {
        navigator.geolocation.clearWatch(watchId);
        watchId = navigator.geolocation.watchPosition(handleSuccess, handleError, options);
        lastGpsTimeRef.current = Date.now();
      }
    }, 20000);
    return () => { navigator.geolocation.clearWatch(watchId); clearInterval(watchdog); };
  }, [activeTrack, updateLiveLocation]);

  // NEW: Function to calculate elevation segments based on selected distance
  const calculateElevationSegments = useCallback(() => {
    // This function now only handles predefined views (500m, 1km, etc.)
    // and the 'full' view. 'selection' view is handled by calculateSelectedRangeSegments.
    if (!activeTrack?.waypoints || elevationSegmentView === 'full' || elevationSegmentView === 'selection') {
      return null;
    }

    // Define segment sizes based on total view distance
    const viewConfig = {
      '500m': { totalDistance: 500, segmentSize: 50 },
      '1k': { totalDistance: 1000, segmentSize: 100 },
      '2km': { totalDistance: 2000, segmentSize: 200 },
      '5km': { totalDistance: 5000, segmentSize: 500 },
      '10km': { totalDistance: 10000, segmentSize: 1000 },
      '25km': { totalDistance: 25000, segmentSize: 2500 },
      '50km': { totalDistance: 50000, segmentSize: 5000 }
    };

    const config = viewConfig[elevationSegmentView];
    if (!config) {
      return null;
    }

    let currentDistanceMeters;
    
    // Determine reference point for segments
    if (isOffTrack || !currentPosition || currentPosition.distance === 0) {
      // If off-track or no position, show from END of route backwards
      const totalRouteDistanceMeters = activeTrack.total_distance * 1000;
      currentDistanceMeters = totalRouteDistanceMeters;
    } else if (trackPositionHistory.length > 0) {
      // Use last known position on track
      currentDistanceMeters = trackPositionHistory[trackPositionHistory.length - 1].distance;
    } else {
      // Use current position
      currentDistanceMeters = currentPosition.distance;
    }

    const startTrackDistanceMeters = Math.max(0, currentDistanceMeters - config.totalDistance);
    const endTrackDistanceMeters = currentDistanceMeters;

    // Helper to get grade color
    const getGradeColor = (grade) => {
      if (grade >= 8) return '#dc2626';
      if (grade >= 5) return '#f59e0b';
      if (grade >= 3) return '#eab308';
      if (grade >= 1) return '#84cc16';
      if (grade > -1 && grade < 1) return '#10b981';
      if (grade >= -3) return '#60a5fa';
      if (grade >= -5) return '#3b82f6';
      return '#2563eb';
    };

    // Create fixed-size segments
    const segments = [];
    const numSegments = Math.ceil(config.totalDistance / config.segmentSize);

    for (let i = 0; i < numSegments; i++) {
      const segmentStartMeters = startTrackDistanceMeters + (i * config.segmentSize);
      const segmentEndMeters = Math.min(segmentStartMeters + config.segmentSize, endTrackDistanceMeters);
      
      if (segmentEndMeters <= segmentStartMeters) continue;

      // Find waypoints in this segment
      const segmentWaypoints = activeTrack.waypoints.filter(wp => {
        const wpDistanceMeters = wp.distance * 1000;
        return wpDistanceMeters >= segmentStartMeters && wpDistanceMeters <= segmentEndMeters;
      });

      if (segmentWaypoints.length < 2) {
        continue;
      }

      // Calculate average grade for this segment
      const startElevation = segmentWaypoints[0].elevation;
      const endElevation = segmentWaypoints[segmentWaypoints.length - 1].elevation;
      const elevationChange = endElevation - startElevation;
      const segmentDistance = segmentEndMeters - segmentStartMeters;
      const averageGrade = segmentDistance > 0 ? (elevationChange / segmentDistance) * 100 : 0;

      segments.push({
        startKm: segmentStartMeters / 1000,
        endKm: segmentEndMeters / 1000,
        startElevation: startElevation,
        endElevation: endElevation,
        elevationGain: elevationChange,
        distance: segmentDistance,
        grade: averageGrade,
        color: getGradeColor(averageGrade),
        segmentNumber: i + 1
      });
    }

    return segments;

  }, [activeTrack, currentPosition, isOffTrack, elevationSegmentView, trackPositionHistory]);

  const elevationSegments = useMemo(() => calculateElevationSegments(), [calculateElevationSegments]);

  // NEW: Calculate segments for selected range
  const calculateSelectedRangeSegments = useCallback(() => {
    if (!selectedSegmentRange || !activeTrack?.waypoints) {
      return null;
    }

    const { startKm, endKm } = selectedSegmentRange;
    const startMeters = startKm * 1000;
    const endMeters = endKm * 1000;
    const totalRangeMeters = endMeters - startMeters;

    // Determine segment size based on range
    let segmentSize = 100;
    if (totalRangeMeters > 10000) segmentSize = 1000;
    else if (totalRangeMeters > 5000) segmentSize = 500;
    else if (totalRangeMeters > 2000) segmentSize = 200;
    else if (totalRangeMeters > 1000) segmentSize = 100;
    else if (totalRangeMeters > 500) segmentSize = 50;
    else segmentSize = 25;

    const getGradeColor = (grade) => {
      if (grade >= 8) return '#dc2626';
      if (grade >= 5) return '#f59e0b';
      if (grade >= 3) return '#eab308';
      if (grade >= 1) return '#84cc16';
      if (grade > -1 && grade < 1) return '#10b981';
      if (grade >= -3) return '#60a5fa';
      if (grade >= -5) return '#3b82f6';
      return '#2563eb';
    };

    const segments = [];
    const numSegments = Math.ceil(totalRangeMeters / segmentSize);

    for (let i = 0; i < numSegments; i++) {
      const segmentStartMeters = startMeters + (i * segmentSize);
      const segmentEndMeters = Math.min(segmentStartMeters + segmentSize, endMeters);
      
      if (segmentEndMeters <= segmentStartMeters) continue;

      const segmentWaypoints = activeTrack.waypoints.filter(wp => {
        const wpDistanceMeters = wp.distance * 1000;
        return wpDistanceMeters >= segmentStartMeters && wpDistanceMeters <= segmentEndMeters;
      });

      if (segmentWaypoints.length < 2) continue;

      const startElevation = segmentWaypoints[0].elevation;
      const endElevation = segmentWaypoints[segmentWaypoints.length - 1].elevation;
      const elevationChange = endElevation - startElevation;
      const segmentDistance = segmentEndMeters - segmentStartMeters;
      const averageGrade = (elevationChange / segmentDistance) * 100;

      segments.push({
        startKm: segmentStartMeters / 1000,
        endKm: segmentEndMeters / 1000,
        startElevation: startElevation,
        endElevation: endElevation,
        elevationGain: elevationChange,
        distance: segmentDistance,
        grade: averageGrade,
        color: getGradeColor(averageGrade),
        segmentNumber: i + 1
      });
    }

    return segments;
  }, [selectedSegmentRange, activeTrack]);

  const selectedRangeSegments = useMemo(() => calculateSelectedRangeSegments(), [calculateSelectedRangeSegments]);

  // Handler for segment selection from elevation profile
  const handleSegmentSelection = useCallback((startKm, endKm) => {
    console.log(`📍 Segment selected: ${startKm.toFixed(2)}km to ${endKm.toFixed(2)}km`);
    setSelectedSegmentRange({ startKm, endKm });
    setElevationSegmentView('selection'); // Special view for selection
  }, []);

  // Clear selection when exiting selection mode
  useEffect(() => {
    if (!selectionMode) {
      setSelectedSegmentRange(null);
      if (elevationSegmentView === 'selection') {
        setElevationSegmentView('full');
      }
    }
  }, [selectionMode, elevationSegmentView]);

  // Función para entrar en pantalla completa nativa con compatibilidad Safari
  const enterNativeFullscreen = async () => {
    try {
      const elem = document.documentElement;
      
      if (elem.requestFullscreen) {
        await elem.requestFullscreen();
      } else if (elem.webkitRequestFullscreen) {
        // Safari
        await elem.webkitRequestFullscreen();
      } else if (elem.mozRequestFullScreen) {
        // Firefox
        await elem.mozRequestFullScreen();
      } else if (elem.msRequestFullscreen) {
        // IE/Edge
        await elem.msRequestFullscreen();
      }
      setIsNativeFullscreen(true);
    } catch (error) {
      console.log("Error al entrar en pantalla completa:", error);
    }
  };

  // Función para salir de pantalla completa nativa con compatibilidad Safari
  const exitNativeFullscreen = async () => {
    try {
      if (document.exitFullscreen) {
        await document.exitFullscreen();
      } else if (document.webkitExitFullscreen) {
        // Safari
        await document.webkitExitFullscreen();
      } else if (document.mozCancelFullScreen) {
        // Firefox
        await document.mozCancelFullScreen();
      } else if (document.msExitFullscreen) {
        // IE/Edge
        await document.msRequestFullscreen(); // Fixed: Changed 'elem' to 'document'
      }
      setIsNativeFullscreen(false);
    } catch (error) {
      console.log("Error al salir de pantalla completa:", error);
    }
  };

  // Detectar cambios en el estado de pantalla completa con compatibilidad Safari
  useEffect(() => {
    const handleFullscreenChange = () => {
      const isCurrentlyFullscreen = 
        document.fullscreenElement || 
        document.webkitFullscreenElement || 
        document.mozFullScreenElement || 
        document.msFullscreenElement;
      
      setIsNativeFullscreen(!!isCurrentlyFullscreen);
      if (!isCurrentlyFullscreen && isFullscreen) {
        setIsFullscreen(false);
      }
    };

    // Agregar listeners para todos los navegadores
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);
    document.addEventListener('MSFullscreenChange', handleFullscreenChange);
    
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
      document.removeEventListener('MSFullscreenChange', handleFullscreenChange);
    };
  }, [isFullscreen]);

  // Función para detectar si el dispositivo soporta pantalla completa
  const supportsFullscreen = () => {
    const elem = document.documentElement;
    return !!(
      elem.requestFullscreen ||
      elem.webkitRequestFullscreen ||
      elem.mozRequestFullScreen ||
      elem.msRequestFullscreen
    );
  };

  // Función para manejar el toggle de pantalla completa
  const handleFullscreenToggle = async () => {
    // Detectar si estamos en móvil/tablet y en orientación horizontal
    const isMobile = window.innerWidth <= 1024; // Common breakpoint for tablets, adjust as needed
    const isLandscape = window.innerWidth > window.innerHeight;
    
    if (!isFullscreen) {
      setIsFullscreen(true);
      // Solo usar pantalla completa nativa si el navegador la soporta y estamos en horizontal
      if (isMobile && isLandscape && supportsFullscreen()) {
        await enterNativeFullscreen();
      }
    } else {
      setIsFullscreen(false);
      // Si estamos en pantalla completa nativa, salir
      if (isNativeFullscreen && supportsFullscreen()) {
        await exitNativeFullscreen();
      }
    }
  };

  // Toggle map orientation function
  const toggleMapOrientation = useCallback(() => {
    setMapOrientation(prev => prev === 'north-up' ? 'heading-up' : 'north-up');
    setManualRotation(0); // Reset manual rotation when changing orientation mode
  }, []);

  // Manual rotation functions
  const rotateMapLeft = useCallback(() => {
    setManualRotation(prev => prev - 15); // Rotate 15 degrees counter-clockwise
    setMapOrientation('manual'); // Switch to manual mode
  }, []);

  const rotateMapRight = useCallback(() => {
    setManualRotation(prev => prev + 15); // Rotate 15 degrees clockwise  
    setMapOrientation('manual'); // Switch to manual mode
  }, []);

  const resetMapRotation = useCallback(() => {
    setManualRotation(0);
    setMapOrientation('north-up');
  }, []);

  // Calculate final rotation angle
  const getFinalRotation = useCallback(() => {
    if (mapOrientation === 'manual') {
      return manualRotation;
    } else if (mapOrientation === 'heading-up' && currentPosition?.heading !== null && currentPosition?.heading !== undefined) {
      return -currentPosition.heading; // Negative because we want heading to point up
    }
    return 0; // north-up
  }, [mapOrientation, manualRotation, currentPosition?.heading]);

  // Remove the getScaleFactor function as it's no longer needed

  // Map zoom functions
  const handleZoomIn = () => {
    if (mapInstance) {
      mapInstance.zoomIn();
    } else {
      // console.log("Map instance not available for zoom in");
    }
  };

  const handleZoomOut = () => {
    if (mapInstance) {
      mapInstance.zoomOut();
    } else {
      // console.log("Map instance not available for zoom out");
    }
  };

  const handleMapReady = (map) => {
    // console.log("Map ready callback received");
    setMapInstance(map);
  };

  // El foco siempre se ajusta a un punto real del trazado, nunca a una posición libre del mapa.
  const getClosestTrackPoint = (latlng) => {
    const waypoints = activeTrack?.waypoints || [];
    if (!waypoints.length) return null;

    let closest = null;
    let minDistance = Infinity;
    for (const waypoint of waypoints) {
      const distance = calculateDistanceMeters(latlng.lat, latlng.lng, waypoint.lat, waypoint.lng);
      if (distance < minDistance) {
        minDistance = distance;
        closest = waypoint;
      }
    }
    // Evita que el muñeco se adhiera al trazado desde una zona lejana.
    return minDistance <= 300 ? { ...closest, distance: minDistance } : null;
  };

  const clearStreetViewTarget = () => {
    window.clearTimeout(streetViewCheckTimerRef.current);
    streetViewRequestRef.current += 1;
    streetViewTargetRef.current = null;
    setDragTargetPosition(null);
  };

  const checkStreetViewAtTrackPoint = (point, screenPosition) => {
    window.clearTimeout(streetViewCheckTimerRef.current);
    const requestId = ++streetViewRequestRef.current;
    const target = { ...screenPosition, lat: point.lat, lng: point.lng, coverage: 'checking' };
    streetViewTargetRef.current = target;
    setDragTargetPosition(target);

    // Al mover el ratón se reciben muchos eventos: esperamos un instante antes de consultar Google.
    streetViewCheckTimerRef.current = window.setTimeout(async () => {
      try {
        const result = await getStreetViewMetadata({ latitude: point.lat, longitude: point.lng });
        if (requestId !== streetViewRequestRef.current) return;
        const next = {
          ...target,
          coverage: result.available ? 'available' : 'unavailable',
          panoId: result.panoId,
          panoramaLocation: result.location,
          status: result.status,
        };
        streetViewTargetRef.current = next;
        setDragTargetPosition(next);
      } catch (error) {
        if (requestId !== streetViewRequestRef.current) return;
        const next = { ...target, coverage: 'unavailable', status: 'ERROR' };
        streetViewTargetRef.current = next;
        setDragTargetPosition(next);
      }
    }, 250);
  };

  const handlePegmanDrop = async () => {
    let target = streetViewTargetRef.current;
    if (!target) return;

    // El usuario puede soltar el muñeco antes de que termine la comprobación visual.
    // En ese caso resolvemos la misma comprobación al soltar, en vez de ignorar el gesto.
    if (target.coverage === 'checking') {
      try {
        const result = await getStreetViewMetadata({ latitude: target.lat, longitude: target.lng });
        target = {
          ...target,
          coverage: result.available ? 'available' : 'unavailable',
          panoId: result.panoId,
          panoramaLocation: result.location,
          status: result.status,
        };
      } catch {
        return;
      }
    }

    if (target.coverage !== 'available') return;
    const location = target.panoramaLocation || { lat: target.lat, lng: target.lng };
    setStreetViewPosition({ lat: location.lat, lng: location.lng, panoId: target.panoId });
  };

  const handleDragMove = (e) => {
    e.preventDefault();
    const clientX = e.clientX;
    const clientY = e.clientY;
    
    // Move the dragged clone (muñeco)
    if (dragClone.current) {
      dragClone.current.style.left = `${clientX - dragOffset.current.x}px`;
      dragClone.current.style.top = `${clientY - dragOffset.current.y}px`;
    }
    
    // El foco se fija sobre el punto más próximo del trazado y se valida contra Google.
    const mapContainer = document.querySelector('.leaflet-container');
    if (mapContainer && mapInstance) {
      const mapRect = mapContainer.getBoundingClientRect();
      
      // El punto de destino es exactamente el que queda bajo el cursor o el dedo.
      // Antes se desplazaba hacia arriba y, a este zoom, dejaba de coincidir con la ruta.
      const offsetY = 0;
      const focusClientX = clientX;
      const focusClientY = clientY + offsetY;
      
      const mapX = focusClientX - mapRect.left;
      const mapY = focusClientY - mapRect.top;
      
      // Show target if the focus point is within map bounds
      if (mapX >= 0 && mapX <= mapRect.width && mapY >= 0 && mapY <= mapRect.height) {
        const closestPoint = getClosestTrackPoint(mapInstance.containerPointToLatLng([mapX, mapY]));
        if (!closestPoint) {
          clearStreetViewTarget();
          return;
        }
        const pointOnMap = mapInstance.latLngToContainerPoint([closestPoint.lat, closestPoint.lng]);
        const screenPosition = {
          x: mapRect.left + pointOnMap.x,
          y: mapRect.top + pointOnMap.y,
          pointerY: clientY,
        };
        const current = streetViewTargetRef.current;
        if (!current || calculateDistanceMeters(current.lat, current.lng, closestPoint.lat, closestPoint.lng) > 8) {
          checkStreetViewAtTrackPoint(closestPoint, screenPosition);
        } else {
          const movedTarget = { ...current, ...screenPosition };
          streetViewTargetRef.current = movedTarget;
          setDragTargetPosition(movedTarget);
        }
      } else {
        clearStreetViewTarget();
      }
    }
  };

  const handleDragEnd = (e) => {
    const clientX = e.clientX;
    const clientY = e.clientY;
    
    void handlePegmanDrop();
    
    // Clean up
    setIsPegmanDragging(false);
    clearStreetViewTarget();
    
    if (dragClone.current) {
      document.body.removeChild(dragClone.current);
      dragClone.current = null;
    }
    
    // Restore original pegman
    if (pegmanRef.current) {
      pegmanRef.current.style.opacity = '0.9';
      pegmanRef.current.style.transform = 'scale(1)';
      pegmanRef.current.style.visibility = 'visible';
    }

    window.removeEventListener('pointermove', handleDragMove);
    window.removeEventListener('pointerup', handleDragEnd);
    window.removeEventListener('pointercancel', handleDragEnd);
  };

  const handleDragStart = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.button !== undefined && e.button !== 0) return;
    setIsPegmanDragging(true);

    const clientX = e.clientX;
    const clientY = e.clientY;
    const rect = pegmanRef.current.getBoundingClientRect();
    e.currentTarget?.setPointerCapture?.(e.pointerId);
    
    dragOffset.current = {
      x: clientX - rect.left - rect.width / 2, // Offset from center
      y: clientY - rect.top - rect.height / 2, // Offset from center
    };

    // Hide original pegman
    if (pegmanRef.current) {
      pegmanRef.current.style.visibility = 'hidden';
    }
    
    // Create draggable clone
    dragClone.current = pegmanRef.current.cloneNode(true);
    dragClone.current.style.position = 'fixed';
    dragClone.current.style.zIndex = '9999';
    dragClone.current.style.pointerEvents = 'none'; // So it doesn't interfere with map events
    dragClone.current.style.transform = 'scale(1.1)';
    dragClone.current.style.opacity = '0.8';
    dragClone.current.style.left = `${clientX - dragOffset.current.x}px`;
    dragClone.current.style.top = `${clientY - dragOffset.current.y}px`;
    document.body.appendChild(dragClone.current);
    
    window.addEventListener('pointermove', handleDragMove, { passive: false });
    window.addEventListener('pointerup', handleDragEnd);
    window.addEventListener('pointercancel', handleDragEnd);
  };

  // NEW: Wake Lock functions
  const enableWakeLock = useCallback(async () => {
    if ('wakeLock' in navigator) {
      try {
        wakeLockRef.current = await navigator.wakeLock.request('screen');
        setWakeLockEnabled(true);
        console.log('✅ Wake Lock activado - pantalla permanecerá encendida');
        
        wakeLockRef.current.addEventListener('release', () => {
          console.log('⚠️ Wake Lock liberado');
          setWakeLockEnabled(false);
        });
        
      } catch (err) {
        console.warn('❌ Error activando Wake Lock:', err);
        setWakeLockEnabled(false);
      }
    } else {
      console.warn('⚠️ Wake Lock API no disponible en este navegador');
    }
  }, []);

  const disableWakeLock = useCallback(async () => {
    if (wakeLockRef.current) {
      try {
        await wakeLockRef.current.release();
        wakeLockRef.current = null;
        setWakeLockEnabled(false);
        console.log('✅ Wake Lock desactivado');
      } catch (err) {
        console.warn('❌ Error desactivando Wake Lock:', err);
      }
    }
  }, []);

  // Load cached data immediately on component mount
  useEffect(() => {
    // Load cached data immediately before any API calls
    loadStaticCachedData();
    loadDynamicCachedData();
  }, [loadStaticCachedData, loadDynamicCachedData]);

  useEffect(() => {
    checkAuthAndLoadData();
  }, [checkAuthAndLoadData]);

  // Fetch Google Maps API Key
  useEffect(() => {
    const fetchKey = async () => {
      try {
        const response = await getGoogleMapsApiKey();
        if (response.data?.success !== false && response.data?.apiKey) {
          setGoogleApiKey(response.data.apiKey);
        } else if (response.apiKey) {
          setGoogleApiKey(response.apiKey); // Direct access if nested differently
        } else {
          console.warn("No API key found in response:", response);
        }
      } catch (error) {
        console.error("Error fetching Google Maps API key:", error);
      }
    };
    fetchKey();
  }, []);

  // Inicializar geolocalización cuando se carga el track activo
  useEffect(() => {
    if (activeTrack) {
      const cleanup = initializeGeolocation();
      return cleanup;
    }
  }, [activeTrack, initializeGeolocation]);

  useEffect(() => {
    if (activeTrack && currentPosition && typeof currentPosition.distance === 'number') {
      const currentDistanceMeters = currentPosition.distance;
      
      const upcomingPois = pois
        .filter((poi) => 
          poi.gpx_track_id === activeTrack.id || 
          !poi.gpx_track_id
        )
        .map((poi) => {
          // poi.distance_from_start is in METERS
          const remainingDistanceMeters = poi.distance_from_start - currentDistanceMeters;
          
          return {
            ...poi,
            remainingDistanceKm: remainingDistanceMeters / 1000,
            remainingDistanceMeters: remainingDistanceMeters
          };
        })
        .filter((poi) => poi.remainingDistanceMeters > -50) // Show POIs that are just behind or ahead
        .sort((a, b) => a.remainingDistanceMeters - b.remainingDistanceMeters)
        .slice(0, 10);

      setNearbyPois(upcomingPois);
    } else {
      setNearbyPois([]);
    }
  }, [activeTrack, currentPosition, pois, positionUpdateCount]);

  // New useEffect to calculate runner positions on the track
  useEffect(() => {
    if (activeTrack?.waypoints && runners.length > 0 && activeTrack.total_distance) {
      // console.log("Calculating runner positions on track...");
      
      const runnersWithTrackData = runners
        .map(runner => {
          if (runner.latitude && runner.longitude) {
            // For runners, we assume no complex loops issue, so a simple closest point is fine
            // We use findSmartPositionOnTrack for consistency, passing empty history for no complex logic
            const closestPoint = findSmartPositionOnTrack(runner.latitude, runner.longitude, activeTrack.waypoints, runner.course, runner.speed, []);
            if (closestPoint && closestPoint.distanceFromTrack < OFF_TRACK_THRESHOLD) { // Consider on track if within 500m
              // Elevation from runner's GPS is preferred if available, otherwise use interpolated track elevation
              const elevationOnTrack = runner.altitude !== null && runner.altitude !== undefined ? runner.altitude : closestPoint.elevation;
              const totalDistanceMeters = activeTrack.total_distance * 1000; // Convert total distance from KM to meters
              const distanceToFinish = totalDistanceMeters - closestPoint.distance;
              
              // console.log(`Runner ${runner.device_name}:`, {
              //   distanceKm: (closestPoint.distance / 1000).toFixed(2),
              //   distanceFromTrack: closestPoint.distanceFromTrack.toFixed(1)
              // });
              
              return {
                ...runner,
                distanceOnTrack: closestPoint.distance, // distance in meters from start of track
                elevationOnTrack: elevationOnTrack,
                distanceToFinish: distanceToFinish, // distance in meters to finish
              };
            }
          }
          return null;
        })
        .filter(Boolean) // Remove runners that couldn't be placed on the track
        .sort((a,b) => a.distanceToFinish - b.distanceToFinish); // Sort by closest to finish

      const uniqueRunners = Array.from(new Map(runnersWithTrackData.map(item => [item.id, item])).values());
      // console.log(`Found ${uniqueRunners.length} runners on track`);
      setRunnersOnTrack(uniqueRunners);
    } else {
      setRunnersOnTrack([]);
    }
  }, [runners, activeTrack]);


  // MODIFIED: loadRunners with longer interval and better conditions
  useEffect(() => {
    if (user) {
      loadRunners(); // Load immediately on user auth
      const interval = setInterval(loadRunners, RUNNER_UPDATE_INTERVAL);
      return () => clearInterval(interval);
    }
  }, [user, loadRunners]);

  // MODIFIED: Weather data (Wind & Rain) is now fetched together
  useEffect(() => {
    fetchWeatherData();
    
    // Periodic fetch to ensure data is fresh even if user is stopped
    const interval = setInterval(fetchWeatherData, MIN_WEATHER_FETCH_INTERVAL);

    return () => clearInterval(interval);
  }, [fetchWeatherData, currentPosition, activeTrack, currentSpeed]);


  // MODIFIED: Remove LiveLocation cleanup since it's disabled
  useEffect(() => {
    // No 'beforeunload' listener for LiveLocation cleanup if it's disabled.
    // The previous code block handling 'beforeunload' is removed as per instructions.

    // This part always runs to clean up any potential pending fetch requests initiated by updateLiveLocation,
    // even if LiveLocation itself is disabled (as the function might still be called, but return early).
    const locationController = locationUpdateAbortController.current;
    return () => {
      if (locationController) { // Use the captured controller
        try {
          locationController.abort();
        } catch (e) {
          // Ignore errors if already aborted or invalid
          console.warn("Error aborting LiveLocation request during unmount:", e);
        }
      }
    };
  }, []);

  // Add a manual refresh mechanism - check if we're coming back from management pages
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        // When the page becomes visible again, check if we should refresh data
        console.log("Page became visible - checking if data refresh is needed");
        
        // Force reload of fresh data when returning to navigation
        staticCache.current = {
          data: null,
          timestamp: 0,
          loaded: false
        };
        loadStaticData();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [loadStaticData]);

  // NEW: Check for mobile orientation on mount and orientation change
  useEffect(() => {
    const checkOrientation = () => {
      const isMobile = window.innerWidth <= 768; // Mobile breakpoint
      const isPortrait = window.innerHeight > window.innerWidth;
      
      if (isMobile && isPortrait && !orientationWarningDismissed) {
        setShowOrientationWarning(true);
      } else {
        setShowOrientationWarning(false);
      }
    };

    // Check on mount
    checkOrientation();
    
    // Check on orientation change
    window.addEventListener('orientationchange', () => {
      // Delay to let the orientation change complete
      setTimeout(checkOrientation, 100);
    });
    
    // Also check on resize (for when users rotate without orientation event)
    window.addEventListener('resize', checkOrientation);
    
    return () => {
      window.removeEventListener('orientationchange', checkOrientation);
      window.removeEventListener('resize', checkOrientation);
    };
  }, [orientationWarningDismissed]);

  // NEW: Auto-enable wake lock when GPS is active and disable when not
  useEffect(() => {
    if (currentPosition && activeTrack) {
      // GPS is active and we have a track - enable wake lock
      if (!wakeLockEnabled) {
        enableWakeLock();
      }
    } else {
      // No GPS or no track - disable wake lock to save battery
      if (wakeLockEnabled) {
        disableWakeLock();
      }
    }
  }, [currentPosition, activeTrack, wakeLockEnabled, enableWakeLock, disableWakeLock]);

  // NEW: Re-enable wake lock when page becomes visible (handles cases where it might be released)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && currentPosition && activeTrack && !wakeLockEnabled) {
        // Page became visible and we should have wake lock active
        setTimeout(() => {
          enableWakeLock();
        }, 1000); // Small delay to ensure page is fully loaded
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [currentPosition, activeTrack, wakeLockEnabled, enableWakeLock]);

  // NEW: Cleanup wake lock on component unmount
  useEffect(() => {
    return () => {
      if (wakeLockRef.current) {
        wakeLockRef.current.release().catch(console.warn);
      }
    };
  }, []);

  const handleElevationPointClick = (point) => {
    setSelectedPoint(point);
  };

  const getPoiType = useCallback((poiTypeId) => {
    return poiTypes.find((t) => t.id === poiTypeId);
  }, [poiTypes]);

  // NEW: Function to handle POI click from elevation profile
  const handlePoiClickFromProfile = useCallback((poi) => {
    if (poi && poi.latitude && poi.longitude) {
      // Center map on POI location
      if (mapInstance) {
        // Retain current zoom if greater than 16, otherwise set to 16 for better detail
        mapInstance.setView([poi.latitude, poi.longitude], Math.max(mapInstance.getZoom(), 16));
        
        // Temporarily disable follow mode to allow focusing on POI
        setFollowMode(false);
        
        // Optional: highlight the POI for a moment (we can add this later if needed)
        console.log(`Navegando a POI: ${poi.name} en Km ${(poi.distance_from_start / 1000).toFixed(1)}`);
      }
    }
  }, [mapInstance]);

  useEffect(() => {
    if (checkingRoutes || !activeTrack || visibleTrackId === activeTrack.id) return;
    setMapLoadTimedOut(false);
    const timer = setTimeout(() => setMapLoadTimedOut(true), 25000);
    return () => clearTimeout(timer);
  }, [checkingRoutes, activeTrack?.id, visibleTrackId]);

  if (!user || checkingRoutes) return <NavigationLoadingScreen />;
  if (routeLoadError) return <NavigationLoadingScreen error={routeLoadError} onRetry={checkAuthAndLoadData} />;

  // Verificar si el user tiene acceso a la ruta activa (si existe)
  const hasActiveRouteAccess = activeTrack && (
    user.role === 'admin' || activeTrack.created_by_id === user.id ||
    !activeTrack.allowed_user_emails?.length ||
    activeTrack.allowed_user_emails.includes(user.email)
  );

  // Si hay ruta activa pero el user no tiene acceso
  if (activeTrack && user.role !== 'admin' && !hasActiveRouteAccess) {
    return (
      <div className="h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto px-6">
          <div className="mb-8">
            <AppLogo className="w-20 h-20" showText={false} />
            <h2 className="text-xl font-semibold text-slate-800 mt-4 mb-2">Track4Race</h2>
          </div>
          <Lock className="w-16 h-16 mx-auto mb-6 text-slate-400" />
          <h3 className="text-xl font-semibold text-slate-800 mb-3">
            Sin acceso a la ruta activa
          </h3>
          <p className="text-slate-500 mb-6 text-sm">
            No tienes acceso a la ruta que está actualmente activa. Contacta con el administrador para obtener permisos.
          </p>
          <div className="flex gap-3 justify-center">
            <Link to={createPageUrl("Routes")}>
              <Button variant="outline" className="border-slate-300 hover:bg-slate-100 text-slate-700">
                <Route className="w-4 h-4 mr-2" />
                Ver Biblioteca
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!activeTrack) return <NavigationLoadingScreen stage="empty" />;
  if (!activeTrack.waypoints?.length) return <NavigationLoadingScreen error="La ruta activa no contiene un trazado válido. Selecciona otra ruta en la biblioteca." onRetry={checkAuthAndLoadData} />;

  // Calculate distances for display
  const currentKm = isOffTrack ? 0 : (currentPosition?.distance || 0) / 1000; // currentPosition.distance is in METERS
  const totalDistanceKm = activeTrack?.total_distance || 0; // Ensure this is not null for remainingKm calculation
  const remainingKm = isOffTrack ? totalDistanceKm : Math.max(0, (totalDistanceKm - currentKm)); // activeTrack.total_distance is in KM
  
  const startPoint = activeTrack?.waypoints?.[0];
  const endPoint = activeTrack?.waypoints?.[activeTrack.waypoints.length - 1];

  const startNavUrl = startPoint ? `https://www.google.com/maps/dir/?api=1&destination=${startPoint.lat},${startPoint.lng}` : '#';
  const endNavUrl = endPoint ? `https://www.google.com/maps/dir/?api=1&destination=${endPoint.lat},${endPoint.lng}` : '#';

  const captureQuickPoi = () => {
    if (!currentPosition || isOffTrack) return;
    setQuickPoiSnapshotKm(Math.min(totalDistanceKm, Math.max(0, currentPosition.distance / 1000)));
    setQuickPoiError('');
    setQuickPoiOpen(true);
  };

  const saveQuickPoi = async ({ name, poiTypeId, distanceKm }) => {
    setQuickPoiSaving(true);
    setQuickPoiError('');
    try {
      const coordinates = getCoordsAtDistance(activeTrack.waypoints, distanceKm);
      if (!coordinates) throw new Error('No se pudo situar el PK sobre el trazado.');
      const createdPoi = await Poi.create({
        name,
        description: '',
        gpx_track_id: activeTrack.id,
        poi_type_id: poiTypeId,
        distance_from_start: distanceKm * 1000,
        latitude: coordinates.lat,
        longitude: coordinates.lng,
        elevation: coordinates.elevation || 0,
      });
      setPois((existing) => [...existing.filter((poi) => poi.id !== createdPoi.id), createdPoi]
        .sort((first, second) => (first.distance_from_start || 0) - (second.distance_from_start || 0)));
      invalidateStaticCache();
      setQuickPoiOpen(false);
    } catch (error) {
      setQuickPoiError(error.message || 'No se pudo guardar el POI.');
    } finally {
      setQuickPoiSaving(false);
    }
  };

  return (
    <div className="h-screen bg-white flex flex-col" data-fullscreen={isFullscreen ? "true" : "false"}>
      {visibleTrackId !== activeTrack.id && <NavigationLoadingScreen stage="map" overlay error={mapLoadTimedOut ? 'El mapa está tardando más de lo esperado. Comprueba tu conexión o vuelve a intentarlo.' : null} onRetry={() => window.location.reload()} />}
      {/* Orientation Warning Modal */}
      {showOrientationWarning && (
        <OrientationWarning 
          onDismiss={() => {
            setShowOrientationWarning(false);
            setOrientationWarningDismissed(true);
          }}
        />
      )}

      {/* Top Control Bar - IMPROVED MOBILE */}
      {!isFullscreen && (
        <div className="ocean-chrome border-b px-2 sm:px-4 py-2 sm:py-3 relative z-[2000]">
          <div className="flex items-center justify-between gap-2">
            {/* Track Info - RESPONSIVE */}
            <div className="flex items-center gap-2 sm:gap-6 min-w-0 flex-1">
              <div className="flex items-center gap-1 sm:gap-2 min-w-0">
                <NavIcon className="w-4 h-4 sm:w-5 sm:h-5 text-green-500 flex-shrink-0" />
                <span className="font-medium truncate text-sm sm:text-base text-slate-700">
                  {activeTrack?.name || "Sin ruta activa"}
                </span>
              </div>

              {activeTrack && (
                <div className="hidden sm:flex items-center gap-4 text-sm text-slate-500">
                  <div className="flex items-center gap-1">
                    <MapPin className="w-4 h-4" />
                    <span>{(activeTrack.total_distance)?.toFixed(1)}km</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Mountain className="w-4 h-4" />
                    <span>{activeTrack.total_elevation_gain?.toFixed(0)}m</span>
                  </div>
                </div>
              )}

              {/* GPS Status - COMPACT */}
              {gpsError && (
                <div className="text-red-500 text-xs sm:text-sm truncate">
                  GPS: {gpsError}
                </div>
              )}
              {currentPosition && currentPosition.distanceFromTrack !== null && currentPosition.distanceFromTrack !== undefined && (
                <div className="text-slate-500 text-xs sm:text-sm">
                  {isOffTrack ? (
                    <span className="text-yellow-600 font-semibold">Fuera</span>
                  ) : (
                    (() => {
                      const distance = currentPosition.distanceFromTrack;
                      if (distance < 50) return "En ruta";
                      if (distance < 1000) return `${distance.toFixed(0)}m`;
                      return `${(distance / 1000).toFixed(1)}km`;
                    })()
                  )}
                </div>
              )}
            </div>

            {/* Navigation Controls - RESPONSIVE */}
            <div className="flex items-center gap-1 sm:gap-2">
              {/* START/FINISH BUTTONS - RESPONSIVE */}
              <Button
                variant="outline"
                size="sm"
                onClick={captureQuickPoi}
                disabled={!currentPosition || isOffTrack || poiTypes.length === 0}
                className="flex items-center gap-1 sm:gap-2 border-cyan-200 bg-cyan-50/70 px-2 text-cyan-800 hover:bg-cyan-100 hover:text-cyan-900 sm:px-3"
                title={!currentPosition ? 'Esperando una posición GPS' : isOffTrack ? 'Debes estar sobre la ruta para añadir el POI' : 'Memorizar este PK y añadir un POI'}
              >
                <Plus className="h-3 w-3 sm:h-4 sm:w-4" />
                <MapPin className="h-3 w-3 sm:h-4 sm:w-4" />
                <span className="hidden sm:inline">Añadir POI</span>
                <span className="text-xs sm:hidden">POI</span>
              </Button>
              {startPoint && (
                <a href={startNavUrl} target="_blank" rel="noopener noreferrer">
                  <Button variant="outline" size="sm" className="flex items-center gap-1 sm:gap-2 border-blue-200 bg-blue-50/50 hover:bg-blue-100 text-blue-700 hover:text-blue-800 px-2 sm:px-3">
                    <Send className="w-3 h-3 sm:w-4 sm:h-4" />
                    <span className="hidden sm:inline">Ir a Salida</span>
                    <span className="sm:hidden text-xs">Salida</span>
                  </Button>
                </a>
              )}
              {endPoint && (
                <a href={endNavUrl} target="_blank" rel="noopener noreferrer">
                  <Button variant="outline" size="sm" className="flex items-center gap-1 sm:gap-2 border-green-200 bg-green-50/50 hover:bg-green-100 text-green-700 hover:text-green-800 px-2 sm:px-3">
                    <Send className="w-3 h-3 sm:w-4 sm:h-4" />
                    <span className="hidden sm:inline">Ir a Meta</span>
                    <span className="sm:hidden text-xs">Meta</span>
                  </Button>
                </a>
              )}

              {/* Admin Menu - RESPONSIVE */}
              {user && user.role === 'admin' && (
                <AdminMenu />
              )}

              {/* Tracks Button - FOR NON-ADMIN */}
              {user && user.role !== 'admin' && (
                <Link to={createPageUrl("Routes")}>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="flex items-center gap-1 sm:gap-2 border-slate-300 hover:bg-slate-100 text-slate-700 hover:text-slate-800 px-2 sm:px-3"
                  >
                    <Route className="w-3 h-3 sm:w-4 sm:h-4" />
                    <span className="hidden sm:inline">Tracks</span>
                  </Button>
                </Link>
              )}

              {/* Fullscreen Button - RESPONSIVE */}
              <Button
                variant="ghost"
                size="sm"
                onClick={handleFullscreenToggle}
                className="flex items-center gap-1 text-slate-600 hover:text-slate-900 hover:bg-slate-100/90 px-2 sm:px-3"
              >
                <Maximize className="w-3 h-3 sm:w-4 sm:h-4" />
                <span className="hidden sm:inline">Pantalla Completa</span>
              </Button>

              {/* NEW: Wake Lock Status Indicator (only show if not supported or there's an issue) */}
              {currentPosition && activeTrack && !wakeLockEnabled && 'wakeLock' in navigator && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={enableWakeLock}
                  className="flex items-center gap-1 text-yellow-600 hover:text-yellow-700 hover:bg-yellow-50 px-2 sm:px-3"
                  title="Mantener pantalla encendida"
                >
                  <div className="w-3 h-3 sm:w-4 sm:h-4 rounded-full bg-yellow-500 animate-pulse" />
                  <span className="hidden sm:inline text-xs">Activar Pantalla</span>
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      <QuickPoiDialog
        open={quickPoiOpen}
        onOpenChange={setQuickPoiOpen}
        snapshotKm={quickPoiSnapshotKm}
        maximumKm={totalDistanceKm}
        poiTypes={poiTypes}
        saving={quickPoiSaving}
        error={quickPoiError}
        onSave={saveQuickPoi}
      />

      {/* Main Layout */}
      <div className={`${isFullscreen ? 'h-screen' : 'flex-1'} flex relative`}>
        {/* Map Container - RESPONSIVE CONTROLS */}
        <div 
          className="flex-1 relative overflow-hidden"
          onDragOver={(e) => {
            e.preventDefault();
          }}
        >
          
          {/* Street View Pegman */}
          {false && <div
            ref={pegmanRef}
            onPointerDown={handleDragStart}
            className="absolute bottom-36 sm:bottom-52 right-4 z-[1003] cursor-grab active:cursor-grabbing transition-all select-none"
            style={{
              width: '44px',
              height: '58px',
              opacity: 0.9,
              filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.3))',
              userSelect: 'none',
              WebkitUserSelect: 'none',
              touchAction: 'none',
            }}
            title="Arrastra el muñeco para ver Street View"
          >
            <img src="/streetview-pegman.png" alt="Street View" draggable="false" className="w-full h-full object-contain pointer-events-none" style={{ filter: 'invert(71%) sepia(95%) saturate(533%) hue-rotate(2deg) brightness(106%) contrast(102%)' }} />
          </div>}

          {/* Solo se ilumina en amarillo cuando Google confirma que hay una panorámica. */}
          {false && isPegmanDragging && dragTargetPosition && (
            <div
              className="fixed pointer-events-none z-[1001]"
              style={{
                left: dragTargetPosition.x,
                top: dragTargetPosition.y,
                transform: 'translate(-50%, -50%)',
              }}
            >
              <div className="relative w-12 h-12 flex items-center justify-center">
                {dragTargetPosition.coverage === 'available' ? (
                  <>
                    <div className="absolute w-10 h-10 border-2 border-yellow-400/50 rounded-full animate-ping"></div>
                    <div className="absolute w-8 h-8 border-2 border-yellow-400 rounded-full bg-yellow-300/25"></div>
                    <div className="absolute w-2.5 h-2.5 bg-yellow-400 rounded-full shadow-md"></div>
                  </>
                ) : dragTargetPosition.coverage === 'checking' ? (
                  <div className="w-7 h-7 rounded-full border-2 border-slate-400 border-t-transparent animate-spin"></div>
                ) : (
                  <div className="w-7 h-7 rounded-full border-2 border-slate-400/70 bg-white/80 flex items-center justify-center text-slate-500 text-sm">×</div>
                )}
                
                {/* Connection line to pegman (finger/mouse position) */}
                {dragTargetPosition.pointerY && (
                  <div 
                    className="absolute w-0.5 bg-yellow-500 opacity-60"
                    style={{
                      height: `${Math.max(0, dragTargetPosition.pointerY - (dragTargetPosition.y + 24))}px`, // 24 is half of new container height (48px)
                      top: '24px', // Starts from the bottom of the target container
                      left: '50%',
                      transform: 'translateX(-50%)'
                    }}
                  />
                )}
              </div>
            </div>
          )}

          {/* Street View Overlay */}
          {streetViewPosition && (
            <div className="absolute inset-0 z-[1004] flex items-end justify-center pb-4">
              <div className="w-full max-w-4xl h-64 bg-white rounded-lg shadow-2xl border relative mx-4">
                {/* Close button */}
                <button
                  onClick={() => setStreetViewPosition(null)}
                  className="absolute top-2 right-2 z-10 w-8 h-8 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center shadow-lg transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
                
                {/* Street View iframe */}
                {googleApiKey ? (
                  <iframe
                    key={`streetview-${streetViewPosition.lat}-${streetViewPosition.lng}`}
                    src={`https://www.google.com/maps/embed/v1/streetview?key=${googleApiKey}&${streetViewPosition.panoId ? `pano=${encodeURIComponent(streetViewPosition.panoId)}` : `location=${streetViewPosition.lat},${streetViewPosition.lng}`}&heading=0&pitch=0&fov=90`}
                    width="100%"
                    height="100%"
                    style={{ border: 0, borderRadius: '8px' }}
                    allowFullScreen=""
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                    onError={(e) => {
                      console.error("Street View iframe error:", e);
                      // Fallback: open in new window if iframe fails
                      window.open(`https://www.google.com/maps/@${streetViewPosition.lat},${streetViewPosition.lng},18z/data=!3m1!1e3`, '_blank');
                      setStreetViewPosition(null);
                    }}
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-slate-500">
                    <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mb-2"></div>
                    <p>Cargando Street View...</p>
                    {!googleApiKey && (
                      <p className="text-xs text-red-500 mt-2">Error: Clave API no disponible</p>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Top Map Controls Bar - MOBILE FIRST APPROACH */}
          <MapControlsBar
            showPois={showPois}
            setShowPois={setShowPois}
            showRainRadar={showRainRadar}
            setShowRainRadar={setShowRainRadar}
            mapType={mapType}
            setMapType={setMapType}
            showKmMarkers={showKmMarkers}
            setShowKmMarkers={setShowKmMarkers}
            showElevationProfile={showElevationProfile}
            setShowElevationProfile={setShowElevationProfile}
            showRunners={showRunners}
            setShowRunners={setShowRunners}
            showWindArrowsOnMap={showWindArrowsOnMap}
            setShowWindArrowsOnMap={setShowWindArrowsOnMap}
            showRouteArrows={showRouteArrows}
            setShowRouteArrows={setShowRouteArrows}
            showTurnByTurn={showTurnByTurn}
            setShowTurnByTurn={setShowTurnByTurn}
          />
          
          {/* Left Controls - RESPONSIVE */}
          <div className="absolute top-2 sm:top-4 left-2 sm:left-4 z-[1002] flex flex-col gap-1 sm:gap-2">
            <ClimbExplorer key={activeTrack.id} track={activeTrack} googleApiKey={googleApiKey} />
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setFollowMode(true)}
              className={`h-7 w-7 sm:h-10 sm:w-10 rounded-full bg-white/90 backdrop-blur-sm text-slate-700 hover:text-slate-900 hover:bg-white shadow-lg border border-slate-200 ${followMode ? 'bg-blue-100 text-blue-700 border-blue-200' : ''}`}
              title="Centrar en mi ubicación"
            >
              <LocateFixed className="w-3 h-3 sm:w-5 sm:h-5" />
            </Button>
            
            {/* Zoom Controls - SMALLER ON MOBILE */}
            <Button
              variant="ghost"
              size="icon"
              onClick={handleZoomIn}
              className="h-7 w-7 sm:h-10 sm:w-10 rounded-full bg-white/90 backdrop-blur-sm text-slate-700 hover:text-slate-900 hover:bg-white shadow-lg border border-slate-200"
              title="Acercar zoom"
              disabled={!mapInstance}
            >
              <Plus className="w-3 h-3 sm:w-5 sm:h-5" />
            </Button>
            
            <Button
              variant="ghost"
              size="icon"
              onClick={handleZoomOut}
              className="h-7 w-7 sm:h-10 sm:w-10 rounded-full bg-white/90 backdrop-blur-sm text-slate-700 hover:text-slate-900 hover:bg-white shadow-lg border border-slate-200"
              title="Alejar zoom"
              disabled={!mapInstance}
            >
              <Minus className="w-3 h-3 sm:w-5 sm:h-5" />
            </Button>

            {/* Manual Rotation Controls - SMALLER */}
            <div className="flex flex-col gap-1 bg-white/90 backdrop-blur-sm rounded-full p-0.5 shadow-lg border border-slate-200">
              <Button
                variant="ghost"
                size="icon"
                onClick={rotateMapLeft}
                className="h-5 w-5 sm:h-8 sm:w-8 rounded-full text-slate-700 hover:text-slate-900 hover:bg-white"
                title="Rotar mapa izquierda"
              >
                <RotateCcw className="w-2.5 h-2.5 sm:w-4 sm:h-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={rotateMapRight}
                className="h-5 w-5 sm:h-8 sm:w-8 rounded-full text-slate-700 hover:text-slate-900 hover:bg-white"
                title="Rotar mapa derecha"
              >
                <RotateCw className="w-2.5 h-2.5 sm:w-4 sm:h-4" />
              </Button>
            </div>

            {/* Reset Rotation Button - SMALLER */}
            {(manualRotation !== 0 || mapOrientation === 'manual') && (
              <Button
                variant="ghost"
                size="icon"
                onClick={resetMapRotation}
                className="h-7 w-7 sm:h-10 sm:w-10 rounded-full bg-orange-100/90 backdrop-blur-sm text-orange-700 hover:text-orange-900 hover:bg-orange-200 shadow-lg border border-orange-200"
                title="Resetear rotación (Norte arriba)"
              >
                <Compass className="w-3 h-3 sm:w-5 sm:h-5" />
              </Button>
            )}
          </div>
          
          {/* Right Controls - Only in Fullscreen - RESPONSIVE & STACKED */}
          {isFullscreen && (
            <div className="absolute top-2 sm:top-4 right-2 sm:right-4 z-[1002] flex flex-col items-center gap-1 sm:gap-2">
              {/* Map Orientation Button - SMALLER */}
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleMapOrientation}
                className={`h-7 w-7 sm:h-10 sm:w-10 rounded-full bg-white/90 backdrop-blur-sm text-slate-700 hover:text-slate-900 hover:bg-white shadow-lg border border-slate-200 ${mapOrientation === 'heading-up' ? 'bg-orange-100 text-orange-700 border-orange-200' : ''}`}
                title={mapOrientation === 'heading-up' ? "Cambiar a Norte Arriba" : "Cambiar a Sentido de Marcha"}
              >
                <Compass className="w-3 h-3 sm:w-5 sm:h-5" />
              </Button>

              {/* Exit Fullscreen - SMALLER */}
              <Button
                variant="ghost"
                size="sm"
                onClick={handleFullscreenToggle}
                className="h-7 sm:h-10 px-1.5 sm:px-4 rounded-full bg-white/90 backdrop-blur-sm text-slate-700 hover:text-slate-900 hover:bg-white flex items-center gap-1 sm:gap-2 shadow-lg border border-slate-200"
              >
                <Minimize className="w-3 h-3 sm:w-5 sm:h-5" />
                <span className="text-xs sm:text-sm">Salir</span>
              </Button>
            </div>
          )}

          {/* This is a wrapper that will be rotated. It's oversized to prevent white corners. */}
          <div 
            className="absolute"
            style={{ 
              width: '200%', 
              height: '200%',
              top: '-50%', 
              left: '-50%', 
            }}
          >
            <MapView
              gpxTrack={activeTrack}
              currentPosition={currentPosition}
              pois={showPois ? pois.filter((p) => !p.gpx_track_id || p.gpx_track_id === activeTrack?.id) : []}
              poiTypes={poiTypes}
              selectedPoint={selectedPoint}
              showKmMarkers={showKmMarkers}
              showRouteArrows={showRouteArrows}
              runners={showRunners ? runners : []}
              mapOrientation={mapOrientation}
              followUser={followMode}
              onMapInteraction={() => setFollowMode(false)}
              mapType={mapType}
              onMapReady={handleMapReady}
              key={activeTrack.id}
              onMapVisible={() => setVisibleTrackId(activeTrack.id)}
              rotation={getFinalRotation()}
              windData={windData}
              showWindArrows={showWindArrowsOnMap}
              showRainRadar={showRainRadar} // NEW PROP
              onStreetViewOpen={setStreetViewPosition}
              onMapViewChange={() => {}}
            />
          </div>
          {/* Turn-by-turn Navigation Banner */}
          {showTurnByTurn && (
            <div className="absolute top-14 sm:top-16 left-1/2 transform -translate-x-1/2 z-[1003] w-[calc(100%_-_16px)] sm:w-[90vw] max-w-lg pointer-events-none">
              <TurnByTurnNavigator gpxTrack={activeTrack} currentPosition={currentPosition} currentSpeed={currentSpeed} isOffTrack={isOffTrack} />
            </div>
          )}

          {/* Elevation Profile - RESPONSIVE HEIGHT */}
          {showElevationProfile && (
            <div className="absolute bottom-0 left-0 w-full h-32 sm:h-48 pointer-events-none z-[1001]">
              <div className="absolute top-2 left-2 pointer-events-auto z-10">
                <Button variant={selectionMode ? "default" : "outline"} size="sm" onClick={() => setSelectionMode(!selectionMode)}
                  className={`flex items-center gap-2 shadow-lg ${selectionMode ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'bg-white/90 backdrop-blur-sm text-slate-700 hover:bg-white border-slate-200'}`}
                  title={selectionMode ? "Salir del modo selección" : "Activar modo selección"}>
                  <LocateFixed className="w-4 h-4" />
                  <span className="text-xs">{selectionMode ? 'Selección ON' : 'Selección'}</span>
                </Button>
              </div>
              <div className="h-full w-full pointer-events-auto">
                <ElevationProfile gpxTrack={activeTrack} currentPosition={currentPosition}
                  pois={showPois ? pois.filter(p => !p.gpx_track_id || p.gpx_track_id === activeTrack?.id) : []}
                  poiTypes={poiTypes} runners={showRunners ? runnersOnTrack : []}
                  onPoiClick={selectionMode ? null : handlePoiClickFromProfile}
                  elevationSegments={elevationSegmentView === 'full' ? null : elevationSegments}
                  selectionMode={selectionMode} onSegmentSelect={handleSegmentSelection} />
              </div>
            </div>
          )}
        </div>

        {/* Sidebar - RESPONSIVE SIZING */}
        <div className="ocean-panel w-[25%] min-w-[180px] sm:w-[22%] sm:min-w-[200px] md:w-[28%] md:min-w-[280px] lg:w-[25%] lg:min-w-[250px] border-l flex flex-col z-[2000]">
          
          {/* Off-track Warning Banner */}
          {isOffTrack && currentPosition && currentPosition.distanceFromTrack !== null && (
            <div className="bg-yellow-100 text-yellow-800 p-2 border-b border-yellow-200">
              <p className="font-bold text-xs">¡Fuera de Ruta!</p>
              <p className="text-xs">
                Distancia: {currentPosition.distanceFromTrack > 1000 
                  ? `${(currentPosition.distanceFromTrack / 1000).toFixed(1)} km` 
                  : `${currentPosition.distanceFromTrack.toFixed(0)} m`}
            </p>
            </div>
          )}

          {/* Live Stats - RESPONSIVE SIZING */}
          <div className="border-b border-slate-800">
            <div className="grid grid-cols-2">
              <div className="bg-white p-1 sm:p-2 md:p-4 lg:p-3 border-r border-slate-800">
                <div className="flex justify-between items-center mb-1">
                  <div className="text-xs text-slate-500 uppercase tracking-wide">Recorridos</div>
                </div>
                <div className="flex items-center justify-center gap-1">
                  <div className="text-lg sm:text-2xl md:text-4xl lg:text-4xl font-bold text-slate-800">{currentKm.toFixed(1)}</div>
                  <img 
                    src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/547c0e081_salida.png" 
                    alt="Salida" 
                    className="w-4 h-4 sm:w-6 sm:h-6 md:w-12 md:h-12 lg:w-10 lg:h-10"
                  />
                </div>
                <div className="text-xs text-slate-500 -mt-1">km</div>
              </div>
              <div className="bg-white p-1 sm:p-2 md:p-4 lg:p-3">
                <div className="flex justify-between items-center mb-1">
                  <div className="text-xs text-slate-500 uppercase tracking-wide">Faltan</div>
                </div>
                <div className="flex items-center justify-center gap-1">
                  <div className="text-lg sm:text-2xl md:text-4xl lg:text-4xl font-bold text-slate-800">{Math.max(0, remainingKm).toFixed(1)}</div>
                  <img 
                    src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/606446fa4_llegada.png" 
                    alt="Meta" 
                    className="w-4 h-4 sm:w-6 sm:h-6 md:w-12 md:h-12 lg:w-10 lg:h-10"
                  />
                </div>
                <div className="text-xs text-slate-500 -mt-1">km</div>
              </div>
            </div>
          </div>

          {/* Wind and Rain Information Panels - RESPONSIVE */}
          <WeatherPanel
            isFetchingWeather={isFetchingWeather}
            windData={windData}
            weatherError={weatherError}
            rainForecast={rainForecast}
          />

          {/* NEW: Elevation Segment Viewer - VISUAL PROFILE */}
          {(elevationSegmentView !== 'full' || selectedSegmentRange) && (
            <ElevationSegmentViewer
              elevationSegmentView={elevationSegmentView}
              selectedSegmentRange={selectedSegmentRange}
              selectedRangeSegments={selectedRangeSegments}
              elevationSegments={elevationSegments}
              activeTrack={activeTrack}
              onSegmentClick={(pos) => { setStreetViewPosition(pos); setFollowMode(false); }}
            />
          )}

          {/* Combined Scrollable Area - RESPONSIVE */}
          <div className="flex-1 overflow-y-auto scrollbar-thin">

            {/* Runners on Track Section - RESPONSIVE TEXT */}
            <div className="border-b border-slate-800">
              <div className="bg-slate-100 p-1 sm:p-2 border-b border-slate-800">
                 <h3 className="text-xs text-slate-500 uppercase font-semibold tracking-wider flex items-center gap-2">
                  <ChevronRight className="w-3 h-3 sm:w-4 sm:h-4"/>
                  Corredores en Ruta
                </h3>
              </div>
              {runnersOnTrack.length === 0 ? (
                <div className="text-center text-slate-500 py-2 sm:py-4 text-xs">
                  Esperando corredores...
                </div>
              ) : (
                <div className="divide-y divide-slate-200">
                  {runnersOnTrack.map((runner) => (
                    <div key={`runner-${runner.id}`} className="flex items-center justify-between py-1 sm:py-2 px-1 sm:px-2 md:px-3 gap-1 sm:gap-2">
                      <div className="flex items-center gap-1 sm:gap-2 min-w-0">
                        <div 
                          className="w-2 h-2 sm:w-3 sm:h-3 rounded-full flex-shrink-0" 
                          style={{ backgroundColor: runner.color || '#3b82f6' }}
                          title={runner.team_name}
                        ></div>
                        <span className="text-xs text-slate-700 font-medium truncate" title={runner.device_name}>
                          {runner.device_name}
                        </span>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <span className="text-xs sm:text-sm font-bold text-slate-800">
                          {(runner.distanceToFinish / 1000).toFixed(1)}
                        </span>
                        <span className="text-xs text-slate-500 ml-1">
                          km
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* POIs Section - RESPONSIVE */}
            <div>
              <div className="bg-slate-100 p-1 sm:p-2 border-b border-slate-800">
                 <h3 className="text-xs text-slate-500 uppercase font-semibold tracking-wider flex items-center gap-2">
                  <ChevronRight className="w-3 h-3 sm:w-4 sm:h-4"/>
                  Próximos POIs
                </h3>
              </div>
              {nearbyPois.length === 0 ? (
                <div className="text-center text-slate-500 py-2 sm:py-4 text-xs">
                  {currentPosition ? "No hay más POIs adelante." : "Esperando GPS..."}
                </div>
              ) : (
                <div className="divide-y divide-slate-200">
                  {nearbyPois.map((poi) => {
                    const poiType = getPoiType(poi.poi_type_id);
                    const distanceData = formatDistanceToPoiData(poi.remainingDistanceKm);
                    
                    return (
                      <div key={`poi-${poi.id}-${positionUpdateCount}`} className="flex items-center justify-between py-1 sm:py-2 px-1 sm:px-2 md:p-3 lg:p-3 gap-1 sm:gap-4 lg:gap-4">
                        <div className="flex items-center gap-1 sm:gap-3 lg:gap-3 flex-shrink-0">
                          <div className="w-6 h-6 sm:w-8 sm:h-8 md:w-12 md:h-12 lg:w-10 lg:h-10 flex-shrink-0">
                            <PoiIcon type={poiType} className="w-full h-full" />
                          </div>
                          <div className="text-xs sm:text-sm md:text-lg lg:text-base text-slate-500 font-medium">
                            Km {(poi.distance_from_start / 1000).toFixed(1)}
                          </div>
                        </div>
                        <div className="text-right flex-1 min-w-0">
                          {poi.remainingDistanceMeters < 20 && !isOffTrack ? (
                            <div className="text-sm sm:text-xl md:text-4xl lg:text-4xl font-bold text-green-600 leading-none">
                              Aquí
                            </div>
                          ) : (
                            <div className="flex items-baseline justify-end gap-0 sm:gap-1 lg:gap-1">
                              {distanceData.prefix && (
                                <span className="text-xs sm:text-sm md:text-xl lg:text-base text-green-600 font-medium hidden sm:inline">
                                  {distanceData.prefix}
                                </span>
                              )}
                              <span className="sm:text-xl md:text-4xl lg:text-4xl text-base font-bold text-slate-800 leading-none">
                                {distanceData.value}
                              </span>
                              <span className="text-xs sm:text-base md:text-xl lg:text-base text-green-600 font-medium">
                                {distanceData.unit}
                              </span>
                            </div>
                          )}
                          {/* POI Name */}
                          <div className="text-xs text-slate-400 mt-1 truncate">
                            {poi.name || poiType?.name || 'Punto de Interés'}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* NEW: Elevation Segment View Selector at the bottom */}
          <div className="border-t border-slate-800 bg-white p-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full flex items-center justify-between text-xs"
                >
                  <span className="flex items-center gap-2">
                    <BarChart3 className="w-3 h-3" />
                    Vista: {elevationSegmentView === 'full' ? 'Completa' : 
                            (elevationSegmentView === 'selection' && selectedSegmentRange ? `Selección (${selectedSegmentRange.startKm.toFixed(1)} - ${selectedSegmentRange.endKm.toFixed(1)}km)` : 
                            `Últimos ${elevationSegmentView}`)
                            }
                  </span>
                  <ChevronDown className="w-3 h-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="bg-white border-slate-200 text-slate-800 w-48 z-[9999]" align="end">
                <DropdownMenuLabel>Perfil de Elevación</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem 
                  onClick={() => setElevationSegmentView('full')}
                  className="cursor-pointer focus:bg-slate-100 text-xs"
                >
                  {elevationSegmentView === 'full' && <Check className="w-3 h-3 mr-2" />}
                  <span className={elevationSegmentView !== 'full' ? 'ml-5' : ''}>Completo</span>
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={() => setElevationSegmentView('selection')}
                  className="cursor-pointer focus:bg-slate-100 text-xs"
                  disabled={!selectedSegmentRange} // Disable if no segment selected
                >
                  {elevationSegmentView === 'selection' && <Check className="w-3 h-3 mr-2" />}
                  <span className={elevationSegmentView !== 'selection' ? 'ml-5' : ''}>
                    Selección
                    {selectedSegmentRange && ` (${selectedSegmentRange.startKm.toFixed(1)} - ${selectedSegmentRange.endKm.toFixed(1)}km)`}
                  </span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem 
                  onClick={() => setElevationSegmentView('500m')}
                  className="cursor-pointer focus:bg-slate-100 text-xs"
                >
                  {elevationSegmentView === '500m' && <Check className="w-3 h-3 mr-2" />}
                  <span className={elevationSegmentView !== '500m' ? 'ml-5' : ''}>Últimos 500m</span>
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={() => setElevationSegmentView('1k')}
                  className="cursor-pointer focus:bg-slate-100 text-xs"
                >
                  {elevationSegmentView === '1k' && <Check className="w-3 h-3 mr-2" />}
                  <span className={elevationSegmentView !== '1k' ? 'ml-5' : ''}>Último 1km</span>
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={() => setElevationSegmentView('2km')}
                  className="cursor-pointer focus:bg-slate-100 text-xs"
                >
                  {elevationSegmentView === '2km' && <Check className="w-3 h-3 mr-2" />}
                  <span className={elevationSegmentView !== '2km' ? 'ml-5' : ''}>Últimos 2km</span>
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={() => setElevationSegmentView('5km')}
                  className="cursor-pointer focus:bg-slate-100 text-xs"
                >
                  {elevationSegmentView === '5km' && <Check className="w-3 h-3 mr-2" />}
                  <span className={elevationSegmentView !== '5km' ? 'ml-5' : ''}>Últimos 5km</span>
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={() => setElevationSegmentView('10km')}
                  className="cursor-pointer focus:bg-slate-100 text-xs"
                >
                  {elevationSegmentView === '10km' && <Check className="w-3 h-3 mr-2" />}
                  <span className={elevationSegmentView !== '10km' ? 'ml-5' : ''}>Últimos 10km</span>
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={() => setElevationSegmentView('25km')}
                  className="cursor-pointer focus:bg-slate-100 text-xs"
                >
                  {elevationSegmentView === '25km' && <Check className="w-3 h-3 mr-2" />}
                  <span className={elevationSegmentView !== '25km' ? 'ml-5' : ''}>Últimos 25km</span>
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={() => setElevationSegmentView('50km')}
                  className="cursor-pointer focus:bg-slate-100 text-xs"
                >
                  {elevationSegmentView === '50km' && <Check className="w-3 h-3 mr-2" />}
                  <span className={elevationSegmentView !== '50km' ? 'ml-5' : ''}>Últimos 50km</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    </div>
  );
}

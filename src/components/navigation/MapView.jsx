import React, { useState, useEffect, useMemo, useRef } from "react";
import { MapContainer, TileLayer, Polyline, Marker, Popup, useMapEvents, useMap } from "react-leaflet";
import { motion } from "framer-motion";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { CloudRain } from "lucide-react";


import { base44 } from "@/api/base44Client";
import { getStreetViewMetadata } from "@/functions/getStreetViewMetadata";

// Component to handle initial bounds fitting
function InitialBoundsFitter({ gpxTrack }) {
  const map = useMap();
  const hasFitted = useRef(false); // Use a ref to run only once

  useEffect(() => {
    // Only fit if map is ready, gpxTrack has waypoints, and we haven't fitted before
    if (map && gpxTrack?.waypoints?.length > 0 && !hasFitted.current) {
      const waypoints = gpxTrack.waypoints;
      const bounds = L.latLngBounds(waypoints.map(p => [p.lat, p.lng]));
      
      // Check if bounds are valid before fitting
      // A common issue for invalid bounds is having only one point, or identical points.
      // Leaflet's fitBounds might behave unexpectedly with invalid bounds.
      if (bounds.isValid()) {
        map.fitBounds(bounds, { padding: [50, 50] }); // Add some padding for better visuals
        hasFitted.current = true; // Mark as fitted
      } else if (waypoints.length === 1) {
        // If only one waypoint, set view to that point and a default zoom
        map.setView([waypoints[0].lat, waypoints[0].lng], 14);
        hasFitted.current = true;
      }
    }
  }, [map, gpxTrack]);

  return null;
}

// Helper to calculate a new lat/lng point from a starting point, bearing, and distance
const calculateOffsetPosition = (lat, lng, bearing, distanceMeters) => {
    const R = 6371e3; // Earth's radius in meters
    const toRad = (deg) => deg * Math.PI / 180;
    const toDeg = (rad) => rad * 180 / Math.PI;

    const latRad = toRad(lat);
    const lonRad = toRad(lng);
    const bearingRad = toRad(bearing);

    const lat2Rad = Math.asin(Math.sin(latRad) * Math.cos(distanceMeters / R) +
                        Math.cos(latRad) * Math.sin(distanceMeters / R) * Math.cos(bearingRad));

    const lon2Rad = lonRad + Math.atan2(Math.sin(bearingRad) * Math.sin(distanceMeters / R) * Math.cos(latRad),
                                Math.cos(distanceMeters / R) - Math.sin(latRad) * Math.sin(lat2Rad));

    return { lat: toDeg(lat2Rad), lng: toDeg(lon2Rad) };
};

// Internal component to handle map events
function MapEvents({ followUser, currentPosition, onMapInteraction, mapOrientation, heading, onMapViewChange }) {
  const map = useMapEvents({
    dragstart: () => {
      if (onMapInteraction) onMapInteraction();
    },
    zoomstart: () => {
      if (onMapInteraction) onMapInteraction();
    },
    moveend: () => { // When map movement ends
      if (onMapViewChange) {
        onMapViewChange(map.getCenter());
      }
    }
  });

  // Update map center on initial load
  useEffect(() => {
    if (map && onMapViewChange) {
      onMapViewChange(map.getCenter());
    }
  }, [map, onMapViewChange]);

  // Only pan to user position when follow mode is explicitly enabled
  useEffect(() => {
    if (followUser && currentPosition) {
      map.panTo([currentPosition.lat, currentPosition.lng]);
    }
  }, [currentPosition, followUser, map]); // followUser must be true for auto-centering
  
  // Effect for map orientation
  useEffect(() => {
    // Check if map has the setBearing method (from rotation plugins)
    // Leaflet's L.Map.setBearing() is not a standard Leaflet API.
    // It's usually part of plugins like 'leaflet-rotatedmarker' or 'leaflet-bing-maps-v2-rotated'.
    // Assuming a custom Leaflet build or plugin that adds `setBearing` or similar functionality for map rotation.
    // If not, this part will need to be adapted based on how map rotation is handled.
    if (mapOrientation === 'heading-up' && heading !== null && heading !== undefined && typeof map.setBearing === 'function') {
      // Convert heading to bearing (heading is 0-360 where 0 is north)
      // For map rotation, we want the opposite direction so the heading points up
      const bearing = -heading;
      map.setBearing(bearing);
    } else if (typeof map.setBearing === 'function') {
      map.setBearing(0); // Reset to north-up
    } else if (mapOrientation === 'heading-up' && heading !== null && heading !== undefined) {
      // Fallback: If no setBearing method available, we could try CSS transforms
      // This is a more complex implementation that would require custom styling
      // console.log(`Map rotation requested: ${heading} degrees, but setBearing not available`);
    }
  }, [mapOrientation, heading, map]);

  return null;
}

// MapInstanceCapture is removed, its functionality is moved to MapContainer's whenReady prop.


// Fix for default markers using CDN URLs
const defaultIcon = L.icon({
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

L.Marker.prototype.options.icon = defaultIcon;

const createRunnerIcon = (color = '#3b82f6', isOnline = false) => {
  const pulsingAnimation = `
    @keyframes pulse {
      0% { transform: scale(0.9); opacity: 0.7; }
      50% { transform: scale(1.1); opacity: 1; }
      100% { transform: scale(0.9); opacity: 0.7; }
    }
  `;
  const animationStyle = isOnline ? 'animation: pulse 2s infinite;' : '';

  const iconHtml = `
    <div style="position: relative; width: 24px; height: 24px;">
      <style>${pulsingAnimation}</style>
      <div style="
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: 14px;
        height: 14px;
        background-color: ${color};
        border-radius: 50%;
        border: 2px solid white;
        box-shadow: 0 0 5px rgba(0,0,0,0.5);
        ${animationStyle}
      "></div>
    </div>
  `;

  return L.divIcon({
    html: iconHtml,
    className: '', // important to clear default styling
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });
};

// New function for current position icon (black with white border)
const createCurrentPositionIcon = () => {
  const iconHtml = `
    <div style="position: relative; width: 28px; height: 28px;">
      <div style="
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: 18px;
        height: 18px;
        background-color: #1e293b;
        border-radius: 50%;
        border: 3px solid white;
        box-shadow: 0 0 8px rgba(0,0,0,0.6);
      "></div>
    </div>
  `;

  return L.divIcon({
    html: iconHtml,
    className: '',
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
};

// New function to create POI icons for the map
const createPoiLeafletIcon = (poiType) => {
  if (!poiType) {
    // Fallback icon
    return L.divIcon({
      html: `<div style="width: 16px; height: 16px; background-color: #888; border-radius: 50%; border: 2px solid white;"></div>`,
      className: '',
      iconSize: [20, 20],
      iconAnchor: [10, 10],
    });
  }

  if (poiType.icon_url) {
    // Use image icon if available
    return L.icon({
      iconUrl: poiType.icon_url,
      iconSize: [28, 28],
      iconAnchor: [14, 28],
      popupAnchor: [0, -28],
    });
  } else {
    // Use colored circle if no image
    const iconHtml = `
      <div style="position: relative; width: 24px; height: 24px;">
        <div style="
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          width: 16px;
          height: 16px;
          background-color: ${poiType.color || '#3b82f6'};
          border-radius: 50%;
          border: 2px solid white;
          box-shadow: 0 1px 3px rgba(0,0,0,0.3);
        "></div>
      </div>
    `;
    return L.divIcon({
      html: iconHtml,
      className: '',
      iconSize: [24, 24],
      iconAnchor: [12, 12],
    });
  }
};

const startIcon = new L.Icon({
  iconUrl: "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/547c0e081_salida.png",
  iconSize: [32, 32],
  iconAnchor: [16, 16],
  popupAnchor: [0, -16],
});

const finishIcon = new L.Icon({
  iconUrl: "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/606446fa4_llegada.png",
  iconSize: [32, 32],
  iconAnchor: [16, 16],
  popupAnchor: [0, -16],
});

// Function to calculate bearing between two points
const calculateBearing = (lat1, lng1, lat2, lng2) => {
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const lat1Rad = lat1 * Math.PI / 180;
  const lat2Rad = lat2 * Math.PI / 180;
  
  const y = Math.sin(dLng) * Math.cos(lat2Rad);
  const x = Math.cos(lat1Rad) * Math.sin(lat2Rad) - Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLng);
  
  const bearing = Math.atan2(y, x) * 180 / Math.PI;
  return (bearing + 360) % 360; // Normalize to 0-360
};

// Create arrow icon for route direction - NEW, BIGGER AND MORE POINTED
const createRouteArrowIcon = (bearing) => {
  const iconHtml = `
    <div style="
      width: 36px; /* Increased size */
      height: 36px; /* Increased size */
      transform: rotate(${bearing}deg);
      display: flex;
      align-items: center;
      justify-content: center;
      filter: drop-shadow(0 2px 4px rgba(0,0,0,0.4)); /* Stronger shadow */
    ">
      <svg width="32" height="32" viewBox="0 0 24 24" fill="#1e293b" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M12 2 L2 22 L12 17 L22 22 Z"/>
      </svg>
    </div>
  `;

  return L.divIcon({
    html: iconHtml,
    className: '',
    iconSize: [36, 36], // Match new size
    iconAnchor: [18, 18], // Center anchor
  });
};

// NEW: Function to get wind arrow color based on speed
const getWindColor = (speedKmh) => {
  if (speedKmh >= 40) return '#ef4444'; // Red for strong wind
  if (speedKmh >= 25) return '#f59e0b'; // Amber for moderate wind
  if (speedKmh >= 10) return '#84cc16'; // Lime for light breeze
  return '#3b82f6'; // Blue for calm
};

// NEW: Updated wind arrow icon - larger and more stylized
const createWindArrowIcon = (speedKmh, direction) => {
  const color = getWindColor(speedKmh);
  // Las APIs meteorológicas expresan la dirección como el origen del viento.
  // La flecha del mapa debe señalar el destino al que sopla, por eso se invierte.
  const flowDirection = (Number(direction) + 180) % 360;
  // A longer, more prominent arrow shape
  const iconHtml = `
    <div style="
      transform: rotate(${flowDirection}deg);
      transform-origin: center;
      width: 60px; /* Increased size */
      height: 60px; /* Increased size */
      display: flex;
      align-items: center;
      justify-content: center;
      filter: drop-shadow(0 3px 6px rgba(0,0,0,0.4)); /* Stronger shadow */
    ">
      <svg width="48" height="48" viewBox="0 0 24 24" fill="${color}" stroke="black" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M12 23V1"/> <!-- Longer tail -->
        <path d="M5 8l7-7 7 7"/> <!-- Adjusted head to match new tail -->
      </svg>
    </div>
  `;
  return L.divIcon({
    html: iconHtml,
    className: '',
    iconSize: [60, 60], // Match div size
    iconAnchor: [30, 30], // Center anchor
  });
};

// NEW: Street View Control Component
function StreetViewControl({ map, gpxTrack, onStreetViewOpen }) {
  const streetViewControlRef = useRef(null);
  const gpxTrackRef = useRef(gpxTrack);
  const onStreetViewOpenRef = useRef(onStreetViewOpen);
  const targetMarkerRef = useRef(null);

  useEffect(() => { gpxTrackRef.current = gpxTrack; }, [gpxTrack]);
  useEffect(() => { onStreetViewOpenRef.current = onStreetViewOpen; }, [onStreetViewOpen]);

  useEffect(() => {
    if (!map) return;

    // Create Street View control
    const StreetViewControlClass = L.Control.extend({
      options: {
        position: 'bottomright'
      },

      onAdd: function(map) {
        const container = L.DomUtil.create('div', 'leaflet-control-streetview');
        container.style.width = '44px';
        container.style.height = '54px';
        container.style.background = 'transparent';
        container.style.padding = '0';
        container.style.boxShadow = 'none';
        container.style.border = '0';
        container.style.cursor = 'grab';
        container.style.zIndex = '1000';
        container.style.touchAction = 'none';
        container.style.opacity = '0.68';
        container.style.transition = 'opacity 150ms ease, transform 150ms ease';
        
        container.innerHTML = '<img src="/streetview-pegman.png" alt="Street View" draggable="false" style="display:block;width:44px;height:54px;object-fit:contain;" />';

        // El lienzo del mapa se amplía al 200%; los controles de Leaflet deben
        // desplazarse para quedar en la esquina que realmente ve el usuario.
        window.setTimeout(() => {
          const corner = container.parentElement;
          if (corner) {
            corner.style.right = '25%';
            corner.style.bottom = '25%';
            corner.style.marginBottom = '150px';
          }
        }, 0);

        let dragStarted = false;
        let dragElement = null;
        let candidate = null;
        let removeTimer = null;
        const supportsPointerEvents = 'PointerEvent' in window;
        const eventPoint = (event) => event.touches?.[0] || event.changedTouches?.[0] || event;

        const removeTarget = () => {
          window.clearTimeout(removeTimer);
          if (targetMarkerRef.current) {
            map.removeLayer(targetMarkerRef.current);
            targetMarkerRef.current = null;
          }
        };

        const nearestTrackPoint = (latlng) => {
          const points = gpxTrackRef.current?.waypoints || [];
          let closest = null;
          let distance = Infinity;
          for (const point of points) {
            const nextDistance = calculateDistanceMeters(latlng.lat, latlng.lng, point.lat, point.lng);
            if (nextDistance < distance) { closest = point; distance = nextDistance; }
          }
          return closest && distance <= 300 ? closest : null;
        };

        const updateTarget = (event) => {
          const point = nearestTrackPoint(map.mouseEventToLatLng(eventPoint(event)));
          candidate = point;
          if (!point) { removeTarget(); return; }
          if (!targetMarkerRef.current) {
            targetMarkerRef.current = L.circleMarker([point.lat, point.lng], {
              radius: 11, color: '#facc15', weight: 3, fillColor: '#fde047', fillOpacity: 0.32, interactive: false,
            }).addTo(map);
          } else {
            targetMarkerRef.current.setLatLng([point.lat, point.lng]);
            targetMarkerRef.current.setStyle({ color: '#facc15', fillColor: '#fde047', fillOpacity: 0.32 });
          }
        };

        // Prevent map interaction when clicking the control
        L.DomEvent.disableClickPropagation(container);
        L.DomEvent.disableScrollPropagation(container);

        const startDrag = (e) => {
          e.preventDefault();
          e.stopPropagation();
          dragStarted = true;
          container.style.cursor = 'grabbing';
          container.style.opacity = '1';
          
          // Create draggable element
          dragElement = container.cloneNode(true);
          dragElement.style.position = 'fixed';
          dragElement.style.zIndex = '10000';
          dragElement.style.pointerEvents = 'none'; // So it doesn't interfere with mouse events on underlying map
          dragElement.style.opacity = '0.8';
          dragElement.style.transform = 'scale(1.1)';
          document.body.appendChild(dragElement);

          const moveElement = (e) => {
            e.preventDefault();
            const pointer = eventPoint(e);
            if (dragElement) {
              dragElement.style.left = (pointer.clientX - dragElement.offsetWidth / 2) + 'px';
              dragElement.style.top = (pointer.clientY - dragElement.offsetHeight * 0.35) + 'px';

              const rect = map.getContainer().getBoundingClientRect();
              if (pointer.clientX >= rect.left && pointer.clientX <= rect.right && pointer.clientY >= rect.top && pointer.clientY <= rect.bottom) updateTarget(e);
              else { candidate = null; removeTarget(); }
            }
          };

          const stopDrag = async () => {
            if (dragElement) {
              document.body.removeChild(dragElement);
              dragElement = null;
            }
            dragStarted = false;
            container.style.cursor = 'grab';
            container.style.opacity = '0.68';
            document.removeEventListener('pointermove', moveElement);
            document.removeEventListener('pointerup', stopDrag);
            document.removeEventListener('pointercancel', stopDrag);
            document.removeEventListener('touchmove', moveElement);
            document.removeEventListener('touchend', stopDrag);
            document.removeEventListener('touchcancel', stopDrag);
            document.removeEventListener('mousemove', moveElement);
            document.removeEventListener('mouseup', stopDrag);
            if (!candidate) return;
            targetMarkerRef.current?.setStyle({ color: '#3b82f6', fillColor: '#93c5fd', fillOpacity: 0.5 });
            try {
              const metadata = await getStreetViewMetadata({ latitude: candidate.lat, longitude: candidate.lng });
              if (metadata.available) {
                onStreetViewOpenRef.current?.({
                  lat: metadata.location?.lat ?? candidate.lat,
                  lng: metadata.location?.lng ?? candidate.lng,
                  panoId: metadata.panoId,
                });
                removeTarget();
              } else {
                targetMarkerRef.current?.setStyle({ color: '#94a3b8', fillColor: '#cbd5e1', fillOpacity: 0.3 });
                removeTimer = window.setTimeout(removeTarget, 700);
              }
            } catch {
              removeTarget();
            }
          };

          moveElement(e);
          if (supportsPointerEvents) {
            document.addEventListener('pointermove', moveElement, { passive: false });
            document.addEventListener('pointerup', stopDrag, { once: true });
            document.addEventListener('pointercancel', stopDrag, { once: true });
          } else {
            document.addEventListener('touchmove', moveElement, { passive: false });
            document.addEventListener('touchend', stopDrag, { once: true });
            document.addEventListener('touchcancel', stopDrag, { once: true });
            document.addEventListener('mousemove', moveElement, { passive: false });
            document.addEventListener('mouseup', stopDrag, { once: true });
          }
        };
        if (supportsPointerEvents) {
          container.addEventListener('pointerdown', startDrag, { passive: false });
        } else {
          container.addEventListener('touchstart', startDrag, { passive: false });
          container.addEventListener('mousedown', startDrag, { passive: false });
        }

        container.title = 'Arrastra para ver en Street View';
        return container;
      }
    });

    const streetViewControl = new StreetViewControlClass();
    map.addControl(streetViewControl);
    streetViewControlRef.current = streetViewControl;

    return () => {
      if (streetViewControlRef.current) {
        map.removeControl(streetViewControlRef.current);
      }
      if (targetMarkerRef.current) map.removeLayer(targetMarkerRef.current);
    };
  }, [map]);

  return null;
}

// Helper function to calculate distance between two coordinates in meters
const calculateDistanceMeters = (lat1, lng1, lat2, lng2) => {
  const R = 6371e3; // metres
  const φ1 = lat1 * Math.PI/180;
  const φ2 = lat2 * Math.PI/180;
  const Δφ = (lat2-lat1) * Math.PI/180;
  const Δλ = (lng2-lng1) * Math.PI/180;

  const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ/2) * Math.sin(Δλ/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

  return R * c; // in metres
};

// Function to group nearby POIs and calculate minimal offset positions
const groupAndOffsetPois = (pois, minDistanceMeters = 30) => {
  if (pois.length === 0) return [];
  
  const groups = [];
  const processed = new Set();
  
  // Group POIs that are close to each other
  pois.forEach((poi, index) => {
    if (processed.has(index)) return;
    
    const group = [index];
    processed.add(index);
    
    // Find other POIs close to this one
    pois.forEach((otherPoi, otherIndex) => {
      if (otherIndex === index || processed.has(otherIndex)) return;
      
      const distance = calculateDistanceMeters(
        poi.latitude, poi.longitude,
        otherPoi.latitude, otherPoi.longitude
      );
      
      if (distance < minDistanceMeters) {
        group.push(otherIndex);
        processed.add(otherIndex);
      }
    });
    
    groups.push(group);
  });
  
  // Calculate offset positions for each group
  const offsetPois = [];
  
  groups.forEach(group => {
    if (group.length === 1) {
      // Single POI, no offset needed
      offsetPois.push({
        ...pois[group[0]],
        offsetLat: pois[group[0]].latitude,
        offsetLng: pois[group[0]].longitude
      });
    } else {
      // Multiple POIs, arrange them in a tight line/grid pattern
      const centerLat = group.reduce((sum, idx) => sum + pois[idx].latitude, 0) / group.length;
      const centerLng = group.reduce((sum, idx) => sum + pois[idx].longitude, 0) / group.length;
      
      // Very small offset distance - just enough to not overlap (approximately 15 meters)
      // This offset is in degrees, not meters.
      const offsetDistance = 0.00015; 
      
      group.forEach((poiIndex, groupIndex) => {
        let offsetLat = centerLat;
        let offsetLng = centerLng;
        
        if (group.length === 2) {
          // For 2 POIs: side by side horizontally
          offsetLng = centerLng + (groupIndex === 0 ? -offsetDistance : offsetDistance);
        } else if (group.length === 3) {
          // For 3 POIs: triangle pattern
          const angle = groupIndex * 2 * Math.PI / 3;
          offsetLat = centerLat + offsetDistance * 0.7 * Math.sin(angle);
          offsetLng = centerLng + offsetDistance * 0.7 * Math.cos(angle);
        } else if (group.length === 4) {
          // For 4 POIs: square pattern
          const positions = [
            [-offsetDistance * 0.5, -offsetDistance * 0.5], // Top-left
            [offsetDistance * 0.5, -offsetDistance * 0.5],  // Top-right
            [-offsetDistance * 0.5, offsetDistance * 0.5],  // Bottom-left
            [offsetDistance * 0.5, offsetDistance * 0.5]    // Bottom-right
          ];
          offsetLat = centerLat + positions[groupIndex][0];
          offsetLng = centerLng + positions[groupIndex][1];
        } else {
          // For more than 4 POIs: circular but tight
          const angle = (groupIndex * 2 * Math.PI) / group.length;
          offsetLat = centerLat + offsetDistance * Math.sin(angle);
          offsetLng = centerLng + offsetDistance * Math.cos(angle);
        }
        
        offsetPois.push({
          ...pois[poiIndex],
          offsetLat,
          offsetLng,
          isOffset: groupIndex > 0, // Only mark as offset if not the first in group
          groupSize: group.length
        });
      });
    }
  });
  
  return offsetPois;
};

export default function MapView({ 
  gpxTrack, 
  currentPosition, 
  pois = [],
  poiTypes = [],
  onMapClick,
  selectedPoint = null,
  showKmMarkers = true,
  showRouteArrows = false, 
  runners = [],
  mapOrientation = 'north-up',
  followUser = false, 
  onMapInteraction,
  mapType = 'google', 
  onMapReady, 
  onMapVisible,
  rotation = 0,
  windData = null,
  showWindArrows = false, 
  showPois = true,
  showRainRadar = false,
  onStreetViewOpen,
  onMapViewChange = () => {}
}) {
  const mapRef = useRef(null);
  const [map, setMap] = useState(null);
  const [isMapReady, setIsMapReady] = useState(false);
  const rainRadarLayerRef = useRef(null);
  const rainRadarTimerRef = useRef(null); // Unused, but kept for consistency if it was intended for other radar types
  const [rainRadarError, setRainRadarError] = useState(null);
  const [highlightSegment, setHighlightSegment] = useState([]);

  const mapLayers = {
    google: {
      url: "https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}",
      attribution: '&copy; <a href="https://www.google.com/maps">Google Maps</a>',
      label: "Carreteras"
    },
    satellite: {
      url: "https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}",
      attribution: '&copy; <a href="https://www.google.com/maps">Google Maps</a>',
      label: "Satélite"
    },
    hybrid: {
      url: "https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}",
      attribution: '&copy; <a href="https://www.google.com/maps">Google Maps</a>',
      label: "Híbrido"
    },
    terrain: {
      url: "https://mt1.google.com/vt/lyrs=p&x={x}&y={y}&z={z}",
      attribution: '&copy; <a href="https://www.google.com/maps">Google Maps</a>',
      label: "Terreno"
    },
    street: {
      url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      label: "OpenStreetMap"
    }
  };

  const getMapCenter = () => {
    // This initial center will be set, but then overridden by InitialBoundsFitter if a GPX track exists.
    // If no GPX track, this will serve as the initial center.
    if (currentPosition?.lat && currentPosition?.lng) {
      return [currentPosition.lat, currentPosition.lng];
    }
    if (runners.length > 0) {
      const firstRunner = runners.find(r => r.latitude && r.longitude);
      if (firstRunner) {
        return [firstRunner.latitude, firstRunner.longitude];
      }
    }
    if (gpxTrack?.waypoints?.length > 0) {
      // If no current position or runners, but there's a track, center on its start.
      return [gpxTrack.waypoints[0].lat, gpxTrack.waypoints[0].lng];
    }
    // Default center if nothing else available
    return [40.416775, -3.703790]; // Madrid coordinates
  };

  const center = getMapCenter();

  // Generate km markers from GPX track
  const kmMarkers = useMemo(() => {
    if (!gpxTrack?.waypoints?.length || !showKmMarkers) return [];
    
    const markers = [];
    const waypoints = gpxTrack.waypoints;
    
    // Create a marker every kilometer
    for (let km = 1; km < Math.floor(gpxTrack.total_distance); km++) {
      // Find the waypoint closest to this km distance
      let closestWaypoint = waypoints[0];
      let minDiff = waypoints.length > 0 ? Math.abs(waypoints[0].distance - km) : Infinity;
      
      for (let i = 1; i < waypoints.length; i++) {
        const diff = Math.abs(waypoints[i].distance - km);
        if (diff < minDiff) {
          minDiff = diff;
          closestWaypoint = waypoints[i];
        }
      }
      
      markers.push({
        km: km,
        lat: closestWaypoint.lat,
        lng: closestWaypoint.lng,
        elevation: closestWaypoint.elevation
      });
    }
    
    return markers;
  }, [gpxTrack, showKmMarkers]);

  // Create km marker icon
  const createKmMarkerIcon = (km) => {
    const iconHtml = `
      <div style="position: relative; width: 28px; height: 28px;">
        <div style="
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          width: 24px;
          height: 24px;
          background-color: #ffffff;
          border-radius: 50%;
          border: 2px solid #3b82f6;
          box-shadow: 0 2px 4px rgba(0,0,0,0.3);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 10px;
          font-weight: bold;
          color: #3b82f6;
        ">${km}</div>
      </div>
    `;

    return L.divIcon({
      html: iconHtml,
      className: '',
      iconSize: [28, 28],
      iconAnchor: [14, 14],
    });
  };

  // Generate route arrows from GPX track
  const routeArrows = useMemo(() => {
    if (!gpxTrack?.waypoints?.length || !showRouteArrows) return [];
    
    const arrows = [];
    const waypoints = gpxTrack.waypoints;
    const totalDistance = gpxTrack.total_distance;
    
    // Create arrows every 2km (or based on route length)
    // Ensure arrowInterval is at least 0.5km and at most 3km, or a fraction for shorter tracks
    const arrowInterval = Math.max(0.5, Math.min(3, totalDistance / 10)); 
    
    // Start arrows from the first interval, not at Km 0
    for (let currentKm = arrowInterval; currentKm < totalDistance; currentKm += arrowInterval) {
      // Find waypoint closest to this km mark
      let closestIndex = 0;
      let minDiff = waypoints.length > 0 ? Math.abs(waypoints[0].distance - currentKm) : Infinity;
      
      for (let i = 1; i < waypoints.length; i++) {
        const diff = Math.abs(waypoints[i].distance - currentKm);
        if (diff < minDiff) {
          minDiff = diff;
          closestIndex = i;
        }
      }
      
      // Get bearing from current waypoint to next waypoint for arrow direction
      // Ensure there is a 'next' waypoint to calculate bearing
      if (closestIndex < waypoints.length - 1) {
        const current = waypoints[closestIndex];
        const next = waypoints[closestIndex + 1];
        // Ensure valid coordinates for bearing calculation
        if (current.lat && current.lng && next.lat && next.lng) {
          const bearing = calculateBearing(current.lat, current.lng, next.lat, next.lng);
          
          arrows.push({
            km: currentKm,
            lat: current.lat,
            lng: current.lng,
            bearing: bearing
          });
        }
      }
    }
    
    return arrows;
  }, [gpxTrack, showRouteArrows]);

  // OPTIMIZED: Generate wind markers along the route efficiently
  const windMarkers = useMemo(() => {
    if (!windData || !gpxTrack?.waypoints?.length || !showWindArrows) {
      return [];
    }
    
    const markers = [];
    const waypoints = gpxTrack.waypoints;
    const totalDistance = gpxTrack.total_distance;

    const windInterval = Math.max(2, totalDistance / 8); 
    let nextMarkerKm = windInterval;
    let side = 1; 

    for (let i = 0; i < waypoints.length - 1; i++) {
        const p1 = waypoints[i];
        
        if (p1.distance >= nextMarkerKm) {
            const p2 = waypoints[i + 1];
            const segmentBearing = calculateBearing(p1.lat, p1.lng, p2.lat, p2.lng);
            
            // Calculate offset position to the side of the track
            const offsetPosition = calculateOffsetPosition(p1.lat, p1.lng, segmentBearing + (90 * side), 50); // 50 meters offset

            markers.push({
                id: `wind-${p1.distance.toFixed(1)}-${Date.now()}-${i}`,
                lat: offsetPosition.lat,
                lng: offsetPosition.lng,
                speedKmh: windData.speedKmh,
                direction: windData.direction,
                location: `Km ${p1.distance.toFixed(1)}`
            });
            
            nextMarkerKm += windInterval;
            side *= -1; // Alternate side for the next marker
        }
    }
    
    return markers;
  }, [windData, gpxTrack, showWindArrows]);

  // Get valid runners with coordinates
  const validRunners = runners.filter(runner => 
    runner.latitude !== undefined && 
    runner.latitude !== null && 
    runner.longitude !== undefined && 
    runner.longitude !== null &&
    !isNaN(runner.latitude) &&
    !isNaN(runner.longitude)
  );

  // Process POIs to handle overlapping positions
  const processedPois = useMemo(() => {
    if (!showPois || !pois || pois.length === 0) return [];
    
    // Filter POIs for this track (assuming gpx_track_id is optional)
    const trackPois = pois.filter((poi) => 
      !poi.gpx_track_id || poi.gpx_track_id === gpxTrack?.id
    );
    
    // Group and offset nearby POIs
    return groupAndOffsetPois(trackPois);
  }, [showPois, pois, gpxTrack?.id]);
  
  // IMPROVED: Rain radar showing precipitation in yellow/orange colors
  useEffect(() => {
    if (!map || !isMapReady) {
      console.log("🌧️ Rain radar skipped: map not ready");
      return;
    }

    console.log("🌧️ Rain radar effect running, showRainRadar:", showRainRadar);

    // Clean up existing rain radar layer
    if (rainRadarLayerRef.current) {
      console.log("🌧️ Removing existing rain layer");
      try {
        map.removeLayer(rainRadarLayerRef.current);
      } catch (e) {
        console.warn("Error removing rain radar layer:", e.message || e);
      }
      rainRadarLayerRef.current = null;
    }

    if (!showRainRadar) {
      console.log("🌧️ Rain radar is OFF");
      setRainRadarError(null);
      return;
    }

    console.log("🌧️ Rain radar is ON - starting to load...");
    setRainRadarError(null);

    // Create a dedicated pane for rain radar if it doesn't exist
    if (!map.getPane('rainRadarPane')) {
      console.log("🌧️ Creating rain radar pane");
      const rainPane = map.createPane('rainRadarPane');
      rainPane.style.zIndex = 1000; // VERY HIGH: Just below popups
      rainPane.style.pointerEvents = 'none';
    }

    // Invoke function to get API key
    console.log("🌧️ Fetching OpenWeather API key...");
    base44.functions.invoke('getOpenWeatherApiKey')
      .then(response => {
        console.log("🌧️ API key response received");
        const data = response.data;
        
        if (!data || !data.apiKey) {
          throw new Error("No API key in response");
        }

        const apiKey = data.apiKey;
        console.log("✅ OpenWeatherMap API key obtained successfully");

        // Use PRECIPITATION layer which shows rain in yellow/orange colors
        const precipitationUrl = `https://tile.openweathermap.org/map/precipitation_new/{z}/{x}/{y}.png?appid=${apiKey}`;
        
        console.log("🌧️ Creating precipitation tile layer...");

        rainRadarLayerRef.current = L.tileLayer(precipitationUrl, {
          pane: 'rainRadarPane',
          opacity: 0.8, // High opacity for good visibility
          maxZoom: 18,
          minZoom: 1,
          tileSize: 256,
          className: 'rain-radar-tiles' // Add class for CSS styling
        });

        // Add event listeners for debugging
        let tilesLoaded = 0;
        let tilesError = 0;

        rainRadarLayerRef.current.on('tileloadstart', () => {
          console.log('🌧️ Precipitation tile loading started');
        });

        rainRadarLayerRef.current.on('tileload', (e) => {
          tilesLoaded++;
          console.log(`✅ Precipitation tile loaded (${tilesLoaded} total)`);
        });

        rainRadarLayerRef.current.on('tileerror', (e) => {
          tilesError++;
          console.warn(`❌ Precipitation tile error (${tilesError} total)`);
        });

        rainRadarLayerRef.current.on('load', () => {
          console.log('✅ All precipitation tiles loaded successfully');
        });

        console.log("🌧️ Adding layer to map...");
        rainRadarLayerRef.current.addTo(map);
        console.log("✅ Rain radar layer added to map");
        
        // Force map refresh immediately
        map.invalidateSize();
        
        // Try panning slightly to trigger tile loading
        setTimeout(() => {
          if (map) {
            const center = map.getCenter();
            console.log(`📍 Current map center: [${center.lat.toFixed(4)}, ${center.lng.toFixed(4)}], zoom: ${map.getZoom()}`);
            
            // Force a small pan to trigger tile loading
            map.panBy([1, 1]);
            setTimeout(() => map.panBy([-1, -1]), 100);
          }
        }, 500);

        setTimeout(() => {
          console.log(`📊 Final tiles status: ${tilesLoaded} loaded, ${tilesError} errors`);
        }, 3000);

        setRainRadarError(null);
      })
      .catch(error => {
        console.error("❌ Error loading precipitation layer:", error);
        console.error("  - Error message:", error.message);
        console.error("  - Error response:", error.response?.data);
        setRainRadarError(`Error: ${error.message || 'No se pudo cargar la capa'}`);
      });

    return () => {
      console.log("🌧️ Cleaning up rain radar");
      if (rainRadarLayerRef.current && map) {
        try {
          map.removeLayer(rainRadarLayerRef.current);
        } catch (e) {
          // Ignore
        }
        rainRadarLayerRef.current = null;
      }
      setRainRadarError(null);
    };
  }, [map, isMapReady, showRainRadar]);


  return (
    <div className="w-full h-full relative">
      {/* Add CSS for rain radar tiles - emphasizing yellow tones */}
      <style>{`
        .rain-radar-tiles {
          filter: brightness(1.3) contrast(1.4) saturate(1.8) hue-rotate(-10deg) !important;
          mix-blend-mode: screen !important;
        }
        .leaflet-pane.leaflet-rainRadarPane {
          z-index: 1000 !important;
        }
      `}</style>

      {/* Rain radar error indicator */}
      {showRainRadar && rainRadarError && (
        <div className="absolute top-2 left-2 z-[1000] bg-red-500 text-white px-3 py-1 rounded-lg text-xs shadow-lg">
          {rainRadarError}
        </div>
      )}
      
      {/* Rain radar active indicator */}
      {showRainRadar && !rainRadarError && (
        <div className="absolute top-2 left-2 z-[1000] bg-yellow-500 text-slate-900 px-4 py-2 rounded-lg text-sm shadow-xl flex items-center gap-2 font-semibold">
          <CloudRain className="w-4 h-4" />
          <span>Radar de Lluvia Activo</span>
        </div>
      )}

      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="w-full h-full"
        style={{
          transform: `rotate(${rotation}deg)`,
          transformOrigin: 'center center',
          transition: 'transform 0.3s ease-out',
        }}
      >
        <MapContainer
          ref={mapRef}
          center={center}
          zoom={10}
          style={{ height: "100%", width: "100%", borderRadius: '12px' }}
          onClick={onMapClick}
          zoomControl={false}
          whenReady={(mapInstance) => {
            setMap(mapInstance.target);
            setIsMapReady(true);
            if (onMapReady) {
              onMapReady(mapInstance.target);
            }
          }}
        >
          <InitialBoundsFitter gpxTrack={gpxTrack} />
          
          <MapEvents 
            followUser={followUser}
            currentPosition={currentPosition}
            onMapInteraction={onMapInteraction}
            mapOrientation={mapOrientation}
            heading={currentPosition?.heading}
            onMapViewChange={onMapViewChange}
          />
          <StreetViewControl map={mapInstance?.target} gpxTrack={gpxTrack} onStreetViewOpen={onStreetViewOpen} />

          <TileLayer
            key={mapType}
            url={mapLayers[mapType].url}
            attribution={mapLayers[mapType].attribution}
            eventHandlers={{
              tileload: () => {
                // Wait for actual imagery and two paint frames, not a fixed delay.
                requestAnimationFrame(() => requestAnimationFrame(() => onMapVisible?.()));
              }
            }}
          />
          
          {/* GPX Track - now with a border effect */}
          {gpxTrack?.waypoints?.length > 0 && (
            <>
              {/* Background polyline (the "border") */}
              <Polyline
                positions={gpxTrack.waypoints.map(point => [point.lat, point.lng])}
                color="#3b82f6"
                weight={7}
                opacity={0.8}
              />
              {/* Foreground polyline (the main line) */}
              <Polyline
                positions={gpxTrack.waypoints.map(point => [point.lat, point.lng])}
                color="#ffffff"
                weight={3}
                opacity={0.9}
              />

              {/* Highlighted segment near Street View pegman */}
              {highlightSegment.length > 1 && (
                <Polyline
                  positions={highlightSegment}
                  color="#fbbf24"
                  weight={10}
                  opacity={0.9}
                />
              )}

              <Marker
                position={[gpxTrack.waypoints[0].lat, gpxTrack.waypoints[0].lng]}
                icon={startIcon}
              >
                <Popup>
                  <div className="text-center">
                    <strong>🚩 INICIO</strong><br />
                    Km 0.0
                  </div>
                </Popup>
              </Marker>

              <Marker
                position={[gpxTrack.waypoints[gpxTrack.waypoints.length - 1].lat, gpxTrack.waypoints[gpxTrack.waypoints.length - 1].lng]}
                icon={finishIcon}
              >
                <Popup>
                  <div className="text-center">
                    <strong>🏁 META</strong><br />
                    Km {gpxTrack.total_distance?.toFixed(1)}
                  </div>
                </Popup>
              </Marker>
            </>
          )}

          {/* Route Direction Arrows */}
          {routeArrows.map((arrow) => (
            <Marker
              key={`arrow-${arrow.km}`}
              position={[arrow.lat, arrow.lng]}
              icon={createRouteArrowIcon(arrow.bearing)}
            >
              <Popup>
                <div className="text-center">
                  <strong>Dirección</strong><br />
                  Km {arrow.km.toFixed(1)}
                </div>
              </Popup>
            </Marker>
          ))}

          {/* Km Markers */}
          {kmMarkers.map((marker) => (
            <Marker
              key={`km-${marker.km}`}
              position={[marker.lat, marker.lng]}
              icon={createKmMarkerIcon(marker.km)}
            >
              <Popup>
                <div className="text-center">
                  <strong>Km {marker.km}</strong><br />
                  Elevación: {marker.elevation?.toFixed(0) || 0}m
                </div>
              </Popup>
            </Marker>
          ))}

          {/* POI Markers - NOW WITH ANTI-OVERLAP */}
          {processedPois.map((poi) => {
            const poiType = poiTypes.find((pt) => pt.id === poi.poi_type_id);
            if (!poi.latitude || !poi.longitude) return null;

            // Use offset position if available
            const markerLat = poi.offsetLat !== undefined ? poi.offsetLat : poi.latitude;
            const markerLng = poi.offsetLng !== undefined ? poi.offsetLng : poi.longitude;

            return (
              <Marker
                key={`poi-map-${poi.id}`}
                position={[markerLat, markerLng]}
                icon={createPoiLeafletIcon(poiType)}
              >
                <Popup>
                  <div className="text-center">
                    <h4 className="font-bold">{poi.name || poiType?.name || 'Punto de Interés'}</h4>
                    {poi.description && <p>{poi.description}</p>}
                    <p className="text-sm text-slate-500 mt-1">
                      Km {(poi.distance_from_start / 1000).toFixed(1)}
                    </p>
                    {poi.isOffset && (
                      <p className="text-xs text-blue-500 mt-1">
                        📍 Desplazado para mejor visibilidad
                      </p>
                    )}
                  </div>
                </Popup>
              </Marker>
            );
          })}

          {/* Connection lines for offset POIs - OPTIONAL VISUAL ENHANCEMENT */}
          {processedPois
            .filter(poi => poi.isOffset && poi.groupSize > 1)
            .map((poi) => (
              <Polyline
                key={`poi-connection-${poi.id}`}
                positions={[
                  [poi.latitude, poi.longitude],
                  [poi.offsetLat, poi.offsetLng]
                ]}
                color="#94a3b8"
                weight={1}
                opacity={0.5}
                dashArray="2,4"
              />
            ))}
          
          {/* Current Position - Now using black circle icon */}
          {currentPosition && (
            <Marker
              position={[currentPosition.lat, currentPosition.lng]}
              icon={createCurrentPositionIcon()}
            >
              <Popup>
                <div className="text-center">
                  <strong>Tu Ubicación</strong><br />
                  Km {(currentPosition.distance / 1000)?.toFixed(1) || 0}<br />
                  Elevación: {currentPosition.elevation?.toFixed(0) || 0}m
                </div>
              </Popup>
            </Marker>
          )}

          {/* Wind Markers - FIXED: Now properly regenerates */}
          {windMarkers.map((marker) => (
            <Marker
              key={marker.id}
              position={[marker.lat, marker.lng]}
              icon={createWindArrowIcon(marker.speedKmh, marker.direction)}
            >
              <Popup>
                <div className="text-center">
                  <strong className="text-base">Viento en {marker.location}</strong><br />
                  <span style={{color: getWindColor(marker.speedKmh)}}>
                    {marker.speedKmh} km/h
                  </span>
                  <br />
                  Dirección: {marker.direction.toFixed(0)}°
                </div>
              </Popup>
            </Marker>
          ))}

          {/* Runners Markers - MODIFICADO para no incluir el punto ya seleccionado */}
          {validRunners
            .filter(runner => runner.id !== selectedPoint?.id)
            .map((runner, index) => {
            return (
              <Marker
                key={`runner-${runner.id}-${index}`}
                position={[runner.latitude, runner.longitude]}
                icon={createRunnerIcon(runner.color, runner.is_online)}
              >
                <Popup>
                  <div className="text-center">
                    <strong style={{color: runner.color}}>{runner.device_name || runner.user_name}</strong><br />
                    {runner.user_name && (
                      <>👤 Corredor: {runner.user_name}<br /></>
                    )}
                    Velocidad: {runner.speed?.toFixed(0) || 0} km/h<br />
                    Elevación: {runner.elevation?.toFixed(0) || 0}m<br />
                    {runner.battery_level !== null && runner.battery_level !== undefined && (
                      <>🔋 Batería: {runner.battery_level}%<br /></>
                    )}
                    Estado: {runner.is_online ? 'En línea' : 'Desconectado'}
                  </div>
                </Popup>
              </Marker>
            );
          })}

          {/* Selected Point */}
          {selectedPoint && (
            <Marker
              position={[selectedPoint.lat, selectedPoint.lng]}
              icon={new L.Icon({
                iconUrl: "data:image/svg+xml;base64," + btoa(`
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#f59e0b" width="32" height="32">
                    <circle cx="12" cy="12" r="8" fill="#f59e0b" stroke="white" stroke-width="2"/>
                  </svg>
                `),
                iconSize: [24, 24],
                iconAnchor: [12, 12],
              })}
            >
              <Popup>
                <div className="text-center">
                  <strong className="text-base">{selectedPoint.runner?.device_name || selectedPoint.name || 'Dispositivo GPS'}</strong>
                  {selectedPoint.runner && (
                    <>
                      <br />👤 {selectedPoint.runner.user_name}
                      <br />🏎️ {Math.round(selectedPoint.runner.speed)} km/h
                      <br />⛰️ {Math.round(selectedPoint.runner.elevation)}m
                    </>
                  )}
                </div>
              </Popup>
            </Marker>
          )}

        </MapContainer>
      </motion.div>
    </div>
  );
}

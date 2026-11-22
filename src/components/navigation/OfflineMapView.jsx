import { useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import { Protocol } from 'pmtiles';
import 'maplibre-gl/dist/maplibre-gl.css';

// Isolated offline renderer. It is deliberately opt-in until a validated
// PMTiles package for the current route has been downloaded to the device.
export default function OfflineMapView({ styleUrl, center, zoom = 10, onReady }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current || !styleUrl) return undefined;
    const protocol = new Protocol();
    maplibregl.addProtocol('pmtiles', protocol.tile);
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: styleUrl,
      center: center || [0, 0],
      zoom,
      attributionControl: true,
    });
    map.addControl(new maplibregl.NavigationControl({ showCompass: true }), 'top-right');
    map.once('load', () => onReady?.(map));
    mapRef.current = map;
    return () => {
      map.remove();
      maplibregl.removeProtocol('pmtiles');
      mapRef.current = null;
    };
  }, [styleUrl, zoom, onReady]);

  return <div ref={containerRef} className="absolute inset-0 h-full w-full" aria-label="Mapa offline" />;
}

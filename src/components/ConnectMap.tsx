import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import mapboxgl, { type StyleSpecification } from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { MapPin, X } from 'lucide-react';
import './ConnectMap.css';

export interface MapItem {
  id: string;
  lat: number;
  lng: number;
  title: string;
  subtitle?: string;
  image?: string;
  to?: string;
  kind: 'event' | 'place' | 'job';
}

type MapProvider = 'mapbox' | 'maplibre';
type Coordinate = [number, number];
type MapMarker = mapboxgl.Marker | maplibregl.Marker;

const MAPBOX_PUBLIC_TOKEN = (import.meta.env.VITE_MAPBOX_PUBLIC_TOKEN ?? '').trim();
const MAPLIBRE_STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty';
const DEFAULT_CENTER: Coordinate = [-98.5, 39.8];

function getPreferredDarkMode(): boolean {
  return (
    typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches
  );
}

function createConnectMapStyle(darkMode: boolean): StyleSpecification {
  const labelColor = darkMode ? '#e3ecee' : '#53676d';
  const labelHalo = darkMode ? 'rgba(74,88,94,0.94)' : 'rgba(245,249,250,0.98)';
  const subduedLabelColor = darkMode ? '#c5d2d6' : '#687d84';
  const subduedLabelHalo = darkMode ? 'rgba(86,99,104,0.92)' : 'rgba(248,251,252,0.98)';

  return {
    version: 8,
    name: darkMode ? 'ConnectPortalDark' : 'ConnectPortalLight',
    glyphs: 'mapbox://fonts/mapbox/{fontstack}/{range}.pbf',
    sources: {
      composite: {
        type: 'vector',
        url: 'mapbox://mapbox.mapbox-streets-v8',
      },
    },
    layers: [
      {
        id: 'background',
        type: 'background',
        paint: {
          'background-color': darkMode ? '#5a6971' : '#edf3f4',
        },
      },
      {
        id: 'landuse',
        type: 'fill',
        source: 'composite',
        'source-layer': 'landuse',
        paint: {
          'fill-color': darkMode ? '#66767c' : '#dfe7ea',
          'fill-opacity': darkMode ? 0.28 : 0.34,
        },
      },
      {
        id: 'water',
        type: 'fill',
        source: 'composite',
        'source-layer': 'water',
        paint: {
          'fill-color': darkMode ? '#51616a' : '#d7e3e8',
          'fill-opacity': 0.92,
        },
      },
      {
        id: 'admin',
        type: 'line',
        source: 'composite',
        'source-layer': 'admin',
        paint: {
          'line-color': darkMode ? '#8a989d' : '#bfcad0',
          'line-opacity': darkMode ? 0.14 : 0.18,
          'line-width': 1,
        },
      },
      {
        id: 'roads',
        type: 'line',
        source: 'composite',
        'source-layer': 'road',
        paint: {
          'line-color': darkMode ? '#97a5aa' : '#b5c3c8',
          'line-opacity': darkMode ? 0.2 : 0.28,
          'line-width': ['interpolate', ['linear'], ['zoom'], 9, 0.6, 13, 1.1, 16, 2.1],
        },
      },
      {
        id: 'roads-major',
        type: 'line',
        source: 'composite',
        'source-layer': 'road',
        filter: ['match', ['get', 'class'], ['motorway', 'trunk', 'primary'], true, false],
        paint: {
          'line-color': darkMode ? '#b0bcc0' : '#9dadb4',
          'line-opacity': darkMode ? 0.24 : 0.32,
          'line-width': ['interpolate', ['linear'], ['zoom'], 9, 1, 13, 1.8, 16, 3],
        },
      },
      {
        id: 'building',
        type: 'fill',
        source: 'composite',
        'source-layer': 'building',
        minzoom: 13,
        paint: {
          'fill-color': darkMode ? '#758489' : '#c9d4d8',
          'fill-opacity': darkMode ? 0.14 : 0.18,
        },
      },
      {
        id: 'poi-dots',
        type: 'circle',
        source: 'composite',
        'source-layer': 'poi_label',
        minzoom: 11,
        paint: {
          'circle-color': darkMode ? '#53d7df' : '#65ccd4',
          'circle-opacity': darkMode ? 0.4 : 0.22,
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 10, 0.8, 14, 1.4],
        },
      },
      {
        id: 'road-labels',
        type: 'symbol',
        source: 'composite',
        'source-layer': 'road',
        minzoom: 12,
        filter: ['all', ['has', 'name']],
        layout: {
          'symbol-placement': 'line',
          'text-field': ['coalesce', ['get', 'name_en'], ['get', 'name']],
          'text-font': ['DIN Pro Medium', 'Arial Unicode MS Regular'],
          'text-size': ['interpolate', ['linear'], ['zoom'], 12, 10, 16, 14],
          'symbol-spacing': 280,
        },
        paint: {
          'text-color': subduedLabelColor,
          'text-halo-color': subduedLabelHalo,
          'text-halo-width': 1.4,
          'text-opacity': 0.88,
        },
      },
      {
        id: 'settlement-labels',
        type: 'symbol',
        source: 'composite',
        'source-layer': 'place_label',
        minzoom: 5,
        filter: ['match', ['get', 'class'], ['settlement'], true, false],
        layout: {
          'text-field': ['coalesce', ['get', 'name_en'], ['get', 'name']],
          'text-font': ['DIN Pro Bold', 'Arial Unicode MS Regular'],
          'text-size': ['interpolate', ['linear'], ['zoom'], 5, 12, 10, 18],
          'text-letter-spacing': 0.02,
        },
        paint: {
          'text-color': labelColor,
          'text-halo-color': labelHalo,
          'text-halo-width': 1.8,
          'text-opacity': 0.96,
        },
      },
      {
        id: 'state-labels',
        type: 'symbol',
        source: 'composite',
        'source-layer': 'place_label',
        minzoom: 4,
        filter: ['match', ['get', 'class'], ['state', 'province'], true, false],
        layout: {
          'text-field': ['coalesce', ['get', 'name_en'], ['get', 'name']],
          'text-font': ['DIN Pro Medium', 'Arial Unicode MS Regular'],
          'text-size': ['interpolate', ['linear'], ['zoom'], 4, 11, 8, 14],
          'text-transform': 'uppercase',
          'text-letter-spacing': 0.18,
        },
        paint: {
          'text-color': subduedLabelColor,
          'text-halo-color': subduedLabelHalo,
          'text-halo-width': 1.5,
          'text-opacity': 0.84,
        },
      },
    ],
  } as StyleSpecification;
}

function createMarkerElement(item: MapItem, onSelect: (event: MouseEvent) => void) {
  const el = document.createElement('button');
  el.type = 'button';
  el.className = `cmap-pin cmap-pin--${item.kind}`;
  el.setAttribute('aria-label', item.title);
  el.addEventListener('click', onSelect);
  return el;
}

export function ConnectMap({ items }: { items: MapItem[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapboxMapRef = useRef<mapboxgl.Map | null>(null);
  const maplibreMapRef = useRef<maplibregl.Map | null>(null);
  const providerRef = useRef<MapProvider | null>(null);
  const markersRef = useRef<MapMarker[]>([]);
  const styleModeRef = useRef<boolean | null>(null);
  const [selected, setSelected] = useState<MapItem | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const onColorSchemeChange = (event: MediaQueryListEvent) => {
      const nextDarkMode = event.matches;
      const map = mapboxMapRef.current;
      if (providerRef.current !== 'mapbox' || !map || styleModeRef.current === nextDarkMode) {
        return;
      }
      map.setStyle(createConnectMapStyle(nextDarkMode));
      styleModeRef.current = nextDarkMode;
    };
    media.addEventListener('change', onColorSchemeChange);
    return () => media.removeEventListener('change', onColorSchemeChange);
  }, []);

  // Initialize the map once. Mapbox is preferred, but preview environments
  // without a public token keep the existing token-free OpenFreeMap fallback.
  useEffect(() => {
    if (!containerRef.current || providerRef.current) return;

    const onMapClick = () => setSelected(null);
    const initialDarkMode = getPreferredDarkMode();
    let provider: MapProvider = 'maplibre';

    if (MAPBOX_PUBLIC_TOKEN) {
      try {
        mapboxgl.accessToken = MAPBOX_PUBLIC_TOKEN;
        const map = new mapboxgl.Map({
          container: containerRef.current,
          style: createConnectMapStyle(initialDarkMode),
          center: DEFAULT_CENTER,
          zoom: 3.2,
          attributionControl: true,
          dragRotate: false,
          touchPitch: false,
        });
        map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'top-right');
        map.on('click', onMapClick);
        mapboxMapRef.current = map;
        provider = 'mapbox';
        styleModeRef.current = initialDarkMode;
      } catch {
        mapboxMapRef.current = null;
      }
    }

    if (provider !== 'mapbox') {
      const map = new maplibregl.Map({
        container: containerRef.current,
        style: MAPLIBRE_STYLE_URL,
        center: DEFAULT_CENTER,
        zoom: 3.2,
        attributionControl: { compact: true },
        dragRotate: false,
        touchPitch: false,
      });
      map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
      map.on('click', onMapClick);
      maplibreMapRef.current = map;
    }

    providerRef.current = provider;

    return () => {
      if (provider === 'mapbox') {
        mapboxMapRef.current?.off('click', onMapClick);
        mapboxMapRef.current?.remove();
        mapboxMapRef.current = null;
      } else {
        maplibreMapRef.current?.off('click', onMapClick);
        maplibreMapRef.current?.remove();
        maplibreMapRef.current = null;
      }
      providerRef.current = null;
      styleModeRef.current = null;
    };
  }, []);

  // Sync markers whenever items change.
  useEffect(() => {
    const provider = providerRef.current;
    if (!provider) return;

    const previousMarkers = markersRef.current;
    markersRef.current = [];
    previousMarkers.forEach((marker) => marker.remove());

    const nextMarkers: MapMarker[] = [];
    const cleanups: Array<() => void> = [];

    if (provider === 'mapbox') {
      const map = mapboxMapRef.current;
      if (!map) return;

      const bounds = new mapboxgl.LngLatBounds();
      items.forEach((item) => {
        const coordinate: Coordinate = [item.lng, item.lat];
        const onMarkerClick = (event: MouseEvent) => {
          event.stopPropagation();
          setSelected(item);
          map.flyTo({ center: coordinate, zoom: Math.max(map.getZoom(), 11), duration: 500 });
        };
        const el = createMarkerElement(item, onMarkerClick);
        cleanups.push(() => el.removeEventListener('click', onMarkerClick));
        const marker = new mapboxgl.Marker({ element: el }).setLngLat(coordinate).addTo(map);
        nextMarkers.push(marker);
        bounds.extend(coordinate);
      });

      if (items.length === 1) {
        map.jumpTo({ center: [items[0].lng, items[0].lat], zoom: 11 });
      } else if (!bounds.isEmpty()) {
        map.fitBounds(bounds, { padding: 64, maxZoom: 12, duration: 500 });
      }
    } else {
      const map = maplibreMapRef.current;
      if (!map) return;

      const bounds = new maplibregl.LngLatBounds();
      items.forEach((item) => {
        const coordinate: Coordinate = [item.lng, item.lat];
        const onMarkerClick = (event: MouseEvent) => {
          event.stopPropagation();
          setSelected(item);
          map.flyTo({ center: coordinate, zoom: Math.max(map.getZoom(), 11), duration: 500 });
        };
        const el = createMarkerElement(item, onMarkerClick);
        cleanups.push(() => el.removeEventListener('click', onMarkerClick));
        const marker = new maplibregl.Marker({ element: el }).setLngLat(coordinate).addTo(map);
        nextMarkers.push(marker);
        bounds.extend(coordinate);
      });

      if (items.length === 1) {
        map.jumpTo({ center: [items[0].lng, items[0].lat], zoom: 11 });
      } else if (!bounds.isEmpty()) {
        map.fitBounds(bounds, { padding: 64, maxZoom: 12, duration: 500 });
      }
    }

    markersRef.current = nextMarkers;

    return () => {
      cleanups.forEach((cleanup) => cleanup());
      nextMarkers.forEach((marker) => marker.remove());
      markersRef.current = [];
    };
  }, [items]);

  return (
    <div className="cmap">
      <div ref={containerRef} className="cmap__canvas" />

      {items.length === 0 ? (
        <div className="cmap__empty">
          <MapPin size={22} />
          <span>No mapped locations for this filter yet.</span>
        </div>
      ) : null}

      {selected ? (
        <div className="cmap__card card">
          {selected.image ? <img className="cmap__card-img" src={selected.image} alt="" /> : null}
          <div className="cmap__card-body">
            <strong>{selected.title}</strong>
            {selected.subtitle ? <span>{selected.subtitle}</span> : null}
            {selected.to ? (
              <Link to={selected.to} className="btn btn--brand btn--sm">
                View details
              </Link>
            ) : null}
          </div>
          <button
            type="button"
            className="cmap__card-close"
            onClick={() => setSelected(null)}
            aria-label="Close"
          >
            <X size={14} aria-hidden="true" />
          </button>
        </div>
      ) : null}
    </div>
  );
}

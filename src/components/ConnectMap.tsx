import { useCallback, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import type {
  Map as MapboxMap,
  Marker as MapboxMarker,
  StyleSpecification,
} from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import type { Map as MapLibreMap, Marker as MapLibreMarker } from 'maplibre-gl';
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
type MapboxLib = typeof import('mapbox-gl').default;
type MapLibreLib = typeof import('maplibre-gl');
type MapMarker = MapboxMarker | MapLibreMarker;

const MAPBOX_PUBLIC_TOKEN = (import.meta.env.VITE_MAPBOX_PUBLIC_TOKEN ?? '').trim();
const MAPLIBRE_STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty';
const DEFAULT_CENTER: Coordinate = [-98.5, 39.8];
// If a provider neither fires `load` nor `error` within this window, treat it as
// failed so the map never hangs on "Loading map...".
const MAP_LOAD_TIMEOUT_MS = 8000;

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

// Per-kind fallback glyphs (lucide paths) shown inside the pin when an item has
// no image — mirrors the mobile marker icons (calendar / heart-handshake / pin).
const PIN_ICONS: Record<MapItem['kind'], string> = {
  event:
    '<path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/><path d="M8 14h.01"/><path d="M12 14h.01"/><path d="M16 14h.01"/><path d="M8 18h.01"/><path d="M12 18h.01"/><path d="M16 18h.01"/>',
  job: '<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/><path d="M12 5 9.04 7.96a2.17 2.17 0 0 0 0 3.08c.82.82 2.13.85 3 .07l2.07-1.9a2.82 2.82 0 0 1 3.79 0l2.96 2.66"/><path d="m18 15-2-2"/><path d="m15 18-2-2"/>',
  place:
    '<path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/><circle cx="12" cy="10" r="3"/>',
};

function iconSvg(kind: MapItem['kind']): string {
  return `<svg viewBox="0 0 24 24" aria-hidden="true">${PIN_ICONS[kind]}</svg>`;
}

function createMarkerElement(item: MapItem, onSelect: (event: MouseEvent) => void) {
  const el = document.createElement('button');
  el.type = 'button';
  el.className = `cmap-pin cmap-pin--${item.kind}${item.image ? ' cmap-pin--photo' : ''}`;
  el.setAttribute('aria-label', item.title);

  // The map library writes an inline `transform` to `el` every frame to position
  // it. All hover/selected/entrance transforms live on this inner wrapper so they
  // never fight the library's positioning (which would make pins drift on zoom).
  const inner = document.createElement('span');
  inner.className = 'cmap-pin__inner';

  const tail = document.createElement('span');
  tail.className = 'cmap-pin__tail';

  const head = document.createElement('span');
  head.className = 'cmap-pin__head';
  if (item.image) {
    const img = document.createElement('img');
    img.className = 'cmap-pin__img';
    img.src = item.image;
    img.alt = '';
    img.loading = 'lazy';
    // If the thumbnail 404s, drop back to the kind glyph so we never show a broken pin.
    img.addEventListener('error', () => {
      el.classList.remove('cmap-pin--photo');
      head.innerHTML = iconSvg(item.kind);
    });
    head.appendChild(img);
  } else {
    head.innerHTML = iconSvg(item.kind);
  }

  inner.append(tail, head);
  el.append(inner);
  el.addEventListener('click', onSelect);
  return el;
}

export function ConnectMap({ items }: { items: MapItem[] }) {
  const mapboxLibRef = useRef<MapboxLib | null>(null);
  const maplibreLibRef = useRef<MapLibreLib | null>(null);
  const mapboxMapRef = useRef<MapboxMap | null>(null);
  const maplibreMapRef = useRef<MapLibreMap | null>(null);
  const providerRef = useRef<MapProvider | null>(null);
  const markersRef = useRef<MapMarker[]>([]);
  const styleModeRef = useRef<boolean | null>(null);
  const mapCleanupRef = useRef<(() => void) | null>(null);
  const markerCleanupRef = useRef<(() => void) | null>(null);
  const [selected, setSelected] = useState<MapItem | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [error, setError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const handleRetry = () => {
    providerRef.current = null;
    setError(false);
    setMapReady(false);
    setReloadKey((key) => key + 1);
  };

  const canvasRef = useCallback((container: HTMLDivElement | null) => {
    mapCleanupRef.current?.();
    mapCleanupRef.current = null;
    if (!container || providerRef.current) return;
    const mapContainer = container;
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

    const onMapClick = () => {
      markersRef.current.forEach((m) => m.getElement().classList.remove('cmap-pin--selected'));
      setSelected(null);
    };
    const initialDarkMode = getPreferredDarkMode();
    let cancelled = false;
    let settled = false;
    let watchdog: ReturnType<typeof setTimeout> | undefined;
    let providerCleanup: (() => void) | undefined;

    const clearWatchdog = () => {
      if (watchdog) {
        clearTimeout(watchdog);
        watchdog = undefined;
      }
    };

    const markReady = () => {
      if (cancelled || settled) return;
      settled = true;
      clearWatchdog();
      setMapReady(true);
    };

    const markError = (reason: unknown) => {
      if (cancelled || settled) return;
      settled = true;
      clearWatchdog();
      console.warn('[ConnectMap] map failed to load', reason);
      setError(true);
    };

    const teardownMapbox = () => {
      const map = mapboxMapRef.current;
      if (map) {
        map.off('click', onMapClick);
        map.remove();
      }
      mapboxMapRef.current = null;
      mapboxLibRef.current = null;
      if (providerRef.current === 'mapbox') providerRef.current = null;
      styleModeRef.current = null;
    };

    // Token-free fallback. Wrapped in try/catch so a constructor/import failure
    // surfaces an error state instead of leaving the map stuck loading.
    async function tryMapLibre() {
      try {
        const maplibregl = await import('maplibre-gl');
        if (cancelled) return;
        maplibreLibRef.current = maplibregl;
        const map = new maplibregl.Map({
          container: mapContainer,
          style: MAPLIBRE_STYLE_URL,
          center: DEFAULT_CENTER,
          zoom: 3.2,
          attributionControl: { compact: true },
          dragRotate: false,
          touchPitch: false,
        });
        map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
        map.on('click', onMapClick);
        map.on('load', markReady);
        map.on('error', (event) => console.warn('[ConnectMap] maplibre error', event.error));
        maplibreMapRef.current = map;
        providerRef.current = 'maplibre';
        providerCleanup = () => {
          map.off('click', onMapClick);
          map.remove();
          maplibreMapRef.current = null;
          maplibreLibRef.current = null;
          if (providerRef.current === 'maplibre') providerRef.current = null;
        };
      } catch (reason) {
        markError(reason);
      }
    }

    // Returns true when Mapbox took ownership of init (success path is resolved
    // asynchronously via its `load`/`error` handlers), false when the caller
    // should fall back to MapLibre.
    async function tryMapbox(): Promise<boolean> {
      if (!MAPBOX_PUBLIC_TOKEN) return false;
      try {
        const mapboxgl = (await import('mapbox-gl')).default;
        if (cancelled) return true;
        mapboxLibRef.current = mapboxgl;
        mapboxgl.accessToken = MAPBOX_PUBLIC_TOKEN;
        const map = new mapboxgl.Map({
          container: mapContainer,
          style: createConnectMapStyle(initialDarkMode),
          center: DEFAULT_CENTER,
          zoom: 3.2,
          attributionControl: true,
          dragRotate: false,
          touchPitch: false,
        });
        map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'top-right');
        map.on('click', onMapClick);
        map.on('load', () => {
          styleModeRef.current = initialDarkMode;
          markReady();
        });
        // Invalid / origin-restricted tokens fire an async error (no throw) before
        // `load`. Tear Mapbox down and fall back to MapLibre rather than showing a
        // blank base map. Errors after a successful load (e.g. a single tile) are
        // ignored via the `settled` guard.
        map.on('error', (event) => {
          if (settled || cancelled) return;
          console.warn('[ConnectMap] mapbox error, falling back to MapLibre', event.error);
          teardownMapbox();
          void tryMapLibre();
        });
        mapboxMapRef.current = map;
        providerRef.current = 'mapbox';
        providerCleanup = () => teardownMapbox();
        return true;
      } catch (reason) {
        console.warn('[ConnectMap] mapbox init threw, falling back to MapLibre', reason);
        teardownMapbox();
        return false;
      }
    }

    const onWatchdog = () => {
      if (settled || cancelled) return;
      if (providerRef.current === 'mapbox') {
        console.warn('[ConnectMap] mapbox load timed out, falling back to MapLibre');
        teardownMapbox();
        watchdog = setTimeout(() => markError('maplibre load timeout'), MAP_LOAD_TIMEOUT_MS);
        void tryMapLibre();
      } else {
        markError('map load timeout');
      }
    };

    async function initMap() {
      watchdog = setTimeout(onWatchdog, MAP_LOAD_TIMEOUT_MS);
      const usedMapbox = await tryMapbox();
      if (cancelled || settled) return;
      if (!usedMapbox) await tryMapLibre();
    }

    void initMap();

    mapCleanupRef.current = () => {
      cancelled = true;
      clearWatchdog();
      media.removeEventListener('change', onColorSchemeChange);
      const previousMarkers = markersRef.current;
      markersRef.current = [];
      previousMarkers.forEach((marker) => marker.remove());
      providerCleanup?.();
    };
  }, []);

  // Sync markers whenever items change.
  const syncMarkersRef = useCallback((node: HTMLDivElement | null) => {
    markerCleanupRef.current?.();
    markerCleanupRef.current = null;
    if (!node) return;
    const provider = providerRef.current;
    if (!provider || !mapReady) return;

    const previousMarkers = markersRef.current;
    markersRef.current = [];
    previousMarkers.forEach((marker) => marker.remove());

    const nextMarkers: MapMarker[] = [];
    const cleanups: Array<() => void> = [];

    if (provider === 'mapbox') {
      const map = mapboxMapRef.current;
      const mapboxgl = mapboxLibRef.current;
      if (!map || !mapboxgl) return;

      const bounds = new mapboxgl.LngLatBounds();
      items.forEach((item) => {
        const coordinate: Coordinate = [item.lng, item.lat];
        const onMarkerClick = (event: MouseEvent) => {
          event.stopPropagation();
          markersRef.current.forEach((m) => m.getElement().classList.remove('cmap-pin--selected'));
          el.classList.add('cmap-pin--selected');
          setSelected(item);
          map.flyTo({ center: coordinate, zoom: Math.max(map.getZoom(), 11), duration: 500 });
        };
        const el = createMarkerElement(item, onMarkerClick);
        cleanups.push(() => el.removeEventListener('click', onMarkerClick));
        const marker = new mapboxgl.Marker({ element: el, anchor: 'bottom' })
          .setLngLat(coordinate)
          .addTo(map);
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
      const maplibregl = maplibreLibRef.current;
      if (!map || !maplibregl) return;

      const bounds = new maplibregl.LngLatBounds();
      items.forEach((item) => {
        const coordinate: Coordinate = [item.lng, item.lat];
        const onMarkerClick = (event: MouseEvent) => {
          event.stopPropagation();
          markersRef.current.forEach((m) => m.getElement().classList.remove('cmap-pin--selected'));
          el.classList.add('cmap-pin--selected');
          setSelected(item);
          map.flyTo({ center: coordinate, zoom: Math.max(map.getZoom(), 11), duration: 500 });
        };
        const el = createMarkerElement(item, onMarkerClick);
        cleanups.push(() => el.removeEventListener('click', onMarkerClick));
        const marker = new maplibregl.Marker({ element: el, anchor: 'bottom' })
          .setLngLat(coordinate)
          .addTo(map);
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

    markerCleanupRef.current = () => {
      cleanups.forEach((cleanup) => cleanup());
      nextMarkers.forEach((marker) => marker.remove());
      markersRef.current = [];
    };
  }, [items, mapReady]);

  return (
    <div className="cmap" ref={syncMarkersRef}>
      <div key={reloadKey} ref={canvasRef} className="cmap__canvas" />

      {error ? (
        <div className="cmap__empty">
          <MapPin size={22} />
          <span>Map couldn&rsquo;t load.</span>
          <button type="button" className="btn btn--outline btn--sm" onClick={handleRetry}>
            Retry
          </button>
        </div>
      ) : !mapReady ? (
        <div className="cmap__empty">
          <MapPin size={22} />
          <span>Loading map&hellip;</span>
        </div>
      ) : items.length === 0 ? (
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

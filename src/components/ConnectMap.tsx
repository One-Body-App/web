import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { MapPin } from 'lucide-react';
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

/** Free, token-free vector tiles. */
const STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty';

export function ConnectMap({ items }: { items: MapItem[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const [selected, setSelected] = useState<MapItem | null>(null);

  // Initialize the map once.
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: STYLE_URL,
      center: [-98.5, 39.8], // continental US fallback
      zoom: 3.2,
      attributionControl: { compact: true },
    });
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
    map.on('click', () => setSelected(null));
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Sync markers whenever items change.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    const bounds = new maplibregl.LngLatBounds();
    items.forEach((it) => {
      const el = document.createElement('button');
      el.type = 'button';
      el.className = `cmap-pin cmap-pin--${it.kind}`;
      el.setAttribute('aria-label', it.title);
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        setSelected(it);
        map.flyTo({ center: [it.lng, it.lat], zoom: Math.max(map.getZoom(), 11), duration: 500 });
      });
      const marker = new maplibregl.Marker({ element: el }).setLngLat([it.lng, it.lat]).addTo(map);
      markersRef.current.push(marker);
      bounds.extend([it.lng, it.lat]);
    });

    if (items.length === 1) {
      map.jumpTo({ center: [items[0].lng, items[0].lat], zoom: 11 });
    } else if (!bounds.isEmpty()) {
      map.fitBounds(bounds, { padding: 64, maxZoom: 12, duration: 500 });
    }
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
          <button className="cmap__card-close" onClick={() => setSelected(null)} aria-label="Close">
            ✕
          </button>
        </div>
      ) : null}
    </div>
  );
}

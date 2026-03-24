import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import FALLBACK_WORLD from '../services/worldMap';

import { FT_COLORS, ftColor } from '../services/ftConfig';
import { formatAllCoordinateTypes, formatD, formatDD, formatDMS, formatUTM } from '../utils/geo';
import type { AppLayer, GeoFeatureCollection, LngLatPoint, MapBounds } from '../types/domain';

// Continent fill colors
const CONTINENT_FILL = [
  'match', ['get', 'continent'],
  'North America', '#1b3a5c',
  'South America', '#1a4535',
  'Europe',        '#252060',
  'Asia',          '#3a2010',
  'Africa',        '#3a2810',
  'Oceania',       '#0e3040',
  '#1a2540',
];

function buildStyle(worldData: GeoFeatureCollection) {
  return {
    version: 8,
    name: 'GIS Offline',
    // NO glyphs URL — avoids any external request
    // Labels are rendered as HTML markers instead
    sources: {
      world: { type: 'geojson', data: worldData },
    },
    layers: [
      { id: 'bg',             type: 'background', paint: { 'background-color': '#08111e' } },
      { id: 'countries-fill', type: 'fill',       source: 'world', paint: { 'fill-color': CONTINENT_FILL, 'fill-opacity': 1 } },
      { id: 'countries-hover',type: 'fill',       source: 'world', paint: { 'fill-color': '#ffffff', 'fill-opacity': ['case', ['boolean', ['feature-state', 'hover'], false], 0.1, 0] } },
      { id: 'countries-line', type: 'line',       source: 'world', paint: { 'line-color': '#2a3f6a', 'line-width': 0.7 } },
    ],
  };
}

// Country label positions — rendered as offline HTML markers
const LABELS = [
  { he: 'ישראל',       en: 'Israel',        lon: 34.85, lat: 31.4,  minZoom: 2 },
  { he: 'רוסיה',       en: 'Russia',        lon: 97,    lat: 62,    minZoom: 1 },
  { he: 'קנדה',        en: 'Canada',        lon: -96,   lat: 60,    minZoom: 1 },
  { he: 'ארה"ב',       en: 'USA',           lon: -98,   lat: 38,    minZoom: 1 },
  { he: 'ברזיל',       en: 'Brazil',        lon: -52,   lat: -10,   minZoom: 1 },
  { he: 'אוסטרליה',    en: 'Australia',     lon: 134,   lat: -25,   minZoom: 1 },
  { he: 'סין',         en: 'China',         lon: 104,   lat: 35,    minZoom: 1 },
  { he: 'הודו',        en: 'India',         lon: 78,    lat: 22,    minZoom: 1 },
  { he: 'ארגנטינה',    en: 'Argentina',     lon: -64,   lat: -35,   minZoom: 2 },
  { he: 'אלג\'יריה',  en: 'Algeria',       lon: 3,     lat: 28,    minZoom: 2 },
  { he: 'קזחסטן',      en: 'Kazakhstan',    lon: 67,    lat: 48,    minZoom: 2 },
  { he: 'מצרים',       en: 'Egypt',         lon: 29,    lat: 26,    minZoom: 2 },
  { he: 'מקסיקו',      en: 'Mexico',        lon: -102,  lat: 23,    minZoom: 2 },
  { he: 'איראן',       en: 'Iran',          lon: 53,    lat: 32,    minZoom: 2 },
  { he: 'מונגוליה',    en: 'Mongolia',      lon: 103,   lat: 46,    minZoom: 2 },
  { he: 'ניגריה',      en: 'Nigeria',       lon: 8,     lat: 9,     minZoom: 3 },
  { he: 'דר. אפריקה',  en: 'South Africa',  lon: 25,    lat: -29,   minZoom: 2 },
  { he: 'סודן',        en: 'Sudan',         lon: 30,    lat: 15,    minZoom: 3 },
  { he: 'פקיסטן',      en: 'Pakistan',      lon: 69,    lat: 30,    minZoom: 3 },
  { he: 'טורקיה',      en: 'Turkey',        lon: 35,    lat: 39,    minZoom: 2 },
  { he: 'צרפת',        en: 'France',        lon: 2,     lat: 46,    minZoom: 3 },
  { he: 'ספרד',        en: 'Spain',         lon: -3,    lat: 40,    minZoom: 3 },
  { he: 'גרמניה',      en: 'Germany',       lon: 10,    lat: 51,    minZoom: 3 },
  { he: 'שוודיה',      en: 'Sweden',        lon: 17,    lat: 62,    minZoom: 3 },
  { he: 'יפן',         en: 'Japan',         lon: 138,   lat: 37,    minZoom: 3 },
  { he: 'ערב הסעודית', en: 'Saudi Arabia',  lon: 45,    lat: 24,    minZoom: 3 },
  { he: 'אינדונזיה',   en: 'Indonesia',     lon: 118,   lat: -2,    minZoom: 3 },
  { he: 'קולומביה',    en: 'Colombia',      lon: -73,   lat: 4,     minZoom: 3 },
  { he: 'אתיופיה',     en: 'Ethiopia',      lon: 39,    lat: 9,     minZoom: 3 },
  { he: 'צ\'ילה',      en: 'Chile',         lon: -71,   lat: -35,   minZoom: 3 },
  { he: 'עיראק',       en: 'Iraq',          lon: 43,    lat: 33,    minZoom: 4 },
  { he: 'אפגניסטן',    en: 'Afghanistan',   lon: 67,    lat: 33,    minZoom: 4 },
  { he: 'אוקראינה',    en: 'Ukraine',       lon: 32,    lat: 49,    minZoom: 4 },
  { he: 'פולין',       en: 'Poland',        lon: 20,    lat: 52,    minZoom: 4 },
  { he: 'מדגסקר',      en: 'Madagascar',    lon: 47,    lat: -20,   minZoom: 4 },
  { he: 'גרינלנד',     en: 'Greenland',     lon: -42,   lat: 72,    minZoom: 3 },
  { he: 'לוב',         en: 'Libya',         lon: 17,    lat: 27,    minZoom: 4 },
  { he: 'מאלי',        en: 'Mali',          lon: -2,    lat: 18,    minZoom: 4 },
  { he: 'קונגו',       en: 'DR Congo',      lon: 24,    lat: -3,    minZoom: 4 },
  { he: 'טנזניה',      en: 'Tanzania',      lon: 35,    lat: -6,    minZoom: 4 },
  { he: 'פרו',         en: 'Peru',          lon: -75,   lat: -10,   minZoom: 4 },
  { he: 'ניז\'ר',      en: 'Niger',         lon: 8,     lat: 17,    minZoom: 4 },
];

interface MapViewProps {
  focusCoords: LngLatPoint | null;
  focusBounds: MapBounds | null;
  layers: AppLayer[];
  onLayersChange?: () => void;
}

interface LayerState {
  id: string;
  name: string;
  visible: boolean;
  color: string;
  year?: number;
  ft?: string;
}

let layerCounter = 0;

export default function MapView({ focusCoords, focusBounds, layers, onLayersChange }: MapViewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const [mapReady, setMapReady] = useState(false);
  const [layerList, setLayerList] = useState<LayerState[]>([]);
  const [showPanel, setShowPanel] = useState(false);
  const [mapSrc, setMapSrc] = useState('...');
  const [tooltip, setTooltip] = useState<{ name: string; continent: string; x: number; y: number } | null>(null);
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    point: LngLatPoint;
    copied: string | null;
  } | null>(null);

  const copyText = useCallback(async (label: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setContextMenu((current) => current ? { ...current, copied: label } : current);
    } catch {
      const textArea = document.createElement('textarea');
      textArea.value = value;
      textArea.style.position = 'fixed';
      textArea.style.opacity = '0';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setContextMenu((current) => current ? { ...current, copied: label } : current);
    }
  }, []);

  // ── Render HTML country labels ─────────────────────────────
  const renderLabels = useCallback((map: maplibregl.Map) => {
    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current = [];
    const z = map.getZoom();

    LABELS.forEach(lbl => {
      if (z < lbl.minZoom) return;
      const el = document.createElement('div');
      // Show Hebrew at zoom >= 5, English otherwise
      el.textContent = z >= 5 ? lbl.he : lbl.en;
      el.style.cssText = [
        'color:#8ab0d0',
        `font-size:${z >= 6 ? 12 : z >= 4 ? 10 : 9}px`,
        'font-weight:600',
        "font-family:'Segoe UI',Arial,sans-serif",
        'text-shadow:0 0 4px #08111e,0 0 8px #08111e,0 0 3px #08111e',
        'pointer-events:none',
        'white-space:nowrap',
        'letter-spacing:0.4px',
        'user-select:none',
      ].join(';');

      const marker = new maplibregl.Marker({ element: el, anchor: 'center' })
        .setLngLat([lbl.lon, lbl.lat])
        .addTo(map);
      markersRef.current.push(marker);
    });
  }, []);

  // ── Init map ───────────────────────────────────────────────
  useEffect(() => {
    if (mapRef.current) return;

    async function initMap() {
      let worldData = FALLBACK_WORLD;
      let src = 'מובנה';
      try {
        const res = await fetch('/world.geojson');
        if (res.ok) {
          const dl = await res.json();
          if (dl?.features?.length > 50) { worldData = dl as GeoFeatureCollection; src = 'Natural Earth'; }
        }
      } catch { /* use fallback */ }
      setMapSrc(src);

      const map = new maplibregl.Map({
        container: containerRef.current,
        style: buildStyle(worldData) as any,
        center: [20, 20],
        zoom: 2.5,
        attributionControl: false,
      });

      map.addControl(new maplibregl.NavigationControl(), 'top-right');
      map.addControl(new maplibregl.ScaleControl({ unit: 'metric' }), 'bottom-left');

      map.on('load', () => {
        mapRef.current = map;
        setMapReady(true);
        renderLabels(map);

        // Hover effect
        let hovId = null;
        map.on('mousemove', 'countries-fill', (e: any) => {
          if (!e.features?.length) return;
          map.getCanvas().style.cursor = 'crosshair';
          const feat = e.features[0];
          if (hovId !== null && hovId !== feat.id) map.setFeatureState({ source: 'world', id: hovId }, { hover: false });
          hovId = feat.id;
          map.setFeatureState({ source: 'world', id: feat.id }, { hover: true });
          const p = feat.properties;
          setTooltip({ name: p.name || p.NAME || p.ADMIN || '', continent: p.continent || '', x: e.point.x, y: e.point.y });
        });
        map.on('mouseleave', 'countries-fill', () => {
          map.getCanvas().style.cursor = '';
          if (hovId !== null) { map.setFeatureState({ source: 'world', id: hovId }, { hover: false }); hovId = null; }
          setTooltip(null);
        });

        map.on('contextmenu', (e) => {
          e.originalEvent.preventDefault();
          setContextMenu({
            x: e.point.x,
            y: e.point.y,
            point: { lng: e.lngLat.lng, lat: e.lngLat.lat },
            copied: null,
          });
        });
      });

      map.on('zoomend', () => renderLabels(map));
      map.on('movestart', () => setContextMenu(null));
    }

    initMap();
    return () => {
      markersRef.current.forEach(m => m.remove());
      if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; }
    };
  }, [renderLabels]);

  // ── Fly to coords ──────────────────────────────────────────
  useEffect(() => {
    if (focusCoords && mapRef.current)
      mapRef.current.flyTo({ center: [focusCoords.lng, focusCoords.lat], zoom: 10, duration: 1200 });
  }, [focusCoords]);

  useEffect(() => {
    if (!focusBounds || !mapRef.current) {
      return;
    }

    mapRef.current.fitBounds(focusBounds, {
      padding: 48,
      duration: 1200,
      maxZoom: 15,
    });
  }, [focusBounds]);

  useEffect(() => {
    if (!contextMenu) {
      return;
    }

    const closeMenu = () => setContextMenu(null);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setContextMenu(null);
      }
    };

    window.addEventListener('mousedown', closeMenu);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('mousedown', closeMenu);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [contextMenu]);

  // ── Add shapefile layers ───────────────────────────────────
  useEffect(() => {
    if (!mapReady || !layers?.length) return;
    const map = mapRef.current;
    if (!map) return;

    layers.forEach((layer) => {
      if (!layer.data) return;
      const id = `ql-${++layerCounter}`;
      const color = ftColor(layer.ft);
      if (map.getSource(id)) return;
      map.addSource(id, { type: 'geojson', data: layer.data as any });
      const t = layer.data?.features?.[0]?.geometry?.type || 'Point';
      if (t.includes('Polygon')) {
        map.addLayer({ id: `${id}-fill`, type: 'fill',   source: id, paint: { 'fill-color': color, 'fill-opacity': 0.4 } });
        map.addLayer({ id: `${id}-line`, type: 'line',   source: id, paint: { 'line-color': color, 'line-width': 1.5 } });
      } else if (t.includes('Line')) {
        map.addLayer({ id: `${id}-line`, type: 'line',   source: id, paint: { 'line-color': color, 'line-width': 2.5 } });
      } else {
        map.addLayer({ id: `${id}-pt`,   type: 'circle', source: id, paint: { 'circle-radius': 6, 'circle-color': color, 'circle-stroke-color': '#fff', 'circle-stroke-width': 1.5 } });
      }
      setLayerList((prev) => [...prev, { id, name: layer.name || id, visible: true, color, year: layer.year || 2026, ft: layer.ft }]);
    });
    onLayersChange?.();
  }, [layers, mapReady]);

  const toggleLayer = (id: string, vis: boolean) => {
    const map = mapRef.current; if (!map) return;
    const v = vis ? 'none' : 'visible';
    ['fill','line','pt'].forEach(s => { const l=`${id}-${s}`; if(map.getLayer(l)) map.setLayoutProperty(l,'visibility',v); });
    setLayerList(prev => prev.map(l => l.id === id ? { ...l, visible: !vis } : l));
  };

  const removeLayer = (id: string) => {
    const map = mapRef.current; if (!map) return;
    ['fill','line','pt'].forEach(s => { const l=`${id}-${s}`; if(map.getLayer(l)) map.removeLayer(l); });
    if (map.getSource(id)) map.removeSource(id);
    setLayerList(prev => prev.filter(l => l.id !== id));
  };

  return (
    <div style={S.wrap}>
      <div ref={containerRef} style={S.map} />

      {/* Hover tooltip */}
      {tooltip && (
        <div style={{ ...S.tooltip, left: tooltip.x + 14, top: tooltip.y - 14 }}>
          <strong>{tooltip.name}</strong>
          {tooltip.continent && <span style={{ color: 'var(--text3)', fontSize: 10 }}> · {tooltip.continent}</span>}
        </div>
      )}

      {contextMenu && (
        <div
          style={{ ...S.contextMenu, left: Math.min(contextMenu.x, window.innerWidth - 280), top: contextMenu.y }}
          onMouseDown={(event) => event.stopPropagation()}
        >
          <div style={S.contextHeader}>Copy Coords</div>
          <div style={S.contextPreview}>{formatDD(contextMenu.point)}</div>
          <button style={S.contextButton} onClick={() => void copyText('DD', formatDD(contextMenu.point))}>Copy DD</button>
          <button style={S.contextButton} onClick={() => void copyText('D', formatD(contextMenu.point))}>Copy D</button>
          <button style={S.contextButton} onClick={() => void copyText('DMS', formatDMS(contextMenu.point))}>Copy DMS</button>
          <button style={S.contextButton} onClick={() => void copyText('UTM', formatUTM(contextMenu.point))}>Copy UTM</button>
          <button style={{ ...S.contextButton, ...S.contextPrimary }} onClick={() => void copyText('All formats', formatAllCoordinateTypes(contextMenu.point))}>Copy All</button>
          {contextMenu.copied && <div style={S.contextStatus}>Copied: {contextMenu.copied}</div>}
        </div>
      )}

      {/* Continent legend */}
      <div style={S.contLegend}>
        <div style={S.contTitle}>יבשות</div>
        {[
          ['אירופה',     '#252060'],
          ['אסיה',       '#3a2010'],
          ['אפריקה',     '#3a2810'],
          ['אמ. הצפונית','#1b3a5c'],
          ['אמ. הדרומית','#1a4535'],
          ['אוקיאניה',   '#0e3040'],
        ].map(([name, color]) => (
          <div key={name} style={S.contRow}>
            <div style={{ ...S.contDot, background: color }} />
            <span style={S.contLabel}>{name}</span>
          </div>
        ))}
      </div>

      {/* Offline badge */}
      <div style={S.badge}>
        <div style={S.badgeDot} />
        <span>אופליין — {mapSrc}</span>
      </div>

      {/* Layer panel toggle */}
      <button style={S.layerToggle} onClick={() => setShowPanel(o => !o)}>
        ⊞ שכבות {layerList.length > 0 && <span style={S.layerCount}>{layerList.length}</span>}
      </button>

      {showPanel && (
        <div style={S.panel}>
          <div style={S.panelHead}>
            <span style={S.panelTitle}>שכבות פעילות</span>
            <button style={S.closeBtn} onClick={() => setShowPanel(false)}>✕</button>
          </div>
          {layerList.length === 0
            ? <p style={S.empty}>טען shapefile ממשימה</p>
            : layerList.map(l => (
              <div key={l.id} style={S.layerRow}>
                <div style={{ ...S.dot, background: l.color }} />
                <div style={S.layerInfo}>
                  <span style={S.layerName}>{l.name}</span>
                  <span style={S.layerYear}>{l.ft || '—'}</span>
                </div>
                <button style={S.iconBtn} onClick={() => toggleLayer(l.id, l.visible)}>{l.visible ? '👁' : '🙈'}</button>
                <button style={{ ...S.iconBtn, color: 'var(--red)' }} onClick={() => removeLayer(l.id)}>✕</button>
              </div>
            ))
          }
          <div style={S.divider} />
          <div style={S.panelSubTitle}>מקרא שנים</div>
          {Object.entries(FT_COLORS).map(([ft, c]) => (
            <div key={ft} style={S.layerRow}>
              <div style={{ ...S.dot, background: c }} />
              <span style={{ fontSize: 11, color: 'var(--text2)' }}>{ft}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const S: Record<string, CSSProperties> = {
  wrap: { width: '100%', height: '100%', position: 'relative', background: '#08111e' },
  map:  { width: '100%', height: '100%' },
  tooltip: {
    position: 'absolute', zIndex: 30, pointerEvents: 'none',
    background: 'rgba(8,17,30,0.92)', border: '1px solid var(--border)',
    borderRadius: 7, padding: '5px 10px', fontSize: 12,
    color: 'var(--text)', backdropFilter: 'blur(4px)',
    boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
  },
  contextMenu: {
    position: 'absolute',
    zIndex: 40,
    width: 220,
    background: 'rgba(8,17,30,0.96)',
    border: '1px solid var(--border)',
    borderRadius: 10,
    padding: 8,
    boxShadow: '0 10px 24px rgba(0,0,0,0.45)',
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    backdropFilter: 'blur(8px)',
  },
  contextHeader: {
    fontSize: 12,
    fontWeight: 700,
    color: 'var(--text)',
  },
  contextPreview: {
    fontSize: 11,
    color: 'var(--text3)',
    paddingBottom: 4,
    borderBottom: '1px solid var(--border)',
  },
  contextButton: {
    background: 'var(--surface2)',
    border: '1px solid var(--border)',
    borderRadius: 8,
    color: 'var(--text)',
    padding: '7px 10px',
    fontSize: 12,
    textAlign: 'left',
    cursor: 'pointer',
    fontFamily: 'var(--font)',
  },
  contextPrimary: {
    background: 'rgba(79,127,255,0.18)',
    borderColor: 'rgba(79,127,255,0.4)',
    color: '#d9e7ff',
  },
  contextStatus: {
    fontSize: 11,
    color: 'var(--green)',
    paddingTop: 2,
  },
  contLegend: {
    position: 'absolute', bottom: 40, right: 10, zIndex: 10,
    background: 'rgba(8,17,30,0.9)', border: '1px solid var(--border)',
    borderRadius: 10, padding: '8px 12px', backdropFilter: 'blur(6px)',
  },
  contTitle: { fontSize: 9, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 5 },
  contRow: { display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 },
  contDot: { width: 12, height: 10, borderRadius: 2, border: '1px solid #3a4f7a', flexShrink: 0 },
  contLabel: { fontSize: 10, color: 'var(--text2)' },
  badge: {
    position: 'absolute', bottom: 8, left: '50%', transform: 'translateX(-50%)',
    background: 'rgba(8,17,30,0.85)', border: '1px solid var(--border)',
    borderRadius: 20, padding: '3px 12px', fontSize: 10, color: 'var(--text3)',
    display: 'flex', alignItems: 'center', gap: 5, pointerEvents: 'none', zIndex: 5,
  },
  badgeDot: { width: 6, height: 6, borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 5px #22c55e' },
  layerToggle: {
    position: 'absolute', top: 12, right: 60,
    background: 'rgba(24,28,39,0.92)', border: '1px solid var(--border)',
    borderRadius: 'var(--radius)', color: 'var(--text)',
    padding: '7px 14px', fontSize: 13, fontWeight: 500,
    cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
    boxShadow: 'var(--shadow-sm)', zIndex: 10, fontFamily: 'var(--font)',
  },
  layerCount: { background: 'var(--accent)', color: '#fff', borderRadius: 20, fontSize: 10, padding: '1px 6px', fontWeight: 700 },
  panel: {
    position: 'absolute', top: 50, right: 60, width: 220,
    background: 'rgba(24,28,39,0.96)', border: '1px solid var(--border)',
    borderRadius: 'var(--radius-lg)', padding: 12,
    boxShadow: 'var(--shadow)', zIndex: 10, maxHeight: '50vh', overflowY: 'auto',
    backdropFilter: 'blur(8px)',
  },
  panelHead: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  panelTitle: { fontSize: 12, fontWeight: 700, color: 'var(--text)' },
  panelSubTitle: { fontSize: 10, fontWeight: 600, color: 'var(--text3)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.06em' },
  closeBtn: { background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', fontSize: 12 },
  empty: { fontSize: 11, color: 'var(--text3)', textAlign: 'center', padding: '8px 0' },
  layerRow: { display: 'flex', alignItems: 'center', gap: 7, padding: '4px 0', borderBottom: '1px solid var(--border)' },
  dot: { width: 9, height: 9, borderRadius: '50%', flexShrink: 0 },
  layerInfo: { flex: 1 },
  layerName: { fontSize: 11, color: 'var(--text)', display: 'block' },
  layerYear: { fontSize: 10, color: 'var(--text3)' },
  iconBtn: { background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: 'var(--text2)', padding: 2 },
  divider: { height: 1, background: 'var(--border)', margin: '8px 0' },
};

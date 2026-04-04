import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

import { useTheme } from '../context/ThemeContext';
import FALLBACK_WORLD from '../services/worldMap';
import { ftColor } from '../services/ftConfig';
import type { GeoFeature, GeoFeatureCollection, GeometryCatalog, IdentifyResults, LayerFilters, LngLatPoint, MapBounds } from '../types/domain';
import { formatAllCoordinateTypes, formatD, formatDD, formatDMS, formatUTM, identifyFeaturesAtPoint } from '../utils/geo';

const POINT_SOURCE_ID = 'quest-points';
const POLYGON_SOURCE_ID = 'quest-polygons';

function getMapPalette(mode: 'dark' | 'light') {
  if (mode === 'light') {
    return {
      background: '#f6efe2',
      line: '#cdb89d',
      labelColor: '#8d1d2c',
      labelShadow: '#f8f2e7',
      continentFill: [
        'match', ['get', 'continent'],
        'North America', '#dfc08b',
        'South America', '#d5b07e',
        'Europe', '#f0d9a5',
        'Asia', '#cf9c65',
        'Africa', '#c58a53',
        'Oceania', '#e2c791',
        '#ead9b2',
      ] as unknown[],
    };
  }

  return {
    background: '#08111e',
    line: '#2a3f6a',
    labelColor: '#8ab0d0',
    labelShadow: '#08111e',
    continentFill: [
      'match', ['get', 'continent'],
      'North America', '#1b3a5c',
      'South America', '#1a4535',
      'Europe', '#252060',
      'Asia', '#3a2010',
      'Africa', '#3a2810',
      'Oceania', '#0e3040',
      '#1a2540',
    ] as unknown[],
  };
}

function buildStyle(worldData: GeoFeatureCollection, mode: 'dark' | 'light') {
  const palette = getMapPalette(mode);
  return {
    version: 8,
    name: 'GIS Offline',
    sources: {
      world: { type: 'geojson', data: worldData },
    },
    layers: [
      { id: 'bg', type: 'background', paint: { 'background-color': palette.background } },
      { id: 'countries-fill', type: 'fill', source: 'world', paint: { 'fill-color': palette.continentFill, 'fill-opacity': 1 } },
      {
        id: 'countries-hover',
        type: 'fill',
        source: 'world',
        paint: {
          'fill-color': '#ffffff',
          'fill-opacity': ['case', ['boolean', ['feature-state', 'hover'], false], mode === 'light' ? 0.18 : 0.1, 0],
        },
      },
      { id: 'countries-line', type: 'line', source: 'world', paint: { 'line-color': palette.line, 'line-width': 0.7 } },
    ],
  };
}

interface MapViewProps {
  focusCoords: LngLatPoint | null;
  focusBounds: MapBounds | null;
  jumpMarker: LngLatPoint | null;
  geometryCatalog: GeometryCatalog | null;
  filters: LayerFilters;
  identifyResults: IdentifyResults | null;
  selectedFeatureId: string | number | null;
  onIdentify: (results: IdentifyResults) => void;
  onClearIdentify: () => void;
  onToggleGeometryLayer: (geometryType: 'point' | 'polygon') => void;
  onToggleQuestType: (questType: string) => void;
}

function emptyFeatureCollection(): GeoFeatureCollection {
  return { type: 'FeatureCollection', features: [] };
}

function normalizeCountryName(rawName: string): string {
  const trimmed = rawName.trim();
  if (trimmed === 'Palestine' || trimmed === 'Palestinian Territories' || trimmed === 'State of Palestine') {
    return 'Gaza';
  }
  return trimmed;
}

function layerToken(questType: string) {
  return questType.toLowerCase().replace(/[^a-z0-9_-]+/g, '-');
}

function pointLayerId(questType: string) {
  return `quest-point-${layerToken(questType)}`;
}

function polygonFillLayerId(questType: string) {
  return `quest-polygon-fill-${layerToken(questType)}`;
}

function polygonLineLayerId(questType: string) {
  return `quest-polygon-line-${layerToken(questType)}`;
}

export default function MapView({
  focusCoords,
  focusBounds,
  jumpMarker,
  geometryCatalog,
  filters,
  identifyResults,
  selectedFeatureId,
  onIdentify,
  onClearIdentify,
  onToggleGeometryLayer,
  onToggleQuestType,
}: MapViewProps) {
  const { mode } = useTheme();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const jumpMarkerRef = useRef<maplibregl.Marker | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [showPanel, setShowPanel] = useState(false);
  const [mapSrc, setMapSrc] = useState('...');
  const [tooltip, setTooltip] = useState<{ name: string; continent: string; x: number; y: number } | null>(null);
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    point: LngLatPoint;
    copied: string | null;
  } | null>(null);
  const highlightedFeatureRef = useRef<{ questId: string; source: string; id: string | number } | null>(null);
  const [identifyResultsInternal, setIdentifyResultsInternal] = useState<IdentifyResults | null>(null);

  const pointFeatureCount = geometryCatalog?.points.features.length || 0;
  const polygonFeatureCount = geometryCatalog?.polygons.features.length || 0;

  const questTypeCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    [geometryCatalog?.points, geometryCatalog?.polygons].forEach((collection) => {
      (collection?.features || []).forEach((feature) => {
        const questType = String(feature.properties?.quest_type || feature.properties?.ft || 'Unknown');
        counts[questType] = (counts[questType] || 0) + 1;
      });
    });
    return counts;
  }, [geometryCatalog]);

  const copyText = useCallback(async (label: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setContextMenu((current) => current ? { ...current, copied: label } : current);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = value;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setContextMenu((current) => current ? { ...current, copied: label } : current);
    }
  }, []);

  const handleIdentify = useCallback(() => {
    const map = mapRef.current;
    if (!map || !contextMenu) {
      return;
    }
    const location = contextMenu.point;
    const zoom = map.getZoom();
    const features = identifyFeaturesAtPoint(location, zoom, geometryCatalog);
    const results: IdentifyResults = { location, features };
    setIdentifyResultsInternal(results);
    onIdentify(results);
    setContextMenu(null);
  }, [contextMenu, geometryCatalog, onIdentify]);

  const clearIdentify = useCallback(() => {
    setIdentifyResultsInternal(null);
    onClearIdentify();
  }, [onClearIdentify]);

  const renderLabels = useCallback((map: maplibregl.Map) => {
    const zoom = map.getZoom();
    if (zoom < 2) return;

    const palette = getMapPalette(mode);
    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current = [];

    FALLBACK_WORLD.features.forEach((feature) => {
      const name = String(feature.properties?.name || '');
      if (!name) return;

      const geometry = feature.geometry;
      if (!geometry?.coordinates) return;

      let ring: number[][];
      if (geometry.type === 'MultiPolygon') {
        const polys = geometry.coordinates as number[][][][];
        if (!polys?.[0]?.[0]) return;
        ring = polys[0][0];
      } else if (geometry.type === 'Polygon') {
        const rings = geometry.coordinates as number[][][];
        if (!rings?.[0]) return;
        ring = rings[0];
      } else {
        return;
      }

      if (!ring.length) return;

      const lon = ring.reduce((sum: number, c: number[]) => sum + c[0], 0) / ring.length;
      const lat = ring.reduce((sum: number, c: number[]) => sum + c[1], 0) / ring.length;

      if (!Number.isFinite(lon) || !Number.isFinite(lat)) return;

      const element = document.createElement('div');
      element.textContent = name;
      element.style.cssText = [
        `color:${palette.labelColor}`,
        `font-size:${zoom >= 6 ? 12 : 10}px`,
        'font-weight:600',
        "font-family:'Segoe UI',Arial,sans-serif",
        `text-shadow:0 0 4px ${palette.labelShadow},0 0 8px ${palette.labelShadow}`,
        'pointer-events:none',
        'white-space:nowrap',
      ].join(';');

      markersRef.current.push(
        new maplibregl.Marker({ element, anchor: 'center' })
          .setLngLat([lon, lat])
          .addTo(map),
      );
    });
  }, [mode]);

  const syncLayerVisibility = useCallback((map: maplibregl.Map, questTypes: string[]) => {
    questTypes.forEach((questType) => {
      const questTypeVisible = filters.questTypes[questType] ?? true;
      const pointVisibility = filters.showPoints && questTypeVisible ? 'visible' : 'none';
      const polygonVisibility = filters.showPolygons && questTypeVisible ? 'visible' : 'none';

      if (map.getLayer(pointLayerId(questType))) {
        map.setLayoutProperty(pointLayerId(questType), 'visibility', pointVisibility);
      }
      if (map.getLayer(polygonFillLayerId(questType))) {
        map.setLayoutProperty(polygonFillLayerId(questType), 'visibility', polygonVisibility);
      }
      if (map.getLayer(polygonLineLayerId(questType))) {
        map.setLayoutProperty(polygonLineLayerId(questType), 'visibility', polygonVisibility);
      }
    });
  }, [filters.questTypes, filters.showPoints, filters.showPolygons]);

  useEffect(() => {
    if (mapRef.current) {
      return;
    }

    async function initMap() {
      let worldData = FALLBACK_WORLD;
      let source = 'מובנה';

      try {
        const response = await fetch('/world.geojson');
        if (response.ok) {
          const payload = await response.json();
          if (payload?.features?.length > 50) {
            worldData = payload as GeoFeatureCollection;
            source = 'Natural Earth';
          }
        }
      } catch {
        source = 'מובנה';
      }

      setMapSrc(source);

      const map = new maplibregl.Map({
        container: containerRef.current as HTMLDivElement,
        style: buildStyle(worldData, mode) as any,
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

        let hoverId: number | string | null = null;
        map.on('mousemove', 'countries-fill', (event: any) => {
          if (!event.features?.length) {
            return;
          }
          map.getCanvas().style.cursor = 'crosshair';
          const feature = event.features[0];
          if (hoverId !== null && hoverId !== feature.id) {
            map.setFeatureState({ source: 'world', id: hoverId }, { hover: false });
          }
          hoverId = feature.id;
          map.setFeatureState({ source: 'world', id: feature.id }, { hover: true });
          const properties = feature.properties || {};
          setTooltip({
            name: normalizeCountryName(String(properties.name || properties.NAME || properties.ADMIN || '')),
            continent: String(properties.continent || ''),
            x: event.point.x,
            y: event.point.y,
          });
        });

        map.on('mouseleave', 'countries-fill', () => {
          map.getCanvas().style.cursor = '';
          if (hoverId !== null) {
            map.setFeatureState({ source: 'world', id: hoverId }, { hover: false });
            hoverId = null;
          }
          setTooltip(null);
        });

        map.on('contextmenu', (event) => {
          event.originalEvent.preventDefault();
          setContextMenu({
            x: event.point.x,
            y: event.point.y,
            point: { lng: event.lngLat.lng, lat: event.lngLat.lat },
            copied: null,
          });
        });
      });

      map.on('zoomend', () => renderLabels(map));
      map.on('movestart', () => setContextMenu(null));
    }

    void initMap();

    return () => {
      markersRef.current.forEach((marker) => marker.remove());
      jumpMarkerRef.current?.remove();
      mapRef.current?.remove();
      jumpMarkerRef.current = null;
      mapRef.current = null;
    };
  }, [mode, renderLabels]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) {
      return;
    }

    const palette = getMapPalette(mode);
    if (map.getLayer('bg')) {
      map.setPaintProperty('bg', 'background-color', palette.background);
    }
    if (map.getLayer('countries-fill')) {
      map.setPaintProperty('countries-fill', 'fill-color', palette.continentFill as any);
    }
    if (map.getLayer('countries-hover')) {
      map.setPaintProperty(
        'countries-hover',
        'fill-opacity',
        ['case', ['boolean', ['feature-state', 'hover'], false], mode === 'light' ? 0.18 : 0.1, 0] as any,
      );
    }
    if (map.getLayer('countries-line')) {
      map.setPaintProperty('countries-line', 'line-color', palette.line);
    }

    renderLabels(map);
  }, [mode, renderLabels]);

  useEffect(() => {
    if (focusCoords && mapRef.current) {
      mapRef.current.flyTo({ center: [focusCoords.lng, focusCoords.lat], zoom: 10, duration: 1200 });
    }
  }, [focusCoords]);

  useEffect(() => {
    if (!focusBounds || !mapRef.current) {
      return;
    }
    mapRef.current.fitBounds(focusBounds, { padding: 48, duration: 1200, maxZoom: 15 });
  }, [focusBounds]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !jumpMarker) {
      return;
    }

    if (!jumpMarkerRef.current) {
      const element = document.createElement('div');
      element.innerHTML = '📍';
      element.style.fontSize = '28px';
      element.style.lineHeight = '1';
      element.style.filter = 'drop-shadow(0 4px 8px rgba(0,0,0,0.35))';
      jumpMarkerRef.current = new maplibregl.Marker({ element, anchor: 'bottom' })
        .setLngLat([jumpMarker.lng, jumpMarker.lat])
        .addTo(map);
      return;
    }

    jumpMarkerRef.current.setLngLat([jumpMarker.lng, jumpMarker.lat]);
  }, [jumpMarker]);

  useEffect(() => {
    if (!contextMenu) {
      return;
    }

    const close = () => setContextMenu(null);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setContextMenu(null);
      }
    };

    window.addEventListener('mousedown', close);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('mousedown', close);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [contextMenu]);

  useEffect(() => {
    if (!mapReady || !mapRef.current) {
      return;
    }

    const map = mapRef.current;
    const points = geometryCatalog?.points || emptyFeatureCollection();
    const polygons = geometryCatalog?.polygons || emptyFeatureCollection();
    const questTypes = geometryCatalog?.quest_types || [];

    if (!map.getSource(POINT_SOURCE_ID)) {
      map.addSource(POINT_SOURCE_ID, { type: 'geojson', data: points as any });
    } else {
      (map.getSource(POINT_SOURCE_ID) as maplibregl.GeoJSONSource).setData(points as any);
    }

    if (!map.getSource(POLYGON_SOURCE_ID)) {
      map.addSource(POLYGON_SOURCE_ID, { type: 'geojson', data: polygons as any });
    } else {
      (map.getSource(POLYGON_SOURCE_ID) as maplibregl.GeoJSONSource).setData(polygons as any);
    }

    questTypes.forEach((questType) => {
      const color = ftColor(questType);

      if (!map.getLayer(pointLayerId(questType))) {
        map.addLayer({
          id: pointLayerId(questType),
          type: 'circle',
          source: POINT_SOURCE_ID,
          filter: ['==', ['get', 'quest_type'], questType],
          paint: {
            'circle-radius': [
              'case',
              ['boolean', ['feature-state', 'highlight'], false],
              10,
              6,
            ],
            'circle-color': [
              'case',
              ['boolean', ['feature-state', 'highlight'], false],
              '#ff6b6b',
              color,
            ],
            'circle-stroke-color': '#ffffff',
            'circle-stroke-width': [
              'case',
              ['boolean', ['feature-state', 'highlight'], false],
              3,
              1.5,
            ],
          },
        });
      }

      if (!map.getLayer(polygonFillLayerId(questType))) {
        map.addLayer({
          id: polygonFillLayerId(questType),
          type: 'fill',
          source: POLYGON_SOURCE_ID,
          filter: ['==', ['get', 'quest_type'], questType],
          paint: {
            'fill-color': [
              'case',
              ['boolean', ['feature-state', 'highlight'], false],
              '#ff6b6b',
              color,
            ],
            'fill-opacity': [
              'case',
              ['boolean', ['feature-state', 'highlight'], false],
              0.6,
              0.3,
            ],
          },
        });
      }

      if (!map.getLayer(polygonLineLayerId(questType))) {
        map.addLayer({
          id: polygonLineLayerId(questType),
          type: 'line',
          source: POLYGON_SOURCE_ID,
          filter: ['==', ['get', 'quest_type'], questType],
          paint: {
            'line-color': [
              'case',
              ['boolean', ['feature-state', 'highlight'], false],
              '#ff6b6b',
              color,
            ],
            'line-width': [
              'case',
              ['boolean', ['feature-state', 'highlight'], false],
              4,
              2,
            ],
          },
        });
      }
    });

    syncLayerVisibility(map, questTypes);
  }, [geometryCatalog, mapReady, syncLayerVisibility]);

  useEffect(() => {
    if (!mapRef.current || selectedFeatureId === null || selectedFeatureId === undefined) {
      return;
    }
    const map = mapRef.current;
    const sourceId = map.getSource(POINT_SOURCE_ID) ? POINT_SOURCE_ID : (map.getSource(POLYGON_SOURCE_ID) ? POLYGON_SOURCE_ID : null);
    if (!sourceId) {
      return;
    }
    const source = map.getSource(sourceId) as maplibregl.GeoJSONSource;
    if (!source) {
      return;
    }
    const data = source._data as GeoFeatureCollection | undefined;
    if (!data?.features) {
      return;
    }
    const feature = data.features.find((f) => {
      const questId = f.properties?.quest_id;
      return questId !== undefined && String(questId) === String(selectedFeatureId);
    });
    if (feature && highlightedFeatureRef.current) {
      const prev = highlightedFeatureRef.current;
      map.setFeatureState({ source: prev.source, id: prev.id }, { highlight: false });
    }
    if (feature) {
      const featureId = feature.id;
      if (featureId !== undefined) {
        map.setFeatureState({ source: sourceId, id: featureId }, { highlight: true });
        highlightedFeatureRef.current = { questId: String(selectedFeatureId), source: sourceId, id: featureId };
      }
    }
  }, [selectedFeatureId]);

  return (
    <div style={S.wrap}>
      <div ref={containerRef} style={S.map} />

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
          <div style={S.contextHeader}>UTM Coord</div>
          <div style={S.contextPreview}>{formatUTM(contextMenu.point)}</div>
          <button style={{ ...S.contextButton, ...S.contextPrimary }} onClick={() => void copyText('UTM', formatUTM(contextMenu.point))}>Copy UTM</button>
          <div style={S.contextSectionTitle}>Copy GEO Coord</div>
          <button style={S.contextButton} onClick={() => void copyText('DD', formatDD(contextMenu.point))}>Copy DD</button>
          <button style={S.contextButton} onClick={() => void copyText('D', formatD(contextMenu.point))}>Copy D</button>
          <button style={S.contextButton} onClick={() => void copyText('DMS', formatDMS(contextMenu.point))}>Copy DMS</button>
          <button style={S.contextButton} onClick={() => void copyText('All formats', formatAllCoordinateTypes(contextMenu.point))}>Copy Full Coord Set</button>
          <div style={S.divider} />
          <button style={S.contextButton} onClick={handleIdentify}>Identify Features</button>
          {contextMenu.copied && <div style={S.contextStatus}>Copied: {contextMenu.copied}</div>}
        </div>
      )}

      <div style={S.badge}>
        <div style={S.badgeDot} />
        <span>אופליין — {mapSrc}</span>
      </div>

      <button style={S.layerToggle} onClick={() => setShowPanel((current) => !current)}>
        ⊞ שכבות
      </button>

      {showPanel && (
  <div style={S.panel}>
    <div style={S.panelHead}>
      <span style={S.panelTitle}>סוגי שכבות</span>
      <button style={S.closeBtn} onClick={() => setShowPanel(false)}>✕</button>
    </div>

    {/* GEOMETRY SECTION */}
    <details open style={S.section}>
      <summary style={S.sectionTitle}>שכבות גאוגרפיות</summary>

      <label style={S.layerRow}>
  <span style={S.iconPoint}>נצ● </span>
  <span style={S.countPill}>{pointFeatureCount}</span>
  <input
    type="checkbox"
    checked={filters.showPoints}
    onChange={() => onToggleGeometryLayer('point')}
  />
</label>

<label style={S.layerRow}>
  <span style={S.iconPolygon}>מודלים⬟</span>
  <span style={S.countPill}>{polygonFeatureCount}</span>
  <input
    type="checkbox"
    checked={filters.showPolygons}
    onChange={() => onToggleGeometryLayer('polygon')}
  />


</label>
    </details>

    {/* QUEST TYPE SECTION */}
    <details open style={S.section}>
      <summary style={S.sectionTitle}>על פי צל</summary>


      {geometryCatalog?.quest_types.length ? (
        geometryCatalog.quest_types.map((questType) => (
          <label key={questType} style={S.layerRow}>
                        <span
              style={{
                ...S.legendColor,
                background: ftColor(questType),
              }}
            />

            <span style={S.questLabel}>{questType}</span>

            <span style={S.countPill}>
              {questTypeCounts[questType] || 0}
            </span>
            <input
              type="checkbox"
              checked={filters.questTypes[questType] ?? true}
              onChange={() => onToggleQuestType(questType)}
            />


          </label>
        ))
      ) : (
        <div style={S.empty}>No geometry yet</div>
      )}
    </details>
  </div>
)}
    </div>
  );
}

const S: Record<string, CSSProperties> = {
  wrap: { width: '100%', height: '100%', position: 'relative', background: 'var(--map-bg)' },
  map: { width: '100%', height: '100%' },
  tooltip: {
    position: 'absolute',
    zIndex: 30,
    pointerEvents: 'none',
    background: 'var(--overlay-strong)',
    border: '1px solid var(--border)',
    borderRadius: 7,
    padding: '5px 10px',
    fontSize: 12,
    color: 'var(--text)',
    boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
  },
  contextMenu: {
    position: 'absolute',
    zIndex: 40,
    width: 220,
    background: 'var(--overlay-strong)',
    border: '1px solid var(--border)',
    borderRadius: 10,
    padding: 8,
    boxShadow: '0 10px 24px rgba(0,0,0,0.45)',
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    backdropFilter: 'blur(8px)',
  },
  contextHeader: { fontSize: 12, fontWeight: 700, color: 'var(--text)' },
  contextPreview: { fontSize: 11, color: 'var(--text3)', paddingBottom: 4, borderBottom: '1px solid var(--border)' },
  contextSectionTitle: {
    fontSize: 10,
    fontWeight: 700,
    color: 'var(--text3)',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    marginTop: 4,
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
    background: 'var(--accent-soft)',
    borderColor: 'color-mix(in srgb, var(--accent) 40%, transparent)',
  },
  contextStatus: { fontSize: 11, color: 'var(--accent)' },
  badge: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    zIndex: 12,
    background: 'var(--overlay)',
    color: 'var(--text2)',
    border: '1px solid var(--overlay-border)',
    borderRadius: 999,
    padding: '6px 10px',
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    fontSize: 11,
  },
  badgeDot: {
    width: 8,
    height: 8,
    borderRadius: '50%',
    background: '#30d158',
  },
  layerToggle: {
    position: 'absolute',
    top: 12,
    left: 12,
    zIndex: 12,
    background: 'var(--overlay-strong)',
    border: '1px solid var(--border)',
    borderRadius: 10,
    color: 'var(--text)',
    padding: '8px 12px',
    cursor: 'pointer',
    fontFamily: 'var(--font)',
  },
  panel: {
    position: 'absolute',
    scrollbarWidth:'none',
    top: 60,
    left: 12,
    zIndex: 20,
    width: 270,
    maxHeight: '420px',
    overflowY: 'auto',
    background: 'var(--overlay-strong)',
    border: '1px solid var(--border)',
    borderRadius: 14,
    padding: 12,
    boxShadow: '0 16px 36px rgba(0,0,0,0.32)',
    backdropFilter: 'blur(10px)',
  },
  
  panelHead: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  
  panelTitle: {
    fontWeight: 700,
    fontSize: 14,
  },
  
  closeBtn: {
    background: 'transparent',
    border: 'none',
    color: 'var(--text)',
    cursor: 'pointer',
    fontSize: 14,
  },
  
  section: {
    marginBottom: 10,
  },
  
  sectionTitle: {
    fontSize: 12,
    fontWeight: 700,
    cursor: 'pointer',
    marginBottom: 6,
  },
  
  layerRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '6px 0',
    fontSize: 12,
    cursor: 'pointer',
  },
  
  legendColor: {
    width: 12,
    height: 12,
    borderRadius: 3,
  },
  
  iconPoint: {
    fontSize: 12,
    color: '#4da3ff',
  },
  
  iconPolygon: {
    fontSize: 12,
    color: '#6cd38f',
  },
  
  questLabel: {
    flex: 1,
  },
  
  countPill: {
    background: 'var(--surface2)',
    padding: '2px 6px',
    borderRadius: 6,
    fontSize: 11,
  },
  
  empty: {
    fontSize: 12,
    opacity: 0.7,
  },
  divider: {
    height: 1,
    background: 'var(--border)',
    margin: '10px 0',
  },
  panelSubTitle: {
    fontSize: 11,
    fontWeight: 700,
    color: 'var(--text3)',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  checkboxRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '6px 0',
    color: 'var(--text2)',
    fontSize: 12,
  },

  questTypeSwatch: {
    width: 10,
    height: 10,
    borderRadius: '50%',
    display: 'inline-block',
  },

};

import { useCallback, useEffect, useRef, useState, type CSSProperties, type MouseEvent } from 'react';

import AttributeTable from '../components/AttributeTable';
import MapView from '../components/MapView';
import Navbar from '../components/Navbar';
import QuestPanel from '../components/QuestPanel';
import { useQuests } from '../hooks/useQuests';
import { getFeaturePoint } from '../utils/geo';
import type { AppLayer, LngLatPoint, Quest } from '../types/domain';

const MIN_WIDTH     = 220;
const MAX_WIDTH     = 600;
const DEFAULT_WIDTH = 300;

export default function HomePage() {
  const { quests, loading, refresh } = useQuests();
  const [panelOpen, setPanelOpen] = useState(true);
  const [focusCoords, setFocusCoords] = useState<LngLatPoint | null>(null);
  const [pendingLayers, setPendingLayers] = useState<AppLayer[]>([]);
  const [tableLayers, setTableLayers] = useState<AppLayer[]>([]);
  const [tableOpen, setTableOpen] = useState(false);
  const [tableHeight, setTableHeight] = useState(260);
  const [dragTable, setDragTable] = useState(false);
  const dragTableStartY = useRef(0);
  const dragTableStartH = useRef(260);
  const [panelWidth, setPanelWidth] = useState(DEFAULT_WIDTH);
  const [dragging, setDragging] = useState(false);

  const dragStartX = useRef(0);
  const dragStartW = useRef(DEFAULT_WIDTH);

  const handleLayerAdded = useCallback((layer: AppLayer) => {
    setPendingLayers((prev) => [...prev, layer]);
  }, []);

  const handleOpenTable = useCallback((layers: AppLayer[]) => {
    setTableLayers(layers);
    setTableOpen(true);
  }, []);

  const handleLayersConsumed = useCallback(() => {
    setPendingLayers([]);
  }, []);

  const handleHighlightFeature = useCallback((layer: AppLayer, featureIdx: number) => {
    const feature = (layer.geojson?.features || layer.data?.features || [])[featureIdx];
    const point = getFeaturePoint(feature);
    if (point) {
      setFocusCoords(point);
    }
  }, []);

  const onMouseDown = useCallback((e: MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    dragStartX.current = e.clientX;
    dragStartW.current = panelWidth;
    setDragging(true);
  }, [panelWidth]);

  useEffect(() => {
    if (!dragging) return;
    const onMouseMove = (e) => {
      // Handle is on the RIGHT edge of the panel.
      // Drag RIGHT (larger X) = panel gets wider.
      // Drag LEFT  (smaller X) = panel gets narrower.
      const delta = dragStartX.current - e.clientX;
      const newW  = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, dragStartW.current + delta));
      setPanelWidth(newW);
    };
    const onMouseUp = () => setDragging(false);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup',   onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup',   onMouseUp);
    };
  }, [dragging]);

  // ── Table vertical drag ───────────────────────────────
  const onTableHandleDown = useCallback((e: MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    dragTableStartY.current = e.clientY;
    dragTableStartH.current = tableHeight;
    setDragTable(true);
  }, [tableHeight]);

  useEffect(() => {
    if (!dragTable) return;
    const onMove = (e) => {
      // drag up → bigger, drag down → smaller
      const delta = dragTableStartY.current - e.clientY;
      const newH  = Math.min(600, Math.max(80, dragTableStartH.current + delta));
      setTableHeight(newH);
    };
    const onUp = () => setDragTable(false);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup',   onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup',   onUp);
    };
  }, [dragTable]);

  return (
    <div style={S.shell}>
      <Navbar onTogglePanel={() => setPanelOpen(o => !o)} panelOpen={panelOpen} />

      <div style={{ ...S.body, cursor: dragging ? 'col-resize' : 'default', direction: 'ltr' }}>

        {/* ── LEFT: Map fills all remaining space ── */}
        <div style={S.mapArea}>
          <MapView
            focusCoords={focusCoords}
            layers={pendingLayers}
            onLayersChange={handleLayersConsumed}
          />
          {tableOpen && tableLayers.length > 0 && (
            <div style={{ ...S.tableAnchor, height: tableHeight, cursor: dragTable ? 'row-resize' : 'default' }}>
              {/* Vertical drag handle */}
              <div
                style={{ ...S.tableHandle, borderTop: dragTable ? '2px solid var(--accent)' : '2px solid var(--border2)' }}
                onMouseDown={onTableHandleDown}
                title="גרור לשינוי גובה"
              >
                <div style={S.tableHandleDots}>
                  {[0,1,2].map(i => <div key={i} style={S.tableHandleDot} />)}
                </div>
              </div>
              <div style={S.tableContent}>
                <AttributeTable
                  layers={tableLayers}
                  onClose={() => setTableOpen(false)}
                  onHighlightFeature={handleHighlightFeature}
                />
              </div>
            </div>
          )}
        </div>

        {/* ── RIGHT: Quest panel ── */}
        {panelOpen && (
          <div style={{ ...S.panel, width: panelWidth }}>

            {/* Drag handle on the LEFT edge of the panel (touching the map) */}
            <div
              style={{
                ...S.handle,
                borderLeft: `2px solid ${dragging ? 'var(--accent)' : 'var(--border)'}`,
                background:  dragging ? 'rgba(79,127,255,0.2)' : 'transparent',
              }}
              onMouseDown={onMouseDown}
            >
              <div style={S.dots}>
                {[0,1,2,3,4].map(i => <div key={i} style={S.dot} />)}
              </div>
            </div>

            {/* Panel content */}
            <div style={S.panelContent}>
              <QuestPanel
                quests={quests}
                loading={loading}
                onRefresh={refresh}
                onShowOnMap={(quest: Quest) => {
                  if (typeof quest.lng === 'number' && typeof quest.lat === 'number') {
                    setFocusCoords({ lng: quest.lng, lat: quest.lat });
                  }
                }}
                onLayerAdded={handleLayerAdded}
                onOpenTable={handleOpenTable}
              />
            </div>

          </div>
        )}

      </div>
    </div>
  );
}

const S: Record<string, CSSProperties> = {
  shell: {
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    overflow: 'hidden',
    background: 'var(--bg)',
  },
  // Force LTR so flex order matches visual order:
  // mapArea (left) → panel (right)
  body: {
    flex: 1,
    display: 'flex',
    flexDirection: 'row',
    direction: 'ltr',
    overflow: 'hidden',
  },
  mapArea: {
    flex: 1,
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  tableAnchor: {
    flexShrink: 0,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  tableHandle: {
    height: 8,
    flexShrink: 0,
    cursor: 'row-resize',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'var(--surface)',
    transition: 'border-color 0.15s, background 0.15s',
    userSelect: 'none',
  },
  tableHandleDots: {
    display: 'flex', flexDirection: 'row', gap: 3,
  },
  tableHandleDot: {
    width: 3, height: 3, borderRadius: '50%',
    background: 'var(--border2)',
  },
  tableContent: {
    flex: 1,
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
  },
  panel: {
    flexShrink: 0,
    flexGrow: 0,
    height: '100%',
    display: 'flex',
    flexDirection: 'row',
    background: 'var(--surface)',
    overflow: 'hidden',
  },
  // 8px drag handle on the LEFT side of the panel
  handle: {
    width: 8,
    flexShrink: 0,
    height: '100%',
    cursor: 'col-resize',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'background 0.15s',
    userSelect: 'none',
  },
  dots: {
    display: 'flex',
    flexDirection: 'column',
    gap: 3,
  },
  dot: {
    width: 3,
    height: 3,
    borderRadius: '50%',
    background: 'var(--border2)',
  },
  panelContent: {
    direction: 'rtl',
    flex: 1,
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
  },
};

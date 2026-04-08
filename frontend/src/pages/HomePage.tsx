import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type MouseEvent } from 'react';

import AttributeTable from '../components/AttributeTable';
import IdentifyPanel from '../components/IdentifyPanel';
import MapView from '../components/MapView';
import Navbar from '../components/Navbar';
import QuestPanel from '../components/QuestPanel';
import { useQuests } from '../hooks/useQuests';
import { deleteQuestPointGeometry, deleteQuestPolygonGeometry, getFinishedGeometryCatalog, getGeometryCatalog, saveQuestPointGeometry, updateQuest, uploadQuestPointsGeometry, uploadQuestPolygonGeometry } from '../services/api';
import { getFeaturePoint, getQuestGeometryBounds } from '../utils/geo';
import { isFinishedStatus } from '../utils/quests';
import type { GeometryCatalog, IdentifiedFeature, IdentifyResults, LayerFilters, LngLatPoint, MapBounds, Quest } from '../types/domain';

const MIN_WIDTH = 220;
const MAX_WIDTH = 600;
const DEFAULT_WIDTH = 300;

function createEmptyGeometryCatalog(): GeometryCatalog {
  return {
    quest_types: [],
    points: { type: 'FeatureCollection', features: [] },
    polygons: { type: 'FeatureCollection', features: [] },
  };
}

function syncQuestTypeFilters(current: Record<string, boolean>, questTypes: string[]) {
  const next: Record<string, boolean> = {};
  questTypes.forEach((questType) => {
    next[questType] = current[questType] ?? true;
  });
  return next;
}

export default function HomePage() {
  const { quests, loading, latestNewQuests, refresh } = useQuests();
  const [panelOpen, setPanelOpen] = useState(true);
  const [focusCoords, setFocusCoords] = useState<LngLatPoint | null>(null);
  const [jumpMarker, setJumpMarker] = useState<LngLatPoint | null>(null);
  const [focusBounds, setFocusBounds] = useState<MapBounds | null>(null);
  const [geometryCatalog, setGeometryCatalog] = useState<GeometryCatalog>(createEmptyGeometryCatalog());
  const [finishedGeometryCatalog, setFinishedGeometryCatalog] = useState<GeometryCatalog>(createEmptyGeometryCatalog());
  const [tableHeight, setTableHeight] = useState(260);
  const [dragTable, setDragTable] = useState(false);
  const dragTableStartY = useRef(0);
  const dragTableStartH = useRef(260);
  const [panelWidth, setPanelWidth] = useState(DEFAULT_WIDTH);
  const [dragging, setDragging] = useState(false);
  const dragStartX = useRef(0);
  const dragStartW = useRef(DEFAULT_WIDTH);
  const [layerFilters, setLayerFilters] = useState<LayerFilters>({
    showPoints: false,
    showPolygons: false,
    questTypes: {},
  });
  const [tableViewMode, setTableViewMode] = useState<'all' | 'active' | 'finished'>('all');
  const [identifyResults, setIdentifyResults] = useState<IdentifyResults | null>(null);
  const [selectedIdentifyFeatureId, setSelectedIdentifyFeatureId] = useState<string | number | null>(null);

  const localQuests = useMemo(
    () => quests.filter((quest) => !quest.id.startsWith('external:') && !isFinishedStatus(quest.status)),
    [quests],
  );
  const finishedQuests = useMemo(
    () => quests.filter((quest) => !quest.id.startsWith('external:') && isFinishedStatus(quest.status)),
    [quests],
  );
  const tableOpen = layerFilters.showPoints || layerFilters.showPolygons;

  const filteredGeometryCatalog = useMemo(() => {
    const activeIds = new Set(localQuests.map((q) => q.id));
    const finishedIds = new Set(finishedQuests.map((q) => q.id));

    const filterFeatures = (features: GeometryCatalog['points']['features']) => {
      if (tableViewMode === 'all') return features;
      if (tableViewMode === 'active') {
        return features.filter((f) => activeIds.has(String(f.properties?.quest_id)));
      }
      return features.filter((f) => finishedIds.has(String(f.properties?.quest_id)));
    };

    return {
      ...geometryCatalog,
      points: { ...geometryCatalog.points, features: filterFeatures(geometryCatalog.points.features) },
      polygons: { ...geometryCatalog.polygons, features: filterFeatures(geometryCatalog.polygons.features) },
    };
  }, [geometryCatalog, localQuests, finishedQuests, tableViewMode]);

  const loadGeometryCatalog = useCallback(async () => {
    try {
      const nextCatalog = await getGeometryCatalog();
      setGeometryCatalog(nextCatalog);
      setLayerFilters((current) => ({
        ...current,
        questTypes: syncQuestTypeFilters(current.questTypes, nextCatalog.quest_types),
      }));
      return nextCatalog;
    } catch {
      const emptyCatalog = createEmptyGeometryCatalog();
      setGeometryCatalog(emptyCatalog);
      setLayerFilters((current) => ({
        ...current,
        questTypes: {},
      }));
      return emptyCatalog;
    }
  }, []);

  const handleRefresh = useCallback(async () => {
    const [, catalog] = await Promise.all([refresh(), loadGeometryCatalog()]);
    return catalog;
  }, [loadGeometryCatalog, refresh]);

  const loadFinishedGeometryCatalog = useCallback(async () => {
    try {
      const catalog = await getFinishedGeometryCatalog();
      setFinishedGeometryCatalog(catalog);
      return catalog;
    } catch {
      const emptyCatalog = createEmptyGeometryCatalog();
      setFinishedGeometryCatalog(emptyCatalog);
      return emptyCatalog;
    }
  }, []);

  useEffect(() => {
    void loadGeometryCatalog();
  }, [loadGeometryCatalog, quests]);

  const enableQuestLayers = useCallback((quest: Quest) => {
    const geometryType = quest.geometry_type;
    const questType = String(quest.quest_type || quest.ft || 'Unknown');
    setLayerFilters((current) => ({
      showPoints: current.showPoints || geometryType === 'point',
      showPolygons: current.showPolygons || geometryType === 'polygon',
      questTypes: {
        ...current.questTypes,
        [questType]: true,
      },
    }));
  }, []);

  const handleShowQuestOnMap = useCallback((quest: Quest, catalogOverride?: GeometryCatalog | null) => {
    const activeCatalog = catalogOverride || geometryCatalog;

    if (quest.geometry_type === 'point' || quest.geometry_type === 'polygon') {
      enableQuestLayers(quest);

      if (quest.geometry_type === 'point') {
        const feature = activeCatalog.points.features.find(
          (entry) => String(entry.properties?.quest_id || '') === String(quest.id),
        );
        const point = getFeaturePoint(feature);
        if (point) {
          setFocusBounds(null);
          setFocusCoords(point);
          return;
        }
      }

      const bounds = getQuestGeometryBounds(activeCatalog, quest.id);
      if (bounds) {
        setFocusCoords(null);
        setFocusBounds(bounds);
        return;
      }
    }

    if (typeof quest.lng === 'number' && typeof quest.lat === 'number') {
      setFocusBounds(null);
      setFocusCoords({ lng: quest.lng, lat: quest.lat });
    }
  }, [enableQuestLayers, geometryCatalog]);

  const handleJumpToPoint = useCallback((point: LngLatPoint) => {
    setFocusBounds(null);
    setFocusCoords(point);
    setJumpMarker(point);
  }, []);

  const handleToggleGeometryLayer = useCallback((geometryType: 'point' | 'polygon') => {
    setLayerFilters((current) => (
      geometryType === 'point'
        ? { ...current, showPoints: !current.showPoints }
        : { ...current, showPolygons: !current.showPolygons }
    ));
  }, []);

  const handleToggleQuestType = useCallback((questType: string) => {
    setLayerFilters((current) => ({
      ...current,
      questTypes: {
        ...current.questTypes,
        [questType]: !(current.questTypes[questType] ?? true),
      },
    }));
  }, []);

  const handleIdentify = useCallback((results: IdentifyResults) => {
    setIdentifyResults(results);
    setSelectedIdentifyFeatureId(null);
  }, []);

  const handleClearIdentify = useCallback(() => {
    setIdentifyResults(null);
    setSelectedIdentifyFeatureId(null);
  }, []);

  const handleIdentifyFeatureSelect = useCallback((feature: IdentifiedFeature) => {
    const questId = feature.feature.properties?.quest_id;
    const featureId = questId !== undefined && questId !== null ? String(questId) : (feature.feature.id !== undefined ? String(feature.feature.id) : null);
    setSelectedIdentifyFeatureId(featureId);
  }, []);

  const handleUpdateQuest = useCallback(async (quest: Quest) => {
    const { id, title, status, priority, assigned_user, group, year, date, notes, model_folder, model_simulations } = quest;
    await updateQuest(id, { title, status, priority, assigned_user, group, year, date, notes, model_folder, model_simulations });
    await refresh();
    await loadGeometryCatalog();
  }, [refresh, loadGeometryCatalog]);

  const handleAddGeometry = useCallback(async (questId: string, file: File, type: 'points' | 'shp') => {
    if (type === 'points') {
      await uploadQuestPointsGeometry(questId, file);
    } else {
      await uploadQuestPolygonGeometry(questId, [file]);
    }
    await refresh();
    await loadGeometryCatalog();
  }, [refresh, loadGeometryCatalog]);

  const handleDeleteGeometry = useCallback(async (questId: string, type: 'point' | 'polygon') => {
    if (type === 'point') {
      await deleteQuestPointGeometry(questId);
    } else {
      await deleteQuestPolygonGeometry(questId);
    }
    await refresh();
    await loadGeometryCatalog();
  }, [refresh, loadGeometryCatalog]);

  const handleSavePointGeometry = useCallback(async (questId: string, utm: string) => {
    await saveQuestPointGeometry(questId, utm);
    await refresh();
    await loadGeometryCatalog();
  }, [refresh, loadGeometryCatalog]);

  const onMouseDown = useCallback((event: MouseEvent<HTMLDivElement>) => {
    event.preventDefault();
    dragStartX.current = event.clientX;
    dragStartW.current = panelWidth;
    setDragging(true);
  }, [panelWidth]);

  useEffect(() => {
    if (!dragging) {
      return;
    }

    const onMouseMove = (event: globalThis.MouseEvent) => {
      const delta = dragStartX.current - event.clientX;
      const newWidth = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, dragStartW.current + delta));
      setPanelWidth(newWidth);
    };
    const onMouseUp = () => setDragging(false);

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [dragging]);

  const onTableHandleDown = useCallback((event: MouseEvent<HTMLDivElement>) => {
    event.preventDefault();
    dragTableStartY.current = event.clientY;
    dragTableStartH.current = tableHeight;
    setDragTable(true);
  }, [tableHeight]);

  useEffect(() => {
    if (!dragTable) {
      return;
    }

    const onMove = (event: globalThis.MouseEvent) => {
      const delta = dragTableStartY.current - event.clientY;
      const newHeight = Math.min(600, Math.max(80, dragTableStartH.current + delta));
      setTableHeight(newHeight);
    };
    const onUp = () => setDragTable(false);

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [dragTable]);

  return (
    <div style={S.shell}>
      <Navbar onTogglePanel={() => setPanelOpen((current) => !current)} panelOpen={panelOpen} />

      <div style={{ ...S.body, cursor: dragging ? 'col-resize' : 'default', direction: 'ltr' }}>
        <div style={S.mapArea}>
          <MapView
            focusCoords={focusCoords}
            focusBounds={focusBounds}
            jumpMarker={jumpMarker}
            geometryCatalog={filteredGeometryCatalog}
            filters={layerFilters}
            identifyResults={identifyResults}
            selectedFeatureId={selectedIdentifyFeatureId}
            onIdentify={handleIdentify}
            onClearIdentify={handleClearIdentify}
            onToggleGeometryLayer={handleToggleGeometryLayer}
            onToggleQuestType={handleToggleQuestType}
          />

          {identifyResults && (
            <IdentifyPanel
              results={identifyResults}
              onClose={handleClearIdentify}
              onFeatureSelect={handleIdentifyFeatureSelect}
              selectedFeatureId={selectedIdentifyFeatureId}
            />
          )}

          {tableOpen && (
            <div style={{ ...S.tableAnchor, height: tableHeight, cursor: dragTable ? 'row-resize' : 'default' }}>
              <div
                style={{ ...S.tableHandle, borderTop: dragTable ? '2px solid var(--accent)' : '2px solid var(--border2)' }}
                onMouseDown={onTableHandleDown}
                title="גרור לשינוי גובה"
              >
                <div style={S.tableHandleDots}>
                  {[0, 1, 2].map((index) => <div key={index} style={S.tableHandleDot} />)}
                </div>
              </div>
              <div style={S.tableContent}>
                <AttributeTable
                  quests={localQuests}
                  finishedQuests={finishedQuests}
                  filters={layerFilters}
                  onClose={() => setLayerFilters((current) => ({ ...current, showPoints: false, showPolygons: false }))}
                  onShowQuest={handleShowQuestOnMap}
                  onUpdateQuest={handleUpdateQuest}
                  onAddGeometry={handleAddGeometry}
                  onDeleteGeometry={handleDeleteGeometry}
                  onSavePointGeometry={handleSavePointGeometry}
                  onRefreshFinished={loadFinishedGeometryCatalog}
                  onViewModeChange={setTableViewMode}
                />
              </div>
            </div>
          )}
        </div>

        {panelOpen && (
          <div style={{ ...S.panel, width: panelWidth }}>
            <div
              style={{
                ...S.handle,
                borderLeft: `2px solid ${dragging ? 'var(--accent)' : 'var(--border)'}`,
                background: dragging ? 'rgba(79,127,255,0.2)' : 'transparent',
              }}
              onMouseDown={onMouseDown}
            >
              <div style={S.dots}>
                {[0, 1, 2, 3, 4].map((index) => <div key={index} style={S.dot} />)}
              </div>
            </div>

            <div style={S.panelContent}>
              <QuestPanel
                quests={quests}
                loading={loading}
                latestNewQuests={latestNewQuests}
                onRefresh={handleRefresh}
                onShowOnMap={handleShowQuestOnMap}
                onJumpToPoint={handleJumpToPoint}
              />
            </div>
          </div>
        )}
      </div>

      <div style={S.credit}>© Itay Avsiyvich</div>
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
    display: 'flex',
    flexDirection: 'row',
    gap: 3,
  },
  tableHandleDot: {
    width: 3,
    height: 3,
    borderRadius: '50%',
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
  credit: {
    position: 'fixed',
    left: 14,
    bottom: 10,
    zIndex: 50,
    fontSize: 11,
    color: 'var(--text3)',
    background: 'var(--overlay)',
    border: '1px solid var(--overlay-border)',
    borderRadius: 999,
    padding: '4px 10px',
    backdropFilter: 'blur(6px)',
    pointerEvents: 'none',
  },
};

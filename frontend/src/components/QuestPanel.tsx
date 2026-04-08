import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type FormEvent,
} from 'react';

import { useAuth } from '../context/AuthContext';
import { getStoredQuestSortOrder, saveStoredQuestSortOrder } from '../lib/questSortStorage';
import { createQuest, setQuestStatus } from '../services/api';
import { FT_OPTIONS, ftColor } from '../services/ftConfig';
import type { FtOption, GeometryCatalog, LngLatPoint, Quest } from '../types/domain';
import { parseUTM } from '../utils/geo';
import {
  QUEST_SORT_OPTIONS,
  QUEST_VIEWS,
  getQuestDisplayStatus,
  getQuestStatusLabel,
  getQuestView,
  isLowPriorityQuest,
  normalizeQuestStatus,
  reorderQuestList,
  sortQuestsByOption,
  sortQuests,
  type QuestSearchScope,
  type QuestSortOptionId,
  type QuestViewId,
} from '../utils/quests';
import {
  QUEST_PANEL_COLUMNS,
  QUEST_PANEL_DEFAULT_COL_WIDTHS,
  QUEST_STATUS_OPTIONS,
  type QuestPanelColumnKey,
} from '../config/questTableColumns';
import { filterQuests } from '../utils/quests';
import { DEFAULT_STATUS, QUICK_CREATE_STATUS_OPTIONS } from '../utils/questOptions';
import QuestItem from './QuestItem';

interface QuestPanelProps {
  quests: Quest[];
  loading: boolean;
  latestNewQuests: Quest[];
  onRefresh: () => Promise<GeometryCatalog | null> | GeometryCatalog | null;
  onShowOnMap: (quest: Quest, catalogOverride?: GeometryCatalog | null) => Promise<void> | void;
  onJumpToPoint: (point: LngLatPoint) => void;
}

export default function QuestPanel({
  quests,
  loading,
  latestNewQuests,
  onRefresh,
  onShowOnMap,
  onJumpToPoint,
}: QuestPanelProps) {
  const notificationTimeoutsRef = useRef<number[]>([]);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const { user } = useAuth();
  const [compactTabs, setCompactTabs] = useState(false);
  const [view, setView] = useState<QuestViewId>('open');
  const [search, setSearch] = useState('');
  const [searchScope, setSearchScope] = useState<QuestSearchScope>('current');
  const [showNew, setShowNew] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newYear, setNewYear] = useState(2026);
  const [newFt, setNewFt] = useState<FtOption>('FT1');
  const [newStatus, setNewStatus] = useState<string>(DEFAULT_STATUS);
  const [newPriority, setNewPriority] = useState<'גבוה' | 'רגיל' | 'נמוך'>('רגיל');
  const [showJump, setShowJump] = useState(false);
  const [jumpMode, setJumpMode] = useState<'utm' | 'dd'>('utm');
  const [jumpLat, setJumpLat] = useState('');
  const [jumpLng, setJumpLng] = useState('');
  const [jumpUtm, setJumpUtm] = useState('');
  const [jumpError, setJumpError] = useState('');
  const [creating, setCreating] = useState(false);
  const [sortCol, setSortCol] = useState<QuestPanelColumnKey | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({});
  const [resizing, setResizing] = useState<{ key: QuestPanelColumnKey; startX: number; startWidth: number } | null>(null);
  const resizingRef = useRef<{ key: QuestPanelColumnKey; startX: number; startWidth: number } | null>(null);
  const [listSort, setListSort] = useState<QuestSortOptionId>('manual');
  const [listSortDir, setListSortDir] = useState<'asc' | 'desc'>('asc');
  const [manualOrderByView, setManualOrderByView] = useState<Record<QuestViewId, string[]>>({
    open: [],
    done: [],
    stopped: [],
    more: [],
    new: [],
    low: [],
  });
  const [draggedQuestId, setDraggedQuestId] = useState<string | null>(null);
  const [savingSort, setSavingSort] = useState(false);
  const [sortStatus, setSortStatus] = useState('');
  const [toastNotifications, setToastNotifications] = useState<Array<{ id: string; title: string }>>([]);

  const isLeader = user?.role === 'Team Leader';
  const sortableViews = useMemo<QuestViewId[]>(() => ['open', 'done', 'stopped', 'more'], []);
  const canPersistManualSort = isLeader && sortableViews.includes(view);
  const currentView = getQuestView(view);
  const currentGroup = user?.group || 'לווינות';
  const newQuestCount = useMemo(() => quests.filter((quest) => quest.isNew).length, [quests]);
  const filteredBase = useMemo(
    () => filterQuests(quests, view, search, searchScope),
    [quests, view, search, searchScope]
  );
  const filtered = filteredBase;
  const questCountByView = useMemo<Record<QuestViewId, number>>(
    () => ({
      open: filterQuests(quests, 'open', '', 'current').length,
      done: filterQuests(quests, 'done', '', 'current').length,
      stopped: filterQuests(quests, 'stopped', '', 'current').length,
      more: filterQuests(quests, 'more', '', 'current').length,
      new: filterQuests(quests, 'new', '', 'current').length,
      low: filterQuests(quests, 'low', '', 'current').length,
    }),
    [quests]
  );
  const sortedRows = useMemo(() => sortQuests(filtered, sortCol, sortDir), [filtered, sortCol, sortDir]);
  const orderedFiltered = useMemo(() => {
    const manualOrder = manualOrderByView[view] || [];
    const questMap = new Map(filtered.map((quest) => [quest.id, quest]));
    const manualQuests = manualOrder
      .map((questId) => questMap.get(questId))
      .filter((quest): quest is Quest => Boolean(quest));
    const missingQuests = filtered.filter((quest) => !manualOrder.includes(quest.id));
    return [...manualQuests, ...missingQuests];
  }, [filtered, manualOrderByView, view]);
  const displayedQuests = useMemo(
    () => sortQuestsByOption(orderedFiltered, listSort, listSortDir),
    [orderedFiltered, listSort, listSortDir]
  );

  const manualSortDisabled = listSort !== 'manual' || searchScope === 'all';

  useEffect(() => {
    return () => {
      notificationTimeoutsRef.current.forEach((timeoutId) => window.clearTimeout(timeoutId));
    };
  }, []);

  useEffect(() => {
    const panelElement = panelRef.current;
    if (!panelElement || typeof ResizeObserver === 'undefined') {
      return;
    }

    const observer = new ResizeObserver((entries) => {
      const nextWidth = entries[0]?.contentRect.width ?? panelElement.clientWidth;
      setCompactTabs(nextWidth < 560);
    });
    observer.observe(panelElement);

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      const r = resizingRef.current;
      if (!r) return;
      const delta = -(event.clientX - r.startX);
      const newWidth = Math.max(60, r.startWidth + delta);
      setColumnWidths((prev) => ({ ...prev, [r.key]: newWidth }));
    };

    const handleMouseUp = () => {
      setResizing(null);
      resizingRef.current = null;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [resizing]);

  useEffect(() => {
    if (latestNewQuests.length === 0) {
      return;
    }

    const entries = latestNewQuests.map((quest) => ({
      id: `${quest.id}-${Date.now()}`,
      title: quest.title,
    }));

    setToastNotifications((current) => [...entries, ...current].slice(0, 4));

    entries.forEach((entry) => {
      const timeoutId = window.setTimeout(() => {
        setToastNotifications((current) => current.filter((notification) => notification.id !== entry.id));
      }, 5500);
      notificationTimeoutsRef.current.push(timeoutId);
    });
  }, [latestNewQuests]);

  useEffect(() => {
    let cancelled = false;

    async function loadSavedSort() {
      if (!sortableViews.includes(view)) {
        setSortStatus('');
        return;
      }

      try {
        const questIds = getStoredQuestSortOrder(currentGroup, view);
        if (cancelled) {
          return;
        }
        setManualOrderByView((current) => ({
          ...current,
          [view]: questIds,
        }));
      } catch {
        if (!cancelled) {
          setSortStatus('');
        }
      }
    }

    void loadSavedSort();

    return () => {
      cancelled = true;
    };
  }, [currentGroup, sortableViews, view]);

  const handleSort = (col: QuestPanelColumnKey) => {
    if (sortCol === col) {
      setSortDir((current) => (current === 'asc' ? 'desc' : 'asc'));
      return;
    }

    setSortCol(col);
    setSortDir('asc');
  };

  const startResize = (event: React.MouseEvent, key: QuestPanelColumnKey) => {
    event.preventDefault();
    event.stopPropagation();
    const width = columnWidths[key] || QUEST_PANEL_DEFAULT_COL_WIDTHS[key] || 120;
    const state = { key, startX: event.clientX, startWidth: width };
    setResizing(state);
    resizingRef.current = state;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  };

  const getColumnWidth = (key: QuestPanelColumnKey) =>
    columnWidths[key] || QUEST_PANEL_DEFAULT_COL_WIDTHS[key] || undefined;

  const handleListSortChange = (nextSortId: QuestSortOptionId) => {
    setListSort(nextSortId);
    const nextOption = QUEST_SORT_OPTIONS.find((option) => option.id === nextSortId);
    setListSortDir(nextOption?.defaultDirection ?? 'asc');
  };

  const handleQuestDrop = (targetQuestId: string) => {
    if (draggedQuestId === null || draggedQuestId === targetQuestId || manualSortDisabled) {
      setDraggedQuestId(null);
      return;
    }

    setManualOrderByView((current) => {
      const currentIds = displayedQuests.map((quest) => quest.id);
      const currentOrder = current[view]?.length ? current[view] : currentIds;
      const currentQuests = currentOrder
        .map((questId) => displayedQuests.find((quest) => quest.id === questId))
        .filter((quest): quest is Quest => Boolean(quest));
      const reordered = reorderQuestList(currentQuests, draggedQuestId, targetQuestId);

      return {
        ...current,
        [view]: reordered.map((quest) => quest.id),
      };
    });
    setDraggedQuestId(null);
    setSortStatus('יש שינויים שלא נשמרו');
  };

  const handleSaveSort = async () => {
    if (!canPersistManualSort) {
      return;
    }

    setSavingSort(true);
    try {
      const questIds = saveStoredQuestSortOrder(currentGroup, view, displayedQuests.map((quest) => quest.id));
      setManualOrderByView((current) => ({
        ...current,
        [view]: questIds,
      }));
      setSortStatus('המיון נשמר');
    } catch {
      setSortStatus('שגיאה בשמירת המיון');
    } finally {
      setSavingSort(false);
    }
  };

  const handleCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!newTitle.trim()) {
      return;
    }

    setCreating(true);
    try {
      await createQuest({
        title: newTitle,
        description: newDesc,
        status: newStatus,
        priority: newPriority,
        year: newYear,
        ft: newFt,
        quest_type: newFt,
        group: 'לווינות',
      });
      setNewTitle('');
      setNewDesc('');
      setNewYear(2026);
      setNewFt('FT1');
      setNewStatus(DEFAULT_STATUS);
      setNewPriority('רגיל');
      setShowNew(false);
      await onRefresh();
    } catch {
      alert('שגיאה ביצירת משימה');
    } finally {
      setCreating(false);
    }
  };

  const getQuestPanelCellValue = (quest: Quest, column: QuestPanelColumnKey, index: number) => {
    if (column === 'id') return index + 1;
    if (column === 'status') return getQuestStatusLabel(getQuestDisplayStatus(quest));
    const value = quest[column as keyof Quest];
    return value ?? '';
  };

  const exportCSV = () => {
    const header = QUEST_PANEL_COLUMNS.map((col) => col.label).join(',');
    const rows = sortedRows.map((q, i) =>
      QUEST_PANEL_COLUMNS
        .map((col) => getQuestPanelCellValue(q, col.key, i))
        .map((v) => `"${String(v || '').replace(/"/g, '""')}"`)
        .join(',')
    ).join('\n');
    const blob = new Blob(['\uFEFF' + header + '\n' + rows], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a'); a.href = url;
    a.download = `quests_${view}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const handleJumpSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (jumpMode === 'utm') {
      const point = parseUTM(jumpUtm);
      if (!point) {
        setJumpError('יש להזין UTM בפורמט כמו 36R 712345 3512345');
        return;
      }
      setJumpError('');
      onJumpToPoint(point);
      return;
    }

    const lat = Number(jumpLat.trim());
    const lng = Number(jumpLng.trim());

    if (Number.isNaN(lat) || Number.isNaN(lng)) {
      setJumpError('יש להזין קו רוחב וקו אורך במספרים');
      return;
    }

    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      setJumpError('קו רוחב חייב להיות בין 90- ל-90 וקו אורך בין 180- ל-180');
      return;
    }

    setJumpError('');
    onJumpToPoint({ lat, lng });
  };

  const toggleSearchScope = () => {
    setSearchScope((current) => (current === 'current' ? 'all' : 'current'));
  };

  // ── Fullscreen Excel view ─────────────────────────────
  if (fullscreen) {
    return (
      <div style={FS.overlay}>
        <div style={FS.modal}>
          {/* Modal header */}
          <div style={FS.header}>
            <div style={FS.headerLeft}>
              <span style={FS.title}>📊 {currentView.icon} {currentView.label}</span>
              <span style={FS.count}>{sortedRows.length} משימות</span>
            </div>
            <div style={FS.headerRight}>
              {/* View tabs inside fullscreen */}
              <div style={FS.tabs}>
                {QUEST_VIEWS.map(v => (
                  <button key={v.id}
                    style={{ ...FS.tab, ...(view === v.id ? FS.tabActive : {}) }}
                    onClick={() => {
                      setView(v.id);
                    }}
                  >{v.icon} {v.label}</button>
                ))}
              </div>
              <div style={FS.searchRow}>
                <input
                  style={FS.search}
                  placeholder="🔍 חיפוש..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
                <button
                  className="btn btn-ghost btn-sm"
                  type="button"
                  onClick={toggleSearchScope}
                  title={searchScope === 'current' ? 'חיפוש רק בתצוגה הנוכחית' : 'חיפוש בכל המשימות'}
                >
                  {searchScope === 'current' ? 'בתצוגה' : 'בכל'}
                </button>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={exportCSV}>⬇ CSV</button>
              <button className="btn btn-ghost btn-sm" onClick={onRefresh}>↻</button>
              <button className="btn btn-ghost btn-sm" onClick={() => setFullscreen(false)}>✕ סגור</button>
            </div>
          </div>

          {/* Excel table */}
          <div style={FS.tableWrap}>
            <table style={FS.table}>
              <thead>
                <tr>
                  {QUEST_PANEL_COLUMNS.map((col) => (
                    <th
                      key={col.key}
                      style={{ ...FS.th, width: getColumnWidth(col.key), minWidth: 80 }}
                      onClick={() => {
                        if (resizing) return;
                        handleSort(col.key);
                      }}
                    >
                      <div style={FS.thContent}>
                        <span style={FS.thLabel}>
                          {col.label} {sortCol === col.key ? (sortDir === 'asc' ? '↑' : '↓') : ''}
                        </span>
                        <div
                          style={{
                            ...FS.resizeHandle,
                            ...(resizing?.key === col.key ? FS.resizeHandleActive : {}),
                          }}
                          onMouseDown={(event) => startResize(event, col.key)}
                        />
                      </div>
                    </th>
                  ))}
                  {isLeader && <th style={{ ...FS.th, width: 100, minWidth: 90 }}>סטטוס</th>}
                </tr>
              </thead>
              <tbody>
                {sortedRows.map((q, i) => {
                  const clr = ftColor(q.ft);
                  return (
                    <tr
                      key={q.id}
                      style={{ ...FS.tr, ...FS.trClickable, borderRight: `3px solid ${clr}` }}
                      onClick={() => void onShowOnMap(q)}
                    >
                      {QUEST_PANEL_COLUMNS.map((col) => {
                        if (col.key === 'id') {
                          return (
                            <td key={`${q.id}-id`} style={{ ...FS.td, width: getColumnWidth(col.key) }}>
                              {i + 1}
                            </td>
                          );
                        }
                        if (col.key === 'title') {
                          return (
                            <td key={`${q.id}-title`} style={{ ...FS.td, fontWeight: 600, width: getColumnWidth(col.key) }}>
                              {q.title}
                            </td>
                          );
                        }
                        if (col.key === 'ft') {
                          return (
                            <td key={`${q.id}-ft`} style={{ ...FS.td, width: getColumnWidth(col.key) }}>
                              <span style={{ ...FS.ftBadge, background: clr + '22', color: clr, border: `1px solid ${clr}55` }}>
                                {q.ft || '—'}
                              </span>
                            </td>
                          );
                        }
                        if (col.key === 'status') {
                          return (
                            <td key={`${q.id}-status`} style={{ ...FS.td, width: getColumnWidth(col.key) }}>
                              <span style={FS.statusBadge} data-status={getQuestDisplayStatus(q)}>
                                {getQuestDisplayStatus(q) === 'New' ? '🔔 חדש' : getQuestStatusLabel(getQuestDisplayStatus(q))}
                              </span>
                              {isLowPriorityQuest(q) && <span style={FS.priorityBadge}> תעדוף נמוך</span>}
                            </td>
                          );
                        }
                        if (col.key === 'description') {
                          return (
                            <td
                              key={`${q.id}-description`}
                              style={{ ...FS.td, width: getColumnWidth(col.key), color: 'var(--text2)', fontSize: 11 }}
                            >
                              {q.description || '—'}
                            </td>
                          );
                        }
                        if (col.key === 'notes') {
                          return (
                            <td
                              key={`${q.id}-notes`}
                              style={{ ...FS.td, width: getColumnWidth(col.key), color: 'var(--text2)', fontSize: 11 }}
                            >
                              {q.notes || '—'}
                            </td>
                          );
                        }
                        if (col.key === 'model_folder') {
                          return (
                            <td key={`${q.id}-model_folder`} style={{ ...FS.td, width: getColumnWidth(col.key), fontFamily: 'monospace' }}>
                              {q.model_folder || '—'}
                            </td>
                          );
                        }
                        return (
                          <td key={`${q.id}-${col.key}`} style={{ ...FS.td, width: getColumnWidth(col.key) }}>
                            {String(q[col.key as keyof Quest] ?? '—')}
                          </td>
                        );
                      })}
                      {isLeader && (
                        <td style={{ ...FS.td, width: 140 }}>
                          <select
                            style={FS.select}
                            value={normalizeQuestStatus(q.status) ?? q.status}
                            onClick={(e) => e.stopPropagation()}
                            onChange={async (e) => {
                              await setQuestStatus(q.id, e.target.value);
                              onRefresh();
                            }}
                          >
                            {QUEST_STATUS_OPTIONS.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {sortedRows.length === 0 && (
              <div style={FS.empty}>אין משימות בקטגוריה זו</div>
            )}
          </div>

          <div style={FS.footer}>
            <span style={{ fontSize: 11, color: 'var(--text3)' }}>
              {sortedRows.length} / {quests.length} משימות • לחץ על עמודה למיון
            </span>
          </div>
        </div>
      </div>
    );
  }

  // ── Normal panel view ─────────────────────────────────
  return (
    <div ref={panelRef} style={S.panel}>

      {/* ── View tabs ─────────────────────────────────── */}
      <div style={S.tabs}>
        {QUEST_VIEWS.map(v => {
          const cnt = questCountByView[v.id];
          return (
            <button
              key={v.id}
              style={{ ...S.tab, ...(view === v.id ? S.tabActive : {}) }}
              title={v.label}
              onClick={() => {
                setView(v.id);
              }}
            >
              <span>{v.icon}</span>
              {!compactTabs && <span>{v.label}</span>}
              {!compactTabs && cnt > 0 && <span style={{ ...S.tabCount, ...(view === v.id ? S.tabCountActive : {}) }}>{cnt}</span>}
            </button>
          );
        })}
      </div>

      {/* ── Header ────────────────────────────────────── */}
      <div style={S.header}>
        <div style={S.headerRow}>
          <span style={S.title}>{currentView.icon} {currentView.label}</span>
          <div style={S.headerActions}>
            <span style={S.countBadge}>{filtered.length}</span>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => {
                setView('new');
              }}
              title="משימות חדשות"
              style={newQuestCount > 0 ? S.bellButtonActive : undefined}
            >
              🔔
              {newQuestCount > 0 && <span style={S.bellCount}>{newQuestCount}</span>}
            </button>
            <button className="btn btn-ghost btn-sm" onClick={() => setShowJump((current) => !current)} title="קפיצה לנקודה">
              {showJump ? '✕ סגור' : '📍'}
            </button>
            {isLeader && (
              <button className="btn btn-primary btn-sm" onClick={() => setShowNew(v => !v)}>
                {showNew ? '✕' : '+ חדש'}
              </button>
            )}
            <button className="btn btn-ghost btn-sm" onClick={() => setFullscreen(true)} title="מסך מלא">⛶</button>
          </div>
        </div>

        {/* New quest form */}
        {showNew && isLeader && (
          <form onSubmit={handleCreate} style={S.newForm}>
            <input className="input" placeholder="כותרת משימה *" value={newTitle}
              onChange={e => setNewTitle(e.target.value)} required style={{ fontSize: 13 }} />
            <textarea className="input" placeholder="תיאור (אופציונלי)" value={newDesc}
              onChange={e => setNewDesc(e.target.value)} rows={2} style={{ resize: 'vertical', fontSize: 13 }} />
            <div style={{ display: 'flex', gap: 6 }}>
              <select className="input" value={newFt} onChange={e => setNewFt(e.target.value as FtOption)} style={{ fontSize: 13, flex: 1 }}>
                {FT_OPTIONS.map(ft => <option key={ft} value={ft}>{ft}</option>)}
              </select>
              <select className="input" value={newStatus} onChange={e => setNewStatus(e.target.value)} style={{ fontSize: 13, flex: 1 }}>
                {QUICK_CREATE_STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <select className="input" value={newPriority} onChange={e => setNewPriority(e.target.value as 'גבוה' | 'רגיל' | 'נמוך')} style={{ fontSize: 13, flex: 1 }}>
                <option value="גבוה">תעדוף גבוה</option>
                <option value="רגיל">תעדוף רגיל</option>
                <option value="נמוך">תעדוף נמוך</option>
              </select>
              <button className="btn btn-primary" type="submit" disabled={creating || !newTitle.trim()}>
                {creating ? '...' : 'צור'}
              </button>
            </div>
          </form>
        )}

        {showJump && (
          <form onSubmit={handleJumpSubmit} style={S.jumpForm}>
            <div style={S.jumpHeader}>📍 Jump To Point</div>
            <div style={S.jumpToggleRow}>
              <button
                className="btn btn-ghost btn-sm"
                type="button"
                onClick={() => {
                  setJumpMode('utm');
                  setJumpError('');
                }}
                style={jumpMode === 'utm' ? S.jumpModeActive : undefined}
              >
                UTM
              </button>
              <button
                className="btn btn-ghost btn-sm"
                type="button"
                onClick={() => {
                  setJumpMode('dd');
                  setJumpError('');
                }}
                style={jumpMode === 'dd' ? S.jumpModeActive : undefined}
              >
                DD
              </button>
            </div>
            {jumpMode === 'utm' ? (
              <input
                className="input"
                placeholder="36R 712345 3512345"
                value={jumpUtm}
                onChange={(event) => {
                  setJumpUtm(event.target.value);
                  if (jumpError) {
                    setJumpError('');
                  }
                }}
                style={{ fontSize: 13 }}
              />
            ) : (
              <div style={S.jumpRow}>
                <input
                  className="input"
                  placeholder="קו רוחב / Latitude"
                  value={jumpLat}
                  onChange={(event) => {
                    setJumpLat(event.target.value);
                    if (jumpError) {
                      setJumpError('');
                    }
                  }}
                  style={{ fontSize: 13, flex: 1 }}
                />
                <input
                  className="input"
                  placeholder="קו אורך / Longitude"
                  value={jumpLng}
                  onChange={(event) => {
                    setJumpLng(event.target.value);
                    if (jumpError) {
                      setJumpError('');
                    }
                  }}
                  style={{ fontSize: 13, flex: 1 }}
                />
              </div>
            )}
            <div style={S.jumpActions}>
              <div style={S.jumpHint}>
                {jumpMode === 'utm' ? 'ברירת מחדל: UTM. אפשר לעבור ל-DD אם צריך' : 'דוגמה ל-DD: 31.778, 35.235'}
              </div>
              <button className="btn btn-primary btn-sm" type="submit">
                📍 הצג על המפה
              </button>
            </div>
            {jumpError && <div style={S.jumpError}>{jumpError}</div>}
          </form>
        )}

        {/* Search */}
        <div style={S.searchRow}>
          <input
            className="input"
            placeholder="🔍 חיפוש..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ ...S.searchInput, fontSize: 13 }}
          />
          <button
            className="btn btn-ghost btn-sm"
            type="button"
            onClick={toggleSearchScope}
            title={searchScope === 'current' ? 'חיפוש רק בתצוגה הנוכחית' : 'חיפוש בכל המשימות'}
          >
            {searchScope === 'current' ? 'בתצוגה' : 'בכל'}
          </button>
        </div>
        <div style={S.sortRow}>
          <select
            className="input"
            value={listSort}
            onChange={(e) => handleListSortChange(e.target.value as QuestSortOptionId)}
            style={{ fontSize: 13, flex: 1 }}
          >
            {QUEST_SORT_OPTIONS.map((option) => (
              <option key={option.id} value={option.id}>
                מיין לפי {option.label}
              </option>
            ))}
          </select>
          <button
            className="btn btn-ghost btn-sm"
            type="button"
            onClick={() => setListSortDir((current) => (current === 'asc' ? 'desc' : 'asc'))}
            disabled={listSort === 'manual'}
            title={listSortDir === 'asc' ? 'סדר עולה' : 'סדר יורד'}
          >
            {listSortDir === 'asc' ? '↑' : '↓'}
          </button>
          {canPersistManualSort && listSort === 'manual' && searchScope !== 'all' && (
            <button
              className="btn btn-primary btn-sm"
              type="button"
              onClick={() => void handleSaveSort()}
              disabled={savingSort || displayedQuests.length === 0}
            >
              {savingSort ? 'שומר...' : 'שמור מיון'}
            </button>
          )}
        </div>
        {listSort === 'manual' && (
          <div style={S.sortHint}>
            גרור משימות ברשימה כדי לשנות סדר ידני
            {sortStatus ? ` • ${sortStatus}` : ''}
          </div>
        )}
      </div>

      {/* ── Quest list ────────────────────────────────── */}
      <div style={S.list}>
        {loading ? (
          <div style={S.center}><span className="spinner" /></div>
        ) : filtered.length === 0 ? (
          <div style={S.empty}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>{currentView.icon}</div>
            <div>אין משימות ב{currentView.label}</div>
          </div>
        ) : (
          displayedQuests.map(q => (
            <div
              key={q.id}
              draggable={!manualSortDisabled}
              onDragStart={() => setDraggedQuestId(q.id)}
              onDragOver={(event) => {
                if (!manualSortDisabled) {
                  event.preventDefault();
                }
              }}
              onDrop={() => handleQuestDrop(q.id)}
              onDragEnd={() => setDraggedQuestId(null)}
              style={{
                ...S.dragItem,
                ...(draggedQuestId === q.id ? S.dragItemActive : {}),
                ...(manualSortDisabled ? S.dragItemDisabled : {}),
              }}
            >
              <QuestItem
                quest={q}
                user={user}
                onRefresh={onRefresh}
                onShowOnMap={onShowOnMap}
              />
            </div>
          ))
        )}
      </div>

      {/* ── Footer ────────────────────────────────────── */}
      <div style={S.footer}>
        <span style={S.footerText}>{filtered.length} / {quests.length} משימות</span>
      </div>

      {toastNotifications.length > 0 && (
        <div style={S.notifications}>
          {toastNotifications.map((notification) => (
            <button
              key={notification.id}
              type="button"
              style={S.notificationToast}
              onClick={() => {
                setView('new');
                setToastNotifications((current) => current.filter((entry) => entry.id !== notification.id));
              }}
            >
              <span style={S.notificationIcon}>🔔</span>
              <span style={S.notificationText}>New quest: {notification.title}</span>
            </button>
          ))}
        </div>
      )}

    </div>
  );
}

// ── Panel styles ──────────────────────────────────────────────
const S: Record<string, CSSProperties> = {
  panel:   { display:'flex', flexDirection:'column', height:'100%', overflow:'hidden', background:'var(--surface)' },
  tabs:    { display:'flex', borderBottom:'1px solid var(--border)', flexShrink:0 },
  tab: {
    flex:1, padding:'8px 4px', fontSize:11, fontWeight:600,
    background:'transparent', border:'none', borderBottom:'2px solid transparent',
    color:'var(--text3)', cursor:'pointer', fontFamily:'var(--font)',
    display:'flex', alignItems:'center', justifyContent:'center', gap:4,
    transition:'all 0.15s',
  },
  tabActive: { color:'var(--accent)', borderBottomColor:'var(--accent)', background:'rgba(79,127,255,0.06)' },
  tabCount: {
    fontSize:10, fontWeight:700, padding:'1px 5px',
    borderRadius:20, background:'var(--surface2)', color:'var(--text3)',
  },
  tabCountActive: { background:'rgba(79,127,255,0.2)', color:'var(--accent)' },
  moreTabs: {
    display:'flex',
    gap:8,
    padding:'8px 12px',
    borderBottom:'1px solid var(--border)',
    background:'var(--surface2)',
  },
  moreTabButton: {
    display:'inline-flex',
    alignItems:'center',
    gap:6,
    padding:'6px 12px',
    borderRadius:999,
    border:'1px solid var(--border)',
    background:'transparent',
    color:'var(--text2)',
    cursor:'pointer',
    fontFamily:'var(--font)',
    fontSize:12,
    fontWeight:700,
  },
  moreTabButtonActive: {
    borderColor:'var(--accent)',
    background:'rgba(79,127,255,0.12)',
    color:'var(--text)',
  },
  moreTabCount: {
    fontSize:10,
    fontWeight:800,
    padding:'1px 6px',
    borderRadius:99,
    background:'rgba(255,255,255,0.08)',
    color:'inherit',
  },
  header:  { flexShrink:0, padding:'10px 12px 8px', borderBottom:'1px solid var(--border)', display:'flex', flexDirection:'column', gap:8 },
  headerRow: { display:'flex', justifyContent:'space-between', alignItems:'center' },
  headerActions: { display:'flex', alignItems:'center', gap:5 },
  title:   { fontSize:13, fontWeight:700, color:'var(--text)' },
  countBadge: { background:'rgba(79,127,255,0.15)', color:'var(--accent)', borderRadius:20, fontSize:11, fontWeight:700, padding:'1px 8px' },
  bellButtonActive: { borderColor:'rgba(245, 158, 11, 0.4)', background:'rgba(245, 158, 11, 0.12)', color:'var(--gold)' },
  bellCount: {
    display:'inline-flex',
    alignItems:'center',
    justifyContent:'center',
    minWidth:18,
    height:18,
    padding:'0 5px',
    borderRadius:99,
    background:'var(--gold)',
    color:'#1f1605',
    fontSize:10,
    fontWeight:800,
  },
  newForm: { display:'flex', flexDirection:'column', gap:6, background:'var(--surface2)', border:'1px solid var(--border)', borderRadius:'var(--radius)', padding:10 },
  jumpForm: { display:'flex', flexDirection:'column', gap:8, background:'var(--surface2)', border:'1px solid var(--border)', borderRadius:'var(--radius)', padding:10 },
  jumpHeader: { fontSize:12, fontWeight:700, color:'var(--text)' },
  jumpToggleRow: { display:'flex', gap:6 },
  jumpModeActive: { background:'var(--accent-soft)', borderColor:'var(--accent)', color:'var(--text)' },
  jumpRow: { display:'flex', gap:6 },
  jumpActions: { display:'flex', justifyContent:'space-between', alignItems:'center', gap:8, flexWrap:'wrap' },
  jumpHint: { fontSize:11, color:'var(--text3)' },
  jumpError: { fontSize:11, color:'var(--red)' },
  searchRow: { display:'flex', gap:6, alignItems:'center' },
  searchInput: { flex:1 },
  sortRow: { display:'flex', gap:6, alignItems:'center' },
  sortHint: { fontSize:11, color:'var(--text3)' },
  list:    { flex:1, overflowY:'auto', overflowX:'hidden', padding:'8px', display:'flex', flexDirection:'column', gap:6, scrollbarWidth:'thin', scrollbarColor:'var(--border2) transparent' },
  dragItem: { borderRadius: 12 },
  dragItemActive: { opacity: 0.45 },
  dragItemDisabled: { cursor: 'default' },
  center:  { display:'flex', justifyContent:'center', padding:40 },
  empty:   { textAlign:'center', color:'var(--text3)', fontSize:13, padding:'40px 0' },
  footer:  { flexShrink:0, padding:'7px 12px', borderTop:'1px solid var(--border)', display:'flex', justifyContent:'center' },
  footerText: { fontSize:11, color:'var(--text3)' },
  notifications: {
    position:'fixed',
    right:20,
    bottom:20,
    display:'flex',
    flexDirection:'column',
    gap:10,
    zIndex:2100,
    maxWidth:320,
  },
  notificationToast: {
    display:'flex',
    alignItems:'center',
    gap:10,
    width:'100%',
    padding:'12px 14px',
    borderRadius:14,
    border:'1px solid rgba(245, 158, 11, 0.28)',
    background:'rgba(25, 23, 16, 0.96)',
    boxShadow:'0 12px 30px rgba(0,0,0,0.28)',
    color:'#fff4d6',
    cursor:'pointer',
    textAlign:'left',
  },
  notificationIcon: { fontSize:16, flexShrink:0 },
  notificationText: { fontSize:12, fontWeight:600, lineHeight:1.4 },
};

// ── Fullscreen / Excel styles ─────────────────────────────────
const FS: Record<string, CSSProperties> = {
  overlay: {
    position:'fixed', inset:0, zIndex:2000,
    background:'rgba(0,0,0,0.7)',
    display:'flex', alignItems:'center', justifyContent:'center',
    backdropFilter:'blur(4px)',
  },
  modal: {
    width:'92vw', height:'88vh',
    background:'var(--surface)',
    border:'1px solid var(--border)',
    borderRadius:'var(--radius-lg)',
    boxShadow:'var(--shadow)',
    display:'flex', flexDirection:'column',
    overflow:'hidden',
  },
  header: {
    display:'flex', justifyContent:'space-between', alignItems:'center',
    padding:'12px 16px', borderBottom:'1px solid var(--border)', flexShrink:0, gap:10,
  },
  headerLeft:  { display:'flex', alignItems:'center', gap:10 },
  headerRight: { display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' },
  title:  { fontSize:15, fontWeight:700, color:'var(--text)' },
  count:  { background:'rgba(79,127,255,0.15)', color:'var(--accent)', borderRadius:20, fontSize:11, fontWeight:700, padding:'2px 10px' },
  tabs:   { display:'flex', gap:4 },
  subtabs: { display:'flex', gap:6 },
  tab: {
    padding:'4px 12px', borderRadius:20, fontSize:12, fontWeight:600,
    background:'var(--surface2)', border:'1px solid var(--border)',
    color:'var(--text3)', cursor:'pointer', fontFamily:'var(--font)',
    transition:'all 0.15s',
  },
  tabActive: { background:'var(--accent)', color:'#fff', borderColor:'var(--accent)' },
  subtab: {
    padding:'4px 10px',
    borderRadius:999,
    border:'1px solid var(--border)',
    background:'transparent',
    color:'var(--text2)',
    cursor:'pointer',
    fontFamily:'var(--font)',
    fontSize:11,
    fontWeight:700,
  },
  subtabActive: {
    borderColor:'var(--accent)',
    background:'rgba(79,127,255,0.12)',
    color:'var(--text)',
  },
  searchRow: {
    display:'flex',
    gap:8,
    alignItems:'center',
  },
  search: {
    background:'var(--surface2)', border:'1px solid var(--border)',
    borderRadius:6, color:'var(--text)', padding:'5px 10px',
    fontSize:12, fontFamily:'var(--font)', outline:'none', width:160, direction:'rtl',
  },
  tableWrap: { flex:1, overflow:'auto' },
  table:  { width:'100%', borderCollapse:'collapse', fontSize:13, tableLayout:'fixed' },
  th: {
    background:'var(--surface2)', borderBottom:'1px solid var(--border)',
    borderLeft:'1px solid var(--border)',
    padding:'8px 12px', fontWeight:700, color:'var(--text2)',
    whiteSpace:'nowrap', cursor:'pointer', position:'sticky', top:0, zIndex:2,
    textAlign:'right', userSelect:'none',
  },
  thContent: {
    display:'flex',
    alignItems:'center',
    justifyContent:'space-between',
    gap:8,
  },
  thLabel: {
    flex:1,
    overflow:'hidden',
    textOverflow:'ellipsis',
  },
  resizeHandle: {
    width:8,
    height:18,
    cursor:'col-resize',
    background:'var(--accent)',
    borderRadius:2,
    flexShrink:0,
    opacity:0.3,
  },
  resizeHandleActive: {
    opacity:1,
  },
  tr: {
    borderBottom:'1px solid rgba(255,255,255,0.04)',
    cursor:'default', transition:'background 0.1s',
  },
  trClickable: {
    cursor: 'pointer',
  },
  td: {
    padding:'7px 12px', borderLeft:'1px solid var(--border)',
    color:'var(--text)', verticalAlign:'middle', textAlign:'right',
    overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap',
  },
  ftBadge: { fontSize:11, fontWeight:700, padding:'2px 8px', borderRadius:20 },
  statusBadge: { fontSize:11, fontWeight:600, padding:'2px 8px', borderRadius:20, background:'rgba(255,255,255,0.07)', color:'var(--text2)' },
  priorityBadge: {
    display:'inline-flex',
    marginInlineStart:8,
    fontSize:10,
    fontWeight:700,
    padding:'2px 8px',
    borderRadius:20,
    background:'color-mix(in srgb, var(--orange) 14%, var(--surface))',
    color:'color-mix(in srgb, var(--orange) 76%, var(--text))',
    border:'1px solid color-mix(in srgb, var(--orange) 32%, var(--border))',
  },
  select: {
    fontSize:11, padding:'3px 6px',
    background:'var(--surface)', border:'1px solid var(--border)',
    borderRadius:5, color:'var(--text)', cursor:'pointer', fontFamily:'var(--font)',
  },
  empty:  { textAlign:'center', color:'var(--text3)', fontSize:14, padding:'60px 0' },
  footer: { flexShrink:0, padding:'8px 16px', borderTop:'1px solid var(--border)', display:'flex', justifyContent:'space-between', alignItems:'center' },
};

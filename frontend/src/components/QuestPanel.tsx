import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type FormEvent,
} from 'react';

import { useAuth } from '../context/AuthContext';
import { createQuest, getQuestSortOrder, saveQuestSortOrder, setQuestStatus } from '../services/api';
import { FT_OPTIONS, ftColor } from '../services/ftConfig';
import type { AppLayer, FtOption, LngLatPoint, Quest } from '../types/domain';
import { parseUTM } from '../utils/geo';
import {
  ALL_QUEST_COLUMNS,
  QUEST_SORT_OPTIONS,
  QUEST_VIEWS,
  getQuestDisplayStatus,
  getQuestStatusLabel,
  getQuestView,
  isLowPriorityQuest,
  isMoreQuest,
  reorderQuestList,
  sortQuestsByOption,
  sortQuests,
  type QuestSortOptionId,
  type QuestViewId,
} from '../utils/quests';
import { filterQuests } from '../utils/quests';
import QuestItem from './QuestItem';

interface QuestPanelProps {
  quests: Quest[];
  loading: boolean;
  latestNewQuests: Quest[];
  onRefresh: () => Promise<void> | void;
  onShowOnMap: (quest: Quest) => Promise<void> | void;
  onJumpToPoint: (point: LngLatPoint) => void;
  onLayerAdded: (layer: AppLayer) => void;
  onOpenTable: (layers: AppLayer[]) => void;
}

export default function QuestPanel({
  quests,
  loading,
  latestNewQuests,
  onRefresh,
  onShowOnMap,
  onJumpToPoint,
  onLayerAdded,
  onOpenTable,
}: QuestPanelProps) {
  const [moreTab, setMoreTab] = useState<'new' | 'pending' | 'low'>('new');
  const notificationTimeoutsRef = useRef<number[]>([]);
  const { user } = useAuth();
  const [view, setView] = useState<QuestViewId>('open');
  const [search, setSearch] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newYear, setNewYear] = useState(2026);
  const [newFt, setNewFt] = useState<FtOption>('FT1');
  const [newStatus, setNewStatus] = useState<'Open' | 'ממתין'>('Open');
  const [newPriority, setNewPriority] = useState<'גבוה' | 'רגיל' | 'נמוך'>('רגיל');
  const [showJump, setShowJump] = useState(false);
  const [jumpMode, setJumpMode] = useState<'utm' | 'dd'>('utm');
  const [jumpLat, setJumpLat] = useState('');
  const [jumpLng, setJumpLng] = useState('');
  const [jumpUtm, setJumpUtm] = useState('');
  const [jumpError, setJumpError] = useState('');
  const [creating, setCreating] = useState(false);
  const [sortCol, setSortCol] = useState<(typeof ALL_QUEST_COLUMNS)[number] | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [listSort, setListSort] = useState<QuestSortOptionId>('manual');
  const [listSortDir, setListSortDir] = useState<'asc' | 'desc'>('asc');
  const [manualOrderByView, setManualOrderByView] = useState<Record<QuestViewId, string[]>>({
    open: [],
    done: [],
    stopped: [],
    more: [],
  });
  const [draggedQuestId, setDraggedQuestId] = useState<string | null>(null);
  const [savingSort, setSavingSort] = useState(false);
  const [sortStatus, setSortStatus] = useState('');
  const [toastNotifications, setToastNotifications] = useState<Array<{ id: string; title: string }>>([]);

  const isLeader = user?.role === 'Team Leader';
  const currentView = getQuestView(view);
  const currentGroup = user?.group || 'לווינות';
  const newQuestCount = useMemo(() => quests.filter((quest) => quest.isNew).length, [quests]);
  const pendingQuestCount = useMemo(
    () => quests.filter((quest) => quest.status === 'ממתין' && !quest.isNew).length,
    [quests]
  );
  const lowPriorityQuestCount = useMemo(
    () => quests.filter((quest) => isLowPriorityQuest(quest) && !quest.isNew && quest.status !== 'ממתין').length,
    [quests]
  );
  const filteredBase = useMemo(() => filterQuests(quests, view, search), [quests, view, search]);
  const filtered = useMemo(() => {
    if (view !== 'more') {
      return filteredBase;
    }

    return filteredBase.filter((quest) => (
      moreTab === 'new'
        ? Boolean(quest.isNew)
        : moreTab === 'pending'
          ? quest.status === 'ממתין' && !quest.isNew
          : isLowPriorityQuest(quest) && !quest.isNew && quest.status !== 'ממתין'
    ));
  }, [filteredBase, moreTab, view]);
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

  const manualSortDisabled = listSort !== 'manual';

  useEffect(() => {
    return () => {
      notificationTimeoutsRef.current.forEach((timeoutId) => window.clearTimeout(timeoutId));
    };
  }, []);

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
      if (view === 'more') {
        setSortStatus('');
        return;
      }

      try {
        const response = await getQuestSortOrder(currentGroup, view);
        if (cancelled) {
          return;
        }
        setManualOrderByView((current) => ({
          ...current,
          [view]: response.quest_ids,
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
  }, [currentGroup, view]);

  const handleSort = (col: (typeof ALL_QUEST_COLUMNS)[number]) => {
    if (sortCol === col) {
      setSortDir((current) => (current === 'asc' ? 'desc' : 'asc'));
      return;
    }

    setSortCol(col);
    setSortDir('asc');
  };

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
    if (!isLeader || view === 'more') {
      return;
    }

    setSavingSort(true);
    try {
      const response = await saveQuestSortOrder(currentGroup, view, displayedQuests.map((quest) => quest.id));
      setManualOrderByView((current) => ({
        ...current,
        [view]: response.quest_ids,
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
        group: 'לווינות',
      });
      setNewTitle('');
      setNewDesc('');
      setNewYear(2026);
      setNewFt('FT1');
      setNewStatus('Open');
      setNewPriority('רגיל');
      setShowNew(false);
      await onRefresh();
    } catch {
      alert('שגיאה ביצירת משימה');
    } finally {
      setCreating(false);
    }
  };

  const exportCSV = () => {
    const header = ALL_QUEST_COLUMNS.join(',');
    const rows   = sortedRows.map((q, i) =>
      [i + 1, q.title, q.ft, getQuestStatusLabel(getQuestDisplayStatus(q)), q.date, q.assigned_user || '', q.description || '', q.year]
        .map(v => `"${String(v||'').replace(/"/g,'""')}"`)
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
                      if (v.id === 'more') {
                        setMoreTab('new');
                      }
                    }}
                  >{v.icon} {v.label}</button>
                ))}
              </div>
              {view === 'more' && (
                <div style={FS.subtabs}>
                  <button
                    style={{ ...FS.subtab, ...(moreTab === 'new' ? FS.subtabActive : {}) }}
                    onClick={() => setMoreTab('new')}
                  >
                    חדשות
                  </button>
                  <button
                    style={{ ...FS.subtab, ...(moreTab === 'pending' ? FS.subtabActive : {}) }}
                    onClick={() => setMoreTab('pending')}
                  >
                    ממתין
                  </button>
                  <button
                    style={{ ...FS.subtab, ...(moreTab === 'low' ? FS.subtabActive : {}) }}
                    onClick={() => setMoreTab('low')}
                  >
                    תעדוף נמוך
                  </button>
                </div>
              )}
              <input
                style={FS.search}
                placeholder="🔍 חיפוש..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
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
                  {ALL_QUEST_COLUMNS.map(col => (
                    <th key={col} style={FS.th} onClick={() => handleSort(col)}>
                      {col} {sortCol === col ? (sortDir === 'asc' ? '↑' : '↓') : ''}
                    </th>
                  ))}
                  {isLeader && <th style={FS.th}>פעולות</th>}
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
                      <td style={FS.td}>{i + 1}</td>
                      <td style={{ ...FS.td, fontWeight: 600, maxWidth: 220 }}>{q.title}</td>
                      <td style={FS.td}>
                        <span style={{ ...FS.ftBadge, background: clr + '22', color: clr, border: `1px solid ${clr}55` }}>
                          {q.ft || '—'}
                        </span>
                      </td>
                      <td style={FS.td}>
                        <span style={FS.statusBadge} data-status={getQuestDisplayStatus(q)}>
                          {getQuestDisplayStatus(q) === 'New' ? '🔔 חדש' : getQuestStatusLabel(getQuestDisplayStatus(q))}
                        </span>
                        {isLowPriorityQuest(q) && <span style={FS.priorityBadge}>⋯ תעדוף נמוך</span>}
                      </td>
                      <td style={FS.td}>{q.date}</td>
                      <td style={FS.td}>{q.assigned_user || '—'}</td>
                      <td style={{ ...FS.td, maxWidth: 260, color: 'var(--text2)', fontSize: 11 }}>
                        {q.description || '—'}
                      </td>
                      <td style={FS.td}>{q.year}</td>
                      {isLeader && (
                        <td style={FS.td}>
                          <select
                            style={FS.select}
                            value={q.status}
                            onClick={(e) => e.stopPropagation()}
                            onChange={async (e) => {
                              await setQuestStatus(q.id, e.target.value);
                              onRefresh();
                            }}
                          >
                            {Object.entries({
                              Open: 'פתוח',
                              Taken: 'נלקח',
                              'In Progress': 'בביצוע',
                              ממתין: 'ממתין',
                              Done: 'הושלם',
                              Approved: 'מאושר',
                              Stopped: 'הופסק',
                              Cancelled: 'בוטל',
                            }).map(([k, v]) =>
                              <option key={k} value={k}>{v}</option>
                            )}
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
    <div style={S.panel}>

      {/* ── View tabs ─────────────────────────────────── */}
      <div style={S.tabs}>
        {QUEST_VIEWS.map(v => {
          const cnt = v.id === 'more'
            ? quests.filter((q) => isMoreQuest(q)).length
            : quests.filter((q) => !isMoreQuest(q) && v.statuses.includes(q.status)).length;
          return (
            <button
              key={v.id}
              style={{ ...S.tab, ...(view === v.id ? S.tabActive : {}) }}
              onClick={() => {
                setView(v.id);
                if (v.id === 'more') {
                  setMoreTab('new');
                }
              }}
            >
              {v.icon} {v.label}
              {cnt > 0 && <span style={{ ...S.tabCount, ...(view === v.id ? S.tabCountActive : {}) }}>{cnt}</span>}
            </button>
          );
        })}
      </div>

      {view === 'more' && (
        <div style={S.moreTabs}>
          <button
            type="button"
            style={{ ...S.moreTabButton, ...(moreTab === 'new' ? S.moreTabButtonActive : {}) }}
            onClick={() => setMoreTab('new')}
          >
            חדשות
            {newQuestCount > 0 && <span style={S.moreTabCount}>{newQuestCount}</span>}
          </button>
          <button
            type="button"
            style={{ ...S.moreTabButton, ...(moreTab === 'pending' ? S.moreTabButtonActive : {}) }}
            onClick={() => setMoreTab('pending')}
          >
            ממתין
            {pendingQuestCount > 0 && <span style={S.moreTabCount}>{pendingQuestCount}</span>}
          </button>
          <button
            type="button"
            style={{ ...S.moreTabButton, ...(moreTab === 'low' ? S.moreTabButtonActive : {}) }}
            onClick={() => setMoreTab('low')}
          >
            תעדוף נמוך
            {lowPriorityQuestCount > 0 && <span style={S.moreTabCount}>{lowPriorityQuestCount}</span>}
          </button>
        </div>
      )}

      {/* ── Header ────────────────────────────────────── */}
      <div style={S.header}>
        <div style={S.headerRow}>
          <span style={S.title}>{currentView.icon} {currentView.label}</span>
          <div style={S.headerActions}>
            <span style={S.countBadge}>{filtered.length}</span>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => {
                setView('more');
                setMoreTab('new');
              }}
              title="משימות חדשות"
              style={newQuestCount > 0 ? S.bellButtonActive : undefined}
            >
              🔔
              {newQuestCount > 0 && <span style={S.bellCount}>{newQuestCount}</span>}
            </button>
            <button className="btn btn-ghost btn-sm" onClick={() => setShowJump((current) => !current)} title="קפיצה לנקודה">
              {showJump ? '✕ סגור' : '📍 קפוץ'}
            </button>
            {isLeader && (
              <button className="btn btn-primary btn-sm" onClick={() => setShowNew(v => !v)}>
                {showNew ? '✕' : '+ חדש'}
              </button>
            )}
            <button className="btn btn-ghost btn-sm" onClick={onRefresh} title="רענן">↻</button>
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
              <select className="input" value={newYear} onChange={e => setNewYear(Number(e.target.value))} style={{ fontSize: 13, flex: 1 }}>
                {[2026, 2025, 2024, 2023].map(y => <option key={y} value={y}>{y}</option>)}
              </select>
              <select className="input" value={newFt} onChange={e => setNewFt(e.target.value as FtOption)} style={{ fontSize: 13, flex: 1 }}>
                {FT_OPTIONS.map(ft => <option key={ft} value={ft}>{ft}</option>)}
              </select>
              <select className="input" value={newStatus} onChange={e => setNewStatus(e.target.value as 'Open' | 'ממתין')} style={{ fontSize: 13, flex: 1 }}>
                <option value="Open">פתוח</option>
                <option value="ממתין">ממתין</option>
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
        <input className="input" placeholder="🔍 חיפוש..." value={search}
          onChange={e => setSearch(e.target.value)} style={{ fontSize: 13 }} />
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
          {isLeader && view !== 'more' && listSort === 'manual' && (
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
                onRefresh={onRefresh} onShowOnMap={onShowOnMap}
                onLayerAdded={onLayerAdded} onOpenTable={onOpenTable} />
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
                setView('more');
                setMoreTab('new');
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
  search: {
    background:'var(--surface2)', border:'1px solid var(--border)',
    borderRadius:6, color:'var(--text)', padding:'5px 10px',
    fontSize:12, fontFamily:'var(--font)', outline:'none', width:160, direction:'rtl',
  },
  tableWrap: { flex:1, overflow:'auto' },
  table:  { width:'100%', borderCollapse:'collapse', fontSize:13, tableLayout:'auto' },
  th: {
    background:'var(--surface2)', borderBottom:'1px solid var(--border)',
    borderLeft:'1px solid var(--border)',
    padding:'8px 12px', fontWeight:700, color:'var(--text2)',
    whiteSpace:'nowrap', cursor:'pointer', position:'sticky', top:0, zIndex:2,
    textAlign:'right', userSelect:'none',
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
    background:'rgba(148, 163, 184, 0.16)',
    color:'#d8e1ef',
    border:'1px solid rgba(148, 163, 184, 0.24)',
  },
  select: {
    fontSize:11, padding:'3px 6px',
    background:'var(--surface)', border:'1px solid var(--border)',
    borderRadius:5, color:'var(--text)', cursor:'pointer', fontFamily:'var(--font)',
  },
  empty:  { textAlign:'center', color:'var(--text3)', fontSize:14, padding:'60px 0' },
  footer: { flexShrink:0, padding:'8px 16px', borderTop:'1px solid var(--border)', display:'flex', justifyContent:'space-between', alignItems:'center' },
};

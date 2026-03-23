import React, { useState, useMemo } from 'react';
import QuestItem from './QuestItem.jsx';
import { createQuest, setQuestStatus } from '../services/api';
import { FT_OPTIONS, ftColor } from '../services/ftConfig';

// ── View tabs ─────────────────────────────────────────────────
const VIEWS = [
  { id: 'open',     label: 'פתוחות',   icon: '📋', statuses: ['Open', 'Taken', 'In Progress'] },
  { id: 'done',     label: 'הסתיימו',  icon: '✅', statuses: ['Done', 'Approved'] },
  { id: 'stopped',  label: 'הופסקו',   icon: '⏸',  statuses: ['Stopped', 'Cancelled'] },
];

const STATUS_HEB = {
  Open: 'פתוח', Taken: 'נלקח', 'In Progress': 'בביצוע',
  Done: 'הושלם', Approved: 'מאושר', Stopped: 'הופסק', Cancelled: 'בוטל',
};

const ALL_COLS = ['#', 'כותרת', 'FT', 'סטטוס', 'תאריך', 'משתמש', 'תיאור', 'שנה'];

export default function QuestPanel({ quests, loading, onRefresh, onShowOnMap, onLayerAdded, onOpenTable }) {
  const [view, setView]         = useState('open');
  const [search, setSearch]     = useState('');
  const [showNew, setShowNew]   = useState(false);
  const [fullscreen, setFullscreen] = useState(false);

  // New quest form state
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc]   = useState('');
  const [newYear, setNewYear]   = useState(2026);
  const [newFt, setNewFt]       = useState('FT1');
  const [creating, setCreating] = useState(false);

  // Excel sort state
  const [sortCol, setSortCol]   = useState(null);
  const [sortDir, setSortDir]   = useState('asc');

  const user     = JSON.parse(localStorage.getItem('user') || '{}');
  const isLeader = user.role === 'Team Leader';

  const currentView = VIEWS.find(v => v.id === view);

  // Filter quests by current view tab + search
  const filtered = useMemo(() => {
    return quests.filter(q => {
      const matchView   = currentView.statuses.includes(q.status);
      const matchSearch = !search ||
        q.title?.includes(search) ||
        (q.description || '').includes(search) ||
        (q.ft || '').includes(search);
      return matchView && matchSearch;
    });
  }, [quests, currentView, search]);

  // Sorted for Excel view
  const sortedRows = useMemo(() => {
    if (!sortCol) return filtered;
    return [...filtered].sort((a, b) => {
      const map = { '#': 'id', 'כותרת': 'title', 'FT': 'ft', 'סטטוס': 'status',
                    'תאריך': 'date', 'משתמש': 'assigned_user', 'תיאור': 'description', 'שנה': 'year' };
      const key = map[sortCol] || 'title';
      const av  = String(a[key] ?? '');
      const bv  = String(b[key] ?? '');
      return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
    });
  }, [filtered, sortCol, sortDir]);

  const handleSort = (col) => {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortCol(col); setSortDir('asc'); }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    setCreating(true);
    try {
      await createQuest({ title: newTitle, description: newDesc, year: newYear, ft: newFt, group: 'לווינות' });
      setNewTitle(''); setNewDesc(''); setNewYear(2026); setNewFt('FT1'); setShowNew(false);
      onRefresh();
    } catch { alert('שגיאה ביצירת משימה'); }
    finally { setCreating(false); }
  };

  const exportCSV = () => {
    const header = ALL_COLS.join(',');
    const rows   = sortedRows.map((q, i) =>
      [i+1, q.title, q.ft, STATUS_HEB[q.status]||q.status, q.date, q.assigned_user||'', q.description||'', q.year]
        .map(v => `"${String(v||'').replace(/"/g,'""')}"`)
        .join(',')
    ).join('\n');
    const blob = new Blob(['\uFEFF' + header + '\n' + rows], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a'); a.href = url;
    a.download = `quests_${view}.csv`; a.click();
    URL.revokeObjectURL(url);
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
                {VIEWS.map(v => (
                  <button key={v.id}
                    style={{ ...FS.tab, ...(view === v.id ? FS.tabActive : {}) }}
                    onClick={() => setView(v.id)}
                  >{v.icon} {v.label}</button>
                ))}
              </div>
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
                  {ALL_COLS.map(col => (
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
                    <tr key={q.id} style={{ ...FS.tr, borderRight: `3px solid ${clr}` }}>
                      <td style={FS.td}>{i + 1}</td>
                      <td style={{ ...FS.td, fontWeight: 600, maxWidth: 220 }}>{q.title}</td>
                      <td style={FS.td}>
                        <span style={{ ...FS.ftBadge, background: clr + '22', color: clr, border: `1px solid ${clr}55` }}>
                          {q.ft || '—'}
                        </span>
                      </td>
                      <td style={FS.td}>
                        <span style={FS.statusBadge} data-status={q.status}>
                          {STATUS_HEB[q.status] || q.status}
                        </span>
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
                            onChange={async (e) => {
                              await setQuestStatus(q.id, e.target.value);
                              onRefresh();
                            }}
                          >
                            {Object.entries(STATUS_HEB).map(([k,v]) =>
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
        {VIEWS.map(v => {
          const cnt = quests.filter(q => v.statuses.includes(q.status)).length;
          return (
            <button
              key={v.id}
              style={{ ...S.tab, ...(view === v.id ? S.tabActive : {}) }}
              onClick={() => setView(v.id)}
            >
              {v.icon} {v.label}
              {cnt > 0 && <span style={{ ...S.tabCount, ...(view === v.id ? S.tabCountActive : {}) }}>{cnt}</span>}
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
              <select className="input" value={newFt} onChange={e => setNewFt(e.target.value)} style={{ fontSize: 13, flex: 1 }}>
                {FT_OPTIONS.map(ft => <option key={ft} value={ft}>{ft}</option>)}
              </select>
              <button className="btn btn-primary" type="submit" disabled={creating || !newTitle.trim()}>
                {creating ? '...' : 'צור'}
              </button>
            </div>
          </form>
        )}

        {/* Search */}
        <input className="input" placeholder="🔍 חיפוש..." value={search}
          onChange={e => setSearch(e.target.value)} style={{ fontSize: 13 }} />
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
          filtered.map(q => (
            <QuestItem key={q.id} quest={q} user={user}
              onRefresh={onRefresh} onShowOnMap={onShowOnMap}
              onLayerAdded={onLayerAdded} onOpenTable={onOpenTable} />
          ))
        )}
      </div>

      {/* ── Footer ────────────────────────────────────── */}
      <div style={S.footer}>
        <span style={S.footerText}>{filtered.length} / {quests.length} משימות</span>
      </div>

    </div>
  );
}

// ── Panel styles ──────────────────────────────────────────────
const S = {
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
  header:  { flexShrink:0, padding:'10px 12px 8px', borderBottom:'1px solid var(--border)', display:'flex', flexDirection:'column', gap:8 },
  headerRow: { display:'flex', justifyContent:'space-between', alignItems:'center' },
  headerActions: { display:'flex', alignItems:'center', gap:5 },
  title:   { fontSize:13, fontWeight:700, color:'var(--text)' },
  countBadge: { background:'rgba(79,127,255,0.15)', color:'var(--accent)', borderRadius:20, fontSize:11, fontWeight:700, padding:'1px 8px' },
  newForm: { display:'flex', flexDirection:'column', gap:6, background:'var(--surface2)', border:'1px solid var(--border)', borderRadius:'var(--radius)', padding:10 },
  list:    { flex:1, overflowY:'auto', overflowX:'hidden', padding:'8px', display:'flex', flexDirection:'column', gap:6, scrollbarWidth:'thin', scrollbarColor:'var(--border2) transparent' },
  center:  { display:'flex', justifyContent:'center', padding:40 },
  empty:   { textAlign:'center', color:'var(--text3)', fontSize:13, padding:'40px 0' },
  footer:  { flexShrink:0, padding:'7px 12px', borderTop:'1px solid var(--border)', display:'flex', justifyContent:'center' },
  footerText: { fontSize:11, color:'var(--text3)' },
};

// ── Fullscreen / Excel styles ─────────────────────────────────
const FS = {
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
  tab: {
    padding:'4px 12px', borderRadius:20, fontSize:12, fontWeight:600,
    background:'var(--surface2)', border:'1px solid var(--border)',
    color:'var(--text3)', cursor:'pointer', fontFamily:'var(--font)',
    transition:'all 0.15s',
  },
  tabActive: { background:'var(--accent)', color:'#fff', borderColor:'var(--accent)' },
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
  td: {
    padding:'7px 12px', borderLeft:'1px solid var(--border)',
    color:'var(--text)', verticalAlign:'middle', textAlign:'right',
    overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap',
  },
  ftBadge: { fontSize:11, fontWeight:700, padding:'2px 8px', borderRadius:20 },
  statusBadge: { fontSize:11, fontWeight:600, padding:'2px 8px', borderRadius:20, background:'rgba(255,255,255,0.07)', color:'var(--text2)' },
  select: {
    fontSize:11, padding:'3px 6px',
    background:'var(--surface)', border:'1px solid var(--border)',
    borderRadius:5, color:'var(--text)', cursor:'pointer', fontFamily:'var(--font)',
  },
  empty:  { textAlign:'center', color:'var(--text3)', fontSize:14, padding:'60px 0' },
  footer: { flexShrink:0, padding:'8px 16px', borderTop:'1px solid var(--border)', display:'flex', justifyContent:'space-between', alignItems:'center' },
};

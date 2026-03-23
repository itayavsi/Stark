import { useMemo, useState, type CSSProperties } from 'react';

import type { AppLayer } from '../types/domain';

interface AttributeTableProps {
  layers: AppLayer[];
  onClose: () => void;
  onHighlightFeature?: (layer: AppLayer, featureIndex: number) => void;
}

export default function AttributeTable({ layers, onClose, onHighlightFeature }: AttributeTableProps) {
  const [activeLayer, setActiveLayer] = useState(0);
  const [sortCol, setSortCol] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [search, setSearch] = useState('');
  const [selectedRow, setSelectedRow] = useState<number | null>(null);

  const layer = layers[activeLayer];
  if (!layer) return null;

  const features = layer.geojson?.features || layer.data?.features || [];

  // All property keys = column headers
  const columns = useMemo(() => {
    if (!features.length) return [];
    const keys = new Set<string>();
    features.slice(0, 50).forEach((feature) => Object.keys(feature.properties || {}).forEach((key) => keys.add(key)));
    return [...keys];
  }, [features]);

  // Filter + sort
  const rows = useMemo(() => {
    let data = features.map((feature, index) => ({ _idx: index, ...(feature.properties || {}) }));

    if (search.trim()) {
      const q = search.toLowerCase();
      data = data.filter(row =>
        columns.some(c => String(row[c] ?? '').toLowerCase().includes(q))
      );
    }

    if (sortCol) {
      data.sort((a, b) => {
        const av = a[sortCol] ?? '';
        const bv = b[sortCol] ?? '';
        const n  = parseFloat(av) - parseFloat(bv);
        const cmp = isNaN(n) ? String(av).localeCompare(String(bv)) : n;
        return sortDir === 'asc' ? cmp : -cmp;
      });
    }

    return data;
  }, [features, columns, search, sortCol, sortDir]);

  const handleSort = (col: string) => {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortCol(col); setSortDir('asc'); }
  };

  const handleRowClick = (row: Record<string, unknown> & { _idx: number }) => {
    setSelectedRow(row._idx);
    if (onHighlightFeature) onHighlightFeature(layer, row._idx);
  };

  const exportCSV = () => {
    const header = columns.join(',');
    const body   = rows.map(r => columns.map(c => `"${String(r[c] ?? '').replace(/"/g,'""')}"`).join(',')).join('\n');
    const blob   = new Blob([header + '\n' + body], { type: 'text/csv;charset=utf-8;' });
    const url    = URL.createObjectURL(blob);
    const a      = document.createElement('a');
    a.href       = url;
    a.download   = `${layer.name || 'layer'}_attributes.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div style={S.overlay}>
      <div style={S.panel}>

        {/* ── Header ─────────────────────────────────────── */}
        <div style={S.header}>
          <div style={S.headerLeft}>
            <span style={S.title}>📊 טבלת מאפיינים</span>
            <span style={S.count}>{rows.length} / {features.length} רשומות</span>
          </div>
          <div style={S.headerRight}>
            <input
              style={S.search}
              placeholder="חיפוש בטבלה..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            <button className="btn btn-ghost btn-sm" onClick={exportCSV} title="ייצוא CSV">
              ⬇ CSV
            </button>
            <button className="btn btn-ghost btn-sm" onClick={onClose}>✕ סגור</button>
          </div>
        </div>

        {/* ── Layer tabs (if multiple) ─────────────────── */}
        {layers.length > 1 && (
          <div style={S.tabs}>
            {layers.map((l, i) => (
              <button
                key={i}
                style={{ ...S.tab, ...(i === activeLayer ? S.tabActive : {}) }}
                onClick={() => { setActiveLayer(i); setSortCol(null); setSelectedRow(null); setSearch(''); }}
              >
                {l.name || `שכבה ${i + 1}`}
                <span style={S.tabCount}>{(l.geojson?.features || l.data?.features || []).length}</span>
              </button>
            ))}
          </div>
        )}

        {/* ── Layer info bar ────────────────────────────── */}
        <div style={S.infoBar}>
          <span style={S.infoItem}>📁 <strong>{layer.name}</strong></span>
          <span style={S.infoItem}>עמודות: <strong>{columns.length}</strong></span>
          <span style={S.infoItem}>סוג: <strong>{layer.type || 'geojson'}</strong></span>
          {layer.year && <span style={S.infoItem}>שנה: <strong>{layer.year}</strong></span>}
        </div>

        {/* ── Table ────────────────────────────────────── */}
        {columns.length === 0 ? (
          <div style={S.empty}>אין נתונים בשכבה זו</div>
        ) : (
          <div style={S.tableWrap}>
            <table style={S.table}>
              <thead>
                <tr>
                  <th style={{ ...S.th, width: 40, color: 'var(--text3)', fontSize: 10 }}>#</th>
                  {columns.map(col => (
                    <th
                      key={col}
                      style={S.th}
                      onClick={() => handleSort(col)}
                      title={`מיין לפי ${col}`}
                    >
                      <div style={S.thInner}>
                        <span style={S.colName}>{col}</span>
                        <span style={S.sortIcon}>
                          {sortCol === col ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ' ⇅'}
                        </span>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, ri) => (
                  <tr
                    key={ri}
                    style={{
                      ...S.tr,
                      ...(row._idx === selectedRow ? S.trSelected : ri % 2 === 0 ? {} : S.trAlt),
                    }}
                    onClick={() => handleRowClick(row)}
                  >
                    <td style={{ ...S.td, color: 'var(--text3)', fontSize: 10 }}>{row._idx + 1}</td>
                    {columns.map(col => (
                      <td key={col} style={S.td} title={String(row[col] ?? '')}>
                        <span style={S.cellText}>{formatCell(row[col])}</span>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ── Footer ───────────────────────────────────── */}
        <div style={S.footer}>
          {selectedRow !== null && (
            <span style={S.footerMsg}>✓ שורה {selectedRow + 1} נבחרה</span>
          )}
          <span style={S.footerHint}>לחץ על שורה להדגשת פיצ'ר על המפה • לחץ על עמודה למיון</span>
        </div>

      </div>
    </div>
  );
}

function formatCell(val: unknown) {
  if (val === null || val === undefined || val === 'None' || val === 'nan') return '—';
  const s = String(val);
  if (s.length > 60) return s.slice(0, 57) + '...';
  return s;
}

const S: Record<string, CSSProperties> = {
  overlay: {
    position: 'relative',
    
    
    display: 'flex',
    flexDirection: 'column',
    
  },
  panel: {
    flex: 1,
    background: 'var(--surface)',
    boxShadow: '0 -4px 32px rgba(0,0,0,0.5)',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '8px 14px',
    borderBottom: '1px solid var(--border)',
    flexShrink: 0,
    gap: 10,
  },
  headerLeft: { display: 'flex', alignItems: 'center', gap: 10 },
  headerRight: { display: 'flex', alignItems: 'center', gap: 8 },
  title: { fontSize: 13, fontWeight: 700, color: 'var(--text)' },
  count: {
    fontSize: 11, color: 'var(--accent)',
    background: 'rgba(79,127,255,0.12)',
    borderRadius: 20, padding: '2px 8px',
  },
  search: {
    background: 'var(--surface2)', border: '1px solid var(--border)',
    borderRadius: 6, color: 'var(--text)', padding: '5px 10px',
    fontSize: 12, fontFamily: 'var(--font)', outline: 'none', width: 180,
    direction: 'rtl',
  },
  tabs: {
    display: 'flex', gap: 2, padding: '0 14px',
    borderBottom: '1px solid var(--border)', flexShrink: 0,
  },
  tab: {
    background: 'transparent', border: 'none',
    borderBottom: '2px solid transparent',
    color: 'var(--text3)', fontSize: 12,
    padding: '6px 12px', cursor: 'pointer',
    display: 'flex', alignItems: 'center', gap: 6,
    fontFamily: 'var(--font)',
    transition: 'color 0.15s',
  },
  tabActive: { color: 'var(--accent)', borderBottomColor: 'var(--accent)' },
  tabCount: {
    background: 'var(--surface2)', borderRadius: 20,
    fontSize: 10, padding: '1px 6px', color: 'var(--text3)',
  },
  infoBar: {
    display: 'flex', gap: 20, padding: '6px 14px',
    background: 'var(--surface2)', borderBottom: '1px solid var(--border)',
    flexShrink: 0,
  },
  infoItem: { fontSize: 11, color: 'var(--text3)' },
  empty: { padding: 40, textAlign: 'center', color: 'var(--text3)', fontSize: 13 },
  tableWrap: { flex: 1, overflow: 'auto' },
  table: {
    width: '100%', borderCollapse: 'collapse',
    fontSize: 12, tableLayout: 'auto',
  },
  th: {
    background: 'var(--surface2)',
    borderBottom: '1px solid var(--border)',
    borderRight: '1px solid var(--border)',
    padding: '6px 10px',
    fontWeight: 600, color: 'var(--text2)',
    whiteSpace: 'nowrap',
    cursor: 'pointer',
    position: 'sticky', top: 0, zIndex: 2,
    userSelect: 'none',
    textAlign: 'right',
  },
  thInner: { display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'space-between' },
  colName: { flex: 1 },
  sortIcon: { color: 'var(--text3)', fontSize: 10 },
  tr: {
    cursor: 'pointer',
    transition: 'background 0.1s',
    borderBottom: '1px solid rgba(255,255,255,0.03)',
  },
  trAlt: { background: 'rgba(255,255,255,0.02)' },
  trSelected: { background: 'rgba(79,127,255,0.18)', outline: '1px solid var(--accent)' },
  td: {
    padding: '5px 10px',
    borderRight: '1px solid var(--border)',
    color: 'var(--text)',
    maxWidth: 200,
    overflow: 'hidden',
    textAlign: 'right',
  },
  cellText: { display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  footer: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '5px 14px', borderTop: '1px solid var(--border)',
    flexShrink: 0,
  },
  footerMsg: { fontSize: 11, color: 'var(--green)' },
  footerHint: { fontSize: 10, color: 'var(--text3)' },
};

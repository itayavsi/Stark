import { useMemo, useState, useRef, useEffect, type CSSProperties } from 'react';

import type { LayerFilters, Quest, QuestPriority, QuestStatus } from '../types/domain';

interface AttributeTableProps {
  quests: Quest[];
  filters: LayerFilters;
  onClose: () => void;
  onShowQuest?: (quest: Quest) => void;
  onUpdateQuest?: (quest: Quest) => Promise<void>;
  onAddGeometry?: (questId: string, file: File, type: 'points' | 'shp') => Promise<void>;
}

type EditableField = 'title' | 'status' | 'priority' | 'assigned_user' | 'group' | 'year' | 'date';

interface SqlFilter {
  field: keyof Quest;
  operator: '=' | '!=' | 'like' | '>' | '<' | '>=' | '<=';
  value: string;
}

const COLUMNS: Array<{ key: keyof Quest | 'geometry_summary'; label: string; editable?: boolean }> = [
  { key: 'title', label: 'כותרת', editable: true },
  { key: 'quest_type', label: 'סוג משימה' },
  { key: 'status', label: 'סטטוס', editable: true },
  { key: 'priority', label: 'תעדוף', editable: true },
  { key: 'group', label: 'קבוצה', editable: true },
  { key: 'year', label: 'שנה', editable: true },
  { key: 'assigned_user', label: 'משויך', editable: true },
  { key: 'date', label: 'תאריך', editable: true },
  { key: 'geometry_type', label: 'סוג גיאומטריה' },
  { key: 'geometry_status', label: 'סטטוס גיאומטריה' },
  { key: 'geometry_summary', label: 'מקור / מידע' },
];

const STATUS_OPTIONS: QuestStatus[] = ['Open', 'Taken', 'In Progress', 'Done', 'Approved', 'Stopped', 'Cancelled', 'ממתין'];
const PRIORITY_OPTIONS: QuestPriority[] = ['גבוה', 'רגיל', 'נמוך'];

export default function AttributeTable({
  quests,
  filters,
  onClose,
  onShowQuest,
  onUpdateQuest,
  onAddGeometry,
}: AttributeTableProps) {
  const [sortCol, setSortCol] = useState<(typeof COLUMNS)[number]['key']>('title');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [search, setSearch] = useState('');
  const [selectedQuestId, setSelectedQuestId] = useState<string | null>(null);
  const [isMaximized, setIsMaximized] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(100);
  const [editingRowId, setEditingRowId] = useState<string | null>(null);
  const [editedQuest, setEditedQuest] = useState<Quest | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [showSqlPanel, setShowSqlPanel] = useState(false);
  const [sqlFilters, setSqlFilters] = useState<SqlFilter[]>([]);
  const [activeSqlFilter, setActiveSqlFilter] = useState<SqlFilter | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadQuestId, setUploadQuestId] = useState<string | null>(null);
  const [uploadType, setUploadType] = useState<'points' | 'shp'>('points');

  useEffect(() => {
    if (isMaximized) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isMaximized]);

  const rows = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    let filtered = quests.filter((quest) => {
      if (!normalizedSearch && sqlFilters.length === 0) {
        return true;
      }

      const matchesSearch = !normalizedSearch || COLUMNS.some((column) =>
        String(getColumnValue(quest, column.key)).toLowerCase().includes(normalizedSearch)
      );

      const matchesSql = sqlFilters.every((filter) => {
        const value = quest[filter.field];
        const filterValue = filter.value.toLowerCase();
        
        switch (filter.operator) {
          case '=':
            return String(value ?? '').toLowerCase() === filterValue;
          case '!=':
            return String(value ?? '').toLowerCase() !== filterValue;
          case 'like':
            return String(value ?? '').toLowerCase().includes(filterValue);
          case '>':
            return Number(value) > Number(filter.value);
          case '<':
            return Number(value) < Number(filter.value);
          case '>=':
            return Number(value) >= Number(filter.value);
          case '<=':
            return Number(value) <= Number(filter.value);
          default:
            return true;
        }
      });

      return matchesSearch && matchesSql;
    });

    filtered.sort((left, right) => {
      const leftValue = String(getColumnValue(left, sortCol));
      const rightValue = String(getColumnValue(right, sortCol));
      const comparison = leftValue.localeCompare(rightValue, 'he');
      return sortDir === 'asc' ? comparison : -comparison;
    });

    return filtered;
  }, [quests, search, sortCol, sortDir, sqlFilters]);

  const visibleQuestTypes = Object.entries(filters.questTypes)
    .filter(([, visible]) => visible)
    .map(([questType]) => questType);

  const exportCsv = () => {
    const header = COLUMNS.map((column) => column.label).join(',');
    const body = rows.map((quest) => COLUMNS.map((column) => csvCell(getColumnValue(quest, column.key))).join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + header + '\n' + body], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'quest-attributes.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleZoomIn = () => setZoomLevel((prev) => Math.min(prev + 10, 150));
  const handleZoomOut = () => setZoomLevel((prev) => Math.max(prev - 10, 70));

  const startEditing = (quest: Quest) => {
    setEditingRowId(quest.id);
    setEditedQuest({ ...quest });
  };

  const cancelEditing = () => {
    setEditingRowId(null);
    setEditedQuest(null);
  };

  const saveEdit = async () => {
    if (!editedQuest || !onUpdateQuest) return;
    setIsSaving(true);
    try {
      await onUpdateQuest(editedQuest);
      setEditingRowId(null);
      setEditedQuest(null);
    } catch (error) {
      console.error('Failed to save quest:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !uploadQuestId || !onAddGeometry) return;
    onAddGeometry(uploadQuestId, file, uploadType);
    setUploadQuestId(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const openFileUpload = (questId: string, type: 'points' | 'shp') => {
    setUploadQuestId(questId);
    setUploadType(type);
    fileInputRef.current?.click();
  };

  const addSqlFilter = () => {
    if (activeSqlFilter) {
      setSqlFilters((prev) => [...prev, activeSqlFilter]);
      setActiveSqlFilter(null);
    }
  };

  const removeSqlFilter = (index: number) => {
    setSqlFilters((prev) => prev.filter((_, i) => i !== index));
  };

  const clearSqlFilters = () => {
    setSqlFilters([]);
  };

  const containerStyle: CSSProperties = {
    position: isMaximized ? 'fixed' : 'relative',
    top: isMaximized ? 0 : undefined,
    left: isMaximized ? 0 : undefined,
    right: isMaximized ? 0 : undefined,
    bottom: isMaximized ? 0 : undefined,
    zIndex: isMaximized ? 9999 : undefined,
    flex: isMaximized ? 'none' : 1,
    width: isMaximized ? '100vw' : undefined,
    height: isMaximized ? '100vh' : undefined,
    background: 'var(--surface)',
    boxShadow: isMaximized ? 'none' : '0 -8px 32px rgba(0,0,0,0.28)',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    borderRadius: isMaximized ? 0 : undefined,
  };

  const tableStyle: CSSProperties = {
    fontSize: `${zoomLevel}%`,
  };

  return (
    <div style={containerStyle} dir="rtl">
      <input
        type="file"
        ref={fileInputRef}
        style={{ display: 'none' }}
        accept={uploadType === 'shp' ? '.zip,.shp' : '.csv,.json,.geojson'}
        onChange={handleFileUpload}
      />

      <div style={S.header}>
        <div style={S.headerBlock}>
          <span style={S.title}>טבלת מאפיינים</span>
          <span style={S.count}>{rows.length} / {quests.length} משימות</span>
          {sqlFilters.length > 0 && (
            <span style={S.sqlBadge}>SQL: {sqlFilters.length}</span>
          )}
        </div>
        <div style={S.headerActions}>
          <div style={S.zoomControls}>
            <button className="btn btn-ghost btn-sm" type="button" onClick={handleZoomOut} title="הקטן">
              −
            </button>
            <span style={S.zoomLevel}>{zoomLevel}%</span>
            <button className="btn btn-ghost btn-sm" type="button" onClick={handleZoomIn} title="הגדל">
              +
            </button>
          </div>
          <button
            className="btn btn-ghost btn-sm"
            type="button"
            onClick={() => setShowSqlPanel(!showSqlPanel)}
            title="סינון SQL"
          >
            SQL
          </button>
          <input
            style={S.search}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="חיפוש משימות..."
          />
          <button className="btn btn-ghost btn-sm" type="button" onClick={exportCsv}>
            ⬇ CSV
          </button>
          <button
            className="btn btn-ghost btn-sm"
            type="button"
            onClick={() => setIsMaximized(!isMaximized)}
            title={isMaximized ? 'צמצם' : 'הגדל'}
          >
            {isMaximized ? '⬜' : '⛶'}
          </button>
          <button className="btn btn-ghost btn-sm" type="button" onClick={onClose}>
            ✕
          </button>
        </div>
      </div>

      {showSqlPanel && (
        <div style={S.sqlPanel}>
          <div style={S.sqlPanelHeader}>
            <span style={S.sqlPanelTitle}>סינון מתקדם (SQL)</span>
            {sqlFilters.length > 0 && (
              <button className="btn btn-ghost btn-sm" type="button" onClick={clearSqlFilters}>
                נקה הכל
              </button>
            )}
          </div>
          <div style={S.sqlFiltersList}>
            {sqlFilters.map((filter, index) => (
              <div key={index} style={S.sqlFilterChip}>
                <span>{filter.field} {filter.operator} "{filter.value}"</span>
                <button
                  style={S.removeFilterBtn}
                  onClick={() => removeSqlFilter(index)}
                  type="button"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
          <div style={S.sqlForm}>
            <select
              style={S.sqlSelect}
              value={activeSqlFilter?.field ?? ''}
              onChange={(e) => setActiveSqlFilter({ ...activeSqlFilter!, field: e.target.value as keyof Quest, operator: '=', value: '' })}
            >
              <option value="">שדה...</option>
              {COLUMNS.map((col) => (
                <option key={col.key} value={col.key}>{col.label}</option>
              ))}
            </select>
            <select
              style={S.sqlSelect}
              value={activeSqlFilter?.operator ?? '='}
              onChange={(e) => setActiveSqlFilter((prev) => prev ? { ...prev, operator: e.target.value as SqlFilter['operator'] } : null)}
            >
              <option value="=">=</option>
              <option value="!=">!=</option>
              <option value="like">כמו</option>
              <option value=">">&gt;</option>
              <option value="<">&lt;</option>
              <option value=">=">&gt;=</option>
              <option value="<=">&lt;=</option>
            </select>
            <input
              style={S.sqlInput}
              type="text"
              placeholder="ערך..."
              value={activeSqlFilter?.value ?? ''}
              onChange={(e) => setActiveSqlFilter((prev) => prev ? { ...prev, value: e.target.value } : null)}
            />
            <button
              className="btn btn-primary btn-sm"
              type="button"
              onClick={addSqlFilter}
              disabled={!activeSqlFilter?.field || !activeSqlFilter?.value}
            >
              הוסף
            </button>
          </div>
        </div>
      )}

      <div style={S.infoBar}>
        <span style={S.infoItem}>נקודות: <strong>{filters.showPoints ? 'מוצג' : 'כבוי'}</strong></span>
        <span style={S.infoItem}>פוליגונים: <strong>{filters.showPolygons ? 'מוצג' : 'כבוי'}</strong></span>
        <span style={S.infoItem}>סוגי משימה: <strong>{visibleQuestTypes.length ? visibleQuestTypes.join(', ') : 'אין'}</strong></span>
        {sqlFilters.length > 0 && (
          <span style={S.infoItem}>סינונים פעילים: <strong>{sqlFilters.length}</strong></span>
        )}
      </div>

      <div style={S.tableWrap}>
        <table style={{ ...S.table, ...tableStyle }}>
          <thead>
            <tr>
              <th style={{ ...S.th, width: 140 }}>פעולות</th>
              {COLUMNS.map((column) => (
                <th
                  key={column.key}
                  style={S.th}
                  onClick={() => {
                    if (sortCol === column.key) {
                      setSortDir((current) => current === 'asc' ? 'desc' : 'asc');
                      return;
                    }
                    setSortCol(column.key);
                    setSortDir('asc');
                  }}
                >
                  {column.label} {sortCol === column.key ? (sortDir === 'asc' ? '↑' : '↓') : ''}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((quest, index) => (
              <tr
                key={quest.id}
                style={{
                  ...S.tr,
                  ...(index % 2 === 1 ? S.trAlt : {}),
                  ...(selectedQuestId === quest.id ? S.trSelected : {}),
                }}
                onClick={() => {
                  if (editingRowId !== quest.id) {
                    setSelectedQuestId(quest.id);
                    onShowQuest?.(quest);
                  }
                }}
              >
                <td style={S.tdActions}>
                  {editingRowId === quest.id ? (
                    <div style={S.actionButtons}>
                      <button
                        className="btn btn-primary btn-sm"
                        onClick={saveEdit}
                        disabled={isSaving}
                        type="button"
                      >
                        {isSaving ? '...' : 'שמור'}
                      </button>
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={cancelEditing}
                        type="button"
                      >
                        בטל
                      </button>
                    </div>
                  ) : (
                    <div style={S.actionButtons}>
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => startEditing(quest)}
                        type="button"
                        title="ערוך"
                      >
                        ✎
                      </button>
                      {!quest.geometry_type && onAddGeometry && (
                        <>
                          <button
                            className="btn btn-ghost btn-sm"
                            onClick={() => openFileUpload(quest.id, 'points')}
                            type="button"
                            title="הוסף נקודות"
                          >
                            📍
                          </button>
                          <button
                            className="btn btn-ghost btn-sm"
                            onClick={() => openFileUpload(quest.id, 'shp')}
                            type="button"
                            title="הוסף SHP"
                          >
                            📁
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </td>
                {COLUMNS.map((column) => (
                  <td key={column.key} style={S.td} title={String(getColumnValue(quest, column.key))}>
                    {editingRowId === quest.id && column.editable ? (
                      <EditableCell
                        field={column.key as EditableField}
                        value={editedQuest?.[column.key as keyof Quest] ?? ''}
                        onChange={(value) => setEditedQuest((prev) => prev ? { ...prev, [column.key]: value } : null)}
                      />
                    ) : (
                      formatCell(getColumnValue(quest, column.key))
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function EditableCell({
  field,
  value,
  onChange,
}: {
  field: EditableField;
  value: string | number | boolean | undefined;
  onChange: (value: string) => void;
}) {
  if (field === 'status') {
    return (
      <select
        style={S.editSelect}
        value={value as string}
        onChange={(e) => onChange(e.target.value)}
        onClick={(e) => e.stopPropagation()}
      >
        {STATUS_OPTIONS.map((opt) => (
          <option key={opt} value={opt}>{opt}</option>
        ))}
      </select>
    );
  }

  if (field === 'priority') {
    return (
      <select
        style={S.editSelect}
        value={value as string}
        onChange={(e) => onChange(e.target.value)}
        onClick={(e) => e.stopPropagation()}
      >
        {PRIORITY_OPTIONS.map((opt) => (
          <option key={opt} value={opt}>{opt}</option>
        ))}
      </select>
    );
  }

  if (field === 'year') {
    return (
      <input
        style={S.editInput}
        type="number"
        value={typeof value === 'number' ? value : ''}
        onChange={(e) => onChange(e.target.value)}
        onClick={(e) => e.stopPropagation()}
      />
    );
  }

  return (
    <input
      style={S.editInput}
      type="text"
      value={typeof value === 'string' ? value : ''}
      onChange={(e) => onChange(e.target.value)}
      onClick={(e) => e.stopPropagation()}
    />
  );
}

function getColumnValue(quest: Quest, key: (typeof COLUMNS)[number]['key']): string | number {
  if (key === 'geometry_summary') {
    return quest.geometry_source_name || quest.geometry_source_path || '—';
  }
  if (key === 'geometry_type') {
    if (quest.geometry_type === 'point') {
      return 'Point';
    }
    if (quest.geometry_type === 'polygon') {
      return 'Polygon';
    }
    return '—';
  }
  if (key === 'geometry_status') {
    switch (quest.geometry_status) {
      case 'ready':
        return 'מוכן';
      case 'pending':
        return 'ממתין';
      case 'error':
        return 'שגיאה';
      default:
        return 'חסר';
    }
  }
  const value = quest[key];
  if (typeof value === 'boolean') {
    return value ? 'כן' : 'לא';
  }
  return String(value ?? '—');
}

function formatCell(value: string | number) {
  const text = String(value ?? '—');
  return text.length > 80 ? `${text.slice(0, 77)}...` : text;
}

function csvCell(value: string | number) {
  return `"${String(value ?? '').replace(/"/g, '""')}"`;
}

const S: Record<string, CSSProperties> = {
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    padding: '10px 14px',
    borderBottom: '1px solid var(--border)',
  },
  headerBlock: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
  },
  headerActions: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 13,
    fontWeight: 700,
    color: 'var(--text)',
  },
  count: {
    fontSize: 11,
    color: 'var(--accent)',
    background: 'rgba(79,127,255,0.12)',
    borderRadius: 999,
    padding: '2px 8px',
  },
  sqlBadge: {
    fontSize: 11,
    color: '#fff',
    background: 'var(--accent)',
    borderRadius: 999,
    padding: '2px 8px',
  },
  zoomControls: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    background: 'var(--surface2)',
    borderRadius: 8,
    padding: '2px 6px',
  },
  zoomLevel: {
    fontSize: 11,
    color: 'var(--text2)',
    minWidth: 40,
    textAlign: 'center',
  },
  search: {
    width: 200,
    fontSize: 12,
    padding: '6px 10px',
    borderRadius: 8,
    border: '1px solid var(--border)',
    background: 'var(--surface2)',
    color: 'var(--text)',
    fontFamily: 'var(--font)',
  },
  sqlPanel: {
    background: 'var(--surface2)',
    borderBottom: '1px solid var(--border)',
    padding: '10px 14px',
  },
  sqlPanelHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  sqlPanelTitle: {
    fontSize: 12,
    fontWeight: 600,
    color: 'var(--text)',
  },
  sqlFiltersList: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 8,
  },
  sqlFilterChip: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    background: 'var(--accent)',
    color: '#fff',
    borderRadius: 6,
    padding: '4px 10px',
    fontSize: 11,
  },
  removeFilterBtn: {
    background: 'none',
    border: 'none',
    color: '#fff',
    cursor: 'pointer',
    padding: 0,
    fontSize: 12,
    opacity: 0.8,
  },
  sqlForm: {
    display: 'flex',
    gap: 8,
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  sqlSelect: {
    fontSize: 12,
    padding: '6px 8px',
    borderRadius: 6,
    border: '1px solid var(--border)',
    background: 'var(--surface)',
    color: 'var(--text)',
    fontFamily: 'var(--font)',
  },
  sqlInput: {
    fontSize: 12,
    padding: '6px 10px',
    borderRadius: 6,
    border: '1px solid var(--border)',
    background: 'var(--surface)',
    color: 'var(--text)',
    fontFamily: 'var(--font)',
    minWidth: 150,
  },
  infoBar: {
    display: 'flex',
    gap: 16,
    padding: '8px 14px',
    borderBottom: '1px solid var(--border)',
    background: 'var(--surface2)',
    flexWrap: 'wrap',
  },
  infoItem: {
    fontSize: 11,
    color: 'var(--text3)',
  },
  tableWrap: {
    flex: 1,
    overflow: 'auto',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    minWidth: 1200,
  },
  th: {
    position: 'sticky',
    top: 0,
    background: 'var(--surface)',
    fontSize: 11,
    color: 'var(--text3)',
    textAlign: 'right',
    padding: '8px 10px',
    borderBottom: '1px solid var(--border)',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  tr: {
    cursor: 'pointer',
  },
  trAlt: {
    background: 'rgba(255,255,255,0.015)',
  },
  trSelected: {
    background: 'rgba(79,127,255,0.12)',
  },
  td: {
    fontSize: 12,
    color: 'var(--text2)',
    padding: '8px 10px',
    borderBottom: '1px solid var(--border)',
    maxWidth: 240,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  tdActions: {
    fontSize: 12,
    color: 'var(--text2)',
    padding: '4px 10px',
    borderBottom: '1px solid var(--border)',
    whiteSpace: 'nowrap',
  },
  actionButtons: {
    display: 'flex',
    gap: 4,
  },
  editInput: {
    width: '100%',
    fontSize: 12,
    padding: '4px 6px',
    borderRadius: 4,
    border: '1px solid var(--accent)',
    background: 'var(--surface)',
    color: 'var(--text)',
    fontFamily: 'var(--font)',
  },
  editSelect: {
    width: '100%',
    fontSize: 12,
    padding: '4px 6px',
    borderRadius: 4,
    border: '1px solid var(--accent)',
    background: 'var(--surface)',
    color: 'var(--text)',
    fontFamily: 'var(--font)',
  },
};

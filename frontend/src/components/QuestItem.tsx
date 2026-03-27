import { useEffect, useRef, useState, type ChangeEvent, type CSSProperties, type MouseEvent } from 'react';
import { takeQuest, setQuestPriority, setQuestStatus, uploadShapefile, getLayerData } from '../services/api';
import { ftColor } from '../services/ftConfig';
import type { AppLayer, Quest, User } from '../types/domain';
import { getQuestDisplayStatus, isLowPriorityQuest } from '../utils/quests';

const STATUS_MAP = {
  New:           { label: '🔔 חדש', cls: 'badge-new' },
  'Open':        { label: 'פתוח',   cls: 'badge-open' },
  'Taken':       { label: 'נלקח',   cls: 'badge-taken' },
  'In Progress': { label: 'בביצוע', cls: 'badge-progress' },
  'Done':        { label: 'הושלם',  cls: 'badge-done' },
  'Approved':    { label: 'מאושר',  cls: 'badge-approved' },
  'Stopped':     { label: 'הופסק',  cls: 'badge-open' },
  'Cancelled':   { label: 'בוטל',   cls: 'badge-open' },
  'ממתין':       { label: 'ממתין',  cls: 'badge-pending' },
} as const;

type MessageType = 'success' | 'error' | 'warning' | 'info';

interface QuestItemProps {
  quest: Quest;
  user: User | null;
  onRefresh: () => Promise<void> | void;
  onShowOnMap: (quest: Quest) => void;
  onLayerAdded: (layer: AppLayer) => void;
  onOpenTable?: (layers: AppLayer[]) => void;
}

export default function QuestItem({
  quest,
  user,
  onRefresh,
  onShowOnMap,
  onLayerAdded,
  onOpenTable,
}: QuestItemProps) {
  const [expanded, setExpanded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; type: MessageType }>({ text: '', type: 'info' });
  const [uploadProgress, setUploadProgress] = useState(false);
  const clearMessageTimeout = useRef<number | null>(null);

  const role = user?.role || 'Viewer';
  const isViewer = role === 'Viewer';
  const isLeader = role === 'Team Leader';
  const displayStatus = getQuestDisplayStatus(quest);
  const status = STATUS_MAP[displayStatus as keyof typeof STATUS_MAP] || { label: displayStatus, cls: 'badge-open' };
  const ftClr = ftColor(quest.ft);
  const lowPriority = isLowPriorityQuest(quest);

  useEffect(() => {
    return () => {
      if (clearMessageTimeout.current !== null) {
        window.clearTimeout(clearMessageTimeout.current);
      }
    };
  }, []);

  const showMsg = (text: string, type: MessageType = 'info') => {
    if (clearMessageTimeout.current !== null) {
      window.clearTimeout(clearMessageTimeout.current);
    }

    setMsg({ text, type });
    clearMessageTimeout.current = window.setTimeout(() => {
      setMsg({ text: '', type: 'info' });
    }, 4000);
  };

  const handleTake = async (e: MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    setBusy(true);
    try {
      await takeQuest(quest.id, user?.display_name || user?.username || '');
      showMsg('✓ המשימה נלקחה בהצלחה', 'success');
      await onRefresh();
    } catch {
      showMsg('✗ שגיאה בלקיחת משימה', 'error');
    }
    setBusy(false);
  };

  const handleStatusChange = async (e: ChangeEvent<HTMLSelectElement>) => {
    e.stopPropagation();
    const s = e.target.value;
    setBusy(true);
    try {
      await setQuestStatus(quest.id, s);
      showMsg(`✓ סטטוס עודכן: ${STATUS_MAP[s as keyof typeof STATUS_MAP]?.label || s}`, 'success');
      await onRefresh();
    } catch {
      showMsg('✗ שגיאה בעדכון סטטוס', 'error');
    }
    setBusy(false);
  };

  const handlePriorityChange = async (e: ChangeEvent<HTMLSelectElement>) => {
    e.stopPropagation();
    const priority = e.target.value;
    setBusy(true);
    try {
      await setQuestPriority(quest.id, priority);
      showMsg(`✓ תעדוף עודכן: ${priority}`, 'success');
      await onRefresh();
    } catch {
      showMsg('✗ שגיאה בעדכון תעדוף', 'error');
    }
    setBusy(false);
  };

  const handleUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    e.stopPropagation();
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadProgress(true);
    showMsg(`⏳ מעלה ${file.name}...`, 'info');

    try {
      const res = await uploadShapefile(quest.id, file);

      if (res.status === 'error') {
        showMsg(`✗ שגיאה: ${res.error}`, 'error');
        return;
      }

      const uploadedLayers = res.layers || [];
      if (uploadedLayers.length === 0) {
        showMsg('הקובץ הועלה אך לא נמצאו שכבות להצגה', 'warning');
        return;
      }

      // Add each layer to the map
      const mapLayers: AppLayer[] = [];
      uploadedLayers.forEach((l) => {
        if (l.geojson) {
          const layerObj = {
            name: l.name || quest.title,
            data: l.geojson,
            year: quest.year,
            ft: quest.ft,
            fields: l.fields || [],
          };
          onLayerAdded(layerObj);
          mapLayers.push(layerObj);
        }
      });

      // Open attribute table if data loaded
      if (mapLayers.length > 0 && onOpenTable) {
        onOpenTable(mapLayers);
      }

      showMsg(`✓ ${uploadedLayers.length} שכבות נטענו למפה`, 'success');
      await onRefresh();
    } catch (err: any) {
      showMsg(`✗ שגיאת העלאה: ${err?.response?.data?.detail || err?.message || 'שגיאה לא ידועה'}`, 'error');
    } finally {
      setUploadProgress(false);
      e.target.value = '';
    }
  };

  const handleCheckFolder = async (e: MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    setBusy(true);
    showMsg('⏳ סורק תיקייה...', 'info');
    try {
      const res = await getLayerData(quest.id);
      const layers = res.layers || [];
      if (!layers.length) {
        showMsg('לא נמצאו קבצים בתיקייה', 'warning');
        return;
      }
      const mapLayers: AppLayer[] = [];
      layers.forEach((l) => {
        if (l.data) {
          const layerObj = { name: l.name, data: l.data, year: quest.year, ft: quest.ft, fields: l.fields || [] };
          onLayerAdded(layerObj);
          mapLayers.push(layerObj);
        }
      });
      if (mapLayers.length > 0 && onOpenTable) onOpenTable(mapLayers);
      showMsg(`✓ נטענו ${mapLayers.length} שכבות`, 'success');
    } catch {
      showMsg('✗ תיקייה לא נמצאה או ריקה', 'error');
    }
    setBusy(false);
  };

  const msgColor: Record<MessageType, string> = { success:'var(--green)', error:'var(--red)', warning:'var(--orange)', info:'var(--accent)' };

  return (
    <div
      style={{ ...S.card, borderRight: `3px solid ${ftClr}` }}
      onClick={() => setExpanded(v => !v)}
    >
      {/* ── Top row ───────────────────────────────────── */}
      <div style={S.topRow}>
        <div style={S.topLeft}>
          <span className={`badge ${status.cls}`}>{status.label}</span>
          {lowPriority && <span style={S.priorityBadge}>⋯ תעדוף נמוך</span>}
          <span style={{ fontSize:11, color: ftClr, fontWeight:700 }}>{quest.ft || quest.year}</span>
          {quest.ft && <span style={{ ...S.ftBadge, background: ftClr + '22', color: ftClr, border: `1px solid ${ftClr}55` }}>{quest.ft}</span>}
        </div>
        <span style={S.chevron}>{expanded ? '▲' : '▼'}</span>
      </div>

      {/* Title */}
      <div style={S.title}>{quest.title}</div>

      {/* Meta */}
      <div style={S.meta}>
        <span style={S.metaItem}>📅 {quest.date}</span>
        {quest.assigned_user && <span style={S.metaItem}>👤 {quest.assigned_user}</span>}
      </div>

      {/* ── Expanded ───────────────────────────────────── */}
      {expanded && (
        <div style={S.expanded} onClick={e => e.stopPropagation()}>

          {quest.description && <p style={S.desc}>{quest.description}</p>}

          {/* Message bar */}
          {msg.text && (
            <div style={{ ...S.msgBar, color: msgColor[msg.type] || 'var(--text2)' }}>
              {msg.text}
            </div>
          )}

          {/* Action buttons */}
          <div style={S.actions}>

            {/* Take quest */}
            {quest.status === 'Open' && !isViewer && (
              <button className="btn btn-success btn-sm" onClick={handleTake} disabled={busy}>
                ✋ קח משימה
              </button>
            )}

            {/* Show on map */}
            <button className="btn btn-ghost btn-sm" onClick={(e) => { e.stopPropagation(); onShowOnMap(quest); }}>
              🗺 במפה
            </button>

            {/* Check folder */}
            {!isViewer && (
              <button className="btn btn-ghost btn-sm" onClick={handleCheckFolder} disabled={busy}>
                📁 בדוק תיקייה
              </button>
            )}

            {/* Upload SHP/ZIP/GeoJSON */}
            {!isViewer && quest.status !== 'Approved' && (
              <label
                className="btn btn-ghost btn-sm"
                style={{ cursor: uploadProgress ? 'wait' : 'pointer' }}
                onClick={e => e.stopPropagation()}
              >
                {uploadProgress ? '⏳ מעלה...' : '📤 העלה SHP / ZIP / GeoJSON'}
                <input
                  type="file"
                  accept=".shp,.geojson,.json,.zip"
                  style={{ display: 'none' }}
                  onChange={handleUpload}
                  disabled={uploadProgress}
                />
              </label>
            )}

          </div>

          {/* Status selector for Team Leader */}
          {isLeader && (
            <div style={S.statusRow}>
              <span style={S.statusLabel}>שנה סטטוס:</span>
              <select
                style={S.select}
                value={quest.status}
                onChange={handleStatusChange}
                disabled={busy}
                onClick={e => e.stopPropagation()}
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
                }).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
          )}

          {isLeader && (
            <div style={S.statusRow}>
              <span style={S.statusLabel}>תעדוף:</span>
              <select
                style={S.select}
                value={quest.priority || 'רגיל'}
                onChange={handlePriorityChange}
                disabled={busy}
                onClick={e => e.stopPropagation()}
              >
                <option value="גבוה">גבוה</option>
                <option value="רגיל">רגיל</option>
                <option value="נמוך">נמוך</option>
              </select>
            </div>
          )}

          {/* Shapefile path hint */}
          {quest.shapefile_path && (
            <div style={S.pathHint}>📁 {quest.shapefile_path}</div>
          )}

        </div>
      )}
    </div>
  );
}

const S: Record<string, CSSProperties> = {
  card: {
    background: 'var(--surface2)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    marginBottom: 8,
    padding: '10px 12px 10px 14px',
    cursor: 'pointer',
    transition: 'background 0.15s',
    position: 'relative',
  },
  topRow:   { display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 },
  topLeft:  { display:'flex', alignItems:'center', gap:8 },
  chevron:  { color:'var(--text3)', fontSize:10 },
  title:    { fontSize:13, fontWeight:600, color:'var(--text)', marginBottom:5, lineHeight:1.4 },
  meta:     { display:'flex', gap:10, flexWrap:'wrap' },
  metaItem: { fontSize:11, color:'var(--text2)' },
  expanded: { marginTop:10, borderTop:'1px solid var(--border)', paddingTop:10 },
  desc:     { fontSize:12, color:'var(--text2)', marginBottom:10, lineHeight:1.6 },
  msgBar:   {
    fontSize:12, padding:'6px 10px', borderRadius:6,
    background:'var(--surface)', marginBottom:8, border:'1px solid var(--border)',
  },
  actions:  { display:'flex', flexWrap:'wrap', gap:6, marginBottom:8 },
  statusRow:{ display:'flex', alignItems:'center', gap:8, marginTop:6 },
  statusLabel:{ fontSize:11, color:'var(--text3)' },
  select: {
    fontSize:12, padding:'4px 8px',
    background:'var(--surface)', border:'1px solid var(--border)',
    borderRadius:6, color:'var(--text)',
    cursor:'pointer', fontFamily:'var(--font)',
  },
  ftBadge: {
    fontSize: 10, fontWeight: 700,
    padding: '1px 7px', borderRadius: 20,
    letterSpacing: '0.04em',
  },
  priorityBadge: {
    fontSize: 10,
    fontWeight: 700,
    padding: '2px 8px',
    borderRadius: 20,
    background: 'rgba(148, 163, 184, 0.16)',
    color: '#d8e1ef',
    border: '1px solid rgba(148, 163, 184, 0.24)',
  },
  pathHint: {
    marginTop:8, fontSize:10, color:'var(--text3)',
    background:'var(--surface)', borderRadius:4,
    padding:'3px 8px', fontFamily:'monospace', wordBreak:'break-all',
  },
};

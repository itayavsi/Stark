import { useCallback, useEffect, useRef, useState, type ChangeEvent, type CSSProperties, type MouseEvent } from 'react';
import {
  completeQuestWithAccuracy,
  setQuestPriority,
  setQuestStatus,
  takeQuest,
  transferExternalQuestToOpen,
  updateQuest,
} from '../services/api';
import { ftColor } from '../services/ftConfig';
import type { GeometryCatalog, Quest, QuestGeometryRecord, User } from '../types/domain';
import { getQuestDisplayStatus, isLowPriorityQuest } from '../utils/quests';
import AccuracyModal from './AccuracyModal';
import QuestGeometryEditor from './QuestGeometryEditor';

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
  onRefresh: () => Promise<GeometryCatalog | null> | GeometryCatalog | null;
  onShowOnMap: (quest: Quest, catalogOverride?: GeometryCatalog | null) => void;
}

export default function QuestItem({
  quest,
  user,
  onRefresh,
  onShowOnMap,
}: QuestItemProps) {
  const [expanded, setExpanded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; type: MessageType }>({ text: '', type: 'info' });
  const [showAccuracyModal, setShowAccuracyModal] = useState(false);
  const [editingNotes, setEditingNotes] = useState(false);
  const [notesValue, setNotesValue] = useState('');
  const [savingModelFolder, setSavingModelFolder] = useState(false);
  const clearMessageTimeout = useRef<number | null>(null);
  const modelFolderInputRef = useRef<HTMLInputElement | null>(null);

  const role = user?.role || 'Viewer';
  const isViewer = role === 'Viewer';
  const isLeader = role === 'Team Leader';
  const displayStatus = getQuestDisplayStatus(quest);
  const status = STATUS_MAP[displayStatus as keyof typeof STATUS_MAP] || { label: displayStatus, cls: 'badge-open' };
  const ftClr = ftColor(quest.ft);
  const lowPriority = isLowPriorityQuest(quest);
  const isExternalQuest = quest.id.startsWith('external:');
  const canTransferToOpen = isExternalQuest && !quest.isTransferred && !isViewer;
  const matziahLabel = quest.matziah ? `מצייח ${quest.matziah}` : null;
  const getGeometryLabel = (types: typeof quest.geometry_type) => {
    if (!types) return 'No geometry';
    if (Array.isArray(types)) {
      const labels = [];
      if (types.includes('point')) labels.push('Point');
      if (types.includes('polygon')) labels.push('Polygon');
      return labels.length > 0 ? labels.join('+') : 'No geometry';
    }
    return types === 'point' ? 'Point' : types === 'polygon' ? 'Polygon' : 'No geometry';
  };
  const geometryLabel = getGeometryLabel(quest.geometry_type);
  const hasGeometry = !!quest.geometry_type && (quest.geometry_status === 'ready' || quest.geometry_status === 'pending');
  const canComplete = !isViewer && !isExternalQuest && hasGeometry;

  useEffect(() => {
    return () => {
      if (clearMessageTimeout.current !== null) {
        window.clearTimeout(clearMessageTimeout.current);
      }
    };
  }, []);

  const setModelFolderInput = useCallback((node: HTMLInputElement | null) => {
    modelFolderInputRef.current = node;
    if (!node) {
      return;
    }
    node.setAttribute('webkitdirectory', '');
    node.setAttribute('directory', '');
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

  const handleTransferToOpen = async (e: MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    setBusy(true);
    try {
      await transferExternalQuestToOpen(quest.id);
      showMsg('✓ המשימה הועברה למאגר המשימות הפתוחות', 'success');
      await onRefresh();
    } catch {
      showMsg('✗ שגיאה בהעברת המשימה למאגר הפתוחות', 'error');
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

  const handleGeometrySaved = async (geometry: QuestGeometryRecord) => {
    const catalog = await onRefresh();
    onShowOnMap(
      {
        ...quest,
        geometry_type: geometry.geometry_type,
        geometry_status: geometry.geometry_status,
        geometry_source_path: geometry.source_path,
        geometry_source_name: geometry.source_name,
        geometry_feature_count: geometry.feature_count,
        has_point: Array.isArray(geometry.geometry_type) 
          ? geometry.geometry_type.includes('point')
          : geometry.geometry_type === 'point',
        has_polygon: Array.isArray(geometry.geometry_type) 
          ? geometry.geometry_type.includes('polygon')
          : geometry.geometry_type === 'polygon',
      },
      catalog || null,
    );
  };

  const handleComplete = async (accuracyXy: number, accuracyZ: number) => {
    setShowAccuracyModal(false);
    setBusy(true);
    try {
      await completeQuestWithAccuracy(quest.id, accuracyXy, accuracyZ);
      showMsg('✓ המשימה הושלמה בהצלחה', 'success');
      await onRefresh();
    } catch (err) {
      const detail =
        typeof err === 'object' &&
        err &&
        'response' in err &&
        (err as { response?: { data?: { detail?: string } } }).response?.data?.detail;
      showMsg(detail ? `✗ שגיאה: ${detail}` : '✗ שגיאה בהשלמת המשימה', 'error');
    }
    setBusy(false);
  };

  const startEditingNotes = () => {
    setNotesValue(quest.notes || '');
    setEditingNotes(true);
  };

  const cancelEditingNotes = () => {
    setEditingNotes(false);
    setNotesValue('');
  };

  const saveNotes = async () => {
    setBusy(true);
    try {
      await updateQuest(quest.id, { notes: notesValue });
      showMsg('✓ ההערות נשמרו בהצלחה', 'success');
      setEditingNotes(false);
      await onRefresh();
    } catch {
      showMsg('✗ שגיאה בשמירת ההערות', 'error');
    }
    setBusy(false);
  };

  const openModelFolderPicker = (e: MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    if (savingModelFolder) return;
    modelFolderInputRef.current?.click();
  };

  const handleModelFolderFiles = async (event: ChangeEvent<HTMLInputElement>) => {
    event.stopPropagation();
    const files = Array.from(event.target.files || []);
    if (!files.length || savingModelFolder) {
      return;
    }

    const first = files[0] as File & { webkitRelativePath?: string; path?: string };
    const relativePath = first.webkitRelativePath || first.name;
    const folderName = relativePath.split('/')[0] || relativePath;
    let modelFolderValue = folderName;

    if (first.path && relativePath) {
      const normalizedFilePath = first.path.replace(/\\/g, '/');
      const normalizedRelative = relativePath.replace(/\\/g, '/');
      if (normalizedFilePath.endsWith(normalizedRelative)) {
        const root = normalizedFilePath.slice(0, -normalizedRelative.length).replace(/\/$/, '');
        if (root) {
          modelFolderValue = `${root}/${folderName}`;
        }
      }
    }

    setSavingModelFolder(true);
    showMsg('⏳ מעדכן תיקייה...', 'info');
    try {
      await updateQuest(quest.id, { model_folder: modelFolderValue });
      await onRefresh();
      showMsg('✓ תיקיית מודל עודכנה', 'success');
    } catch {
      showMsg('✗ שגיאה בעדכון תיקיית מודל', 'error');
    } finally {
      setSavingModelFolder(false);
      event.target.value = '';
    }
  };

  const handleClearModelFolder = async (e: MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    if (savingModelFolder) return;
    setSavingModelFolder(true);
    showMsg('⏳ מסיר תיקייה...', 'info');
    try {
      await updateQuest(quest.id, { model_folder: null });
      await onRefresh();
      showMsg('✓ תיקיית מודל הוסרה', 'success');
    } catch {
      showMsg('✗ שגיאה בהסרת תיקיית מודל', 'error');
    } finally {
      setSavingModelFolder(false);
    }
  };

  const handleOpenModelFolder = (e: MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    const raw = quest.model_folder?.trim();
    if (!raw) {
      showMsg('אין תיקייה לפתיחה', 'warning');
      return;
    }

    const normalized = raw.replace(/\\/g, '/');
    let fileUrl: string | null = null;
    if (normalized.startsWith('file://')) {
      fileUrl = normalized;
    } else if (/^[a-zA-Z]:\//.test(normalized)) {
      fileUrl = `file:///${normalized}`;
    } else if (normalized.startsWith('/')) {
      fileUrl = `file://${normalized}`;
    }

    if (!fileUrl) {
      showMsg('הנתיב אינו מלא — בחר תיקייה להעלאה', 'warning');
      modelFolderInputRef.current?.click();
      return;
    }

    const opened = window.open(fileUrl, '_blank');
    if (!opened) {
      showMsg('חסימת חלונות קופצים מנעה פתיחה', 'warning');
    }
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
          {matziahLabel && <span style={S.syncBadge}>{matziahLabel}</span>}
          <span style={S.geometryBadge}>{geometryLabel}</span>
          {!quest.ft && quest.year && <span style={{ fontSize:11, color: ftClr, fontWeight:700 }}>{quest.year}</span>}
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
          <input
            ref={setModelFolderInput}
            type="file"
            multiple
            style={{ display: 'none' }}
            onChange={(event) => void handleModelFolderFiles(event)}
          />

          {quest.description && <p style={S.desc}>{quest.description}</p>}
          
          {/* Notes Section */}
          <div style={S.notesSection}>
            <div style={S.notesHeader}>
              <span style={S.notesLabel}>הערות:</span>
              {!isViewer && !editingNotes && (
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={(e) => { e.stopPropagation(); startEditingNotes(); }}
                  style={{ fontSize: 10, padding: '2px 8px' }}
                  type="button"
                >
                  {quest.notes ? '✎ ערוך' : '+ הוסף הערות'}
                </button>
              )}
            </div>
            {editingNotes ? (
              <div style={S.notesEditor}>
                <textarea
                  style={S.notesTextarea}
                  value={notesValue}
                  onChange={(e) => setNotesValue(e.target.value)}
                  placeholder="הזן הערות..."
                  rows={3}
                  autoFocus
                />
                <div style={S.notesActions}>
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={(e) => { e.stopPropagation(); saveNotes(); }}
                    disabled={busy}
                    type="button"
                  >
                    שמור
                  </button>
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={(e) => { e.stopPropagation(); cancelEditingNotes(); }}
                    disabled={busy}
                    type="button"
                  >
                    ביטול
                  </button>
                </div>
              </div>
            ) : quest.notes ? (
              <p style={S.notesText}>{quest.notes}</p>
            ) : (
              <p style={{ ...S.notesText, color: 'var(--text3)', fontStyle: 'italic' }}>
                אין הערות
              </p>
            )}
          </div>
          
          {quest.sync_external_id && (
            <div style={S.syncHint}>
              {quest.matziah === 'N'
                ? 'סטטוס מסונכרן גם למשימה החיצונית'
                : isExternalQuest
                  ? 'סטטוס מקומי בלבד עד שמצייח יעבור ל-N'
                  : 'המשימה מקושרת למקור חיצוני ללא סנכרון סטטוס אוטומטי'}
            </div>
          )}

          {/* Message bar */}
          {msg.text && (
            <div style={{ ...S.msgBar, color: msgColor[msg.type] || 'var(--text2)' }}>
              {msg.text}
            </div>
          )}

          {/* Action buttons */}
          <div style={S.actions}>

            {/* Take quest */}
            {quest.status === 'Open' && !isViewer && !isExternalQuest && (
              <button className="btn btn-success btn-sm" onClick={handleTake} disabled={busy}>
                ✋ קח משימה
              </button>
            )}

            {/* Show on map */}
            <button className="btn btn-ghost btn-sm" onClick={(e) => { e.stopPropagation(); onShowOnMap(quest); }}>
              🗺 במפה
            </button>

            {canTransferToOpen && (
              <button className="btn btn-primary btn-sm" onClick={handleTransferToOpen} disabled={busy}>
                Transfer to Open Quest
              </button>
            )}

            {isExternalQuest && quest.isTransferred && (
              <span style={S.transferState}>כבר הועבר למאגר הפתוחות</span>
            )}

            {/* Complete with accuracy */}
            {canComplete && quest.status !== 'Done' && quest.status !== 'Approved' && (
              <button
                className="btn btn-success btn-sm"
                onClick={(e) => { e.stopPropagation(); setShowAccuracyModal(true); }}
                disabled={busy}
              >
                ✓ השלם עם דיוק
              </button>
            )}

          </div>

          {/* Model folder */}
          <div style={S.modelFolder}>
            <div style={S.modelFolderHeader}>
              <span style={S.modelFolderLabel}>Model Folder</span>
              <div style={S.modelFolderActions}>
                {quest.model_folder && (
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={handleOpenModelFolder}
                    type="button"
                    title="פתח תיקייה"
                  >
                    📂 פתח
                  </button>
                )}
                {!isViewer && (
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={openModelFolderPicker}
                    disabled={savingModelFolder}
                    type="button"
                    title={quest.model_folder ? 'ערוך תיקייה' : 'הוסף תיקייה'}
                  >
                    {savingModelFolder ? '...' : quest.model_folder ? '✎ ערוך' : '+ הוסף'}
                  </button>
                )}
                {!isViewer && quest.model_folder && (
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={handleClearModelFolder}
                    disabled={savingModelFolder}
                    type="button"
                    style={{ color: 'var(--red)' }}
                    title="הסר תיקייה"
                  >
                    {savingModelFolder ? '...' : '🗑'}
                  </button>
                )}
              </div>
            </div>
            <div style={S.modelFolderPath}>{quest.model_folder || '—'}</div>
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

          {!isViewer && !isExternalQuest && quest.status !== 'Approved' && (
            <QuestGeometryEditor
              quest={quest}
              disabled={busy}
              onSaved={async (geometry) => handleGeometrySaved(geometry)}
              onMessage={showMsg}
            />
          )}

        </div>
      )}

      {showAccuracyModal && (
        <AccuracyModal
          questTitle={quest.title}
          onConfirm={handleComplete}
          onCancel={() => setShowAccuracyModal(false)}
        />
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
  notesSection: { marginBottom: 10 },
  notesHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  notesLabel: { fontSize: 11, color: 'var(--text3)', fontWeight: 600 },
  notesText: { fontSize: 12, color: 'var(--text2)', margin: 0, lineHeight: 1.6, padding: '6px 8px', background: 'var(--surface)', borderRadius: 6, border: '1px solid var(--border)' },
  notesEditor: { display: 'flex', flexDirection: 'column', gap: 6 },
  notesTextarea: { 
    width: '100%', 
    fontSize: 12, 
    padding: '8px', 
    borderRadius: 6, 
    border: '1px solid var(--accent)', 
    background: 'var(--surface)', 
    color: 'var(--text)', 
    fontFamily: 'var(--font)', 
    resize: 'vertical',
    minHeight: 60,
    boxSizing: 'border-box',
  },
  notesActions: { display: 'flex', gap: 6 },
  msgBar:   {
    fontSize:12, padding:'6px 10px', borderRadius:6,
    background:'var(--surface)', marginBottom:8, border:'1px solid var(--border)',
  },
  actions:  { display:'flex', flexWrap:'wrap', gap:6, marginBottom:8 },
  modelFolder: {
    marginBottom: 10,
    padding: '8px 10px',
    background: 'var(--surface2)',
    borderRadius: 8,
    border: '1px solid var(--border)',
  },
  modelFolderHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  modelFolderLabel: {
    fontSize: 11,
    fontWeight: 600,
    color: 'var(--text)',
  },
  modelFolderActions: {
    display: 'flex',
    gap: 6,
  },
  modelFolderPath: {
    fontSize: 10,
    color: 'var(--text3)',
    fontFamily: 'monospace',
    wordBreak: 'break-all',
  },
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
    background: 'color-mix(in srgb, var(--orange) 14%, var(--surface))',
    color: 'color-mix(in srgb, var(--orange) 76%, var(--text))',
    border: '1px solid color-mix(in srgb, var(--orange) 32%, var(--border))',
  },
  syncBadge: {
    fontSize: 10,
    fontWeight: 700,
    padding: '2px 8px',
    borderRadius: 20,
    background: 'rgba(79,127,255,0.12)',
    color: 'var(--accent)',
    border: '1px solid rgba(79,127,255,0.28)',
  },
  syncHint: {
    fontSize: 11,
    color: 'var(--text3)',
    marginBottom: 10,
  },
  transferState: {
    fontSize: 11,
    color: 'var(--green)',
    alignSelf: 'center',
  },
  geometryBadge: {
    fontSize: 10,
    fontWeight: 700,
    padding: '2px 8px',
    borderRadius: 20,
    background: 'color-mix(in srgb, var(--accent) 10%, var(--surface))',
    color: 'var(--text2)',
    border: '1px solid color-mix(in srgb, var(--accent) 24%, var(--border))',
  },
};

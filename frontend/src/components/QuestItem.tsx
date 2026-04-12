import { useCallback, useEffect, useRef, useState, type ChangeEvent, type CSSProperties, type MouseEvent } from 'react';
import {
  completeQuestWithAccuracy,
  setQuestPriority,
  setQuestStatus,
  takeQuest,
  transferExternalQuestToOpen,
  updateQuest,
} from '../services/api';
import { FT_OPTIONS, ftColor } from '../services/ftConfig';
import type { GeometryCatalog, Quest, QuestGeometryRecord, User } from '../types/domain';
import { getQuestDisplayStatus, getQuestStatusLabel, getStatusCategory, isFinishedStatus, isLowPriorityQuest, isStartStatus } from '../utils/quests';
import { QUEST_STATUS_OPTIONS } from '../config/questTableColumns';
import {
  DEFAULT_PRIORITY,
  EXTERNAL_QUEST_PRIORITY_OPTIONS,
  QUEST_PRIORITY_OPTIONS,
  getPriorityLabel,
  isDeadlinePriorityValue,
} from '../utils/questOptions';
import AccuracyModal from './AccuracyModal';
import QuestGeometryEditor from './QuestGeometryEditor';

const getStatusClass = (status: string) => {
  if (status === 'New') return 'badge-new';
  const category = getStatusCategory(status);
  if (category === 'finished') return 'badge-done';
  if (category === 'on_hold') return 'badge-pending';
  if (category === 'paused') return 'badge-open';
  if (category === 'start') return 'badge-open';
  return 'badge-in-progress';
};

type MessageType = 'success' | 'error' | 'warning' | 'info';
type QuestTableType = 'external' | 'open' | 'finished';
type FieldPriority = 1 | 2 | 3;
type ScopeCode = 'A' | 'B' | 'C' | 'D';
type FieldInputKind = 'text' | 'textarea' | 'select';
type QuestFieldKey =
  | 'ft'
  | 'assigned_user'
  | 'priority'
  | 'user_priority'
  | 'model_simulations'
  | 'entry_date'
  | 'finished_date'
  | 'notes'
  | 'target_type'
  | 'country'
  | 'zarhan_notes'
  | 'duo_to_use'
  | 'ground_point'
  | 'solve_strategy';

interface QuestFieldSpec {
  key: QuestFieldKey;
  label: string;
  priority: FieldPriority;
  scope: ScopeCode;
  editable: boolean;
  input: FieldInputKind;
}

const QUEST_FIELD_SPECS: QuestFieldSpec[] = [
  { key: 'ft', label: 'צוות ל', priority: 1, scope: 'A', editable: true, input: 'select' },
  { key: 'assigned_user', label: 'שם פותר', priority: 1, scope: 'B', editable: true, input: 'text' },
  { key: 'priority', label: 'תעדוף', priority: 1, scope: 'C', editable: true, input: 'select' },
  { key: 'user_priority', label: 'User Priority', priority: 1, scope: 'D', editable: true, input: 'text' },
  { key: 'model_simulations', label: 'שם מודל', priority: 2, scope: 'B', editable: true, input: 'text' },
  { key: 'entry_date', label: 'תאריך כניסה', priority: 2, scope: 'C', editable: false, input: 'text' },
  { key: 'finished_date', label: 'תאריך סיום', priority: 2, scope: 'B', editable: false, input: 'text' },
  { key: 'notes', label: 'הערות', priority: 2, scope: 'D', editable: true, input: 'textarea' },
  { key: 'target_type', label: 'כינוי / אופי מטרה', priority: 2, scope: 'C', editable: true, input: 'text' },
  { key: 'country', label: 'זירה', priority: 2, scope: 'A', editable: true, input: 'text' },
  { key: 'zarhan_notes', label: 'הערות מהצרכן', priority: 2, scope: 'C', editable: true, input: 'textarea' },
  { key: 'duo_to_use', label: 'צמד לשימוש', priority: 3, scope: 'D', editable: true, input: 'text' },
  { key: 'ground_point', label: 'נק בקרה לשימוש', priority: 3, scope: 'B', editable: true, input: 'text' },
  { key: 'solve_strategy', label: 'אסטרטגיית פתרון', priority: 3, scope: 'D', editable: true, input: 'textarea' },
];

function hasValue(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  return true;
}

function normalizeDisplayValue(value: unknown): string {
  if (!hasValue(value)) {
    return '—';
  }
  const text = String(value);
  return text.includes('T') ? text.replace('T', ' ').slice(0, 16) : text;
}

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
  const [showAddData, setShowAddData] = useState(false);
  const [addDataDraft, setAddDataDraft] = useState<Partial<Record<QuestFieldKey, string>>>({});
  const [savingAddData, setSavingAddData] = useState(false);
  const [savingModelFolder, setSavingModelFolder] = useState(false);
  const clearMessageTimeout = useRef<number | null>(null);
  const modelFolderInputRef = useRef<HTMLInputElement | null>(null);

  const role = user?.role || 'Viewer';
  const isViewer = role === 'Viewer';
  const isLeader = role === 'Team Leader';
  const isExternalQuest = quest.id.startsWith('external:');
  const tableType: QuestTableType = isExternalQuest ? 'external' : isFinishedStatus(quest.status) ? 'finished' : 'open';
  const displayStatus = getQuestDisplayStatus(quest);
  const status = {
    label: displayStatus === 'New' ? '🔔 חדש' : getQuestStatusLabel(displayStatus),
    cls: getStatusClass(displayStatus),
  };
  const questFt = String(quest.ft || '').trim();
  const hasFt = questFt.length > 0;
  const ftClr = hasFt ? ftColor(questFt) : '#94a3b8';
  const lowPriority = isLowPriorityQuest(quest);
  const deadlinePriority = isDeadlinePriorityValue(quest.priority);
  const deadlineSource = quest.deadline_at || (quest.date && String(quest.date).includes('T') ? quest.date : null);
  const deadlineTag = deadlineSource
    ? `עד ${String(deadlineSource).replace('T', ' ').slice(0, 16)}`
    : 'עד ללא תאריך';
  const canTransferToOpen = isExternalQuest && !quest.isTransferred && !isViewer;
  const priorityOptions = isExternalQuest ? EXTERNAL_QUEST_PRIORITY_OPTIONS : QUEST_PRIORITY_OPTIONS;
  const matziahValue = quest.matziah || '—';
  const modelName = String(quest.model_simulations || '').trim();
  const hasModelName = modelName.length > 0;

  const isScopeVisible = useCallback((scope: ScopeCode) => {
    if (scope === 'A') return true;
    if (scope === 'B') return tableType === 'open' || tableType === 'finished';
    if (scope === 'C') return tableType === 'open' || tableType === 'external';
    return !isExternalQuest;
  }, [isExternalQuest, tableType]);

  const getFieldValue = useCallback((key: QuestFieldKey): unknown => {
    if (key === 'ft') return quest.ft;
    if (key === 'assigned_user') return quest.assigned_user;
    if (key === 'priority') return quest.priority;
    if (key === 'user_priority') return quest.user_priority;
    if (key === 'model_simulations') return quest.model_simulations;
    if (key === 'entry_date') return quest.entry_date;
    if (key === 'finished_date') return quest.finished_date;
    if (key === 'notes') return quest.notes;
    if (key === 'target_type') return quest.target_type;
    if (key === 'country') return quest.country;
    if (key === 'zarhan_notes') return quest.zarhan_notes;
    if (key === 'duo_to_use') return quest.duo_to_use;
    if (key === 'ground_point') return quest.ground_point;
    if (key === 'solve_strategy') return quest.solve_strategy;
    return null;
  }, [quest]);

  const scopedFields = QUEST_FIELD_SPECS.filter((field) => isScopeVisible(field.scope));
  const expandedPriorityTwoFields = scopedFields.filter((field) => field.priority === 2 && field.key !== 'notes' && field.key !== 'model_simulations');
  const bottomPriorityThreeFields = scopedFields.filter((field) => field.priority === 3);
  const visibleExpandedPriorityTwoFields = expandedPriorityTwoFields.filter((field) => hasValue(getFieldValue(field.key)));
  const visibleBottomPriorityThreeFields = bottomPriorityThreeFields.filter((field) => hasValue(getFieldValue(field.key)));
  const notesExists = hasValue(quest.notes);
  const missingEditableFields = scopedFields.filter((field) => field.editable && !hasValue(getFieldValue(field.key)));

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

  useEffect(() => {
    setShowAddData(false);
    setAddDataDraft({});
    setEditingNotes(false);
  }, [quest.id]);

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
      showMsg(`✓ סטטוס עודכן: ${getQuestStatusLabel(s)}`, 'success');
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
      showMsg(`✓ תעדוף עודכן: ${getPriorityLabel(priority)}`, 'success');
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

  const handleOpenAddData = () => {
    const initialDraft: Partial<Record<QuestFieldKey, string>> = {};
    missingEditableFields.forEach((field) => {
      initialDraft[field.key] = '';
    });
    setAddDataDraft(initialDraft);
    setShowAddData(true);
  };

  const handleSaveAddData = async (e: MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    if (!missingEditableFields.length || savingAddData) {
      setShowAddData(false);
      return;
    }

    const payload: Partial<Quest> = {};
    missingEditableFields.forEach((field) => {
      const nextValue = addDataDraft[field.key];
      if (!hasValue(nextValue)) {
        return;
      }
      (payload as Record<string, unknown>)[field.key] = String(nextValue).trim();
    });

    if (!Object.keys(payload).length) {
      showMsg('אין נתונים לשמירה', 'warning');
      return;
    }

    setSavingAddData(true);
    try {
      await updateQuest(quest.id, payload);
      setShowAddData(false);
      setAddDataDraft({});
      showMsg('✓ השדות עודכנו בהצלחה', 'success');
      await onRefresh();
    } catch {
      showMsg('✗ שגיאה בעדכון השדות', 'error');
    } finally {
      setSavingAddData(false);
    }
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
          {lowPriority && <span style={S.priorityBadge}> תעדוף נמוך</span>}
          {deadlinePriority && <span style={S.deadlineBadge}>{deadlineTag}</span>}
          {isScopeVisible('C') && hasValue(quest.priority) && (
            <span style={S.dataBadge}>תעדוף: {getPriorityLabel(String(quest.priority || ''))}</span>
          )}
          {!isExternalQuest && hasValue(quest.user_priority) && (
            <span style={S.dataBadge}>User Priority: {normalizeDisplayValue(quest.user_priority)}</span>
          )}
          {tableType !== 'external' && hasModelName && (
            <span style={S.dataBadge}>שם מודל: {modelName}</span>
          )}
          <span style={{ ...S.ftBadge, background: `${ftClr}22`, color: ftClr, border: `1px solid ${ftClr}55` }}>
            {hasFt ? questFt : 'ללא FT'}
          </span>
        </div>
        <span style={S.chevron}>{expanded ? '▲' : '▼'}</span>
      </div>

      {/* Title */}
      <div style={S.title}>{quest.title}</div>

      {/* Meta */}
      <div style={S.meta}>
        <span style={S.metaItem}>📅 {quest.date}</span>
        {isScopeVisible('B') && hasValue(quest.assigned_user) && (
          <span style={S.metaItem}>👤 שם פותר: {quest.assigned_user}</span>
        )}
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

          <div style={S.infoRow}>
            <span style={S.infoLabel}>מצייח:</span>
            <span style={S.infoValue}>{matziahValue}</span>
          </div>
          <div style={S.infoRow}>
            <span style={S.infoLabel}>גיאומטריה:</span>
            <span style={S.infoValue}>{geometryLabel}</span>
          </div>

          {visibleExpandedPriorityTwoFields.length > 0 && (
            <div style={S.fieldGrid}>
              {visibleExpandedPriorityTwoFields.map((field) => (
                <div key={field.key} style={S.fieldCard}>
                  <span style={S.fieldLabel}>{field.label}</span>
                  <span style={S.fieldValue}>{normalizeDisplayValue(getFieldValue(field.key))}</span>
                </div>
              ))}
            </div>
          )}

          {(editingNotes || notesExists) && !isExternalQuest && (
            <div style={S.notesSection}>
              <div style={S.notesHeader}>
                <span style={S.notesLabel}>הערות:</span>
                {!isViewer && !editingNotes && notesExists && (
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={(e) => { e.stopPropagation(); startEditingNotes(); }}
                    style={{ fontSize: 10, padding: '2px 8px' }}
                    type="button"
                  >
                    ✎ ערוך
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
              ) : (
                <p style={S.notesText}>{quest.notes}</p>
              )}
            </div>
          )}

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
            {isStartStatus(quest.status) && !isViewer && !isExternalQuest && (
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
          {canComplete && !isFinishedStatus(quest.status) && (
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

          {visibleBottomPriorityThreeFields.length > 0 && (
            <div style={S.bottomSection}>
              <div style={S.bottomTitle}>פרטים מפורטים</div>
              {visibleBottomPriorityThreeFields.map((field) => (
                <div key={field.key} style={S.bottomRow}>
                  <span style={S.bottomLabel}>{field.label}</span>
                  <span style={S.bottomValue}>{normalizeDisplayValue(getFieldValue(field.key))}</span>
                </div>
              ))}
            </div>
          )}

          {!isViewer && missingEditableFields.length > 0 && !showAddData && (
            <div style={S.addDataBar}>
              <button
                className="btn btn-ghost btn-sm"
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleOpenAddData();
                }}
              >
                + Add Data
              </button>
            </div>
          )}

          {showAddData && !isViewer && (
            <div style={S.addDataPanel}>
              <div style={S.addDataTitle}>השלמת נתונים חסרים</div>
              {missingEditableFields.map((field) => (
                <label key={field.key} style={S.addDataField}>
                  <span style={S.addDataLabel}>P{field.priority} • {field.label}</span>
                  {field.input === 'select' && field.key === 'ft' ? (
                    <select
                      style={S.select}
                      value={addDataDraft[field.key] || ''}
                      onChange={(e) => setAddDataDraft((current) => ({ ...current, [field.key]: e.target.value }))}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <option value="">בחר FT</option>
                      {FT_OPTIONS.map((ft) => (
                        <option key={ft} value={ft}>
                          {ft}
                        </option>
                      ))}
                    </select>
                  ) : field.input === 'select' && field.key === 'priority' ? (
                    <select
                      style={S.select}
                      value={addDataDraft[field.key] || ''}
                      onChange={(e) => setAddDataDraft((current) => ({ ...current, [field.key]: e.target.value }))}
                      onClick={(e) => e.stopPropagation()}
                    >
                      {priorityOptions.map((option) => (
                        <option key={option.value || 'empty'} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  ) : field.input === 'textarea' ? (
                    <textarea
                      style={S.notesTextarea}
                      value={addDataDraft[field.key] || ''}
                      rows={2}
                      onChange={(e) => setAddDataDraft((current) => ({ ...current, [field.key]: e.target.value }))}
                      onClick={(e) => e.stopPropagation()}
                    />
                  ) : (
                    <input
                      className="input"
                      style={{ ...S.select, width: '100%' }}
                      value={addDataDraft[field.key] || ''}
                      onChange={(e) => setAddDataDraft((current) => ({ ...current, [field.key]: e.target.value }))}
                      onClick={(e) => e.stopPropagation()}
                    />
                  )}
                </label>
              ))}
              <div style={S.addDataActions}>
                <button
                  className="btn btn-primary btn-sm"
                  type="button"
                  onClick={handleSaveAddData}
                  disabled={savingAddData}
                >
                  {savingAddData ? 'שומר...' : 'שמור נתונים'}
                </button>
                <button
                  className="btn btn-ghost btn-sm"
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowAddData(false);
                  }}
                  disabled={savingAddData}
                >
                  ביטול
                </button>
              </div>
            </div>
          )}

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
                {QUEST_STATUS_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
          )}

          {isLeader && (
            <div style={S.statusRow}>
              <span style={S.statusLabel}>תעדוף:</span>
              <select
                style={S.select}
                value={quest.priority ?? DEFAULT_PRIORITY}
                onChange={handlePriorityChange}
                disabled={busy}
                onClick={e => e.stopPropagation()}
              >
                {priorityOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          {!isViewer && !isExternalQuest && !isFinishedStatus(quest.status) && (
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
  topLeft:  { display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' },
  chevron:  { color:'var(--text3)', fontSize:10 },
  title:    { fontSize:13, fontWeight:600, color:'var(--text)', marginBottom:5, lineHeight:1.4 },
  meta:     { display:'flex', gap:10, flexWrap:'wrap' },
  metaItem: { fontSize:11, color:'var(--text2)' },
  expanded: { marginTop:10, borderTop:'1px solid var(--border)', paddingTop:10 },
  desc:     { fontSize:12, color:'var(--text2)', marginBottom:10, lineHeight:1.6 },
  infoRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
    fontSize: 12,
  },
  infoLabel: {
    color: 'var(--text3)',
    fontWeight: 700,
  },
  infoValue: {
    color: 'var(--text)',
    fontWeight: 600,
  },
  fieldGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
    gap: 8,
    marginBottom: 10,
  },
  fieldCard: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    padding: '8px 10px',
    borderRadius: 8,
    background: 'var(--surface)',
    border: '1px solid var(--border)',
  },
  fieldLabel: {
    fontSize: 10,
    color: 'var(--text3)',
    fontWeight: 700,
  },
  fieldValue: {
    fontSize: 12,
    color: 'var(--text)',
    lineHeight: 1.4,
    wordBreak: 'break-word',
  },
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
  addDataBar: {
    display: 'flex',
    justifyContent: 'flex-start',
    marginBottom: 10,
  },
  addDataPanel: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    marginBottom: 10,
    padding: '10px',
    borderRadius: 10,
    border: '1px solid var(--border)',
    background: 'var(--surface)',
  },
  addDataTitle: {
    fontSize: 11,
    color: 'var(--text)',
    fontWeight: 700,
  },
  addDataField: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  addDataLabel: {
    fontSize: 10,
    color: 'var(--text3)',
    fontWeight: 700,
  },
  addDataActions: {
    display: 'flex',
    gap: 8,
    justifyContent: 'flex-start',
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
  bottomSection: {
    marginBottom: 10,
    padding: '8px 10px',
    borderRadius: 8,
    border: '1px solid var(--border)',
    background: 'var(--surface)',
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  bottomTitle: {
    fontSize: 11,
    fontWeight: 700,
    color: 'var(--text)',
    marginBottom: 2,
  },
  bottomRow: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: 8,
  },
  bottomLabel: {
    fontSize: 11,
    color: 'var(--text3)',
    fontWeight: 600,
  },
  bottomValue: {
    fontSize: 11,
    color: 'var(--text)',
    textAlign: 'left',
    flex: 1,
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
  dataBadge: {
    fontSize: 10,
    fontWeight: 700,
    padding: '2px 8px',
    borderRadius: 20,
    background: 'color-mix(in srgb, var(--accent) 10%, var(--surface))',
    color: 'var(--text2)',
    border: '1px solid color-mix(in srgb, var(--accent) 26%, var(--border))',
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
  deadlineBadge: {
    fontSize: 10,
    fontWeight: 700,
    padding: '2px 8px',
    borderRadius: 20,
    background: 'color-mix(in srgb, var(--accent) 16%, var(--surface))',
    color: 'color-mix(in srgb, var(--accent) 78%, var(--text))',
    border: '1px solid color-mix(in srgb, var(--accent) 32%, var(--border))',
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

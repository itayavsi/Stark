import { useEffect, useRef, useState, type ChangeEvent, type CSSProperties, type MouseEvent } from 'react';

import { deleteQuestPointGeometry, deleteQuestPolygonGeometry, saveQuestPointGeometry, uploadQuestPolygonGeometry } from '../services/api';
import type { GeometryType, Quest, QuestGeometryRecord } from '../types/domain';

type MessageType = 'success' | 'error' | 'warning' | 'info';

interface QuestGeometryEditorProps {
  quest: Quest;
  disabled?: boolean;
  onSaved: (geometry: QuestGeometryRecord, geometryType: GeometryType) => Promise<void> | void;
  onMessage: (text: string, type: MessageType) => void;
}

function hasGeometryType(types: GeometryType | GeometryType[] | null | undefined, type: GeometryType): boolean {
  if (!types) return false;
  if (Array.isArray(types)) return types.includes(type);
  return types === type;
}

export default function QuestGeometryEditor({
  quest,
  disabled = false,
  onSaved,
  onMessage,
}: QuestGeometryEditorProps) {
  const folderInputRef = useRef<HTMLInputElement | null>(null);
  const [showPointForm, setShowPointForm] = useState(false);
  const [utm, setUtm] = useState('');
  const [savingPoint, setSavingPoint] = useState(false);
  const [uploadingPolygon, setUploadingPolygon] = useState(false);
  const [deletingPoint, setDeletingPoint] = useState(false);
  const [deletingPolygon, setDeletingPolygon] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<{ type: GeometryType } | null>(null);

  const hasPoint = hasGeometryType(quest.geometry_type, 'point');
  const hasPolygon = hasGeometryType(quest.geometry_type, 'polygon');

  useEffect(() => {
    if (!folderInputRef.current) {
      return;
    }
    folderInputRef.current.setAttribute('webkitdirectory', '');
    folderInputRef.current.setAttribute('directory', '');
  }, []);

  const handleSavePoint = async (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    if (!utm.trim() || savingPoint || disabled) {
      return;
    }

    setSavingPoint(true);
    onMessage('⏳ שומר נקודת UTM...', 'info');
    try {
      const geometry = await saveQuestPointGeometry(quest.id, utm.trim());
      setUtm('');
      setShowPointForm(false);
      await onSaved(geometry, 'point');
      onMessage('✓ נקודת המשימה נשמרה', 'success');
    } catch (error: any) {
      onMessage(`✗ ${error?.response?.data?.detail || 'שגיאה בשמירת הנקודה'}`, 'error');
    } finally {
      setSavingPoint(false);
    }
  };

  const handleDeletePoint = async () => {
    if (deletingPoint || disabled) return;
    
    setDeletingPoint(true);
    onMessage('⏳ מסיר נקודה...', 'info');
    try {
      const geometry = await deleteQuestPointGeometry(quest.id);
      await onSaved(geometry, 'point');
      onMessage('✓ נקודה הוסרה', 'success');
    } catch (error: any) {
      onMessage(`✗ ${error?.response?.data?.detail || 'שגיאה בהסרת הנקודה'}`, 'error');
    } finally {
      setDeletingPoint(false);
      setConfirmDelete(null);
    }
  };

  const handleDeletePolygon = async () => {
    if (deletingPolygon || disabled) return;
    
    setDeletingPolygon(true);
    onMessage('⏳ מסיר פוליגון...', 'info');
    try {
      const geometry = await deleteQuestPolygonGeometry(quest.id);
      await onSaved(geometry, 'polygon');
      onMessage('✓ פוליגון הוסר', 'success');
    } catch (error: any) {
      onMessage(`✗ ${error?.response?.data?.detail || 'שגיאה בהסרת הפוליגון'}`, 'error');
    } finally {
      setDeletingPolygon(false);
      setConfirmDelete(null);
    }
  };

  const handlePolygonFiles = async (
    event: ChangeEvent<HTMLInputElement>,
    geometryType: GeometryType,
  ) => {
    event.stopPropagation();
    const files = Array.from(event.target.files || []);
    if (files.length === 0 || uploadingPolygon || disabled) {
      return;
    }

    setUploadingPolygon(true);
    onMessage('⏳ מעלה וממזג פוליגון...', 'info');
    try {
      const geometry = await uploadQuestPolygonGeometry(quest.id, files);
      await onSaved(geometry, geometryType);
      onMessage('✓ פוליגון המשימה נשמר', 'success');
    } catch (error: any) {
      onMessage(`✗ ${error?.response?.data?.detail || 'שגיאה בהעלאת הפוליגון'}`, 'error');
    } finally {
      setUploadingPolygon(false);
      event.target.value = '';
    }
  };

  return (
    <div style={S.wrap} onClick={(event) => event.stopPropagation()}>
      <div style={S.header}>גיאומטריה</div>
      <div style={S.badges}>
        <span style={{...S.badge, ...(hasPoint ? S.badgeActive : {})}}>
          📍 נקודה: {hasPoint ? '✓' : '✗'}
        </span>
        <span style={{...S.badge, ...(hasPolygon ? S.badgeActive : {})}}>
          🔷 פוליגון: {hasPolygon ? '✓' : '✗'}
        </span>
        <span style={S.badge}>סטטוס: {formatGeometryStatus(quest.geometry_status)}</span>
      </div>

      <div style={S.section}>
        <div style={S.sectionHeader}>
          <span>📍 נקודה</span>
          {hasPoint && (
            <button
              className="btn btn-ghost btn-sm"
              style={{ fontSize: 9, padding: '1px 6px', color: 'var(--red)' }}
              onClick={(e) => { e.stopPropagation(); setConfirmDelete({ type: 'point' }); }}
              disabled={disabled || deletingPoint}
              type="button"
            >
              {deletingPoint ? '...' : '🗑 הסר'}
            </button>
          )}
        </div>
        {!hasPoint && (
          <>
            <button
              className="btn btn-ghost btn-sm"
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                setShowPointForm((current) => !current);
              }}
              disabled={disabled || savingPoint}
              style={{ marginBottom: showPointForm ? 6 : 0 }}
            >
              {showPointForm ? '✕ סגור' : '+ הוסף נקודה'}
            </button>

            {showPointForm && (
              <div style={S.pointForm}>
                <input
                  className="input"
                  value={utm}
                  onChange={(event) => setUtm(event.target.value)}
                  placeholder="36R 712345 3512345"
                  style={{ fontSize: 12 }}
                />
                <button
                  className="btn btn-primary btn-sm"
                  type="button"
                  onClick={(event) => void handleSavePoint(event)}
                  disabled={disabled || savingPoint || !utm.trim()}
                >
                  {savingPoint ? '...' : 'שמור'}
                </button>
              </div>
            )}
          </>
        )}
        {hasPoint && (
          <button
            className="btn btn-ghost btn-sm"
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              setShowPointForm((current) => !current);
            }}
            disabled={disabled || savingPoint}
            style={{ marginTop: 4 }}
          >
            {showPointForm ? '✕ סגור' : '✎ עדכן נקודה'}
          </button>
        )}
        {hasPoint && showPointForm && (
          <div style={S.pointForm}>
            <input
              className="input"
              value={utm}
              onChange={(event) => setUtm(event.target.value)}
              placeholder="36R 712345 3512345"
              style={{ fontSize: 12 }}
            />
            <button
              className="btn btn-primary btn-sm"
              type="button"
              onClick={(event) => void handleSavePoint(event)}
              disabled={disabled || savingPoint || !utm.trim()}
            >
              {savingPoint ? '...' : 'שמור'}
            </button>
          </div>
        )}
      </div>

      <div style={S.section}>
        <div style={S.sectionHeader}>
          <span>🔷 פוליגון</span>
          {hasPolygon && (
            <button
              className="btn btn-ghost btn-sm"
              style={{ fontSize: 9, padding: '1px 6px', color: 'var(--red)' }}
              onClick={(e) => { e.stopPropagation(); setConfirmDelete({ type: 'polygon' }); }}
              disabled={disabled || deletingPolygon}
              type="button"
            >
              {deletingPolygon ? '...' : '🗑 הסר'}
            </button>
          )}
        </div>
        {!hasPolygon && (
          <div style={S.polygonButtons}>
            <label
              className="btn btn-ghost btn-sm"
              style={{ cursor: disabled || uploadingPolygon ? 'wait' : 'pointer' }}
              onClick={(event) => event.stopPropagation()}
            >
              {uploadingPolygon ? '⏳...' : '🗜 ZIP'}
              <input
                type="file"
                accept=".zip"
                style={{ display: 'none' }}
                onChange={(event) => void handlePolygonFiles(event, 'polygon')}
                disabled={disabled || uploadingPolygon}
              />
            </label>

            <label
              className="btn btn-ghost btn-sm"
              style={{ cursor: disabled || uploadingPolygon ? 'wait' : 'pointer' }}
              onClick={(event) => event.stopPropagation()}
            >
              {uploadingPolygon ? '⏳...' : '🗂 תיקייה'}
              <input
                ref={folderInputRef}
                type="file"
                multiple
                style={{ display: 'none' }}
                onChange={(event) => void handlePolygonFiles(event, 'polygon')}
                disabled={disabled || uploadingPolygon}
              />
            </label>
          </div>
        )}
        {hasPolygon && (
          <>
            {quest.geometry_source_path && (
              <div style={S.pathHint}>{quest.geometry_source_path}</div>
            )}
            <div style={S.polygonButtons}>
              <label
                className="btn btn-ghost btn-sm"
                style={{ cursor: disabled || uploadingPolygon ? 'wait' : 'pointer' }}
                onClick={(event) => event.stopPropagation()}
              >
                {uploadingPolygon ? '⏳...' : '🔄 עדכן'}
                <input
                  type="file"
                  accept=".zip"
                  style={{ display: 'none' }}
                  onChange={(event) => void handlePolygonFiles(event, 'polygon')}
                  disabled={disabled || uploadingPolygon}
                />
              </label>
            </div>
          </>
        )}
      </div>

      {confirmDelete && (
        <div style={S.confirmOverlay} onClick={() => setConfirmDelete(null)}>
          <div style={S.confirmDialog} onClick={(e) => e.stopPropagation()}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>
              אישור הסרה
            </div>
            <div style={{ fontSize: 12, marginBottom: 12 }}>
              האם אתה בטוח שברצונך להסיר את ה{confirmDelete.type === 'point' ? 'נקודה' : 'פוליגון'}?
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => setConfirmDelete(null)}
                type="button"
              >
                ביטול
              </button>
              <button
                className="btn btn-danger btn-sm"
                onClick={() => confirmDelete.type === 'point' ? handleDeletePoint() : handleDeletePolygon()}
                type="button"
              >
                הסר
              </button>
            </div>
          </div>
        </div>
      )}

      <div style={S.help}>
        נקודה: הזן UTM. פוליגון: העלה ZIP או תיקייה עם קבצי shapefile.
        {hasPoint && hasPolygon && ' (שניהם נשמרו)'}
      </div>
    </div>
  );
}

function formatGeometryStatus(value?: string | null) {
  if (value === 'ready') {
    return 'מוכן';
  }
  if (value === 'pending') {
    return 'ממתין';
  }
  if (value === 'error') {
    return 'שגיאה';
  }
  return 'חסר';
}

const S: Record<string, CSSProperties> = {
  wrap: {
    marginTop: 10,
    padding: '10px 12px',
    borderRadius: 10,
    background: 'var(--surface)',
    border: '1px solid var(--border)',
  },
  header: {
    fontSize: 11,
    fontWeight: 700,
    color: 'var(--text3)',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  badges: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 12,
  },
  badge: {
    fontSize: 10,
    color: 'var(--text2)',
    background: 'var(--surface2)',
    border: '1px solid var(--border)',
    borderRadius: 999,
    padding: '2px 8px',
  },
  badgeActive: {
    background: 'color-mix(in srgb, var(--green) 14%, var(--surface))',
    color: 'var(--green)',
    border: '1px solid color-mix(in srgb, var(--green) 32%, var(--border))',
  },
  section: {
    marginBottom: 12,
    padding: '8px 10px',
    background: 'var(--surface2)',
    borderRadius: 8,
    border: '1px solid var(--border)',
  },
  sectionHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
    fontSize: 11,
    fontWeight: 600,
    color: 'var(--text)',
  },
  pointForm: {
    display: 'flex',
    gap: 6,
    marginTop: 8,
  },
  polygonButtons: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 6,
  },
  help: {
    marginTop: 8,
    fontSize: 10,
    color: 'var(--text3)',
    lineHeight: 1.5,
  },
  pathHint: {
    fontSize: 9,
    color: 'var(--text3)',
    fontFamily: 'monospace',
    wordBreak: 'break-all',
    marginBottom: 6,
  },
  confirmOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(0,0,0,0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
    borderRadius: 10,
  },
  confirmDialog: {
    background: 'var(--surface)',
    padding: '16px 20px',
    borderRadius: 10,
    border: '1px solid var(--border)',
    maxWidth: 280,
  },
};

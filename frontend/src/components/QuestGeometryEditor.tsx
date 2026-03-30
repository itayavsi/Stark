import { useEffect, useRef, useState, type ChangeEvent, type CSSProperties, type MouseEvent } from 'react';

import { saveQuestPointGeometry, uploadQuestPolygonGeometry } from '../services/api';
import type { GeometryType, Quest, QuestGeometryRecord } from '../types/domain';

type MessageType = 'success' | 'error' | 'warning' | 'info';

interface QuestGeometryEditorProps {
  quest: Quest;
  disabled?: boolean;
  onSaved: (geometry: QuestGeometryRecord, geometryType: GeometryType) => Promise<void> | void;
  onMessage: (text: string, type: MessageType) => void;
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
        <span style={S.badge}>סוג: {formatGeometryType(quest.geometry_type)}</span>
        <span style={S.badge}>סטטוס: {formatGeometryStatus(quest.geometry_status)}</span>
      </div>

      <div style={S.actions}>
        <button
          className="btn btn-ghost btn-sm"
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            setShowPointForm((current) => !current);
          }}
          disabled={disabled || savingPoint}
        >
          {showPointForm ? '✕ סגור נקודה' : '📍 Add Point'}
        </button>

        <label
          className="btn btn-ghost btn-sm"
          style={{ cursor: disabled || uploadingPolygon ? 'wait' : 'pointer' }}
          onClick={(event) => event.stopPropagation()}
        >
          {uploadingPolygon ? '⏳ ZIP...' : '🗜 Add Polygon ZIP'}
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
          {uploadingPolygon ? '⏳ Folder...' : '🗂 Add Polygon Folder'}
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
            {savingPoint ? 'שומר...' : 'שמור נקודה'}
          </button>
        </div>
      )}

      <div style={S.help}>
        נקודה: הזן UTM. פוליגון: העלה ZIP או תיקייה עם קבצי shapefile.
      </div>
      {quest.geometry_source_path && (
        <div style={S.pathHint}>{quest.geometry_source_path}</div>
      )}
    </div>
  );
}

function formatGeometryType(value?: string | null) {
  if (value === 'point') {
    return 'נקודה';
  }
  if (value === 'polygon') {
    return 'פוליגון';
  }
  return 'ללא';
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
    marginBottom: 8,
  },
  badge: {
    fontSize: 10,
    color: 'var(--text2)',
    background: 'var(--surface2)',
    border: '1px solid var(--border)',
    borderRadius: 999,
    padding: '2px 8px',
  },
  actions: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 6,
  },
  pointForm: {
    display: 'flex',
    gap: 6,
    marginTop: 8,
  },
  help: {
    marginTop: 8,
    fontSize: 10,
    color: 'var(--text3)',
    lineHeight: 1.5,
  },
  pathHint: {
    marginTop: 8,
    fontSize: 10,
    color: 'var(--text3)',
    fontFamily: 'monospace',
    wordBreak: 'break-all',
  },
};

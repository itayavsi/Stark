import { type ChangeEvent, type CSSProperties, type MouseEvent, type RefObject } from 'react';

import type { GeometryType } from '../../types/domain';

export function formatGeometryStatus(value?: string | null) {
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

export const S: Record<string, CSSProperties> = {
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
  help: {
    marginTop: 8,
    fontSize: 10,
    color: 'var(--text3)',
    lineHeight: 1.5,
  },
};

interface GeometryBadgesProps {
  hasPoint: boolean;
  hasPolygon: boolean;
  geometryStatus?: string | null;
}

export function GeometryBadges({ hasPoint, hasPolygon, geometryStatus }: GeometryBadgesProps) {
  return (
    <div style={S.badges}>
      <span style={{ ...S.badge, ...(hasPoint ? S.badgeActive : {}) }}>
        📍 נקודה: {hasPoint ? '✓' : '✗'}
      </span>
      <span style={{ ...S.badge, ...(hasPolygon ? S.badgeActive : {}) }}>
        🔷 פוליגון: {hasPolygon ? '✓' : '✗'}
      </span>
      <span style={S.badge}>סטטוס: {formatGeometryStatus(geometryStatus)}</span>
    </div>
  );
}

interface PointSectionProps {
  hasPoint: boolean;
  disabled: boolean;
  savingPoint: boolean;
  deletingPoint: boolean;
  showPointForm: boolean;
  utm: string;
  onToggleForm: (event: MouseEvent<HTMLButtonElement>) => void;
  onUtmChange: (value: string) => void;
  onSave: (event: MouseEvent<HTMLButtonElement>) => void;
  onRequestDelete: (event: MouseEvent<HTMLButtonElement>) => void;
}

export function PointSection({
  hasPoint,
  disabled,
  savingPoint,
  deletingPoint,
  showPointForm,
  utm,
  onToggleForm,
  onUtmChange,
  onSave,
  onRequestDelete,
}: PointSectionProps) {
  return (
    <div style={S.section}>
      <div style={S.sectionHeader}>
        <span>📍 נקודה</span>
        {hasPoint && (
          <button
            className="btn btn-ghost btn-sm"
            style={{ fontSize: 9, padding: '1px 6px', color: 'var(--red)' }}
            onClick={onRequestDelete}
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
            onClick={onToggleForm}
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
                onChange={(event) => onUtmChange(event.target.value)}
                placeholder="36R 712345 3512345"
                style={{ fontSize: 12 }}
              />
              <button
                className="btn btn-primary btn-sm"
                type="button"
                onClick={onSave}
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
          onClick={onToggleForm}
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
            onChange={(event) => onUtmChange(event.target.value)}
            placeholder="36R 712345 3512345"
            style={{ fontSize: 12 }}
          />
          <button
            className="btn btn-primary btn-sm"
            type="button"
            onClick={onSave}
            disabled={disabled || savingPoint || !utm.trim()}
          >
            {savingPoint ? '...' : 'שמור'}
          </button>
        </div>
      )}
    </div>
  );
}

interface PolygonSectionProps {
  hasPolygon: boolean;
  disabled: boolean;
  uploadingPolygon: boolean;
  deletingPolygon: boolean;
  sourcePath?: string | null;
  folderInputRef: RefObject<HTMLInputElement>;
  onFiles: (event: ChangeEvent<HTMLInputElement>) => void;
  onRequestDelete: (event: MouseEvent<HTMLButtonElement>) => void;
}

export function PolygonSection({
  hasPolygon,
  disabled,
  uploadingPolygon,
  deletingPolygon,
  sourcePath,
  folderInputRef,
  onFiles,
  onRequestDelete,
}: PolygonSectionProps) {
  return (
    <div style={S.section}>
      <div style={S.sectionHeader}>
        <span>🔷 פוליגון</span>
        {hasPolygon && (
          <button
            className="btn btn-ghost btn-sm"
            style={{ fontSize: 9, padding: '1px 6px', color: 'var(--red)' }}
            onClick={onRequestDelete}
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
              onChange={onFiles}
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
              onChange={onFiles}
              disabled={disabled || uploadingPolygon}
            />
          </label>
        </div>
      )}
      {hasPolygon && (
        <>
          {sourcePath && <div style={S.pathHint}>{sourcePath}</div>}
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
                onChange={onFiles}
                disabled={disabled || uploadingPolygon}
              />
            </label>
          </div>
        </>
      )}
    </div>
  );
}

interface ConfirmDeleteDialogProps {
  type: GeometryType;
  onCancel: () => void;
  onConfirm: () => void;
}

export function ConfirmDeleteDialog({ type, onCancel, onConfirm }: ConfirmDeleteDialogProps) {
  return (
    <div style={S.confirmOverlay} onClick={onCancel}>
      <div style={S.confirmDialog} onClick={(e) => e.stopPropagation()}>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>אישור הסרה</div>
        <div style={{ fontSize: 12, marginBottom: 12 }}>
          האם אתה בטוח שברצונך להסיר את ה{type === 'point' ? 'נקודה' : 'פוליגון'}?
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button className="btn btn-ghost btn-sm" onClick={onCancel} type="button">
            ביטול
          </button>
          <button className="btn btn-danger btn-sm" onClick={onConfirm} type="button">
            הסר
          </button>
        </div>
      </div>
    </div>
  );
}

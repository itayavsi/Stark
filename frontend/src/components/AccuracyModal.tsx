import { useState, type CSSProperties } from 'react';

interface AccuracyModalProps {
  questTitle: string;
  onConfirm: (accuracyXy: number, accuracyZ: number) => Promise<void>;
  onCancel: () => void;
}

export default function AccuracyModal({ questTitle, onConfirm, onCancel }: AccuracyModalProps) {
  const [accuracyXy, setAccuracyXy] = useState('');
  const [accuracyZ, setAccuracyZ] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const xy = parseFloat(accuracyXy);
    const z = parseFloat(accuracyZ);

    if (isNaN(xy) || xy < 0) {
      setError('דיוק XY חייב להיות מספר חיובי');
      return;
    }

    if (isNaN(z) || z < 0) {
      setError('דיוק Z חייב להיות מספר חיובי');
      return;
    }

    setIsLoading(true);
    try {
      await onConfirm(xy, z);
    } catch (err) {
      setError('שגיאה בשמירה. נסה שוב.');
      setIsLoading(false);
    }
  };

  return (
    <div style={S.overlay} onClick={onCancel}>
      <div style={S.modal} onClick={(e) => e.stopPropagation()}>
        <div style={S.header}>
          <h3 style={S.title}>השלמת משימה</h3>
          <button style={S.closeBtn} onClick={onCancel} type="button">✕</button>
        </div>
        
        <form onSubmit={handleSubmit}>
          <div style={S.content}>
            <p style={S.description}>
              יש להזין את ערכי הדיוק להשלמת המשימה: <strong>{questTitle}</strong>
            </p>
            
            <div style={S.field}>
              <label style={S.label} htmlFor="accuracyXy">
                דיוק XY (ס\"מ)
              </label>
              <input
                id="accuracyXy"
                style={S.input}
                type="number"
                step="0.01"
                min="0"
                value={accuracyXy}
                onChange={(e) => setAccuracyXy(e.target.value)}
                placeholder="לדוגמה: 5.0"
                required
                autoFocus
              />
            </div>

            <div style={S.field}>
              <label style={S.label} htmlFor="accuracyZ">
                דיוק Z (ס\"מ)
              </label>
              <input
                id="accuracyZ"
                style={S.input}
                type="number"
                step="0.01"
                min="0"
                value={accuracyZ}
                onChange={(e) => setAccuracyZ(e.target.value)}
                placeholder="לדוגמה: 10.0"
                required
              />
            </div>

            {error && <p style={S.error}>{error}</p>}
          </div>

          <div style={S.footer}>
            <button
              type="button"
              style={S.cancelBtn}
              onClick={onCancel}
              disabled={isLoading}
            >
              ביטול
            </button>
            <button
              type="submit"
              style={S.confirmBtn}
              disabled={isLoading || !accuracyXy || !accuracyZ}
            >
              {isLoading ? 'שומר...' : 'אישור והשלמה'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const S: Record<string, CSSProperties> = {
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(0,0,0,0.6)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10000,
    direction: 'rtl',
  },
  modal: {
    background: 'var(--surface)',
    borderRadius: 12,
    width: 400,
    maxWidth: '90vw',
    boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
    overflow: 'hidden',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '16px 20px',
    borderBottom: '1px solid var(--border)',
  },
  title: {
    margin: 0,
    fontSize: 16,
    fontWeight: 600,
    color: 'var(--text)',
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    fontSize: 18,
    color: 'var(--text3)',
    cursor: 'pointer',
    padding: 4,
  },
  content: {
    padding: 20,
  },
  description: {
    margin: '0 0 16px 0',
    fontSize: 13,
    color: 'var(--text2)',
    lineHeight: 1.5,
  },
  field: {
    marginBottom: 16,
  },
  label: {
    display: 'block',
    marginBottom: 6,
    fontSize: 12,
    fontWeight: 500,
    color: 'var(--text)',
  },
  input: {
    width: '100%',
    padding: '10px 12px',
    fontSize: 14,
    borderRadius: 8,
    border: '1px solid var(--border)',
    background: 'var(--surface2)',
    color: 'var(--text)',
    fontFamily: 'var(--font)',
    boxSizing: 'border-box',
  },
  error: {
    margin: '8px 0 0 0',
    padding: '8px 12px',
    background: 'rgba(255,59,48,0.1)',
    border: '1px solid rgba(255,59,48,0.3)',
    borderRadius: 6,
    fontSize: 12,
    color: '#ff3b30',
  },
  footer: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: 12,
    padding: '16px 20px',
    borderTop: '1px solid var(--border)',
    background: 'var(--surface2)',
  },
  cancelBtn: {
    padding: '8px 16px',
    fontSize: 13,
    borderRadius: 8,
    border: '1px solid var(--border)',
    background: 'var(--surface)',
    color: 'var(--text2)',
    cursor: 'pointer',
    fontFamily: 'var(--font)',
  },
  confirmBtn: {
    padding: '8px 16px',
    fontSize: 13,
    borderRadius: 8,
    border: 'none',
    background: 'var(--accent)',
    color: '#fff',
    cursor: 'pointer',
    fontFamily: 'var(--font)',
  },
};

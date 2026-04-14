import { useMemo, useState, type CSSProperties, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';

import QuestFormFields, { type QuestFormValue } from '../components/QuestFormFields';
import ThemeToggle from '../components/ThemeToggle';
import { useAuth } from '../context/AuthContext';
import { addPendingQuestNotificationId } from '../lib/pendingQuestNotifications';
import { createExternalQuest } from '../services/api';
import { DEFAULT_STATUS, isDeadlinePriorityValue } from '../utils/questOptions';

function getToday() {
  return new Date().toISOString().slice(0, 10);
}

export default function OpenTziuchPage() {
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuth();
  const initialForm = useMemo<QuestFormValue>(
    () => ({
      title: '',
      description: '',
      year: 2026,
      ft: 'FT1',
      status: DEFAULT_STATUS,
      priority: '',
      matziah: 'N',
      target_type: '',
      country: '',
      zarhan_notes: '',
      date: getToday(),
      deadline_at: '',
      assigned_user: user?.display_name || user?.username || '',
      group: user?.group || 'לווינות',
    }),
    [user?.display_name, user?.group, user?.username]
  );

  const [form, setForm] = useState<QuestFormValue>(initialForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!form.title.trim()) {
      setError('יש להזין כותרת למשימה');
      return;
    }
    if (isDeadlinePriorityValue(form.priority) && (!form.deadline_at || !form.deadline_at.includes('T'))) {
      setError('בתעדוף זמן מוגדר יש להזין תאריך ושעה');
      return;
    }

    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const createdQuest = await createExternalQuest({
        title: form.title.trim(),
        description: form.description.trim(),
        status: DEFAULT_STATUS,
        priority: form.priority || undefined,
        date: form.date,
        deadline_at: form.deadline_at || undefined,
        assigned_user: form.assigned_user?.trim(),
        year: form.year,
        ft: form.ft,
        target_type: form.target_type?.trim() || undefined,
        country: form.country?.trim() || undefined,
        zarhan_notes: form.zarhan_notes?.trim() || undefined,
        group: form.group?.trim() || 'לווינות',
        matziah: form.matziah,
      });
      addPendingQuestNotificationId(createdQuest.id);
      setSuccess('הציוח נפתח בהצלחה, נוסף למאגר החיצוני, ויופיע כהתראה חדשה ברשימת המשימות.');
      setForm({
        ...initialForm,
        assigned_user: form.assigned_user,
        group: form.group,
      });
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'פתיחת הציוח נכשלה');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={S.page}>
      <div style={S.topBar}>
        <button className="btn btn-ghost btn-sm" onClick={() => navigate(isAuthenticated ? '/app' : '/login')}>
          {isAuthenticated ? 'חזרה למפה' : 'חזרה לכניסה'}
        </button>
        <ThemeToggle compact />
      </div>

      <div style={S.card}>
        <div style={S.header}>
          <div style={S.badge}>External Quest</div>
          <h1 style={S.title}>פתח ציוח</h1>
          <p style={S.subtitle}>
            יצירת משימה חיצונית חדשה עם שדה מצייח ואפשרות עתידית להעברה למסד המשימות.
          </p>
        </div>

        <form onSubmit={handleSubmit} style={S.form}>
          <QuestFormFields
            value={form}
            onChange={setForm}
            allowEmptyPriority
            showDate
            showAssignedUser
            showGroup
            showZiyuhFields
          />

          {error && <div style={S.errorBox}>{error}</div>}
          {success && <div style={S.successBox}>{success}</div>}

          <div style={S.footer}>
            <button
              className="btn btn-primary"
              type="submit"
              disabled={saving || !form.title.trim()}
              style={S.submitButton}
            >
              {saving ? 'שומר...' : 'פתח ציוח'}
            </button>
            {isAuthenticated && (
              <button className="btn btn-ghost" type="button" onClick={() => navigate('/app')}>
                עבור למשימות
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}

const S: Record<string, CSSProperties> = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'var(--bg)',
    padding: '72px 16px 24px',
  },
  topBar: {
    position: 'fixed',
    top: 16,
    right: 16,
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    zIndex: 20,
  },
  card: {
    width: '100%',
    maxWidth: 720,
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-lg)',
    padding: 28,
    boxShadow: 'var(--shadow)',
  },
  header: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    marginBottom: 20,
  },
  badge: {
    alignSelf: 'flex-start',
    padding: '4px 10px',
    borderRadius: 999,
    background: 'rgba(79,127,255,0.14)',
    color: 'var(--accent)',
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: '0.05em',
    textTransform: 'uppercase',
  },
  title: {
    margin: 0,
    fontSize: 28,
    color: 'var(--text)',
  },
  subtitle: {
    margin: 0,
    fontSize: 14,
    color: 'var(--text2)',
    lineHeight: 1.6,
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  errorBox: {
    borderRadius: 10,
    border: '1px solid rgba(239,68,68,0.32)',
    background: 'rgba(239,68,68,0.08)',
    color: '#f87171',
    padding: '10px 12px',
    fontSize: 13,
  },
  successBox: {
    borderRadius: 10,
    border: '1px solid rgba(34,197,94,0.28)',
    background: 'rgba(34,197,94,0.08)',
    color: '#4ade80',
    padding: '10px 12px',
    fontSize: 13,
  },
  footer: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    justifyContent: 'flex-end',
    marginTop: 4,
    flexWrap: 'wrap',
  },
  submitButton: {
    minWidth: 140,
    justifyContent: 'center',
  },
};

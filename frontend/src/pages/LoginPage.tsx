import { useEffect, useState, type CSSProperties, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import ThemeToggle from '../components/ThemeToggle';
import { useAuth } from '../context/AuthContext';
import { API_BASE_URL, login } from '../services/api';
import type { User } from '../types/domain';

const LOCAL_USERS = [
  { username: 'admin',   password: 'admin123', role: 'Team Leader', display_name: 'מנהל ראשי',  group: 'לווינות' },
  { username: 'user1',   password: 'pass123',  role: 'User',        display_name: 'יוסי כהן',   group: 'לווינות' },
  { username: 'viewer1', password: 'view123',  role: 'Viewer',      display_name: 'צופה ראשון', group: 'לווינות' },
] satisfies Array<User & { password: string }>;

function localAuth(username: string, password: string) {
  return LOCAL_USERS.find(u => u.username === username && u.password === password) || null;
}

export default function LoginPage() {
  const [username, setUsername]   = useState('');
  const [password, setPassword]   = useState('');
  const [error, setError]         = useState('');
  const [loading, setLoading]     = useState(false);
  const [backendOk, setBackendOk] = useState<boolean | null>(null);
  const { login: authenticate } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    fetch(`${API_BASE_URL}/`)
      .then(r => setBackendOk(r.ok))
      .catch(() => setBackendOk(false));
  }, []);

  const saveAndGo = (user: User, token: string) => {
    authenticate(user, token);
    navigate('/groups');
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');

    if (!username.trim() || !password.trim()) {
      setError('יש להזין שם משתמש וסיסמה');
      return;
    }

    setLoading(true);

    try {
      const data = await login(username, password);
      const token = data.token || btoa(JSON.stringify({ username: data.user.username, role: data.user.role }));
      saveAndGo(data.user, token);
      return;
    } catch (err: any) {
      if (err?.response?.status === 401) {
        setError('שם משתמש או סיסמה שגויים');
        setLoading(false);
        return;
      }
      // Backend not reachable — try local fallback
      const localUser = localAuth(username, password);
      if (localUser) {
        const token = btoa(JSON.stringify({ username: localUser.username, role: localUser.role, ts: Date.now() }));
        saveAndGo(localUser, token);
        return;
      }
      setError('שם משתמש או סיסמה שגויים');
    }

    setLoading(false);
  };

  const quickFill = (u: (typeof LOCAL_USERS)[number]) => {
    setUsername(u.username);
    setPassword(u.password);
    setError('');
  };

  return (
    <div style={S.page}>
      <div style={S.topBar}>
        <ThemeToggle compact />
      </div>
      <div style={S.card}>

        {/* Logo */}
        <div style={S.logoWrap}>
          <div style={S.logoIcon}>⬡</div>
          <h1 style={S.title}>מערכת מיפוי</h1>
          <p style={S.subtitle}>GIS Operations Platform</p>
        </div>

        {/* Server status */}
        <div style={S.statusRow}>
          <div style={{
            ...S.dot,
            background: backendOk === null ? '#eab308' : backendOk ? '#22c55e' : '#ef4444',
          }} />
          <span style={S.statusLabel}>
            {backendOk === null ? 'בודק שרת...' : backendOk ? 'שרת מחובר' : 'שרת לא זמין — מצב מקומי'}
          </span>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={S.form} noValidate>
          <div style={S.field}>
            <label style={S.label}>שם משתמש</label>
            <input
              className="input"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="admin"
              autoComplete="username"
              autoFocus
              disabled={loading}
            />
          </div>

          <div style={S.field}>
            <label style={S.label}>סיסמה</label>
            <input
              className="input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
              disabled={loading}
            />
          </div>

          {error && <div style={S.errorBox}>⚠️ {error}</div>}

          <button
            type="submit"
            className="btn btn-primary"
            disabled={loading}
            style={S.submitBtn}
          >
            {loading
              ? <><span className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} /> מתחבר...</>
              : 'כניסה למערכת →'
            }
          </button>
        </form>

        <div style={S.externalEntry}>
          <div style={S.externalEntryText}>צריך לפתוח ציוח חיצוני לפני הכניסה?</div>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => navigate('/open-tziuch')}
            style={S.externalEntryButton}
          >
            פתח ציוח
          </button>
        </div>

        {/* Quick login buttons */}
        <div style={S.quickSection}>
          <div style={S.quickTitle}>כניסה מהירה לבדיקה:</div>
          <div style={S.quickGrid}>
            {LOCAL_USERS.map(u => (
              <button key={u.username} onClick={() => quickFill(u)} disabled={loading} style={S.quickBtn}>
                <span style={S.quickRole}>{u.role}</span>
                <code style={S.quickCode}>{u.username} / {u.password}</code>
              </button>
            ))}
          </div>
        </div>

      </div>
      <div style={S.credit}>© Itay Avsiyvich</div>
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
    position: 'relative',
  },
  topBar: {
    position: 'fixed',
    top: 16,
    right: 16,
    zIndex: 20,
  },
  card: {
    width: '100%',
    maxWidth: 390,
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-lg)',
    padding: '36px 32px',
    boxShadow: 'var(--shadow)',
    margin: '0 16px',
  },
  logoWrap: { textAlign: 'center', marginBottom: 20 },
  logoIcon: { fontSize: 40, color: 'var(--accent)', lineHeight: 1, marginBottom: 10 },
  title: { fontSize: 22, fontWeight: 700, color: 'var(--text)', marginBottom: 4 },
  subtitle: { fontSize: 11, color: 'var(--text3)', letterSpacing: '0.08em', textTransform: 'uppercase' },
  statusRow: { display: 'flex', alignItems: 'center', gap: 7, justifyContent: 'center', marginBottom: 22 },
  dot: { width: 8, height: 8, borderRadius: '50%', flexShrink: 0, transition: 'background 0.3s' },
  statusLabel: { fontSize: 11, color: 'var(--text3)' },
  form: { display: 'flex', flexDirection: 'column', gap: 14 },
  field: { display: 'flex', flexDirection: 'column', gap: 5 },
  label: { fontSize: 13, fontWeight: 500, color: 'var(--text2)' },
  errorBox: {
    background: 'rgba(239,68,68,0.1)',
    border: '1px solid rgba(239,68,68,0.3)',
    color: '#f87171',
    borderRadius: 8,
    padding: '9px 14px',
    fontSize: 13,
    textAlign: 'center',
  },
  submitBtn: {
    width: '100%',
    justifyContent: 'center',
    padding: '11px',
    fontSize: 15,
    marginTop: 2,
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  externalEntry: {
    marginTop: 18,
    padding: '14px 16px',
    borderRadius: 12,
    border: '1px solid var(--border)',
    background: 'var(--surface2)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  externalEntryText: {
    fontSize: 12,
    color: 'var(--text2)',
    lineHeight: 1.5,
  },
  externalEntryButton: {
    flexShrink: 0,
  },
  quickSection: { marginTop: 24, borderTop: '1px solid var(--border)', paddingTop: 16 },
  quickTitle: { fontSize: 11, color: 'var(--text3)', marginBottom: 8, textAlign: 'center', textTransform: 'uppercase', letterSpacing: '0.06em' },
  quickGrid: { display: 'flex', flexDirection: 'column', gap: 6 },
  quickBtn: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    background: 'var(--surface2)',
    border: '1px solid var(--border)',
    borderRadius: 8,
    padding: '7px 12px',
    cursor: 'pointer',
    fontFamily: 'var(--font)',
    color: 'var(--text)',
    transition: 'var(--transition)',
  },
  quickRole: { fontSize: 12, color: 'var(--text2)' },
  quickCode: { fontSize: 11, color: 'var(--accent)', background: 'rgba(79,127,255,0.1)', padding: '2px 8px', borderRadius: 4 },
  credit: {
    position: 'fixed',
    left: 14,
    bottom: 10,
    zIndex: 50,
    fontSize: 11,
    color: 'var(--text3)',
    background: 'var(--overlay)',
    border: '1px solid var(--overlay-border)',
    borderRadius: 999,
    padding: '4px 10px',
    backdropFilter: 'blur(6px)',
    pointerEvents: 'none',
  },
};

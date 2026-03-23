import type { CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const ROLE_LABELS = {
  'Team Leader': 'מנהל צוות',
  'User': 'משתמש',
  'Viewer': 'צופה',
} as const;

interface NavbarProps {
  onTogglePanel: () => void;
  panelOpen: boolean;
}

export default function Navbar({ onTogglePanel, panelOpen }: NavbarProps) {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const displayName = user?.display_name || user?.username || '?';
  const role = ROLE_LABELS[user?.role as keyof typeof ROLE_LABELS] || user?.role || '';
  const avatar = displayName[0]?.toUpperCase() || '?';

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <nav style={S.nav}>
      {/* Brand */}
      <div style={S.brand}>
        <span style={S.logo}>⬡</span>
        <span style={S.brandName}>GIS מערכת</span>
        <span style={S.sep}>·</span>
        <span style={S.brandGroup}>לווינות</span>
      </div>

      {/* Center status */}
      <div style={S.center}>
        <div style={S.pill}>🛰 מצב לייב</div>
      </div>

      {/* Right side */}
      <div style={S.right}>
        <button
          className="btn btn-ghost btn-sm"
          onClick={onTogglePanel}
          title={panelOpen ? 'הסתר פאנל' : 'הצג פאנל'}
        >
          {panelOpen ? '◧ הסתר' : '◧ משימות'}
        </button>

        <div style={S.userChip}>
          <div style={S.avatar}>{avatar}</div>
          <div style={S.userInfo}>
            <span style={S.userName}>{displayName}</span>
            <span style={S.userRole}>{role}</span>
          </div>
        </div>

        <button className="btn btn-ghost btn-sm" onClick={handleLogout}>יציאה</button>
      </div>
    </nav>
  );
}

const S: Record<string, CSSProperties> = {
  nav: {
    height: 52,
    background: 'var(--surface)',
    borderBottom: '1px solid var(--border)',
    display: 'flex', alignItems: 'center',
    padding: '0 18px', gap: 16,
    flexShrink: 0, zIndex: 100,
  },
  brand:     { display: 'flex', alignItems: 'center', gap: 8 },
  logo:      { fontSize: 22, color: 'var(--accent)', lineHeight: 1 },
  brandName: { fontWeight: 700, fontSize: 15, color: 'var(--text)' },
  sep:       { color: 'var(--text3)', fontSize: 13 },
  brandGroup:{ color: 'var(--accent)', fontSize: 13, fontWeight: 600 },
  center:    { flex: 1, display: 'flex', justifyContent: 'center' },
  pill: {
    background: 'rgba(34,197,94,0.12)', color: '#4ade80',
    border: '1px solid rgba(34,197,94,0.25)',
    borderRadius: 99, padding: '3px 12px', fontSize: 12, fontWeight: 500,
  },
  right:     { display: 'flex', alignItems: 'center', gap: 10 },
  userChip:  { display: 'flex', alignItems: 'center', gap: 8 },
  avatar: {
    width: 30, height: 30, borderRadius: '50%',
    background: 'var(--accent)', color: '#fff',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 13, fontWeight: 700, flexShrink: 0,
  },
  userInfo:  { display: 'flex', flexDirection: 'column' },
  userName:  { fontSize: 13, fontWeight: 600, color: 'var(--text)' },
  userRole:  { fontSize: 11, color: 'var(--text3)' },
};

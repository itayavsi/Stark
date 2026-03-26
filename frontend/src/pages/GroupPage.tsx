import { useState, type CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import ThemeToggle from '../components/ThemeToggle';
import { useAuth } from '../context/AuthContext';
import { setSelectedGroup } from '../lib/session';

const GROUPS = [
  { id: 'lavyanut', name: 'לווינות', icon: '🛰️', active: true,  desc: 'מיפוי ולווינות שדה' },
  { id: 'group2',   name: 'קבוצה ב', icon: '🗺️', active: false, desc: 'בקרוב' },
  { id: 'group3',   name: 'קבוצה ג', icon: '📡', active: false, desc: 'בקרוב' },
] as const;

export default function GroupPage() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [hovered, setHovered] = useState<string | null>(null);

  const handleSelect = (group: (typeof GROUPS)[number]) => {
    if (!group.active) return;
    setSelectedGroup(group.id);
    navigate('/app');
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div style={S.page}>
      <div style={S.topBar}>
        <ThemeToggle compact />
      </div>
      <div style={S.container}>

        {/* Header */}
        <div style={S.header}>
          <div>
            <h1 style={S.title}>בחר קבוצה</h1>
            <p style={S.subtitle}>שלום, {user?.display_name || user?.username}</p>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={handleLogout}>
            יציאה
          </button>
        </div>

        {/* Role badge */}
        <div style={S.roleBadge}>
          <span style={S.roleLabel}>תפקיד: </span>
          <span style={S.roleValue}>{user?.role}</span>
        </div>

        {/* Group cards */}
        <div style={S.grid}>
          {GROUPS.map(group => {
            const isHovered = hovered === group.id && group.active;
            return (
              <div
                key={group.id}
                style={{
                  ...S.card,
                  ...(group.active ? S.cardActive : S.cardDisabled),
                  ...(isHovered ? S.cardHover : {}),
                }}
                onClick={() => handleSelect(group)}
                onMouseEnter={() => group.active && setHovered(group.id)}
                onMouseLeave={() => setHovered(null)}
              >
                {group.active && <div style={S.activePill}>פעיל ✓</div>}
                <div style={S.icon}>{group.icon}</div>
                <div style={S.groupName}>{group.name}</div>
                <div style={S.groupDesc}>{group.desc}</div>
                {group.active && (
                  <div style={{ ...S.enterHint, opacity: isHovered ? 1 : 0 }}>
                    לחץ לכניסה →
                  </div>
                )}
              </div>
            );
          })}
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
    backgroundImage: 'radial-gradient(ellipse at 40% 60%, rgba(79,127,255,0.07) 0%, transparent 60%)',
    position: 'relative',
  },
  topBar: {
    position: 'fixed',
    top: 16,
    right: 16,
    zIndex: 20,
  },
  container: {
    width: '100%',
    maxWidth: 600,
    padding: '0 24px',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  title: {
    fontSize: 26,
    fontWeight: 700,
    color: 'var(--text)',
  },
  subtitle: {
    fontSize: 14,
    color: 'var(--text2)',
    marginTop: 4,
  },
  roleBadge: {
    display: 'inline-flex',
    gap: 6,
    alignItems: 'center',
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 20,
    padding: '4px 12px',
    fontSize: 12,
    marginBottom: 28,
  },
  roleLabel: { color: 'var(--text3)' },
  roleValue: { color: 'var(--accent)', fontWeight: 600 },

  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: 16,
  },
  card: {
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-lg)',
    padding: '32px 16px 24px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 8,
    textAlign: 'center',
    position: 'relative',
    transition: 'all 0.18s ease',
    boxShadow: 'var(--shadow-sm)',
  },
  cardActive: {
    cursor: 'pointer',
  },
  cardHover: {
    background: 'var(--surface2)',
    border: '1px solid var(--accent)',
    boxShadow: '0 0 0 1px var(--accent), 0 8px 32px rgba(79,127,255,0.2)',
    transform: 'translateY(-3px)',
  },
  cardDisabled: {
    cursor: 'not-allowed',
    opacity: 0.4,
  },
  activePill: {
    position: 'absolute',
    top: 10,
    left: 10,
    background: 'rgba(34,197,94,0.15)',
    color: 'var(--green)',
    border: '1px solid rgba(34,197,94,0.3)',
    borderRadius: 20,
    fontSize: 10,
    fontWeight: 600,
    padding: '2px 8px',
  },
  icon: {
    fontSize: 38,
    marginBottom: 4,
    lineHeight: 1,
  },
  groupName: {
    fontSize: 17,
    fontWeight: 700,
    color: 'var(--text)',
  },
  groupDesc: {
    fontSize: 12,
    color: 'var(--text3)',
  },
  enterHint: {
    fontSize: 12,
    color: 'var(--accent)',
    fontWeight: 500,
    marginTop: 4,
    transition: 'opacity 0.15s ease',
  },
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

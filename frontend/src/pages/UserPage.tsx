import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type FormEvent,
} from 'react';
import { useNavigate } from 'react-router-dom';

import ThemeToggle from '../components/ThemeToggle';
import { useAuth } from '../context/AuthContext';
import { createUser, deleteUser, getQuests, getUsers, updateUser as updateUserApi } from '../services/api';
import type { Quest, User, UserCreateInput, UserRole, UserUpdateInput } from '../types/domain';
import { USER_CREATE_FIELDS, USER_EDIT_FIELDS } from '../config/userFields';

const ROLE_LABELS: Record<UserRole, string> = {
  'Team Leader': 'מנהל צוות',
  User: 'משתמש',
  Viewer: 'צופה',
};

const ROLE_OPTIONS: UserRole[] = ['Team Leader', 'User', 'Viewer'];
const ACTIVE_STATUSES = new Set(['Open', 'Taken', 'In Progress', 'ממתין']);
const DONE_STATUSES = new Set(['Done', 'Approved']);

interface UserEditState {
  display_name: string;
  role: UserRole;
  group: string;
  password: string;
}

const EMPTY_CREATE_FORM: UserCreateInput = {
  username: '',
  password: '',
  role: 'Viewer',
  group: 'לווינות',
  display_name: '',
};

export default function UserPage() {
  const navigate = useNavigate();
  const { user, logout, updateUser: updateSessionUser } = useAuth();
  const isLeader = user?.role === 'Team Leader';
  const [quests, setQuests] = useState<Quest[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [adminEdits, setAdminEdits] = useState<Record<string, UserEditState>>({});
  const [createForm, setCreateForm] = useState<UserCreateInput>(EMPTY_CREATE_FORM);
  const [loading, setLoading] = useState(true);
  const [savingUserId, setSavingUserId] = useState<string | null>(null);
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const [questData, userData] = await Promise.all([
        getQuests(),
        isLeader ? getUsers() : Promise.resolve([]),
      ]);

      setQuests(questData);
      setUsers(userData);
      setAdminEdits(
        Object.fromEntries(
          userData
            .filter((entry) => Boolean(entry.id))
            .map((entry) => [
              String(entry.id),
              {
                display_name: entry.display_name || '',
                role: entry.role,
                group: entry.group || '',
                password: '',
              },
            ])
        )
      );
    } catch {
      setError('לא הצלחנו לטעון את נתוני המשתמש כרגע');
    } finally {
      setLoading(false);
    }
  }, [isLeader]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const displayName = user?.display_name || user?.username || 'Unknown user';
  const identitySet = useMemo(() => {
    return new Set(
      [user?.username, user?.display_name]
        .map((value) => String(value || '').trim())
        .filter(Boolean)
    );
  }, [user?.display_name, user?.username]);

  const myQuests = useMemo(
    () => quests.filter((quest) => identitySet.has(String(quest.assigned_user || '').trim())),
    [identitySet, quests]
  );
  const myActiveQuests = useMemo(
    () => myQuests.filter((quest) => ACTIVE_STATUSES.has(String(quest.status))),
    [myQuests]
  );
  const myDoneQuests = useMemo(
    () => myQuests.filter((quest) => DONE_STATUSES.has(String(quest.status))),
    [myQuests]
  );
  const myHighPriorityQuests = useMemo(
    () => myQuests.filter((quest) => String(quest.priority || '').trim() === 'גבוה'),
    [myQuests]
  );
  const recentAssignedQuests = useMemo(() => myQuests.slice(0, 5), [myQuests]);
  const groupQuestCount = useMemo(
    () => quests.filter((quest) => quest.group === user?.group).length,
    [quests, user?.group]
  );

  const totalUsers = users.length;
  const teamLeaderCount = users.filter((entry) => entry.role === 'Team Leader').length;
  const regularUserCount = users.filter((entry) => entry.role === 'User').length;
  const viewerCount = users.filter((entry) => entry.role === 'Viewer').length;

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const updateAdminField = (userId: string, field: keyof UserEditState, value: string) => {
    setAdminEdits((current) => ({
      ...current,
      [userId]: {
        ...(current[userId] || { display_name: '', role: 'Viewer', group: '', password: '' }),
        [field]: value,
      } as UserEditState,
    }));
  };

  const handleCreateUser = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setCreating(true);
    setError('');
    setMessage('');

    try {
      await createUser({
        ...createForm,
        username: createForm.username.trim(),
        password: createForm.password.trim(),
        display_name: createForm.display_name.trim() || createForm.username.trim(),
        group: createForm.group?.trim() || 'לווינות',
      });
      setCreateForm(EMPTY_CREATE_FORM);
      setMessage('המשתמש נוצר בהצלחה');
      await loadData();
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'יצירת המשתמש נכשלה');
    } finally {
      setCreating(false);
    }
  };

  const handleSaveUser = async (entry: User) => {
    if (!entry.id) {
      return;
    }

    const draft = adminEdits[entry.id];
    if (!draft) {
      return;
    }

    setSavingUserId(entry.id);
    setError('');
    setMessage('');

    const payload: UserUpdateInput = {
      display_name: draft.display_name.trim(),
      role: draft.role,
      group: draft.group.trim(),
    };

    if (draft.password.trim()) {
      payload.password = draft.password.trim();
    }

    try {
      const updated = await updateUserApi(entry.id, payload);
      setUsers((current) => current.map((candidate) => candidate.id === entry.id ? updated : candidate));
      setAdminEdits((current) => ({
        ...current,
        [entry.id as string]: {
          display_name: updated.display_name || '',
          role: updated.role,
          group: updated.group || '',
          password: '',
        },
      }));

      if (user && (user.id === updated.id || user.username === updated.username)) {
        updateSessionUser({ ...user, ...updated });
      }

      setMessage(`המשתמש ${updated.username} עודכן`);
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'שמירת המשתמש נכשלה');
    } finally {
      setSavingUserId(null);
    }
  };

  const handleDeleteUser = async (entry: User) => {
    if (!entry.id || entry.username === user?.username) {
      return;
    }

    const confirmed = window.confirm(`למחוק את המשתמש ${entry.username}?`);
    if (!confirmed) {
      return;
    }

    setDeletingUserId(entry.id);
    setError('');
    setMessage('');

    try {
      await deleteUser(entry.id);
      setUsers((current) => current.filter((candidate) => candidate.id !== entry.id));
      setAdminEdits((current) => {
        const next = { ...current };
        delete next[entry.id as string];
        return next;
      });
      setMessage(`המשתמש ${entry.username} נמחק`);
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'מחיקת המשתמש נכשלה');
    } finally {
      setDeletingUserId(null);
    }
  };

  const avatar = displayName[0]?.toUpperCase() || '?';

  return (
    <div style={S.page}>
      <div style={S.topBar}>
        <button className="btn btn-ghost btn-sm" onClick={() => navigate('/app')}>חזרה למפה</button>
        <button className="btn btn-ghost btn-sm" onClick={() => navigate('/groups')}>קבוצות</button>
        <ThemeToggle compact />
      </div>

      <div style={S.container}>
        <section style={S.hero}>
          <div style={S.heroMain}>
            <div style={S.avatar}>{avatar}</div>
            <div style={S.heroText}>
              <div style={S.eyebrow}>עמוד משתמש</div>
              <h1 style={S.title}>{displayName}</h1>
              <p style={S.subtitle}>
                @{user?.username} • {ROLE_LABELS[(user?.role || 'Viewer') as UserRole]} • {user?.group || 'ללא קבוצה'}
              </p>
            </div>
          </div>
          <div style={S.heroActions}>
            <button className="btn btn-primary" onClick={() => navigate('/app')}>פתח סביבת עבודה</button>
            <button className="btn btn-ghost" onClick={handleLogout}>יציאה</button>
          </div>
        </section>

        {(error || message) && (
          <div style={{ ...S.notice, ...(error ? S.noticeError : S.noticeSuccess) }}>
            {error || message}
          </div>
        )}

        <section style={S.grid}>
          <article style={S.card}>
            <div style={S.cardTitle}>פרטי חשבון</div>
            <div style={S.infoList}>
              <div style={S.infoRow}><span style={S.infoLabel}>שם מלא</span><span>{displayName}</span></div>
              <div style={S.infoRow}><span style={S.infoLabel}>שם משתמש</span><span>{user?.username || '—'}</span></div>
              <div style={S.infoRow}><span style={S.infoLabel}>הרשאה</span><span>{ROLE_LABELS[(user?.role || 'Viewer') as UserRole]}</span></div>
              <div style={S.infoRow}><span style={S.infoLabel}>קבוצה</span><span>{user?.group || '—'}</span></div>
            </div>
          </article>

          <article style={S.card}>
            <div style={S.cardTitle}>סיכום עבודה</div>
            <div style={S.statsRow}>
              <div style={S.stat}><strong>{myQuests.length}</strong><span>משימות שלי</span></div>
              <div style={S.stat}><strong>{myActiveQuests.length}</strong><span>פעילות</span></div>
              <div style={S.stat}><strong>{myDoneQuests.length}</strong><span>הושלמו</span></div>
              <div style={S.stat}><strong>{myHighPriorityQuests.length}</strong><span>גבוהות</span></div>
            </div>
            <div style={S.metaNote}>בקבוצה שלך קיימות כרגע {groupQuestCount} משימות</div>
          </article>
        </section>

        <section style={S.section}>
          <div style={S.sectionHeader}>
            <div>
              <h2 style={S.sectionTitle}>משימות אחרונות שלי</h2>
              <p style={S.sectionSubtitle}>סקירה מהירה של המשימות המשויכות למשתמש הנוכחי</p>
            </div>
          </div>
          <div style={S.listCard}>
            {loading ? (
              <div style={S.empty}>טוען נתונים...</div>
            ) : recentAssignedQuests.length === 0 ? (
              <div style={S.empty}>עדיין אין משימות שמשויכות למשתמש הזה</div>
            ) : (
              recentAssignedQuests.map((quest) => (
                <div key={quest.id} style={S.questRow}>
                  <div>
                    <div style={S.questTitle}>{quest.title}</div>
                    <div style={S.questMeta}>{quest.ft || 'ללא FT'} • {quest.date || 'ללא תאריך'}</div>
                  </div>
                  <div style={S.questStatus}>{quest.status}</div>
                </div>
              ))
            )}
          </div>
        </section>

        {isLeader && (
          <section style={S.section}>
            <div style={S.sectionHeader}>
              <div>
                <h2 style={S.sectionTitle}>ניהול משתמשים</h2>
                <p style={S.sectionSubtitle}>הוספה, שינוי הרשאות ועדכון פרטי משתמשים</p>
              </div>
            </div>

            <div style={S.adminSummary}>
              <div style={S.adminStat}><strong>{totalUsers}</strong><span>סה"כ משתמשים</span></div>
              <div style={S.adminStat}><strong>{teamLeaderCount}</strong><span>מנהלים</span></div>
              <div style={S.adminStat}><strong>{regularUserCount}</strong><span>משתמשים</span></div>
              <div style={S.adminStat}><strong>{viewerCount}</strong><span>צופים</span></div>
            </div>

            <form style={S.formCard} onSubmit={(event) => void handleCreateUser(event)}>
              <div style={S.cardTitle}>הוספת משתמש חדש</div>
              <div style={S.formGrid}>
                {USER_CREATE_FIELDS.map((field) => (
                  field.type === 'select' && field.key === 'role' ? (
                    <select
                      key={field.key}
                      value={createForm.role}
                      onChange={(event) => setCreateForm((current) => ({ ...current, role: event.target.value as UserRole }))}
                    >
                      {ROLE_OPTIONS.map((role) => (
                        <option key={role} value={role}>{ROLE_LABELS[role]}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      key={field.key}
                      value={String(createForm[field.key] ?? '')}
                      onChange={(event) => setCreateForm((current) => ({ ...current, [field.key]: event.target.value }))}
                      placeholder={field.placeholder || field.label}
                      type={field.type}
                    />
                  )
                ))}
              </div>
              <div style={S.formActions}>
                <button className="btn btn-primary" type="submit" disabled={creating}>
                  {creating ? 'יוצר...' : 'הוסף משתמש'}
                </button>
              </div>
            </form>

            <div style={S.userList}>
              {users.map((entry) => {
                const draft = adminEdits[String(entry.id)] || {
                  display_name: entry.display_name || '',
                  role: entry.role,
                  group: entry.group || '',
                  password: '',
                };
                const isCurrentUser = entry.username === user?.username;

                return (
                  <article key={entry.id || entry.username} style={S.userCard}>
                    <div style={S.userCardHeader}>
                      <div>
                        <div style={S.userCardTitle}>{entry.display_name || entry.username}</div>
                        <div style={S.userCardMeta}>@{entry.username}{isCurrentUser ? ' • החשבון שלך' : ''}</div>
                      </div>
                      <span style={S.rolePill}>{ROLE_LABELS[entry.role]}</span>
                    </div>

                    <div style={S.formGrid}>
                      {USER_EDIT_FIELDS.map((field) => (
                        field.type === 'select' && field.key === 'role' ? (
                          <select
                            key={field.key}
                            value={draft.role}
                            onChange={(event) => updateAdminField(String(entry.id), 'role', event.target.value)}
                          >
                            {ROLE_OPTIONS.map((role) => (
                              <option key={role} value={role}>{ROLE_LABELS[role]}</option>
                            ))}
                          </select>
                        ) : (
                          <input
                            key={field.key}
                            value={String(draft[field.key as keyof UserEditState] ?? '')}
                            onChange={(event) => updateAdminField(String(entry.id), field.key as keyof UserEditState, event.target.value)}
                            placeholder={field.placeholder || field.label}
                            type={field.type}
                          />
                        )
                      ))}
                    </div>

                    <div style={S.formActions}>
                      <button
                        className="btn btn-primary btn-sm"
                        type="button"
                        onClick={() => void handleSaveUser(entry)}
                        disabled={savingUserId === entry.id}
                      >
                        {savingUserId === entry.id ? 'שומר...' : 'שמור'}
                      </button>
                      <button
                        className="btn btn-danger btn-sm"
                        type="button"
                        onClick={() => void handleDeleteUser(entry)}
                        disabled={isCurrentUser || deletingUserId === entry.id}
                        title={isCurrentUser ? 'לא ניתן למחוק את המשתמש המחובר' : 'מחק משתמש'}
                      >
                        {deletingUserId === entry.id ? 'מוחק...' : 'מחק'}
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

const S: Record<string, CSSProperties> = {
  page: {
    minHeight: '100vh',
    background: 'var(--bg)',
    padding: '24px',
  },
  topBar: {
    display: 'flex',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 10,
    marginBottom: 20,
  },
  container: {
    maxWidth: 1180,
    margin: '0 auto',
    display: 'flex',
    flexDirection: 'column',
    gap: 18,
  },
  hero: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 20,
    padding: '24px 28px',
    borderRadius: 'var(--radius-lg)',
    border: '1px solid var(--border)',
    background: 'linear-gradient(135deg, color-mix(in srgb, var(--accent) 14%, var(--surface)) 0%, var(--surface) 65%)',
    boxShadow: 'var(--shadow-sm)',
    flexWrap: 'wrap',
  },
  heroMain: {
    display: 'flex',
    alignItems: 'center',
    gap: 18,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'var(--accent)',
    color: '#fff',
    fontSize: 28,
    fontWeight: 800,
    boxShadow: '0 10px 30px color-mix(in srgb, var(--accent) 30%, transparent)',
  },
  heroText: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  eyebrow: {
    fontSize: 12,
    color: 'var(--text3)',
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
  },
  title: {
    fontSize: 30,
    color: 'var(--text)',
  },
  subtitle: {
    fontSize: 14,
    color: 'var(--text2)',
  },
  heroActions: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'wrap',
  },
  notice: {
    padding: '12px 14px',
    borderRadius: 'var(--radius)',
    fontSize: 13,
    fontWeight: 600,
  },
  noticeError: {
    background: 'color-mix(in srgb, var(--red) 12%, var(--surface))',
    border: '1px solid color-mix(in srgb, var(--red) 24%, var(--border))',
    color: 'var(--red)',
  },
  noticeSuccess: {
    background: 'color-mix(in srgb, var(--green) 12%, var(--surface))',
    border: '1px solid color-mix(in srgb, var(--green) 24%, var(--border))',
    color: 'var(--green)',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
    gap: 18,
  },
  card: {
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-lg)',
    padding: 18,
    boxShadow: 'var(--shadow-sm)',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: 700,
    color: 'var(--text)',
    marginBottom: 14,
  },
  infoList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
  infoRow: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: 12,
    borderBottom: '1px solid color-mix(in srgb, var(--border) 65%, transparent)',
    paddingBottom: 8,
    color: 'var(--text)',
  },
  infoLabel: {
    color: 'var(--text3)',
  },
  statsRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
    gap: 10,
  },
  stat: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    padding: '14px 12px',
    borderRadius: 'var(--radius)',
    background: 'var(--surface2)',
    border: '1px solid var(--border)',
    textAlign: 'center',
    color: 'var(--text2)',
  },
  metaNote: {
    marginTop: 12,
    fontSize: 12,
    color: 'var(--text3)',
  },
  section: {
    display: 'flex',
    flexDirection: 'column',
    gap: 14,
  },
  sectionHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 16,
    flexWrap: 'wrap',
  },
  sectionTitle: {
    fontSize: 22,
    color: 'var(--text)',
  },
  sectionSubtitle: {
    marginTop: 4,
    fontSize: 13,
    color: 'var(--text3)',
  },
  listCard: {
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-lg)',
    overflow: 'hidden',
    boxShadow: 'var(--shadow-sm)',
  },
  empty: {
    padding: 24,
    color: 'var(--text3)',
    textAlign: 'center',
  },
  questRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 14,
    padding: '16px 18px',
    borderBottom: '1px solid color-mix(in srgb, var(--border) 68%, transparent)',
  },
  questTitle: {
    fontSize: 14,
    fontWeight: 700,
    color: 'var(--text)',
  },
  questMeta: {
    marginTop: 4,
    fontSize: 12,
    color: 'var(--text3)',
  },
  questStatus: {
    fontSize: 12,
    fontWeight: 700,
    color: 'var(--accent)',
    whiteSpace: 'nowrap',
  },
  adminSummary: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
    gap: 12,
  },
  adminStat: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    padding: '16px 14px',
    borderRadius: 'var(--radius)',
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    boxShadow: 'var(--shadow-sm)',
    textAlign: 'center',
    color: 'var(--text2)',
  },
  formCard: {
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-lg)',
    padding: 18,
    boxShadow: 'var(--shadow-sm)',
  },
  formGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
    gap: 10,
  },
  formActions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 12,
    flexWrap: 'wrap',
  },
  userList: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
    gap: 14,
  },
  userCard: {
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-lg)',
    padding: 18,
    boxShadow: 'var(--shadow-sm)',
  },
  userCardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 12,
  },
  userCardTitle: {
    fontSize: 15,
    fontWeight: 700,
    color: 'var(--text)',
  },
  userCardMeta: {
    marginTop: 4,
    fontSize: 12,
    color: 'var(--text3)',
  },
  rolePill: {
    display: 'inline-flex',
    alignItems: 'center',
    borderRadius: 999,
    padding: '4px 10px',
    background: 'color-mix(in srgb, var(--accent) 14%, var(--surface))',
    color: 'var(--accent)',
    fontSize: 11,
    fontWeight: 700,
    border: '1px solid color-mix(in srgb, var(--accent) 24%, var(--border))',
  },
};

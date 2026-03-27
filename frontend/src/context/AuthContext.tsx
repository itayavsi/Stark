import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import {
  clearStoredSession,
  getStoredToken,
  getStoredUser,
  setStoredSession,
} from '../lib/session';
import type { User } from '../types/domain';

interface AuthContextValue {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  login: (user: User, token: string) => void;
  updateUser: (user: User) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => getStoredUser());
  const [token, setToken] = useState<string | null>(() => getStoredToken());

  useEffect(() => {
    const syncFromStorage = () => {
      setUser(getStoredUser());
      setToken(getStoredToken());
    };

    window.addEventListener('storage', syncFromStorage);
    return () => window.removeEventListener('storage', syncFromStorage);
  }, []);

  const login = useCallback((nextUser: User, nextToken: string) => {
    setStoredSession(nextUser, nextToken);
    setUser(nextUser);
    setToken(nextToken);
  }, []);

  const updateUser = useCallback((nextUser: User) => {
    setUser(nextUser);
    if (token) {
      setStoredSession(nextUser, token);
    }
  }, [token]);

  const logout = useCallback(() => {
    clearStoredSession();
    setUser(null);
    setToken(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      token,
      isAuthenticated: Boolean(token),
      login,
      updateUser,
      logout,
    }),
    [login, logout, token, updateUser, user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }

  return context;
}

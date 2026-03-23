import type { User } from '../types/domain';

const TOKEN_KEY = 'token';
const USER_KEY = 'user';
const GROUP_KEY = 'selectedGroup';

function parseUser(raw: string | null): User | null {
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as User;
  } catch {
    return null;
  }
}

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function getStoredUser(): User | null {
  return parseUser(localStorage.getItem(USER_KEY));
}

export function setStoredSession(user: User, token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearStoredSession(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  localStorage.removeItem(GROUP_KEY);
}

export function getSelectedGroup(): string | null {
  return localStorage.getItem(GROUP_KEY);
}

export function setSelectedGroup(groupId: string): void {
  localStorage.setItem(GROUP_KEY, groupId);
}

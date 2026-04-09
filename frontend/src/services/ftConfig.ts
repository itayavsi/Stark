// FT layer definitions — color used for map layers AND card stripe
import type { FtOption } from '../types/domain';

export interface FtConfigEntry {
  key: string;
  color: string;
}

const STORAGE_KEY = 'ft_config_entries_v1';

const DEFAULT_FT_ENTRIES: FtConfigEntry[] = [
  { key: 'FT1', color: '#22c55e' },
  { key: 'FT2', color: '#3b82f6' },
  { key: 'FT3', color: '#f97316' },
  { key: 'FT4', color: '#a855f7' },
  { key: 'FT5', color: '#ef4444' },
];

function normalizeFtKey(value: string): string {
  return value.trim().replace(/\s+/g, '_');
}

function sanitizeEntries(entries: FtConfigEntry[]): FtConfigEntry[] {
  const seen = new Set<string>();
  const sanitized: FtConfigEntry[] = [];

  entries.forEach((entry) => {
    const key = normalizeFtKey(entry.key);
    if (!key || seen.has(key)) {
      return;
    }
    seen.add(key);
    sanitized.push({
      key,
      color: entry.color?.trim() || '#6b7280',
    });
  });

  return sanitized.length > 0 ? sanitized : [...DEFAULT_FT_ENTRIES];
}

function loadEntriesFromStorage(): FtConfigEntry[] {
  if (typeof window === 'undefined') {
    return [...DEFAULT_FT_ENTRIES];
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [...DEFAULT_FT_ENTRIES];
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [...DEFAULT_FT_ENTRIES];
    }
    return sanitizeEntries(parsed as FtConfigEntry[]);
  } catch {
    return [...DEFAULT_FT_ENTRIES];
  }
}

let entriesCache: FtConfigEntry[] = loadEntriesFromStorage();

export const FT_OPTIONS: FtOption[] = entriesCache.map((entry) => entry.key);
export const FT_COLORS: Record<string, string> = Object.fromEntries(
  entriesCache.map((entry) => [entry.key, entry.color])
);

function syncExports(entries: FtConfigEntry[]) {
  FT_OPTIONS.splice(0, FT_OPTIONS.length, ...entries.map((entry) => entry.key));

  Object.keys(FT_COLORS).forEach((key) => {
    delete FT_COLORS[key];
  });
  entries.forEach((entry) => {
    FT_COLORS[entry.key] = entry.color;
  });
}

export function getFtEntries(): FtConfigEntry[] {
  return entriesCache.map((entry) => ({ ...entry }));
}

export function saveFtEntries(entries: FtConfigEntry[]): FtConfigEntry[] {
  const sanitized = sanitizeEntries(entries);
  entriesCache = sanitized;
  syncExports(sanitized);

  if (typeof window !== 'undefined') {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(sanitized));
    window.dispatchEvent(new CustomEvent('ft-config-changed'));
  }

  return getFtEntries();
}

export function ftColor(ft?: FtOption | string) {
  if (!ft || !(ft in FT_COLORS)) {
    return '#6b7280';
  }
  return FT_COLORS[String(ft)];
}

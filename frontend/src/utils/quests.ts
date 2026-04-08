import type { Quest, QuestStatus } from '../types/domain';
import {
  ALL_QUEST_COLUMNS,
  QUEST_STATUS_OPTIONS,
  type QuestPanelColumnKey,
  type QuestStatusCategory,
} from '../config/questTableColumns';

interface QuestView {
  id: 'open' | 'done' | 'stopped' | 'more' | 'new' | 'low';
  label: string;
  icon: string;
  statuses: readonly string[];
}

const STATUS_BY_CATEGORY = QUEST_STATUS_OPTIONS.reduce<Record<QuestStatusCategory, string[]>>(
  (acc, option) => {
    acc[option.category].push(option.value);
    return acc;
  },
  { start: [], regular: [], paused: [], finished: [], on_hold: [] }
);

export const QUEST_VIEWS: readonly QuestView[] = [
  { id: 'open', label: 'פתוחות', icon: '📋', statuses: [...STATUS_BY_CATEGORY.start, ...STATUS_BY_CATEGORY.regular] },
  { id: 'done', label: 'הסתיימו', icon: '✅', statuses: [...STATUS_BY_CATEGORY.finished] },
  { id: 'stopped', label: 'הופסקו', icon: '⏸', statuses: [...STATUS_BY_CATEGORY.paused] },
  { id: 'more', label: 'בהמתנה', icon: '⏳', statuses: [...STATUS_BY_CATEGORY.on_hold] },
  { id: 'new', label: 'חדשות', icon: '🔔', statuses: [] },
  { id: 'low', label: 'תעדוף נמוך', icon: '⬇', statuses: [] },
] as const;

export type QuestViewId = (typeof QUEST_VIEWS)[number]['id'];
export type QuestSearchScope = 'current' | 'all';

export const STATUS_LABELS: Record<string, string> = {
  New: 'חדש',
  ...Object.fromEntries(QUEST_STATUS_OPTIONS.map((opt) => [opt.value, opt.label])),
};

const LEGACY_STATUS_MAP: Record<string, string> = {
  Open: 'Start',
  Taken: 'Production',
  'In Progress': 'Production',
  Done: 'Finished',
  Approved: 'Finished',
  Stopped: 'Paused',
  Cancelled: 'Paused',
  פתוח: 'Start',
  ממתין: 'Start',
  הושלם: 'Finished',
  הופסק: 'Paused',
};

export function normalizeQuestStatus(status: string | undefined): string | undefined {
  if (!status || status === 'New') {
    return status;
  }
  return LEGACY_STATUS_MAP[status] ?? status;
}

export function getStatusCategory(status: string | undefined): QuestStatusCategory | null {
  const normalized = normalizeQuestStatus(status);
  if (!normalized) return null;
  return QUEST_STATUS_OPTIONS.find((opt) => opt.value === normalized)?.category ?? null;
}

export function isFinishedStatus(status: string | undefined): boolean {
  return getStatusCategory(status) === 'finished';
}

export function isPausedStatus(status: string | undefined): boolean {
  return getStatusCategory(status) === 'paused';
}

export function isOnHoldStatus(status: string | undefined): boolean {
  return getStatusCategory(status) === 'on_hold';
}

export function isStartStatus(status: string | undefined): boolean {
  return getStatusCategory(status) === 'start';
}

export function isLowPriorityQuest(quest: Quest): boolean {
  const priority = String(quest.priority ?? '').trim().toLowerCase();
  return priority === 'נמוך' || priority === 'low' || priority === 'low priority';
}

export function isMoreQuest(quest: Quest): boolean {
  return isOnHoldStatus(quest.status);
}

export function isOpenViewQuest(quest: Quest): boolean {
  const category = getStatusCategory(quest.status);
  return (category === 'start' || category === 'regular') && !isLowPriorityQuest(quest);
}

export { ALL_QUEST_COLUMNS };


export interface QuestSortOption {
  id: 'manual' | 'ft' | 'date' | 'assigned_user';
  label: string;
  getValue: (quest: Quest) => string | number;
  defaultDirection: 'asc' | 'desc';
}

export const QUEST_SORT_OPTIONS: readonly QuestSortOption[] = [
  {
    id: 'manual',
    label: 'ידני',
    getValue: () => '',
    defaultDirection: 'asc',
  },
  {
    id: 'ft',
    label: 'FT',
    getValue: (quest) => String(quest.ft ?? ''),
    defaultDirection: 'asc',
  },
  {
    id: 'date',
    label: 'תאריך',
    getValue: (quest) => String(quest.date ?? ''),
    defaultDirection: 'desc',
  },
  {
    id: 'assigned_user',
    label: 'משתמש',
    getValue: (quest) => String(quest.assigned_user ?? ''),
    defaultDirection: 'asc',
  },
] as const;

export type QuestSortOptionId = (typeof QUEST_SORT_OPTIONS)[number]['id'];

export function getQuestView(viewId: QuestViewId) {
  return QUEST_VIEWS.find((view) => view.id === viewId) ?? QUEST_VIEWS[0];
}

export function getQuestStatusLabel(status: QuestStatus | string): string {
  const normalized = normalizeQuestStatus(status);
  return STATUS_LABELS[normalized ?? status] ?? (normalized ?? status);
}

export function getQuestDisplayStatus(quest: Quest): QuestStatus | string {
  return quest.isNew ? 'New' : normalizeQuestStatus(quest.status) ?? quest.status;
}

function matchesQuestSearch(quest: Quest, search: string): boolean {
  const normalizedSearch = search.trim();

  if (!normalizedSearch) {
    return true;
  }

  return [quest.title, quest.description, quest.ft]
    .filter(Boolean)
    .some((value) => String(value).includes(normalizedSearch));
}

export function filterQuests(
  quests: Quest[],
  viewId: QuestViewId,
  search: string,
  scope: QuestSearchScope = 'current'
): Quest[] {
  const currentView = getQuestView(viewId);

  return quests.filter((quest) => {
    const normalizedStatus = normalizeQuestStatus(quest.status) ?? quest.status;
    let matchesView = false;

    if (scope === 'all') {
      matchesView = true;
    } else if (viewId === 'new') {
      matchesView = Boolean(quest.isNew);
    } else if (viewId === 'low') {
      matchesView = isLowPriorityQuest(quest);
    } else if (viewId === 'open') {
      matchesView = isOpenViewQuest(quest);
    } else if (viewId === 'more') {
      matchesView = isMoreQuest(quest);
    } else {
      matchesView = currentView.statuses.includes(normalizedStatus);
    }

    if (!matchesView || !matchesQuestSearch(quest, search)) {
      return false;
    }
    return true;
  });
}

export function sortQuests(
  quests: Quest[],
  sortColumn: QuestPanelColumnKey | null,
  sortDirection: 'asc' | 'desc'
): Quest[] {
  if (!sortColumn) {
    return quests;
  }

  return [...quests].sort((left, right) => {
    const leftValue = String(left[sortColumn as keyof Quest] ?? '');
    const rightValue = String(right[sortColumn as keyof Quest] ?? '');

    return sortDirection === 'asc'
      ? leftValue.localeCompare(rightValue)
      : rightValue.localeCompare(leftValue);
  });
}

export function sortQuestsByOption(
  quests: Quest[],
  sortId: QuestSortOptionId,
  sortDirection: 'asc' | 'desc'
): Quest[] {
  if (sortId === 'manual') {
    return quests;
  }

  const option = QUEST_SORT_OPTIONS.find((entry) => entry.id === sortId);
  if (!option) {
    return quests;
  }

  return [...quests].sort((left, right) => {
    const leftValue = option.getValue(left);
    const rightValue = option.getValue(right);

    if (typeof leftValue === 'number' && typeof rightValue === 'number') {
      return sortDirection === 'asc' ? leftValue - rightValue : rightValue - leftValue;
    }

    return sortDirection === 'asc'
      ? String(leftValue).localeCompare(String(rightValue))
      : String(rightValue).localeCompare(String(leftValue));
  });
}

export function reorderQuestList(quests: Quest[], activeQuestId: string, overQuestId: string): Quest[] {
  const currentIndex = quests.findIndex((quest) => quest.id === activeQuestId);
  const nextIndex = quests.findIndex((quest) => quest.id === overQuestId);

  if (currentIndex === -1 || nextIndex === -1 || currentIndex === nextIndex) {
    return quests;
  }

  const reordered = [...quests];
  const [moved] = reordered.splice(currentIndex, 1);
  reordered.splice(nextIndex, 0, moved);
  return reordered;
}

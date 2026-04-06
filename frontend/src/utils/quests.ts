import type { Quest, QuestStatus } from '../types/domain';
import { ALL_QUEST_COLUMNS, type QuestPanelColumnKey } from '../config/questTableColumns';

interface QuestView {
  id: 'open' | 'done' | 'stopped' | 'more';
  label: string;
  icon: string;
  statuses: readonly string[];
}

export const QUEST_VIEWS: readonly QuestView[] = [
  { id: 'open', label: 'פתוחות', icon: '📋', statuses: ['Open', 'Taken', 'In Progress'] },
  { id: 'done', label: 'הסתיימו', icon: '✅', statuses: ['Done', 'Approved'] },
  { id: 'stopped', label: 'הופסקו', icon: '⏸', statuses: ['Stopped', 'Cancelled'] },
  { id: 'more', label: 'נוספות', icon: '⋯', statuses: ['New', 'ממתין', 'תעדוף נמוך'] },
] as const;

export type QuestViewId = (typeof QUEST_VIEWS)[number]['id'];
export type QuestSearchScope = 'current' | 'all';

export const STATUS_LABELS: Record<string, string> = {
  New: 'חדש',
  Open: 'פתוח',
  Taken: 'נלקח',
  'In Progress': 'בביצוע',
  Done: 'הושלם',
  Approved: 'מאושר',
  Stopped: 'הופסק',
  Cancelled: 'בוטל',
  ממתין: 'ממתין',
};

export function isLowPriorityQuest(quest: Quest): boolean {
  const priority = String(quest.priority ?? '').trim().toLowerCase();
  return priority === 'נמוך' || priority === 'low' || priority === 'low priority';
}

export function isMoreQuest(quest: Quest): boolean {
  return Boolean(quest.isNew) || quest.status === 'ממתין' || isLowPriorityQuest(quest);
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
  return STATUS_LABELS[status] ?? status;
}

export function getQuestDisplayStatus(quest: Quest): QuestStatus | string {
  return quest.isNew ? 'New' : quest.status;
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
    const matchesView = scope === 'all'
      ? true
      : viewId === 'more'
        ? isMoreQuest(quest)
        : !isMoreQuest(quest) && currentView.statuses.includes(quest.status);

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

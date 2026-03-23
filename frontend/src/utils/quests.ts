import type { Quest, QuestStatus } from '../types/domain';

interface QuestView {
  id: 'open' | 'done' | 'stopped';
  label: string;
  icon: string;
  statuses: readonly string[];
}

export const QUEST_VIEWS: readonly QuestView[] = [
  { id: 'open', label: 'פתוחות', icon: '📋', statuses: ['Open', 'Taken', 'In Progress'] },
  { id: 'done', label: 'הסתיימו', icon: '✅', statuses: ['Done', 'Approved'] },
  { id: 'stopped', label: 'הופסקו', icon: '⏸', statuses: ['Stopped', 'Cancelled'] },
] as const;

export type QuestViewId = (typeof QUEST_VIEWS)[number]['id'];

export const STATUS_LABELS: Record<string, string> = {
  Open: 'פתוח',
  Taken: 'נלקח',
  'In Progress': 'בביצוע',
  Done: 'הושלם',
  Approved: 'מאושר',
  Stopped: 'הופסק',
  Cancelled: 'בוטל',
};

export const ALL_QUEST_COLUMNS = ['#', 'כותרת', 'FT', 'סטטוס', 'תאריך', 'משתמש', 'תיאור', 'שנה'] as const;

const SORT_KEY_BY_COLUMN: Record<(typeof ALL_QUEST_COLUMNS)[number], keyof Quest | 'id'> = {
  '#': 'id',
  'כותרת': 'title',
  FT: 'ft',
  'סטטוס': 'status',
  'תאריך': 'date',
  'משתמש': 'assigned_user',
  'תיאור': 'description',
  'שנה': 'year',
};

export function getQuestView(viewId: QuestViewId) {
  return QUEST_VIEWS.find((view) => view.id === viewId) ?? QUEST_VIEWS[0];
}

export function getQuestStatusLabel(status: QuestStatus | string): string {
  return STATUS_LABELS[status] ?? status;
}

export function filterQuests(quests: Quest[], viewId: QuestViewId, search: string): Quest[] {
  const currentView = getQuestView(viewId);
  const normalizedSearch = search.trim();

  return quests.filter((quest) => {
    const matchesView = currentView.statuses.includes(quest.status);
    if (!matchesView) {
      return false;
    }

    if (!normalizedSearch) {
      return true;
    }

    return [quest.title, quest.description, quest.ft]
      .filter(Boolean)
      .some((value) => String(value).includes(normalizedSearch));
  });
}

export function sortQuests(
  quests: Quest[],
  sortColumn: (typeof ALL_QUEST_COLUMNS)[number] | null,
  sortDirection: 'asc' | 'desc'
): Quest[] {
  if (!sortColumn) {
    return quests;
  }

  const key = SORT_KEY_BY_COLUMN[sortColumn];

  return [...quests].sort((left, right) => {
    const leftValue = String(left[key] ?? '');
    const rightValue = String(right[key] ?? '');

    return sortDirection === 'asc'
      ? leftValue.localeCompare(rightValue)
      : rightValue.localeCompare(leftValue);
  });
}

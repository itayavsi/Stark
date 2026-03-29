const QUEST_SORT_KEY = 'quest-sort-order';

type QuestSortState = Record<string, string[]>;

function readQuestSortState(): QuestSortState {
  try {
    const raw = window.localStorage.getItem(QUEST_SORT_KEY);
    if (!raw) {
      return {};
    }

    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed as QuestSortState : {};
  } catch {
    return {};
  }
}

function writeQuestSortState(state: QuestSortState) {
  window.localStorage.setItem(QUEST_SORT_KEY, JSON.stringify(state));
}

function buildSortKey(group: string, view: string) {
  return `${group}:${view}`;
}

export function getStoredQuestSortOrder(group: string, view: string): string[] {
  const state = readQuestSortState();
  return state[buildSortKey(group, view)] || [];
}

export function saveStoredQuestSortOrder(group: string, view: string, questIds: string[]): string[] {
  const state = readQuestSortState();
  state[buildSortKey(group, view)] = [...questIds];
  writeQuestSortState(state);
  return state[buildSortKey(group, view)];
}

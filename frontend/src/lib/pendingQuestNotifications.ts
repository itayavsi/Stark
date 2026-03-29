const PENDING_QUEST_IDS_KEY = 'pending-created-quest-ids';

function readPendingQuestIds(): string[] {
  try {
    const raw = window.localStorage.getItem(PENDING_QUEST_IDS_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === 'string') : [];
  } catch {
    return [];
  }
}

function writePendingQuestIds(questIds: string[]) {
  window.localStorage.setItem(PENDING_QUEST_IDS_KEY, JSON.stringify(questIds));
}

export function addPendingQuestNotificationId(questId: string) {
  const nextIds = new Set(readPendingQuestIds());
  nextIds.add(questId);
  writePendingQuestIds([...nextIds]);
}

export function getPendingQuestNotificationIds(): string[] {
  return readPendingQuestIds();
}

export function removePendingQuestNotificationIds(questIds: string[]) {
  if (questIds.length === 0) {
    return;
  }

  const removeSet = new Set(questIds);
  const nextIds = readPendingQuestIds().filter((questId) => !removeSet.has(questId));
  writePendingQuestIds(nextIds);
}

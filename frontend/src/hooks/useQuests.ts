import { useCallback, useEffect, useRef, useState } from 'react';

import {
  getPendingQuestNotificationIds,
  removePendingQuestNotificationIds,
} from '../lib/pendingQuestNotifications';
import { getQuests } from '../services/api';
import type { Quest } from '../types/domain';
import { isStartStatus } from '../utils/quests';

export function useQuests() {
  const [quests, setQuests] = useState<Quest[]>([]);
  const [loading, setLoading] = useState(true);
  const [latestNewQuests, setLatestNewQuests] = useState<Quest[]>([]);
  const knownQuestIdsRef = useRef<Set<string>>(new Set());
  const newQuestIdsRef = useRef<Set<string>>(new Set());
  const hasLoadedRef = useRef(false);

  const refresh = useCallback(async () => {
    try {
      const nextQuests = await getQuests();
      const nextQuestIds = new Set(nextQuests.map((quest) => quest.id));
      const pendingQuestNotificationIds = new Set(getPendingQuestNotificationIds());
      const pendingNotificationQuests = nextQuests.filter((quest) => pendingQuestNotificationIds.has(quest.id));
      const detectedNewQuests = hasLoadedRef.current
        ? nextQuests.filter((quest) => !knownQuestIdsRef.current.has(quest.id))
        : [];
      const latestNewQuestMap = new Map(
        [...pendingNotificationQuests, ...detectedNewQuests].map((quest) => [quest.id, quest])
      );

      const persistentNewIds = [...newQuestIdsRef.current].filter((questId) => {
        const quest = nextQuests.find((entry) => entry.id === questId);
        return Boolean(quest && isStartStatus(quest.status));
      });
      const mergedNewIds = new Set([...persistentNewIds, ...latestNewQuestMap.keys()]);

      newQuestIdsRef.current = mergedNewIds;
      knownQuestIdsRef.current = nextQuestIds;
      hasLoadedRef.current = true;
      setLatestNewQuests([...latestNewQuestMap.values()]);
      removePendingQuestNotificationIds(pendingNotificationQuests.map((quest) => quest.id));
      setQuests(nextQuests.map((quest) => (
        mergedNewIds.has(quest.id)
          ? { ...quest, isNew: true }
          : { ...quest, isNew: false }
      )));
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();

    const intervalId = window.setInterval(() => {
      void refresh();
    }, 60_000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [refresh]);

  return {
    quests,
    loading,
    latestNewQuests,
    refresh,
    setQuests,
  };
}

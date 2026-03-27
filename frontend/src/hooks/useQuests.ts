import { useCallback, useEffect, useRef, useState } from 'react';

import { getQuests } from '../services/api';
import type { Quest } from '../types/domain';

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
      const detectedNewQuests = hasLoadedRef.current
        ? nextQuests.filter((quest) => !knownQuestIdsRef.current.has(quest.id))
        : [];

      const persistentNewIds = [...newQuestIdsRef.current].filter((questId) => {
        const quest = nextQuests.find((entry) => entry.id === questId);
        return Boolean(quest && (quest.status === 'Open' || quest.status === 'ממתין'));
      });
      const mergedNewIds = new Set([...persistentNewIds, ...detectedNewQuests.map((quest) => quest.id)]);

      newQuestIdsRef.current = mergedNewIds;
      knownQuestIdsRef.current = nextQuestIds;
      hasLoadedRef.current = true;
      setLatestNewQuests(detectedNewQuests);
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

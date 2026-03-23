import { useCallback, useEffect, useState } from 'react';

import { getQuests } from '../services/api';
import type { Quest } from '../types/domain';

export function useQuests() {
  const [quests, setQuests] = useState<Quest[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const nextQuests = await getQuests();
      setQuests(nextQuests);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return {
    quests,
    loading,
    refresh,
    setQuests,
  };
}

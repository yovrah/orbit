import { useCallback, useEffect, useState } from 'react';
import { db } from '../../db/clientDb';
import type { PinnedApp } from '../../types';

const STORAGE_KEY = 'pinned_apps';

/** User-curated Dashboard app shortcuts, persisted in IndexedDB. */
export function usePinnedApps() {
  const [pins, setPins] = useState<PinnedApp[]>([]);

  useEffect(() => {
    db.settings.get(STORAGE_KEY).then((row) => {
      if (!row?.value) return;
      try {
        const parsed = JSON.parse(row.value);
        if (Array.isArray(parsed)) setPins(parsed);
      } catch {
        /* ignore corrupt value */
      }
    });
  }, []);

  const save = useCallback(async (next: PinnedApp[]) => {
    setPins(next);
    await db.settings.put({ key: STORAGE_KEY, value: JSON.stringify(next) });
  }, []);

  const addPin = useCallback(
    (app: PinnedApp) => {
      setPins((current) => {
        if (current.some((p) => p.path === app.path)) return current;
        const next = [...current, app];
        db.settings.put({ key: STORAGE_KEY, value: JSON.stringify(next) });
        return next;
      });
    },
    []
  );

  const removePin = useCallback((path: string) => {
    setPins((current) => {
      const next = current.filter((p) => p.path !== path);
      db.settings.put({ key: STORAGE_KEY, value: JSON.stringify(next) });
      return next;
    });
  }, []);

  return { pins, addPin, removePin, save };
}

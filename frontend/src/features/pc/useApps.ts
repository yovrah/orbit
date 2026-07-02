import { useCallback, useEffect, useState } from 'react';
import { useOrbit } from '../../state/OrbitContext';
import type { AppEntry, ProcessEntry } from '../../types';

const POLL_MS = 5000;

/** Installed-app launcher list + running windows. Polls while mounted. */
export function useApps() {
  const { activeDevice, request } = useOrbit();
  const [apps, setApps] = useState<AppEntry[]>([]);
  const [processes, setProcesses] = useState<ProcessEntry[]>([]);
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(Boolean(activeDevice));

  const refresh = useCallback(async () => {
    if (!activeDevice) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const [appsRes, procRes] = await Promise.all([
        request('/api/v1/apps'),
        request('/api/v1/system/processes'),
      ]);
      if (appsRes.ok) setApps((await appsRes.json()).apps || []);
      if (procRes.ok) setProcesses((await procRes.json()).processes || []);
    } catch (err) {
      console.error('Unable to load apps:', err);
    } finally {
      setIsLoading(false);
    }
  }, [activeDevice, request]);

  useEffect(() => {
    if (!activeDevice) {
      setIsLoading(false);
      return;
    }
    refresh();
    const timer = window.setInterval(refresh, POLL_MS);
    return () => window.clearInterval(timer);
  }, [activeDevice, refresh]);

  const launch = useCallback(
    async (path: string) => {
      if (!activeDevice || !path) return;
      try {
        await request('/api/v1/apps/launch', {
          method: 'POST',
          body: JSON.stringify({ path }),
        });
      } catch (err) {
        console.error('Unable to launch app:', err);
      }
    },
    [activeDevice, request]
  );

  const filtered = apps.filter((a) => a.name.toLowerCase().includes(query.trim().toLowerCase()));

  return { apps, filtered, processes, query, setQuery, launch, refresh, isLoading };
}

import { useCallback, useEffect, useState } from 'react';
import { useOrbit } from '../../state/OrbitContext';
import type { SystemStats } from '../../types';

const POLL_MS = 5000;

/** Live CPU/RAM/disk/uptime/battery stats. Polls while mounted. */
export function useSystemStats() {
  const { activeDevice, request } = useOrbit();
  const [stats, setStats] = useState<SystemStats | null>(null);

  const refresh = useCallback(async () => {
    if (!activeDevice) return;
    try {
      const res = await request('/api/v1/system/stats');
      if (res.ok) setStats(await res.json());
    } catch (err) {
      console.error('Unable to load system stats:', err);
    }
  }, [activeDevice, request]);

  useEffect(() => {
    if (!activeDevice) return;
    refresh();
    const timer = window.setInterval(refresh, POLL_MS);
    return () => window.clearInterval(timer);
  }, [activeDevice, refresh]);

  return { stats, refresh };
}

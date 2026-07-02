import { useEffect, useRef, useState } from 'react';
import type { Device } from '../db/clientDb';

const PING_INTERVAL_MS = 4000;

/** Measures real round-trip latency to the agent's lightweight /ping endpoint. */
export function usePing(
  activeDevice: Device | null,
  isReady: boolean,
  request: (endpoint: string, init?: RequestInit) => Promise<Response>
): number | null {
  const [ms, setMs] = useState<number | null>(null);
  const requestRef = useRef(request);
  requestRef.current = request;

  useEffect(() => {
    setMs(null);
    if (!activeDevice || !isReady) return;

    let cancelled = false;
    const measure = async () => {
      const start = performance.now();
      try {
        const res = await requestRef.current('/api/v1/ping');
        if (!cancelled && res.ok) setMs(Math.round(performance.now() - start));
      } catch {
        if (!cancelled) setMs(null);
      }
    };

    measure();
    const timer = window.setInterval(measure, PING_INTERVAL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [activeDevice?.uuid, isReady]);

  return ms;
}

import { useEffect, useRef, useState } from 'react';
import { useOrbit } from '../../state/OrbitContext';

const cache = new Map<string, string>();

/** Fetches an app's real icon from the agent (auth required, so it can't be a
 * plain <img src>) and caches the resulting object URL per device+path. */
export function useAppIcon(path: string): string | null {
  const { activeDevice, isReady, request } = useOrbit();
  const requestRef = useRef(request);
  requestRef.current = request;

  const cacheKey = activeDevice ? `${activeDevice.uuid}:${path}` : null;
  const [url, setUrl] = useState<string | null>(() => (cacheKey ? cache.get(cacheKey) ?? null : null));

  useEffect(() => {
    if (!cacheKey || !isReady || !path) return;
    const cached = cache.get(cacheKey);
    if (cached) {
      setUrl(cached);
      return;
    }

    let cancelled = false;
    requestRef.current(`/api/v1/apps/icon?path=${encodeURIComponent(path)}`)
      .then((res) => (res.ok ? res.blob() : null))
      .then((blob) => {
        if (cancelled || !blob) return;
        const objectUrl = URL.createObjectURL(blob);
        cache.set(cacheKey, objectUrl);
        setUrl(objectUrl);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [cacheKey, isReady, path]);

  return url;
}

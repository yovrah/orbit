import { useEffect, useRef, useState } from 'react';
import { buildWsUrl } from '../api/client';
import { useOrbit } from '../state/OrbitContext';

/** Low-fps, low-quality live screen preview shared by the Home hero card and
 * the Live Screen widget — connects only while mounted and ready. */
export function useScreenPreview(quality = 35, fps = 4, monitor = 1): string | null {
  const { activeDevice, isReady } = useOrbit();
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!activeDevice || !isReady) {
      setImageUrl(null);
      return;
    }
    const ws = new WebSocket(buildWsUrl(activeDevice, '/ws/screen/stream'));
    wsRef.current = ws;
    ws.binaryType = 'blob';
    ws.onopen = () => ws.send(JSON.stringify({ event: 'config', quality, fps, monitor }));
    ws.onmessage = (event) => {
      if (!(event.data instanceof Blob)) return;
      const url = URL.createObjectURL(event.data);
      setImageUrl((old) => {
        if (old) URL.revokeObjectURL(old);
        return url;
      });
    };

    return () => {
      ws.close();
      wsRef.current = null;
      setImageUrl((old) => {
        if (old) URL.revokeObjectURL(old);
        return null;
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeDevice?.uuid, isReady, quality, fps, monitor]);

  return imageUrl;
}

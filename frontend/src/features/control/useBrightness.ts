import { useEffect, useState } from 'react';
import { useOrbit } from '../../state/OrbitContext';

const DEBOUNCE_MS = 500;

/** Screen brightness with a debounced write to the agent. */
export function useBrightness(initial = 80) {
  const { activeDevice, request } = useOrbit();
  const [brightness, setBrightness] = useState(initial);

  useEffect(() => {
    if (!activeDevice) return;
    const timer = setTimeout(() => {
      request('/api/v1/system/brightness', {
        method: 'POST',
        body: JSON.stringify({ level: brightness }),
      }).catch(console.error);
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [brightness, activeDevice, request]);

  return { brightness, setBrightness };
}

import { useEffect, useRef, useState } from 'react';
import { useOrbit } from '../../state/OrbitContext';

const DEBOUNCE_MS = 500;

/** Screen brightness with a debounced write to the agent. Windows has no
 * reliable cross-monitor brightness *read*, so the slider starts at a neutral
 * default and only ever writes to the PC after the user actually moves it —
 * opening the app must never silently change the screen brightness. */
export function useBrightness(initial = 80) {
  const { activeDevice, request } = useOrbit();
  const [brightness, setBrightnessState] = useState(initial);
  const touched = useRef(false);

  const setBrightness = (level: number) => {
    touched.current = true;
    setBrightnessState(level);
  };

  useEffect(() => {
    if (!activeDevice || !touched.current) return;
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

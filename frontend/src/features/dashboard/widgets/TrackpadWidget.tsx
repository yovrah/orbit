import { useState } from 'react';
import { Mouse } from 'lucide-react';
import { useOrbit } from '../../../state/OrbitContext';
import { useTouchpad } from '../../../hooks/useTouchpad';

/** A mini touchpad right on the Home screen — same gestures as the Mouse tab
 * (move, tap to click, two-finger scroll), scaled down to a widget. */
export function TrackpadWidget() {
  const { sendEvent, isReady, settings } = useOrbit();
  const [surface, setSurface] = useState<HTMLDivElement | null>(null);

  useTouchpad({
    element: surface,
    sendEvent,
    enabled: isReady,
    sensitivity: settings.sensitivity,
    scrollSensitivity: settings.scrollSensitivity,
  });

  return (
    <div ref={setSurface} className={`w-trackpad ${isReady ? '' : 'disabled'}`}>
      <div className="w-trackpad-hint">
        <Mouse size={20} />
        <span>{isReady ? 'Move · tap · scroll' : 'Offline'}</span>
      </div>
    </div>
  );
}

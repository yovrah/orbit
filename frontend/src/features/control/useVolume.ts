import { useEffect, useState } from 'react';
import { useOrbit } from '../../state/OrbitContext';

/** System volume + mute, seeded from the PC's real current state so the
 * slider never lies, with live updates pushed over the control socket. */
export function useVolume() {
  const { activeDevice, isReady, request, sendEvent } = useOrbit();
  const [volume, setVolumeState] = useState(50);
  const [muted, setMuted] = useState(false);

  useEffect(() => {
    if (!activeDevice || !isReady) return;
    let cancelled = false;
    request('/api/v1/system/volume')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled || !data) return;
        setVolumeState(data.level);
        setMuted(data.muted);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeDevice?.uuid, isReady]);

  const setVolume = (level: number) => {
    setVolumeState(level);
    if (muted && level > 0) setMuted(false);
    sendEvent({ event: 'volume_set', level });
  };

  const toggleMute = async () => {
    if (!activeDevice) return;
    try {
      const res = await request('/api/v1/system/volume/mute', { method: 'POST' });
      if (res.ok) setMuted((await res.json()).is_muted);
    } catch (err) {
      console.error('Failed to toggle mute:', err);
    }
  };

  return { volume, muted, setVolume, toggleMute };
}

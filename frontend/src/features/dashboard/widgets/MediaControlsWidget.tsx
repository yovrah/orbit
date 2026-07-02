import { useState } from 'react';
import { SkipBack, SkipForward, Play, Pause, Volume2, VolumeX } from 'lucide-react';
import { useOrbit } from '../../../state/OrbitContext';

/** Media transport for whatever is playing on the PC. Play/pause and mute are
 * best-effort toggles (the agent exposes the media/volume keys, not the real
 * playback state), so the icon reflects the last tap. */
export function MediaControlsWidget() {
  const { sendEvent, postSystemAction } = useOrbit();
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);

  const media = (key: string) => sendEvent({ event: 'keyboard_input', key, type: 'press' });

  const togglePlay = () => {
    media('media_play_pause');
    setPlaying((p) => !p);
  };

  const toggleMute = () => {
    postSystemAction('/api/v1/system/volume/mute');
    setMuted((m) => !m);
  };

  return (
    <div className="w-flex-col">
      <span className="w-title">Media</span>
      <div className="w-media-row">
        <button type="button" onClick={toggleMute} aria-label={muted ? 'Unmute' : 'Mute'}>
          {muted ? <VolumeX size={17} className="text-[#ff3b30]" /> : <Volume2 size={17} />}
        </button>
        <button type="button" onClick={() => media('media_previous')} aria-label="Previous">
          <SkipBack size={18} fill="currentColor" />
        </button>
        <button type="button" className="primary" onClick={togglePlay} aria-label={playing ? 'Pause' : 'Play'}>
          {playing ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" />}
        </button>
        <button type="button" onClick={() => media('media_next')} aria-label="Next">
          <SkipForward size={18} fill="currentColor" />
        </button>
      </div>
    </div>
  );
}

import { Play, RotateCcw, ChevronRight } from 'lucide-react';
import { useOrbit } from '../../../state/OrbitContext';

export function MediaControlsWidget() {
  const { sendEvent } = useOrbit();
  const media = (key: string) => sendEvent({ event: 'keyboard_input', key, type: 'press' });

  return (
    <div className="w-flex-col">
      <span className="w-title">Media</span>
      <div className="w-media-row">
        <button type="button" onClick={() => media('media_previous')} aria-label="Previous">
          <RotateCcw size={18} />
        </button>
        <button type="button" className="primary" onClick={() => media('media_play_pause')} aria-label="Play or pause">
          <Play size={20} fill="currentColor" />
        </button>
        <button type="button" onClick={() => media('media_next')} aria-label="Next">
          <ChevronRight size={20} />
        </button>
      </div>
    </div>
  );
}

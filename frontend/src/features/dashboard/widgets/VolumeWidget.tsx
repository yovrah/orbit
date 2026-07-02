import { Volume2, VolumeX } from 'lucide-react';
import { VerticalSlider } from '../../../components/VerticalSlider';
import { useVolume } from '../../control/useVolume';

export function VolumeWidget() {
  const { volume, muted, setVolume, toggleMute } = useVolume();

  return (
    <div className="w-vslider-wrap">
      <div className="w-vslider-head">
        <button type="button" className="w-mini-ico" onClick={toggleMute} aria-label={muted ? 'Unmute' : 'Mute'}>
          {muted ? <VolumeX size={14} className="text-[#ff3b30]" /> : <Volume2 size={14} />}
        </button>
        <span className="w-mini-val">{muted ? 'Muted' : `${volume}%`}</span>
      </div>
      <VerticalSlider
        value={muted ? 0 : volume}
        onChange={setVolume}
        icon={<Volume2 size={14} />}
        aria-label="Volume"
      />
    </div>
  );
}

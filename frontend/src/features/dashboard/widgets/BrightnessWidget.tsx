import { Sun } from 'lucide-react';
import { VerticalSlider } from '../../../components/VerticalSlider';
import { useBrightness } from '../../control/useBrightness';

export function BrightnessWidget() {
  const { brightness, setBrightness } = useBrightness();

  return (
    <div className="w-vslider-wrap">
      <div className="w-vslider-head">
        <span className="w-mini-ico static">
          <Sun size={14} />
        </span>
        <span className="w-mini-val">{brightness}%</span>
      </div>
      <VerticalSlider value={brightness} onChange={setBrightness} icon={<Sun size={14} />} aria-label="Brightness" />
    </div>
  );
}

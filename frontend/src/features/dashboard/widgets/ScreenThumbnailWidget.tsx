import { MonitorPlay } from 'lucide-react';
import { useOrbit } from '../../../state/OrbitContext';
import { useScreenPreview } from '../../../hooks/useScreenPreview';

interface ScreenThumbnailWidgetProps {
  onNavigate: () => void;
}

/** Low-fps, low-quality live preview — just enough to glance at, tap to open full Stream. */
export function ScreenThumbnailWidget({ onNavigate }: ScreenThumbnailWidgetProps) {
  const { isReady } = useOrbit();
  const imageUrl = useScreenPreview(35, 4);

  return (
    <button type="button" className="w-thumb" onClick={onNavigate}>
      {imageUrl ? (
        <img src={imageUrl} alt="Live PC screen" />
      ) : (
        <div className="w-thumb-empty">
          <MonitorPlay size={22} />
          <span>{isReady ? 'Connecting…' : 'No PC'}</span>
        </div>
      )}
      <span className="w-thumb-tag">Live Screen</span>
    </button>
  );
}

import { useRef, useState, type ReactNode } from 'react';

interface VerticalSliderProps {
  value: number;
  onChange: (value: number) => void;
  icon: ReactNode;
  disabled?: boolean;
  'aria-label': string;
}

/** iOS Control Center-style vertical pill slider — drag anywhere on the track
 * (not just a thin thumb) to set the value; fill grows from the bottom. */
export function VerticalSlider({ value, onChange, icon, disabled, 'aria-label': ariaLabel }: VerticalSliderProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);

  const valueFromPointer = (clientY: number) => {
    const track = trackRef.current;
    if (!track) return value;
    const rect = track.getBoundingClientRect();
    const ratio = 1 - (clientY - rect.top) / rect.height;
    return Math.round(Math.max(0, Math.min(1, ratio)) * 100);
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (disabled) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragging(true);
    onChange(valueFromPointer(e.clientY));
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging) return;
    onChange(valueFromPointer(e.clientY));
  };

  const stopDrag = () => setDragging(false);

  return (
    <div
      ref={trackRef}
      className={`v-slider ${dragging ? 'dragging' : ''} ${disabled ? 'disabled' : ''}`}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={stopDrag}
      onPointerCancel={stopDrag}
      role="slider"
      aria-label={ariaLabel}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={value}
    >
      <div className="v-slider-fill" style={{ height: `${value}%` }} />
      <span className="v-slider-icon">{icon}</span>
    </div>
  );
}

import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { useOrbit } from '../state/OrbitContext';

interface ScreenHeaderProps {
  icon: LucideIcon;
  title: string;
  /** Overrides the default connection status line. */
  subtitle?: ReactNode;
  /** Right-aligned action (e.g. a circular button). */
  action?: ReactNode;
}

/**
 * The header that opens every primary screen: an icon chip, the screen title,
 * a live status line, and an optional trailing action — mirroring the reference
 * mockup where each tab carries its own contextual header.
 */
export function ScreenHeader({ icon: Icon, title, subtitle, action }: ScreenHeaderProps) {
  const { connection } = useOrbit();

  return (
    <header className="scr-head">
      <div className="h-chip">
        <Icon size={22} />
      </div>
      <div className="h-text">
        <h1>{title}</h1>
        <div className="h-sub">
          {subtitle ?? (
            <>
              <span className={`dot ${connection.tone}`} />
              {connection.label}
            </>
          )}
        </div>
      </div>
      {action ?? <span aria-hidden />}
    </header>
  );
}

import { X } from 'lucide-react';
import { useAppIcon } from './useAppIcon';
import type { PinnedApp } from '../../types';

interface PinTileProps {
  app: PinnedApp;
  editing: boolean;
  onClick: () => void;
}

/** A single Dashboard app shortcut — shows the app's real icon once fetched,
 * falling back to an initial-letter avatar while it loads or if extraction fails. */
export function PinTile({ app, editing, onClick }: PinTileProps) {
  const iconUrl = useAppIcon(app.path);

  return (
    <button type="button" className="pin" onClick={onClick}>
      <span className={`pin-ico ${iconUrl && !editing ? 'has-icon' : ''}`}>
        {editing ? (
          <X size={20} />
        ) : iconUrl ? (
          <img src={iconUrl} alt="" className="pin-img" />
        ) : (
          app.name.charAt(0).toUpperCase()
        )}
      </span>
      <small>{app.name}</small>
    </button>
  );
}

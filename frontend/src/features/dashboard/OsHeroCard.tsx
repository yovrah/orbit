import { ChevronRight, Monitor, Plus, X } from 'lucide-react';
import { useOrbit } from '../../state/OrbitContext';
import { useSystemStats } from '../pc/useSystemStats';
import { useScreenPreview } from '../../hooks/useScreenPreview';

interface OsHeroCardProps {
  editing: boolean;
  visible: boolean;
  onRemove: () => void;
  onRestore: () => void;
  onNavigate: () => void;
}

/** The "My PC" status row at the top of Home — a live screen preview thumbnail
 * plus OS/host info, tap-through to Stream. Removable like a widget; shows a
 * ghost tile in its place once removed so it's easy to bring back. */
export function OsHeroCard({ editing, visible, onRemove, onRestore, onNavigate }: OsHeroCardProps) {
  const { connection, activeDevice } = useOrbit();
  const { stats } = useSystemStats();
  const imageUrl = useScreenPreview(30, 3);

  if (!visible) {
    if (!editing) return null;
    return (
      <button type="button" className="widget-add-tile" onClick={onRestore}>
        <Plus size={20} />
        <span>Add PC Status</span>
      </button>
    );
  }

  const isOnline = connection.tone === 'ok';
  const osName = stats?.os_name || 'Windows';
  const hostname = stats?.hostname || activeDevice?.name || 'Desktop PC';

  return (
    <div className={`os-hero-wrap ${editing ? 'editing' : ''}`}>
      <button
        type="button"
        className="os-hero"
        onClick={() => !editing && isOnline && onNavigate()}
        disabled={editing}
      >
        <div className="os-hero-preview">
          {imageUrl ? (
            <img src={imageUrl} alt="Live PC screen" />
          ) : (
            <Monitor size={24} className="os-hero-ico" />
          )}
          <span className={`os-hero-dot ${isOnline ? 'ok' : ''}`} />
        </div>
        <div className="os-hero-info">
          <strong>{osName}</strong>
          <span>{isOnline ? hostname : 'Not connected'}</span>
        </div>
        {isOnline && <ChevronRight size={18} className="os-hero-chevron" />}
      </button>

      {editing && (
        <button type="button" className="widget-remove" onClick={onRemove} aria-label="Remove PC status card">
          <X size={12} strokeWidth={3} />
        </button>
      )}
    </div>
  );
}

import { Plug, QrCode } from 'lucide-react';
import { useOrbit } from '../state/OrbitContext';

/**
 * Prominent connect prompt shown at the top of every screen while no PC is
 * online — the single, obvious path back to pairing from anywhere in the app.
 */
export function ConnectBanner() {
  const { connection, openPairing } = useOrbit();
  if (connection.tone === 'ok') return null;

  const connecting = connection.tone === 'warn';

  return (
    <div className="connect-banner" role="status">
      <div className="cb-ico">{connecting ? <Plug size={20} /> : <QrCode size={20} />}</div>
      <div className="cb-text">
        <strong>{connecting ? 'Connecting…' : 'No PC connected'}</strong>
        <span>{connecting ? connection.label : 'Scan the QR on your PC to start'}</span>
      </div>
      <button type="button" onClick={openPairing}>
        {connecting ? 'Retry' : 'Connect'}
      </button>
    </div>
  );
}

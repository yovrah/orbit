import { Lock, Moon, RotateCcw, Power, LogOut, Camera } from 'lucide-react';
import { useOrbit } from '../../../state/OrbitContext';

export function QuickActionsWidget() {
  const { sendEvent, postSystemAction } = useOrbit();

  const confirmShutdown = () => confirm('Shut down the PC?') && postSystemAction('/api/v1/system/shutdown');

  const actions = [
    { label: 'Lock', icon: Lock, run: () => sendEvent({ event: 'key_combo', keys: ['Win', 'L'] }) },
    { label: 'Sleep', icon: Moon, run: () => postSystemAction('/api/v1/system/sleep') },
    {
      label: 'Restart',
      icon: RotateCcw,
      run: () => confirm('Restart the PC?') && postSystemAction('/api/v1/system/restart'),
    },
    { label: 'Shut Down', icon: Power, tone: 'red', run: confirmShutdown },
    {
      label: 'Log Off',
      icon: LogOut,
      run: () => confirm('Log off the current user?') && postSystemAction('/api/v1/system/logoff'),
    },
    { label: 'Screenshot', icon: Camera, run: () => postSystemAction('/api/v1/system/screenshot') },
  ];

  return (
    <div className="w-flex-col">
      <span className="w-title">Quick Actions</span>
      <div className="w-qa-grid">
        {actions.map(({ label, icon: Icon, run, tone }) => (
          <button key={label} type="button" className={`w-qa-btn ${tone === 'red' ? 'red' : ''}`} onClick={run}>
            <Icon size={17} />
            <span>{label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

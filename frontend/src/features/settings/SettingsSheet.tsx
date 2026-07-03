import { motion } from 'framer-motion';
import {
  X,
  Moon,
  Sun,
  Plus,
  Smartphone,
  SignalHigh,
  Mouse,
  Wand2,
  TerminalSquare,
  Clipboard,
  Send,
  ChevronRight,
  Info,
  Coffee,
} from 'lucide-react';
import { db } from '../../db/clientDb';
import { useOrbit } from '../../state/OrbitContext';
import type { Device } from '../../types';
import type { ToolId } from './ToolSheets';

interface SettingsSheetProps {
  onClose: () => void;
  onOpenPairing: () => void;
  onOpenTool: (tool: ToolId) => void;
}

async function clearPWACache() {
  try {
    const registrations = (await navigator.serviceWorker?.getRegistrations()) || [];
    await Promise.all(registrations.map((r) => r.unregister()));
    const keys = await caches.keys();
    await Promise.all(keys.map((k) => caches.delete(k)));
    alert('PWA cache cleared. Reloading.');
    window.location.reload();
  } catch (err) {
    console.error('Failed to clear cache:', err);
    alert('Failed to clear cache.');
  }
}

export function SettingsSheet({ onClose, onOpenPairing, onOpenTool }: SettingsSheetProps) {
  const {
    activeDevice,
    devices,
    isConnected,
    isAuthorized,
    connection,
    settings,
    toggleTheme,
    setSensitivity,
    setScrollSensitivity,
    setActiveDeviceUuid,
    request,
  } = useOrbit();
  const { theme, sensitivity, scrollSensitivity } = settings;

  const isOnline = (d: Device) => d.uuid === activeDevice?.uuid && isConnected && isAuthorized;

  const handleSwitch = async (device: Device) => {
    if (!device.id) return;
    await db.devices.update(device.id, { lastConnected: new Date() });
    setActiveDeviceUuid(device.uuid);
  };

  const handleRename = async (device: Device) => {
    if (!device.id) return;
    const name = prompt('Enter new device name:', device.name);
    if (name && name.trim()) await db.devices.update(device.id, { name: name.trim() });
  };

  const handleDelete = async (device: Device) => {
    if (!device.id) return;
    if (confirm(`Remove pairing for "${device.name}"?`)) {
      await db.devices.delete(device.id);
      if (activeDevice?.id === device.id) window.location.reload();
    }
  };

  const handleEditMac = async (device: Device) => {
    if (!device.id) return;
    const mac = prompt('Enter MAC address (XX:XX:XX:XX:XX:XX):', device.macAddress || '');
    if (mac === null) return;
    const clean = mac.trim();
    const macRegex = /^([0-9a-fA-F]{2}[:-]){5}([0-9a-fA-F]{2})$/;
    if (clean === '' || macRegex.test(clean)) {
      await db.devices.update(device.id, { macAddress: clean || '00:00:00:00:00:00' });
    } else {
      alert('Invalid MAC address format.');
    }
  };

  const handleWake = async (target: Device) => {
    if (!target.macAddress || target.macAddress === '00:00:00:00:00:00') {
      alert('Cannot wake: MAC address is not set. Edit the device first.');
      return;
    }
    if (!activeDevice || !isConnected || !isAuthorized) {
      alert('Cannot wake: no online Orbit Agent available as a network helper.');
      return;
    }
    if (activeDevice.uuid === target.uuid) {
      alert('Cannot wake the active device using itself as a helper.');
      return;
    }
    try {
      const res = await request('/api/v1/system/wol', {
        method: 'POST',
        body: JSON.stringify({ mac_address: target.macAddress }),
      });
      alert(res.ok ? `Wake-on-LAN sent via "${activeDevice.name}" to "${target.name}"!` : 'Failed to send Wake-on-LAN.');
    } catch {
      alert(`Network error talking to helper "${activeDevice.name}".`);
    }
  };

  const tools: Array<{ id: ToolId; label: string; icon: typeof Wand2 }> = [
    { id: 'macros', label: 'Automations', icon: Wand2 },
    { id: 'terminal', label: 'Terminal', icon: TerminalSquare },
    { id: 'clipboard', label: 'Clipboard Sync', icon: Clipboard },
    { id: 'message', label: 'Send Message', icon: Send },
  ];

  return (
    <motion.div
      className="fixed inset-0 z-50 bg-slate-950/40 backdrop-blur-md flex items-end justify-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="w-full max-w-[430px] rounded-t-[32px] p-5 flex flex-col gap-5 bg-[var(--phone-bg)] border border-black/5 max-h-[92dvh] overflow-y-auto"
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', stiffness: 360, damping: 36 }}
        onClick={(e) => e.stopPropagation()}
        style={{ scrollbarWidth: 'none' }}
      >
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-3">
            <img src="icons/icon-512x512.png" alt="Orbit" className="set-app-icon" width={40} height={40} />
            <h2 className="m-0 text-2xl font-black text-var-ink">Settings</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-9 w-9 place-items-center rounded-full bg-black/5 text-[#6e7682]"
            aria-label="Close settings"
          >
            <X size={18} />
          </button>
        </div>

        {/* Connection */}
        <div className="flex flex-col gap-2">
          <div className="sect"><h2>Connection</h2></div>
          <div className="set-group">
            <button type="button" className="set-row" onClick={onOpenPairing}>
              <span className="r-ico"><Plus size={17} /></span>
              <span className="r-name">Pair a device</span>
              <ChevronRight size={18} className="text-[#9aa3b0]" />
            </button>
            <div className="set-row">
              <span className="r-ico"><Smartphone size={17} /></span>
              <span className="r-name">My Devices</span>
              <span className="r-val">{devices.length} connected</span>
            </div>
            <div className="set-row">
              <span className="r-ico"><SignalHigh size={17} /></span>
              <span className="r-name">Connection Quality</span>
              <span className="r-val">{connection.label}</span>
            </div>
          </div>
        </div>

        {/* Preferences */}
        <div className="flex flex-col gap-2">
          <div className="sect"><h2>Preferences</h2></div>
          <div className="set-group">
            <button type="button" className="set-row" onClick={toggleTheme}>
              <span className="r-ico">{theme === 'dark' ? <Moon size={17} /> : <Sun size={17} />}</span>
              <span className="r-name">Appearance</span>
              <span className="r-val">{theme === 'dark' ? 'Dark' : 'Light'}</span>
            </button>
          </div>

          <div className="card slider-card">
            <div className="slider-row">
              <Mouse size={20} />
              <input type="range" min="0.2" max="2.5" step="0.1" value={sensitivity} onChange={(e) => setSensitivity(parseFloat(e.target.value))} aria-label="Mouse sensitivity" />
              <span className="s-val">{sensitivity.toFixed(1)}x</span>
            </div>
            <div className="slider-row">
              <SignalHigh size={20} />
              <input type="range" min="0.2" max="2.5" step="0.1" value={scrollSensitivity} onChange={(e) => setScrollSensitivity(parseFloat(e.target.value))} aria-label="Scroll speed" />
              <span className="s-val">{scrollSensitivity.toFixed(1)}x</span>
            </div>
          </div>
        </div>

        {/* Tools */}
        <div className="flex flex-col gap-2">
          <div className="sect"><h2>Tools</h2></div>
          <div className="set-group">
            {tools.map(({ id, label, icon: Icon }) => (
              <button key={id} type="button" className="set-row" onClick={() => onOpenTool(id)}>
                <span className="r-ico"><Icon size={17} /></span>
                <span className="r-name">{label}</span>
                <ChevronRight size={18} className="text-[#9aa3b0]" />
              </button>
            ))}
          </div>
        </div>

        {/* Paired computers (management) */}
        <div className="flex flex-col gap-2">
          <div className="sect"><h2>Paired Computers</h2></div>
          <div className="flex flex-col gap-2 bg-black/5 p-2 rounded-2xl">
            {devices.length === 0 ? (
              <span className="text-xs text-[#8c94a0] block text-center py-2">No computers paired.</span>
            ) : (
              devices.map((dev) => (
                <div key={dev.uuid} className="flex justify-between items-center bg-white/70 dark:bg-black/20 p-2.5 rounded-xl border border-black/5">
                  <div className="min-w-0 flex-1 pr-2">
                    <div className="flex items-center gap-1.5">
                      <span className={`inline-block w-2 h-2 rounded-full ${isOnline(dev) ? 'bg-[#34c759]' : 'bg-gray-300'}`} />
                      <strong className="text-xs font-bold text-var-ink truncate block">{dev.name}</strong>
                    </div>
                    <span className="text-[10px] text-[#8c94a0] block truncate pl-3.5">
                      {dev.ipAddress} • {dev.macAddress && dev.macAddress !== '00:00:00:00:00:00' ? dev.macAddress : 'No MAC'}
                    </span>
                  </div>
                  <div className="flex gap-1">
                    {!isOnline(dev) && (
                      <button onClick={() => handleWake(dev)} className="text-[10px] text-orange-500 hover:bg-orange-500/10 font-bold border border-orange-500/20 px-2 py-1 rounded-lg active:scale-95 transition-all" title="Wake via online helper">
                        Wake
                      </button>
                    )}
                    {dev.uuid !== activeDevice?.uuid && (
                      <button onClick={() => handleSwitch(dev)} className="text-[10px] text-blue-500 hover:bg-blue-500/10 font-bold border border-blue-500/20 px-2 py-1 rounded-lg active:scale-95 transition-all">
                        Use
                      </button>
                    )}
                    <button onClick={() => handleEditMac(dev)} className="text-[10px] text-var-ink hover:bg-black/5 font-bold border border-black/5 px-2 py-1 rounded-lg active:scale-95 transition-all">
                      MAC
                    </button>
                    <button onClick={() => handleRename(dev)} className="text-[10px] text-var-ink hover:bg-black/5 font-bold border border-black/5 px-2 py-1 rounded-lg active:scale-95 transition-all">
                      Rename
                    </button>
                    <button onClick={() => handleDelete(dev)} className="text-[10px] text-red-500 hover:bg-red-500/10 font-bold border border-red-500/10 bg-red-500/5 px-2 py-1 rounded-lg active:scale-95 transition-all">
                      Delete
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* About */}
        <div className="flex flex-col gap-2">
          <div className="sect"><h2>About</h2></div>
          <div className="set-group">
            <div className="set-row">
              <span className="r-ico"><Info size={17} /></span>
              <span className="r-name">About Orbit</span>
              <span className="r-val">v1.0.1</span>
            </div>
            <button
              type="button"
              className="set-row"
              onClick={() => window.open('https://buymeacoffee.com/yovrah', '_blank', 'noopener')}
            >
              <span className="r-ico" style={{ color: '#b8860b' }}><Coffee size={17} /></span>
              <span className="r-name">Support Orbit</span>
              <span className="r-val">☕ Buy me a coffee</span>
            </button>
            <button type="button" className="set-row" onClick={clearPWACache}>
              <span className="r-ico"><X size={17} /></span>
              <span className="r-name">Clear Cache</span>
              <span className="r-val">Reset</span>
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

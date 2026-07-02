import { useState } from 'react';
import { AnimatePresence } from 'framer-motion';

import { OrbitProvider, useOrbit } from './state/OrbitContext';
import { Navbar } from './components/Navbar';
import { AudioPlayer } from './components/AudioPlayer';
import { Onboarding } from './components/Onboarding';
import PairingFlow from './components/PairingFlow';
import { DashboardTab } from './features/dashboard/DashboardTab';
import { MouseTab } from './features/mouse/MouseTab';
import { StreamTab } from './features/stream/StreamTab';
import { FilesTab } from './features/files/FilesTab';
import { SettingsSheet } from './features/settings/SettingsSheet';
import { ToolSheets, type ToolId } from './features/settings/ToolSheets';
import type { View } from './types';

interface ShellProps {
  showPairing: boolean;
  setShowPairing: (v: boolean) => void;
  showSettings: boolean;
  setShowSettings: (v: boolean) => void;
  activeTool: ToolId | null;
  setActiveTool: (t: ToolId | null) => void;
}

function AppShell({
  showPairing,
  setShowPairing,
  showSettings,
  setShowSettings,
  activeTool,
  setActiveTool,
}: ShellProps) {
  const { devices, setActiveDeviceUuid } = useOrbit();
  const [activeView, setActiveView] = useState<View>('dashboard');

  return (
    <div className="app-shell">
      <div className="ambient ambient-blue" />
      <div className="ambient ambient-green" />

      <main className="phone-frame">
        <section className={`content-stage ${activeView === 'mouse' ? 'no-scroll' : ''}`}>
          <AnimatePresence mode="wait">
            {activeView === 'dashboard' && <DashboardTab onNavigate={setActiveView} />}
            {activeView === 'mouse' && <MouseTab />}
            {activeView === 'stream' && <StreamTab />}
            {activeView === 'files' && <FilesTab />}
          </AnimatePresence>
        </section>

        <Navbar activeView={activeView} setActiveView={setActiveView} />
      </main>

      {/* Mounted only pre-pairing so a returning user never risks a flash. */}
      <AnimatePresence>
        {devices.length === 0 && !showPairing && (
          <Onboarding onScanQr={() => setShowPairing(true)} />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showPairing && (
          <PairingFlow
            onClose={() => setShowPairing(false)}
            onSuccess={() => setShowPairing(false)}
            onPaired={(uuid) => {
              setActiveDeviceUuid(uuid);
              setShowPairing(false);
            }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showSettings && (
          <SettingsSheet
            onClose={() => setShowSettings(false)}
            onOpenPairing={() => {
              setShowSettings(false);
              setShowPairing(true);
            }}
            onOpenTool={(tool) => {
              setShowSettings(false);
              setActiveTool(tool);
            }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {activeTool && <ToolSheets tool={activeTool} onClose={() => setActiveTool(null)} />}
      </AnimatePresence>

      <AudioPlayer />
    </div>
  );
}

export default function App() {
  const [showPairing, setShowPairing] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [activeTool, setActiveTool] = useState<ToolId | null>(null);

  return (
    <OrbitProvider
      onOpenPairing={() => setShowPairing(true)}
      onOpenSettings={() => setShowSettings(true)}
    >
      <AppShell
        showPairing={showPairing}
        setShowPairing={setShowPairing}
        showSettings={showSettings}
        setShowSettings={setShowSettings}
        activeTool={activeTool}
        setActiveTool={setActiveTool}
      />
    </OrbitProvider>
  );
}

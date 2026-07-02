import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import {
  MonitorPlay,
  Maximize2,
  Minimize2,
  RefreshCw,
  ChevronRight,
  Gauge,
  Move,
  Hand,
  Keyboard,
  Volume2,
  VolumeX,
  MoreHorizontal,
  Monitor,
  X,
} from 'lucide-react';
import { ScreenHeader } from '../../components/ScreenHeader';
import { ConnectBanner } from '../../components/ConnectBanner';
import { OnScreenKeyboard } from '../../components/OnScreenKeyboard';
import { buildWsUrl } from '../../api/client';
import { useOrbit } from '../../state/OrbitContext';
import { useTouchpad } from '../../hooks/useTouchpad';

interface MonitorInfo {
  index: number;
  width: number;
  height: number;
  name: string;
}

type ControlMode = 'trackpad' | 'touch';

const spring = { type: 'spring', stiffness: 360, damping: 32, mass: 0.85 } as const;

export function StreamTab() {
  const { activeDevice, isReady, isAuthorized, sendEvent, request, settings, audioEnabled, setAudioEnabled } =
    useOrbit();
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [monitors, setMonitors] = useState<MonitorInfo[]>([]);
  const [activeMonitor, setActiveMonitor] = useState(1);
  const [quality, setQuality] = useState(50);
  const [fps, setFps] = useState(30);
  const [currentFps, setCurrentFps] = useState(0);
  const [bitrate, setBitrate] = useState(0);
  const [showSettings, setShowSettings] = useState(false);
  const [mode, setMode] = useState<ControlMode>('trackpad');
  const [showKeyboard, setShowKeyboard] = useState(false);
  const [cursor, setCursor] = useState<{ x: number; y: number } | null>(null);
  const [surface, setSurface] = useState<HTMLDivElement | null>(null);
  const [expanded, setExpanded] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const frameCountRef = useRef(0);
  const byteCountRef = useRef(0);
  const lastStatsTimeRef = useRef(Date.now());

  // Steam-Link-style relative trackpad control laid directly over the video —
  // drag to move the cursor, tap to click, two-finger tap for right-click.
  useTouchpad({
    element: surface,
    sendEvent,
    enabled: isReady && mode === 'trackpad',
    sensitivity: settings.sensitivity,
    scrollSensitivity: settings.scrollSensitivity,
    onPoint: setCursor,
  });

  useEffect(() => {
    if (!activeDevice || !isAuthorized) return;
    request('/api/v1/screen/monitors')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => data && setMonitors(data.monitors || []))
      .catch((err) => console.error('Failed to load monitors:', err));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeDevice?.uuid, isAuthorized]);

  useEffect(() => {
    if (!activeDevice || !isAuthorized) return;
    const ws = new WebSocket(buildWsUrl(activeDevice, '/ws/screen/stream'));
    wsRef.current = ws;
    ws.binaryType = 'blob';

    ws.onopen = () => ws.send(JSON.stringify({ event: 'config', quality, fps, monitor: activeMonitor }));

    ws.onmessage = (event) => {
      if (!(event.data instanceof Blob)) return;
      frameCountRef.current += 1;
      byteCountRef.current += event.data.size;
      const url = URL.createObjectURL(event.data);
      setImageUrl((old) => {
        if (old) URL.revokeObjectURL(old);
        return url;
      });
      const now = Date.now();
      const elapsed = now - lastStatsTimeRef.current;
      if (elapsed >= 1000) {
        setCurrentFps(Math.round((frameCountRef.current * 1000) / elapsed));
        setBitrate(Math.round((byteCountRef.current * 1000) / elapsed / 1024));
        frameCountRef.current = 0;
        byteCountRef.current = 0;
        lastStatsTimeRef.current = now;
      }
    };

    ws.onclose = () => setImageUrl(null);

    return () => {
      ws.close();
      wsRef.current = null;
      setImageUrl((old) => {
        if (old) URL.revokeObjectURL(old);
        return null;
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeDevice?.uuid, isAuthorized, activeMonitor]);

  useEffect(() => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ event: 'config', quality, fps, monitor: activeMonitor }));
    }
  }, [quality, fps, activeMonitor]);

  const handleImageClick = (e: React.MouseEvent<HTMLImageElement>) => {
    if (mode !== 'touch') return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    sendEvent({ event: 'mouse_absolute', x, y });
    sendEvent({ event: 'mouse_click', button: 'left', type: 'click' });
  };

  // The native Fullscreen API is effectively unsupported for arbitrary
  // elements on iOS Safari (including installed PWAs), so "fullscreen" is an
  // in-app immersive mode instead — the stream frame overlays the whole
  // viewport via CSS, no browser API involved, works identically everywhere.
  const enterExpanded = () => setExpanded(true);
  const exitExpanded = () => setExpanded(false);

  const actions = [
    {
      label: mode === 'trackpad' ? 'Trackpad' : 'Tap',
      icon: mode === 'trackpad' ? Move : Hand,
      on: mode === 'trackpad',
      run: () => setMode((m) => (m === 'trackpad' ? 'touch' : 'trackpad')),
    },
    {
      label: 'Keyboard',
      icon: Keyboard,
      on: showKeyboard,
      run: () => setShowKeyboard((v) => !v),
    },
    {
      label: 'Sound',
      icon: audioEnabled ? Volume2 : VolumeX,
      on: audioEnabled,
      run: () => setAudioEnabled(!audioEnabled),
    },
    { label: 'More', icon: MoreHorizontal, on: showSettings, run: () => setShowSettings((v) => !v) },
  ];

  const hint =
    mode === 'trackpad'
      ? 'Drag to move the cursor · tap to click · two fingers to right-click.'
      : 'Tap the live screen to move the cursor and click.';

  return (
    <motion.div
      key="stream"
      className="screen"
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={spring}
    >
      {!expanded && (
        <ScreenHeader
          icon={MonitorPlay}
          title="Stream"
          subtitle={activeDevice?.ipAddress?.replace(/^https?:\/\//, '') || 'Not connected'}
          action={
            <button type="button" className="h-act" onClick={enterExpanded} aria-label="Fullscreen">
              <Maximize2 size={18} />
            </button>
          }
        />
      )}

      {!expanded && <ConnectBanner />}

      <div
        ref={setSurface}
        className={`stream-frame ${mode === 'trackpad' ? 'trackpad-mode' : ''} ${expanded ? 'expanded' : ''}`}
      >
        {imageUrl ? (
          <>
            <img src={imageUrl} alt="PC live screen" onClick={handleImageClick} draggable={false} />
            <div className="s-badge">
              <span>{currentFps} FPS</span>
              <span>·</span>
              <span>{bitrate} KB/s</span>
            </div>
            {mode === 'trackpad' && cursor && (
              <div className="pad-cursor" style={{ left: cursor.x, top: cursor.y }} />
            )}
          </>
        ) : (
          <div className="flex flex-col items-center gap-2 text-[#8c94a0] py-10">
            <RefreshCw size={26} className="spin text-blue-400" />
            <span className="text-xs font-bold">Connecting to screen…</span>
          </div>
        )}
        {expanded && (
          <button type="button" className="frame-exit" onClick={exitExpanded} aria-label="Exit fullscreen">
            <Minimize2 size={16} />
          </button>
        )}
      </div>

      {!expanded && (
        <>
          {/* Quality selector */}
          <button type="button" className="quality-pill" onClick={() => setShowSettings((v) => !v)}>
            <span className="q-l">
              <Gauge size={18} className="text-[#007aff]" />
              Quality
            </span>
            <span className="q-v flex items-center gap-1">
              {fps} FPS · Q{quality}
              <ChevronRight size={16} />
            </span>
          </button>

          {/* Actions */}
          <div className="stream-actions">
            {actions.map(({ label, icon: Icon, run, on }) => (
              <button key={label} type="button" className={`s-action ${on ? 'on' : ''}`} onClick={run}>
                <Icon size={20} />
                <span>{label}</span>
              </button>
            ))}
          </div>

          <p className="text-center text-[11px] text-[#8c94a0] font-bold px-4">{hint}</p>
        </>
      )}

      {showKeyboard && <OnScreenKeyboard />}

      {/* Quality settings sheet */}
      {showSettings && (
        <div className="fixed inset-0 z-[60] bg-slate-950/40 backdrop-blur-md flex items-end justify-center" onClick={() => setShowSettings(false)}>
          <motion.div
            className="w-full max-w-[430px] rounded-t-[32px] p-5 flex flex-col gap-4 bg-[var(--phone-bg)] border border-black/5"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            transition={spring}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center">
              <h2 className="m-0 text-xl font-black text-var-ink">Stream Quality</h2>
              <button type="button" onClick={() => setShowSettings(false)} className="grid h-9 w-9 place-items-center rounded-full bg-black/5 text-[#6e7682]" aria-label="Close">
                <X size={18} />
              </button>
            </div>

            <div className="card slider-card">
              <div className="slider-row">
                <span className="text-xs font-bold text-var-ink w-[70px]">Quality</span>
                <input type="range" min="10" max="90" step="5" value={quality} onChange={(e) => setQuality(parseInt(e.target.value))} />
                <span className="s-val">{quality}%</span>
              </div>
              <div className="slider-row">
                <span className="text-xs font-bold text-var-ink w-[70px]">Frame rate</span>
                <input type="range" min="5" max="60" step="5" value={fps} onChange={(e) => setFps(parseInt(e.target.value))} />
                <span className="s-val">{fps}</span>
              </div>
            </div>

            {monitors.length > 0 && (
              <div className="flex gap-2">
                {monitors.map((mon) => (
                  <button
                    key={mon.index}
                    type="button"
                    onClick={() => setActiveMonitor(mon.index)}
                    className={`flex-1 flex flex-col items-center gap-1 p-3 rounded-2xl border font-bold text-[10px] transition-all ${
                      activeMonitor === mon.index
                        ? 'border-[#007aff] bg-blue-500/10 text-blue-500'
                        : 'border-black/5 bg-black/5 text-var-ink'
                    }`}
                  >
                    <Monitor size={16} />
                    <span>{mon.name}</span>
                    <small className="text-[8px] text-gray-500">{mon.width}×{mon.height}</small>
                  </button>
                ))}
              </div>
            )}
          </motion.div>
        </div>
      )}
    </motion.div>
  );
}

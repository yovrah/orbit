import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './db/clientDb';
import PairingFlow from './components/PairingFlow';
import { useWebSocket } from './hooks/useWebSocket';
import { useTouchpad } from './hooks/useTouchpad';
import { 
  Monitor, 
  Power, 
  Maximize2, 
  MousePointer, 
  Keyboard, 
  Moon, 
  RotateCw, 
  Tv, 
  ChevronRight, 
  ChevronLeft,
  LayoutGrid, 
  Clock, 
  Settings,
  Sliders,
  Plus,
  Folder,
  File,
  Search,
  Play,
  SkipForward,
  SkipBack,
  X,
  RefreshCw,
  Volume2,
  Terminal,
  Presentation,
  Battery,
  BatteryCharging,
  Sun
} from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState<'remote' | 'screen' | 'keyboard' | 'files' | 'apps' | 'stats' | 'gamepad' | 'terminal' | 'presenter'>('remote');
  const [activeNav, setActiveNav] = useState<'apps' | 'history' | 'settings'>('apps');
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [showPairing, setShowPairing] = useState(false);

  // Files state
  const [currentPath, setCurrentPath] = useState<string | null>(null);
  const [files, setFiles] = useState<Array<{ name: string; path: string; is_dir: boolean; size: number }>>([]);
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);

  // Apps & Processes state
  const [scannedApps, setScannedApps] = useState<Array<{ name: string; path: string; icon: string }>>([]);
  const [runningProcesses, setRunningProcesses] = useState<Array<{ hwnd: number; title: string; pid: number }>>([]);
  const [appSearchQuery, setAppSearchQuery] = useState('');
  const [appsMode, setAppsMode] = useState<'launch' | 'processes'>('launch');
  const [isLoadingApps, setIsLoadingApps] = useState(false);

  // System Stats state
  const [systemStats, setSystemStats] = useState<{
    cpu_percent: number;
    ram_percent: number;
    ram_used_gb: number;
    ram_total_gb: number;
    disk_percent: number;
    disk_used_gb: number;
    disk_total_gb: number;
    uptime_seconds: number;
    os_name: string;
    cpu_name: string;
    hostname: string;
    battery_percent: number | null;
    battery_plugged: boolean | null;
  } | null>(null);
  const [isLoadingStats, setIsLoadingStats] = useState(false);
  const [alertText, setAlertText] = useState('');

  // Terminal state
  const [terminalCommand, setTerminalCommand] = useState('');
  const [terminalHistory, setTerminalHistory] = useState<Array<{ cmd: string; out: string; err: string; code: number }>>([]);
  const [isRunningCommand, setIsRunningCommand] = useState(false);

  // Presenter state
  const [presenterTime, setPresenterTime] = useState(0);
  const [isTimerRunning, setIsTimerRunning] = useState(false);

  // Read paired devices from IndexedDB
  const devices = useLiveQuery(() => db.devices.toArray()) || [];
  const activeDevice = devices[0]; // Select the first paired host for demonstration

  // Auto-pair immediately if hosted directly on the agent port
  useEffect(() => {
    const autoPairLocal = async () => {
      const port = window.location.port;
      const hostname = window.location.hostname;
      if (port === '23810') {
        const protocol = window.location.protocol;
        const currentOrigin = `${protocol}//${hostname}:${port}`;
        const count = await db.devices.count();
        const localDevice = await db.devices.get('local-auto-paired-uuid');
        
        if (localDevice) {
          if (localDevice.ipAddress !== currentOrigin) {
            await db.devices.update('local-auto-paired-uuid', { ipAddress: currentOrigin });
            console.log('Обновлен IP-адрес локального агента в БД:', currentOrigin);
          }
        } else if (count === 0) {
          await db.devices.add({
            uuid: 'local-auto-paired-uuid',
            name: 'Этот Компьютер',
            ipAddress: currentOrigin,
            port: 23810,
            macAddress: '00:00:00:00:00:00',
            osName: 'Windows',
            osVersion: 'Локально',
            sharedSecret: 'LOCAL_SECRET',
            isPaired: true,
            lastConnected: new Date()
          });
          console.log('Автоматически сопряжено с локальным агентом!');
        }
      }
    };
    autoPairLocal();
  }, [devices]);

  // WebSocket Connection
  const { isConnected, isAuthorized, sendEvent } = useWebSocket(activeDevice || null);

  // Touchpad Gestures
  const touchpadRef = useRef<HTMLDivElement>(null);
  useTouchpad({
    elementRef: touchpadRef,
    sendEvent,
    enabled: !!activeDevice && isAuthorized && activeTab === 'remote'
  });

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const fetchFiles = useCallback(async (path: string | null) => {
    if (!activeDevice) return;
    setIsLoadingFiles(true);
    try {
      const query = path ? `?path=${encodeURIComponent(path)}` : '';
      const res = await fetch(`${activeDevice.ipAddress}/api/v1/files/list${query}`);
      if (res.ok) {
        const data = await res.json();
        setFiles(data.files || []);
        setCurrentPath(path);
      }
    } catch (err) {
      console.error('Error fetching files:', err);
    } finally {
      setIsLoadingFiles(false);
    }
  }, [activeDevice]);

  const fetchScannedApps = useCallback(async () => {
    if (!activeDevice) return;
    try {
      const res = await fetch(`${activeDevice.ipAddress}/api/v1/apps`);
      if (res.ok) {
        const data = await res.json();
        setScannedApps(data.apps || []);
      }
    } catch (err) {
      console.error('Error fetching scanned apps:', err);
    }
  }, [activeDevice]);

  const fetchRunningProcesses = useCallback(async () => {
    if (!activeDevice) return;
    try {
      const res = await fetch(`${activeDevice.ipAddress}/api/v1/system/processes`);
      if (res.ok) {
        const data = await res.json();
        setRunningProcesses(data.processes || []);
      }
    } catch (err) {
      console.error('Error fetching processes:', err);
    }
  }, [activeDevice]);

  const fetchSystemStats = useCallback(async () => {
    if (!activeDevice) return;
    try {
      const res = await fetch(`${activeDevice.ipAddress}/api/v1/system/stats`);
      if (res.ok) {
        const data = await res.json();
        setSystemStats(data);
      }
    } catch (err) {
      console.error('Error fetching system stats:', err);
    }
  }, [activeDevice]);

  useEffect(() => {
    if (activeTab === 'files' && activeDevice) {
      fetchFiles(currentPath);
    }
  }, [activeTab, currentPath, activeDevice, fetchFiles]);

  useEffect(() => {
    if (activeTab === 'apps' && activeDevice) {
      setIsLoadingApps(true);
      Promise.all([fetchScannedApps(), fetchRunningProcesses()]).finally(() => {
        setIsLoadingApps(false);
      });
      const interval = setInterval(fetchRunningProcesses, 5000);
      return () => clearInterval(interval);
    }
  }, [activeTab, activeDevice, fetchScannedApps, fetchRunningProcesses]);

  useEffect(() => {
    if (activeTab === 'stats' && activeDevice) {
      setIsLoadingStats(true);
      fetchSystemStats().finally(() => setIsLoadingStats(false));
      const interval = setInterval(fetchSystemStats, 3000);
      return () => clearInterval(interval);
    }
  }, [activeTab, activeDevice, fetchSystemStats]);

  useEffect(() => {
    let interval: any;
    if (isTimerRunning) {
      interval = setInterval(() => {
        setPresenterTime(prev => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isTimerRunning]);

  // Screen stream touch handlers
  const screenTouchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const screenLastTouchRef = useRef<{ y: number } | null>(null);
  const isScreenScrollingRef = useRef(false);
  const screenLastTapTimeRef = useRef<number>(0);
  const [ripples, setRipples] = useState<Array<{ id: number; x: number; y: number }>>([]);

  const addRipple = (x: number, y: number) => {
    const id = Math.random();
    setRipples((prev) => [...prev, { id, x, y }]);
    setTimeout(() => {
      setRipples((prev) => prev.filter((r) => r.id !== id));
    }, 500);
  };

  const handleScreenTouchStart = (e: React.TouchEvent<HTMLImageElement>) => {
    if (!activeDevice || !isAuthorized) return;
    e.preventDefault();
    
    const touches = e.touches;
    const rect = e.currentTarget.getBoundingClientRect();
    
    if (touches.length === 1) {
      const touch = touches[0];
      const x = (touch.clientX - rect.left) / rect.width;
      const y = (touch.clientY - rect.top) / rect.height;
      
      screenTouchStartRef.current = { x: touch.clientX, y: touch.clientY, time: Date.now() };
      isScreenScrollingRef.current = false;
      
      sendEvent({ event: 'mouse_absolute', x, y });
      addRipple(x, y);
    } else if (touches.length === 2) {
      isScreenScrollingRef.current = true;
      const t1 = touches[0];
      const t2 = touches[1];
      screenLastTouchRef.current = { y: (t1.clientY + t2.clientY) / 2 };
    }
  };

  const handleScreenTouchMove = (e: React.TouchEvent<HTMLImageElement>) => {
    if (!activeDevice || !isAuthorized) return;
    e.preventDefault();
    
    const touches = e.touches;
    const rect = e.currentTarget.getBoundingClientRect();
    
    if (touches.length === 1 && !isScreenScrollingRef.current) {
      const touch = touches[0];
      const x = (touch.clientX - rect.left) / rect.width;
      const y = (touch.clientY - rect.top) / rect.height;
      
      if (x >= 0 && x <= 1 && y >= 0 && y <= 1) {
        sendEvent({ event: 'mouse_absolute', x, y });
      }
    } else if (touches.length === 2 && isScreenScrollingRef.current) {
      const t1 = touches[0];
      const t2 = touches[1];
      const currentMidY = (t1.clientY + t2.clientY) / 2;
      
      if (screenLastTouchRef.current) {
        const dy = (currentMidY - screenLastTouchRef.current.y) / 2.0;
        sendEvent({
          event: 'mouse_scroll',
          dx: 0,
          dy: dy
        });
      }
      screenLastTouchRef.current = { y: currentMidY };
    }
  };

  const handleScreenTouchEnd = (e: React.TouchEvent<HTMLImageElement>) => {
    if (!activeDevice || !isAuthorized) return;
    e.preventDefault();
    
    const start = screenTouchStartRef.current;
    
    if (start && e.changedTouches.length === 1 && !isScreenScrollingRef.current) {
      const touch = e.changedTouches[0];
      const duration = Date.now() - start.time;
      const dist = Math.sqrt(
        Math.pow(touch.clientX - start.x, 2) + Math.pow(touch.clientY - start.y, 2)
      );
      
      if (duration < 250 && dist < 15) {
        const now = Date.now();
        const diff = now - screenLastTapTimeRef.current;
        if (diff < 300) {
          sendEvent({ event: 'mouse_click', button: 'left', type: 'double' });
          screenLastTapTimeRef.current = 0;
        } else {
          sendEvent({ event: 'mouse_click', button: 'left', type: 'click' });
          screenLastTapTimeRef.current = now;
        }
      }
    } else if (isScreenScrollingRef.current && e.touches.length === 0) {
      isScreenScrollingRef.current = false;
    }
    
    if (e.touches.length === 0 && e.changedTouches.length === 2) {
      sendEvent({ event: 'mouse_click', button: 'right', type: 'click' });
    }
    
    screenTouchStartRef.current = null;
    screenLastTouchRef.current = null;
  };

  const handleScreenMouseDown = (e: React.MouseEvent<HTMLImageElement>) => {
    if (!activeDevice || !isAuthorized) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    
    sendEvent({ event: 'mouse_absolute', x, y });
    const btn = e.button === 2 ? 'right' : 'left';
    sendEvent({ event: 'mouse_click', button: btn, type: 'click' });
    addRipple(x, y);
  };

  const handleLaunchApp = async (path: string) => {
    if (!activeDevice) return;
    try {
      await fetch(`${activeDevice.ipAddress}/api/v1/apps/launch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path })
      });
    } catch (err) {
      console.error('Failed to launch app:', err);
    }
  };

  const handleKillProcess = async (hwnd: number, pid: number) => {
    if (!activeDevice) return;
    try {
      const res = await fetch(`${activeDevice.ipAddress}/api/v1/system/processes/kill`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hwnd, pid })
      });
      if (res.ok) {
        fetchRunningProcesses();
      }
    } catch (err) {
      console.error('Failed to close process:', err);
    }
  };

  const handleGoBack = () => {
    if (!currentPath) return;
    let path = currentPath;
    if (path.endsWith('\\')) {
      path = path.slice(0, -1);
    }
    const idx = path.lastIndexOf('\\');
    if (idx !== -1) {
      const parent = path.substring(0, idx + 1);
      if (parent.endsWith(':')) {
        fetchFiles(parent + '\\');
      } else {
        fetchFiles(parent);
      }
    } else {
      fetchFiles(null);
    }
  };

  const handleOpenFile = async (path: string) => {
    if (!activeDevice) return;
    try {
      await fetch(`${activeDevice.ipAddress}/api/v1/files/open`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path })
      });
    } catch (err) {
      console.error('Failed to open file:', err);
    }
  };

  const handleToggleMute = async () => {
    if (!activeDevice) return;
    try {
      await fetch(`${activeDevice.ipAddress}/api/v1/system/volume/mute`, { method: 'POST' });
    } catch (err) {
      console.error('Failed to toggle mute:', err);
    }
  };

  const handleMonitorOff = async () => {
    if (!activeDevice) return;
    try {
      await fetch(`${activeDevice.ipAddress}/api/v1/system/monitor/off`, { method: 'POST' });
    } catch (err) {
      console.error('Failed to turn off monitor:', err);
    }
  };

  const handleEmptyRecycleBin = async () => {
    if (!activeDevice) return;
    if (!confirm('Очистить корзину на ПК?')) return;
    try {
      const res = await fetch(`${activeDevice.ipAddress}/api/v1/system/recycle-bin/empty`, { method: 'POST' });
      if (res.ok) {
        alert('Корзина очищена!');
      }
    } catch (err) {
      console.error('Failed to empty recycle bin:', err);
    }
  };

  const handleSendNotification = async () => {
    if (!activeDevice || !alertText.trim()) return;
    try {
      const res = await fetch(`${activeDevice.ipAddress}/api/v1/system/notification`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: alertText })
      });
      if (res.ok) {
        alert('Сообщение отправлено на ПК!');
        setAlertText('');
      }
    } catch (err) {
      console.error('Failed to send alert notification:', err);
    }
  };

  const handleSetBrightness = async (level: number) => {
    if (!activeDevice) return;
    try {
      await fetch(`${activeDevice.ipAddress}/api/v1/system/brightness`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ level })
      });
    } catch (err) {
      console.error('Failed to set brightness:', err);
    }
  };

  const handleRunTerminalCommand = async () => {
    if (!activeDevice || !terminalCommand.trim()) return;
    setIsRunningCommand(true);
    const cmd = terminalCommand;
    try {
      const res = await fetch(`${activeDevice.ipAddress}/api/v1/system/terminal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: cmd })
      });
      if (res.ok) {
        const data = await res.json();
        setTerminalHistory(prev => [
          ...prev,
          { cmd, out: data.stdout, err: data.stderr, code: data.return_code }
        ]);
        setTerminalCommand('');
      }
    } catch (err) {
      console.error('Failed to run terminal command:', err);
      setTerminalHistory(prev => [
        ...prev,
        { cmd, out: '', err: 'Ошибка подключения к агенту', code: -99 }
      ]);
    } finally {
      setIsRunningCommand(false);
    }
  };

  const springTransition = {
    type: "spring",
    stiffness: 400,
    damping: 30,
    mass: 0.8
  };

  const buttonPress = {
    whileTap: { scale: 0.96 },
    whileHover: { scale: 1.02 }
  };

  const tabs = [
    { id: 'remote', label: 'Пульт' },
    { id: 'screen', label: 'Экран' },
    { id: 'keyboard', label: 'Клавиши' },
    { id: 'files', label: 'Файлы' },
    { id: 'apps', label: 'Программы' },
    { id: 'stats', label: 'Дашборд' },
    { id: 'gamepad', label: 'Геймпад' },
    { id: 'terminal', label: 'Консоль' },
    { id: 'presenter', label: 'Презентация' }
  ];

  // Resolve Connection Status Badge
  const getStatus = () => {
    if (!activeDevice) return { label: 'Offline', color: 'bg-[#ff3b30]' };
    if (!isConnected) return { label: 'Connecting...', color: 'bg-[#ffcc00] animate-pulse' };
    if (!isAuthorized) return { label: 'Authorizing...', color: 'bg-[#ffcc00]' };
    return { label: 'Connected', color: 'bg-[#34c759] shadow-[0_0_8px_#34c759]' };
  };
  const status = getStatus();

  return (
    <div className={`flex items-center justify-center min-h-screen ${isDarkMode ? 'dark bg-[#0a0a0c]' : 'bg-[#eef2f7]'}`}>
      
      {/* Phone Shell Layout */}
      <div className="relative w-full max-w-[430px] min-h-screen sm:min-h-[850px] sm:max-h-[900px] sm:rounded-[50px] sm:border-[8px] sm:border-black sm:shadow-2xl overflow-hidden bg-gradient-to-tr from-[var(--bg-gradient-start)] to-[var(--bg-gradient-end)] flex flex-col justify-between p-6">
        
        <div className="hidden sm:block absolute top-0 left-1/2 transform -translate-x-1/2 w-36 h-6 bg-black rounded-b-2xl z-50"></div>

        {/* 1. HEADER */}
        <div className="flex items-center justify-between mt-2 sm:mt-4">
          <div className="flex items-center gap-3">
            <motion.div 
              className="w-12 h-12 rounded-2xl glass-card flex items-center justify-center text-[var(--text-primary)]"
              {...buttonPress}
            >
              <Monitor size={22} strokeWidth={2} />
            </motion.div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-[var(--text-primary)]">
                {activeDevice ? activeDevice.name : 'Нет PC'}
              </h1>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className={`w-2.5 h-2.5 rounded-full ${status.color}`}></span>
                <span className="text-xs font-semibold text-[#86868b]">
                  {status.label}
                </span>
              </div>
            </div>
          </div>
          
          <motion.button 
            className="w-12 h-12 rounded-full glass-card flex items-center justify-center text-[#ff3b30]"
            onClick={() => setIsDarkMode(!isDarkMode)}
            {...buttonPress}
          >
            <Power size={20} strokeWidth={2} />
          </motion.button>
        </div>

        {activeNav === 'apps' && (
          <>
            {/* 2. TABS SELECTOR */}
            <div className="flex items-center bg-black/5 dark:bg-white/5 p-1 rounded-2xl mt-5 overflow-x-auto scrollbar-none flex-nowrap w-full gap-0.5">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className="relative shrink-0 px-3.5 py-2 text-xs font-medium rounded-xl transition-all duration-300"
                >
                  {activeTab === tab.id && (
                    <motion.div
                      layoutId="activeTabIndicator"
                      className="absolute inset-0 bg-black dark:bg-white rounded-xl shadow-sm"
                      transition={springTransition}
                    />
                  )}
                  <span className={`relative z-10 transition-colors duration-300 whitespace-nowrap ${
                    activeTab === tab.id 
                      ? 'text-white dark:text-black font-semibold' 
                      : 'text-[#86868b] hover:text-[var(--text-primary)]'
                  }`}>
                    {tab.label}
                  </span>
                </button>
              ))}
            </div>

            {/* 3. DYNAMIC CONTENT AREA */}
            <div className="flex-1 flex flex-col justify-center my-6">
              <AnimatePresence mode="wait">
                {activeTab === 'remote' && (
                  <motion.div 
                    key="remote"
                    ref={touchpadRef}
                    className={`w-full aspect-[1.1] glass-card rounded-[36px] p-6 relative overflow-hidden dotted-grid flex flex-col items-center justify-center ${
                      activeDevice && isAuthorized ? 'cursor-none active:scale-[0.99] transition-transform duration-150' : 'opacity-60 pointer-events-none'
                    }`}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={springTransition}
                  >
                    <motion.button 
                      className="absolute top-4 right-4 w-9 h-9 rounded-full bg-white/60 dark:bg-white/10 flex items-center justify-center text-[var(--text-primary)] shadow-sm pointer-events-auto"
                      {...buttonPress}
                    >
                      <Maximize2 size={15} />
                    </motion.button>

                    <div className="text-center pointer-events-none">
                      <p className="text-sm font-medium text-[#86868b] tracking-wide max-w-[200px]">
                        {activeDevice 
                          ? (isAuthorized ? 'Проведите для движения мыши' : 'Авторизация...') 
                          : 'Требуется сопряжение с PC'}
                      </p>
                    </div>

                    <motion.button 
                      className="absolute bottom-4 left-4 w-9 h-9 rounded-full bg-white/60 dark:bg-white/10 flex items-center justify-center text-[var(--text-primary)] shadow-sm pointer-events-auto"
                      {...buttonPress}
                    >
                      <MousePointer size={15} />
                    </motion.button>

                    <motion.button 
                      className="absolute bottom-4 right-4 w-9 h-9 rounded-full bg-white/60 dark:bg-white/10 flex items-center justify-center text-[var(--text-primary)] shadow-sm pointer-events-auto"
                      {...buttonPress}
                    >
                      <Keyboard size={15} />
                    </motion.button>
                  </motion.div>
                )}

                {activeTab === 'screen' && (
                  <motion.div 
                    key="screen"
                    className="w-full aspect-[1.1] glass-card rounded-[36px] overflow-hidden relative flex flex-col items-center justify-center select-none"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={springTransition}
                  >
                    {activeDevice && isAuthorized ? (
                      <div className="relative w-full h-full flex items-center justify-center overflow-hidden">
                        <img
                          src={`${activeDevice.ipAddress}/api/v1/screen/stream`}
                          alt="Screen Stream"
                          className="w-full h-full object-contain cursor-crosshair select-none"
                          onTouchStart={handleScreenTouchStart}
                          onTouchMove={handleScreenTouchMove}
                          onTouchEnd={handleScreenTouchEnd}
                          onMouseDown={handleScreenMouseDown}
                          onContextMenu={(e) => e.preventDefault()}
                        />
                        {ripples.map((ripple) => (
                          <span
                            key={ripple.id}
                            className="absolute w-8 h-8 -ml-4 -mt-4 rounded-full border border-blue-500 bg-blue-500/20 pointer-events-none animate-ping animate-duration-500"
                            style={{
                              left: `${ripple.x * 100}%`,
                              top: `${ripple.y * 100}%`,
                            }}
                          />
                        ))}
                      </div>
                    ) : (
                      <div className="text-center pointer-events-none">
                        <p className="text-sm font-medium text-[#86868b]">Нет подключения</p>
                      </div>
                    )}
                  </motion.div>
                )}

                {activeTab === 'keyboard' && (
                  <motion.div 
                    key="keyboard"
                    className="w-full aspect-[1.1] glass-card rounded-[36px] p-5 relative flex flex-col gap-4 overflow-y-auto scrollbar-none"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={springTransition}
                  >
                    {/* Text Input Row */}
                    <div className="flex flex-col gap-1.5 shrink-0">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-[#86868b]">Ввод текста</span>
                        <span className="text-[10px] text-[#86868b]">Работает и Backspace</span>
                      </div>
                      <input
                        type="text"
                        placeholder="Нажмите для ввода текста..."
                        className="w-full bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-blue-500 text-[var(--text-primary)]"
                        onKeyDown={(e) => {
                          e.preventDefault();
                          const key = e.key;
                          sendEvent({
                            event: 'keyboard_input',
                            key: key,
                            type: 'press',
                            modifiers: {
                              ctrl: e.ctrlKey,
                              alt: e.altKey,
                              shift: e.shiftKey,
                              win: e.metaKey
                            }
                          });
                          e.currentTarget.value = '';
                        }}
                      />
                    </div>

                    {/* Hotkey Grid */}
                    <div className="flex flex-col gap-1.5 shrink-0">
                      <span className="text-xs font-semibold text-[#86868b]">Горячие клавиши</span>
                      <div className="grid grid-cols-3 gap-2">
                        {[
                          { label: 'Alt + Tab', key: 'tab', mods: { alt: true } },
                          { label: 'Alt + F4', key: 'f4', mods: { alt: true } },
                          { label: 'Win + D', key: 'd', mods: { win: true } },
                          { label: 'Win + Tab', key: 'tab', mods: { win: true } },
                          { label: 'Win + L', key: 'l', mods: { win: true } },
                          { label: 'Дисп. задач', key: 'esc', mods: { ctrl: true, shift: true } },
                        ].map((btn, idx) => (
                          <button
                            key={idx}
                            onClick={() => sendEvent({ event: 'keyboard_input', key: btn.key, type: 'press', modifiers: btn.mods })}
                            className="py-2 rounded-xl bg-black/5 dark:bg-white/5 active:bg-black/10 dark:active:bg-white/10 text-[10px] font-semibold text-[var(--text-primary)] transition-colors border border-black/5 dark:border-white/5"
                          >
                            {btn.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Master Volume Slider */}
                    <div className="flex flex-col gap-1.5 shrink-0">
                      <span className="text-xs font-semibold text-[#86868b]">Громкость ПК</span>
                      <div className="flex items-center gap-3 bg-black/5 dark:bg-white/5 p-2 rounded-xl border border-black/5 dark:border-white/5">
                        <Volume2 size={16} className="text-[#86868b]" />
                        <input
                          type="range"
                          min="0"
                          max="100"
                          defaultValue="50"
                          onChange={(e) => {
                            sendEvent({
                              event: 'volume_set',
                              level: parseInt(e.target.value)
                            });
                          }}
                          className="flex-1 h-1.5 bg-black/10 dark:bg-white/10 rounded-lg appearance-none cursor-pointer accent-blue-500"
                        />
                      </div>
                    </div>

                    {/* Media Controls */}
                    <div className="flex flex-col gap-1.5 shrink-0">
                      <span className="text-xs font-semibold text-[#86868b]">Плеер</span>
                      <div className="grid grid-cols-3 gap-2">
                        {[
                          { label: '⏮ Назад', key: 'left', icon: SkipBack },
                          { label: '⏯ Пауза', key: 'space', icon: Play },
                          { label: '⏭ Вперед', key: 'right', icon: SkipForward }
                        ].map((btn, idx) => (
                          <button
                            key={idx}
                            onClick={() => sendEvent({ event: 'keyboard_input', key: btn.key, type: 'press' })}
                            className="py-2 flex items-center justify-center gap-1 rounded-xl bg-black/5 dark:bg-white/5 active:bg-black/10 dark:active:bg-white/10 text-[10px] font-semibold text-[var(--text-primary)] border border-black/5 dark:border-white/5"
                          >
                            <btn.icon size={12} />
                            <span>{btn.label.split(' ')[1]}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </motion.div>
                )}

                {activeTab === 'files' && (
                  <motion.div 
                    key="files"
                    className="w-full aspect-[1.1] glass-card rounded-[36px] p-5 relative flex flex-col gap-3 overflow-hidden"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={springTransition}
                  >
                    <div className="flex items-center justify-between border-b border-black/5 dark:border-white/5 pb-2 shrink-0">
                      <div className="flex items-center gap-2 overflow-hidden flex-1">
                        {currentPath ? (
                          <button 
                            onClick={handleGoBack}
                            className="p-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 text-[var(--text-primary)]"
                          >
                            <ChevronLeft size={16} />
                          </button>
                        ) : (
                          <Folder size={16} className="text-[#86868b] shrink-0" />
                        )}
                        <span className="text-xs font-bold truncate text-[var(--text-primary)]">
                          {currentPath ? currentPath : 'Локальный ПК'}
                        </span>
                      </div>
                      <button
                        onClick={() => fetchFiles(currentPath)}
                        className="p-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 text-[#86868b] hover:text-[var(--text-primary)] shrink-0"
                      >
                        <RefreshCw size={14} className={isLoadingFiles ? "animate-spin" : ""} />
                      </button>
                    </div>

                    <div className="flex-1 overflow-y-auto pr-1 flex flex-col gap-1.5 scrollbar-thin">
                      {isLoadingFiles ? (
                        <div className="flex flex-col items-center justify-center py-10 gap-2">
                          <RefreshCw size={24} className="animate-spin text-[#86868b]" />
                          <span className="text-xs text-[#86868b]">Загрузка файлов...</span>
                        </div>
                      ) : files.length === 0 ? (
                        <div className="text-center py-10">
                          <span className="text-xs text-[#86868b]">Нет файлов или доступ ограничен</span>
                        </div>
                      ) : (
                        files.map((file, idx) => (
                          <div
                            key={idx}
                            onClick={() => file.is_dir ? fetchFiles(file.path) : handleOpenFile(file.path)}
                            className="flex items-center justify-between p-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer border border-transparent hover:border-black/5 dark:hover:border-white/5 transition-all active:scale-[0.99]"
                          >
                            <div className="flex items-center gap-2.5 overflow-hidden flex-1 pr-2">
                              {file.is_dir ? (
                                <Folder size={16} className="text-[#ffcc00] shrink-0 fill-[#ffcc00]/10" />
                              ) : (
                                <File size={16} className="text-[#0071e3] shrink-0 fill-[#0071e3]/10" />
                              )}
                              <span className="text-xs font-medium text-[var(--text-primary)] truncate">
                                {file.name}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              {!file.is_dir && (
                                <span className="text-[10px] text-[#86868b] font-mono">
                                  {formatFileSize(file.size)}
                                </span>
                              )}
                              {file.is_dir && (
                                <ChevronRight size={12} className="text-[#86868b]" />
                              )}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </motion.div>
                )}

                {activeTab === 'apps' && (
                  <motion.div 
                    key="apps"
                    className="w-full aspect-[1.1] glass-card rounded-[36px] p-5 relative flex flex-col gap-3 overflow-hidden"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={springTransition}
                  >
                    {/* Mode selector */}
                    <div className="flex items-center justify-between p-1 bg-black/5 dark:bg-white/5 rounded-xl shrink-0">
                      <button
                        onClick={() => setAppsMode('launch')}
                        className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                          appsMode === 'launch'
                            ? 'bg-white dark:bg-white/10 text-black dark:text-white shadow-sm'
                            : 'text-[#86868b] hover:text-[var(--text-primary)]'
                        }`}
                      >
                        Запуск
                      </button>
                      <button
                        onClick={() => setAppsMode('processes')}
                        className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                          appsMode === 'processes'
                            ? 'bg-white dark:bg-white/10 text-black dark:text-white shadow-sm'
                            : 'text-[#86868b] hover:text-[var(--text-primary)]'
                        }`}
                      >
                        Процессы
                      </button>
                    </div>

                    {/* Search Bar */}
                    <div className="relative flex items-center shrink-0">
                      <Search size={14} className="absolute left-3 text-[#86868b] pointer-events-none" />
                      <input
                        type="text"
                        placeholder={appsMode === 'launch' ? 'Поиск программ...' : 'Поиск процессов...'}
                        value={appSearchQuery}
                        onChange={(e) => setAppSearchQuery(e.target.value)}
                        className="w-full bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-xl pl-9 pr-3 py-2 text-xs focus:outline-none focus:border-blue-500 text-[var(--text-primary)]"
                      />
                      {appSearchQuery && (
                        <button 
                          onClick={() => setAppSearchQuery('')}
                          className="absolute right-3 text-[#86868b] hover:text-[var(--text-primary)]"
                        >
                          <X size={14} />
                        </button>
                      )}
                    </div>

                    {/* Scrolled list */}
                    <div className="flex-1 overflow-y-auto pr-1 flex flex-col gap-1.5 scrollbar-thin">
                      {isLoadingApps ? (
                        <div className="flex flex-col items-center justify-center py-10 gap-2">
                          <RefreshCw size={24} className="animate-spin text-[#86868b]" />
                          <span className="text-xs text-[#86868b]">Загрузка...</span>
                        </div>
                      ) : appsMode === 'launch' ? (
                        (() => {
                          const filtered = scannedApps.filter(app => 
                            app.name.toLowerCase().includes(appSearchQuery.toLowerCase())
                          );
                          if (filtered.length === 0) {
                            return (
                              <div className="text-center py-10 text-xs text-[#86868b]">
                                Программы не найдены
                              </div>
                            );
                          }
                          return filtered.map((app, idx) => (
                            <div
                              key={idx}
                              onClick={() => handleLaunchApp(app.path)}
                              className="flex items-center justify-between p-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer border border-transparent hover:border-black/5 dark:hover:border-white/5 transition-all active:scale-[0.99]"
                            >
                              <div className="flex items-center gap-2.5 overflow-hidden flex-1">
                                {app.icon ? (
                                  <img
                                    src={`data:image/png;base64,${app.icon}`}
                                    alt={app.name}
                                    className="w-7 h-7 rounded-lg object-contain shrink-0"
                                  />
                                ) : (
                                  <div className="w-7 h-7 rounded-lg bg-blue-500/10 text-blue-500 flex items-center justify-center shrink-0">
                                    <Monitor size={14} />
                                  </div>
                                )}
                                <div className="flex flex-col overflow-hidden">
                                  <span className="text-xs font-semibold text-[var(--text-primary)] truncate">
                                    {app.name}
                                  </span>
                                  <span className="text-[9px] text-[#86868b] truncate font-mono">
                                    {app.path}
                                  </span>
                                </div>
                              </div>
                              <ChevronRight size={12} className="text-[#86868b] shrink-0 ml-1" />
                            </div>
                          ));
                        })()
                      ) : (
                        (() => {
                          const filtered = runningProcesses.filter(proc => 
                            proc.title.toLowerCase().includes(appSearchQuery.toLowerCase())
                          );
                          if (filtered.length === 0) {
                            return (
                              <div className="text-center py-10 text-xs text-[#86868b]">
                                Активные процессы не найдены
                              </div>
                            );
                          }
                          return filtered.map((proc, idx) => (
                            <div
                              key={idx}
                              className="flex items-center justify-between p-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 border border-transparent hover:border-black/5 dark:hover:border-white/5 transition-all"
                            >
                              <div className="flex flex-col overflow-hidden flex-1 pr-2">
                                <span className="text-xs font-semibold text-[var(--text-primary)] truncate">
                                  {proc.title}
                                </span>
                                <span className="text-[9px] text-[#86868b] font-mono">
                                  PID: {proc.pid}
                                </span>
                              </div>
                              <button
                                onClick={() => handleKillProcess(proc.hwnd, proc.pid)}
                                className="bg-red-500/10 hover:bg-red-500/20 text-red-500 text-[10px] font-bold px-2.5 py-1 rounded-lg transition-colors shrink-0 active:scale-[0.97]"
                              >
                                Закрыть
                              </button>
                            </div>
                          ));
                        })()
                      )}
                    </div>
                  </motion.div>
                )}

                {activeTab === 'stats' && (
                  <motion.div 
                    key="stats"
                    className="w-full aspect-[1.1] glass-card rounded-[36px] p-5 relative flex flex-col gap-3 overflow-hidden"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={springTransition}
                  >
                    <div className="flex items-center justify-between border-b border-black/5 dark:border-white/5 pb-2 shrink-0">
                      <span className="text-xs font-bold text-[var(--text-primary)]">Мониторинг ресурсов</span>
                      <button
                        onClick={fetchSystemStats}
                        className="p-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 text-[#86868b] hover:text-[var(--text-primary)] shrink-0"
                      >
                        <RefreshCw size={14} className={isLoadingStats ? "animate-spin" : ""} />
                      </button>
                    </div>

                    <div className="flex-1 overflow-y-auto pr-1 flex flex-col gap-4 scrollbar-thin">
                      {isLoadingStats && !systemStats ? (
                        <div className="flex flex-col items-center justify-center py-10 gap-2">
                          <RefreshCw size={24} className="animate-spin text-[#86868b]" />
                          <span className="text-xs text-[#86868b]">Получение данных...</span>
                        </div>
                      ) : !systemStats ? (
                        <div className="text-center py-10 text-xs text-[#86868b]">
                          Не удалось загрузить данные
                        </div>
                      ) : (
                        <>
                          {/* Hardware Resources Grid */}
                          <div className="grid grid-cols-3 gap-3">
                            {/* CPU */}
                            <div className="bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/5 p-3 rounded-2xl flex flex-col items-center text-center">
                              <span className="text-[10px] font-bold text-[#86868b] uppercase">CPU</span>
                              <div className="relative w-12 h-12 flex items-center justify-center mt-2">
                                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                                  <path className="text-black/10 dark:text-white/10" strokeWidth="3.5" stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                                  <path className="text-blue-500 transition-all duration-500" strokeDasharray={`${systemStats.cpu_percent}, 100`} strokeWidth="3.5" strokeLinecap="round" stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                                </svg>
                                <span className="absolute text-[10px] font-bold text-[var(--text-primary)]">{Math.round(systemStats.cpu_percent)}%</span>
                              </div>
                            </div>

                            {/* RAM */}
                            <div className="bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/5 p-3 rounded-2xl flex flex-col items-center text-center">
                              <span className="text-[10px] font-bold text-[#86868b] uppercase">RAM</span>
                              <div className="relative w-12 h-12 flex items-center justify-center mt-2">
                                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                                  <path className="text-black/10 dark:text-white/10" strokeWidth="3.5" stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                                  <path className="text-emerald-500 transition-all duration-500" strokeDasharray={`${systemStats.ram_percent}, 100`} strokeWidth="3.5" strokeLinecap="round" stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                                </svg>
                                <span className="absolute text-[10px] font-bold text-[var(--text-primary)]">{Math.round(systemStats.ram_percent)}%</span>
                              </div>
                              <span className="text-[8px] text-[#86868b] mt-1.5 font-mono">{systemStats.ram_used_gb}/{systemStats.ram_total_gb} GB</span>
                            </div>

                            {/* Battery or Disk */}
                            {systemStats.battery_percent !== null ? (
                              <div className="bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/5 p-3 rounded-2xl flex flex-col items-center text-center">
                                <span className="text-[10px] font-bold text-[#86868b] uppercase flex items-center gap-1">
                                  {systemStats.battery_plugged ? <BatteryCharging size={10} className="text-emerald-500 animate-pulse" /> : <Battery size={10} />}
                                  АКБ
                                </span>
                                <div className="relative w-12 h-12 flex items-center justify-center mt-2">
                                  <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                                    <path className="text-black/10 dark:text-white/10" strokeWidth="3.5" stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                                    <path className="text-yellow-500 transition-all duration-500" strokeDasharray={`${systemStats.battery_percent}, 100`} strokeWidth="3.5" strokeLinecap="round" stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                                  </svg>
                                  <span className="absolute text-[10px] font-bold text-[var(--text-primary)]">{systemStats.battery_percent}%</span>
                                </div>
                                <span className="text-[8px] text-[#86868b] mt-1.5 font-semibold">
                                  {systemStats.battery_plugged ? 'Зарядка' : 'Разрядка'}
                                </span>
                              </div>
                            ) : (
                              <div className="bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/5 p-3 rounded-2xl flex flex-col items-center text-center">
                                <span className="text-[10px] font-bold text-[#86868b] uppercase">Disk C:</span>
                                <div className="relative w-12 h-12 flex items-center justify-center mt-2">
                                  <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                                    <path className="text-black/10 dark:text-white/10" strokeWidth="3.5" stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                                    <path className="text-purple-500 transition-all duration-500" strokeDasharray={`${systemStats.disk_percent}, 100`} strokeWidth="3.5" strokeLinecap="round" stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                                  </svg>
                                  <span className="absolute text-[10px] font-bold text-[var(--text-primary)]">{Math.round(systemStats.disk_percent)}%</span>
                                </div>
                                <span className="text-[8px] text-[#86868b] mt-1.5 font-mono">{systemStats.disk_used_gb}/{systemStats.disk_total_gb} GB</span>
                              </div>
                            )}
                          </div>

                          {/* Brightness Control Slider */}
                          <div className="flex flex-col gap-1.5 shrink-0">
                            <span className="text-xs font-semibold text-[#86868b]">Яркость экрана ПК</span>
                            <div className="flex items-center gap-3 bg-black/5 dark:bg-white/5 p-2 rounded-xl border border-black/5 dark:border-white/5">
                              <Sun size={16} className="text-[#86868b]" />
                              <input
                                type="range"
                                min="0"
                                max="100"
                                defaultValue="80"
                                onChange={(e) => {
                                  handleSetBrightness(parseInt(e.target.value));
                                }}
                                className="flex-1 h-1.5 bg-black/10 dark:bg-white/10 rounded-lg appearance-none cursor-pointer accent-blue-500"
                              />
                            </div>
                          </div>

                          {/* Specifications & Info */}
                          <div className="bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/5 p-3.5 rounded-2xl flex flex-col gap-1.5 text-xs text-[var(--text-primary)] leading-normal">
                            <div className="flex justify-between items-center text-[10px] text-[#86868b] border-b border-black/5 dark:border-white/5 pb-1 uppercase font-bold tracking-wider">
                              <span>Параметры системы</span>
                              <span>Orbit Agent</span>
                            </div>
                            <div className="flex justify-between mt-1"><span className="text-[#86868b]">Имя ПК:</span><span className="font-semibold font-mono">{systemStats.hostname}</span></div>
                            <div className="flex justify-between"><span className="text-[#86868b]">ОС:</span><span className="font-semibold">{systemStats.os_name}</span></div>
                            <div className="flex justify-between overflow-hidden"><span className="text-[#86868b] shrink-0">Процессор:</span><span className="font-semibold truncate max-w-[150px] text-right" title={systemStats.cpu_name}>{systemStats.cpu_name}</span></div>
                            <div className="flex justify-between"><span className="text-[#86868b]">Uptime:</span><span className="font-semibold">
                              {(() => {
                                const h = Math.floor(systemStats.uptime_seconds / 3600);
                                const m = Math.floor((systemStats.uptime_seconds % 3600) / 60);
                                return `${h} ч ${m} мин`;
                              })()}
                            </span></div>
                          </div>

                          {/* System Macros Utility Grid */}
                          <div className="flex flex-col gap-1.5">
                            <span className="text-xs font-bold text-[#86868b]">Системные утилиты</span>
                            <div className="grid grid-cols-3 gap-2">
                              <button
                                onClick={handleMonitorOff}
                                className="py-2.5 rounded-xl bg-black/5 dark:bg-white/5 active:bg-black/10 dark:active:bg-white/10 text-[10px] font-semibold text-[var(--text-primary)] transition-colors border border-black/5 dark:border-white/5 flex flex-col items-center justify-center gap-1 active:scale-[0.98]"
                              >
                                <Tv size={14} className="text-purple-500" />
                                <span>Выкл. Экран</span>
                              </button>

                              <button
                                onClick={handleToggleMute}
                                className="py-2.5 rounded-xl bg-black/5 dark:bg-white/5 active:bg-black/10 dark:active:bg-white/10 text-[10px] font-semibold text-[var(--text-primary)] transition-colors border border-black/5 dark:border-white/5 flex flex-col items-center justify-center gap-1 active:scale-[0.98]"
                              >
                                <Volume2 size={14} className="text-emerald-500" />
                                <span>Без Звука</span>
                              </button>

                              <button
                                onClick={handleEmptyRecycleBin}
                                className="py-2.5 rounded-xl bg-black/5 dark:bg-white/5 active:bg-black/10 dark:active:bg-white/10 text-[10px] font-semibold text-[var(--text-primary)] transition-colors border border-black/5 dark:border-white/5 flex flex-col items-center justify-center gap-1 active:scale-[0.98]"
                              >
                                <X size={14} className="text-red-500" />
                                <span>Очистить корзину</span>
                              </button>
                            </div>

                            {/* Alert Notification Sender */}
                            <div className="flex gap-1.5 mt-1 bg-black/5 dark:bg-white/5 p-2 rounded-2xl border border-black/5 dark:border-white/5">
                              <input
                                type="text"
                                placeholder="Отправить alert на ПК..."
                                value={alertText}
                                onChange={(e) => setAlertText(e.target.value)}
                                className="flex-1 bg-transparent border-none text-xs focus:outline-none text-[var(--text-primary)] placeholder-[#86868b]"
                              />
                              <button
                                onClick={handleSendNotification}
                                className="px-3 py-1 bg-blue-500 hover:bg-blue-600 text-white font-bold rounded-lg text-[10px] transition-colors active:scale-[0.96]"
                              >
                                Послать
                              </button>
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  </motion.div>
                )}

                {activeTab === 'gamepad' && (
                  <motion.div 
                    key="gamepad"
                    className="w-full aspect-[1.1] glass-card rounded-[36px] p-5 relative flex flex-col justify-between select-none"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={springTransition}
                  >
                    {/* Top Bumpers */}
                    <div className="flex justify-between w-full px-2 shrink-0">
                      <button
                        onTouchStart={() => sendEvent({ event: 'keyboard_input', key: 'q', type: 'keydown' })}
                        onTouchEnd={() => sendEvent({ event: 'keyboard_input', key: 'q', type: 'keyup' })}
                        onMouseDown={() => sendEvent({ event: 'keyboard_input', key: 'q', type: 'keydown' })}
                        onMouseUp={() => sendEvent({ event: 'keyboard_input', key: 'q', type: 'keyup' })}
                        className="px-6 py-2 rounded-xl bg-black/10 dark:bg-white/10 active:bg-black/20 dark:active:bg-white/20 text-xs font-bold text-[var(--text-primary)] border border-black/5 dark:border-white/5"
                      >
                        L
                      </button>
                      <button
                        onTouchStart={() => sendEvent({ event: 'keyboard_input', key: 'e', type: 'keydown' })}
                        onTouchEnd={() => sendEvent({ event: 'keyboard_input', key: 'e', type: 'keyup' })}
                        onMouseDown={() => sendEvent({ event: 'keyboard_input', key: 'e', type: 'keydown' })}
                        onMouseUp={() => sendEvent({ event: 'keyboard_input', key: 'e', type: 'keyup' })}
                        className="px-6 py-2 rounded-xl bg-black/10 dark:bg-white/10 active:bg-black/20 dark:active:bg-white/20 text-xs font-bold text-[var(--text-primary)] border border-black/5 dark:border-white/5"
                      >
                        R
                      </button>
                    </div>

                    {/* Main Gamepad Area */}
                    <div className="flex-1 flex items-center justify-between my-2 px-1">
                      {/* D-Pad (Cross buttons) */}
                      <div className="relative w-28 h-28 flex items-center justify-center shrink-0">
                        <div className="absolute w-8 h-24 bg-black/5 dark:bg-white/5 rounded-lg border border-black/5 dark:border-white/5"></div>
                        <div className="absolute w-24 h-8 bg-black/5 dark:bg-white/5 rounded-lg border border-black/5 dark:border-white/5"></div>
                        
                        {/* D-PAD buttons */}
                        <button
                          onTouchStart={() => sendEvent({ event: 'keyboard_input', key: 'up', type: 'keydown' })}
                          onTouchEnd={() => sendEvent({ event: 'keyboard_input', key: 'up', type: 'keyup' })}
                          onMouseDown={() => sendEvent({ event: 'keyboard_input', key: 'up', type: 'keydown' })}
                          onMouseUp={() => sendEvent({ event: 'keyboard_input', key: 'up', type: 'keyup' })}
                          className="absolute top-0 w-8 h-8 flex items-center justify-center text-[var(--text-primary)] active:bg-blue-500/20 rounded-t-lg"
                        >
                          ▲
                        </button>
                        <button
                          onTouchStart={() => sendEvent({ event: 'keyboard_input', key: 'down', type: 'keydown' })}
                          onTouchEnd={() => sendEvent({ event: 'keyboard_input', key: 'down', type: 'keyup' })}
                          onMouseDown={() => sendEvent({ event: 'keyboard_input', key: 'down', type: 'keydown' })}
                          onMouseUp={() => sendEvent({ event: 'keyboard_input', key: 'down', type: 'keyup' })}
                          className="absolute bottom-0 w-8 h-8 flex items-center justify-center text-[var(--text-primary)] active:bg-blue-500/20 rounded-b-lg"
                        >
                          ▼
                        </button>
                        <button
                          onTouchStart={() => sendEvent({ event: 'keyboard_input', key: 'left', type: 'keydown' })}
                          onTouchEnd={() => sendEvent({ event: 'keyboard_input', key: 'left', type: 'keyup' })}
                          onMouseDown={() => sendEvent({ event: 'keyboard_input', key: 'left', type: 'keydown' })}
                          onMouseUp={() => sendEvent({ event: 'keyboard_input', key: 'left', type: 'keyup' })}
                          className="absolute left-0 w-8 h-8 flex items-center justify-center text-[var(--text-primary)] active:bg-blue-500/20 rounded-l-lg"
                        >
                          ◀
                        </button>
                        <button
                          onTouchStart={() => sendEvent({ event: 'keyboard_input', key: 'right', type: 'keydown' })}
                          onTouchEnd={() => sendEvent({ event: 'keyboard_input', key: 'right', type: 'keyup' })}
                          onMouseDown={() => sendEvent({ event: 'keyboard_input', key: 'right', type: 'keydown' })}
                          onMouseUp={() => sendEvent({ event: 'keyboard_input', key: 'right', type: 'keyup' })}
                          className="absolute right-0 w-8 h-8 flex items-center justify-center text-[var(--text-primary)] active:bg-blue-500/20 rounded-r-lg"
                        >
                          ▶
                        </button>
                      </div>

                      {/* Action buttons (XYAB) */}
                      <div className="relative w-28 h-28 flex items-center justify-center shrink-0">
                        {/* Y (top) */}
                        <button
                          onTouchStart={() => sendEvent({ event: 'keyboard_input', key: 'v', type: 'keydown' })}
                          onTouchEnd={() => sendEvent({ event: 'keyboard_input', key: 'v', type: 'keyup' })}
                          onMouseDown={() => sendEvent({ event: 'keyboard_input', key: 'v', type: 'keydown' })}
                          onMouseUp={() => sendEvent({ event: 'keyboard_input', key: 'v', type: 'keyup' })}
                          className="absolute top-0 w-8 h-8 rounded-full bg-yellow-500/80 active:bg-yellow-600 text-white font-bold text-xs shadow-sm flex items-center justify-center"
                        >
                          Y
                        </button>
                        {/* A (bottom) */}
                        <button
                          onTouchStart={() => sendEvent({ event: 'keyboard_input', key: 'z', type: 'keydown' })}
                          onTouchEnd={() => sendEvent({ event: 'keyboard_input', key: 'z', type: 'keyup' })}
                          onMouseDown={() => sendEvent({ event: 'keyboard_input', key: 'z', type: 'keydown' })}
                          onMouseUp={() => sendEvent({ event: 'keyboard_input', key: 'z', type: 'keyup' })}
                          className="absolute bottom-0 w-8 h-8 rounded-full bg-green-500/80 active:bg-green-600 text-white font-bold text-xs shadow-sm flex items-center justify-center"
                        >
                          A
                        </button>
                        {/* X (left) */}
                        <button
                          onTouchStart={() => sendEvent({ event: 'keyboard_input', key: 'c', type: 'keydown' })}
                          onTouchEnd={() => sendEvent({ event: 'keyboard_input', key: 'c', type: 'keyup' })}
                          onMouseDown={() => sendEvent({ event: 'keyboard_input', key: 'c', type: 'keydown' })}
                          onMouseUp={() => sendEvent({ event: 'keyboard_input', key: 'c', type: 'keyup' })}
                          className="absolute left-0 w-8 h-8 rounded-full bg-blue-500/80 active:bg-blue-600 text-white font-bold text-xs shadow-sm flex items-center justify-center"
                        >
                          X
                        </button>
                        {/* B (right) */}
                        <button
                          onTouchStart={() => sendEvent({ event: 'keyboard_input', key: 'x', type: 'keydown' })}
                          onTouchEnd={() => sendEvent({ event: 'keyboard_input', key: 'x', type: 'keyup' })}
                          onMouseDown={() => sendEvent({ event: 'keyboard_input', key: 'x', type: 'keydown' })}
                          onMouseUp={() => sendEvent({ event: 'keyboard_input', key: 'x', type: 'keyup' })}
                          className="absolute right-0 w-8 h-8 rounded-full bg-red-500/80 active:bg-red-600 text-white font-bold text-xs shadow-sm flex items-center justify-center"
                        >
                          B
                        </button>
                      </div>
                    </div>

                    {/* Select / Start Center row */}
                    <div className="flex justify-center gap-6 pb-2 w-full shrink-0">
                      <div className="flex flex-col items-center gap-0.5">
                        <button
                          onTouchStart={() => sendEvent({ event: 'keyboard_input', key: 'space', type: 'keydown' })}
                          onTouchEnd={() => sendEvent({ event: 'keyboard_input', key: 'space', type: 'keyup' })}
                          onMouseDown={() => sendEvent({ event: 'keyboard_input', key: 'space', type: 'keydown' })}
                          onMouseUp={() => sendEvent({ event: 'keyboard_input', key: 'space', type: 'keyup' })}
                          className="w-10 h-3 rounded-full bg-black/20 dark:bg-white/20 active:bg-black/30 dark:active:bg-white/30"
                        />
                        <span className="text-[8px] font-bold text-[#86868b] uppercase">Select</span>
                      </div>
                      <div className="flex flex-col items-center gap-0.5">
                        <button
                          onTouchStart={() => sendEvent({ event: 'keyboard_input', key: 'enter', type: 'keydown' })}
                          onTouchEnd={() => sendEvent({ event: 'keyboard_input', key: 'enter', type: 'keyup' })}
                          onMouseDown={() => sendEvent({ event: 'keyboard_input', key: 'enter', type: 'keydown' })}
                          onMouseUp={() => sendEvent({ event: 'keyboard_input', key: 'enter', type: 'keyup' })}
                          className="w-10 h-3 rounded-full bg-black/20 dark:bg-white/20 active:bg-black/30 dark:active:bg-white/30"
                        />
                        <span className="text-[8px] font-bold text-[#86868b] uppercase">Start</span>
                      </div>
                    </div>
                  </motion.div>
                )}

                {activeTab === 'terminal' && (
                  <motion.div 
                    key="terminal"
                    className="w-full aspect-[1.1] glass-card rounded-[36px] p-5 relative flex flex-col gap-3 overflow-hidden"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={springTransition}
                  >
                    <div className="flex items-center justify-between border-b border-black/5 dark:border-white/5 pb-2 shrink-0">
                      <span className="text-xs font-bold text-[var(--text-primary)] flex items-center gap-1.5">
                        <Terminal size={14} className="text-emerald-500" />
                        Консоль CMD/PowerShell
                      </span>
                      {terminalHistory.length > 0 && (
                        <button
                          onClick={() => setTerminalHistory([])}
                          className="text-[9px] font-bold text-red-500 hover:text-red-600 bg-red-500/10 px-2 py-0.5 rounded"
                        >
                          Очистить
                        </button>
                      )}
                    </div>

                    {/* Monospace Output Screen */}
                    <div className="flex-1 bg-black/90 rounded-2xl p-3 font-mono text-[9px] text-emerald-400 overflow-y-auto flex flex-col gap-2 border border-black/10">
                      {terminalHistory.length === 0 ? (
                        <span className="text-gray-500">// Введите команду ниже и нажмите Выполнить...</span>
                      ) : (
                        terminalHistory.map((item, idx) => (
                          <div key={idx} className="flex flex-col gap-0.5 border-b border-white/5 pb-1">
                            <span className="text-white font-semibold">C:\Users\PC&gt; {item.cmd}</span>
                            {item.out && <span className="whitespace-pre-wrap">{item.out}</span>}
                            {item.err && <span className="text-red-400 whitespace-pre-wrap">{item.err}</span>}
                            <span className="text-gray-400 text-[8px]">Выполнено с кодом {item.code}</span>
                          </div>
                        ))
                      )}
                    </div>

                    {/* Input Field and Execution controls */}
                    <div className="flex gap-2 shrink-0">
                      <input
                        type="text"
                        placeholder="Введите команду (например, ipconfig)..."
                        value={terminalCommand}
                        onChange={(e) => setTerminalCommand(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !isRunningCommand) {
                            handleRunTerminalCommand();
                          }
                        }}
                        disabled={isRunningCommand}
                        className="flex-1 bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-blue-500 text-[var(--text-primary)]"
                      />
                      <button
                        onClick={handleRunTerminalCommand}
                        disabled={isRunningCommand || !terminalCommand.trim()}
                        className="px-4 py-2 bg-blue-500 hover:bg-blue-600 disabled:bg-blue-500/40 text-white font-bold rounded-xl text-xs transition-colors shrink-0 active:scale-[0.97]"
                      >
                        {isRunningCommand ? 'Запуск...' : 'Запуск'}
                      </button>
                    </div>
                  </motion.div>
                )}

                {activeTab === 'presenter' && (
                  <motion.div 
                    key="presenter"
                    className="w-full aspect-[1.1] glass-card rounded-[36px] p-5 relative flex flex-col justify-between"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={springTransition}
                  >
                    {/* Header with Title and Stopwatch Timer */}
                    <div className="flex items-center justify-between border-b border-black/5 dark:border-white/5 pb-2 shrink-0">
                      <span className="text-xs font-bold text-[var(--text-primary)] flex items-center gap-1.5">
                        <Presentation size={14} className="text-blue-500" />
                        Режим презентации
                      </span>
                      
                      {/* Timer Display */}
                      <div className="flex items-center gap-2 bg-black/5 dark:bg-white/5 px-2.5 py-1 rounded-xl border border-black/5 dark:border-white/5 font-mono text-xs font-bold text-[var(--text-primary)]">
                        <span>
                          {(() => {
                            const min = Math.floor(presenterTime / 60);
                            const sec = presenterTime % 60;
                            return `${min.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
                          })()}
                        </span>
                        <button
                          onClick={() => setIsTimerRunning(!isTimerRunning)}
                          className={`w-2 h-2 rounded-full ${isTimerRunning ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}
                        />
                        {presenterTime > 0 && (
                          <button
                            onClick={() => {
                              setIsTimerRunning(false);
                              setPresenterTime(0);
                            }}
                            className="text-[8px] bg-red-500/10 text-red-500 px-1 py-0.5 rounded font-bold"
                          >
                            Сброс
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Giant Presentation slide navigation buttons */}
                    <div className="flex-1 flex gap-3 my-3">
                      <button
                        onClick={() => sendEvent({ event: 'keyboard_input', key: 'pageup', type: 'press' })}
                        className="flex-1 rounded-[24px] bg-black/5 dark:bg-white/5 active:bg-black/10 dark:active:bg-white/10 text-xs font-bold text-[var(--text-primary)] border border-black/5 dark:border-white/5 flex flex-col items-center justify-center gap-1 active:scale-[0.98] transition-all"
                      >
                        <span className="text-xl">◀</span>
                        <span>Назад</span>
                      </button>
                      <button
                        onClick={() => sendEvent({ event: 'keyboard_input', key: 'pagedown', type: 'press' })}
                        className="flex-1 rounded-[24px] bg-blue-500/10 dark:bg-blue-500/20 active:bg-blue-500/20 border border-blue-500/20 text-blue-500 font-bold text-xs flex flex-col items-center justify-center gap-1 active:scale-[0.98] transition-all"
                      >
                        <span className="text-xl">▶</span>
                        <span>Вперед</span>
                      </button>
                    </div>

                    {/* Additional helper buttons */}
                    <div className="grid grid-cols-2 gap-2 shrink-0">
                      <button
                        onClick={() => sendEvent({ event: 'keyboard_input', key: 'f5', type: 'press' })}
                        className="py-2.5 rounded-xl bg-black/5 dark:bg-white/5 active:bg-black/10 dark:active:bg-white/10 text-[10px] font-bold text-[var(--text-primary)] border border-black/5 dark:border-white/5"
                      >
                        Запуск (F5)
                      </button>
                      <button
                        onClick={() => sendEvent({ event: 'keyboard_input', key: 'esc', type: 'press' })}
                        className="py-2.5 rounded-xl bg-black/5 dark:bg-white/5 active:bg-black/10 dark:active:bg-white/10 text-[10px] font-bold text-[var(--text-primary)] border border-black/5 dark:border-white/5"
                      >
                        Закрыть (Esc)
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* 4. MOUSE BUTTONS */}
            <div className="grid grid-cols-3 gap-3 mb-5">
              <motion.button 
                className="glass-card rounded-[22px] py-4 flex flex-col items-center justify-center gap-1.5"
                onClick={() => sendEvent({ event: 'mouse_click', button: 'left', type: 'click' })}
                {...buttonPress}
              >
                <MousePointer size={18} className="text-[#1d1d1f] dark:text-white" />
                <span className="text-[11px] font-semibold text-[#86868b]">Левая</span>
              </motion.button>
              
              <motion.button 
                className="glass-card rounded-[22px] py-4 flex flex-col items-center justify-center gap-1.5"
                onClick={() => sendEvent({ event: 'mouse_click', button: 'middle', type: 'click' })}
                {...buttonPress}
              >
                <Sliders size={18} className="text-[#1d1d1f] dark:text-white" />
                <span className="text-[11px] font-semibold text-[#86868b]">Колесико</span>
              </motion.button>

              <motion.button 
                className="glass-card rounded-[22px] py-4 flex flex-col items-center justify-center gap-1.5"
                onClick={() => sendEvent({ event: 'mouse_click', button: 'right', type: 'click' })}
                {...buttonPress}
              >
                <MousePointer size={18} className="text-[#1d1d1f] dark:text-white scale-x-[-1]" />
                <span className="text-[11px] font-semibold text-[#86868b]">Правая</span>
              </motion.button>
            </div>

            {/* 5. POWER SYSTEM CONTROLS */}
            <div className="grid grid-cols-4 gap-3 mb-5">
              {[
                { label: 'Выключить', icon: Power, color: 'text-[#ff3b30] bg-[#ff3b30]/10', action: () => sendEvent({ event: 'system_cmd', cmd: 'shutdown' }) },
                { label: 'Сон', icon: Moon, color: 'text-[#af52de] bg-[#af52de]/10', action: () => sendEvent({ event: 'system_cmd', cmd: 'sleep' }) },
                { label: 'Перезагрузка', icon: RotateCw, color: 'text-[#34c759] bg-[#34c759]/10', action: () => sendEvent({ event: 'system_cmd', cmd: 'restart' }) },
                { label: 'Рабочий стол', icon: Tv, color: 'text-[#0071e3] bg-[#0071e3]/10', action: () => sendEvent({ event: 'system_cmd', cmd: 'desktop' }) }
              ].map((action, idx) => (
                <motion.button 
                  key={idx}
                  className="glass-card rounded-[22px] p-3 flex flex-col items-center justify-center gap-2 aspect-square"
                  onClick={action.action}
                  {...buttonPress}
                >
                  <div className={`p-2.5 rounded-full ${action.color}`}>
                    <action.icon size={16} strokeWidth={2.5} />
                  </div>
                  <span className="text-[10px] font-semibold text-[var(--text-primary)] truncate w-full text-center">
                    {action.label}
                  </span>
                </motion.button>
              ))}
            </div>

            {/* 6. CONNECTED HOST SUMMARY CARD */}
            <motion.div 
              className="glass-card rounded-[26px] p-4 flex items-center justify-between mb-6 cursor-pointer hover:border-apple-blue/20 transition-colors"
              onClick={() => setShowPairing(true)}
              {...buttonPress}
            >
              {activeDevice ? (
                <div className="flex items-center gap-3">
                  <div className="w-14 h-10 rounded-lg bg-black flex items-center justify-center text-white relative overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-t from-blue-600/20 to-transparent"></div>
                    <div className="grid grid-cols-2 gap-0.5 w-4 h-4 opacity-80">
                      <div className="bg-white/90 w-1.5 h-1.5"></div>
                      <div className="bg-white/90 w-1.5 h-1.5"></div>
                      <div className="bg-white/90 w-1.5 h-1.5"></div>
                      <div className="bg-white/90 w-1.5 h-1.5"></div>
                    </div>
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-[var(--text-primary)]">{activeDevice.name}</h3>
                    <p className="text-[11px] text-[#86868b] font-medium">{activeDevice.osName}</p>
                    <p className="text-[10px] text-[#86868b] font-mono mt-0.5">{activeDevice.ipAddress}</p>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3 py-1">
                  <div className="w-10 h-10 rounded-xl bg-apple-blue/10 text-apple-blue flex items-center justify-center">
                    <Plus size={18} />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-[var(--text-primary)]">Добавить компьютер</h3>
                    <p className="text-[11px] text-[#86868b]">Нажмите, чтобы выполнить сопряжение</p>
                  </div>
                </div>
              )}
              <ChevronRight size={18} className="text-[#86868b]" />
            </motion.div>
          </>
        )}

        {activeNav === 'history' && (
          <motion.div 
            key="history-panel"
            className="flex-1 flex flex-col my-4 overflow-y-auto pr-1"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={springTransition}
          >
            <h2 className="text-lg font-bold text-[var(--text-primary)] mb-4">История подключений</h2>
            <div className="glass-card rounded-2xl p-6 text-center">
              <Clock size={36} className="text-[#86868b] mx-auto mb-3 opacity-60" />
              <p className="text-sm font-semibold text-[var(--text-primary)]">История пуста</p>
              <p className="text-xs text-[#86868b] mt-1">Здесь будут отображаться сессии вашего пульта.</p>
            </div>
          </motion.div>
        )}

        {activeNav === 'settings' && (
          <motion.div 
            key="settings-panel"
            className="flex-1 flex flex-col my-4 overflow-y-auto pr-1 scrollbar-thin"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={springTransition}
          >
            <h2 className="text-lg font-bold text-[var(--text-primary)] mb-4">Настройки</h2>
            
            <div className="flex flex-col gap-4">
              {activeDevice && (
                <div className="glass-card rounded-2xl p-4 flex flex-col gap-2">
                  <h3 className="text-[11px] font-semibold text-[#86868b] uppercase tracking-wider">Текущий ПК</h3>
                  <div className="flex justify-between items-center text-xs mt-1">
                    <span className="text-[#86868b]">Имя:</span>
                    <span className="font-semibold text-[var(--text-primary)]">{activeDevice.name}</span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-[#86868b]">IP-адрес:</span>
                    <span className="font-mono text-[var(--text-primary)]">{activeDevice.ipAddress}</span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-[#86868b]">MAC-адрес:</span>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[var(--text-primary)]">{activeDevice.macAddress}</span>
                      <button 
                        onClick={() => {
                          navigator.clipboard.writeText(activeDevice.macAddress);
                          alert('MAC-адрес скопирован в буфер обмена!');
                        }}
                        className="text-[10px] bg-white/20 dark:bg-white/10 hover:bg-white/30 text-[var(--text-primary)] px-2 py-0.5 rounded font-semibold transition-colors"
                      >
                        Копировать
                      </button>
                    </div>
                  </div>
                </div>
              )}
              
              <div className="glass-card rounded-2xl p-4 flex flex-col gap-3">
                <h3 className="text-[11px] font-semibold text-[#86868b] uppercase tracking-wider">Команда Siri / Wake-on-LAN</h3>
                <p className="text-xs text-[var(--text-primary)] leading-relaxed">
                  Вы можете включать ПК голосом через Siri без сторонних программ, используя стандартное приложение «Быстрые команды» iOS.
                </p>
                
                <div className="flex flex-col gap-2 mt-1">
                  <h4 className="text-[11px] font-bold text-[var(--text-primary)]">Способ 1: Роутер по SSH (Без сторонних программ)</h4>
                  <p className="text-[10px] text-[#86868b] leading-normal">
                    1. Включите SSH-доступ в настройках вашего роутера (Keenetic, ASUS, OpenWrt и др.).<br/>
                    2. В iOS-приложении «Быстрые команды» добавьте действие <b>«Запустить скрипт по SSH»</b>.<br/>
                    3. Укажите IP-адрес роутера (обычно <code>192.168.1.1</code>) и данные авторизации роутера.<br/>
                    4. Вставьте команду пробуждения вашего ПК:
                  </p>
                  <input 
                    type="text" 
                    readOnly 
                    value={activeDevice ? `ether-wake ${activeDevice.macAddress}` : 'ether-wake MAC_ADDRESS'} 
                    className="w-full text-[10px] bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-lg p-2 font-mono text-[var(--text-primary)] focus:outline-none"
                    onClick={(e) => {
                      e.currentTarget.select();
                      navigator.clipboard.writeText(e.currentTarget.value);
                      alert('Команда SSH скопирована!');
                    }}
                  />
                  <p className="text-[9px] text-[#86868b] leading-normal mt-0.5">
                    *Для роутеров Keenetic используйте: <code>ip hotspot wake {activeDevice?.macAddress || 'MAC'}</code> или <code>wol wake {activeDevice?.macAddress || 'MAC'}</code>.
                  </p>
                  <a
                    href="shortcuts://"
                    className="mt-2 text-center text-xs bg-blue-500 hover:bg-blue-600 text-white font-semibold py-2 px-4 rounded-xl transition-colors inline-block"
                  >
                    Открыть Быстрые команды
                  </a>
                </div>
                
                <div className="border-t border-black/10 dark:border-white/10 my-1"></div>
                
                <div className="flex flex-col gap-2">
                  <h4 className="text-[11px] font-bold text-[var(--text-primary)]">Способ 2: Веб-запрос (для умного дома или серверов)</h4>
                  <p className="text-[10px] text-[#86868b] leading-normal">
                    Если у вас настроена розетка умного дома или есть сторонний сервер, отправьте POST-запрос на:
                  </p>
                  <input 
                    type="text" 
                    readOnly 
                    value={activeDevice ? `${activeDevice.ipAddress}/api/v1/system/wol` : ''} 
                    className="w-full text-[10px] bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-lg p-2 font-mono text-[var(--text-primary)] focus:outline-none"
                    onClick={(e) => {
                      e.currentTarget.select();
                      navigator.clipboard.writeText(e.currentTarget.value);
                      alert('Ссылка на WoL API скопирована!');
                    }}
                  />
                  <p className="text-[9px] text-[#86868b]">
                    Тело запроса (JSON): <code>{"{"}"mac_address": "{activeDevice?.macAddress || 'MAC'}"{"}"}</code>
                  </p>
                </div>
              </div>
              
              <div className="glass-card rounded-2xl p-4 flex justify-between items-center mb-2">
                <div>
                  <h3 className="text-[11px] font-semibold text-[#86868b] uppercase tracking-wider">Привязка</h3>
                  <p className="text-xs text-[#86868b]">Удалить текущий ПК</p>
                </div>
                <button 
                  onClick={async () => {
                    if (confirm('Удалить сопряженное устройство? Вы будете автоматически перенаправлены на экран сопряжения.')) {
                      await db.devices.clear();
                      window.location.reload();
                    }
                  }}
                  className="bg-red-500/10 hover:bg-red-500/20 text-red-500 px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors"
                >
                  Сбросить
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {/* 7. BOTTOM TAB NAVIGATION BAR */}
        <div className="glass-card rounded-[28px] p-2 flex items-center justify-between">
          {[
            { id: 'apps', icon: LayoutGrid },
            { id: 'history', icon: Clock },
            { id: 'settings', icon: Settings }
          ].map((navItem) => (
            <motion.button
              key={navItem.id}
              onClick={() => setActiveNav(navItem.id as any)}
              className="relative py-2.5 px-6 rounded-[20px] transition-all flex items-center justify-center"
              {...buttonPress}
            >
              {activeNav === navItem.id && (
                <motion.div
                  layoutId="activeNavIndicator"
                  className="absolute inset-0 bg-white dark:bg-white/10 rounded-[20px] shadow-sm"
                  transition={springTransition}
                />
              )}
              <navItem.icon 
                size={20} 
                className={`relative z-10 transition-colors duration-300 ${
                  activeNav === navItem.id 
                    ? 'text-black dark:text-white' 
                    : 'text-[#86868b]'
                }`} 
              />
            </motion.button>
          ))}
        </div>

      </div>

      {/* Pairing Wizard Overlay Modal */}
      <AnimatePresence>
        {showPairing && (
          <PairingFlow 
            onClose={() => setShowPairing(false)} 
            onSuccess={() => console.log('Устройство успешно сопряжено.')} 
          />
        )}
      </AnimatePresence>
    </div>
  );
}

import { useState, useRef, useEffect } from 'react';
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
  LayoutGrid, 
  Clock, 
  Settings,
  Sliders,
  Plus
} from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState<'remote' | 'screen' | 'keyboard' | 'media'>('remote');
  const [activeNav, setActiveNav] = useState<'apps' | 'history' | 'settings'>('apps');
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [showPairing, setShowPairing] = useState(false);

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

  // Screen stream touch handlers
  const screenTouchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const screenLastTapTimeRef = useRef<number>(0);

  const handleScreenTouchStart = (e: React.TouchEvent<HTMLImageElement>) => {
    if (!activeDevice || !isAuthorized) return;
    e.preventDefault();
    
    const touches = e.touches;
    if (touches.length === 1) {
      const touch = touches[0];
      const rect = e.currentTarget.getBoundingClientRect();
      const x = (touch.clientX - rect.left) / rect.width;
      const y = (touch.clientY - rect.top) / rect.height;
      
      screenTouchStartRef.current = { x: touch.clientX, y: touch.clientY, time: Date.now() };
      sendEvent({ event: 'mouse_absolute', x, y });
    }
  };

  const handleScreenTouchMove = (e: React.TouchEvent<HTMLImageElement>) => {
    if (!activeDevice || !isAuthorized) return;
    e.preventDefault();
    
    const touches = e.touches;
    if (touches.length === 1) {
      const touch = touches[0];
      const rect = e.currentTarget.getBoundingClientRect();
      const x = (touch.clientX - rect.left) / rect.width;
      const y = (touch.clientY - rect.top) / rect.height;
      
      if (x >= 0 && x <= 1 && y >= 0 && y <= 1) {
        sendEvent({ event: 'mouse_absolute', x, y });
      }
    }
  };

  const handleScreenTouchEnd = (e: React.TouchEvent<HTMLImageElement>) => {
    if (!activeDevice || !isAuthorized) return;
    e.preventDefault();
    
    const start = screenTouchStartRef.current;
    if (!start) return;
    
    const changedTouches = e.changedTouches;
    if (changedTouches.length === 1) {
      const touch = changedTouches[0];
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
    }
    
    if (e.touches.length === 0 && e.changedTouches.length === 2) {
      sendEvent({ event: 'mouse_click', button: 'right', type: 'click' });
    }
    
    screenTouchStartRef.current = null;
  };

  const handleScreenMouseDown = (e: React.MouseEvent<HTMLImageElement>) => {
    if (!activeDevice || !isAuthorized) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    
    sendEvent({ event: 'mouse_absolute', x, y });
    const btn = e.button === 2 ? 'right' : 'left';
    sendEvent({ event: 'mouse_click', button: btn, type: 'click' });
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
    { id: 'keyboard', label: 'Клавиатура' },
    { id: 'media', label: 'Медиа' }
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
            <div className="flex items-center justify-between bg-black/5 dark:bg-white/5 p-1 rounded-2xl mt-5">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className="relative flex-1 py-2 text-xs font-medium rounded-xl transition-all duration-300"
                >
                  {activeTab === tab.id && (
                    <motion.div
                      layoutId="activeTabIndicator"
                      className="absolute inset-0 bg-black dark:bg-white rounded-xl shadow-sm"
                      transition={springTransition}
                    />
                  )}
                  <span className={`relative z-10 transition-colors duration-300 ${
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
                    className="w-full aspect-[1.1] glass-card rounded-[36px] overflow-hidden relative flex flex-col items-center justify-center"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={springTransition}
                  >
                    {activeDevice && isAuthorized ? (
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
                    className="w-full aspect-[1.1] glass-card rounded-[36px] p-6 relative flex flex-col justify-between"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={springTransition}
                  >
                    <div className="flex-1 flex flex-col gap-3">
                      <h3 className="text-sm font-semibold text-[var(--text-primary)]">Ввод текста</h3>
                      <input
                        type="text"
                        placeholder="Нажмите для ввода текста..."
                        className="w-full bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-500 text-[var(--text-primary)]"
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
                      <p className="text-[11px] text-[#86868b] leading-relaxed">
                        Клавиатурный ввод отправляется на ПК в реальном времени. Работают все клавиши, включая Backspace, стрелочки и Enter.
                      </p>
                    </div>
                    <div className="grid grid-cols-4 gap-2 mt-4">
                      {[
                        { label: 'Esc', key: 'esc' },
                        { label: '⌫', key: 'backspace' },
                        { label: '⏎ Enter', key: 'enter' },
                        { label: 'Space', key: 'space' },
                      ].map((btn) => (
                        <button
                          key={btn.key}
                          onClick={() => sendEvent({ event: 'keyboard_input', key: btn.key, type: 'press' })}
                          className="py-2.5 rounded-xl bg-black/5 dark:bg-white/5 active:bg-black/10 dark:active:bg-white/10 text-xs font-semibold text-[var(--text-primary)]"
                        >
                          {btn.label}
                        </button>
                      ))}
                    </div>
                  </motion.div>
                )}

                {activeTab === 'media' && (
                  <motion.div 
                    key="media"
                    className="w-full aspect-[1.1] glass-card rounded-[36px] p-6 relative flex flex-col justify-between"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={springTransition}
                  >
                    <div className="flex-1 flex flex-col justify-center gap-6">
                      <div className="text-center">
                        <h3 className="text-sm font-semibold text-[var(--text-primary)]">Громкость</h3>
                        <p className="text-xs text-[#86868b] mt-1">Регулировка звука на ПК</p>
                      </div>
                      
                      <div className="flex items-center gap-4 px-2">
                        <Sliders size={18} className="text-[#86868b]" />
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
                    
                    <div className="grid grid-cols-3 gap-3">
                      {[
                        { label: '⏮ Назад', key: 'left' },
                        { label: '⏯ Пауза', key: 'space' },
                        { label: '⏭ Вперед', key: 'right' }
                      ].map((btn) => (
                        <button
                          key={btn.key}
                          onClick={() => sendEvent({ event: 'keyboard_input', key: btn.key, type: 'press' })}
                          className="py-3 rounded-xl bg-black/5 dark:bg-white/5 active:bg-black/10 dark:active:bg-white/10 text-xs font-semibold text-[var(--text-primary)]"
                        >
                          {btn.label}
                        </button>
                      ))}
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

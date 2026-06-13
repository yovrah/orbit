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
  const [activeTab, setActiveTab] = useState<'remote' | 'keyboard' | 'media' | 'files'>('remote');
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
        const count = await db.devices.count();
        if (count === 0) {
          const protocol = window.location.protocol;
          await db.devices.add({
            uuid: 'local-auto-paired-uuid',
            name: 'Этот Компьютер',
            ipAddress: `${protocol}//${hostname}:${port}`,
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
    { id: 'keyboard', label: 'Клавиатура' },
    { id: 'media', label: 'Медиа' },
    { id: 'files', label: 'Файлы' }
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

        {/* 3. TOUCHPAD AREA */}
        <div className="flex-1 flex flex-col justify-center my-6">
          <motion.div 
            ref={touchpadRef}
            className={`w-full aspect-[1.1] glass-card rounded-[36px] p-6 relative overflow-hidden dotted-grid flex flex-col items-center justify-center ${
              activeDevice && isAuthorized ? 'cursor-none active:scale-[0.99] transition-transform duration-150' : 'opacity-60 pointer-events-none'
            }`}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
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

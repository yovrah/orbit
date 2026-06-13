import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useDiscovery, type DiscoveredDevice } from '../hooks/useDiscovery';
import { db } from '../db/clientDb';
import { 
  Plus, 
  Search, 
  RefreshCw, 
  ShieldAlert, 
  Laptop,
  CheckCircle,
  X
} from 'lucide-react';

interface PairingFlowProps {
  onClose: () => void;
  onSuccess: () => void;
}

export default function PairingFlow({ onClose, onSuccess }: PairingFlowProps) {
  const { isScanning, discoveredDevices, scanSubnet } = useDiscovery();
  const [manualIp, setManualIp] = useState('');
  const [pin, setPin] = useState('');
  const [pairingDevice, setPairingDevice] = useState<DiscoveredDevice | null>(null);
  const [sessionToken, setSessionToken] = useState('');
  const [step, setStep] = useState<'select' | 'pin' | 'success' | 'error'>('select');
  const [errorMessage, setErrorMessage] = useState('');

  const getBaseUrl = (ipOrUrl: string) => {
    const trimmed = ipOrUrl.trim();
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      return trimmed;
    }
    return `http://${trimmed}:23810`;
  };

  const handleManualAdd = async () => {
    if (!manualIp) return;
    try {
      setErrorMessage('');
      const targetUrl = getBaseUrl(manualIp);
      const res = await fetch(`${targetUrl}/api/v1/ping`);
      const data = await res.json();
      if (data.status === 'online') {
        initiatePairing({
          ip: targetUrl,
          port: 23810,
          name: data.agent_name,
          os: data.os,
          version: data.version,
          paired: data.paired
        });
      } else {
        throw new Error('Устройство не в сети');
      }
    } catch (err: any) {
      setStep('error');
      setErrorMessage('Не удалось подключиться к указанному хосту. Убедитесь, что Orbit Agent запущен.');
    }
  };

  const initiatePairing = async (device: DiscoveredDevice) => {
    setPairingDevice(device);
    try {
      setErrorMessage('');
      const clientUuid = window.crypto.randomUUID();
      const mockPublicKey = "ECDSA_PUB_KEY_" + clientUuid;

      const targetUrl = getBaseUrl(device.ip);
      const res = await fetch(`${targetUrl}/api/v1/pair/initiate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: clientUuid,
          client_name: 'PWA Web Controller',
          client_public_key: mockPublicKey
        })
      });

      if (!res.ok) throw new Error('Сбой инициализации сопряжения');

      const data = await res.json();
      if (data.status === 'pending_pin') {
        setSessionToken(data.pairing_session_token);
        setStep('pin');
      }
    } catch (err: any) {
      setStep('error');
      setErrorMessage(err.message || 'Ошибка подключения к агенту.');
    }
  };

  const verifyPin = async () => {
    if (!pairingDevice || !pin) return;
    try {
      setErrorMessage('');
      const targetUrl = getBaseUrl(pairingDevice.ip);
      const res = await fetch(`${targetUrl}/api/v1/pair/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pairing_session_token: sessionToken,
          pin: pin
        })
      });

      if (!res.ok) {
        throw new Error('Неверный PIN-код сопряжения');
      }

      const data = await res.json();
      if (data.status === 'paired') {
        // Save to client Dexie db
        await db.devices.add({
          uuid: sessionToken,
          name: pairingDevice.name,
          ipAddress: targetUrl,
          port: pairingDevice.port,
          macAddress: '00:00:00:00:00:00',
          osName: pairingDevice.os,
          osVersion: pairingDevice.version,
          sharedSecret: data.encrypted_shared_secret,
          isPaired: true,
          lastConnected: new Date()
        });

        setStep('success');
      }
    } catch (err: any) {
      setStep('error');
      setErrorMessage(err.message || 'Ошибка проверки PIN-кода.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-md">
      <motion.div 
        className="w-full max-w-[390px] rounded-[32px] glass-card p-6 flex flex-col justify-between overflow-hidden relative"
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
      >
        
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-[var(--text-primary)]">
            {step === 'select' && 'Добавить PC'}
            {step === 'pin' && 'Введите PIN'}
            {step === 'success' && 'Успешно'}
            {step === 'error' && 'Ошибка'}
          </h2>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/5 text-[#86868b]">
            <X size={18} />
          </button>
        </div>

        <AnimatePresence mode="wait">
          {step === 'select' && (
            <motion.div 
              key="select"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              className="flex flex-col gap-4"
            >
              {/* Manual IP Input */}
              <div className="flex gap-2">
                <input 
                  type="text" 
                  value={manualIp}
                  onChange={(e) => setManualIp(e.target.value)}
                  placeholder="Введите IP (например: 192.168.1.100)" 
                  className="flex-1 px-4 py-3 rounded-xl bg-black/5 dark:bg-white/5 border border-transparent dark:border-white/5 text-sm focus:outline-none focus:border-apple-blue text-[var(--text-primary)]"
                />
                <button 
                  onClick={handleManualAdd}
                  className="p-3 rounded-xl bg-black dark:bg-white text-white dark:text-black hover:opacity-90 flex items-center justify-center"
                >
                  <Plus size={18} />
                </button>
              </div>

              {/* Discovery sweep bar */}
              <div className="flex items-center justify-between mt-2">
                <span className="text-xs font-semibold text-[#86868b]">Устройства в локальной сети</span>
                <button 
                  onClick={() => scanSubnet()} 
                  disabled={isScanning}
                  className={`p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/5 text-apple-blue ${isScanning ? 'animate-spin' : ''}`}
                >
                  <RefreshCw size={15} />
                </button>
              </div>

              {/* Scanned Devices List */}
              <div className="max-h-[200px] overflow-y-auto flex flex-col gap-2">
                {discoveredDevices.length === 0 ? (
                  <div className="py-8 text-center text-xs text-[#86868b] border border-dashed border-black/10 dark:border-white/10 rounded-2xl flex flex-col items-center gap-2">
                    <Search size={22} className="opacity-50" />
                    <span>Нажмите обновить для сканирования сети</span>
                  </div>
                ) : (
                  discoveredDevices.map((dev, idx) => (
                    <div 
                      key={idx}
                      onClick={() => initiatePairing(dev)}
                      className="p-3 rounded-2xl bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 flex items-center justify-between cursor-pointer border border-transparent hover:border-black/5 transition-all"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-apple-blue/10 text-apple-blue flex items-center justify-center">
                          <Laptop size={18} />
                        </div>
                        <div>
                          <h4 className="text-xs font-bold text-[var(--text-primary)]">{dev.name}</h4>
                          <span className="text-[10px] text-[#86868b]">{dev.ip}</span>
                        </div>
                      </div>
                      <span className="text-[10px] font-semibold text-apple-blue bg-apple-blue/10 px-2 py-1 rounded-full">
                        Pair
                      </span>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          )}

          {step === 'pin' && (
            <motion.div 
              key="pin"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              className="text-center flex flex-col items-center gap-4 py-4"
            >
              <p className="text-xs text-[#86868b] max-w-[240px]">
                Введите 6-значный код сопряжения, отображаемый на экране компьютера <strong>{pairingDevice?.name}</strong>
              </p>
              
              <input 
                type="text" 
                maxLength={6}
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                placeholder="000000"
                className="text-center text-3xl font-bold tracking-[8px] w-48 py-2 border-b-2 border-apple-blue bg-transparent text-[var(--text-primary)] focus:outline-none"
              />

              <button 
                onClick={verifyPin}
                className="w-full mt-4 py-3 rounded-xl bg-black dark:bg-white text-white dark:text-black font-semibold text-sm hover:opacity-90"
              >
                Подтвердить
              </button>
            </motion.div>
          )}

          {step === 'success' && (
            <motion.div 
              key="success"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="text-center py-6 flex flex-col items-center gap-3"
            >
              <CheckCircle size={48} className="text-[#34c759] shadow-sm" />
              <p className="text-sm font-bold text-[var(--text-primary)]">Устройство успешно подключено!</p>
              <button 
                onClick={() => {
                  onSuccess();
                  onClose();
                }}
                className="mt-4 px-6 py-2.5 rounded-xl bg-black dark:bg-white text-white dark:text-black font-semibold text-xs"
              >
                Готово
              </button>
            </motion.div>
          )}

          {step === 'error' && (
            <motion.div 
              key="error"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="text-center py-4 flex flex-col items-center gap-3"
            >
              <ShieldAlert size={40} className="text-apple-red" />
              <p className="text-xs text-[#ff3b30] max-w-[250px] font-medium leading-relaxed">{errorMessage}</p>
              <button 
                onClick={() => setStep('select')}
                className="mt-4 px-6 py-2 rounded-xl bg-black/5 dark:bg-white/5 text-[var(--text-primary)] font-semibold text-xs hover:bg-black/10"
              >
                Назад
              </button>
            </motion.div>
          )}
        </AnimatePresence>

      </motion.div>
    </div>
  );
}

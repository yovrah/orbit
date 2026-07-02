import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { QrCode, MonitorSmartphone, Mouse } from 'lucide-react';
import { db } from '../db/clientDb';

const SEEN_KEY = 'onboarding_seen';

interface OnboardingProps {
  onScanQr: () => void;
}

const STEPS = [
  { icon: MonitorSmartphone, text: 'Run Orbit Agent on your Windows PC' },
  { icon: QrCode, text: 'Scan the QR code it shows on screen' },
  { icon: Mouse, text: 'Control the mouse, screen and files instantly' },
];

/** One-time full-screen welcome shown before the very first pairing. Mounted
 * only while there are zero known devices, so a returning user never risks
 * seeing it flash — see the mount condition in App.tsx. */
export function Onboarding({ onScanQr }: OnboardingProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    db.settings.get(SEEN_KEY).then((row) => {
      if (!row?.value) setVisible(true);
    });
  }, []);

  const dismiss = () => {
    setVisible(false);
    db.settings.put({ key: SEEN_KEY, value: 'true' });
  };

  if (!visible) return null;

  return (
    <motion.div
      className="fixed inset-0 z-[70] flex flex-col items-center justify-center gap-8 px-8"
      style={{ background: 'var(--phone-bg)' }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <img src="icons/icon-512x512.png" alt="Orbit" className="onboard-mark" width={84} height={84} />

      <div className="text-center flex flex-col gap-2">
        <h1 className="m-0 text-2xl font-black text-var-ink">Your PC. In your hand.</h1>
        <p className="m-0 text-sm text-[#8c94a0] font-bold">Get set up in three quick steps</p>
      </div>

      <div className="flex flex-col gap-4 w-full max-w-[320px]">
        {STEPS.map(({ icon: Icon, text }, i) => (
          <div key={i} className="flex items-center gap-3">
            <span className="onboard-step-ico">
              <Icon size={18} />
            </span>
            <span className="text-sm font-bold text-var-ink">{text}</span>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-3 w-full max-w-[320px]">
        <button
          type="button"
          onClick={() => {
            dismiss();
            onScanQr();
          }}
          className="bg-[#007aff] text-white font-black text-sm py-3.5 rounded-2xl active:scale-95 transition-transform shadow-lg shadow-blue-500/20"
        >
          Scan QR Code
        </button>
        <button type="button" onClick={dismiss} className="text-[#8c94a0] font-bold text-xs py-2">
          Skip for now
        </button>
      </div>
    </motion.div>
  );
}

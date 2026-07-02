import { motion } from 'framer-motion';
import { Coffee, Zap, X } from 'lucide-react';
import { Portal } from '../../components/Portal';

const BMC_URL = 'https://buymeacoffee.com/yovrah';

interface WakeOnLanSheetProps {
  onClose: () => void;
}

/** Shown when the user taps "Power On PC". Honest explainer: the web version
 * can't send Wake-on-LAN packets — the native iOS app will. Doubles as the
 * support-the-project pitch. */
export function WakeOnLanSheet({ onClose }: WakeOnLanSheetProps) {
  return (
    <Portal>
    <motion.div
      className="fixed inset-0 z-[70] bg-slate-950/40 backdrop-blur-md flex items-end justify-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="w-full max-w-[430px] rounded-t-[32px] p-6 pb-8 flex flex-col gap-4 bg-[var(--phone-bg)] border border-black/5"
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', stiffness: 360, damping: 36 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-start">
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-[#007aff]/10 text-[#007aff]">
            <Zap size={22} />
          </span>
          <button
            type="button"
            onClick={onClose}
            className="grid h-9 w-9 place-items-center rounded-full bg-black/5 text-[#6e7682]"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <div>
          <h2 className="m-0 text-xl font-black text-var-ink">Turning the PC on isn't possible yet</h2>
          <p className="mt-2 mb-0 text-[13px] leading-relaxed font-semibold text-[#8c94a0]">
            Orbit currently runs as a web app, and browsers can't send the Wake-on-LAN packets
            needed to power a PC on. A native iOS app with one-tap Power On is in development —
            it just needs an Apple Developer account and an App Store release.
          </p>
          <p className="mt-2 mb-0 text-[13px] leading-relaxed font-semibold text-[#8c94a0]">
            If you'd like that to happen sooner, you can support the project:
          </p>
        </div>

        <button
          type="button"
          className="flex items-center justify-center gap-2 h-12 rounded-2xl bg-[#ffdd00] text-[#0d0c22] text-sm font-black active:scale-95 transition-transform"
          onClick={() => window.open(BMC_URL, '_blank', 'noopener')}
        >
          <Coffee size={17} />
          <span>Buy me a coffee</span>
        </button>

        <button
          type="button"
          className="h-11 rounded-2xl bg-black/5 text-var-ink text-sm font-bold active:scale-95 transition-transform"
          onClick={onClose}
        >
          Maybe later
        </button>
      </motion.div>
    </motion.div>
    </Portal>
  );
}

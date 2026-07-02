import { motion } from 'framer-motion';
import { AppWindow, Search, X } from 'lucide-react';
import { Portal } from '../../components/Portal';
import { Skeleton } from '../../components/Skeleton';
import { useApps } from '../pc/useApps';
import type { PinnedApp } from '../../types';

interface AppPickerProps {
  onPick: (app: PinnedApp) => void;
  onClose: () => void;
  /** Pinned Apps' "Add" flow both pins AND launches immediately; App Shortcut
   * just wants the choice recorded without side effects. Defaults to true to
   * preserve the original behavior. */
  launchOnPick?: boolean;
}

/** Bottom-sheet list of installed apps used to add a Dashboard shortcut. */
export function AppPicker({ onPick, onClose, launchOnPick = true }: AppPickerProps) {
  const { filtered, query, setQuery, launch, isLoading } = useApps();

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
        className="w-full max-w-[430px] rounded-t-[32px] p-5 flex flex-col gap-4 bg-[var(--phone-bg)] border border-black/5 max-h-[80dvh]"
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', stiffness: 360, damping: 36 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center">
          <div>
            <h2 className="m-0 text-xl font-black text-var-ink">Pin an app</h2>
            <span className="text-xs text-[#8c94a0] font-bold">Tap to add it to your Dashboard</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-9 w-9 place-items-center rounded-full bg-black/5 text-[#6e7682]"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <div className="search-box">
          <Search size={18} />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search apps" />
        </div>

        <div className="app-list overflow-y-auto" style={{ scrollbarWidth: 'none' }}>
          {isLoading ? (
            [0, 1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-center gap-3 p-2">
                <Skeleton style={{ width: 38, height: 38, borderRadius: 14, flexShrink: 0 }} />
                <Skeleton style={{ width: '55%', height: 12 }} />
              </div>
            ))
          ) : filtered.length ? (
            filtered.slice(0, 40).map((app, i) => (
              <button
                key={`${app.name}-${i}`}
                type="button"
                onClick={() => {
                  if (app.path) {
                    onPick({ name: app.name, path: app.path });
                    if (launchOnPick) launch(app.path);
                  }
                  onClose();
                }}
              >
                <span>
                  <AppWindow size={18} />
                </span>
                <strong>{app.name}</strong>
              </button>
            ))
          ) : (
            <div className="empty-state">No apps found</div>
          )}
        </div>
      </motion.div>
    </motion.div>
    </Portal>
  );
}

import { motion } from 'framer-motion';
import { X } from 'lucide-react';
import { Portal } from '../../../components/Portal';
import { QUICK_ACTION_CATALOG, resolveQuickActions } from './quickActions';
import type { QuickActionKey } from './quickActions';
import type { WidgetInstance } from './types';

interface QuickActionsConfigSheetProps {
  instance: WidgetInstance;
  onChange: (actions: QuickActionKey[]) => void;
  onClose: () => void;
}

/** iOS-style widget configuration: toggle which actions the Quick Actions
 * widget shows. Changes apply instantly (persisted per instance). */
export function QuickActionsConfigSheet({ instance, onChange, onClose }: QuickActionsConfigSheetProps) {
  const selected = resolveQuickActions(instance.config);

  const toggle = (key: QuickActionKey) => {
    const next = selected.includes(key)
      ? selected.filter((k) => k !== key)
      : // keep catalog order stable regardless of toggle order
        QUICK_ACTION_CATALOG.map((a) => a.key).filter((k) => k === key || selected.includes(k));
    if (next.length === 0) return; // an empty widget is useless — keep at least one
    onChange(next);
  };

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
        className="w-full max-w-[430px] rounded-t-[32px] p-5 pb-0 flex flex-col gap-3 bg-[var(--phone-bg)] border border-black/5"
        style={{ maxHeight: 'min(72dvh, calc(100dvh - 140px))' }}
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', stiffness: 360, damping: 36 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center" style={{ flexShrink: 0 }}>
          <div>
            <h2 className="m-0 text-xl font-black text-var-ink">Customize actions</h2>
            <span className="text-xs text-[#8c94a0] font-bold">Choose which buttons the widget shows</span>
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

        <div className="sheet-scroll-body" style={{ paddingBottom: 20 }}>
          <div className="set-group">
            {QUICK_ACTION_CATALOG.map((meta) => {
              const Icon = meta.icon;
              const on = selected.includes(meta.key);
              return (
                <button key={meta.key} type="button" className="set-row" onClick={() => toggle(meta.key)}>
                  <span className="r-ico">
                    <Icon size={16} />
                  </span>
                  <span className="r-name">{meta.label}</span>
                  <span className={`qa-switch ${on ? 'on' : ''}`} aria-hidden>
                    <i />
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </motion.div>
    </motion.div>
    </Portal>
  );
}

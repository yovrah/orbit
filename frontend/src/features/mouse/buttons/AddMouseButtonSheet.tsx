import { motion } from 'framer-motion';
import { X, ChevronRight } from 'lucide-react';
import { MOUSE_BUTTON_CATALOG } from './catalog';
import type { MouseButtonType } from './types';

interface AddMouseButtonSheetProps {
  existingTypes: MouseButtonType[];
  onAdd: (type: MouseButtonType) => void;
  onClose: () => void;
}

export function AddMouseButtonSheet({ existingTypes, onAdd, onClose }: AddMouseButtonSheetProps) {
  return (
    <motion.div
      className="fixed inset-0 z-[65] bg-slate-950/40 backdrop-blur-md flex items-end justify-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="w-full max-w-[430px] rounded-t-[32px] p-5 pb-0 flex flex-col gap-3 bg-[var(--phone-bg)] border border-black/5"
        style={{ maxHeight: 'min(70dvh, calc(100dvh - 140px))' }}
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', stiffness: 360, damping: 36 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center" style={{ flexShrink: 0 }}>
          <div>
            <h2 className="m-0 text-xl font-black text-var-ink">Add a button</h2>
            <span className="text-xs text-[#8c94a0] font-bold">Tap to add it to the trackpad panel</span>
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
            {MOUSE_BUTTON_CATALOG.map((meta) => {
              const disabled = existingTypes.includes(meta.type);
              const Icon = meta.icon;
              return (
                <button
                  key={meta.type}
                  type="button"
                  className="set-row"
                  disabled={disabled}
                  style={{ opacity: disabled ? 0.4 : 1 }}
                  onClick={() => {
                    onAdd(meta.type);
                    onClose();
                  }}
                >
                  <span className="r-ico">
                    <Icon size={16} />
                  </span>
                  <span className="r-name">{meta.label}</span>
                  {disabled ? <span className="r-val">Added</span> : <ChevronRight size={18} className="text-[#9aa3b0]" />}
                </button>
              );
            })}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

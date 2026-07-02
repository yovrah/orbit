import type { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { X, Send, Clipboard } from 'lucide-react';
import { MacrosTab } from '../macros/MacrosTab';
import { TerminalSection } from '../pc/TerminalSection';
import { ClipboardPanel } from '../control/ClipboardPanel';
import { useNotification } from '../control/useNotification';

export type ToolId = 'macros' | 'terminal' | 'clipboard' | 'message';

const spring = { type: 'spring', stiffness: 360, damping: 36 } as const;

const TITLES: Record<ToolId, { title: string; sub: string }> = {
  macros: { title: 'Automations', sub: 'Run command sequences on the PC' },
  terminal: { title: 'Terminal', sub: 'Execute a command on the PC' },
  clipboard: { title: 'Clipboard Sync', sub: 'Move text between phone and PC' },
  message: { title: 'Send Message', sub: 'Show a toast on the PC screen' },
};

interface SheetProps {
  title: string;
  sub: string;
  onClose: () => void;
  children: ReactNode;
}

function Sheet({ title, sub, onClose, children }: SheetProps) {
  return (
    <motion.div
      className="fixed inset-0 z-50 bg-slate-950/40 backdrop-blur-md flex items-end justify-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="w-full max-w-[430px] rounded-t-[32px] p-5 flex flex-col gap-4 bg-[var(--phone-bg)] border border-black/5 max-h-[90dvh] overflow-y-auto"
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={spring}
        onClick={(e) => e.stopPropagation()}
        style={{ scrollbarWidth: 'none' }}
      >
        <div className="flex justify-between items-center">
          <div>
            <h2 className="m-0 text-2xl font-black text-var-ink">{title}</h2>
            <span className="text-xs text-[#8c94a0] font-bold">{sub}</span>
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
        {children}
      </motion.div>
    </motion.div>
  );
}

function ClipboardTool() {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-1.5">
        <Clipboard size={16} className="text-[#007aff]" />
        <strong className="text-sm text-var-ink">Shared clipboard</strong>
      </div>
      <ClipboardPanel />
    </div>
  );
}

function MessageTool() {
  const notification = useNotification();
  return (
    <div className="command-box">
      <input
        value={notification.message}
        onChange={(e) => notification.setMessage(e.target.value)}
        placeholder="Show a message on PC..."
        onKeyDown={(e) => e.key === 'Enter' && notification.send()}
      />
      <button type="button" onClick={notification.send} aria-label="Send notification">
        <Send size={17} />
      </button>
    </div>
  );
}

interface ToolSheetsProps {
  tool: ToolId;
  onClose: () => void;
}

/** Hosts the secondary tools that don't live on a primary tab. */
export function ToolSheets({ tool, onClose }: ToolSheetsProps) {
  const meta = TITLES[tool];
  return (
    <Sheet title={meta.title} sub={meta.sub} onClose={onClose}>
      {tool === 'macros' && <MacrosTab />}
      {tool === 'terminal' && <TerminalSection />}
      {tool === 'clipboard' && <ClipboardTool />}
      {tool === 'message' && <MessageTool />}
    </Sheet>
  );
}

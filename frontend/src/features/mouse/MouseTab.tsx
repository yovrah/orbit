import { useState } from 'react';
import { motion } from 'framer-motion';
import { Mouse, Maximize2, Minimize2, Pencil, Check } from 'lucide-react';
import { ScreenHeader } from '../../components/ScreenHeader';
import { ConnectBanner } from '../../components/ConnectBanner';
import { OnScreenKeyboard } from '../../components/OnScreenKeyboard';
import { useOrbit } from '../../state/OrbitContext';
import { useTouchpad } from '../../hooks/useTouchpad';
import { MouseButtonPanel } from './buttons/MouseButtonPanel';

const spring = { type: 'spring', stiffness: 360, damping: 32, mass: 0.85 } as const;

export function MouseTab() {
  const { sendEvent, isReady, settings } = useOrbit();
  const [pad, setPad] = useState<HTMLDivElement | null>(null);
  const [surface, setSurface] = useState<HTMLDivElement | null>(null);
  const [showKeyboard, setShowKeyboard] = useState(false);
  const [editingButtons, setEditingButtons] = useState(false);
  const [cursor, setCursor] = useState<{ x: number; y: number } | null>(null);
  const [expanded, setExpanded] = useState(false);

  useTouchpad({
    element: surface,
    sendEvent,
    enabled: isReady,
    sensitivity: settings.sensitivity,
    scrollSensitivity: settings.scrollSensitivity,
    onPoint: setCursor,
  });

  // Same in-app immersive-mode approach as Stream — the native Fullscreen API
  // doesn't reliably work for arbitrary elements on iOS Safari/PWA.
  const enterExpanded = () => setExpanded(true);
  const exitExpanded = () => setExpanded(false);

  return (
    <motion.div
      key="mouse"
      className="screen"
      style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: '14px', overflow: 'hidden' }}
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={spring}
    >
      {!expanded && (
        <ScreenHeader
          icon={Mouse}
          title="Mouse"
          action={
            <div className="flex items-center gap-2">
              <button
                type="button"
                className={`h-act ${editingButtons ? 'on' : ''}`}
                onClick={() => setEditingButtons((v) => !v)}
                aria-label={editingButtons ? 'Done editing' : 'Edit buttons'}
              >
                {editingButtons ? <Check size={18} /> : <Pencil size={17} />}
              </button>
              {!editingButtons && (
                <button type="button" className="h-act" onClick={enterExpanded} aria-label="Fullscreen">
                  <Maximize2 size={18} />
                </button>
              )}
            </div>
          }
        />
      )}

      {!expanded && <ConnectBanner />}

      {/* Trackpad — the panel is a sibling overlay, never a descendant, so its
          taps can't be swallowed by the surface's own touch handlers. */}
      <div ref={setPad} className={`mouse-pad ${isReady ? '' : 'disabled'} ${expanded ? 'expanded' : ''}`}>
        <div ref={setSurface} className="mouse-pad-surface">
          <div className="pad-hint">
            <Mouse size={26} />
            <span>{isReady ? 'Move · tap · two-finger scroll' : 'Pairing required'}</span>
          </div>
          {cursor && <div className="pad-cursor" style={{ left: cursor.x, top: cursor.y }} />}
        </div>

        <MouseButtonPanel
          editing={editingButtons}
          showKeyboard={showKeyboard}
          onToggleKeyboard={() => setShowKeyboard((v) => !v)}
        />

        {expanded && (
          <button type="button" className="frame-exit" onClick={exitExpanded} aria-label="Exit fullscreen">
            <Minimize2 size={16} />
          </button>
        )}
      </div>

      {/* On-screen keyboard */}
      {showKeyboard && <OnScreenKeyboard />}
    </motion.div>
  );
}

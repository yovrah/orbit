import { useCallback, useRef, useState } from 'react';
import { ChevronUp, ChevronDown, Plus, X } from 'lucide-react';
import { useOrbit } from '../../../state/OrbitContext';
import { useMouseButtons } from './useMouseButtons';
import { getMouseButtonMeta } from './catalog';
import { AddMouseButtonSheet } from './AddMouseButtonSheet';
import type { MouseButtonInstance } from './types';

const SCROLL_STEP_MS = 60;
const SNAP_PX = 14;
const SNAP_GAP_PX = 10;

interface MouseButtonPanelProps {
  editing: boolean;
  showKeyboard: boolean;
  onToggleKeyboard: () => void;
}

interface DragState {
  id: string;
  offsetX: number;
  offsetY: number;
  halfW: number;
  halfH: number;
}

/** The floating control layer over the trackpad — a user-curated set of
 * buttons (keyboard toggle by default), freely draggable to any spot in edit
 * mode with magnetic snapping to neighboring buttons. Rendered as a sibling
 * of the touch surface (not a descendant) so taps here never get swallowed
 * by the trackpad's own touch handlers. */
export function MouseButtonPanel({ editing, showKeyboard, onToggleKeyboard }: MouseButtonPanelProps) {
  const { sendEvent } = useOrbit();
  const { buttons, addButton, removeButton, moveButton } = useMouseButtons();
  const [showAdd, setShowAdd] = useState(false);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [snapTargetId, setSnapTargetId] = useState<string | null>(null);
  const [livePos, setLivePos] = useState<{ x: number; y: number } | null>(null);
  const [dragLocked, setDragLocked] = useState(false);
  const scrollTimer = useRef<number | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const dragState = useRef<DragState | null>(null);

  const click = (button: 'left' | 'right' | 'middle') => sendEvent({ event: 'mouse_click', button, type: 'click' });

  const stopScroll = () => {
    if (scrollTimer.current !== null) {
      clearInterval(scrollTimer.current);
      scrollTimer.current = null;
    }
  };

  const startScroll = (dir: 1 | -1) => {
    stopScroll();
    sendEvent({ event: 'mouse_scroll', dx: 0, dy: dir });
    scrollTimer.current = window.setInterval(
      () => sendEvent({ event: 'mouse_scroll', dx: 0, dy: dir }),
      SCROLL_STEP_MS
    );
  };

  const toggleDragLock = () => {
    const next = !dragLocked;
    setDragLocked(next);
    sendEvent({ event: 'mouse_click', button: 'left', type: next ? 'down' : 'up' });
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>, b: MouseButtonInstance) => {
    if (!editing) return;
    const panel = panelRef.current;
    if (!panel) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const btnRect = e.currentTarget.getBoundingClientRect();
    dragState.current = {
      id: b.id,
      offsetX: e.clientX - (btnRect.left + btnRect.width / 2),
      offsetY: e.clientY - (btnRect.top + btnRect.height / 2),
      halfW: btnRect.width / 2,
      halfH: btnRect.height / 2,
    };
    setDraggingId(b.id);
  };

  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragState.current;
    const panel = panelRef.current;
    if (!drag || !panel) return;

    const rect = panel.getBoundingClientRect();
    let cx = e.clientX - drag.offsetX;
    let cy = e.clientY - drag.offsetY;

    cx = Math.min(Math.max(cx, rect.left + drag.halfW), rect.right - drag.halfW);
    cy = Math.min(Math.max(cy, rect.top + drag.halfH), rect.bottom - drag.halfH);

    let snapId: string | null = null;
    panel.querySelectorAll<HTMLElement>('[data-mbtn-id]').forEach((node) => {
      const id = node.dataset.mbtnId;
      if (!id || id === drag.id) return;
      const r = node.getBoundingClientRect();
      const otherCx = r.left + r.width / 2;
      const otherCy = r.top + r.height / 2;

      if (Math.abs(cx - otherCx) < SNAP_PX) {
        cx = otherCx;
        snapId = id;
      }
      const above = r.top - SNAP_GAP_PX - drag.halfH;
      const below = r.bottom + SNAP_GAP_PX + drag.halfH;
      if (Math.abs(cy - above) < SNAP_PX) {
        cy = above;
        snapId = id;
      } else if (Math.abs(cy - below) < SNAP_PX) {
        cy = below;
        snapId = id;
      } else if (Math.abs(cy - otherCy) < SNAP_PX) {
        cy = otherCy;
        snapId = id;
      }
    });

    setSnapTargetId(snapId);
    setLivePos({ x: ((cx - rect.left) / rect.width) * 100, y: ((cy - rect.top) / rect.height) * 100 });
  }, []);

  const endDrag = useCallback(() => {
    const drag = dragState.current;
    if (drag && livePos) moveButton(drag.id, livePos.x, livePos.y);
    dragState.current = null;
    setDraggingId(null);
    setSnapTargetId(null);
    setLivePos(null);
  }, [livePos, moveButton]);

  const renderButton = (instance: MouseButtonInstance) => {
    const meta = getMouseButtonMeta(instance.type);
    if (!meta) return null;
    const Icon = meta.icon;

    if (instance.type === 'scrollWheel') {
      return (
        <div className="mp-scroll">
          <button
            type="button"
            onPointerDown={() => startScroll(1)}
            onPointerUp={stopScroll}
            onPointerLeave={stopScroll}
            aria-label="Scroll up"
          >
            <ChevronUp size={20} />
          </button>
          <button
            type="button"
            onPointerDown={() => startScroll(-1)}
            onPointerUp={stopScroll}
            onPointerLeave={stopScroll}
            aria-label="Scroll down"
          >
            <ChevronDown size={20} />
          </button>
        </div>
      );
    }

    const isKeyboard = instance.type === 'keyboard';
    const isDragBtn = instance.type === 'dragLock';
    const active = isKeyboard ? showKeyboard : isDragBtn ? dragLocked : false;

    const run = () => {
      if (isKeyboard) return onToggleKeyboard();
      if (isDragBtn) return toggleDragLock();
      if (instance.type === 'leftClick') return click('left');
      if (instance.type === 'rightClick') return click('right');
      if (instance.type === 'middleClick') return click('middle');
    };

    return (
      <button type="button" className={`mp-btn-circle ${active ? 'active' : ''}`} onClick={run} aria-label={meta.label}>
        <Icon size={20} />
      </button>
    );
  };

  return (
    <>
      <div ref={panelRef} className="mouse-pad-panel">
        {buttons.map((b) => {
          const isDragging = draggingId === b.id;
          const pos = isDragging && livePos ? livePos : { x: b.x ?? 50, y: b.y ?? 85 };
          return (
            <div
              key={b.id}
              data-mbtn-id={b.id}
              className={`mp-btn ${isDragging ? 'dragging' : ''} ${snapTargetId === b.id ? 'snap-target' : ''}`}
              style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
              onPointerDown={(e) => handlePointerDown(e, b)}
              onPointerMove={handlePointerMove}
              onPointerUp={endDrag}
              onPointerCancel={endDrag}
            >
              <div className={`mp-btn-inner ${editing ? 'editing' : ''}`}>
                {editing && (
                  <button
                    type="button"
                    className="mp-remove"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeButton(b.id);
                    }}
                    aria-label="Remove button"
                  >
                    <X size={10} strokeWidth={3} />
                  </button>
                )}
                <div style={editing ? { pointerEvents: 'none' } : undefined}>{renderButton(b)}</div>
                <span className="mp-btn-label">{getMouseButtonMeta(b.type)?.label}</span>
              </div>
            </div>
          );
        })}

        {editing && (
          <button type="button" className="mp-add" onClick={() => setShowAdd(true)} aria-label="Add button">
            <Plus size={20} />
          </button>
        )}
      </div>

      {showAdd && (
        <AddMouseButtonSheet
          existingTypes={buttons.map((b) => b.type)}
          onAdd={addButton}
          onClose={() => setShowAdd(false)}
        />
      )}
    </>
  );
}

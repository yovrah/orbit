import { useRef, useState } from 'react';
import { motion, type PanInfo } from 'framer-motion';
import { X, Maximize2, Settings2 } from 'lucide-react';
import { WidgetRenderer } from './WidgetRenderer';
import { getWidgetMeta } from './catalog';
import type { WidgetInstance, WidgetSize } from './types';

const SIZE_SPAN: Record<WidgetSize, { col: number; row: number }> = {
  slim: { col: 1, row: 2 },
  '1x1': { col: 2, row: 1 },
  '1x2': { col: 2, row: 2 },
  '2x1': { col: 4, row: 1 },
  '2x2': { col: 4, row: 2 },
};

interface HomeGridProps {
  widgets: WidgetInstance[];
  editing: boolean;
  /** Persisting reorder — called once when a drag ends. */
  onReorder: (next: WidgetInstance[]) => void;
  /** In-memory reorder for live reflow during a drag (no DB write). */
  onReorderPreview: (next: WidgetInstance[]) => void;
  onRemove: (id: string) => void;
  onResize: (id: string, size: WidgetSize) => void;
  onConfigure: (id: string) => void;
  onNavigateStream: () => void;
  onPowerOn: () => void;
}

/** iOS-style widget grid: 4-column dense auto-flow. In edit mode every cell
 * jiggles and becomes draggable — dragging over a neighbor swaps it into that
 * slot immediately, with framer-motion's `layout` animating the reflow. */
export function HomeGrid({
  widgets,
  editing,
  onReorder,
  onReorderPreview,
  onRemove,
  onResize,
  onConfigure,
  onNavigateStream,
  onPowerOn,
}: HomeGridProps) {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const gridRef = useRef<HTMLDivElement | null>(null);

  const handleDrag = (id: string, info: PanInfo) => {
    // elementFromPoint would hit the dragged widget itself — it renders right
    // under the pointer (whileDrag lifts it to the top z-index). Walk the
    // full stack instead and skip past it to find the widget underneath.
    const stack = document.elementsFromPoint(info.point.x, info.point.y);
    const cell = stack
      .map((node) => node.closest<HTMLElement>('[data-widget-id]'))
      .find((node) => node && node.dataset.widgetId !== id);
    const targetId = cell?.dataset.widgetId;
    if (!targetId) return;

    const fromIndex = widgets.findIndex((w) => w.id === id);
    const toIndex = widgets.findIndex((w) => w.id === targetId);
    if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex) return;

    const next = [...widgets];
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);
    onReorderPreview(next);
  };

  return (
    <div ref={gridRef} className="widget-grid">
      {widgets.map((w, i) => {
        const span = SIZE_SPAN[w.size];
        const isDragging = draggingId === w.id;
        const meta = getWidgetMeta(w.type);
        const canResize = Boolean(meta && meta.allowedSizes.length > 1);

        const cycleSize = () => {
          if (!meta) return;
          const idx = meta.allowedSizes.indexOf(w.size);
          const next = meta.allowedSizes[(idx + 1) % meta.allowedSizes.length];
          onResize(w.id, next);
        };

        return (
          <motion.div
            key={w.id}
            layout={editing}
            initial={false}
            data-widget-id={w.id}
            className={`widget-cell ${editing ? 'editing' : ''} ${isDragging ? 'dragging' : ''}`}
            style={{
              gridColumn: `span ${span.col}`,
              gridRow: `span ${span.row}`,
              animationDelay: editing && !isDragging ? `${(i % 3) * 70}ms` : undefined,
            }}
            drag={editing}
            dragConstraints={gridRef}
            dragElastic={0.15}
            dragMomentum={false}
            dragSnapToOrigin
            whileDrag={{ scale: 1.1, zIndex: 20 }}
            onDragStart={() => setDraggingId(w.id)}
            onDrag={(_, info) => handleDrag(w.id, info)}
            onDragEnd={() => {
              setDraggingId(null);
              onReorder(widgets); // persist the final order once
            }}
            transition={{ type: 'spring', stiffness: 420, damping: 34 }}
          >
            {editing && (
              <button
                type="button"
                className="widget-remove"
                onClick={(e) => {
                  e.stopPropagation();
                  onRemove(w.id);
                }}
                aria-label="Remove widget"
              >
                <X size={12} strokeWidth={3} />
              </button>
            )}
            {editing && canResize && (
              <button
                type="button"
                className="widget-resize"
                onClick={(e) => {
                  e.stopPropagation();
                  cycleSize();
                }}
                aria-label="Resize widget"
              >
                <Maximize2 size={11} strokeWidth={3} />
              </button>
            )}
            {editing && meta?.configurable && (
              <button
                type="button"
                className={`widget-config ${canResize ? 'offset' : ''}`}
                onClick={(e) => {
                  e.stopPropagation();
                  onConfigure(w.id);
                }}
                aria-label="Configure widget"
              >
                <Settings2 size={11} strokeWidth={3} />
              </button>
            )}
            <WidgetRenderer
              instance={w}
              editing={editing}
              onNavigateStream={onNavigateStream}
              onPowerOn={onPowerOn}
            />
          </motion.div>
        );
      })}
    </div>
  );
}

import { useCallback, useEffect, useState } from 'react';
import { db } from '../../../db/clientDb';
import { DEFAULT_LAYOUT, getWidgetMeta } from './catalog';
import type { WidgetInstance, WidgetSize, WidgetType } from './types';

const LAYOUT_KEY = 'home_layout_v1';

/** Reconciles a persisted layout with the current catalog: drops widgets whose
 * type no longer exists and clamps sizes the type no longer supports (e.g. the
 * old 1x1 sliders become tall 1x2 pills). */
function migrate(list: WidgetInstance[]): WidgetInstance[] {
  return list
    .filter((w) => getWidgetMeta(w.type))
    .map((w) => {
      const meta = getWidgetMeta(w.type)!;
      return meta.allowedSizes.includes(w.size) ? w : { ...w, size: meta.defaultSize };
    });
}

function genId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

/** Persists the Home screen's widget grid (order, sizes, per-instance config)
 * to Dexie. Falls back to the pre-customization default layout on first run. */
export function useHomeLayout() {
  const [widgets, setWidgets] = useState<WidgetInstance[]>(DEFAULT_LAYOUT);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    db.settings.get(LAYOUT_KEY).then((row) => {
      if (row?.value) {
        try {
          const parsed = JSON.parse(row.value);
          if (Array.isArray(parsed) && parsed.length > 0) {
            const migrated = migrate(parsed);
            setWidgets(migrated.length > 0 ? migrated : DEFAULT_LAYOUT);
            if (JSON.stringify(migrated) !== JSON.stringify(parsed)) {
              db.settings.put({ key: LAYOUT_KEY, value: JSON.stringify(migrated) });
            }
          }
        } catch {
          /* corrupt value — keep default layout */
        }
      }
      setLoaded(true);
    });
  }, []);

  const persist = useCallback((next: WidgetInstance[]) => {
    setWidgets(next);
    db.settings.put({ key: LAYOUT_KEY, value: JSON.stringify(next) });
  }, []);

  const reorder = useCallback((next: WidgetInstance[]) => persist(next), [persist]);

  const addWidget = useCallback(
    (type: WidgetType, size: WidgetSize, config?: Record<string, unknown>) => {
      setWidgets((current) => {
        const next = [...current, { id: genId(), type, size, config }];
        db.settings.put({ key: LAYOUT_KEY, value: JSON.stringify(next) });
        return next;
      });
    },
    []
  );

  const removeWidget = useCallback((id: string) => {
    setWidgets((current) => {
      const next = current.filter((w) => w.id !== id);
      db.settings.put({ key: LAYOUT_KEY, value: JSON.stringify(next) });
      return next;
    });
  }, []);

  const resizeWidget = useCallback((id: string, size: WidgetSize) => {
    setWidgets((current) => {
      const next = current.map((w) => (w.id === id ? { ...w, size } : w));
      db.settings.put({ key: LAYOUT_KEY, value: JSON.stringify(next) });
      return next;
    });
  }, []);

  const updateWidgetConfig = useCallback((id: string, config: Record<string, unknown>) => {
    setWidgets((current) => {
      const next = current.map((w) => (w.id === id ? { ...w, config: { ...w.config, ...config } } : w));
      db.settings.put({ key: LAYOUT_KEY, value: JSON.stringify(next) });
      return next;
    });
  }, []);

  const resetLayout = useCallback(() => persist(DEFAULT_LAYOUT), [persist]);

  return { widgets, loaded, reorder, addWidget, removeWidget, resizeWidget, updateWidgetConfig, resetLayout };
}

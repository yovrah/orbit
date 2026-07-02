import { useCallback, useEffect, useState } from 'react';
import { db } from '../../../db/clientDb';
import { DEFAULT_MOUSE_BUTTONS, defaultButtonPosition } from './catalog';
import type { MouseButtonInstance, MouseButtonType } from './types';

const KEY = 'mouse_buttons_v1';

/** Fills in x/y for buttons saved before free positioning existed. */
function withPositions(list: MouseButtonInstance[]): MouseButtonInstance[] {
  return list.map((b, i) => (typeof b.x === 'number' && typeof b.y === 'number' ? b : { ...b, ...defaultButtonPosition(i) }));
}

function genId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

/** Persists the Mouse tab's floating button panel (which controls, in what
 * order) to Dexie. First run shows just the Keyboard toggle. */
export function useMouseButtons() {
  const [buttons, setButtons] = useState<MouseButtonInstance[]>(DEFAULT_MOUSE_BUTTONS);

  useEffect(() => {
    db.settings.get(KEY).then((row) => {
      if (!row?.value) return;
      try {
        const parsed = JSON.parse(row.value);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const hydrated = withPositions(parsed);
          setButtons(hydrated);
          if (JSON.stringify(hydrated) !== JSON.stringify(parsed)) {
            db.settings.put({ key: KEY, value: JSON.stringify(hydrated) });
          }
        }
      } catch {
        /* corrupt value — keep default panel */
      }
    });
  }, []);

  const addButton = useCallback((type: MouseButtonType) => {
    setButtons((current) => {
      if (current.some((b) => b.type === type)) return current;
      const next = [...current, { id: genId(), type, ...defaultButtonPosition(current.length) }];
      db.settings.put({ key: KEY, value: JSON.stringify(next) });
      return next;
    });
  }, []);

  const removeButton = useCallback((id: string) => {
    setButtons((current) => {
      const next = current.filter((b) => b.id !== id);
      db.settings.put({ key: KEY, value: JSON.stringify(next) });
      return next;
    });
  }, []);

  const moveButton = useCallback((id: string, x: number, y: number) => {
    setButtons((current) => {
      const next = current.map((b) => (b.id === id ? { ...b, x, y } : b));
      db.settings.put({ key: KEY, value: JSON.stringify(next) });
      return next;
    });
  }, []);

  return { buttons, addButton, removeButton, moveButton };
}

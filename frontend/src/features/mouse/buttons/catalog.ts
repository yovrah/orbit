import { Keyboard, MousePointer2, MousePointerClick, MousePointer, ChevronsUpDown, Move } from 'lucide-react';
import type { MouseButtonInstance, MouseButtonMeta } from './types';

export const MOUSE_BUTTON_CATALOG: MouseButtonMeta[] = [
  { type: 'keyboard', label: 'Keyboard', icon: Keyboard },
  { type: 'leftClick', label: 'Left Click', icon: MousePointer2 },
  { type: 'rightClick', label: 'Right Click', icon: MousePointerClick },
  { type: 'middleClick', label: 'Middle Click', icon: MousePointer },
  { type: 'scrollWheel', label: 'Scroll Wheel', icon: ChevronsUpDown },
  { type: 'dragLock', label: 'Drag Lock', icon: Move },
];

export function getMouseButtonMeta(type: MouseButtonInstance['type']): MouseButtonMeta | undefined {
  return MOUSE_BUTTON_CATALOG.find((b) => b.type === type);
}

/** First-run panel — scroll wheel anchored in the bottom-left corner, keyboard
 * in the bottom-right corner, with their LABELS level (not their centers).
 * The scroll wheel is a 92px pill and the keyboard a 48px circle — centering
 * both at the same y would leave the shorter keyboard's label sitting ~27px
 * higher. Verified against the rendered geometry at a 390x844 viewport:
 * offsetting the keyboard's y by
 * (halfHeight_scroll - halfHeight_keyboard) / panelHeight * 100 ≈ +3.6
 * makes both buttons' bottom edges — and therefore both labels — align. */
export const DEFAULT_MOUSE_BUTTONS: MouseButtonInstance[] = [
  { id: 'default-scroll', type: 'scrollWheel', x: 10, y: 87 },
  { id: 'default-keyboard', type: 'keyboard', x: 90, y: 90.6 },
];

const DEFAULT_COLS = 4;
const DEFAULT_COL_GAP = 22;
const DEFAULT_ROW_GAP = 24;

/** Staggered spawn position for a button that has never been manually
 * dragged — fills a bottom-up grid so newly added buttons don't overlap. */
export function defaultButtonPosition(index: number): { x: number; y: number } {
  const col = index % DEFAULT_COLS;
  const row = Math.floor(index / DEFAULT_COLS);
  return { x: 14 + col * DEFAULT_COL_GAP, y: 85 - row * DEFAULT_ROW_GAP };
}

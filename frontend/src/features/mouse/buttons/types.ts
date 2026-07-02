import type { LucideIcon } from 'lucide-react';

export type MouseButtonType = 'keyboard' | 'leftClick' | 'rightClick' | 'middleClick' | 'scrollWheel' | 'dragLock';

export interface MouseButtonInstance {
  id: string;
  type: MouseButtonType;
  /** Center position as a percentage of the trackpad's bounding box, so free
   * placement survives resizing between the compact and expanded pad. */
  x?: number;
  y?: number;
}

export interface MouseButtonMeta {
  type: MouseButtonType;
  label: string;
  icon: LucideIcon;
}

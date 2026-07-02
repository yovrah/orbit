import type { LucideIcon } from 'lucide-react';

export type WidgetType =
  | 'quickActions'
  | 'pinnedApps'
  | 'volume'
  | 'brightness'
  | 'clipboard'
  | 'systemStats'
  | 'screenThumbnail'
  | 'mediaControls'
  | 'macroLauncher'
  | 'appShortcut'
  | 'trackpad';

export type WidgetSize = '1x1' | '1x2' | '2x1' | '2x2';

export interface WidgetInstance {
  /** Stable per-instance id — distinct from `type` so the same widget type
   * can be added more than once (e.g. two macro shortcuts). */
  id: string;
  type: WidgetType;
  size: WidgetSize;
  /** Per-instance config, e.g. which macro id a Macro Shortcut points to. */
  config?: Record<string, unknown>;
}

export interface WidgetMeta {
  type: WidgetType;
  label: string;
  description: string;
  icon: LucideIcon;
  defaultSize: WidgetSize;
  allowedSizes: WidgetSize[];
  /** True when only one instance of this widget makes sense on the Home screen. */
  singleton?: boolean;
}

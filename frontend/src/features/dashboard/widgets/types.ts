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

/** Sizes are expressed against a 4-column grid so a "slim" quarter-width slider
 * (iOS Control-Center style) is possible alongside half- and full-width tiles.
 * - slim: 1 col × 2 rows (narrow tall slider)
 * - 1x1:  2 cols × 1 row (half-width square)
 * - 1x2:  2 cols × 2 rows (half-width tall)
 * - 2x1:  4 cols × 1 row (full-width bar)
 * - 2x2:  4 cols × 2 rows (full-width big) */
export type WidgetSize = 'slim' | '1x1' | '1x2' | '2x1' | '2x2';

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

import {
  Zap,
  LayoutGrid,
  Volume2,
  Sun,
  Clipboard,
  Activity,
  MonitorPlay,
  Music2,
  Mouse,
  Wand2,
  AppWindow,
} from 'lucide-react';
import type { WidgetInstance, WidgetMeta } from './types';

export const WIDGET_CATALOG: WidgetMeta[] = [
  {
    type: 'quickActions',
    label: 'Quick Actions',
    description: 'Customizable one-tap system actions',
    icon: Zap,
    defaultSize: '2x2',
    allowedSizes: ['2x2'],
    singleton: true,
    configurable: true,
  },
  {
    type: 'pinnedApps',
    label: 'Pinned Apps',
    description: 'Your shortcut row of launchable apps',
    icon: LayoutGrid,
    defaultSize: '2x1',
    allowedSizes: ['2x1'],
    singleton: true,
  },
  {
    type: 'volume',
    label: 'Volume',
    description: 'Narrow Control-Center-style volume slider',
    icon: Volume2,
    defaultSize: 'slim',
    allowedSizes: ['slim', '1x1'],
    singleton: true,
  },
  {
    type: 'brightness',
    label: 'Brightness',
    description: 'Narrow Control-Center-style brightness slider',
    icon: Sun,
    defaultSize: 'slim',
    allowedSizes: ['slim', '1x1'],
    singleton: true,
  },
  {
    type: 'clipboard',
    label: 'Clipboard',
    description: 'Sync text between phone and PC',
    icon: Clipboard,
    defaultSize: '2x1',
    allowedSizes: ['2x1'],
    singleton: true,
  },
  {
    type: 'systemStats',
    label: 'System Stats',
    description: 'CPU, RAM, battery and ping at a glance',
    icon: Activity,
    defaultSize: '2x1',
    allowedSizes: ['2x1', '2x2'],
    singleton: true,
  },
  {
    type: 'screenThumbnail',
    label: 'Live Screen',
    description: 'A small live preview of your PC screen',
    icon: MonitorPlay,
    defaultSize: '2x2',
    allowedSizes: ['1x2', '2x2'],
    singleton: true,
  },
  {
    type: 'mediaControls',
    label: 'Media Controls',
    description: 'Play, pause and skip whatever is playing on the PC',
    icon: Music2,
    defaultSize: '2x1',
    allowedSizes: ['2x1'],
    singleton: true,
  },
  {
    type: 'trackpad',
    label: 'Trackpad',
    description: 'Mini touchpad — move, tap to click, two-finger scroll',
    icon: Mouse,
    defaultSize: '2x2',
    allowedSizes: ['1x2', '2x2'],
    singleton: true,
  },
  {
    type: 'macroLauncher',
    label: 'Macro Shortcut',
    description: 'One-tap launcher for a saved automation',
    icon: Wand2,
    defaultSize: '1x1',
    allowedSizes: ['1x1', '2x1'],
    singleton: false,
  },
  {
    type: 'appShortcut',
    label: 'App Shortcut',
    description: 'One-tap launcher for any app on your PC',
    icon: AppWindow,
    defaultSize: '1x1',
    allowedSizes: ['1x1', '2x1'],
    singleton: false,
  },
];

export function getWidgetMeta(type: WidgetInstance['type']): WidgetMeta | undefined {
  return WIDGET_CATALOG.find((w) => w.type === type);
}

/** First-run layout: Quick Actions on top, then a half-tall trackpad beside the
 * two narrow sliders, and a full-width Clipboard row — matches the showcase
 * design and packs cleanly with no gaps. */
export const DEFAULT_LAYOUT: WidgetInstance[] = [
  { id: 'default-quick-actions', type: 'quickActions', size: '2x2' },
  { id: 'default-trackpad', type: 'trackpad', size: '1x2' },
  { id: 'default-volume', type: 'volume', size: 'slim' },
  { id: 'default-brightness', type: 'brightness', size: 'slim' },
  { id: 'default-clipboard', type: 'clipboard', size: '2x1' },
];

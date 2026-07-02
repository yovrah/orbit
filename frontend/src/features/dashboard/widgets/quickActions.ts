import { Lock, Moon, RotateCcw, Power, LogOut, Camera, MonitorOff, Trash2, Zap } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export type QuickActionKey =
  | 'powerOn'
  | 'lock'
  | 'sleep'
  | 'restart'
  | 'shutdown'
  | 'logoff'
  | 'screenshot'
  | 'monitorOff'
  | 'emptyBin';

export interface QuickActionMeta {
  key: QuickActionKey;
  label: string;
  icon: LucideIcon;
  red?: boolean;
  /** Confirmation prompt shown before firing (destructive actions). */
  confirm?: string;
  /** POST endpoint on the agent; omitted for combo/teaser actions. */
  endpoint?: string;
  /** Key combo sent over the control WebSocket instead of an endpoint. */
  combo?: string[];
  /** True for the Power On teaser — no PC action, opens the Wake-on-LAN sheet. */
  teaser?: boolean;
}

export const QUICK_ACTION_CATALOG: QuickActionMeta[] = [
  { key: 'lock', label: 'Lock', icon: Lock, combo: ['Win', 'L'] },
  { key: 'sleep', label: 'Sleep', icon: Moon, endpoint: '/api/v1/system/sleep' },
  { key: 'restart', label: 'Restart', icon: RotateCcw, endpoint: '/api/v1/system/restart', confirm: 'Restart the PC?' },
  { key: 'shutdown', label: 'Shut Down', icon: Power, red: true, endpoint: '/api/v1/system/shutdown', confirm: 'Shut down the PC?' },
  { key: 'logoff', label: 'Log Off', icon: LogOut, endpoint: '/api/v1/system/logoff', confirm: 'Log off the current user?' },
  { key: 'screenshot', label: 'Screenshot', icon: Camera, endpoint: '/api/v1/system/screenshot' },
  { key: 'monitorOff', label: 'Monitor Off', icon: MonitorOff, endpoint: '/api/v1/system/monitor/off' },
  { key: 'emptyBin', label: 'Empty Bin', icon: Trash2, endpoint: '/api/v1/system/recycle-bin/empty', confirm: 'Empty the recycle bin?' },
  { key: 'powerOn', label: 'Power On PC', icon: Zap, teaser: true },
];

export const DEFAULT_QUICK_ACTIONS: QuickActionKey[] = [
  'lock',
  'sleep',
  'restart',
  'shutdown',
  'logoff',
  'screenshot',
  'powerOn',
];

export function getQuickActionMeta(key: string): QuickActionMeta | undefined {
  return QUICK_ACTION_CATALOG.find((a) => a.key === key);
}

/** Instance config → ordered valid action keys, falling back to the default set. */
export function resolveQuickActions(config?: Record<string, unknown>): QuickActionKey[] {
  const raw = config?.actions;
  if (!Array.isArray(raw)) return DEFAULT_QUICK_ACTIONS;
  const valid = raw.filter((k): k is QuickActionKey => typeof k === 'string' && Boolean(getQuickActionMeta(k)));
  return valid.length > 0 ? valid : DEFAULT_QUICK_ACTIONS;
}

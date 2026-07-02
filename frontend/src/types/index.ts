import type { Device } from '../db/clientDb';

/** The four top-level destinations. No nested sub-tabs anywhere. */
export type View = 'dashboard' | 'mouse' | 'stream' | 'files';

/** Theme + keyboard layout primitives shared across the app. */
export type Theme = 'light' | 'dark';
export type KbLayout = 'en' | 'ru';

/**
 * A control message sent over the WebSocket to the agent. Intentionally open:
 * the agent dispatches on the `event` discriminator, and payload shapes vary
 * per event (mouse_move/dx,dy, key_combo/keys, volume_set/level, ...).
 */
export interface ControlEvent {
  event: string;
  [key: string]: unknown;
}

export interface FileEntry {
  name: string;
  path: string;
  is_dir: boolean;
  size: number;
  /** Present only for drive entries at the root listing. */
  total?: number;
  free?: number;
}

/** A user-pinned application shown on the Dashboard. */
export interface PinnedApp {
  name: string;
  path: string;
}

export interface AppEntry {
  name: string;
  path: string;
  icon?: string;
}

export interface ProcessEntry {
  hwnd: number;
  title: string;
  pid: number;
}

export interface SystemStats {
  cpu_percent: number;
  ram_percent: number;
  ram_used_gb: number;
  ram_total_gb: number;
  disk_percent: number;
  disk_used_gb: number;
  disk_total_gb: number;
  uptime_seconds: number;
  os_name: string;
  cpu_name: string;
  hostname: string;
  battery_percent: number | null;
  battery_plugged: boolean | null;
}

export type { Device };

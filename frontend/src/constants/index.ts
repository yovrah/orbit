import {
  Home,
  Mouse,
  MonitorPlay,
  ArrowLeftRight,
  Settings,
  Monitor,
  FileText,
  Download,
  Image,
  Video,
  Music,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { View } from '../types';

/** Primary bottom-dock destinations — navigable views. */
export const tabs: Array<{ id: View; label: string; icon: LucideIcon }> = [
  { id: 'dashboard', label: 'Home', icon: Home },
  { id: 'mouse', label: 'Mouse', icon: Mouse },
  { id: 'stream', label: 'Stream', icon: MonitorPlay },
  { id: 'files', label: 'Transfer', icon: ArrowLeftRight },
];

/** Trailing dock action — opens the Settings sheet rather than navigating. */
export const settingsTab = { label: 'Settings', icon: Settings };

/**
 * Files → Quick Access tiles. Each maps to a folder under the user profile and
 * carries its own accent colour (matching the reference mockup).
 */
export const quickAccess: Array<{
  label: string;
  folder: string;
  icon: LucideIcon;
  tone: string;
}> = [
  { label: 'Desktop', folder: 'Desktop', icon: Monitor, tone: '#3b82f6' },
  { label: 'Documents', folder: 'Documents', icon: FileText, tone: '#22c55e' },
  { label: 'Downloads', folder: 'Downloads', icon: Download, tone: '#8b5cf6' },
  { label: 'Pictures', folder: 'Pictures', icon: Image, tone: '#f59e0b' },
  { label: 'Videos', folder: 'Videos', icon: Video, tone: '#ef4444' },
  { label: 'Music', folder: 'Music', icon: Music, tone: '#ec4899' },
];

/**
 * Edit shortcuts shown on the touchpad. Single source of truth — previously
 * these were duplicated between the trackpad toolbar and the Settings grid.
 */
export const EDIT_SHORTCUTS: Array<{ label: string; keys: string[] }> = [
  { label: 'Select All', keys: ['Ctrl', 'A'] },
  { label: 'Copy', keys: ['Ctrl', 'C'] },
  { label: 'Paste', keys: ['Ctrl', 'V'] },
  { label: 'Undo', keys: ['Ctrl', 'Z'] },
];

export const CYRILLIC_TO_LATIN_MAP: Record<string, string> = {
  'й': 'q', 'ц': 'w', 'у': 'e', 'к': 'r', 'е': 't', 'н': 'y', 'г': 'u', 'ш': 'i', 'щ': 'o', 'з': 'p', 'х': '[', 'ъ': ']',
  'ф': 'a', 'ы': 's', 'в': 'd', 'а': 'f', 'п': 'g', 'р': 'h', 'о': 'j', 'л': 'k', 'д': 'l', 'ж': ';', 'э': "'",
  'я': 'z', 'ч': 'x', 'с': 'c', 'м': 'v', 'и': 'b', 'т': 'n', 'ь': 'm', 'б': ',', 'ю': '.', 'ё': '`',
  'Й': 'Q', 'Ц': 'W', 'У': 'E', 'К': 'R', 'Е': 'T', 'Н': 'Y', 'Г': 'U', 'Ш': 'I', 'Щ': 'O', 'З': 'P', 'Х': '{', 'Ъ': '}',
  'Ф': 'A', 'Ы': 'S', 'В': 'D', 'А': 'F', 'П': 'G', 'Р': 'H', 'О': 'J', 'Л': 'K', 'Д': 'L', 'Ж': ':', 'Э': '"',
  'Я': 'Z', 'Ч': 'X', 'С': 'C', 'М': 'V', 'И': 'B', 'Т': 'N', 'Ь': 'M', 'Б': '<', 'Ю': '>'
};

export const LATIN_ROWS = [
  ['Esc', 'Tab', 'Ctrl', 'Alt', 'Win', 'Shift', 'Backspace'],
  ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
  ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l', 'Enter'],
  ['z', 'x', 'c', 'v', 'b', 'n', 'm', ',', '.', '/'],
  ['En/Ru', 'Space', 'Left', 'Up', 'Down', 'Right']
];

export const CYRILLIC_ROWS = [
  ['Esc', 'Tab', 'Ctrl', 'Alt', 'Win', 'Shift', 'Backspace'],
  ['й', 'ц', 'у', 'к', 'е', 'н', 'г', 'ш', 'щ', 'з', 'х', 'ъ'],
  ['ф', 'ы', 'в', 'а', 'п', 'р', 'о', 'л', 'д', 'ж', 'э', 'Enter'],
  ['я', 'ч', 'с', 'м', 'и', 'т', 'ь', 'б', 'ю', '.', '/'],
  ['En/Ru', 'Space', 'Left', 'Up', 'Down', 'Right']
];

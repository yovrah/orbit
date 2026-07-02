import {
  Lock,
  Moon,
  RotateCcw,
  Power,
  LogOut,
  Camera,
  Volume2,
  Sun,
  ClipboardPaste,
  ClipboardCopy,
  Play,
  ChevronRight,
  Wand2,
  AppWindow,
  MonitorPlay,
  Mouse,
} from 'lucide-react';
import type { WidgetType } from './types';

const QA_ICONS = [Lock, Moon, RotateCcw, Power, LogOut, Camera];
const PIN_COLORS = ['#3b82f6', '#22c55e', '#8b5cf6', '#f59e0b'];
const STAT_SAMPLES = ['64%', '2.1GB', '12ms', '80%'];

/** A small static mockup of what a widget actually looks like, built from the
 * same visual language as the real thing — shown in the Add Widget gallery
 * so picking a widget isn't a blind guess from a label. */
export function WidgetPreview({ type }: { type: WidgetType }) {
  switch (type) {
    case 'quickActions':
      return (
        <div className="wp-qa">
          {QA_ICONS.map((Icon, i) => (
            <div key={i} className="wp-qa-cell">
              <Icon size={10} />
            </div>
          ))}
        </div>
      );
    case 'pinnedApps':
      return (
        <div className="wp-pins">
          {PIN_COLORS.map((c, i) => (
            <div key={i} className="wp-pin" style={{ background: c }} />
          ))}
        </div>
      );
    case 'volume':
      return (
        <div className="wp-vpill">
          <i style={{ height: '60%' }} />
          <Volume2 size={12} />
        </div>
      );
    case 'brightness':
      return (
        <div className="wp-vpill">
          <i style={{ height: '80%' }} />
          <Sun size={12} />
        </div>
      );
    case 'clipboard':
      return (
        <div className="wp-clip">
          <span>
            <ClipboardPaste size={12} />
          </span>
          <span>
            <ClipboardCopy size={12} />
          </span>
        </div>
      );
    case 'systemStats':
      return (
        <div className="wp-stats">
          {STAT_SAMPLES.map((v, i) => (
            <div key={i} className="wp-stat-cell">
              {v}
            </div>
          ))}
        </div>
      );
    case 'screenThumbnail':
      return (
        <div className="wp-screen">
          <MonitorPlay size={18} />
        </div>
      );
    case 'mediaControls':
      return (
        <div className="wp-media">
          <RotateCcw size={12} />
          <span className="wp-media-play">
            <Play size={11} fill="currentColor" />
          </span>
          <ChevronRight size={12} />
        </div>
      );
    case 'macroLauncher':
      return (
        <div className="wp-shortcut">
          <Wand2 size={17} />
        </div>
      );
    case 'appShortcut':
      return (
        <div className="wp-shortcut">
          <AppWindow size={17} />
        </div>
      );
    case 'trackpad':
      return (
        <div className="wp-screen trackpad">
          <Mouse size={16} />
        </div>
      );
    default:
      return null;
  }
}

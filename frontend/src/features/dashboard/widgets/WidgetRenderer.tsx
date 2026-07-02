import { QuickActionsWidget } from './QuickActionsWidget';
import { PinnedAppsWidget } from './PinnedAppsWidget';
import { VolumeWidget } from './VolumeWidget';
import { BrightnessWidget } from './BrightnessWidget';
import { ClipboardWidget } from './ClipboardWidget';
import { SystemStatsWidget } from './SystemStatsWidget';
import { ScreenThumbnailWidget } from './ScreenThumbnailWidget';
import { MediaControlsWidget } from './MediaControlsWidget';
import { MacroLauncherWidget } from './MacroLauncherWidget';
import { AppShortcutWidget } from './AppShortcutWidget';
import { TrackpadWidget } from './TrackpadWidget';
import type { WidgetInstance } from './types';

interface WidgetRendererProps {
  instance: WidgetInstance;
  editing: boolean;
  onNavigateStream: () => void;
  onPowerOn: () => void;
}

/** Resolves a widget instance to its content and applies the shared card
 * chrome. Content is pointer-inert while the grid is in edit mode so a drag
 * or a remove tap can never accidentally trigger a widget's own action. */
export function WidgetRenderer({ instance, editing, onNavigateStream, onPowerOn }: WidgetRendererProps) {
  const isBarePresentation =
    instance.type === 'screenThumbnail' || instance.type === 'macroLauncher' || instance.type === 'appShortcut';
  const extraClass = instance.type === 'pinnedApps' ? 'pinned-apps' : instance.type === 'trackpad' ? 'trackpad' : '';
  const sizeClass = instance.size === 'slim' ? 'slim' : '';

  return (
    <div
      className={`widget-card ${isBarePresentation ? 'bare' : ''} ${extraClass} ${sizeClass}`}
      style={editing ? { pointerEvents: 'none' } : undefined}
    >
      {renderContent(instance, onNavigateStream, onPowerOn)}
    </div>
  );
}

function renderContent(instance: WidgetInstance, onNavigateStream: () => void, onPowerOn: () => void) {
  switch (instance.type) {
    case 'quickActions':
      return <QuickActionsWidget instance={instance} onPowerOn={onPowerOn} />;
    case 'pinnedApps':
      return <PinnedAppsWidget />;
    case 'volume':
      return <VolumeWidget />;
    case 'brightness':
      return <BrightnessWidget />;
    case 'clipboard':
      return <ClipboardWidget />;
    case 'systemStats':
      return <SystemStatsWidget size={instance.size} />;
    case 'screenThumbnail':
      return <ScreenThumbnailWidget onNavigate={onNavigateStream} />;
    case 'mediaControls':
      return <MediaControlsWidget />;
    case 'trackpad':
      return <TrackpadWidget />;
    case 'macroLauncher':
      return <MacroLauncherWidget instance={instance} />;
    case 'appShortcut':
      return <AppShortcutWidget instance={instance} />;
    default:
      return null;
  }
}

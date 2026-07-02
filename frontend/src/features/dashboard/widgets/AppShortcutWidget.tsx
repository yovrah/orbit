import { AppWindow } from 'lucide-react';
import { useApps } from '../../pc/useApps';
import { useAppIcon } from '../useAppIcon';
import type { WidgetInstance } from './types';

interface AppShortcutWidgetProps {
  instance: WidgetInstance;
}

/** One-tap launcher for a single chosen app — like Macro Shortcut, but for
 * any installed program, showing its real extracted icon. */
export function AppShortcutWidget({ instance }: AppShortcutWidgetProps) {
  const { launch } = useApps();
  const appPath = instance.config?.appPath as string | undefined;
  const appName = (instance.config?.appName as string | undefined) || 'App';
  const iconUrl = useAppIcon(appPath || '');

  return (
    <button type="button" className="w-macro" onClick={() => appPath && launch(appPath)} disabled={!appPath}>
      <span className="w-macro-ico">
        {iconUrl ? <img src={iconUrl} alt="" className="w-macro-img" /> : <AppWindow size={18} />}
      </span>
      <span className="w-macro-name truncate">{appName}</span>
    </button>
  );
}

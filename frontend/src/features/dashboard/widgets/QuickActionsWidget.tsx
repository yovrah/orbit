import { useOrbit } from '../../../state/OrbitContext';
import { getQuickActionMeta, resolveQuickActions } from './quickActions';
import type { WidgetInstance } from './types';

interface QuickActionsWidgetProps {
  instance: WidgetInstance;
  onPowerOn: () => void;
}

/** User-configurable grid of one-tap system actions. Which actions show is
 * stored per-instance (config.actions) and edited via the gear badge in edit
 * mode. "Power On PC" renders as a full-width row — it opens the Wake-on-LAN
 * explainer instead of hitting the agent (a web app can't send WoL packets). */
export function QuickActionsWidget({ instance, onPowerOn }: QuickActionsWidgetProps) {
  const { sendEvent, postSystemAction } = useOrbit();

  const keys = resolveQuickActions(instance.config);
  const tiles = keys.filter((k) => k !== 'powerOn');
  const hasPowerOn = keys.includes('powerOn');

  const run = (key: string) => {
    const meta = getQuickActionMeta(key);
    if (!meta) return;
    if (meta.teaser) return onPowerOn();
    if (meta.confirm && !confirm(meta.confirm)) return;
    if (meta.combo) return sendEvent({ event: 'key_combo', keys: meta.combo });
    if (meta.endpoint) postSystemAction(meta.endpoint);
  };

  return (
    <div className="w-flex-col">
      <span className="w-title">Quick Actions</span>
      <div className="w-qa-grid">
        {tiles.map((key) => {
          const meta = getQuickActionMeta(key)!;
          const Icon = meta.icon;
          return (
            <button
              key={key}
              type="button"
              className={`w-qa-btn ${meta.red ? 'red' : ''}`}
              onClick={() => run(key)}
            >
              <Icon size={17} />
              <span>{meta.label}</span>
            </button>
          );
        })}
        {hasPowerOn && (
          <button type="button" className="w-qa-btn wide" onClick={onPowerOn}>
            {(() => {
              const Icon = getQuickActionMeta('powerOn')!.icon;
              return <Icon size={15} />;
            })()}
            <span>Power On PC</span>
          </button>
        )}
      </div>
    </div>
  );
}

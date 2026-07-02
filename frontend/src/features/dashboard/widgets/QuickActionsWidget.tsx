import { Zap } from 'lucide-react';
import { useOrbit } from '../../../state/OrbitContext';
import { getQuickActionMeta, resolveQuickActions } from './quickActions';
import type { WidgetInstance } from './types';

interface QuickActionsWidgetProps {
  instance: WidgetInstance;
  onPowerOn: () => void;
}

/** Choose a column count that keeps the tiles roughly square-ish and fills the
 * widget like the iOS Control Center. */
function columnsFor(count: number): number {
  if (count <= 1) return 1;
  if (count <= 3) return count;
  if (count === 4) return 2;
  return 3;
}

/** User-configurable grid of one-tap system actions. Which actions show is
 * stored per-instance (config.actions) and edited via the gear badge in edit
 * mode. Tiles stretch to fill the whole widget. "Power On PC" is a green
 * teaser button below the grid — it opens the Wake-on-LAN explainer instead
 * of hitting the agent (a web app can't send WoL packets). */
export function QuickActionsWidget({ instance, onPowerOn }: QuickActionsWidgetProps) {
  const { sendEvent, postSystemAction } = useOrbit();

  const keys = resolveQuickActions(instance.config);
  const tiles = keys.filter((k) => k !== 'powerOn');
  const hasPowerOn = keys.includes('powerOn');
  const cols = columnsFor(tiles.length);

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
      <div className="w-qa-grid" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
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
              <Icon size={18} />
              <span>{meta.label}</span>
            </button>
          );
        })}
      </div>
      {hasPowerOn && (
        <button type="button" className="w-qa-power" onClick={onPowerOn}>
          <Zap size={16} fill="currentColor" />
          <span>Power On PC</span>
        </button>
      )}
    </div>
  );
}

import { useSystemStats } from '../../pc/useSystemStats';
import { useOrbit } from '../../../state/OrbitContext';
import type { WidgetSize } from './types';

interface SystemStatsWidgetProps {
  size: WidgetSize;
}

export function SystemStatsWidget({ size }: SystemStatsWidgetProps) {
  const { stats } = useSystemStats();
  const { connection } = useOrbit();

  const items = [
    { label: 'CPU', value: stats ? `${Math.round(stats.cpu_percent)}%` : '--' },
    { label: 'RAM', value: stats ? `${Math.round(stats.ram_percent)}%` : '--' },
    { label: 'Ping', value: connection.pingMs != null ? `${connection.pingMs}ms` : '--' },
    { label: 'Battery', value: stats?.battery_percent != null ? `${Math.round(stats.battery_percent)}%` : 'AC' },
  ];

  return (
    <div className="w-flex-col">
      <span className="w-title">System Stats</span>
      <div className={`w-stat-grid ${size === '2x2' ? 'tall' : ''}`}>
        {items.map((it) => (
          <div key={it.label} className="w-stat-cell">
            <strong>{it.value}</strong>
            <span>{it.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

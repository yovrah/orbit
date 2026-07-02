import { useEffect, useState } from 'react';
import { Wand2, Loader } from 'lucide-react';
import { useOrbit } from '../../../state/OrbitContext';
import type { WidgetInstance } from './types';

interface Scenario {
  id: number;
  name: string;
}

interface MacroLauncherWidgetProps {
  instance: WidgetInstance;
}

export function MacroLauncherWidget({ instance }: MacroLauncherWidgetProps) {
  const { request } = useOrbit();
  const macroId = instance.config?.macroId as number | undefined;
  const [name, setName] = useState('Macro');
  const [running, setRunning] = useState(false);

  useEffect(() => {
    if (!macroId) return;
    request('/api/v1/scenarios')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        const found = (data?.scenarios as Scenario[] | undefined)?.find((s) => s.id === macroId);
        if (found) setName(found.name);
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [macroId]);

  const run = async () => {
    if (!macroId || running) return;
    setRunning(true);
    try {
      await request(`/api/v1/scenarios/${macroId}/run`, { method: 'POST' });
    } finally {
      setRunning(false);
    }
  };

  return (
    <button type="button" className="w-macro" onClick={run} disabled={!macroId}>
      <span className="w-macro-ico">{running ? <Loader size={18} className="spin" /> : <Wand2 size={18} />}</span>
      <span className="w-macro-name truncate">{macroId ? name : 'Pick a macro'}</span>
    </button>
  );
}

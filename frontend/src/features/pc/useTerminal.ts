import { useCallback, useState } from 'react';
import { useOrbit } from '../../state/OrbitContext';

/** Remote command execution (gated by the agent's security policy). */
export function useTerminal() {
  const { activeDevice, request } = useOrbit();
  const [command, setCommand] = useState('');
  const [output, setOutput] = useState('');
  const [isRunning, setIsRunning] = useState(false);

  const run = useCallback(async () => {
    if (!activeDevice || !command.trim()) return;
    setIsRunning(true);
    setOutput('Running...');
    try {
      const res = await request('/api/v1/system/terminal', {
        method: 'POST',
        body: JSON.stringify({ command }),
      });
      if (res.ok) {
        const data = await res.json();
        setOutput(data.stdout || data.stderr || 'Command executed with no output.');
      } else if (res.status === 403) {
        setOutput('Terminal is disabled by security policy.');
      } else {
        setOutput(`Error executing command (HTTP ${res.status}).`);
      }
      setCommand('');
    } catch (err) {
      console.error('Unable to run command:', err);
      setOutput('Network error or timeout while running command.');
    } finally {
      setIsRunning(false);
    }
  }, [activeDevice, command, request]);

  return { command, setCommand, output, isRunning, run };
}

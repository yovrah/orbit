import { Send } from 'lucide-react';
import { useTerminal } from './useTerminal';

export function TerminalSection() {
  const { command, setCommand, output, isRunning, run } = useTerminal();

  return (
    <div className="flex flex-col gap-2">
      <div className="command-box">
        <input
          value={command}
          onChange={(e) => setCommand(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && run()}
          placeholder="Run a command on the PC"
        />
        <button type="button" onClick={run} disabled={isRunning} aria-label="Run command">
          <Send size={17} />
        </button>
      </div>

      {output && (
        <div className="bg-black/80 text-green-400 font-mono text-[10px] p-2.5 rounded-xl whitespace-pre-wrap overflow-x-auto max-h-48">
          {output}
        </div>
      )}
    </div>
  );
}

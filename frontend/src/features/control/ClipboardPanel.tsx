import { useRef, useState } from 'react';
import { ClipboardCopy, ClipboardPaste, Keyboard, Send, X } from 'lucide-react';
import { useClipboard } from './useClipboard';

/** Two-button clipboard sync (paste to PC / copy from PC) with a keyboard
 * toggle for typing text manually. Shared between the Home widget and the
 * Transfer tab. On plain-HTTP PWAs the browser hides the phone clipboard, so
 * "Paste to PC" falls back to opening the manual input. */
export function ClipboardPanel() {
  const { status, copyFromPc, sendTextToPc, pasteToPc } = useClipboard();
  const [typing, setTyping] = useState(false);
  const [text, setText] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const openTyping = () => {
    setTyping(true);
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  const handlePasteToPc = async () => {
    const handled = await pasteToPc();
    if (!handled) openTyping();
  };

  const handleSendTyped = async () => {
    if (!text.trim()) return;
    const ok = await sendTextToPc(text);
    if (ok) {
      setText('');
      setTyping(false);
    }
  };

  return (
    <div className="clip-panel">
      {typing ? (
        <div className="clip-input-row">
          <input
            ref={inputRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Type or paste text for the PC…"
            onKeyDown={(e) => e.key === 'Enter' && handleSendTyped()}
          />
          <button type="button" className="clip-icon-btn send" onClick={handleSendTyped} aria-label="Send to PC">
            <Send size={15} />
          </button>
          <button
            type="button"
            className="clip-icon-btn"
            onClick={() => setTyping(false)}
            aria-label="Close text input"
          >
            <X size={15} />
          </button>
        </div>
      ) : (
        <div className="clip-btn-row">
          <button type="button" className="clip-btn" onClick={handlePasteToPc}>
            <ClipboardPaste size={16} />
            <span>Paste to PC</span>
          </button>
          <button type="button" className="clip-btn" onClick={copyFromPc}>
            <ClipboardCopy size={16} />
            <span>Copy from PC</span>
          </button>
          <button type="button" className="clip-icon-btn" onClick={openTyping} aria-label="Type text to send">
            <Keyboard size={16} />
          </button>
        </div>
      )}
      <span className={`clip-status ${status ? status.kind : ''}`}>{status?.message ?? ' '}</span>
    </div>
  );
}

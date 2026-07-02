import { useOrbit } from '../state/OrbitContext';
import { useKeyboard } from '../features/touchpad/useKeyboard';
import { EDIT_SHORTCUTS, LATIN_ROWS, CYRILLIC_ROWS } from '../constants';

const WIDE_KEYS = ['Backspace', 'Enter', 'Shift', 'Ctrl', 'Alt', 'Win', 'Tab', 'Esc'];

/** Shared on-screen QWERTY keyboard + edit shortcuts row, used on both Mouse and Stream. */
export function OnScreenKeyboard() {
  const { sendEvent, settings } = useOrbit();
  const { mods, handleKey } = useKeyboard();
  const rows = settings.kbLayout === 'en' ? LATIN_ROWS : CYRILLIC_ROWS;

  return (
    <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <div className="flex gap-2 justify-center">
        {EDIT_SHORTCUTS.map(({ label, keys }) => (
          <button
            key={label}
            type="button"
            className="bg-transparent text-[#6e7682] font-extrabold text-[10px] px-3 py-1.5 rounded-xl border border-black/5 active:scale-95 transition-transform"
            onClick={() => sendEvent({ event: 'key_combo', keys })}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="qwerty-keyboard">
        {rows.map((row, rIdx) => (
          <div key={rIdx} className="qwerty-row">
            {row.map((key) => {
              const active =
                (key === 'Ctrl' && mods.ctrl) ||
                (key === 'Alt' && mods.alt) ||
                (key === 'Shift' && mods.shift) ||
                (key === 'Win' && mods.win);
              const wide = WIDE_KEYS.includes(key);
              const extraWide = key === 'Space';
              return (
                <button
                  key={key}
                  type="button"
                  className={`qwerty-key ${active ? 'active' : ''} ${wide ? 'wide' : ''} ${extraWide ? 'extra-wide' : ''}`}
                  onClick={() => handleKey(key)}
                >
                  {key}
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

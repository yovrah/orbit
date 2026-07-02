import { useCallback, useState } from 'react';
import { useOrbit } from '../../state/OrbitContext';
import { CYRILLIC_TO_LATIN_MAP } from '../../constants';

interface Modifiers {
  ctrl: boolean;
  alt: boolean;
  shift: boolean;
  win: boolean;
}

const NAMED_KEYS: Record<string, string> = {
  Backspace: 'backspace',
  Enter: 'enter',
  Space: 'space',
  Esc: 'escape',
  Tab: 'tab',
  Del: 'delete',
  Left: 'left',
  Up: 'up',
  Down: 'down',
  Right: 'right',
};

/**
 * On-screen keyboard state machine: sticky modifiers, layout toggle, and key
 * dispatch. Cyrillic keys are mapped to their physical Latin equivalents when a
 * modifier is held so combos like Ctrl+C work regardless of layout.
 */
export function useKeyboard() {
  const { sendEvent, settings, setKbLayout } = useOrbit();
  const { kbLayout } = settings;
  const [mods, setMods] = useState<Modifiers>({ ctrl: false, alt: false, shift: false, win: false });

  const handleKey = useCallback(
    (key: string) => {
      if (key === 'Ctrl') return setMods((m) => ({ ...m, ctrl: !m.ctrl }));
      if (key === 'Alt') return setMods((m) => ({ ...m, alt: !m.alt }));
      if (key === 'Shift') return setMods((m) => ({ ...m, shift: !m.shift }));
      if (key === 'Win') return setMods((m) => ({ ...m, win: !m.win }));
      if (key === 'En/Ru') return void setKbLayout(kbLayout === 'en' ? 'ru' : 'en');

      let mapped = key;
      if ((mods.ctrl || mods.alt || mods.win) && CYRILLIC_TO_LATIN_MAP[mapped]) {
        mapped = CYRILLIC_TO_LATIN_MAP[mapped];
      }
      mapped = NAMED_KEYS[key] ?? mapped.toLowerCase();

      sendEvent({
        event: 'keyboard_input',
        key: mapped,
        type: 'press',
        modifiers: mods,
      });

      setMods({ ctrl: false, alt: false, shift: false, win: false });
    },
    [mods, kbLayout, sendEvent, setKbLayout]
  );

  return { mods, handleKey };
}

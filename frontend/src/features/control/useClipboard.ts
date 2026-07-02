import { useCallback, useEffect, useRef, useState } from 'react';
import { useOrbit } from '../../state/OrbitContext';

export interface ClipStatus {
  kind: 'ok' | 'err';
  message: string;
}

const STATUS_VISIBLE_MS = 2200;

/** Two-way clipboard sync between the phone and the PC, with a transient
 * inline status instead of blocking alert() popups. */
export function useClipboard() {
  const { activeDevice, request } = useOrbit();
  const [status, setStatus] = useState<ClipStatus | null>(null);
  const timerRef = useRef<number | null>(null);

  useEffect(() => () => {
    if (timerRef.current !== null) clearTimeout(timerRef.current);
  }, []);

  const flash = useCallback((kind: ClipStatus['kind'], message: string) => {
    setStatus({ kind, message });
    if (timerRef.current !== null) clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => setStatus(null), STATUS_VISIBLE_MS);
  }, []);

  /** Fetches the PC clipboard; also copies it to the phone clipboard when the
   * browser allows it. Returns the text (empty string when the PC had none). */
  const copyFromPc = useCallback(async (): Promise<string | null> => {
    if (!activeDevice) return null;
    try {
      const res = await request('/api/v1/system/clipboard');
      if (!res.ok) {
        flash('err', 'PC returned an error');
        return null;
      }
      const text: string = (await res.json()).text || '';
      let copied = false;
      if (text && navigator.clipboard?.writeText) {
        try {
          await navigator.clipboard.writeText(text);
          copied = true;
        } catch {
          /* insecure context or permission denied — still show the text */
        }
      }
      flash('ok', !text ? 'PC clipboard is empty' : copied ? 'Copied to phone' : 'Fetched from PC');
      return text;
    } catch {
      flash('err', 'PC unreachable');
      return null;
    }
  }, [activeDevice, request, flash]);

  const sendTextToPc = useCallback(
    async (text: string): Promise<boolean> => {
      if (!activeDevice || !text) return false;
      try {
        const res = await request('/api/v1/system/clipboard', {
          method: 'POST',
          body: JSON.stringify({ text }),
        });
        flash(res.ok ? 'ok' : 'err', res.ok ? 'Sent to PC clipboard' : 'PC returned an error');
        return res.ok;
      } catch {
        flash('err', 'PC unreachable');
        return false;
      }
    },
    [activeDevice, request, flash]
  );

  /** Sends the phone clipboard to the PC. Returns false when the browser
   * refuses to expose the clipboard (plain-HTTP PWA) — callers should fall
   * back to the manual text input in that case. */
  const pasteToPc = useCallback(async (): Promise<boolean> => {
    if (!navigator.clipboard?.readText) return false;
    let text = '';
    try {
      text = await navigator.clipboard.readText();
    } catch {
      return false;
    }
    if (!text) {
      flash('err', 'Phone clipboard is empty');
      return true;
    }
    return sendTextToPc(text);
  }, [sendTextToPc, flash]);

  return { status, copyFromPc, sendTextToPc, pasteToPc };
}

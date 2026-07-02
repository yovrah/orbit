/**
 * Lightweight haptic feedback. A no-op where the Vibration API is unavailable
 * (notably iOS Safari), so callers can fire it unconditionally.
 */
export function haptic(pattern: number | number[] = 10): void {
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate(pattern);
    }
  } catch {
    /* ignore — vibration is best-effort */
  }
}

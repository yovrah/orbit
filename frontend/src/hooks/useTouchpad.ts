import { useEffect, useRef } from 'react';
import { haptic } from '../lib/haptics';

interface TouchPoint {
  x: number;
  y: number;
}

interface UseTouchpadProps {
  element: HTMLDivElement | null;
  sendEvent: (payload: any) => void;
  enabled: boolean;
  sensitivity?: number;
  scrollSensitivity?: number;
  /** Reports the active finger position (element-relative) for a live cursor, null on release. */
  onPoint?: (point: TouchPoint | null) => void;
}

export function useTouchpad({
  element,
  sendEvent,
  enabled,
  sensitivity = 1.0,
  scrollSensitivity = 1.0,
  onPoint,
}: UseTouchpadProps) {
  // Kept in a ref so a changing callback identity never re-binds the listeners.
  const onPointRef = useRef(onPoint);
  onPointRef.current = onPoint;
  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const lastTouchRef = useRef<{ x: number; y: number } | null>(null);
  const lastTapTimeRef = useRef<number>(0);
  const isScrollingRef = useRef(false);
  const maxTouchesRef = useRef<number>(0);
  const isDraggingRef = useRef<boolean>(false);
  const dragCandidateRef = useRef<boolean>(false);

  useEffect(() => {
    const el = element;
    if (!el || !enabled) return;

    const handleTouchStart = (e: TouchEvent) => {
      if (e.cancelable) e.preventDefault();

      const touches = e.touches;
      maxTouchesRef.current = Math.max(maxTouchesRef.current, touches.length);

      if (touches.length === 1) {
        const touch = touches[0];
        const now = Date.now();
        const timeSinceLastTap = now - lastTapTimeRef.current;

        if (timeSinceLastTap < 300) {
          dragCandidateRef.current = true;
        } else {
          dragCandidateRef.current = false;
        }

        touchStartRef.current = { x: touch.clientX, y: touch.clientY, time: now };
        lastTouchRef.current = { x: touch.clientX, y: touch.clientY };
        isScrollingRef.current = false;

        const rect = el.getBoundingClientRect();
        onPointRef.current?.({ x: touch.clientX - rect.left, y: touch.clientY - rect.top });
      } else if (touches.length === 2) {
        isScrollingRef.current = true;
        const t1 = touches[0];
        const t2 = touches[1];
        lastTouchRef.current = {
          x: (t1.clientX + t2.clientX) / 2,
          y: (t1.clientY + t2.clientY) / 2,
        };
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.cancelable) e.preventDefault();

      const touches = e.touches;
      if (touches.length === 1 && !isScrollingRef.current) {
        const touch = touches[0];
        if (lastTouchRef.current) {
          const dx = (touch.clientX - lastTouchRef.current.x) * sensitivity;
          const dy = (touch.clientY - lastTouchRef.current.y) * sensitivity;

          if (dragCandidateRef.current) {
            sendEvent({
              event: 'mouse_click',
              button: 'left',
              type: 'down',
            });
            isDraggingRef.current = true;
            dragCandidateRef.current = false;
          }

          sendEvent({
            event: 'mouse_move',
            dx,
            dy,
            accel: true,
          });
        }
        lastTouchRef.current = { x: touch.clientX, y: touch.clientY };

        const rect = el.getBoundingClientRect();
        onPointRef.current?.({ x: touch.clientX - rect.left, y: touch.clientY - rect.top });
      } else if (touches.length === 2 && isScrollingRef.current) {
        const t1 = touches[0];
        const t2 = touches[1];
        const currentMidY = (t1.clientY + t2.clientY) / 2;
        const currentMidX = (t1.clientX + t2.clientX) / 2;

        if (lastTouchRef.current) {
          const dy = ((currentMidY - lastTouchRef.current.y) / 4.0) * scrollSensitivity;
          const dx = ((currentMidX - lastTouchRef.current.x) / 4.0) * scrollSensitivity;

          sendEvent({
            event: 'mouse_scroll',
            dx,
            dy,
          });
        }
        lastTouchRef.current = { x: currentMidX, y: currentMidY };
      }
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if (e.cancelable) e.preventDefault();

      const start = touchStartRef.current;
      const duration = start ? Date.now() - start.time : 0;
      let dist = 0;
      if (start && e.changedTouches.length > 0) {
        const touch = e.changedTouches[0];
        dist = Math.sqrt(
          Math.pow(touch.clientX - start.x, 2) + Math.pow(touch.clientY - start.y, 2)
        );
      }

      if (e.touches.length === 0) {
        if (maxTouchesRef.current === 1) {
          if (isDraggingRef.current) {
            sendEvent({ event: 'mouse_click', button: 'left', type: 'up' });
            isDraggingRef.current = false;
          } else if (dragCandidateRef.current) {
            sendEvent({ event: 'mouse_click', button: 'left', type: 'double' });
            dragCandidateRef.current = false;
            lastTapTimeRef.current = 0;
            haptic(12);
          } else if (duration < 250 && dist < 10) {
            sendEvent({ event: 'mouse_click', button: 'left', type: 'click' });
            lastTapTimeRef.current = Date.now();
            haptic(10);
          }
        } else if (maxTouchesRef.current === 2) {
          if (duration < 250 && dist < 15) {
            sendEvent({ event: 'mouse_click', button: 'right', type: 'click' });
            haptic(10);
          }
        } else if (maxTouchesRef.current === 3) {
          if (duration < 250 && dist < 15) {
            sendEvent({ event: 'mouse_click', button: 'middle', type: 'click' });
            haptic(10);
          }
        }

        maxTouchesRef.current = 0;
        isScrollingRef.current = false;
        dragCandidateRef.current = false;
        onPointRef.current?.(null);
      }

      touchStartRef.current = null;
      lastTouchRef.current = null;
    };

    el.addEventListener('touchstart', handleTouchStart, { passive: false });
    el.addEventListener('touchmove', handleTouchMove, { passive: false });
    el.addEventListener('touchend', handleTouchEnd, { passive: false });

    return () => {
      el.removeEventListener('touchstart', handleTouchStart);
      el.removeEventListener('touchmove', handleTouchMove);
      el.removeEventListener('touchend', handleTouchEnd);
    };
  }, [element, sendEvent, enabled, sensitivity, scrollSensitivity]);
}

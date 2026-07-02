import { useEffect, useRef, useState, useCallback } from 'react';
import type { Device } from '../db/clientDb';
import { buildWsUrl, buildAuthParams } from '../api/client';

const RECONNECT_BASE_MS = 1000;
const RECONNECT_MAX_MS = 30000;

/**
 * Connection to the agent's control socket.
 *
 * Design notes (why this is not a plain useEffect([device])):
 *
 * `device` is derived from a Dexie LiveQuery and gets a NEW object identity on
 * every write to `db.devices` (even an unrelated field like `macAddress`). If
 * we depend on the object, the effect tears the socket down and rebuilds it on
 * every such write, and the async `onclose` from the previous socket schedules a
 * reconnect with a stale closure — fighting the new connection for wsRef.
 *
 * To stay stable we:
 *   - reconnect ONLY when `device.uuid` changes (effect dep);
 *   - keep the latest device fields in a ref so a long-lived socket always
 *     signs with the current secret/address;
 *   - guard every callback and timer with a "generation" counter. Bumping the
 *     generation on disconnect instantly invalidates all pending callbacks of
 *     the old socket, so a late onclose can no longer trigger a stray reconnect.
 */
export function useWebSocket(device: Device | null) {
  const [isConnected, setIsConnected] = useState(false);
  const [isAuthorized, setIsAuthorized] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const deviceRef = useRef<Device | null>(device);
  const genRef = useRef(0); // bumped to invalidate stale callbacks
  const reconnectTimerRef = useRef<number | null>(null);
  const reconnectAttemptRef = useRef(0);

  // Always keep the freshest device fields available to (re)connection logic,
  // without this value change being a reconnect trigger on its own.
  useEffect(() => {
    deviceRef.current = device;
  }, [device]);

  const clearReconnectTimer = useCallback(() => {
    if (reconnectTimerRef.current !== null) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
  }, []);

  const scheduleReconnect = useCallback((gen: number, uuid: string) => {
    clearReconnectTimer();
    const attempt = reconnectAttemptRef.current;
    const delay = Math.min(RECONNECT_BASE_MS * 2 ** attempt, RECONNECT_MAX_MS);
    reconnectAttemptRef.current = attempt + 1;
    reconnectTimerRef.current = window.setTimeout(() => {
      reconnectTimerRef.current = null;
      // Stale if the connection generation or the selected device changed.
      if (genRef.current !== gen || deviceRef.current?.uuid !== uuid) return;
      connectRef.current(gen, uuid);
    }, delay);
  }, [clearReconnectTimer]);

  const connect = useCallback((gen: number, uuid: string) => {
    const dev = deviceRef.current;
    if (genRef.current !== gen || !dev || dev.uuid !== uuid) return;

    // Close any pre-existing socket (async close — the gen guard prevents its
    // late onclose from interfering with this new connection).
    if (wsRef.current) {
      try {
        wsRef.current.onclose = null;
        wsRef.current.onerror = null;
        wsRef.current.onopen = null;
        wsRef.current.onmessage = null;
        wsRef.current.close();
      } catch {
        /* ignore */
      }
      wsRef.current = null;
    }

    const wsUrl = buildWsUrl(dev, '/ws/control');
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      if (genRef.current !== gen || deviceRef.current?.uuid !== uuid) {
        // We were superseded while waiting to open — discard.
        try {
          ws.close();
        } catch {
          /* ignore */
        }
        return;
      }
      setIsConnected(true);
      reconnectAttemptRef.current = 0;

      // The agent authorizes the control socket from the FIRST packet: it
      // verifies HMAC(sharedSecret, "client_id:timestamp") against the signature.
      // We must send all three fields, freshly signed at send time.
      try {
        const { client_id, timestamp, signature } = buildAuthParams(dev);
        ws.send(JSON.stringify({
          event: 'auth_handshake',
          client_id,
          timestamp,
          signature,
        }));
      } catch (err) {
        console.error('Failed to send WS handshake:', err);
        ws.close();
      }
    };

    ws.onmessage = (event) => {
      if (genRef.current !== gen) return;
      try {
        const data = JSON.parse(event.data);
        if (data.event === 'auth_success') {
          setIsAuthorized(true);
        }
      } catch (err) {
        console.error('Error reading WS message:', err);
      }
    };

    ws.onclose = () => {
      if (genRef.current !== gen) return; // superseded — do not reconnect
      setIsConnected(false);
      setIsAuthorized(false);
      scheduleReconnect(gen, uuid);
    };

    ws.onerror = () => {
      if (genRef.current !== gen) return;
      // onclose will follow and schedule the reconnect; just surface it.
      try {
        ws.close();
      } catch {
        /* ignore */
      }
    };
  }, [scheduleReconnect]);

  // `connectRef` breaks the circular useCallback dependency (connect →
  // scheduleReconnect → connect) without exposing it to callers.
  const connectRef = useRef(connect);
  connectRef.current = connect;

  // (Re)connect only when the selected device's UUID actually changes.
  useEffect(() => {
    const uuid = device?.uuid ?? null;

    // New generation invalidates every callback of the previous socket.
    genRef.current += 1;
    const gen = genRef.current;
    clearReconnectTimer();
    reconnectAttemptRef.current = 0;
    setIsConnected(false);
    setIsAuthorized(false);

    if (wsRef.current) {
      try {
        wsRef.current.onclose = null;
        wsRef.current.onerror = null;
        wsRef.current.onopen = null;
        wsRef.current.onmessage = null;
        wsRef.current.close();
      } catch {
        /* ignore */
      }
      wsRef.current = null;
    }

    if (uuid) {
      connect(gen, uuid);
    }

    return () => {
      // Teardown: invalidate this generation so late callbacks no-op, then
      // clean up the socket and any pending reconnect timer.
      genRef.current += 1;
      clearReconnectTimer();
      if (wsRef.current) {
        try {
          wsRef.current.onclose = null;
          wsRef.current.onerror = null;
          wsRef.current.onopen = null;
          wsRef.current.onmessage = null;
          wsRef.current.close();
        } catch {
          /* ignore */
        }
        wsRef.current = null;
      }
      setIsConnected(false);
      setIsAuthorized(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [device?.uuid]);

  const sendEvent = useCallback((eventPayload: object) => {
    if (
      wsRef.current &&
      wsRef.current.readyState === WebSocket.OPEN &&
      isAuthorized
    ) {
      wsRef.current.send(JSON.stringify(eventPayload));
    }
  }, [isAuthorized]);

  return { isConnected, isAuthorized, sendEvent };
}

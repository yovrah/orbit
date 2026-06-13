import { useEffect, useRef, useState, useCallback } from 'react';
import type { Device } from '../db/clientDb';

// Utility to calculate HMAC-SHA256 signature using native Web Crypto API
async function calculateHmac(message: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const messageData = encoder.encode(message);
  const secretData = encoder.encode(secret);

  const cryptoKey = await window.crypto.subtle.importKey(
    "raw",
    secretData,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signatureBuffer = await window.crypto.subtle.sign(
    "HMAC",
    cryptoKey,
    messageData
  );

  const signatureArray = Array.from(new Uint8Array(signatureBuffer));
  return signatureArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export function useWebSocket(device: Device | null) {
  const [isConnected, setIsConnected] = useState(false);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<number | null>(null);

  const connect = useCallback(async () => {
    if (!device) return;

    // Disconnect existing
    if (wsRef.current) {
      wsRef.current.close();
    }

    let wsUrl = '';
    const base = device.ipAddress;
    if (base.startsWith('https://')) {
      wsUrl = base.replace('https://', 'wss://') + '/ws/control';
    } else if (base.startsWith('http://')) {
      wsUrl = base.replace('http://', 'ws://') + '/ws/control';
    } else {
      wsUrl = `ws://${base}:${device.port}/ws/control`;
    }
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = async () => {
      setIsConnected(true);
      console.log('WS Connection opened. Initiating authorized handshake...');

      try {
        const timestamp = Math.floor(Date.now() / 1000);
        // Message payload to sign: "client_id:timestamp"
        const message = `${device.uuid}:${timestamp}`;
        const signature = await calculateHmac(message, device.sharedSecret);

        // Send handshake
        ws.send(JSON.stringify({
          event: 'auth_handshake',
          client_id: device.uuid,
          timestamp,
          signature
        }));
      } catch (err) {
        console.error('Failed to compute signature:', err);
        ws.close();
      }
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.event === 'auth_success') {
          setIsAuthorized(true);
          console.log('WS Session successfully authenticated!');
        }
      } catch (err) {
        console.error('Error reading WS message:', err);
      }
    };

    ws.onclose = () => {
      setIsConnected(false);
      setIsAuthorized(false);
      console.log('WS Connection closed. Retrying in 3 seconds...');
      
      // Auto-reconnect loop
      reconnectTimeoutRef.current = window.setTimeout(() => {
        connect();
      }, 3000);
    };

    ws.onerror = (err) => {
      console.error('WS Connection error:', err);
      ws.close();
    };

  }, [device]);

  useEffect(() => {
    if (device) {
      connect();
    }
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [device, connect]);

  // Method to send raw JSON inputs
  const sendEvent = useCallback((eventPayload: object) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN && isAuthorized) {
      wsRef.current.send(JSON.stringify(eventPayload));
    }
  }, [isAuthorized]);

  return { isConnected, isAuthorized, sendEvent };
}

import { sha256 } from 'js-sha256';
import type { Device } from '../db/clientDb';

/**
 * Compute the HMAC-SHA256 signature for a device over the canonical
 * "<uuid>:<timestamp>" message. The agent verifies this exact format for both
 * the WebSocket handshake and the REST Authorization header.
 */
export function signAuth(device: Device, timestamp: number): string {
  const message = `${device.uuid}:${timestamp}`;
  return sha256.hmac(device.sharedSecret, message);
}

/** {client_id, timestamp, signature} — for WS query strings / handshake packets. */
export function buildAuthParams(device: Device) {
  const timestamp = Math.floor(Date.now() / 1000);
  return {
    client_id: device.uuid,
    timestamp,
    signature: signAuth(device, timestamp),
  };
}

/**
 * Build a signed WebSocket URL for a device + endpoint path.
 *
 * When the PWA is served from the agent itself (port 23810) we connect to the
 * same host so the loopback auto-pairing secret works. Otherwise we use the
 * device's stored ipAddress/port.
 */
export function buildWsUrl(device: Device, path: string): string {
  const { protocol, hostname, port } = window.location;

  let base: string;
  if (port === '23810') {
    // Served by the agent — talk to the current host directly.
    base = `${hostname}:${port}`;
  } else {
    base = device.ipAddress;
    // ipAddress may already include a scheme (http://...) — strip it and
    // re-attach host[:port] so we control the ws(s) scheme below.
    base = base.replace(/^https?:\/\//, '');
    if (!/:/.test(base)) {
      base = `${base}:${device.port}`;
    }
  }

  const wsProtocol = protocol === 'https:' ? 'wss:' : 'ws:';
  const url = new URL(`${wsProtocol}//${base}${path}`);

  const { client_id, timestamp, signature } = buildAuthParams(device);
  url.searchParams.set('client_id', client_id);
  url.searchParams.set('timestamp', String(timestamp));
  url.searchParams.set('signature', signature);

  return url.toString();
}

export async function fetchWithAuth(device: Device | null, endpoint: string, options: RequestInit = {}) {
  if (!device) {
    throw new Error('Device is not connected or paired.');
  }

  const { client_id, timestamp, signature } = buildAuthParams(device);
  const authHeader = `Orbit-HMAC ${client_id}:${timestamp}:${signature}`;

  const defaultHeaders: Record<string, string> = {
    'Authorization': authHeader,
  };

  if (!(options.body instanceof FormData)) {
    defaultHeaders['Content-Type'] = 'application/json';
  }

  const url = `${device.ipAddress}${endpoint}`;

  return fetch(url, {
    mode: 'cors',
    ...options,
    headers: {
      ...defaultHeaders,
      ...options.headers,
    },
  });
}

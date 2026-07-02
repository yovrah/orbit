import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useLiveQuery } from 'dexie-react-hooks';

import { db } from '../db/clientDb';
import { fetchWithAuth } from '../api/client';
import { useWebSocket } from '../hooks/useWebSocket';
import { usePing } from '../hooks/usePing';
import { haptic } from '../lib/haptics';
import type { ControlEvent, Device, KbLayout, Theme } from '../types';

/** UUID generator that also works over plain HTTP (crypto.randomUUID needs a
 * secure context, which a LAN http:// origin is not). */
function genUuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

interface Connection {
  label: string;
  tone: 'idle' | 'warn' | 'ok';
  /** Round-trip latency to the agent in ms, or null while unmeasured/offline. */
  pingMs: number | null;
}

interface OrbitSettings {
  theme: Theme;
  sensitivity: number;
  scrollSensitivity: number;
  kbLayout: KbLayout;
}

interface OrbitContextValue {
  // Devices & connection
  activeDevice: Device | null;
  devices: Device[];
  isConnected: boolean;
  isAuthorized: boolean;
  /** True when the active device is connected AND authorized — safe to send input. */
  isReady: boolean;
  connection: Connection;
  setActiveDeviceUuid: (uuid: string | null) => Promise<void>;

  // Transport
  sendEvent: (payload: ControlEvent) => void;
  request: (endpoint: string, init?: RequestInit) => Promise<Response>;
  postSystemAction: (endpoint: string, body?: unknown) => Promise<void>;

  // Settings
  settings: OrbitSettings;
  toggleTheme: () => Promise<void>;
  setSensitivity: (value: number) => Promise<void>;
  setScrollSensitivity: (value: number) => Promise<void>;
  setKbLayout: (value: KbLayout) => Promise<void>;

  // Audio mirror toggle (header)
  audioEnabled: boolean;
  setAudioEnabled: (value: boolean) => void;

  // Overlays
  openPairing: () => void;
  openSettings: () => void;
}

const OrbitContext = createContext<OrbitContextValue | null>(null);

interface OrbitProviderProps {
  children: ReactNode;
  onOpenPairing: () => void;
  onOpenSettings: () => void;
}

export function OrbitProvider({ children, onOpenPairing, onOpenSettings }: OrbitProviderProps) {
  // Settings
  const [theme, setTheme] = useState<Theme>('light');
  const [sensitivity, setSensitivityState] = useState(1.0);
  const [scrollSensitivity, setScrollSensitivityState] = useState(1.0);
  const [kbLayout, setKbLayoutState] = useState<KbLayout>('en');
  const [audioEnabled, setAudioEnabled] = useState(false);

  // Devices ordered most-recently-connected first.
  const devices = useLiveQuery(() => db.devices.orderBy('lastConnected').reverse().toArray()) || [];

  // Explicitly selected device by UUID (stable across unrelated db writes).
  const [activeUuid, setActiveUuid] = useState<string | null>(null);
  const activeUuidRef = useRef<string | null>(null);
  useEffect(() => {
    activeUuidRef.current = activeUuid;
  }, [activeUuid]);

  const activeDevice =
    (activeUuid ? devices.find((d) => d.uuid === activeUuid) : null) || devices[0] || null;

  const { isConnected, isAuthorized, sendEvent } = useWebSocket(activeDevice);
  const isReady = Boolean(activeDevice && isConnected && isAuthorized);

  const setActiveDeviceUuid = useCallback(async (uuid: string | null) => {
    setActiveUuid(uuid);
    try {
      await db.settings.put({ key: 'active_device_uuid', value: uuid ?? '' });
    } catch (err) {
      console.error('Failed to persist active device uuid:', err);
    }
  }, []);

  // Load persisted configuration once.
  useEffect(() => {
    const load = async () => {
      const resetFlag = await db.settings.get('theme_reset_v2');
      if (!resetFlag) {
        await db.settings.put({ key: 'theme', value: 'light' });
        await db.settings.put({ key: 'theme_reset_v2', value: 'true' });
        setTheme('light');
      } else {
        const stored = await db.settings.get('theme');
        if (stored) setTheme(stored.value);
      }

      const storedSens = await db.settings.get('sensitivity');
      if (storedSens) setSensitivityState(Number(storedSens.value));
      else await db.settings.put({ key: 'sensitivity', value: '1.0' });

      const storedScroll = await db.settings.get('scroll_sensitivity');
      if (storedScroll) setScrollSensitivityState(Number(storedScroll.value));
      else await db.settings.put({ key: 'scroll_sensitivity', value: '1.0' });

      const storedLayout = await db.settings.get('kb_layout');
      if (storedLayout) setKbLayoutState(storedLayout.value as KbLayout);
      else await db.settings.put({ key: 'kb_layout', value: 'en' });

      const storedActiveUuid = await db.settings.get('active_device_uuid');
      if (storedActiveUuid && storedActiveUuid.value) setActiveUuid(storedActiveUuid.value);
    };
    load();
  }, []);

  // Reflect theme on the root element.
  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove('theme-light', 'theme-dark');
    root.classList.add(`theme-${theme}`);
  }, [theme]);

  // App-wide tactile feedback: a soft tick whenever any button is pressed.
  // No-ops on platforms without the Vibration API (e.g. iOS).
  useEffect(() => {
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest('button')) haptic(8);
    };
    window.addEventListener('pointerdown', onPointerDown, { passive: true });
    return () => window.removeEventListener('pointerdown', onPointerDown);
  }, []);

  // Auto-pair when the PWA is served directly from the agent (loopback only).
  useEffect(() => {
    const autoPairLocal = async () => {
      if (window.location.port !== '23810') return;

      const host = window.location.hostname;
      const isLocalhost = host === 'localhost' || host === '127.0.0.1' || host === '::1';
      if (!isLocalhost) {
        const existing = await db.devices.where('uuid').equals('local-auto-paired-uuid').first();
        if (existing) await db.devices.delete(existing.id!);
        return;
      }

      const localOrigin = `${window.location.protocol}//${window.location.hostname}:23810`;
      let secret = 'LOCAL_SECRET';
      try {
        const res = await fetch(`${localOrigin}/api/v1/local/secret`);
        if (res.ok) secret = (await res.json()).secret;
      } catch {
        /* ignore */
      }

      const existing = await db.devices.where('uuid').equals('local-auto-paired-uuid').first();
      if (existing) {
        if (
          existing.ipAddress !== localOrigin ||
          existing.name !== 'This Computer' ||
          existing.sharedSecret !== secret
        ) {
          await db.devices.update(existing.id!, {
            ipAddress: localOrigin,
            name: 'This Computer',
            osVersion: 'Local',
            sharedSecret: secret,
          });
        }
        if (!activeUuidRef.current) await setActiveDeviceUuid('local-auto-paired-uuid');
        return;
      }

      if ((await db.devices.count()) === 0) {
        await db.devices.add({
          uuid: 'local-auto-paired-uuid',
          name: 'This Computer',
          ipAddress: localOrigin,
          port: 23810,
          macAddress: '00:00:00:00:00:00',
          osName: 'Windows',
          osVersion: 'Local',
          sharedSecret: secret,
          isPaired: true,
          lastConnected: new Date(),
        });
        await setActiveDeviceUuid('local-auto-paired-uuid');
      }
    };
    autoPairLocal();
  }, [setActiveDeviceUuid]);

  // Auto-pair when the app is opened from the agent over the LAN. Opening the
  // agent's URL on the phone (with or without a ?pair=<token> from a scanned QR)
  // pairs and connects automatically — no PIN, no manual entry. If a device for
  // this host already exists we just reactivate it instead of re-pairing.
  useEffect(() => {
    // Only when served by the agent itself.
    if (window.location.port !== '23810') return;
    const host = window.location.hostname;
    const isLoopback = host === 'localhost' || host === '127.0.0.1' || host === '::1';
    if (isLoopback) return; // loopback is handled by autoPairLocal()

    const origin = `${window.location.protocol}//${window.location.host}`;
    const params = new URLSearchParams(window.location.search);
    const urlToken = params.get('pair');

    const stripParam = () => {
      if (!urlToken) return;
      const url = new URL(window.location.href);
      url.searchParams.delete('pair');
      window.history.replaceState({}, '', url.pathname + url.search + url.hash);
    };

    const autoPair = async () => {
      try {
        const existing = await db.devices.where('ipAddress').equals(origin).first();

        // Already paired with this PC and not forcing a re-pair: just connect.
        if (existing && !urlToken) {
          if (!activeUuidRef.current) await setActiveDeviceUuid(existing.uuid);
          return;
        }

        // Need a token: from the scanned QR, or fetched from the agent (LAN-only).
        let token = urlToken;
        if (!token) {
          try {
            const r = await fetch(`${origin}/api/v1/pair/token`);
            if (r.ok) token = (await r.json()).token;
          } catch {
            /* ignore — agent unreachable */
          }
        }
        if (!token) return;

        const clientId = existing?.uuid || genUuid();
        const res = await fetch(`${origin}/api/v1/pair/qr`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ client_id: clientId, client_name: 'Orbit Phone', token }),
        });
        if (!res.ok) {
          console.error('Auto-pair rejected:', res.status);
          return;
        }
        const data = await res.json();
        const secret: string = data.encrypted_shared_secret;
        const mac: string = data.mac_address || '00:00:00:00:00:00';

        if (existing) {
          await db.devices.update(existing.id!, {
            sharedSecret: secret,
            macAddress:
              existing.macAddress && existing.macAddress !== '00:00:00:00:00:00'
                ? existing.macAddress
                : mac,
            isPaired: true,
            lastConnected: new Date(),
          });
        } else {
          await db.devices.add({
            uuid: clientId,
            name: 'My PC',
            ipAddress: origin,
            port: 23810,
            macAddress: mac,
            osName: 'Windows',
            osVersion: '1.0.0',
            sharedSecret: secret,
            isPaired: true,
            lastConnected: new Date(),
          });
        }
        await setActiveDeviceUuid(clientId);
      } catch (err) {
        console.error('Auto-pair failed:', err);
      } finally {
        stripParam();
      }
    };

    autoPair();
  }, [setActiveDeviceUuid]);

  // Backfill the MAC address once the device is reachable (placeholder only).
  useEffect(() => {
    if (!activeDevice || !isConnected || !isAuthorized) return;
    if (activeDevice.macAddress && activeDevice.macAddress !== '00:00:00:00:00:00') return;

    const updateMac = async () => {
      try {
        const res = await fetchWithAuth(activeDevice, '/api/v1/ping');
        if (res.ok) {
          const data = await res.json();
          if (data.mac_address && data.mac_address !== '00:00:00:00:00:00') {
            await db.devices.update(activeDevice.id!, { macAddress: data.mac_address });
          }
        }
      } catch (err) {
        console.error('Failed to auto-update MAC address:', err);
      }
    };
    updateMac();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeDevice?.uuid, activeDevice?.macAddress, isConnected, isAuthorized]);

  const request = useCallback(
    (endpoint: string, init?: RequestInit) => fetchWithAuth(activeDevice, endpoint, init),
    [activeDevice]
  );

  const pingMs = usePing(activeDevice, isReady, request);

  const connection = useMemo<Connection>(() => {
    if (!activeDevice) return { label: 'No PC', tone: 'idle', pingMs: null };
    if (!isConnected) return { label: 'Connecting', tone: 'warn', pingMs: null };
    if (!isAuthorized) return { label: 'Authorizing', tone: 'warn', pingMs: null };
    return { label: pingMs != null ? `Online · ${pingMs}ms` : 'Online', tone: 'ok', pingMs };
  }, [activeDevice, isAuthorized, isConnected, pingMs]);

  const postSystemAction = useCallback(
    async (endpoint: string, body?: unknown) => {
      if (!activeDevice) return;
      try {
        await fetchWithAuth(activeDevice, endpoint, {
          method: 'POST',
          body: body !== undefined ? JSON.stringify(body) : undefined,
        });
      } catch (err) {
        console.error(`Action failed: ${endpoint}`, err);
      }
    },
    [activeDevice]
  );

  const toggleTheme = useCallback(async () => {
    const next: Theme = theme === 'light' ? 'dark' : 'light';
    setTheme(next);
    await db.settings.put({ key: 'theme', value: next });
  }, [theme]);

  const setSensitivity = useCallback(async (value: number) => {
    setSensitivityState(value);
    await db.settings.put({ key: 'sensitivity', value: String(value) });
  }, []);

  const setScrollSensitivity = useCallback(async (value: number) => {
    setScrollSensitivityState(value);
    await db.settings.put({ key: 'scroll_sensitivity', value: String(value) });
  }, []);

  const setKbLayout = useCallback(async (value: KbLayout) => {
    setKbLayoutState(value);
    await db.settings.put({ key: 'kb_layout', value });
  }, []);

  const value = useMemo<OrbitContextValue>(
    () => ({
      activeDevice,
      devices,
      isConnected,
      isAuthorized,
      isReady,
      connection,
      setActiveDeviceUuid,
      sendEvent,
      request,
      postSystemAction,
      settings: { theme, sensitivity, scrollSensitivity, kbLayout },
      toggleTheme,
      setSensitivity,
      setScrollSensitivity,
      setKbLayout,
      audioEnabled,
      setAudioEnabled,
      openPairing: onOpenPairing,
      openSettings: onOpenSettings,
    }),
    [
      activeDevice,
      devices,
      isConnected,
      isAuthorized,
      isReady,
      connection,
      setActiveDeviceUuid,
      sendEvent,
      request,
      postSystemAction,
      theme,
      sensitivity,
      scrollSensitivity,
      kbLayout,
      toggleTheme,
      setSensitivity,
      setScrollSensitivity,
      setKbLayout,
      audioEnabled,
      onOpenPairing,
      onOpenSettings,
    ]
  );

  return <OrbitContext.Provider value={value}>{children}</OrbitContext.Provider>;
}

export function useOrbit(): OrbitContextValue {
  const ctx = useContext(OrbitContext);
  if (!ctx) throw new Error('useOrbit must be used within an OrbitProvider');
  return ctx;
}

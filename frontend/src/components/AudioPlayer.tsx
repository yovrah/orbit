import { useEffect, useRef } from 'react';
import { buildWsUrl } from '../api/client';
import { useOrbit } from '../state/OrbitContext';

/** Background system-audio player. Streams only while the header toggle is on. */
export function AudioPlayer() {
  const { activeDevice, isAuthorized, audioEnabled: isEnabled } = useOrbit();
  const wsRef = useRef<WebSocket | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const nextPlayTimeRef = useRef<number>(0);

  useEffect(() => {
    if (!activeDevice || !isAuthorized || !isEnabled) {
      if (audioCtxRef.current) {
        audioCtxRef.current.close().catch(() => {});
        audioCtxRef.current = null;
      }
      return;
    }

    // Initialize Web Audio context
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    const audioCtx = new AudioContextClass();
    audioCtxRef.current = audioCtx;
    nextPlayTimeRef.current = audioCtx.currentTime;

    // Connect to WebSocket audio stream (signed via query params in buildWsUrl).
    const wsUrl = buildWsUrl(activeDevice, '/ws/system/audio');
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;
    ws.binaryType = 'arraybuffer';

    ws.onmessage = (event) => {
      if (!(event.data instanceof ArrayBuffer)) return;

      const pcm16 = new Int16Array(event.data);
      const sampleCount = pcm16.length / 2; // Stereo has 2 channels
      if (sampleCount === 0) return;

      // Extract left and right channels
      const leftChannel = new Float32Array(sampleCount);
      const rightChannel = new Float32Array(sampleCount);

      for (let i = 0; i < sampleCount; i++) {
        leftChannel[i] = pcm16[i * 2] / 32768.0;
        rightChannel[i] = pcm16[i * 2 + 1] / 32768.0;
      }

      // Create AudioBuffer
      const audioBuffer = audioCtx.createBuffer(2, sampleCount, 44100);
      audioBuffer.copyToChannel(leftChannel, 0);
      audioBuffer.copyToChannel(rightChannel, 1);

      // Audio scheduling to prevent stuttering
      const source = audioCtx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioCtx.destination);

      let playTime = nextPlayTimeRef.current;
      const now = audioCtx.currentTime;

      // Reset playhead if buffer underflow occurred
      if (playTime < now) {
        playTime = now + 0.05; // 50ms buffer safety margin
      }

      source.start(playTime);
      nextPlayTimeRef.current = playTime + audioBuffer.duration;
    };

    return () => {
      ws.close();
      if (wsRef.current) wsRef.current = null;
      if (audioCtxRef.current) {
        audioCtxRef.current.close().catch(() => {});
        audioCtxRef.current = null;
      }
    };
    // Dep by uuid (not object identity) so unrelated device-row writes don't
    // tear down the audio socket. isAuthorized/isEnabled are primitives.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeDevice?.uuid, isAuthorized, isEnabled]);

  return null; // Silent utility background player
}

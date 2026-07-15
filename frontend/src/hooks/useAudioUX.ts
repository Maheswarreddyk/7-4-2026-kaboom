import { useCallback, useRef } from 'react';

// Create a singleton AudioContext so we don't recreate it on every hook call
let audioCtx: AudioContext | null = null;
const getAudioContext = () => {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  return audioCtx;
};

export function useAudioUX() {
  const isEnabled = useRef(true); // could tie this to a global setting later

  const playTone = useCallback((frequency: number, type: OscillatorType, duration: number, vol = 0.1) => {
    if (!isEnabled.current) return;
    try {
      const ctx = getAudioContext();
      if (ctx.state === 'suspended') ctx.resume();

      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();

      oscillator.type = type;
      oscillator.frequency.setValueAtTime(frequency, ctx.currentTime);

      gainNode.gain.setValueAtTime(0, ctx.currentTime);
      gainNode.gain.linearRampToValueAtTime(vol, ctx.currentTime + 0.05);
      gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);

      oscillator.start();
      oscillator.stop(ctx.currentTime + duration);
    } catch (e) {
      console.warn('AudioContext playTone failed', e);
    }
  }, []);

  const playedQueueJoinMatches = useRef(new Set<string>());
  const playedConnectMatches = useRef(new Set<string>());

  const playQueueJoin = useCallback((matchId?: string) => {
    if (matchId) {
      if (playedQueueJoinMatches.current.has(matchId)) return;
      playedQueueJoinMatches.current.add(matchId);
    }
    // Subtle blip to indicate matchmaking initiated
    playTone(440, 'sine', 0.1, 0.05); // A4
  }, [playTone]);

  const playConnected = useCallback((matchId?: string) => {
    if (matchId) {
      if (playedConnectMatches.current.has(matchId)) return;
      playedConnectMatches.current.add(matchId);
    }
    // Soft, ascending chime (C major chord spread)
    playTone(523.25, 'sine', 0.5, 0.05); // C5
    setTimeout(() => playTone(659.25, 'sine', 0.5, 0.05), 100); // E5
    setTimeout(() => playTone(783.99, 'sine', 0.7, 0.05), 200); // G5
  }, [playTone]);

  return { playQueueJoin, playConnected };
}

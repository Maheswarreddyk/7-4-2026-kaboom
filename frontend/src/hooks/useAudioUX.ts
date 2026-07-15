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

  const playedConnectMatches = useRef(new Set<string>());
  const playedDisconnectMatches = useRef(new Set<string>());
  const playedLikeMatches = useRef(new Set<string>());

  const playConnect = useCallback((matchId?: string) => {
    if (matchId) {
      if (playedConnectMatches.current.has(matchId)) return;
      playedConnectMatches.current.add(matchId);
    }
    // Soft, ascending chime (C major chord spread)
    playTone(523.25, 'sine', 0.5, 0.05); // C5
    setTimeout(() => playTone(659.25, 'sine', 0.5, 0.05), 100); // E5
    setTimeout(() => playTone(783.99, 'sine', 0.7, 0.05), 200); // G5
  }, [playTone]);

  const playDisconnect = useCallback((matchId?: string) => {
    if (matchId) {
      if (playedDisconnectMatches.current.has(matchId)) return;
      playedDisconnectMatches.current.add(matchId);
    }
    // Soft, descending muted tone
    playTone(440, 'triangle', 0.4, 0.05); // A4
    setTimeout(() => playTone(349.23, 'triangle', 0.5, 0.05), 150); // F4
  }, [playTone]);

  const playMutualLike = useCallback((matchId?: string) => {
    if (matchId) {
      if (playedLikeMatches.current.has(matchId)) return;
      playedLikeMatches.current.add(matchId);
    }
    // Bright, celebratory major chord
    playTone(523.25, 'sine', 0.6, 0.08); // C5
    playTone(659.25, 'sine', 0.6, 0.08); // E5
    playTone(783.99, 'sine', 0.8, 0.1); // G5
    setTimeout(() => playTone(1046.50, 'sine', 1.0, 0.1), 150); // C6
  }, [playTone]);

  return { playConnect, playDisconnect, playMutualLike };
}

import { useEffect, useState } from 'react';

const CHANNEL_NAME = 'kaboom_tab_leader_channel';
const HEARTBEAT_INTERVAL_MS = 2000;   // Leader pings every 2s
const LEADER_TIMEOUT_MS = 5000;       // Follower promotes itself if no heartbeat for 5s

/**
 * useTabLeader — determines whether this browser tab is the "leader" tab.
 *
 * Protocol:
 * 1. On mount, every tab pings PING_LEADER.
 * 2. An existing leader responds I_AM_LEADER, marking the caller as a follower.
 * 3. The leader sends HEARTBEAT every 2s to prove it's alive.
 * 4. Followers start a 5s watchdog timer that resets on each HEARTBEAT.
 *    If the timer expires (leader crashed/closed), the follower self-promotes to leader.
 * 5. BroadcastChannel is not supported on iOS Safari < 15.4 — in that case
 *    every tab is treated as the leader (acceptable degradation).
 */
export function useTabLeader() {
  const [isFollower, setIsFollower] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.BroadcastChannel) {
      // BroadcastChannel not available (iOS Safari < 15.4, some older browsers)
      // Treat every tab as leader — safe degradation, just means no multi-tab guard.
      return;
    }

    const channel = new BroadcastChannel(CHANNEL_NAME);
    let isLeader = true; // Assume leader until proven otherwise
    let heartbeatInterval: ReturnType<typeof setInterval> | null = null;
    let leaderWatchdog: ReturnType<typeof setTimeout> | null = null;

    const promoteToLeader = () => {
      isLeader = true;
      setIsFollower(false);
      // Clear watchdog — we're now in charge
      if (leaderWatchdog) { clearTimeout(leaderWatchdog); leaderWatchdog = null; }
      // Start heartbeat
      if (heartbeatInterval) clearInterval(heartbeatInterval);
      heartbeatInterval = setInterval(() => {
        channel.postMessage('HEARTBEAT');
      }, HEARTBEAT_INTERVAL_MS);
    };

    const resetWatchdog = () => {
      if (leaderWatchdog) clearTimeout(leaderWatchdog);
      leaderWatchdog = setTimeout(() => {
        // Leader went silent — self-promote
        promoteToLeader();
      }, LEADER_TIMEOUT_MS);
    };

    channel.onmessage = (event) => {
      const msg = event.data;
      if (msg === 'PING_LEADER') {
        if (isLeader) {
          channel.postMessage('I_AM_LEADER');
        }
      } else if (msg === 'I_AM_LEADER') {
        if (isLeader) {
          // Another leader exists — we become follower
          isLeader = false;
          setIsFollower(true);
          if (heartbeatInterval) { clearInterval(heartbeatInterval); heartbeatInterval = null; }
          resetWatchdog(); // Start watching for leader silence
        }
      } else if (msg === 'HEARTBEAT') {
        if (!isLeader) {
          resetWatchdog(); // Leader still alive — reset watchdog
        }
      }
    };

    // When this tab opens, ask if there is a leader
    channel.postMessage('PING_LEADER');

    // Wait briefly for I_AM_LEADER response — if none arrives, start heartbeat as leader
    const initTimer = setTimeout(() => {
      if (isLeader) {
        promoteToLeader();
      }
    }, 300);

    return () => {
      clearTimeout(initTimer);
      if (heartbeatInterval) clearInterval(heartbeatInterval);
      if (leaderWatchdog) clearTimeout(leaderWatchdog);
      channel.close();
    };
  }, []);

  return { isFollower };
}

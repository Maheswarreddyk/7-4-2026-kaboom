import { useEffect, useState } from 'react';

const CHANNEL_NAME = 'kaboom_tab_leader_channel';

export function useTabLeader() {
  const [isFollower, setIsFollower] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.BroadcastChannel) {
      return;
    }

    const channel = new BroadcastChannel(CHANNEL_NAME);
    let isLeader = true; // Assume leader until proven otherwise

    // Listen for messages from other tabs
    channel.onmessage = (event) => {
      if (event.data === 'PING_LEADER') {
        if (isLeader) {
          channel.postMessage('I_AM_LEADER');
        }
      } else if (event.data === 'I_AM_LEADER') {
        isLeader = false;
        setIsFollower(true);
      }
    };

    // When this tab opens, ask if there is a leader
    channel.postMessage('PING_LEADER');

    return () => {
      channel.close();
    };
  }, []);

  return { isFollower };
}

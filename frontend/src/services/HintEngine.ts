export interface HintState {
  appState: 'waiting' | 'connected' | 'connecting' | 'idle';
  micMuted: boolean;
  cameraOff: boolean;
  isMobile: boolean;
  waitingSeconds: number;
  connectedSeconds: number;
  hasExchangedMessages: boolean;
  hasLiked: boolean;
  partnerLiked: boolean; // Not shown to user, only used internally to trigger subtle hint
}

const WAITING_HINTS = [
  "💜 Looking for someone nearby? Try using Location Filters.",
  "🎯 Want better matches? Add a few interests.",
  "🌍 Choose your preferred country for more relevant connections.",
  "👩 Looking for female users? Try Gender Filters.",
  "🎮 Shared interests increase your match quality.",
  "🎵 Music lovers often connect faster using Interest Filters.",
  "✨ Personalize your experience using Filters.",
  "🌎 You can search globally or narrow your location.",
  "❤️ Your perfect match might be one filter away.",
  "🍔 Foodies? Add food/cooking to your interest filters.",
  "🎬 Movie buff? Search matching interests for cinema.",
  "✈️ Love traveling? Find travel buddies globally.",
  "📚 Bookworm? Filter for reading and literature.",
  "📸 Share creative vibes by selecting arts/photography.",
  "💻 Tech geek? Hook up with developers using Tech filters.",
  "🧘 Yoga or fitness? Find fitness partners via interests.",
  "🐕 Pet lover? Check for animal lover tags.",
  "☕ Love coffee chats? Use the filter tags.",
  "🎨 Art and design lovers are here, try tagging art.",
  "⚽ Football or sports fans? Tag sports tags.",
  "🍜 Ramen night? Find foodies now.",
  "🚀 Exploring startups? Filter for entrepreneur tags.",
  "🎧 Lofi beats? Tag music to find matching vibes.",
  "🍿 Binge-watcher? Find fellow show buffs.",
  "💡 Curious minds? Tag philosophy or science.",
  "🌲 Hiking or nature? Find outdoor buddies.",
  "🎤 Karaoke fans? Match your interest!",
  "♟️ Chess or board games? Add game filters.",
  "🍣 Sushi lovers unite under the foodie tag.",
  "🌟 Premium vibes? Filter by language for better conversations.",
  "🗺️ Discover people from around the world!",
  "🗣️ Practice languages by filtering for fluent speakers.",
  "🇺🇸 Looking to chat in English? Select language filters.",
  "🇪🇸 Hablas español? Select Spanish in language filters.",
  "🇫🇷 Parlez-vous français? Match with French speakers.",
  "🇮🇳 Connecting locally in India? Set your location filters.",
  "🤝 Looking for friends? Customize your filters.",
  "💬 Introduce yourself with custom interest tags."
];

const CONNECTED_HINTS = [
  "❤️ Enjoying the conversation? Tap ❤️ to save this connection.",
  "💬 Need to type instead? Open Temporary Chat.",
  "😊 Some conversations start easier with a message.",
  "🎉 Both users must like each other to create a Mutual Match.",
  "✨ Press ❤️ if you'd like to meet again.",
  "📨 Use Temporary Chat if audio is unclear.",
  "🎤 You can mute your microphone anytime.",
  "🎥 Switch cameras using the camera control.",
  "➡️ Not the right match? Tap Next to meet someone new."
];

export class HintEngine {
  private lastHint: string | null = null;
  private dismissedOneTimeHints: Set<string> = new Set();

  constructor() {
    try {
      const dismissed = localStorage.getItem('dismissed_hints');
      if (dismissed) {
        this.dismissedOneTimeHints = new Set(JSON.parse(dismissed));
      }
    } catch {
      // Ignored
    }
  }

  dismissOneTimeHint(hintId: string) {
    this.dismissedOneTimeHints.add(hintId);
    try {
      localStorage.setItem('dismissed_hints', JSON.stringify(Array.from(this.dismissedOneTimeHints)));
    } catch {
      // Ignored
    }
  }

  getHint(state: HintState): string | null {
    // 1. One-time settings/filters hints for first-time users
    if (!this.dismissedOneTimeHints.has('settings_onboarding')) {
      return "⚙️ Adjust camera and microphone settings anytime.";
    }
    if (!this.dismissedOneTimeHints.has('filters_onboarding') && state.appState === 'waiting') {
      return "⚙️ Customize filters to improve your matches.";
    }

    // 2. Full screen / double tap orientation discovery
    if (state.appState === 'connected') {
      if (state.isMobile && !this.dismissedOneTimeHints.has('mobile_rotate')) {
        return "📱 Rotate your phone for a larger video experience.";
      }
      if (!state.isMobile && !this.dismissedOneTimeHints.has('desktop_fullscreen')) {
        return "🖥️ Double-click the video to enter immersive mode.";
      }
    }

    // 3. Waiting Queue state hints
    if (state.appState === 'waiting') {
      // If waiting for a long time (>30s), advise relaxing filters
      if (state.waitingSeconds >= 30 && !this.lastHint?.includes('relax')) {
        return "💡 Long wait time? Try relaxing location/gender filters to search broader.";
      }
      
      // Select random waiting hint that wasn't shown last
      const available = WAITING_HINTS.filter(h => h !== this.lastHint);
      if (available.length === 0) return null;
      const index = Math.floor(Math.random() * available.length);
      const hint = available[index];
      this.lastHint = hint;
      return hint;
    }

    // 4. Connected state contextual highlights
    if (state.appState === 'connected') {
      // Chat Discovery
      if (state.micMuted && !state.hasExchangedMessages && state.connectedSeconds >= 10) {
        return "💬 Can't talk? Temporary Chat is always available.";
      }
      if (!state.hasExchangedMessages && state.connectedSeconds >= 20) {
        return "💬 Break the ice with a quick message.";
      }

      // Like / Mutual Match Discovery
      if (state.connectedSeconds >= 25 && !state.hasLiked) {
        if (state.partnerLiked) {
          return "❤️ Someone may already like this conversation...";
        }
        return "❤️ Having a good conversation? Tap ❤️ if you'd like to meet again.";
      }

      // Next Discovery
      if (state.connectedSeconds >= 90 && !state.hasLiked) {
        return "➡️ Ready for someone new? Tap Next anytime.";
      }

      // Standard randomized connected hints
      const available = CONNECTED_HINTS.filter(h => h !== this.lastHint);
      if (available.length === 0) return null;
      const index = Math.floor(Math.random() * available.length);
      const hint = available[index];
      this.lastHint = hint;
      return hint;
    }

    return null;
  }
}

export const hintEngine = new HintEngine();

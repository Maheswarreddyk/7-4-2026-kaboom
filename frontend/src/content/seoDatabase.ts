export interface SeoItem {
  slug: string;
  title: string;
  description: string;
  h1: string;
  category: 'core' | 'countries' | 'languages' | 'devices' | 'intent' | 'features' | 'comparisons' | 'glossary' | 'safety' | 'blog' | 'guides';
  tags: string[];
  readTime: number;
  lastUpdated: string;
  popular: boolean;
  
  // Custom meta params for dynamic compile
  primaryKeyword: string;
  details: Record<string, any>;
}

// 1. Countries List (32 target countries)
export const SEO_COUNTRIES = [
  { name: 'India', code: 'IN', lang: 'Hindi & English', availability: '95%', safetyScore: 8.5 },
  { name: 'USA', code: 'US', lang: 'English', availability: '98%', safetyScore: 9.0 },
  { name: 'UK', code: 'GB', lang: 'English', availability: '97%', safetyScore: 9.1 },
  { name: 'Canada', code: 'CA', lang: 'English & French', availability: '97%', safetyScore: 9.3 },
  { name: 'Australia', code: 'AU', lang: 'English', availability: '96%', safetyScore: 9.2 },
  { name: 'Singapore', code: 'SG', lang: 'English & Mandarin', availability: '99%', safetyScore: 9.5 },
  { name: 'Japan', code: 'JP', lang: 'Japanese', availability: '98%', safetyScore: 9.6 },
  { name: 'Germany', code: 'DE', lang: 'German', availability: '97%', safetyScore: 9.1 },
  { name: 'France', code: 'FR', lang: 'French', availability: '96%', safetyScore: 8.9 },
  { name: 'Italy', code: 'IT', lang: 'Italian', availability: '95%', safetyScore: 8.8 },
  { name: 'Spain', code: 'ES', lang: 'Spanish', availability: '96%', safetyScore: 9.0 },
  { name: 'South Korea', code: 'KR', lang: 'Korean', availability: '99%', safetyScore: 9.4 },
  { name: 'Brazil', code: 'BR', lang: 'Portuguese', availability: '92%', safetyScore: 8.0 },
  { name: 'Mexico', code: 'MX', lang: 'Spanish', availability: '91%', safetyScore: 8.1 },
  { name: 'Netherlands', code: 'NL', lang: 'Dutch & English', availability: '98%', safetyScore: 9.4 },
  { name: 'Belgium', code: 'BE', lang: 'Dutch & French', availability: '97%', safetyScore: 9.2 },
  { name: 'Sweden', code: 'SE', lang: 'Swedish & English', availability: '98%', safetyScore: 9.5 },
  { name: 'Norway', code: 'NO', lang: 'Norwegian', availability: '98%', safetyScore: 9.6 },
  { name: 'Finland', code: 'FI', lang: 'Finnish', availability: '98%', safetyScore: 9.7 },
  { name: 'Ireland', code: 'IE', lang: 'English', availability: '96%', safetyScore: 9.3 },
  { name: 'Switzerland', code: 'CH', lang: 'German, French & Italian', availability: '98%', safetyScore: 9.6 },
  { name: 'South Africa', code: 'ZA', lang: 'English', availability: '89%', safetyScore: 7.9 },
  { name: 'New Zealand', code: 'NZ', lang: 'English', availability: '96%', safetyScore: 9.5 },
  { name: 'Malaysia', code: 'MY', lang: 'Malay & English', availability: '94%', safetyScore: 8.6 },
  { name: 'Indonesia', code: 'ID', lang: 'Indonesian', availability: '88%', safetyScore: 8.2 },
  { name: 'Philippines', code: 'PH', lang: 'Tagalog & English', availability: '90%', safetyScore: 8.3 },
  { name: 'UAE', code: 'AE', lang: 'Arabic & English', availability: '97%', safetyScore: 9.1 },
  { name: 'Saudi Arabia', code: 'SA', lang: 'Arabic', availability: '95%', safetyScore: 8.8 },
  { name: 'Pakistan', code: 'PK', lang: 'Urdu & English', availability: '87%', safetyScore: 7.8 },
  { name: 'Bangladesh', code: 'BD', lang: 'Bengali', availability: '86%', safetyScore: 7.9 },
  { name: 'Sri Lanka', code: 'LK', lang: 'Sinhala & Tamil', availability: '89%', safetyScore: 8.1 },
  { name: 'Nepal', code: 'NP', lang: 'Nepali', availability: '85%', safetyScore: 8.0 }
];

// 2. Languages List (14 target languages)
export const SEO_LANGUAGES = [
  { name: 'English', nativeName: 'English', speakers: '1.4B', usage: 'global communications' },
  { name: 'Hindi', nativeName: 'हिन्दी', speakers: '600M', usage: 'Indian subcontinent communication' },
  { name: 'Spanish', nativeName: 'Español', speakers: '548M', usage: 'Latin America & Spain connections' },
  { name: 'French', nativeName: 'Français', speakers: '274M', usage: 'Europe & Africa exchange' },
  { name: 'German', nativeName: 'Deutsch', speakers: '130M', usage: 'Central European dialogue' },
  { name: 'Telugu', nativeName: 'తెలుగు', speakers: '96M', usage: 'South Indian regional chat' },
  { name: 'Tamil', nativeName: 'தமிழ்', speakers: '85M', usage: 'South Indian & Singaporean chat' },
  { name: 'Kannada', nativeName: 'ಕನ್ನಡ', speakers: '55M', usage: 'Karnataka regional exchange' },
  { name: 'Malayalam', nativeName: 'മലയാളം', speakers: '38M', usage: 'Kerala regional chat' },
  { name: 'Portuguese', nativeName: 'Português', speakers: '258M', usage: 'Brazilian & Portuguese dialogue' },
  { name: 'Arabic', nativeName: 'العربية', speakers: '360M', usage: 'Middle Eastern connections' },
  { name: 'Japanese', nativeName: '日本語', speakers: '125M', usage: 'East Asian regional exchange' },
  { name: 'Korean', nativeName: '한국어', speakers: '80M', usage: 'Korean peninsula dialogue' },
  { name: 'Russian', nativeName: 'Русский', speakers: '258M', usage: 'Eurasian communications' }
];

// 3. Operating Systems & Devices
export const SEO_DEVICES = [
  { name: 'Android', type: 'mobile', engine: 'WebKit/Blink', browser: 'Chrome Mobile' },
  { name: 'iPhone', type: 'mobile', engine: 'WebKit', browser: 'Safari Mobile' },
  { name: 'iPad', type: 'tablet', engine: 'WebKit', browser: 'Safari Mobile' },
  { name: 'Mac', type: 'desktop', engine: 'WebKit/Blink', browser: 'Safari/Chrome' },
  { name: 'Windows', type: 'desktop', engine: 'Blink/Gecko', browser: 'Chrome/Edge/Firefox' },
  { name: 'Linux', type: 'desktop', engine: 'Blink/Gecko', browser: 'Chrome/Firefox' },
  { name: 'Chromebook', type: 'laptop', engine: 'Blink', browser: 'Chrome OS' },
  { name: 'Tablet', type: 'tablet', engine: 'Blink', browser: 'Chrome' },
  { name: 'Mobile Browser', type: 'mobile', engine: 'WebKit/Blink', browser: 'Safari/Chrome' },
  { name: 'Desktop Browser', type: 'desktop', engine: 'Blink/WebKit/Gecko', browser: 'Chrome/Safari/Firefox' }
];

// 4. User intents / goals
export const SEO_INTENTS = [
  { term: 'Meet New Friends', focus: 'Social networking & casual chats' },
  { term: 'Talk To Strangers', focus: 'Spontaneous anonymous matching' },
  { term: 'Video Call Random People', focus: 'Live webcam interactions' },
  { term: 'Make Friends Online', focus: 'Long-term friendship networks' },
  { term: 'Practice English', focus: 'Language learning & speaking confidence' },
  { term: 'Practice Languages', focus: 'Cultural exchange & linguistics' },
  { term: 'Social Video Chat', focus: 'Community engagement and fun' },
  { term: 'Late Night Video Chat', focus: 'Spontaneous late-hour matching' },
  { term: 'Student Video Chat', focus: 'Interactions tailored for college students' },
  { term: 'Travelers Video Chat', focus: 'Cultural exchanges for globetrotters' },
  { term: 'Gamers Video Chat', focus: 'Finding gaming partners globally' },
  { term: 'Weekend Video Chat', focus: 'Leisure matchmaking during holidays' }
];

// 5. Product Features
export const SEO_FEATURES = [
  { name: 'No Download', benefit: 'Runs 100% in browser with no install requirements' },
  { name: 'No Sign Up', benefit: 'Zero logins, emails, or personal forms required' },
  { name: 'One Click Chat', benefit: 'Press start chat and match in under 400ms' },
  { name: 'Encrypted Chat', benefit: 'Peer-to-peer signalling and encrypted WebRTC streams' },
  { name: 'HD Video Chat', benefit: 'Adaptive resolution based on network performance metrics' },
  { name: 'Browser Based Chat', benefit: 'HTML5 WebRTC standard supported across platforms' },
  { name: 'Private Chat', benefit: 'Local media feeds that never touch media servers' },
  { name: 'Instant Match', benefit: 'Self-healing matching queue based on Postgres advisory locks' },
  { name: 'Random Match', benefit: 'Global matching or custom filter presets' },
  { name: 'Anonymous Calling', benefit: 'P2P voice and video chat with zero data trace' }
];

// 6. Competitor Comparisons
export const SEO_COMPARISONS = [
  { competitor: 'Omegle', activeYears: '2009-2023', limitation: 'Shutdown due to safety challenges & high moderation costs', differentiator: 'Kaboom TV implements strict automated FSM queues, direct report integrations, and modern glassmorphism UI layout' },
  { competitor: 'OmeTV', activeYears: 'Active', limitation: 'Requires account login, social integration, and contains heavy ad clutter', differentiator: 'Kaboom TV features zero login forms, no downloads, and clean, ad-free visionOS UI elements' },
  { competitor: 'Chatroulette', activeYears: 'Active', limitation: 'Requires registration, purchases of credits, and high lag', differentiator: 'Kaboom TV is 100% free with WebRTC speed optimizations matching in milliseconds' },
  { competitor: 'Chatrandom', activeYears: 'Active', limitation: 'Heavy pop-ups, payment walls for filter queries, and basic developer layout', differentiator: 'Kaboom TV is premium-designed, fully mobile responsive with gestural swipes, and 100% free' },
  { competitor: 'Monkey', activeYears: 'Active', limitation: 'App-heavy, gamified loops targeting younger audiences with data storage', differentiator: 'Kaboom TV is fully browser-based, respects absolute privacy with zero storage, and utilizes pure WebRTC P2P' },
  { competitor: 'Emerald Chat', activeYears: 'Active', limitation: 'Subscription walls, coin systems, and complex account setups', differentiator: 'Kaboom TV is completely un-gated, free, and features modern snapping camera viewports' }
];

// 7. Technical Glossary terms
export const SEO_GLOSSARY = [
  { term: 'WebRTC', definition: 'Web Real-Time Communication. An open-source project providing web browsers with real-time peer-to-peer communications via APIs.' },
  { term: 'TURN', definition: 'Traversal Using Relays around NAT. A protocol that allows nodes behind NAT or firewalls to receive incoming data via a relay server.' },
  { term: 'STUN', definition: 'Session Traversal Utilities for NAT. A protocol to discover public IP addresses and port bindings behind NAT devices.' },
  { term: 'P2P', definition: 'Peer-to-Peer. A decentralized communications model where both parties interact directly with one another without intermediate servers.' },
  { term: 'ICE', definition: 'Interactive Connectivity Establishment. A framework used to find the most efficient routing pathway between WebRTC peers.' },
  { term: 'Codec', definition: 'Coder-Decoder. Hardware or software that compresses/decompresses digital media (like H.264, VP8, or Opus audio).' },
  { term: 'Latency', definition: 'The round-trip delay time taken for media packets to travel between the local browser and the remote peer.' },
  { term: 'Bandwidth', definition: 'The maximum capacity of an internet connection to send or receive media streaming packets per second.' },
  { term: 'Browser', definition: 'The user application hosting the HTML5 WebRTC media context and rendering the layout viewports.' },
  { term: 'WebSocket', definition: 'A persistent, full-duplex communication protocol used to exchange signaling handshakes before direct WebRTC connection.' }
];

// 8. Core SEO Article Guides
export const SEO_GUIDES = [
  { slug: 'best-random-video-chat-apps', title: 'Best Random Video Chat Apps for 2026', desc: 'Discover the top random video chat platforms in 2026. Learn which apps offer the best privacy, speed, HD video, and stranger matching features.' },
  { slug: 'how-anonymous-video-chat-works', title: 'How Anonymous Video Chat Works internally', desc: 'An in-depth look inside anonymous video chat architectures, from signaling channels and metadata matching to encrypted WebRTC media streams.' },
  { slug: 'how-webrtc-powers-video-chat', title: 'How WebRTC Powers Real-Time Video Chat', desc: 'Learn how WebRTC allows browsers to establish direct, peer-to-peer video and audio channels without intermediate media relay servers.' },
  { slug: 'video-chat-safety-guide', title: 'The Ultimate Video Chat Safety Guide', desc: 'Essential tips for staying safe while chatting with strangers online. Learn about browser permissions, data privacy, and automated reporting systems.' },
  { slug: 'meet-new-friends-online', title: 'How to Safely Meet New Friends Online', desc: 'A guides on making genuine friendships online. Learn how to break the ice, practice safety, and identify positive social connection environments.' },
  { slug: 'how-to-talk-with-strangers', title: 'How to Talk with Strangers: Conversation Tips', desc: 'Improve your communication skills! Learn how to introduce yourself, pick interesting topics, keep chats engaging, and handle skips.' },
  { slug: 'how-video-chat-matches-users', title: 'How Video Chat Matchmaking Engines Work', desc: 'Under the hood of matchmaking! Learn about postgres advisory locks, self-healing queues, and matching filters.' },
  { slug: 'why-anonymous-chat-is-growing', title: 'Why Anonymous Chat Platforms Are Growing Rapidly', desc: 'Explore the social shift towards ephemerality, zero-signups, and why people prefer anonymous P2P connections over permanent social networks.' },
  { slug: 'random-video-chat-tips', title: 'Top 10 Random Video Chat Tips for Success', desc: 'Get more high-quality matches! Tips on lighting, introductions, connection stability, and finding interesting conversations.' },
  { slug: 'video-chat-etiquette', title: 'Video Chat Etiquette: Rules of the Road', desc: 'The unwritten rules of anonymous video chat. Learn about respect, boundaries, handling reports, and skipped behaviors.' }
];

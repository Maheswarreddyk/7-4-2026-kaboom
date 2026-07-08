export interface PageSeoConfig {
  title: string;
  description: string;
  keywords: string[];
  canonical: string;
  ogType?: string;
}

export const SEO_GLOBAL = {
  siteName: 'Kaboom',
  brandName: 'Kaboom TV',
  defaultTitle: 'Kaboom – Free Random Video Chat | Meet New People Instantly',
  defaultDescription: 'Meet new people instantly with Kaboom, a free anonymous random video chat platform. No sign-up required. Start video chatting with strangers worldwide in seconds.',
  canonicalUrl: 'https://kaboom-tv.com',
  socialImageUrl: 'https://kaboom-tv.com/og-preview.png',
  keywords: [
    'random video chat',
    'free video chat',
    'anonymous chat',
    'meet new people',
    'stranger chat',
    'chat roulette',
    'omegle alternative',
    'kaboom chat',
    'kaboom tv'
  ],
  organization: {
    name: 'Kaboom TV',
    url: 'https://kaboom-tv.com',
    logo: 'https://kaboom-tv.com/favicon.svg',
    email: 'contact@kaboom-tv.com',
    supportEmail: 'contact@kaboom-tv.com',
    collaborateEmail: 'collaborate@kaboom-tv.com',
    privacyEmail: 'contact@kaboom-tv.com',
    termsUrl: 'https://kaboom-tv.com/terms',
    privacyUrl: 'https://kaboom-tv.com/privacy'
  },
  twitterHandle: '@KaboomTV',
  themeColor: '#f59e0b', // Amber/gold primary color
  brandColors: {
    primary: '#f59e0b',
    background: '#0c0a09'
  },
  locale: 'en_US',
  country: 'US',
  language: 'en'
};

export const SEO_PAGES: Record<string, PageSeoConfig> = {
  home: {
    title: 'Kaboom – Free Random Video Chat | Meet New People Instantly',
    description: 'Meet new people instantly with Kaboom, a free anonymous random video chat platform. No sign-up required. Start video chatting with strangers worldwide in seconds.',
    keywords: ['free random video chat', 'anonymous video chat', 'omegle alternative', 'chat with strangers'],
    canonical: 'https://kaboom-tv.com/'
  },
  about: {
    title: 'About Kaboom | Modern Random Video Chat Platform',
    description: 'Learn about Kaboom, the next-generation random video chat platform designed for fast, safe, anonymous, and premium peer connections globally.',
    keywords: ['about kaboom', 'modern video chat', 'secure chat platform'],
    canonical: 'https://kaboom-tv.com/about'
  },
  faq: {
    title: 'Kaboom FAQ | Random Video Chat Questions Answered',
    description: 'Find answers to common questions about Kaboom. Learn about anonymity, skipping, safety reporting, WebRTC connections, and mobile compatibility.',
    keywords: ['kaboom faq', 'video chat safety', 'how does kaboom work'],
    canonical: 'https://kaboom-tv.com/faq'
  },
  privacy: {
    title: 'Privacy Policy | Kaboom',
    description: 'Read the Kaboom Privacy Policy. Learn about our commitment to your anonymity, data security, cookie usage, and how we handle signaling connections.',
    keywords: ['privacy policy', 'anonymous data safety', 'web chat privacy'],
    canonical: 'https://kaboom-tv.com/privacy'
  },
  terms: {
    title: 'Terms of Service | Kaboom',
    description: 'Review the Terms of Service for Kaboom. Learn about community guidelines, prohibited behavior, automated safety sweeps, and matching rules.',
    keywords: ['terms of service', 'community guidelines', 'chat rules'],
    canonical: 'https://kaboom-tv.com/terms'
  },
  contact: {
    title: 'Contact Kaboom Support | Help and Collaboration',
    description: 'Need help or want to collaborate? Contact the Kaboom support and partnerships team at contact@kaboom-tv.com or collaborate@kaboom-tv.com.',
    keywords: ['contact kaboom', 'customer support', 'partnerships'],
    canonical: 'https://kaboom-tv.com/contact'
  },
  chat: {
    title: 'Random Video Chat | Kaboom',
    description: 'Enter the live random video chat. Match instantly with verified peers worldwide. Experience high-definition WebRTC video and self-healing queues.',
    keywords: ['live chat room', 'webrtc chat room', 'anonymous matched chat'],
    canonical: 'https://kaboom-tv.com/chat',
    ogType: 'video.other'
  }
};

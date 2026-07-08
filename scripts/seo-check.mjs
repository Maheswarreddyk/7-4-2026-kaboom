import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('[SEO Validation] Initializing programmatic SEO build validator...');

// 1. Replicated content dataset to avoid TS browser build-dependency in Node
const COUNTRIES = [
  'India', 'USA', 'UK', 'Canada', 'Australia', 'Singapore', 'Japan', 'Germany',
  'France', 'Italy', 'Spain', 'South Korea', 'Brazil', 'Mexico', 'Netherlands',
  'Belgium', 'Sweden', 'Norway', 'Finland', 'Ireland', 'Switzerland', 'South Africa',
  'New Zealand', 'Malaysia', 'Indonesia', 'Philippines', 'UAE', 'Saudi Arabia',
  'Pakistan', 'Bangladesh', 'Sri Lanka', 'Nepal'
];

const LANGUAGES = [
  'English', 'Hindi', 'Telugu', 'Tamil', 'Kannada', 'Malayalam', 'Spanish',
  'French', 'German', 'Portuguese', 'Arabic', 'Japanese', 'Korean', 'Russian'
];

const DEVICES = [
  'Android', 'iPhone', 'iPad', 'Mac', 'Windows', 'Linux', 'Chromebook', 'Tablet',
  'Mobile Browser', 'Desktop Browser'
];

const INTENTS = [
  'Meet New Friends', 'Talk To Strangers', 'Video Call Random People',
  'Make Friends Online', 'Practice English', 'Practice Languages',
  'Social Video Chat', 'Late Night Video Chat', 'Student Video Chat',
  'Travelers Video Chat', 'Gamers Video Chat', 'Weekend Video Chat'
];

const FEATURES = [
  'No Download', 'No Sign Up', 'One Click Chat', 'Encrypted Chat',
  'HD Video Chat', 'Browser Based Chat', 'Private Chat', 'Instant Match',
  'Random Match', 'Anonymous Calling'
];

const COMPARISONS = [
  'Omegle', 'OmeTV', 'Chatroulette', 'Chatrandom', 'Monkey', 'Emerald Chat'
];

const GLOSSARY = [
  'WebRTC', 'TURN', 'STUN', 'P2P', 'ICE', 'Codec', 'Latency', 'Bandwidth',
  'Browser', 'WebSocket'
];

const GUIDES = [
  'best-random-video-chat-apps', 'how-anonymous-video-chat-works',
  'how-webrtc-powers-video-chat', 'video-chat-safety-guide',
  'meet-new-friends-online', 'how-to-talk-with-strangers',
  'how-video-chat-matches-users', 'why-anonymous-chat-is-growing',
  'random-video-chat-tips', 'video-chat-etiquette'
];

// Helper to slugify
const slugify = (text) => text.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '');

const generatedPages = [];

// Populate generatedPages list
COUNTRIES.forEach((c) => {
  generatedPages.push({
    slug: `video-chat-${slugify(c)}`,
    title: `${c} Random Video Chat | Meet People Online | Kaboom`,
    description: `Experience random video chat in ${c}. Connect with online peers in seconds with zero login requirements. Fully mobile responsive and secure.`,
    h1: `${c} Random Video Chat`
  });

  generatedPages.push({
    slug: `video-chat-${slugify(c)}-mobile`,
    title: `Mobile Video Chat in ${c} | Chat on iPhone & Android | Kaboom`,
    description: `Spontaneous mobile video chat in ${c}. Start matching with one tap on Android, iOS, or iPad. Drag-to-snap self preview, swipe gestures, and no app installs.`,
    h1: `Mobile Video Chat in ${c}`
  });
});

LANGUAGES.forEach((l) => {
  generatedPages.push({
    slug: `${slugify(l)}-video-chat`,
    title: `${l} Speaking Video Chat | Learn & Practice Online | Kaboom`,
    description: `Practice speaking ${l} with native speakers globally. Connect instantly for language learning, cultural exchange, and conversation practice.`,
    h1: `${l} Language Video Chat`
  });
});

DEVICES.forEach((d) => {
  generatedPages.push({
    slug: `video-chat-for-${slugify(d)}`,
    title: `Random Video Chat for ${d} | Browser P2P Streaming | Kaboom`,
    description: `Optimized WebRTC random video chat for ${d}. Connect instantly on your device with zero downloads or configuration loops.`,
    h1: `Random Video Chat for ${d}`
  });
});

INTENTS.forEach((intent) => {
  generatedPages.push({
    slug: slugify(intent),
    title: `${intent} Online | Free Random Video Call Rooms | Kaboom`,
    description: `Spontaneously ${intent.toLowerCase()} with strangers worldwide. Start matching instantly with HD video, messaging capabilities, and no signup gates.`,
    h1: intent
  });
});

FEATURES.forEach((f) => {
  generatedPages.push({
    slug: slugify(f),
    title: `${f} Random Video Chat | Safe Spontaneous Connections | Kaboom`,
    description: `Experience the benefits of ${f}. Kaboom is designed with privacy-first standards, fast WebRTC signaling, and high-end responsive layouts.`,
    h1: `${f} Anonymous Video Chat`
  });
});

COMPARISONS.forEach((comp) => {
  generatedPages.push({
    slug: `kaboom-vs-${slugify(comp)}`,
    title: `Kaboom vs ${comp} | Comparative Video Chat Analysis | Kaboom`,
    description: `A factual, comparative analysis of Kaboom vs ${comp}. Learn about differences in sign-up, WebRTC speeds, safety features, and layout design.`,
    h1: `Kaboom vs ${comp}`
  });
});

GLOSSARY.forEach((g) => {
  generatedPages.push({
    slug: `glossary-${slugify(g)}`,
    title: `What is ${g}? | Technical WebRTC Glossary | Kaboom`,
    description: `Understand the technical term ${g} and its applications in peer-to-peer streaming, signaling handshakes, and online communications.`,
    h1: `WebRTC Glossary: ${g}`
  });
});

GUIDES.forEach((guide) => {
  generatedPages.push({
    slug: guide,
    title: `${guide.replace(/-/g, ' ')} | Technical Guide | Kaboom`,
    description: `Detailed support and technical explanation guide about ${guide.replace(/-/g, ' ')} on Kaboom TV.`,
    h1: guide.replace(/-/g, ' ')
  });
});

// Audience country variations (16 pages)
const topCountries = ['India', 'USA', 'UK', 'Canada'];
const audiences = ['Students', 'Travelers', 'Gamers', 'Professionals'];
topCountries.forEach((country) => {
  audiences.forEach((aud) => {
    generatedPages.push({
      slug: `${slugify(aud)}-video-chat-in-${slugify(country)}`,
      title: `${aud} Video Chat in ${country} | Meet Peer Groups | Kaboom`,
      description: `Connect with other ${aud.toLowerCase()} in ${country} using random video chat. Match instantly with common interest filters and responsive screen interfaces.`,
      h1: `${aud} Video Chat in ${country}`
    });
  });
});

// Time-based variations (4 pages)
topCountries.forEach((country) => {
  generatedPages.push({
    slug: `late-night-video-chat-in-${slugify(country)}`,
    title: `Late Night Random Video Chat in ${country} | Online Matching | Kaboom`,
    description: `Connect at night in ${country} using random video chat. Pair with online peers during evening and late hours. Spontaneous, secure, and zero registration.`,
    h1: `Late Night Video Chat in ${country}`
  });
});

console.log(`[SEO Validation] Generated total pages count: ${generatedPages.length}`);

if (generatedPages.length < 150) {
  console.error(`[Error] Under 150 programmatic pages generated (Count: ${generatedPages.length})`);
  process.exit(1);
}

// 2. Perform duplicate content checks
const slugs = new Set();
const titles = new Set();
const descriptions = new Set();
const h1s = new Set();

generatedPages.forEach((page) => {
  if (slugs.has(page.slug)) {
    console.error(`[Error] Duplicate Slug Detected: "${page.slug}"`);
    process.exit(1);
  }
  slugs.add(page.slug);

  if (titles.has(page.title)) {
    console.error(`[Error] Duplicate Title Detected: "${page.title}"`);
    process.exit(1);
  }
  titles.add(page.title);

  if (descriptions.has(page.description)) {
    console.error(`[Error] Duplicate Description Detected: "${page.description}"`);
    process.exit(1);
  }
  descriptions.add(page.description);

  if (h1s.has(page.h1)) {
    console.error(`[Error] Duplicate H1 Heading Detected: "${page.h1}"`);
    process.exit(1);
  }
  h1s.add(page.h1);
});

console.log('[SEO Validation] Success! No duplicate titles, slugs, or descriptions found.');

// 3. Compile and write dynamic sitemap.xml
const sitemapPath = path.resolve(__dirname, '../frontend/public/sitemap.xml');
console.log(`[SEO Sitemap] Compiling XML sitemap at: ${sitemapPath}`);

const sitemapHeader = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <!-- Core Static Pages -->
  <url><loc>https://kaboom-tv.com/</loc><lastmod>2026-07-08</lastmod><changefreq>daily</changefreq><priority>1.0</priority></url>
  <url><loc>https://kaboom-tv.com/about</loc><lastmod>2026-07-08</lastmod><changefreq>monthly</changefreq><priority>0.8</priority></url>
  <url><loc>https://kaboom-tv.com/faq</loc><lastmod>2026-07-08</lastmod><changefreq>monthly</changefreq><priority>0.8</priority></url>
  <url><loc>https://kaboom-tv.com/contact</loc><lastmod>2026-07-08</lastmod><changefreq>monthly</changefreq><priority>0.7</priority></url>
  <url><loc>https://kaboom-tv.com/privacy</loc><lastmod>2026-07-08</lastmod><changefreq>yearly</changefreq><priority>0.5</priority></url>
  <url><loc>https://kaboom-tv.com/terms</loc><lastmod>2026-07-08</lastmod><changefreq>yearly</changefreq><priority>0.5</priority></url>
  <url><loc>https://kaboom-tv.com/topics</loc><lastmod>2026-07-08</lastmod><changefreq>weekly</changefreq><priority>0.9</priority></url>
`;

let sitemapBody = '';
generatedPages.forEach((page) => {
  sitemapBody += `  <url><loc>https://kaboom-tv.com/${page.slug}</loc><lastmod>2026-07-08</lastmod><changefreq>monthly</changefreq><priority>0.7</priority></url>\n`;
});

const sitemapFooter = `</urlset>`;
const fullSitemap = sitemapHeader + sitemapBody + sitemapFooter;

fs.writeFileSync(sitemapPath, fullSitemap, 'utf-8');
console.log('[SEO Sitemap] XML sitemap compiled and saved successfully!');
process.exit(0);

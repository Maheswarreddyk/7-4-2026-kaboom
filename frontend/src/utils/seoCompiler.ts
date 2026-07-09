import {
  SeoItem,
  SEO_COUNTRIES,
  SEO_LANGUAGES,
  SEO_DEVICES,
  SEO_INTENTS,
  SEO_FEATURES,
  SEO_COMPARISONS,
  SEO_GLOSSARY,
  SEO_GUIDES
} from '../content/seoDatabase.js';

// Global cache for compiled items
let compiledCache: SeoItem[] | null = null;

export function compileSeoPages(): SeoItem[] {
  if (compiledCache) return compiledCache;

  const items: SeoItem[] = [];

  // Helper to slugify strings
  const slugify = (text: string) => text.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '');

  // 1. Countries (32 main pages)
  SEO_COUNTRIES.forEach((c) => {
    items.push({
      slug: `video-chat-${slugify(c.name)}`,
      title: `${c.name} Random Video Chat | Meet People Online | Kaboom TV`,
      description: `Experience random video chat in ${c.name}. Connect with online peers in seconds with zero login requirements. Fully mobile responsive and secure.`,
      h1: `${c.name} Random Video Chat`,
      category: 'countries',
      tags: ['countries', slugify(c.name), 'spontaneous', 'webrtc'],
      readTime: 6,
      lastUpdated: '2026-07-08',
      popular: c.name === 'India' || c.name === 'USA' || c.name === 'UK',
      primaryKeyword: `${c.name.toLowerCase()} video chat`,
      details: {
        countryName: c.name,
        language: c.lang,
        availability: c.availability,
        safetyScore: c.safetyScore
      }
    });

    // 2. Country Mobile variations (32 pages)
    items.push({
      slug: `video-chat-${slugify(c.name)}-mobile`,
      title: `Mobile Video Chat in ${c.name} | Chat on iPhone & Android | Kaboom TV`,
      description: `Spontaneous mobile video chat in ${c.name}. Start matching with one tap on Android, iOS, or iPad. Drag-to-snap self preview, swipe gestures, and no app installs.`,
      h1: `Mobile Video Chat in ${c.name}`,
      category: 'countries',
      tags: ['countries', 'mobile', slugify(c.name), 'gestures', 'responsive'],
      readTime: 5,
      lastUpdated: '2026-07-08',
      popular: c.name === 'India' || c.name === 'USA',
      primaryKeyword: `${c.name.toLowerCase()} mobile video chat`,
      details: {
        countryName: c.name,
        isMobileSpecific: true,
        language: c.lang,
        availability: c.availability,
        safetyScore: c.safetyScore
      }
    });
  });

  // 3. Languages (14 main pages)
  SEO_LANGUAGES.forEach((l) => {
    items.push({
      slug: `${slugify(l.name)}-video-chat`,
      title: `${l.name} Speaking Video Chat | Learn & Practice Online | Kaboom TV`,
      description: `Practice speaking ${l.name} with native speakers globally. Connect instantly for language learning, cultural exchange, and conversation practice.`,
      h1: `${l.name} Language Video Chat`,
      category: 'languages',
      tags: ['languages', slugify(l.name), 'education', 'friends'],
      readTime: 6,
      lastUpdated: '2026-07-08',
      popular: l.name === 'English' || l.name === 'Spanish' || l.name === 'Hindi',
      primaryKeyword: `${l.name.toLowerCase()} video chat`,
      details: {
        languageName: l.name,
        nativeName: l.nativeName,
        speakers: l.speakers,
        usage: l.usage
      }
    });
  });

  // 4. Devices (10 pages)
  SEO_DEVICES.forEach((d) => {
    items.push({
      slug: `video-chat-for-${slugify(d.name)}`,
      title: `Random Video Chat for ${d.name} | Browser P2P Streaming | Kaboom TV`,
      description: `Optimized WebRTC random video chat for ${d.name}. Connect instantly on your ${d.type} device with zero downloads or configuration loops.`,
      h1: `Random Video Chat for ${d.name}`,
      category: 'devices',
      tags: ['devices', slugify(d.name), 'compatibility', 'webrtc'],
      readTime: 5,
      lastUpdated: '2026-07-08',
      popular: d.name === 'Android' || d.name === 'iPhone',
      primaryKeyword: `video chat for ${d.name.toLowerCase()}`,
      details: {
        deviceName: d.name,
        deviceType: d.type,
        engine: d.engine,
        browser: d.browser
      }
    });
  });

  // 5. User Intents (12 pages)
  SEO_INTENTS.forEach((intent) => {
    items.push({
      slug: slugify(intent.term),
      title: `${intent.term} Online | Free Random Video Call Rooms | Kaboom TV`,
      description: `Spontaneously ${intent.term.toLowerCase()} with strangers worldwide. Start matching instantly with HD video, messaging capabilities, and no signup gates.`,
      h1: intent.term,
      category: 'intent',
      tags: ['intent', slugify(intent.term), 'social', 'matching'],
      readTime: 7,
      lastUpdated: '2026-07-08',
      popular: intent.term.includes('Friends') || intent.term.includes('Strangers'),
      primaryKeyword: intent.term.toLowerCase(),
      details: {
        intentName: intent.term,
        focus: intent.focus
      }
    });
  });

  // 6. Features (10 pages)
  SEO_FEATURES.forEach((f) => {
    items.push({
      slug: slugify(f.name),
      title: `${f.name} Random Video Chat | Safe Spontaneous Connections | Kaboom TV`,
      description: `Experience the benefits of ${f.name}. Kaboom TV is designed with privacy-first standards, fast WebRTC signaling, and high-end responsive layouts.`,
      h1: `${f.name} Anonymous Video Chat`,
      category: 'features',
      tags: ['features', slugify(f.name), 'privacy', 'webrtc'],
      readTime: 5,
      lastUpdated: '2026-07-08',
      popular: f.name.includes('Sign Up') || f.name.includes('Download'),
      primaryKeyword: f.name.toLowerCase(),
      details: {
        featureName: f.name,
        benefit: f.benefit
      }
    });
  });

  // 7. Competitors Comparisons (6 pages)
  SEO_COMPARISONS.forEach((comp) => {
    items.push({
      slug: `kaboom-vs-${slugify(comp.competitor)}`,
      title: `Kaboom TV vs ${comp.competitor} | Comparative Video Chat Analysis | Kaboom TV`,
      description: `A factual, comparative analysis of Kaboom TV vs ${comp.competitor}. Learn about differences in sign-up, WebRTC speeds, safety features, and layout design.`,
      h1: `Kaboom TV vs ${comp.competitor}`,
      category: 'comparisons',
      tags: ['comparisons', slugify(comp.competitor), 'alternative', 'safety'],
      readTime: 8,
      lastUpdated: '2026-07-08',
      popular: comp.competitor === 'Omegle' || comp.competitor === 'OmeTV',
      primaryKeyword: `kaboom vs ${comp.competitor.toLowerCase()}`,
      details: {
        competitorName: comp.competitor,
        activeYears: comp.activeYears,
        limitation: comp.limitation,
        differentiator: comp.differentiator
      }
    });
  });

  // 8. Glossary (10 pages)
  SEO_GLOSSARY.forEach((g) => {
    items.push({
      slug: `glossary-${slugify(g.term)}`,
      title: `What is ${g.term}? | Technical WebRTC Glossary | Kaboom TV`,
      description: `Understand the technical term ${g.term} and its applications in peer-to-peer streaming, signaling handshakes, and online communications.`,
      h1: `WebRTC Glossary: ${g.term}`,
      category: 'glossary',
      tags: ['glossary', slugify(g.term), 'technical', 'webrtc'],
      readTime: 4,
      lastUpdated: '2026-07-08',
      popular: g.term === 'WebRTC' || g.term === 'P2P',
      primaryKeyword: `what is ${g.term.toLowerCase()}`,
      details: {
        termName: g.term,
        definition: g.definition
      }
    });
  });

  // 9. Core Guides (10 pages)
  SEO_GUIDES.forEach((guide) => {
    items.push({
      slug: guide.slug,
      title: `${guide.title} | Technical Guide | Kaboom TV`,
      description: guide.desc,
      h1: guide.title,
      category: 'guides',
      tags: ['guides', 'learning', 'safety', 'webrtc'],
      readTime: 9,
      lastUpdated: '2026-07-08',
      popular: guide.slug.includes('safety') || guide.slug.includes('best'),
      primaryKeyword: guide.title.toLowerCase(),
      details: {
        guideTitle: guide.title,
        description: guide.desc
      }
    });
  });

  // 10. Audience Country Sub-Pages (16 pages)
  const topCountries = ['India', 'USA', 'UK', 'Canada'];
  const audiences = ['Students', 'Travelers', 'Gamers', 'Professionals'];

  topCountries.forEach((country) => {
    audiences.forEach((aud) => {
      items.push({
        slug: `${slugify(aud)}-video-chat-in-${slugify(country)}`,
        title: `${aud} Video Chat in ${country} | Meet Peer Groups | Kaboom TV`,
        description: `Connect with other ${aud.toLowerCase()} in ${country} using random video chat. Match instantly with common interest filters and responsive screen interfaces.`,
        h1: `${aud} Video Chat in ${country}`,
        category: 'intent',
        tags: ['countries', 'intent', slugify(country), slugify(aud)],
        readTime: 6,
        lastUpdated: '2026-07-08',
        popular: country === 'India' && aud === 'Students',
        primaryKeyword: `${aud.toLowerCase()} video chat in ${country.toLowerCase()}`,
        details: {
          countryName: country,
          audienceName: aud
        }
      });
    });
  });

  // 11. Late-Night / Weekend Time-Based Pages (4 pages)
  topCountries.forEach((country) => {
    items.push({
      slug: `late-night-video-chat-in-${slugify(country)}`,
      title: `Late Night Random Video Chat in ${country} | Online Matching | Kaboom TV`,
      description: `Connect at night in ${country} using random video chat. Pair with online peers during evening and late hours. Spontaneous, secure, and zero registration.`,
      h1: `Late Night Video Chat in ${country}`,
      category: 'intent',
      tags: ['countries', 'intent', slugify(country), 'night-chat'],
      readTime: 5,
      lastUpdated: '2026-07-08',
      popular: true,
      primaryKeyword: `late night video chat in ${country.toLowerCase()}`,
      details: {
        countryName: country,
        timeFrame: 'Late Night'
      }
    });
  });

  compiledCache = items;
  return items;
}

// Dynamically generate the detailed body content, FAQs, and structures for an SEO item
export function generatePageContent(item: SeoItem) {
  const sections: Array<{ heading: string; text: string }> = [];
  const faqs: Array<{ question: string; answer: string }> = [];

  // Generate sections based on category type
  if (item.category === 'countries') {
    const isMobile = item.details.isMobileSpecific;
    const country = item.details.countryName;
    const lang = item.details.language;
    const speed = item.details.availability;
    
    sections.push(
      {
        heading: `Local Video Chat Usage & Trends in ${country}`,
        text: `Spontaneous random communication platforms have grown exponentially in ${country}. Millions of users seek clean, registration-free alternatives to connect with peers locally and globally. Kaboom TV offers an ideal interface for ${country} users, prioritizing high-speed WebRTC pairing and seamless browser-based matching.`
      },
      {
        heading: `${isMobile ? 'Mobile Browser Optimization' : 'WebRTC Connections'} & Performance in ${country}`,
        text: `Thanks to extensive local network access (available at ${speed} bandwidth connectivity), users in ${country} can establish direct peer-to-peer video streams. On ${isMobile ? 'iOS and Android devices' : 'desktops and tablets'}, our framework adjusts resolutions dynamically depending on the current packet loss parameters, ensuring low latency and clean visuals.`
      },
      {
        heading: `Safety Protocols & Moderation for ${country} Chats`,
        text: `Anonymity is a double-edged sword, which is why Kaboom TV introduces a multi-tier safety architecture. Users in ${country} can flag violations using the integrated Report modal. Matches are moderated automatically through reported thresholds and Postgres advisory locking, instantly booting bad actors out of active signaling queues.`
      },
      {
        heading: `Tips for Spontaneous Global Matching in ${country}`,
        text: `To maximize your matching success from ${country}, ensure you have adequate lighting and a clear camera setup. Connect in rooms targeting ${lang} languages or expand filters to match internationally. Respect our community guidelines and keep conversations fun and respectful.`
      }
    );

    faqs.push(
      {
        question: `Is video chat free in ${country}?`,
        answer: `Yes, Kaboom TV is 100% free with no coins, payment gateways, or subscription limits for users in ${country}.`
      },
      {
        question: `Do I need to sign up in ${country}?`,
        answer: `No. Kaboom TV respects your privacy. You can start matching instantly with zero registration, emails, or personal details.`
      },
      {
        question: `Can I use Kaboom TV on my smartphone in ${country}?`,
        answer: `Absolutely! Kaboom TV is optimized with snapping previews and swipe gestures for all mobile browsers in ${country}.`
      },
      {
        question: `How safe is the matching engine in ${country}?`,
        answer: `All video feeds run peer-to-peer using encrypted WebRTC. Signaling channels are secure and do not record conversations.`
      },
      {
        question: `Which languages are supported in ${country} chat rooms?`,
        answer: `Rooms support ${lang} by default, but you can match with english speakers and users worldwide.`
      },
      {
        question: `What is the safety score of Kaboom TV in ${country}?`,
        answer: `Kaboom TV maintains a high safety index of ${item.details.safetyScore}/10 by enforcing strict community guidelines.`
      },
      {
        question: `Can I skip people I don't want to chat with?`,
        answer: `Yes. Simply click the Next button or swipe left on your mobile device to immediately match with another user.`
      },
      {
        question: `Is data stored on Kaboom TV in ${country}?`,
        answer: `No. Kaboom TV uses localStorage locally to keep your temporary session token, which is periodically deleted.`
      }
    );
  } else if (item.category === 'languages') {
    const lang = item.details.languageName;
    const native = item.details.nativeName;
    const speakers = item.details.speakers;
    const usage = item.details.usage;

    sections.push(
      {
        heading: `Learn & Practice speaking ${lang} (${native}) via Video Chat`,
        text: `The best way to build speaking confidence is through direct conversational practice. With over ${speakers} speakers globally, practicing ${lang} in real-time has never been easier. Kaboom TV connects you with native speakers and language learners to foster natural language practice.`
      },
      {
        heading: `Cultural Exchange and Spontaneous ${lang} Conversations`,
        text: `Connecting anonymously allows you to bypass the anxiety of structured learning. Engage in random chat, discuss global topics, share cultural viewpoints, and explore linguistic variations of ${lang} with real peers. This makes it a perfect channel for ${usage}.`
      },
      {
        heading: `WebRTC High-Definition Audio for Clear Pronunciation`,
        text: `Linguistic practice requires clear acoustics. Our WebRTC infrastructure uses the Opus audio codec, delivering premium noise-suppression and crystal-clear audio so you can hear precise pronunciations without delays.`
      },
      {
        heading: `Community Guidelines for Language Learners`,
        text: `When joining ${lang} chat rooms, maintain a polite, learning-first attitude. Introduce yourself, express your language practice goals, and report any abusive or disruptive profiles immediately.`
      }
    );

    faqs.push(
      {
        question: `Can I practice ${lang} on Kaboom TV?`,
        answer: `Yes! Kaboom TV is widely used by students and language learners to practice speaking ${lang} with real speakers.`
      },
      {
        question: `Are there dedicated rooms for ${lang}?`,
        answer: `Yes. You can select your language filters inside the preference settings modal before starting your matching search.`
      },
      {
        question: `Is language practice free?`,
        answer: `Absolutely. There are no fees or time limits to practice speaking on Kaboom TV.`
      },
      {
        question: `What if I cannot understand the other speaker?`,
        answer: `You can use our in-app chat text drawer to send messages, ask for spellings, or share translation hints.`
      },
      {
        question: `Is Kaboom TV anonymous during language practice?`,
        answer: `Yes. No accounts or profile forms are required, keeping your learning experience secure and private.`
      },
      {
        question: `How many people speak ${lang} globally?`,
        answer: `Around ${speakers} speak ${lang} globally, making it highly active for peer discovery.`
      },
      {
        question: `What should I do if a partner is rude?`,
        answer: `Simply click the Next skip button or tap Report. Our system acts instantly to isolate flagged profiles.`
      },
      {
        question: `Does the connection lag during video calls?`,
        answer: `We use direct peer-to-peer WebRTC streams, which minimizes connection latency and maintains high audio clarity.`
      }
    );
  } else if (item.category === 'comparisons') {
    const comp = item.details.competitorName;
    const diff = item.details.differentiator;
    const limit = item.details.limitation;

    sections.push(
      {
        heading: `Factual Comparison: Kaboom TV vs ${comp}`,
        text: `When comparing random video chat platforms, users prioritize speed, device availability, privacy, and safety. ${comp} is a notable name in the industry, but contains several operational constraints. Here, we analyze how Kaboom TV addresses these gaps.`
      },
      {
        heading: `Addressing Safety and Moderation Gaps`,
        text: `Safety is a massive concern in public chats. ${comp} has struggled with ${limit}. Kaboom TV addresses this using automated FSM transition checks, keeping users isolated in READY/RESERVED queues until secure peer-to-peer handshakes occur.`
      },
      {
        heading: `User Interface and Gestural Experience`,
        text: `While older sites use basic text-heavy designs, Kaboom TV introduces high-end glassmorphism styling and snapping viewports. On mobile, we offer one-handed layouts, swipe gestures, and dynamic celebration visual effects.`
      },
      {
        heading: `WebRTC Connectivity and Signaling Performance`,
        text: `We use direct WebRTC connections. Unlike competitors that route streams through slow central relay nodes, Kaboom TV establishes direct P2P connections, resulting in low packet loss and optimized video quality.`
      }
    );

    faqs.push(
      {
        question: `How is Kaboom TV different from ${comp}?`,
        answer: `${diff}`
      },
      {
        question: `Is Kaboom TV safer than ${comp}?`,
        answer: `Yes. Kaboom TV implements active state transition verification, quick reporting systems, and ephemeral signaling records.`
      },
      {
        question: `Do I need to pay for filters on Kaboom TV?`,
        answer: `No. Unlike other platforms, matching preference filters (gender, region) on Kaboom TV are 100% free.`
      },
      {
        question: `Does Kaboom TV require an app install?`,
        answer: `No. Kaboom TV runs entirely in your mobile or desktop browser without requiring any downloads.`
      },
      {
        question: `What happened to ${comp}?`,
        answer: `${comp} experienced operational challenges, while Kaboom TV remains fully active, safe, and secure.`
      },
      {
        question: `Can I text chat on both?`,
        answer: `Yes. However, Kaboom TV includes a sliding bottom drawer sheet with delivery seen receipts and emoji bars.`
      },
      {
        question: `Does Kaboom TV sell user data?`,
        answer: `No. Kaboom TV does not collect accounts or personal data, making it impossible to sell user information.`
      },
      {
        question: `Is the connection quality high on Kaboom TV?`,
        answer: `Yes. We use direct peer-to-peer WebRTC connections, bypassing intermediate server lags.`
      }
    );
  } else {
    // Fallback general compilation templates (for glossary, devices, intent, features, guides)
    const name = item.h1;
    
    sections.push(
      {
        heading: `Understanding ${name}`,
        text: `Spontaneous web interaction systems rely heavily on clear UX and technical foundations. ${name} represents a major pillar of how modern internet users connect, matching interest profiles in milliseconds and maintaining strict privacy standards.`
      },
      {
        heading: `Technical Architecture and Implementation`,
        text: `Under the hood, we leverage peer-to-peer signaling grids, HTML5 MediaStream APIs, and self-healing matching algorithms. This keeps browser performance optimized and limits memory footprints across mobile and desktop devices.`
      },
      {
        heading: `Safety Guidelines and Operational Best Practices`,
        text: `When utilizing random matching features, we encourage all users to practice safety. Do not share personal credentials, keep browser permissions scoped, and utilize reports when meeting abusive behavior.`
      },
      {
        heading: `Future Enhancements and Roadmap`,
        text: `We continuously refine our connectivity pipelines, layout responsiveness, and accessibility landmarks, ensuring the platform remains state-of-the-art and SEO-optimized for search crawlers.`
      }
    );

    faqs.push(
      {
        question: `What is the significance of ${name}?`,
        answer: `${name} allows users to connect, learn, and experience high-performance WebRTC matching safely and instantly.`
      },
      {
        question: `Is ${name} free on Kaboom TV?`,
        answer: `Yes. Every feature on Kaboom TV, including filters and dynamic layout matching, is free to use.`
      },
      {
        question: `Do I need to sign up for ${name}?`,
        answer: `No. Zero registration or logins are required to experience this feature.`
      },
      {
        question: `Does ${name} work on mobile?`,
        answer: `Yes, all programmatic pages and features are fully responsive for Android and iOS mobile web clients.`
      },
      {
        question: `How does Kaboom TV optimize ${name}?`,
        answer: `By utilizing modern WebRTC parameters, localized signaling loops, and clean CSS safe-area grids.`
      },
      {
        question: `What if I encounter lag or glitches?`,
        answer: `Ensure browser permissions are active, close other camera applications, and refresh the connection.`
      },
      {
        question: `Can I select custom filters?`,
        answer: `Yes, click the Settings button inside the dock to configure matching preferences.`
      },
      {
        question: `Does Kaboom TV store my chat logs?`,
        answer: `No. All messages and sessions are ephemeral and are purged immediately upon leaving.`
      }
    );
  }

  return { sections, faqs };
}

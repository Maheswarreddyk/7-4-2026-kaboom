import { useEffect, useRef, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { compileSeoPages, generatePageContent } from '../utils/seoCompiler.js';
import { MetaManager } from '../components/MetaManager.js';
import { playTapSound } from '../utils/audio.js';
import { cn } from '../utils/index.js';

export function DynamicSeoPage() {
  const { seoSlug } = useParams<{ seoSlug: string }>();
  const navigate = useNavigate();
  const articleRef = useRef<HTMLDivElement | null>(null);
  
  const [scrollProgress, setScrollProgress] = useState(0);
  const [activeTocId, setActiveTocId] = useState('');
  const [toc, setToc] = useState<Array<{ id: string; text: string; level: number }>>([]);
  const [openFaqIdx, setOpenFaqIdx] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);

  // 1. Resolve content item from dynamic slug
  const allItems = compileSeoPages();
  const activeItem = allItems.find((item) => item.slug === seoSlug);

  // Auto-scroll to top on slug change
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
    setOpenFaqIdx(null);
    setCopied(false);
  }, [seoSlug]);

  // Track page scroll depth progress
  useEffect(() => {
    const handleScroll = () => {
      const totalHeight = document.documentElement.scrollHeight - window.innerHeight;
      if (totalHeight > 0) {
        const progress = (window.scrollY / totalHeight) * 100;
        setScrollProgress(progress);
      }
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Programmatically extract H2/H3 elements for Table of Contents
  useEffect(() => {
    if (!activeItem || !articleRef.current) return;
    
    // Add brief timeout to let DOM render
    const timer = setTimeout(() => {
      const headers = articleRef.current?.querySelectorAll('h2, h3');
      if (!headers) return;
      
      const tocItems: Array<{ id: string; text: string; level: number }> = [];
      headers.forEach((h, idx) => {
        const id = h.id || `section-${idx}`;
        h.id = id;
        tocItems.push({
          id,
          text: h.textContent || '',
          level: h.tagName.toLowerCase() === 'h3' ? 3 : 2
        });
      });
      setToc(tocItems);
    }, 100);

    return () => clearTimeout(timer);
  }, [activeItem]);

  // Track active TOC section on scroll
  useEffect(() => {
    const handleIntersection = () => {
      const headings = articleRef.current?.querySelectorAll('h2, h3');
      if (!headings) return;
      
      let currentActive = '';
      for (let i = 0; i < headings.length; i++) {
        const rect = headings[i].getBoundingClientRect();
        if (rect.top < 150) {
          currentActive = headings[i].id;
        }
      }
      if (currentActive) {
        setActiveTocId(currentActive);
      }
    };
    window.addEventListener('scroll', handleIntersection, { passive: true });
    return () => window.removeEventListener('scroll', handleIntersection);
  }, []);

  if (!activeItem) {
    // If slug not registered in SEO database, fallback immediately to not found page
    return (
      <main className="min-h-screen flex flex-col items-center justify-center text-center p-8 bg-[#FAF9F7]" role="main">
        <h1 className="text-4xl font-extrabold text-stone-900 mb-4">Topic Not Found</h1>
        <p className="text-stone-500 mb-8 max-w-sm">The specific knowledge guide you requested is not currently active.</p>
        <Link to="/topics" className="btn-primary">Browse All Topics</Link>
      </main>
    );
  }

  const { sections, faqs } = generatePageContent(activeItem);

  // Recommendations: Auto-Linker cluster matching
  const categoryCluster = allItems.filter(
    (item) => item.category === activeItem.category && item.slug !== activeItem.slug
  );
  
  // Tag clusters fallback
  const sharedTagCluster = allItems.filter(
    (item) => item.slug !== activeItem.slug && item.tags.some(t => activeItem.tags.includes(t))
  );

  // Deduplicate and slice 6-8 recommended related pages
  const relatedArticles = Array.from(new Set([...categoryCluster, ...sharedTagCluster])).slice(0, 8);

  // Breadcrumbs schema setup
  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    'itemListElement': [
      { '@type': 'ListItem', 'position': 1, 'name': 'Home', 'item': 'https://kaboom-tv.com/' },
      { '@type': 'ListItem', 'position': 2, 'name': 'Topics', 'item': 'https://kaboom-tv.com/topics' },
      { '@type': 'ListItem', 'position': 3, 'name': activeItem.category.toUpperCase(), 'item': `https://kaboom-tv.com/topics/${activeItem.category}` },
      { '@type': 'ListItem', 'position': 4, 'name': activeItem.h1, 'item': `https://kaboom-tv.com/${activeItem.slug}` }
    ]
  };

  // FAQ schema setup
  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    'mainEntity': faqs.map((f) => ({
      '@type': 'Question',
      'name': f.question,
      'acceptedAnswer': { '@type': 'Answer', 'text': f.answer }
    }))
  };

  // Article schema setup
  const articleSchema = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    'headline': activeItem.title,
    'description': activeItem.description,
    'image': 'https://kaboom-tv.com/og-preview.png',
    'author': { '@type': 'Organization', 'name': 'Kaboom TV Support Team' },
    'publisher': {
      '@type': 'Organization',
      'name': 'Kaboom TV',
      'logo': { '@type': 'ImageObject', 'url': 'https://kaboom-tv.com/images/icon_kaboom.png' }
    },
    'datePublished': '2026-07-08',
    'dateModified': activeItem.lastUpdated
  };

  // Merge dynamic schemas
  const mergedSchema = {
    '@context': 'https://schema.org',
    '@graph': [breadcrumbSchema, faqSchema, articleSchema]
  };

  const handleCopyLink = () => {
    playTapSound();
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePrint = () => {
    playTapSound();
    window.print();
  };

  return (
    <main className="min-h-screen bg-[#FAF9F7] text-stone-800 pb-20 selection:bg-amber-500/20" role="main">
      <MetaManager 
        page={activeItem.slug} 
        customConfig={{
          title: activeItem.title,
          description: activeItem.description,
          keywords: activeItem.tags,
          canonical: `https://kaboom-tv.com/${activeItem.slug}`
        }}
        customSchema={mergedSchema}
      />

      {/* ── Reading Progress tracker ── */}
      <div 
        className="fixed top-0 left-0 right-0 h-1 bg-amber-500 origin-left transition-transform duration-75 z-50 pointer-events-none" 
        style={{ transform: `scaleX(${scrollProgress / 100})` }}
      />

      {/* ── Top Breadcrumbs Bar (72px alignment) ── */}
      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center gap-2 text-xs text-stone-400 font-bold uppercase tracking-wider select-none">
        <Link to="/" className="hover:text-amber-600 transition-colors">Home</Link>
        <span>/</span>
        <Link to="/topics" className="hover:text-amber-600 transition-colors">Topics</Link>
        <span>/</span>
        <Link to={`/topics/${activeItem.category}`} className="hover:text-amber-600 transition-colors">{activeItem.category}</Link>
        <span>/</span>
        <span className="text-stone-600 truncate max-w-[200px]">{activeItem.h1}</span>
      </div>

      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid lg:grid-cols-4 gap-10 mt-6 relative">
        
        {/* ── STICKY SIDEBAR (TOC & Sharing actions) ── */}
        <aside className="lg:col-span-1 hidden lg:block select-none">
          <div className="sticky top-20 space-y-8 max-h-[calc(100vh-8rem)] overflow-y-auto pr-4 scrollbar-none">
            
            {toc.length > 0 && (
              <div>
                <h4 className="text-xs font-black uppercase text-stone-400 tracking-wider mb-4">Table of Contents</h4>
                <nav className="flex flex-col gap-3">
                  {toc.map((t) => (
                    <a
                      key={t.id}
                      href={`#${t.id}`}
                      onClick={(e) => {
                        e.preventDefault();
                        document.getElementById(t.id)?.scrollIntoView({ behavior: 'smooth' });
                      }}
                      className={cn(
                        "text-xs font-bold transition-all block border-l pl-3.5",
                        t.level === 3 ? "ml-3 text-[11px]" : "",
                        activeTocId === t.id 
                          ? "border-amber-500 text-stone-900 font-black scale-[1.01]" 
                          : "border-stone-200 text-stone-400 hover:text-stone-600 hover:border-stone-400"
                      )}
                    >
                      {t.text}
                    </a>
                  ))}
                </nav>
              </div>
            )}

            <div className="pt-6 border-t border-stone-200/60">
              <h4 className="text-xs font-black uppercase text-stone-400 tracking-wider mb-4">Share this article</h4>
              <div className="flex flex-col gap-3">
                <button 
                  onClick={handleCopyLink}
                  className="w-full flex items-center justify-between px-4 py-2.5 rounded-xl border border-stone-200 bg-white hover:bg-stone-50 text-xs font-bold tracking-wide transition-colors"
                >
                  <span>{copied ? 'Copied!' : 'Copy Link'}</span>
                  <span>🔗</span>
                </button>
                <button 
                  onClick={handlePrint}
                  className="w-full flex items-center justify-between px-4 py-2.5 rounded-xl border border-stone-200 bg-white hover:bg-stone-50 text-xs font-bold tracking-wide transition-colors"
                >
                  <span>Print Guide</span>
                  <span>🖨️</span>
                </button>
              </div>
            </div>

            {/* Quick launch widget */}
            <div className="p-6 rounded-2xl bg-gradient-to-br from-amber-500 to-amber-600 text-stone-950 shadow-md">
              <h5 className="font-black text-sm uppercase tracking-wider mb-2">Ready to Match?</h5>
              <p className="text-[11px] font-bold text-stone-950/80 leading-relaxed mb-4">
                Connect instantly with verified peers worldwide. No sign-ups required.
              </p>
              <button 
                onClick={() => navigate('/chat')}
                className="w-full py-2.5 rounded-xl bg-stone-950 text-white font-black text-xs hover:scale-105 transition-transform"
              >
                Match Instantly ➔
              </button>
            </div>
          </div>
        </aside>

        {/* ── ARTICLE MAIN CONTENT AREA ── */}
        <section className="lg:col-span-3 space-y-12">
          
          {/* Header Hero */}
          <header className="space-y-4">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-amber-200 bg-amber-50 text-[10px] font-black uppercase tracking-wider text-amber-700">
              ⚡ {activeItem.category}
            </span>
            <h1 className="text-3xl sm:text-5xl font-black tracking-tight leading-none text-stone-900">
              {activeItem.h1}
            </h1>
            <div className="flex flex-wrap items-center gap-4 text-xs text-stone-400 font-bold select-none pt-2">
              <span>By Support Team</span>
              <span>•</span>
              <span>Updated: {activeItem.lastUpdated}</span>
              <span>•</span>
              <span>{activeItem.readTime} min read</span>
              {activeItem.popular && (
                <span className="px-2 py-0.5 rounded bg-orange-100 text-orange-600 font-bold uppercase text-[9px]">Popular</span>
              )}
            </div>
          </header>

          {/* AI Search Key Takeaways callout box */}
          <section className="p-6 rounded-2xl border border-amber-200 bg-amber-50/50 shadow-sm">
            <h4 className="font-black text-stone-900 text-xs uppercase tracking-wider mb-3">Quick Takeaways (AI Summary)</h4>
            <ul className="list-disc list-inside space-y-2 text-xs text-stone-600 font-medium leading-relaxed">
              <li><strong>Anonymity:</strong> Kaboom TV is designed with zero credentials, maintaining absolute client privacy.</li>
              <li><strong>Framework:</strong> High-speed peer-to-peer tunnels are negotiated directly via WebRTC protocols.</li>
              <li><strong>Ergonomics:</strong> Responsive grid layout snapping self-previews is optimized for mobile browser reach.</li>
            </ul>
          </section>

          {/* Article sections */}
          <div ref={articleRef} className="space-y-8 text-stone-600 leading-relaxed font-medium text-sm sm:text-base">
            {sections.map((sec, idx) => (
              <article key={idx} className="space-y-4">
                <h2 id={`sec-${idx}`} className="text-xl sm:text-2xl font-black text-stone-900 tracking-tight pt-4">
                  {sec.heading}
                </h2>
                <p className="leading-relaxed">{sec.text}</p>
              </article>
            ))}
          </div>

          {/* ── PROGRAMMATIC FAQ ENGINE ── */}
          <section className="pt-8 border-t border-stone-200/60">
            <h2 className="text-2xl font-black text-stone-900 tracking-tight mb-8">FAQ & Knowledge Base</h2>
            <div className="space-y-4 select-none">
              {faqs.map((faq, idx) => (
                <div key={idx} className="border border-stone-200/60 rounded-xl bg-white overflow-hidden transition-shadow hover:shadow-sm">
                  <button
                    onClick={() => {
                      playTapSound();
                      setOpenFaqIdx(openFaqIdx === idx ? null : idx);
                    }}
                    className="w-full flex items-center justify-between p-4 text-left font-bold text-sm text-stone-900 focus:outline-none"
                  >
                    <span>{faq.question}</span>
                    <span className={cn("text-stone-400 transition-transform duration-200", openFaqIdx === idx && "rotate-180")}>
                      ▼
                    </span>
                  </button>
                  {openFaqIdx === idx && (
                    <div className="px-4 pb-4 text-xs text-stone-500 leading-relaxed font-medium border-t border-stone-100 pt-3 animate-fade-in">
                      {faq.answer}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>

          {/* Tag bubbles */}
          {activeItem.tags.length > 0 && (
            <div className="pt-8 border-t border-stone-200/60 flex flex-wrap gap-2.5 select-none">
              {activeItem.tags.map((t) => (
                <Link
                  key={t}
                  to={`/tag/${t}`}
                  className="px-3.5 py-1.5 rounded-xl border border-stone-200 bg-white text-xs font-bold text-stone-500 hover:text-amber-600 hover:border-amber-300 transition-all uppercase tracking-wider"
                >
                  #{t}
                </Link>
              ))}
            </div>
          )}

          {/* ── RELATED CLUSTERS WIDGET (6-8 items) ── */}
          {relatedArticles.length > 0 && (
            <section className="pt-12 border-t border-stone-200/60 select-none">
              <h3 className="text-lg font-black text-stone-900 tracking-tight uppercase tracking-wider mb-6">People Also Read</h3>
              <div className="grid sm:grid-cols-2 gap-4">
                {relatedArticles.map((article) => (
                  <Link
                    key={article.slug}
                    to={`/${article.slug}`}
                    className="p-5 rounded-2xl border border-stone-200 bg-white hover:border-amber-400/30 hover:shadow-md transition-all flex flex-col justify-between group"
                  >
                    <div>
                      <span className="text-[10px] font-black text-amber-600 uppercase tracking-widest block mb-1">{article.category}</span>
                      <h4 className="font-extrabold text-stone-900 group-hover:text-amber-600 transition-colors text-sm leading-snug">
                        {article.h1}
                      </h4>
                    </div>
                    <span className="text-[10px] text-stone-400 font-bold pt-4">Read Time: {article.readTime} mins ➔</span>
                  </Link>
                ))}
              </div>
            </section>
          )}

        </section>
      </div>
    </main>
  );
}

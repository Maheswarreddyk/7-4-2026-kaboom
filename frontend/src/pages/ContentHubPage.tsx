import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { compileSeoPages } from '../utils/seoCompiler.js';
import { MetaManager } from '../components/MetaManager.js';
import { playTapSound } from '../utils/audio.js';
import { cn } from '../utils/index.js';

export function ContentHubPage() {
  const { category: urlCategory } = useParams<{ category?: string }>();
  
  const allItems = compileSeoPages();
  const categoriesList = ['countries', 'languages', 'devices', 'intent', 'features', 'comparisons', 'glossary', 'guides'];

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>(urlCategory || 'all');
  const [selectedTag, setSelectedTag] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'popular' | 'updated'>('popular');

  // Dynamic filter query calculations
  const filteredItems = allItems.filter((item) => {
    // 1. Search Query filter (matches title, description, h1, tags, category)
    const normalizedQuery = searchQuery.toLowerCase().trim();
    const queryMatch = !normalizedQuery || 
      item.title.toLowerCase().includes(normalizedQuery) ||
      item.description.toLowerCase().includes(normalizedQuery) ||
      item.h1.toLowerCase().includes(normalizedQuery) ||
      item.category.toLowerCase().includes(normalizedQuery) ||
      item.tags.some(tag => tag.toLowerCase().includes(normalizedQuery));

    // 2. Category filter
    const categoryMatch = selectedCategory === 'all' || item.category === selectedCategory;

    // 3. Tag filter
    const tagMatch = selectedTag === 'all' || item.tags.includes(selectedTag);

    return queryMatch && categoryMatch && tagMatch;
  });

  // Sort results
  const sortedItems = [...filteredItems].sort((a, b) => {
    if (sortBy === 'popular') {
      return (b.popular ? 1 : 0) - (a.popular ? 1 : 0);
    }
    // Updated date comparison
    return b.lastUpdated.localeCompare(a.lastUpdated);
  });

  // Gather top 12 unique tags for filtering bubbles
  const topTags = Array.from(new Set(allItems.flatMap((item) => item.tags))).slice(0, 15);

  const handleFilterCategory = (cat: string) => {
    playTapSound();
    setSelectedCategory(cat);
  };

  const handleFilterTag = (tag: string) => {
    playTapSound();
    setSelectedTag(tag);
  };

  const handleSort = (sort: 'popular' | 'updated') => {
    playTapSound();
    setSortBy(sort);
  };

  return (
    <main className="min-h-screen bg-[#FAF9F7] text-stone-800 pb-20 selection:bg-amber-500/20" role="main">
      <MetaManager 
        page="faq" // Fallback fallback or default
        customConfig={{
          title: 'Topics & Knowledge Hub | Random Video Chat Guides | Kaboom TV',
          description: 'Explore our topics library. Get answers to STUN, TURN, WebRTC, mobile compatibility, country guidelines, and competitor comparisons.',
          keywords: ['knowledge base', 'faq topics', 'webrtc guides'],
          canonical: 'https://kaboom-tv.com/topics'
        }}
      />

      {/* ── Dynamic Category Header ── */}
      <section className="bg-white border-b border-stone-200/50 py-16 px-4 sm:px-6 lg:px-8 select-none text-center">
        <div className="max-w-4xl mx-auto space-y-4">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-amber-200 bg-amber-50 text-[10px] font-black uppercase tracking-wider text-amber-700">
            ✦ Knowledge Gateway
          </div>
          <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-stone-900 leading-none">
            Explore All Topics
          </h1>
          <p className="text-stone-500 text-sm max-w-md mx-auto leading-relaxed font-medium">
            Browse our programmatic library containing detailed WebRTC glosssaries, country safety rules, platform compatibility, and features.
          </p>

          {/* Quick Search bar */}
          <div className="max-w-md mx-auto pt-6">
            <div className="relative bg-stone-50 border border-stone-200 rounded-2xl px-4 py-3 shadow-sm flex items-center gap-3">
              <span className="text-stone-400 text-lg">🔍</span>
              <input
                type="text"
                placeholder="Search topics, tags, countries, and comparisons..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex-1 bg-transparent border-0 text-stone-800 placeholder-stone-400 text-sm font-medium focus:ring-0 focus:outline-none"
              />
              {searchQuery && (
                <button 
                  onClick={() => setSearchQuery('')}
                  className="text-stone-400 text-xs hover:text-stone-700 font-bold p-1"
                >
                  Clear
                </button>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ── Filters and content list ── */}
      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-12 grid lg:grid-cols-4 gap-10">
        
        {/* Sidebar Filters */}
        <aside className="lg:col-span-1 space-y-8 select-none">
          {/* Categories select list */}
          <div>
            <h3 className="text-xs font-black uppercase text-stone-400 tracking-wider mb-4">Categories</h3>
            <div className="flex flex-col gap-1.5">
              <button
                onClick={() => handleFilterCategory('all')}
                className={cn(
                  "w-full text-left px-4 py-2.5 rounded-xl text-xs font-bold transition-all uppercase tracking-wider flex justify-between items-center",
                  selectedCategory === 'all' 
                    ? "bg-amber-500 text-stone-950 font-black" 
                    : "bg-white border border-stone-200 text-stone-500 hover:bg-stone-50"
                )}
              >
                <span>All Categories</span>
                <span className="text-[10px] opacity-60">({allItems.length})</span>
              </button>
              {categoriesList.map((cat) => {
                const count = allItems.filter(i => i.category === cat).length;
                return (
                  <button
                    key={cat}
                    onClick={() => handleFilterCategory(cat)}
                    className={cn(
                      "w-full text-left px-4 py-2.5 rounded-xl text-xs font-bold transition-all uppercase tracking-wider flex justify-between items-center",
                      selectedCategory === cat 
                        ? "bg-amber-500 text-stone-950 font-black" 
                        : "bg-white border border-stone-200 text-stone-500 hover:bg-stone-50"
                    )}
                  >
                    <span>{cat}</span>
                    <span className="text-[10px] opacity-60">({count})</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Tags list */}
          <div>
            <h3 className="text-xs font-black uppercase text-stone-400 tracking-wider mb-4">Popular Tags</h3>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => handleFilterTag('all')}
                className={cn(
                  "px-3 py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-colors",
                  selectedTag === 'all' 
                    ? "bg-stone-900 text-white" 
                    : "bg-white border border-stone-200 text-stone-500 hover:bg-stone-50"
                )}
              >
                #all
              </button>
              {topTags.map((tag) => (
                <button
                  key={tag}
                  onClick={() => handleFilterTag(tag)}
                  className={cn(
                    "px-3 py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-colors",
                    selectedTag === tag 
                      ? "bg-stone-900 text-white" 
                      : "bg-white border border-stone-200 text-stone-500 hover:bg-stone-50"
                  )}
                >
                  #{tag}
                </button>
              ))}
            </div>
          </div>
        </aside>

        {/* Content list Grid */}
        <section className="lg:col-span-3 space-y-6">
          
          {/* Sorting controls bar */}
          <div className="flex items-center justify-between border-b border-stone-200 pb-4 select-none">
            <span className="text-xs text-stone-400 font-bold">
              Showing {sortedItems.length} matching topics
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleSort('popular')}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-bold transition-colors",
                  sortBy === 'popular' ? "bg-amber-100 text-amber-800" : "text-stone-400 hover:text-stone-700"
                )}
              >
                Popular
              </button>
              <button
                onClick={() => handleSort('updated')}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-bold transition-colors",
                  sortBy === 'updated' ? "bg-amber-100 text-amber-800" : "text-stone-400 hover:text-stone-700"
                )}
              >
                Latest
              </button>
            </div>
          </div>

          {/* Cards grid list */}
          {sortedItems.length === 0 ? (
            <div className="py-20 text-center select-none">
              <span className="text-4xl mb-4 block">🔮</span>
              <h3 className="font-extrabold text-stone-900 text-base">No Matching Topics Found</h3>
              <p className="text-stone-400 text-xs mt-1 max-w-xs mx-auto leading-relaxed">
                Try clearing your search filters or modifying search keywords.
              </p>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 gap-4">
              {sortedItems.map((item) => (
                <Link
                  key={item.slug}
                  to={`/${item.slug}`}
                  className="p-6 rounded-2xl border border-stone-200 bg-white hover:border-amber-400/30 hover:shadow-md transition-all flex flex-col justify-between group"
                >
                  <div>
                    <span className="text-[10px] font-black text-amber-600 uppercase tracking-widest block mb-1">
                      {item.category}
                    </span>
                    <h2 className="font-black text-stone-900 group-hover:text-amber-600 transition-colors text-base leading-snug">
                      {item.h1}
                    </h2>
                    <p className="text-xs text-stone-500 font-medium leading-relaxed mt-2.5 line-clamp-2">
                      {item.description}
                    </p>
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-stone-400 font-bold pt-6 select-none border-t border-stone-50 mt-4">
                    <span>Read: {item.readTime} mins</span>
                    <span className="group-hover:translate-x-0.5 transition-transform">Read Guide ➔</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>

      </div>
    </main>
  );
}

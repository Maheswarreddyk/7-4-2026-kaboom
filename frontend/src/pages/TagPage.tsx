import { useParams, Link } from 'react-router-dom';
import { compileSeoPages } from '../utils/seoCompiler.js';
import { MetaManager } from '../components/MetaManager.js';
import { playTapSound } from '../utils/audio.js';

export function TagPage() {
  const { tagName } = useParams<{ tagName: string }>();
  
  const allItems = compileSeoPages();
  const matchingItems = allItems.filter(
    (item) => item.tags.includes(tagName || '')
  );

  return (
    <main className="min-h-screen bg-[#FAF9F7] text-stone-800 pb-20 selection:bg-amber-500/20" role="main">
      <MetaManager 
        page="faq" 
        customConfig={{
          title: `#${tagName} Articles | Topic Collections | Kaboom TV`,
          description: `Browse all articles, guides, and technical explanations tagged with #${tagName} on Kaboom TV.`,
          keywords: [tagName || '', 'topics list', 'collection'],
          canonical: `https://kaboom-tv.com/tag/${tagName}`
        }}
      />

      {/* Header bar */}
      <section className="bg-white border-b border-stone-200/50 py-16 px-4 sm:px-6 lg:px-8 select-none text-center">
        <div className="max-w-4xl mx-auto space-y-4">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-stone-200 bg-white text-[9px] font-bold tracking-[0.2em] text-amber-600 uppercase mb-5 shadow-sm">
            ✦ Tag Archives
          </div>
          <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-stone-900 leading-none">
            #{tagName} Topics
          </h1>
          <p className="text-stone-500 text-sm max-w-md mx-auto leading-relaxed font-medium">
            Explore all guides, comparisons, and glossary terms covering the hashtag #{tagName}.
          </p>
          <div className="pt-4">
            <Link to="/topics" className="text-xs text-amber-600 font-bold hover:underline select-none">
              ← Back to All Topics
            </Link>
          </div>
        </div>
      </section>

      {/* Grid listing */}
      <div className="w-full max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 mt-12">
        {matchingItems.length === 0 ? (
          <div className="py-20 text-center select-none">
            <span className="text-4xl mb-4 block">🔮</span>
            <h3 className="font-extrabold text-stone-900 text-base">No Articles Found</h3>
            <p className="text-stone-400 text-xs mt-1 max-w-xs mx-auto leading-relaxed">
              No matching guides are currently tagged with #{tagName}.
            </p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 gap-6">
            {matchingItems.map((item) => (
              <Link
                key={item.slug}
                to={`/${item.slug}`}
                onClick={playTapSound}
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
      </div>
    </main>
  );
}

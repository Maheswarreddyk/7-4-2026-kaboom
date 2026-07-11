import { useState, useEffect, useRef, useCallback } from 'react';
import { apiService } from '../services/api.js';
import { cn } from '../utils/index.js';
import { COLLEGE_SUGGESTIONS } from '../utils/collegeSuggestions.js';

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

interface PreferenceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (preferences: any) => Promise<void> | void;
  currentPreferences?: any;
}

type JourneyMode = 'FAST' | 'ADVANCED';
type CategoryId = 'COLLEGE' | 'NEARBY' | 'LANGUAGE' | 'INTERESTS' | 'RANDOM';
type SavingState = 'idle' | 'joining' | 'spinner' | 'success';

// ─────────────────────────────────────────────────────────────
// Static data
// ─────────────────────────────────────────────────────────────

const LANGUAGES = [
  'English', 'Hindi', 'Telugu', 'Tamil', 'Kannada', 'Malayalam',
  'Spanish', 'French', 'German', 'Japanese', 'Chinese', 'Arabic', 'Russian',
];

const BANNER_MESSAGES = [
  'Someone unexpected...',
  'Someone from your city...',
  'Someone from your campus...',
  'Someone who speaks Telugu...',
  'Someone genuinely interesting...',
];

const NAME_PLACEHOLDERS = ['Rahul', 'Aishu', 'Shadow', 'CoffeeAddict', 'Mahes'];
const BIO_PLACEHOLDERS = [
  'Just finished exams 🎉',
  'Need coffee friends ☕',
  'Late night conversations',
  'Looking for coding buddies',
  'Anyone up for gaming?',
];

// Rotating invitation copy beneath "Discover Match Filters"
const DISCOVER_COPY = [
  { icon: '🏫', text: 'Meet people from your campus' },
  { icon: '🌍', text: 'Find people nearby' },
  { icon: '💬', text: 'Talk in your language' },
  { icon: '🎮', text: 'Match by hobbies' },
  { icon: '❤️', text: 'Discover someone unexpected' },
];

// Per-tab tickers
const TAB_TICKERS: Record<CategoryId, string[]> = {
  COLLEGE: [
    'Students from Saveetha joined...',
    'Someone from SRM is waiting...',
    'Someone from VIT is looking for new friends...',
    'Meet people from your campus.',
  ],
  NEARBY: [
    'Someone nearby joined...',
    'People from Hyderabad are online...',
    'Strangers waving in Bangalore...',
    'Connecting you to nearby peers...',
  ],
  LANGUAGE: [
    'Telugu conversations are active...',
    'Hindi speakers just joined...',
    'English rooms are filling up...',
    'Someone waiting to speak Tamil...',
  ],
  INTERESTS: [
    'Gamers are online right now...',
    'AI enthusiasts are waiting...',
    'Music lovers sharing playlists...',
    'Cricket fans are matching...',
  ],
  RANDOM: [
    'Forget filters. Let\'s surprise you.',
    'Discover someone unexpected...',
    'Every conversation starts with one click.',
  ],
};

// ─────────────────────────────────────────────────────────────
// Animation CSS
// ─────────────────────────────────────────────────────────────

const STYLES = `
  @keyframes slideUpFadeIn {
    from { opacity: 0; transform: translateY(24px); }
    to   { opacity: 1; transform: translateY(0);    }
  }
  @keyframes hammerTap {
    0%, 88%, 100% { transform: rotate(0deg); }
    90%, 96%      { transform: rotate(-22deg); }
    93%           { transform: rotate(8deg); }
  }
  @keyframes breathe {
    0%, 100% { transform: scale(1); }
    50%      { transform: scale(1.022); }
  }
  @keyframes recipeShake {
    0%, 100% { transform: translateX(0); }
    20%, 60% { transform: translateX(-6px); }
    40%, 80% { transform: translateX(6px); }
  }
  @keyframes inwardParticle {
    0%   { transform: translate(var(--dx), var(--dy)) scale(0); opacity: 0; }
    20%  { opacity: 0.9; }
    100% { transform: translate(0, 0) scale(1); opacity: 0; }
  }
  .anim-slide-up  { animation: slideUpFadeIn 0.35s cubic-bezier(0.34,1.56,0.64,1) both; }
  .anim-breathe   { animation: breathe 4.5s ease-in-out infinite; }
  .anim-hammer    { animation: hammerTap 9s ease-in-out infinite; transform-origin: bottom right; }
  .anim-shake     { animation: recipeShake 0.42s ease-in-out; }
  .particle {
    position: absolute; width: 3px; height: 3px; border-radius: 50%;
    background: rgba(251,191,36,0.8); top: 50%; left: 50%;
    pointer-events: none;
  }
  .p1 { --dx:-78px; --dy:-28px; animation: inwardParticle 2.3s infinite ease-in; }
  .p2 { --dx:82px;  --dy:32px;  animation: inwardParticle 2.7s infinite ease-in; animation-delay:.45s; }
  .p3 { --dx:-48px; --dy:48px;  animation: inwardParticle 2.1s infinite ease-in; animation-delay:.85s; }
  .p4 { --dx:66px;  --dy:-44px; animation: inwardParticle 2.5s infinite ease-in; animation-delay:1.25s; }
`;

// ─────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────

function TypewriterRotator({
  messages,
  speed = 42,
  delay = 2200,
  className = '',
}: {
  messages: string[];
  speed?: number;
  delay?: number;
  className?: string;
}) {
  const [idx, setIdx] = useState(0);
  const [text, setText] = useState('');
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const full = messages[idx] ?? '';
    let timer: ReturnType<typeof setTimeout>;
    if (!deleting) {
      if (text === full) {
        timer = setTimeout(() => setDeleting(true), delay);
      } else {
        timer = setTimeout(() => setText(full.slice(0, text.length + 1)), speed);
      }
    } else {
      if (text === '') {
        setDeleting(false);
        setIdx(i => (i + 1) % messages.length);
      } else {
        timer = setTimeout(() => setText(text.slice(0, -1)), 18);
      }
    }
    return () => clearTimeout(timer);
  }, [text, deleting, idx, messages, speed, delay]);

  return (
    <span className={className}>
      {text}
      <span className="inline-block w-0.5 h-3.5 bg-current ml-0.5 align-middle animate-pulse" />
    </span>
  );
}

// ─────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────

export function PreferenceModal({
  isOpen,
  onClose,
  onSave,
  currentPreferences = {},
}: PreferenceModalProps) {
  // ── Telemetry ──────────────────────────────────────────────
  const openedAt = useRef(Date.now());
  const didJoin = useRef(false);

  // ── Journey state ──────────────────────────────────────────
  const [journey, setJourney] = useState<JourneyMode>('FAST');
  const [activeCategory, setActiveCategory] = useState<CategoryId | null>(null);

  // ── Primary fields (always collected) ─────────────────────
  const [displayName, setDisplayName] = useState(() =>
    currentPreferences.display_name || localStorage.getItem('kaboom_display_name') || '',
  );
  const [bio, setBio] = useState(() =>
    currentPreferences.bio || localStorage.getItem('kaboom_bio') || '',
  );
  const [gender, setGender] = useState<string>(
    currentPreferences.gender || 'Prefer not to say',
  );
  const [lookingFor, setLookingFor] = useState<string[]>(
    currentPreferences.looking_for || ['Anyone'],
  );

  // ── Advanced filter fields ─────────────────────────────────
  const [university, setUniversity] = useState(() => {
    const attrs = currentPreferences.match_attributes || {};
    return attrs.university?.[0] || localStorage.getItem('kaboom_university') || '';
  });
  const [country, setCountry] = useState(currentPreferences.country || '');
  const [state, setState] = useState(currentPreferences.state || '');
  const [district, setDistrict] = useState(currentPreferences.district || '');
  const [city, setCity] = useState(currentPreferences.city || '');
  const [languages, setLanguages] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('kaboom_languages') || '["English"]'); } catch { return ['English']; }
  });
  const [interestTags, setInterestTags] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('kaboom_interest_tags') || '[]'); } catch { return []; }
  });

  // ── UI states ──────────────────────────────────────────────
  const [isSaving, setIsSaving] = useState<SavingState>('idle');
  const [isFadingOut, setIsFadingOut] = useState(false);
  const [shakeRecipe, setShakeRecipe] = useState(false);
  const [placeholderIdx, setPlaceholderIdx] = useState(0);
  const [discoverCopyIdx, setDiscoverCopyIdx] = useState(0);
  const [discoverVisible, setDiscoverVisible] = useState(true);

  // ── Autocomplete ───────────────────────────────────────────
  const [uniQuery, setUniQuery] = useState('');
  const [uniResults, setUniResults] = useState<any[]>([]);
  const [locQuery, setLocQuery] = useState('');
  const [locResults, setLocResults] = useState<any[]>([]);
  const [intQuery, setIntQuery] = useState('');
  const [intResults, setIntResults] = useState<any[]>([]);

  const uniDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const locDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const intDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Refs ───────────────────────────────────────────────────
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const [magnetic, setMagnetic] = useState({ x: 0, y: 0 });
  const [btnHovered, setBtnHovered] = useState(false);

  // ─────────────────────────────────────────────────────────
  // Computed
  // ─────────────────────────────────────────────────────────

  const activeFilterCount = useCallback(() => {
    let n = 0;
    if (university) n++;
    if (city) n++;
    const extraLangs = languages.filter(l => l !== 'English');
    if (extraLangs.length > 0) n += extraLangs.length;
    n += interestTags.length;
    return n;
  }, [university, city, languages, interestTags]);

  const filterCount = activeFilterCount();
  const hasAdvancedFilters = filterCount > 0;

  // ─────────────────────────────────────────────────────────
  // Effects
  // ─────────────────────────────────────────────────────────

  useEffect(() => {
    if (!isOpen) return;
    openedAt.current = Date.now();
    didJoin.current = false;
    setJourney('FAST');
    setActiveCategory(null);
    setIsSaving('idle');
    setIsFadingOut(false);
  }, [isOpen]);

  // Rotate name/bio placeholders
  useEffect(() => {
    if (!isOpen) return;
    const t = setInterval(() => setPlaceholderIdx(i => (i + 1) % NAME_PLACEHOLDERS.length), 3500);
    return () => clearInterval(t);
  }, [isOpen]);

  // Rotate "Discover Match Filters" copy with fade
  useEffect(() => {
    if (!isOpen || journey === 'ADVANCED') return;
    const t = setInterval(() => {
      setDiscoverVisible(false);
      setTimeout(() => {
        setDiscoverCopyIdx(i => (i + 1) % DISCOVER_COPY.length);
        setDiscoverVisible(true);
      }, 280);
    }, 3500);
    return () => clearInterval(t);
  }, [isOpen, journey]);

  // University autocomplete
  useEffect(() => {
    if (uniQuery.trim().length < 2) { setUniResults([]); return; }
    if (uniDebounce.current) clearTimeout(uniDebounce.current);
    uniDebounce.current = setTimeout(async () => {
      try { setUniResults(await apiService.getUniversities(uniQuery)); } catch { setUniResults([]); }
    }, 240);
    return () => { if (uniDebounce.current) clearTimeout(uniDebounce.current); };
  }, [uniQuery]);

  // Location autocomplete
  useEffect(() => {
    if (!locQuery.trim()) { setLocResults([]); return; }
    if (locDebounce.current) clearTimeout(locDebounce.current);
    locDebounce.current = setTimeout(async () => {
      try { setLocResults(await apiService.getLocations(locQuery)); } catch { setLocResults([]); }
    }, 240);
    return () => { if (locDebounce.current) clearTimeout(locDebounce.current); };
  }, [locQuery]);

  // Interest autocomplete
  useEffect(() => {
    if (!intQuery.trim()) { setIntResults([]); return; }
    if (intDebounce.current) clearTimeout(intDebounce.current);
    intDebounce.current = setTimeout(async () => {
      try { setIntResults(await apiService.getInterests(intQuery)); } catch { setIntResults([]); }
    }, 240);
    return () => { if (intDebounce.current) clearTimeout(intDebounce.current); };
  }, [intQuery]);

  // ─────────────────────────────────────────────────────────
  // Helpers
  // ─────────────────────────────────────────────────────────

  const log = (event: string, meta?: any) => console.log(`[Kaboom] ${event}`, meta || {});

  const handleClose = () => {
    if (!didJoin.current) {
      log('Modal abandoned', { ms: Date.now() - openedAt.current });
    }
    onClose();
  };

  const handleLookingForChange = (val: string) => {
    if (val === 'Anyone') { setLookingFor(['Anyone']); return; }
    let next = lookingFor.filter(x => x !== 'Anyone');
    next = next.includes(val) ? next.filter(x => x !== val) : [...next, val];
    setLookingFor(next.length === 0 ? ['Anyone'] : next);
  };

  const tryAddFilter = (action: () => void) => {
    if (filterCount >= 3) {
      setShakeRecipe(true);
      setTimeout(() => setShakeRecipe(false), 450);
      return;
    }
    action();
  };

  const clearLocation = () => { setCountry(''); setState(''); setDistrict(''); setCity(''); };

  const selectLocation = (loc: any) => {
    tryAddFilter(() => {
      setCountry(loc.country || '');
      setState(loc.state || '');
      setDistrict(loc.district || '');
      setCity(loc.city || '');
      setLocQuery('');
      setLocResults([]);
    });
  };

  const addInterest = (name: string) => {
    if (interestTags.includes(name)) return;
    tryAddFilter(() => {
      setInterestTags(prev => [...prev, name]);
      setIntQuery('');
      setIntResults([]);
    });
  };

  const toggleLanguage = (lang: string) => {
    if (languages.includes(lang)) {
      setLanguages(prev => prev.filter(l => l !== lang));
    } else {
      tryAddFilter(() => setLanguages(prev => [...prev, lang]));
    }
  };

  const validateName = (): boolean => {
    const n = displayName.trim();
    if (n.length < 3) { alert('Display name must be at least 3 characters.'); return false; }
    if (n.length > 25) { alert('Display name cannot exceed 25 characters.'); return false; }
    if (/<[^>]*>/.test(n)) { alert('Display name cannot contain HTML.'); return false; }
    const badWords = ['fuck','shit','asshole','bitch','crap','dick','pussy','bastard','cunt','nigger','faggot'];
    if (badWords.some(w => n.toLowerCase().includes(w))) { alert('Please keep your display name friendly.'); return false; }
    return true;
  };

  const buildFastPayload = () => ({
    display_name: displayName.trim(),
    bio: bio.trim() || null,
    gender,
    looking_for: lookingFor,
    languages: ['English'],
    match_mode: 'PREFER',
    match_constraints: {},
    match_attributes: {},
    country: null, state: null, district: null, city: null,
    interest_tags: [],
  });

  const buildAdvancedPayload = (mode: 'PREFER' | 'STRICT') => ({
    display_name: displayName.trim(),
    bio: bio.trim() || null,
    gender,
    looking_for: lookingFor,
    languages,
    interest_tags: interestTags,
    country: country || null,
    state: state || null,
    district: district || null,
    city: city || null,
    match_mode: mode,
    match_constraints: mode === 'STRICT'
      ? {
          university: !!university,
          city: !!city,
          country: !!country,
          languages: languages.filter(l => l !== 'English').length > 0,
          interests: interestTags.length > 0,
        }
      : {},
    match_attributes: {
      university: university ? [university] : [],
      city: city ? [city] : [],
      state: state ? [state] : [],
      country: country ? [country] : [],
      languages,
      interests: interestTags,
    },
  });

  const persistLocals = (name: string) => {
    localStorage.setItem('kaboom_display_name', name);
    localStorage.setItem('kaboom_bio', bio.trim());
    localStorage.setItem('kaboom_university', university);
    localStorage.setItem('kaboom_interest_tags', JSON.stringify(interestTags));
    localStorage.setItem('kaboom_languages', JSON.stringify(languages));
    localStorage.setItem('kaboom_country', country);
    localStorage.setItem('kaboom_city', city);
  };

  const executeJoin = async (payload: any, label: string) => {
    if (!validateName()) return;
    setIsSaving('joining');
    didJoin.current = true;
    persistLocals(payload.display_name);
    log(label, { durationMs: Date.now() - openedAt.current });

    setTimeout(() => setIsSaving('spinner'), 800);
    try {
      await onSave(payload);
      setTimeout(() => setIsSaving('success'), 1600);
      setTimeout(() => setIsFadingOut(true), 2200);
      setTimeout(() => { onClose(); setIsSaving('idle'); setIsFadingOut(false); }, 2550);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Could not join queue.');
      setIsSaving('idle');
    }
  };

  // ─────────────────────────────────────────────────────────
  // Magnetic button handlers
  // ─────────────────────────────────────────────────────────

  const onBtnMouseMove = (e: React.MouseEvent) => {
    if (!btnRef.current) return;
    const r = btnRef.current.getBoundingClientRect();
    const dx = e.clientX - (r.left + r.width / 2);
    const dy = e.clientY - (r.top + r.height / 2);
    setMagnetic({ x: dx * 0.04, y: dy * 0.04 });
  };

  if (!isOpen) return null;

  const discoverItem = DISCOVER_COPY[discoverCopyIdx];

  // ─────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────

  return (
    <div
      className={cn(
        'fixed inset-0 z-[999] flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-md transition-all duration-300 select-none',
        isFadingOut ? 'opacity-0 pointer-events-none scale-95' : 'opacity-100 scale-100',
      )}
    >
      <style>{STYLES}</style>

      <div className="relative w-full max-w-lg bg-stone-900 border border-white/10 rounded-t-3xl sm:rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[92vh] sm:max-h-[90vh]">

        {/* ── Header ─────────────────────────────────────────── */}
        <div className="px-6 py-4 flex items-center justify-between border-b border-white/[0.08] bg-stone-950 shrink-0">
          <div>
            <h2 className="text-sm font-black text-white uppercase tracking-wider">
              Who do you want to meet today?
            </h2>
            <div className="h-4 mt-0.5">
              <TypewriterRotator
                messages={BANNER_MESSAGES}
                className="text-[10px] font-semibold text-amber-500/75"
              />
            </div>
          </div>
          {isSaving === 'idle' && (
            <button
              onClick={handleClose}
              className="p-2 text-white/30 hover:text-white/70 rounded-full hover:bg-white/5 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* ── Scrollable body ─────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto">

          {/* ══ IDENTITY SECTION (always visible) ══ */}
          <div className="px-6 pt-5 pb-4 space-y-4">

            {/* Name */}
            <div>
              <label className="block text-[9px] text-stone-500 uppercase font-black tracking-widest mb-1.5">
                👋 What should people call you?
              </label>
              <input
                type="text"
                placeholder={NAME_PLACEHOLDERS[placeholderIdx]}
                value={displayName}
                maxLength={25}
                onChange={e => setDisplayName(e.target.value)}
                className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-stone-600 focus:outline-none focus:border-amber-500 text-sm font-semibold transition-colors"
              />
            </div>

            {/* Bio */}
            <div>
              <label className="block text-[9px] text-stone-500 uppercase font-black tracking-widest mb-1.5">
                ✨ Tell people your vibe
              </label>
              <input
                type="text"
                placeholder={BIO_PLACEHOLDERS[placeholderIdx % BIO_PLACEHOLDERS.length]}
                value={bio}
                maxLength={120}
                onChange={e => setBio(e.target.value.slice(0, 120))}
                className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-stone-600 focus:outline-none focus:border-amber-500 text-sm font-semibold transition-colors"
              />
            </div>

            {/* I Am / Looking For */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[9px] text-stone-500 uppercase font-black tracking-widest mb-1.5">I Am</label>
                <div className="flex flex-wrap gap-1.5">
                  {['Male', 'Female', 'Non-Binary', 'Prefer not to say'].map(g => (
                    <button
                      key={g}
                      type="button"
                      onClick={() => setGender(g)}
                      className={cn(
                        'px-2.5 py-1.5 text-[9px] rounded-lg font-bold border transition-all',
                        gender === g
                          ? 'bg-amber-500 border-amber-500 text-stone-950'
                          : 'border-white/10 bg-white/5 text-stone-400 hover:bg-white/10',
                      )}
                    >
                      {g.split(' ')[0]}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-[9px] text-stone-500 uppercase font-black tracking-widest mb-1.5">Looking For</label>
                <div className="flex flex-wrap gap-1.5">
                  {['Male', 'Female', 'Anyone'].map(l => (
                    <button
                      key={l}
                      type="button"
                      onClick={() => handleLookingForChange(l)}
                      className={cn(
                        'px-2.5 py-1.5 text-[9px] rounded-lg font-bold border transition-all',
                        lookingFor.includes(l)
                          ? 'bg-amber-500 border-amber-500 text-stone-950'
                          : 'border-white/10 bg-white/5 text-stone-400 hover:bg-white/10',
                      )}
                    >
                      {l}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* ══ JOURNEY 1 — Fast CTA + Discover invite ══ */}
          {journey === 'FAST' && (
            <div className="px-6 pb-6 space-y-5 anim-slide-up">

              {/* Primary CTA — Start Conversation */}
              <div className="flex justify-center">
                <button
                  ref={btnRef}
                  type="button"
                  disabled={isSaving !== 'idle'}
                  onClick={() => executeJoin(buildFastPayload(), 'Fast journey queue join')}
                  onMouseMove={onBtnMouseMove}
                  onMouseEnter={() => setBtnHovered(true)}
                  onMouseLeave={() => { setMagnetic({ x: 0, y: 0 }); setBtnHovered(false); }}
                  style={{ transform: `translate3d(${magnetic.x}px, ${magnetic.y}px, 0)` }}
                  className="relative overflow-hidden px-10 py-4 bg-amber-500 text-stone-950 text-[13px] font-black rounded-2xl shadow-lg shadow-amber-500/15 flex items-center gap-2 min-w-[220px] justify-center transition-all duration-300 active:scale-95 anim-breathe hover:shadow-amber-500/25 hover:-translate-y-0.5 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {/* Particles */}
                  <div className="absolute inset-0 rounded-2xl overflow-hidden pointer-events-none">
                    <div className={cn('particle p1', btnHovered && 'duration-200')} />
                    <div className={cn('particle p2', btnHovered && 'duration-200')} />
                    <div className={cn('particle p3', btnHovered && 'duration-200')} />
                    <div className={cn('particle p4', btnHovered && 'duration-200')} />
                  </div>
                  {isSaving === 'idle' && <span className="anim-hammer shrink-0">🔨</span>}
                  <span className="relative z-10">
                    {isSaving === 'idle'    && '🚀 Start Conversation'}
                    {isSaving === 'joining' && 'Joining...'}
                    {isSaving === 'spinner' && (
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                    )}
                    {isSaving === 'success' && '✓ Ready!'}
                  </span>
                </button>
              </div>

              {/* Discover Match Filters invitation */}
              <div className="flex flex-col items-center gap-3 pt-1">
                {/* Divider */}
                <div className="flex items-center gap-3 w-full">
                  <div className="flex-1 h-px bg-white/[0.06]" />
                  <span className="text-[9px] text-stone-600 font-bold uppercase tracking-widest">or</span>
                  <div className="flex-1 h-px bg-white/[0.06]" />
                </div>

                {/* Rotating copy */}
                <div
                  className="transition-all duration-300"
                  style={{ opacity: discoverVisible ? 1 : 0, transform: discoverVisible ? 'translateY(0)' : 'translateY(4px)' }}
                >
                  <p className="text-[10px] text-stone-500 font-semibold text-center">
                    {discoverItem.icon} {discoverItem.text}
                  </p>
                </div>

                {/* Discover button */}
                <button
                  type="button"
                  onClick={() => {
                    setJourney('ADVANCED');
                    setActiveCategory('COLLEGE');
                    log('Advanced journey opened');
                  }}
                  className="px-5 py-2.5 border border-white/10 bg-white/[0.03] hover:bg-white/[0.07] text-white text-[11px] font-black rounded-xl transition-all active:scale-95 flex items-center gap-2"
                >
                  <span>✨</span>
                  <span>Discover Match Filters</span>
                </button>
              </div>
            </div>
          )}

          {/* ══ JOURNEY 2 — Advanced filter experience ══ */}
          {journey === 'ADVANCED' && (
            <div className="anim-slide-up">

              {/* Back to simple */}
              <div className="px-6 pt-1 pb-3 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => { setJourney('FAST'); setActiveCategory(null); }}
                  className="text-[10px] text-stone-500 hover:text-stone-300 font-bold flex items-center gap-1 transition-colors"
                >
                  ← Back to quick start
                </button>
              </div>

              {/* ── Category selector row ─────────────────────────── */}
              <div className="px-6 grid grid-cols-5 gap-2 pb-4">
                {(['COLLEGE', 'NEARBY', 'LANGUAGE', 'INTERESTS', 'RANDOM'] as CategoryId[]).map(id => {
                  const META = {
                    COLLEGE:   { icon: '🏫', label: 'Campus' },
                    NEARBY:    { icon: '🌍', label: 'Nearby' },
                    LANGUAGE:  { icon: '💬', label: 'Language' },
                    INTERESTS: { icon: '🎮', label: 'Interests' },
                    RANDOM:    { icon: '❤️', label: 'Surprise' },
                  }[id];
                  const active = activeCategory === id;
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setActiveCategory(prev => prev === id ? null : id)}
                      className={cn(
                        'flex flex-col items-center gap-1 p-2.5 rounded-2xl border transition-all duration-200',
                        active
                          ? 'bg-amber-500/15 border-amber-500/50 scale-105'
                          : 'border-white/[0.07] bg-white/[0.02] hover:bg-white/[0.05]',
                        id === 'COLLEGE' && !active && 'border-amber-500/20',
                      )}
                    >
                      <span className="text-xl">{META.icon}</span>
                      <span className={cn('text-[8px] font-black', active ? 'text-amber-400' : 'text-stone-500')}>
                        {META.label}
                      </span>
                      {id === 'COLLEGE' && (
                        <span className="text-[6px] font-black text-amber-500 uppercase tracking-wide">⭐ Best</span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* ── Active category panel ─────────────────────────── */}
              {activeCategory && (
                <div className="px-6 pb-4 anim-slide-up" key={activeCategory}>
                  <div className="bg-stone-950/70 border border-white/[0.07] rounded-2xl p-4 space-y-3">

                    {/* Live ticker */}
                    <div className="text-center border-b border-white/[0.06] pb-2 mb-1">
                      <TypewriterRotator
                        messages={TAB_TICKERS[activeCategory]}
                        speed={30}
                        delay={1800}
                        className="text-[10px] font-semibold text-amber-500/70"
                      />
                    </div>

                    {/* Campus */}
                    {activeCategory === 'COLLEGE' && (
                      <div className="space-y-3">
                        <div className="relative">
                          <input
                            autoFocus
                            type="text"
                            placeholder="Search your university… e.g. VIT, SRM, IIT"
                            value={uniQuery}
                            onChange={e => { setUniQuery(e.target.value); if (!e.target.value) setUniversity(''); }}
                            className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-stone-600 focus:outline-none focus:border-amber-500 text-xs font-semibold"
                          />
                          {uniResults.length > 0 && (
                            <div className="absolute top-full mt-1.5 left-0 right-0 bg-stone-900 border border-white/10 rounded-xl max-h-32 overflow-y-auto z-30 shadow-xl divide-y divide-white/5">
                              {uniResults.map(u => (
                                <button key={u.name} type="button"
                                  onClick={() => { tryAddFilter(() => { setUniversity(u.name); setUniQuery(''); setUniResults([]); }); }}
                                  className="w-full px-4 py-2 text-left hover:bg-white/5 text-xs text-white/80 flex justify-between"
                                >
                                  <span className="font-bold">{u.name}</span>
                                  <span className="text-[9px] text-stone-500">{u.country}</span>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>

                        <div>
                          <p className="text-[8px] text-stone-600 uppercase font-black tracking-wider mb-1.5">Popular campuses</p>
                          <div className="flex flex-wrap gap-1.5">
                            {COLLEGE_SUGGESTIONS.slice(0, 5).map(col => (
                              <button key={col} type="button"
                                onClick={() => tryAddFilter(() => setUniversity(col))}
                                className={cn(
                                  'px-2.5 py-1 rounded-full text-[9px] font-bold border transition-colors',
                                  university === col
                                    ? 'bg-amber-500/20 border-amber-500 text-amber-400'
                                    : 'border-white/[0.07] bg-white/[0.02] text-stone-400 hover:bg-white/5',
                                )}
                              >
                                {col.split(' ')[0]}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Nearby */}
                    {activeCategory === 'NEARBY' && (
                      <div className="space-y-3">
                        <div className="relative">
                          <input
                            autoFocus
                            type="text"
                            placeholder="Search by city, state, or country…"
                            value={locQuery}
                            onChange={e => setLocQuery(e.target.value)}
                            className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-stone-600 focus:outline-none focus:border-amber-500 text-xs font-semibold"
                          />
                          {locResults.length > 0 && (
                            <div className="absolute top-full mt-1.5 left-0 right-0 bg-stone-900 border border-white/10 rounded-xl max-h-32 overflow-y-auto z-30 shadow-xl divide-y divide-white/5">
                              {locResults.map(loc => (
                                <button key={loc.id ?? loc.name} type="button"
                                  onClick={() => selectLocation(loc)}
                                  className="w-full px-4 py-2 text-left hover:bg-white/5 text-xs text-white/80 flex justify-between"
                                >
                                  <span>{loc.name}</span>
                                  <span className="text-[9px] text-stone-500 capitalize">{loc.type}</span>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                        {!city && (
                          <p className="text-[9px] text-stone-600 leading-relaxed">
                            Nearby conversations happen fastest. Search your city to improve suggestions.
                          </p>
                        )}
                      </div>
                    )}

                    {/* Language */}
                    {activeCategory === 'LANGUAGE' && (
                      <div className="space-y-2">
                        <p className="text-[9px] text-stone-500 leading-relaxed">
                          Select languages you're comfortable speaking.
                        </p>
                        <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto">
                          {LANGUAGES.map(lang => {
                            const sel = languages.includes(lang);
                            return (
                              <button key={lang} type="button" onClick={() => toggleLanguage(lang)}
                                className={cn(
                                  'px-3 py-1 rounded-full text-[10px] font-bold border transition-colors',
                                  sel
                                    ? 'bg-amber-500/20 border-amber-500 text-amber-400'
                                    : 'border-white/[0.07] bg-white/[0.02] text-stone-400 hover:bg-white/5',
                                )}
                              >
                                {lang}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Interests */}
                    {activeCategory === 'INTERESTS' && (
                      <div className="space-y-3">
                        <div className="relative">
                          <input
                            autoFocus
                            type="text"
                            placeholder="Search interests… e.g. Gaming, Music, AI"
                            value={intQuery}
                            onChange={e => setIntQuery(e.target.value)}
                            className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-stone-600 focus:outline-none focus:border-amber-500 text-xs font-semibold"
                          />
                          {intResults.length > 0 && (
                            <div className="absolute top-full mt-1.5 left-0 right-0 bg-stone-900 border border-white/10 rounded-xl max-h-32 overflow-y-auto z-30 shadow-xl divide-y divide-white/5">
                              {intResults.map(item => (
                                <button key={item.id ?? item.name} type="button"
                                  onClick={() => addInterest(item.name)}
                                  className="w-full px-4 py-2 text-left hover:bg-white/5 text-xs text-white/80 flex justify-between"
                                >
                                  <span>{item.name}</span>
                                  <span className="text-[9px] text-stone-500">{item.category}</span>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                        <p className="text-[9px] text-stone-600 leading-relaxed">
                          Shared hobbies make great icebreakers.
                        </p>
                      </div>
                    )}

                    {/* Surprise */}
                    {activeCategory === 'RANDOM' && (
                      <div className="text-center py-4 space-y-2">
                        <p className="text-2xl">🌎</p>
                        <p className="text-xs text-stone-400 font-semibold">
                          No filters. No expectations.
                        </p>
                        <p className="text-[9px] text-stone-600">
                          We'll introduce someone completely unexpected.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ── Active filter recipe ──────────────────────────── */}
              {hasAdvancedFilters && (
                <div className={cn('px-6 pb-4 anim-slide-up', shakeRecipe && 'anim-shake')}>
                  <div className={cn(
                    'p-3.5 border rounded-2xl bg-white/[0.02] transition-all',
                    shakeRecipe ? 'border-red-500/40' : 'border-white/[0.08]',
                  )}>
                    <div className="flex justify-between items-center mb-2">
                      <h4 className="text-[9px] font-black text-white/60 uppercase tracking-widest">✨ Today's Vibe</h4>
                      <span className={cn('text-[9px] font-black', filterCount >= 3 ? 'text-red-400' : 'text-amber-500')}>
                        {filterCount}/3
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {university && (
                        <Chip label={`🏫 ${university.split(' ')[0]}`} onRemove={() => setUniversity('')} />
                      )}
                      {city && (
                        <Chip label={`📍 ${city}`} onRemove={clearLocation} />
                      )}
                      {languages.filter(l => l !== 'English').map(lang => (
                        <Chip key={lang} label={`💬 ${lang}`} onRemove={() => toggleLanguage(lang)} />
                      ))}
                      {interestTags.map(tag => (
                        <Chip key={tag} label={`🎮 ${tag}`} onRemove={() => setInterestTags(prev => prev.filter(t => t !== tag))} />
                      ))}
                    </div>
                    {shakeRecipe && (
                      <p className="text-[9px] text-red-400 font-bold mt-2">
                        ⚠️ Maximum 3 filters. Remove one to add another.
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* ── Empty state ───────────────────────────────────── */}
              {!hasAdvancedFilters && !activeCategory && (
                <div className="px-6 pb-4 text-center">
                  <p className="text-[10px] text-stone-600 font-semibold">
                    Select a category above to personalize your match.
                  </p>
                </div>
              )}

              {/* ── ADVANCED CTAs — only visible after ≥1 filter ─── */}
              {hasAdvancedFilters && (
                <div className="px-6 pb-6 space-y-2.5 anim-slide-up">
                  <p className="text-[9px] text-stone-600 font-black uppercase tracking-widest text-center mb-1">
                    Choose how to match
                  </p>

                  {/* Smart Match */}
                  <button
                    type="button"
                    disabled={isSaving !== 'idle'}
                    onClick={() => executeJoin(buildAdvancedPayload('PREFER'), 'Smart Match (PREFER) queue join')}
                    className="relative w-full overflow-hidden py-3.5 bg-amber-500 text-stone-950 text-xs font-black rounded-2xl shadow-lg shadow-amber-500/15 flex items-center justify-center gap-2 active:scale-[0.98] transition-all hover:shadow-amber-500/25 disabled:opacity-60 anim-breathe"
                  >
                    <span className="text-base">🧠</span>
                    <div className="text-left">
                      <p className="font-black text-[12px] leading-none">Smart Match</p>
                      <p className="text-[9px] font-semibold opacity-70 mt-0.5">Best speed + compatibility. Recommended.</p>
                    </div>
                    {isSaving !== 'idle' && (
                      <svg className="w-4 h-4 animate-spin ml-1" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                    )}
                  </button>

                  {/* Exact Match */}
                  <button
                    type="button"
                    disabled={isSaving !== 'idle'}
                    onClick={() => executeJoin(buildAdvancedPayload('STRICT'), 'Exact Match (STRICT) queue join')}
                    className="w-full py-3 border border-white/10 bg-white/[0.03] hover:bg-white/[0.07] text-white text-xs font-black rounded-2xl flex items-center justify-center gap-2 active:scale-[0.98] transition-all disabled:opacity-60"
                  >
                    <span className="text-base">🎯</span>
                    <div className="text-left">
                      <p className="font-black text-[11px] leading-none">Exact Match</p>
                      <p className="text-[9px] font-semibold text-stone-500 mt-0.5">Wait longer. Only people matching your filters.</p>
                    </div>
                  </button>
                </div>
              )}

              {/* Empty advanced — show a hint to select filters */}
              {!hasAdvancedFilters && (
                <div className="px-6 pb-5">
                  <div className="py-3 border border-white/[0.06] rounded-2xl text-center">
                    <p className="text-[10px] text-stone-600 font-semibold">
                      Add at least one filter above to unlock Smart & Exact Match.
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Chip helper
// ─────────────────────────────────────────────────────────────

function Chip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-full text-[10px] font-bold">
      {label}
      <button type="button" onClick={onRemove} className="text-stone-500 hover:text-red-400 font-black ml-0.5 transition-colors">×</button>
    </span>
  );
}

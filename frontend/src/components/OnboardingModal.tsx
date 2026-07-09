import { useState, useEffect, useRef } from 'react';
import { apiService } from '../services/api.js';
import { cn } from '../utils/index.js';

interface OnboardingModalProps {
  onClose: () => void;
  onSave: (preferences: any) => Promise<void> | void;
}

const LANGUAGES = [
  'English', 'Hindi', 'Telugu', 'Tamil', 'Kannada', 'Malayalam',
  'Spanish', 'French', 'German', 'Japanese', 'Chinese', 'Arabic', 'Russian'
];

export function OnboardingModal({ onClose, onSave }: OnboardingModalProps) {
  const [displayName, setDisplayName] = useState<string>(() => localStorage.getItem('kaboom_display_name') || '');
  const [bio, setBio] = useState<string>(() => localStorage.getItem('kaboom_bio') || '');
  const [gender, setGender] = useState<string>('Prefer not to say');
  const [lookingFor, setLookingFor] = useState<string[]>(['Anyone']);
  
  // Location selections
  const [country, setCountry] = useState<string>('');
  const [state, setState] = useState<string>('');
  const [district, setDistrict] = useState<string>('');
  const [city, setCity] = useState<string>('');
  
  // Interests & Languages
  const [interestTags, setInterestTags] = useState<string[]>([]);
  const [languages, setLanguages] = useState<string[]>(['English']);

  // Match Mode & constraints
  const [matchMode, setMatchMode] = useState<'RANDOM' | 'PREFER' | 'STRICT'>('RANDOM');
  const [matchConstraints, setMatchConstraints] = useState<Record<string, boolean>>({
    university: false,
    city: false,
    country: false
  });

  const [university, setUniversity] = useState<string>('');
  const eduTags: string[] = [];

  // UI state
  const [isAdvancedOpen, setIsAdvancedOpen] = useState<boolean>(false);
  const [isSavingState, setIsSavingState] = useState<'idle' | 'joining' | 'spinner' | 'success'>('idle');
  const [isFadingOut, setIsFadingOut] = useState<boolean>(false);

  // Autocomplete Queries
  const [universityQuery, setUniversityQuery] = useState<string>('');
  const [universityResults, setUniversityResults] = useState<any[]>([]);
  const [locationQuery, setLocationQuery] = useState<string>('');
  const [locationResults, setLocationResults] = useState<any[]>([]);
  const [interestQuery, setInterestQuery] = useState<string>('');
  const [interestResults, setInterestResults] = useState<any[]>([]);

  // Refs for debounce timers
  const universityDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const locationDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const interestDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounced University Search
  useEffect(() => {
    if (universityDebounce.current) clearTimeout(universityDebounce.current);
    if (universityQuery.trim().length >= 2) {
      universityDebounce.current = setTimeout(async () => {
        try {
          const res = await apiService.getUniversities(universityQuery.trim());
          setUniversityResults(res || []);
        } catch {
          setUniversityResults([]);
        }
      }, 250);
    } else {
      setUniversityResults([]);
    }
    return () => {
      if (universityDebounce.current) clearTimeout(universityDebounce.current);
    };
  }, [universityQuery]);

  // Debounced Location Search
  useEffect(() => {
    if (locationDebounce.current) clearTimeout(locationDebounce.current);
    if (locationQuery.trim()) {
      locationDebounce.current = setTimeout(async () => {
        try {
          const res = await apiService.getLocations(locationQuery.trim());
          setLocationResults(res || []);
        } catch {
          setLocationResults([]);
        }
      }, 250);
    } else {
      setLocationResults([]);
    }
    return () => {
      if (locationDebounce.current) clearTimeout(locationDebounce.current);
    };
  }, [locationQuery]);

  // Debounced Interests Search
  useEffect(() => {
    if (interestDebounce.current) clearTimeout(interestDebounce.current);
    if (interestQuery.trim()) {
      interestDebounce.current = setTimeout(async () => {
        try {
          const res = await apiService.getInterests(interestQuery.trim());
          setInterestResults(res || []);
        } catch {
          setInterestResults([]);
        }
      }, 250);
    } else {
      setInterestResults([]);
    }
    return () => {
      if (interestDebounce.current) clearTimeout(interestDebounce.current);
    };
  }, [interestQuery]);

  const handleGenderToggle = (val: string) => {
    setGender(val);
  };

  const handleLookingToggle = (val: string) => {
    if (val === 'Anyone') {
      setLookingFor(['Anyone']);
    } else {
      const copy = lookingFor.filter(x => x !== 'Anyone');
      if (copy.includes(val)) {
        const next = copy.filter(x => x !== val);
        setLookingFor(next.length === 0 ? ['Anyone'] : next);
      } else {
        setLookingFor([...copy, val]);
      }
    }
  };

  const handleLangToggle = (lang: string) => {
    if (languages.includes(lang)) {
      if (languages.length > 1) {
        setLanguages(languages.filter(x => x !== lang));
      }
    } else {
      setLanguages([...languages, lang]);
    }
  };

  const handleSave = async () => {
    const nameClean = displayName.trim();
    if (!nameClean || nameClean.length < 3) {
      alert('Display Name is mandatory and must be at least 3 characters.');
      return;
    }
    if (nameClean.length > 25) {
      alert('Display Name cannot exceed 25 characters.');
      return;
    }

    if (/<[^>]*>/g.test(nameClean)) {
      alert('Display Name cannot contain HTML tags.');
      return;
    }

    const emojiRegex = /[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu;
    const emojisFound = nameClean.match(emojiRegex) || [];
    if (emojisFound.length > 2) {
      alert('Display Name cannot contain more than 2 emojis.');
      return;
    }
    const consecutiveEmojiRegex = /([\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]){2,}/gu;
    if (consecutiveEmojiRegex.test(nameClean)) {
      alert('Display Name cannot contain consecutive emojis.');
      return;
    }

    const badWords = ['fuck', 'shit', 'asshole', 'bitch', 'crap', 'dick', 'pussy', 'bastard', 'cunt', 'nigger', 'faggot'];
    const lowerName = nameClean.toLowerCase();
    if (badWords.some(w => lowerName.includes(w))) {
      alert('Please keep your display name clean and friendly.');
      return;
    }

    setIsSavingState('joining');

    localStorage.setItem('kaboom_display_name', nameClean);
    localStorage.setItem('kaboom_bio', bio.trim());
    localStorage.setItem('kaboom_match_mode', matchMode);
    localStorage.setItem('kaboom_match_constraints', JSON.stringify(matchConstraints));
    localStorage.setItem('kaboom_university', university);
    localStorage.setItem('kaboom_education_tags', JSON.stringify(eduTags));
    localStorage.setItem('kaboom_interest_tags', JSON.stringify(interestTags));
    localStorage.setItem('kaboom_languages', JSON.stringify(languages));
    localStorage.setItem('kaboom_country', country);
    localStorage.setItem('kaboom_city', city);

    setTimeout(() => {
      setIsSavingState('spinner');
    }, 800);

    try {
      await onSave({
        gender,
        looking_for: lookingFor,
        languages,
        country: country || null,
        state: state || null,
        district: district || null,
        city: city || null,
        interest_tags: interestTags,
        display_name: nameClean,
        bio: bio.trim() || null,
        match_mode: matchMode,
        match_constraints: matchConstraints,
        match_attributes: {
          university: university ? [university] : [],
          education_tags: eduTags,
          city: city ? [city] : [],
          state: state ? [state] : [],
          country: country ? [country] : [],
          languages: languages,
          interests: interestTags
        }
      });
      
      setTimeout(() => {
        setIsSavingState('success');
      }, 1600);

      setTimeout(() => {
        setIsFadingOut(true);
      }, 2200);

      setTimeout(() => {
        onClose();
        setIsSavingState('idle');
        setIsFadingOut(false);
      }, 2550);

    } catch (err) {
      alert(err instanceof Error ? err.message : 'Save failed');
      setIsSavingState('idle');
    }
  };

  return (
    <div className={cn(
      "fixed inset-0 bg-[#0c0a09]/80 backdrop-blur-2xl flex items-center justify-center p-4 transition-all duration-300",
      isFadingOut ? "opacity-0 scale-95 pointer-events-none" : "opacity-100 scale-100",
      "z-[999]"
    )}>
      <div className="w-full max-w-md bg-stone-900 border border-white/10 rounded-3xl p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto scrollbar-none flex flex-col gap-6 select-none text-white">
        
        {/* Header Logo */}
        <div className="flex flex-col items-center gap-2 text-center select-none pointer-events-none">
          <img 
            src="/images/logo_kaboom.png" 
            alt="Kaboom TV Logo" 
            className="h-12 object-contain"
          />
          <h2 className="text-xl font-black tracking-wide mt-2">Create Your Identity</h2>
          <p className="text-xs text-white/50">Enter a friendly display name to meet awesome peers anonymously.</p>
        </div>

        {/* Inputs */}
        <div className="space-y-4">
          <div>
            <label className="block text-xs text-white/50 uppercase font-black mb-1.5">Display Name *</label>
            <input
              type="text"
              placeholder="e.g. Alex, Sam, Guest"
              value={displayName}
              disabled={isSavingState !== 'idle'}
              maxLength={25}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/30 focus:outline-none focus:border-amber-500 font-bold"
            />
          </div>

          <div>
            <label className="block text-xs text-white/50 uppercase font-black mb-1.5">Bio / Status (Optional)</label>
            <input
              type="text"
              placeholder="e.g. Learning Japanese, Web3 builder..."
              value={bio}
              disabled={isSavingState !== 'idle'}
              maxLength={120}
              onChange={(e) => setBio(e.target.value)}
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/30 focus:outline-none focus:border-amber-500"
            />
          </div>
        </div>

        {/* Start Chat Button */}
        <div>
          <button
            onClick={handleSave}
            disabled={isSavingState !== 'idle'}
            className="w-full py-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-black transition-all shadow-lg active:scale-95 flex items-center justify-center gap-2 select-none"
          >
            {isSavingState === 'idle' && (
              <>
                <span>Start Chatting</span>
                <span>→</span>
              </>
            )}
            {isSavingState === 'joining' && <span>Joining Tunnel...</span>}
            {isSavingState === 'spinner' && (
              <span className="w-5 h-5 border-2 border-stone-950 border-t-transparent rounded-full animate-spin" />
            )}
            {isSavingState === 'success' && <span>✓ Connected!</span>}
          </button>
        </div>

        {/* Divider */}
        <div className="relative flex items-center justify-center my-1 select-none pointer-events-none">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-white/10" />
          </div>
          <span className="relative px-3 bg-stone-900 text-[10px] text-white/40 font-bold uppercase tracking-wider">
            Or Customize First
          </span>
        </div>

        {/* Section: Customize Filters Accordion */}
        <div className="border border-white/5 rounded-2xl p-4 bg-white/[0.01]">
          <button
            type="button"
            onClick={() => setIsAdvancedOpen(!isAdvancedOpen)}
            className="w-full flex items-center justify-between text-left focus:outline-none"
          >
            <div>
              <h4 className="text-sm font-bold text-white flex items-center gap-1.5">
                <span>⚙️</span> Match Preferences
              </h4>
              <p className="text-[10px] text-white/40 mt-0.5">Filter by gender, language, location, or college.</p>
            </div>
            <span className={cn("text-white/45 transform transition-transform duration-300", isAdvancedOpen && "rotate-180")}>
              ▼
            </span>
          </button>

          <div className={cn(
            "transition-all duration-300 overflow-hidden",
            isAdvancedOpen ? "max-h-[1400px] mt-4 opacity-100" : "max-h-0 opacity-0 pointer-events-none"
          )}>
            <div className="space-y-5 pt-2">
              
              {/* Gender */}
              <div>
                <label className="block text-[10px] text-white/50 uppercase font-black mb-2">I Am</label>
                <div className="grid grid-cols-2 gap-2">
                  {['Male', 'Female', 'Non Binary', 'Prefer not to say'].map((g) => (
                    <button
                      key={g}
                      type="button"
                      onClick={() => handleGenderToggle(g)}
                      className={cn(
                        "py-2.5 px-3 rounded-xl border text-xs font-semibold transition-all",
                        gender === g 
                          ? "bg-amber-500/10 border-amber-500 text-amber-400 font-bold shadow-md shadow-amber-500/5"
                          : "bg-white/5 border-white/5 text-white/70 hover:bg-white/10"
                      )}
                    >
                      {g}
                    </button>
                  ))}
                </div>
              </div>

              {/* Looking For */}
              <div>
                <label className="block text-[10px] text-white/50 uppercase font-black mb-2">Looking For</label>
                <div className="grid grid-cols-3 gap-2">
                  {['Male', 'Female', 'Anyone'].map((l) => (
                    <button
                      key={l}
                      type="button"
                      onClick={() => handleLookingToggle(l)}
                      className={cn(
                        "py-2.5 px-2 rounded-xl border text-xs font-semibold transition-all",
                        lookingFor.includes(l)
                          ? "bg-amber-500/10 border-amber-500 text-amber-400 font-bold shadow-md shadow-amber-500/5"
                          : "bg-white/5 border-white/5 text-white/70 hover:bg-white/10"
                      )}
                    >
                      {l}
                    </button>
                  ))}
                </div>
              </div>

              {/* Languages */}
              <div>
                <label className="block text-[10px] text-white/50 uppercase font-black mb-2">Languages You Speak</label>
                <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto p-1.5 bg-white/[0.02] border border-white/5 rounded-xl scrollbar-none">
                  {LANGUAGES.map((lang) => {
                    const active = languages.includes(lang);
                    return (
                      <button
                        key={lang}
                        type="button"
                        onClick={() => handleLangToggle(lang)}
                        className={cn(
                          "px-3 py-1.5 rounded-lg border text-xs transition-all",
                          active
                            ? "bg-amber-500/10 border-amber-500 text-amber-400 font-bold"
                            : "bg-white/5 border-white/5 text-white/60 hover:bg-white/10"
                        )}
                      >
                        {lang}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Location Autocomplete */}
              <div>
                <label className="block text-[10px] text-white/50 uppercase font-black mb-1.5">Search Location / Country</label>
                <input
                  type="text"
                  placeholder="e.g. India, United States, Mumbai..."
                  value={locationQuery}
                  onChange={(e) => {
                    setLocationQuery(e.target.value);
                    if (!e.target.value) {
                      setCountry('');
                      setState('');
                      setDistrict('');
                      setCity('');
                    }
                  }}
                  className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/30 text-xs focus:outline-none focus:border-amber-500"
                />
                {locationResults.length > 0 && (
                  <div className="mt-1 bg-stone-950 border border-white/10 rounded-xl max-h-40 overflow-y-auto divide-y divide-white/5 shadow-xl relative z-10 text-xs scrollbar-none">
                    {locationResults.map((loc) => (
                      <button
                        key={loc.name}
                        type="button"
                        onClick={() => {
                          setCountry(loc.country || '');
                          setState(loc.state || '');
                          setDistrict(loc.district || '');
                          setCity(loc.city || '');
                          setLocationQuery('');
                          setLocationResults([]);
                        }}
                        className="w-full px-4 py-2.5 text-left hover:bg-white/5 text-white/80 flex justify-between items-center"
                      >
                        <span className="font-semibold">{loc.name}</span>
                        <span className="text-[10px] text-white/35 font-bold uppercase">{loc.type}</span>
                      </button>
                    ))}
                  </div>
                )}
                {(city || country) && (
                  <div className="mt-2 flex items-center justify-between p-2.5 bg-amber-500/5 border border-amber-500/10 rounded-xl text-xs">
                    <span className="text-amber-400 font-bold">📍 {[city, state, country].filter(Boolean).join(', ')}</span>
                    <button
                      type="button"
                      onClick={() => {
                        setCountry('');
                        setState('');
                        setDistrict('');
                        setCity('');
                      }}
                      className="text-red-400 hover:underline"
                    >
                      Remove
                    </button>
                  </div>
                )}
              </div>

              {/* Match Mode */}
              <div>
                <label className="block text-[10px] text-white/50 uppercase font-black mb-2">Search Mode</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { val: 'RANDOM', label: '🌍 Random' },
                    { val: 'PREFER', label: '🎯 Smart' },
                    { val: 'STRICT', label: '🔒 Exact' }
                  ].map((m) => (
                    <button
                      key={m.val}
                      type="button"
                      onClick={() => setMatchMode(m.val as any)}
                      className={cn(
                        "py-2.5 px-1.5 rounded-xl border text-xs font-semibold transition-all",
                        matchMode === m.val
                          ? "bg-amber-500/10 border-amber-500 text-amber-400 font-bold shadow-md"
                          : "bg-white/5 border-white/5 text-white/70 hover:bg-white/10"
                      )}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* University Search Autocomplete */}
              <div>
                <label className="block text-[10px] text-white/50 uppercase font-black mb-1.5">University / College (Optional)</label>
                <input
                  type="text"
                  placeholder="Search university... e.g. Stanford, Osmania"
                  value={universityQuery}
                  onChange={(e) => {
                    setUniversityQuery(e.target.value);
                    if (!e.target.value) {
                      setUniversity('');
                    }
                  }}
                  className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/30 text-xs focus:outline-none focus:border-amber-500"
                />
                {universityResults.length > 0 && (
                  <div className="mt-1 bg-stone-950 border border-white/10 rounded-xl max-h-40 overflow-y-auto divide-y divide-white/5 shadow-xl relative z-10 text-xs scrollbar-none">
                    {universityResults.map((u) => (
                      <button
                        key={u.name}
                        type="button"
                        onClick={() => {
                          setUniversity(u.name);
                          if (matchMode === 'STRICT') {
                            setMatchConstraints(prev => ({ ...prev, university: true }));
                          }
                          setUniversityQuery('');
                          setUniversityResults([]);
                        }}
                        className="w-full px-4 py-2.5 text-left hover:bg-white/5 text-white/80 flex justify-between items-center"
                      >
                        <span className="font-semibold">{u.name}</span>
                        <span className="text-[10px] text-white/35">{u.country}</span>
                      </button>
                    ))}
                  </div>
                )}
                {university && (
                  <div className="mt-2 flex items-center justify-between p-2.5 bg-amber-500/5 border border-amber-500/10 rounded-xl text-xs">
                    <span className="text-amber-400 font-bold">🎓 {university}</span>
                    <button
                      type="button"
                      onClick={() => {
                        setUniversity('');
                        setMatchConstraints(prev => ({ ...prev, university: false }));
                      }}
                      className="text-red-400 hover:underline"
                    >
                      Remove
                    </button>
                  </div>
                )}
              </div>

              {/* Interests tag input */}
              <div>
                <label className="block text-[10px] text-white/50 uppercase font-black mb-1.5">Interests / Hobbies</label>
                <input
                  type="text"
                  placeholder="Search interests... e.g. Gaming, Chess, Music"
                  value={interestQuery}
                  onChange={(e) => setInterestQuery(e.target.value)}
                  className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/30 text-xs focus:outline-none focus:border-amber-500"
                />
                {interestResults.length > 0 && (
                  <div className="mt-1 bg-stone-950 border border-white/10 rounded-xl max-h-40 overflow-y-auto divide-y divide-white/5 shadow-xl relative z-10 text-xs scrollbar-none">
                    {interestResults.map((tag) => (
                      <button
                        key={tag.name}
                        type="button"
                        onClick={() => {
                          if (!interestTags.includes(tag.name)) {
                            setInterestTags([...interestTags, tag.name]);
                          }
                          setInterestQuery('');
                          setInterestResults([]);
                        }}
                        className="w-full px-4 py-2.5 text-left hover:bg-white/5 text-white/85 flex justify-between items-center"
                      >
                        <span className="font-semibold"># {tag.name}</span>
                        <span className="text-[9px] text-white/30 italic">{tag.category}</span>
                      </button>
                    ))}
                  </div>
                )}
                {interestTags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2.5">
                    {interestTags.map((tag) => (
                      <span
                        key={tag}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/10 border border-white/5 text-[10px] font-bold text-white"
                      >
                        <span>#{tag}</span>
                        <button
                          type="button"
                          onClick={() => setInterestTags(interestTags.filter(t => t !== tag))}
                          className="hover:text-red-400 font-extrabold focus:outline-none ml-0.5"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

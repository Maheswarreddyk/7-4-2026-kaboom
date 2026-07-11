import { useState, useEffect, useRef } from 'react';
import { apiService } from '../services/api.js';
import { cn } from '../utils/index.js';
import { COLLEGE_SUGGESTIONS } from '../utils/collegeSuggestions.js';
import { MATCH_CATEGORIES, MatchCategory } from '../utils/matchCategories.js';

interface PreferenceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (preferences: any) => Promise<void> | void;
  currentPreferences?: any;
}

const LANGUAGES = [
  'English', 'Hindi', 'Telugu', 'Tamil', 'Kannada', 'Malayalam',
  'Spanish', 'French', 'German', 'Japanese', 'Chinese', 'Arabic', 'Russian'
];

function TypewriterRotator({ messages }: { messages: string[] }) {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [displayText, setDisplayText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const fullText = messages[currentIdx] || '';
    
    if (isDeleting) {
      timer = setTimeout(() => {
        setDisplayText(fullText.substring(0, displayText.length - 1));
      }, 25);
    } else {
      timer = setTimeout(() => {
        setDisplayText(fullText.substring(0, displayText.length + 1));
      }, 55);
    }

    if (!isDeleting && displayText === fullText) {
      timer = setTimeout(() => {
        setIsDeleting(true);
      }, 2200);
    } else if (isDeleting && displayText === '') {
      setIsDeleting(false);
      setCurrentIdx((prev) => (prev + 1) % messages.length);
    }

    return () => clearTimeout(timer);
  }, [displayText, isDeleting, currentIdx, messages]);

  return (
    <div className="h-5 flex items-center justify-center select-none text-[11px] font-semibold text-amber-500/80 mb-4">
      <span>{displayText}</span>
      <span className="w-1 h-3 bg-amber-500/80 ml-0.5 animate-pulse" />
    </div>
  );
}

export function PreferenceModal({ isOpen, onClose, onSave, currentPreferences = {} }: PreferenceModalProps) {
  // Wizard flow states
  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);

  // Original single source of truth preference states
  const [gender, setGender] = useState<string>(currentPreferences.gender || 'Prefer not to say');
  const [lookingFor, setLookingFor] = useState<string[]>(currentPreferences.looking_for || ['Anyone']);
  
  // Location selections
  const [country, setCountry] = useState<string>(currentPreferences.country || '');
  const [state, setState] = useState<string>(currentPreferences.state || '');
  const [district, setDistrict] = useState<string>(currentPreferences.district || '');
  const [city, setCity] = useState<string>(currentPreferences.city || '');
  
  // Interests & Languages
  const [interestTags, setInterestTags] = useState<string[]>(currentPreferences.interest_tags || []);
  const [languages, setLanguages] = useState<string[]>(currentPreferences.languages || ['English']);

  // V6 & V6.5 states
  const [displayName, setDisplayName] = useState<string>(() => {
    return currentPreferences.display_name || localStorage.getItem('kaboom_display_name') || '';
  });
  const [bio, setBio] = useState<string>(() => {
    return currentPreferences.bio || localStorage.getItem('kaboom_bio') || '';
  });
  const [matchMode, setMatchMode] = useState<'RANDOM' | 'PREFER' | 'STRICT'>(() => {
    return currentPreferences.match_mode || (localStorage.getItem('kaboom_match_mode') as any) || 'RANDOM';
  });
  const [matchConstraints, setMatchConstraints] = useState<Record<string, boolean>>(() => {
    try {
      return currentPreferences.match_constraints || JSON.parse(localStorage.getItem('kaboom_match_constraints') || '{}');
    } catch {
      return { university: false, city: false, country: false };
    }
  });

  const [university, setUniversity] = useState<string>(() => {
    const attrs = currentPreferences.match_attributes || {};
    return (attrs.university && attrs.university[0]) || localStorage.getItem('kaboom_university') || '';
  });
  const [eduTags, setEduTags] = useState<string[]>(() => {
    const attrs = currentPreferences.match_attributes || {};
    return attrs.education_tags || JSON.parse(localStorage.getItem('kaboom_education_tags') || '[]');
  });

  // Saving states
  const [isSavingState, setIsSavingState] = useState<'idle' | 'joining' | 'spinner' | 'success'>('idle');
  const [isFadingOut, setIsFadingOut] = useState(false);
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);

  const [universityQuery, setUniversityQuery] = useState('');
  const [universityResults, setUniversityResults] = useState<any[]>([]);
  const [eduTagInput, setEduTagInput] = useState('');

  const universityDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Future-Proofing Analytics Hooks
  const trackTelemetry = (event: string, meta?: any) => {
    console.log(`[Telemetry Event] ${event}`, meta || {});
  };

  useEffect(() => {
    if (isOpen) {
      trackTelemetry('Preference modal opened');
    }
  }, [isOpen]);

  // Debounce universities autocomplete
  useEffect(() => {
    if (universityQuery.trim().length < 2) {
      setUniversityResults([]);
      return;
    }
    if (universityDebounce.current) clearTimeout(universityDebounce.current);
    universityDebounce.current = setTimeout(async () => {
      try {
        const results = await apiService.getUniversities(universityQuery);
        setUniversityResults(results);
      } catch (err) {
        console.error(err);
      }
    }, 250);

    return () => {
      if (universityDebounce.current) clearTimeout(universityDebounce.current);
    };
  }, [universityQuery]);

  // App preferences
  const [showTips, setShowTips] = useState(() => {
    return localStorage.getItem('kaboom_show_tips') !== 'false';
  });
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('kaboom_theme') || 'ember';
  });

  // Autocomplete states
  const [locationQuery, setLocationQuery] = useState('');
  const [locationResults, setLocationResults] = useState<any[]>([]);
  const [interestQuery, setInterestQuery] = useState('');
  const [interestResults, setInterestResults] = useState<any[]>([]);

  const locationDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const interestDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounce locations autocomplete
  useEffect(() => {
    if (!locationQuery.trim()) {
      setLocationResults([]);
      return;
    }
    if (locationDebounce.current) clearTimeout(locationDebounce.current);
    locationDebounce.current = setTimeout(async () => {
      try {
        const results = await apiService.getLocations(locationQuery);
        setLocationResults(results);
      } catch (err) {
        console.error(err);
      }
    }, 250);

    return () => {
      if (locationDebounce.current) clearTimeout(locationDebounce.current);
    };
  }, [locationQuery]);

  // Debounce interests autocomplete
  useEffect(() => {
    if (!interestQuery.trim()) {
      setInterestResults([]);
      return;
    }
    if (interestDebounce.current) clearTimeout(interestDebounce.current);
    interestDebounce.current = setTimeout(async () => {
      try {
        const results = await apiService.getInterests(interestQuery);
        setInterestResults(results);
      } catch (err) {
        console.error(err);
      }
    }, 250);

    return () => {
      if (interestDebounce.current) clearTimeout(interestDebounce.current);
    };
  }, [interestQuery]);

  if (!isOpen) return null;

  const handleLookingForChange = (val: string) => {
    if (val === 'Anyone') {
      setLookingFor(['Anyone']);
    } else {
      let updated = lookingFor.filter(x => x !== 'Anyone');
      if (updated.includes(val)) {
        updated = updated.filter(x => x !== val);
      } else {
        updated.push(val);
      }
      if (updated.length === 0) updated = ['Anyone'];
      setLookingFor(updated);
    }
  };

  const handleSelectLocation = (loc: any) => {
    setCountry(loc.country || '');
    setState(loc.state || '');
    setDistrict(loc.district || '');
    setCity(loc.city || '');
    setLocationQuery('');
    setLocationResults([]);
  };

  const handleSelectInterest = (name: string) => {
    if (interestTags.length >= 5) {
      alert('You can select a maximum of 5 interests to avoid choice fatigue.');
      return;
    }
    if (!interestTags.includes(name)) {
      setInterestTags([...interestTags, name]);
    }
    setInterestQuery('');
    setInterestResults([]);
  };

  const removeInterest = (name: string) => {
    setInterestTags(interestTags.filter(x => x !== name));
  };

  const toggleLanguage = (lang: string) => {
    if (languages.includes(lang)) {
      setLanguages(languages.filter(x => x !== lang));
    } else {
      if (languages.length >= 3) {
        alert('Please select up to 3 languages to keep matching fast.');
        return;
      }
      setLanguages([...languages, lang]);
    }
  };

  const handleReset = () => {
    setGender('Prefer not to say');
    setLookingFor(['Anyone']);
    setCountry('');
    setState('');
    setDistrict('');
    setCity('');
    setInterestTags([]);
    setLanguages(['English']);
    setShowTips(true);
    setTheme('ember');
    setDisplayName('');
    setBio('');
    setMatchMode('RANDOM');
    setMatchConstraints({ university: false, city: false, country: false });
    setUniversity('');
    setEduTags([]);
  };

  const validateDisplayName = (): boolean => {
    const nameClean = displayName.trim();
    if (!nameClean || nameClean.length < 3) {
      alert('Display Name is mandatory and must be at least 3 characters.');
      return false;
    }
    if (nameClean.length > 25) {
      alert('Display Name cannot exceed 25 characters.');
      return false;
    }
    if (/<[^>]*>/g.test(nameClean)) {
      alert('Display Name cannot contain HTML tags.');
      return false;
    }

    const emojiRegex = /[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu;
    const emojisFound = nameClean.match(emojiRegex) || [];
    if (emojisFound.length > 2) {
      alert('Display Name cannot contain more than 2 emojis.');
      return false;
    }
    const consecutiveEmojiRegex = /([\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]){2,}/gu;
    if (consecutiveEmojiRegex.test(nameClean)) {
      alert('Display Name cannot contain consecutive emojis.');
      return false;
    }

    const badWords = ['fuck', 'shit', 'asshole', 'bitch', 'crap', 'dick', 'pussy', 'bastard', 'cunt', 'nigger', 'faggot'];
    const lowerName = nameClean.toLowerCase();
    if (badWords.some(w => lowerName.includes(w))) {
      alert('Please keep your display name clean and friendly.');
      return false;
    }

    return true;
  };

  const handleNextStep1 = () => {
    if (validateDisplayName()) {
      setStep(2);
    }
  };

  const handleSelectCategoryCard = (category: MatchCategory) => {
    trackTelemetry('Match category selected', { categoryId: category.id });
    setSelectedCategoryId(category.id);
    
    // Clear out alternate filter overrides to keep choices isolated
    if (category.id === 'COLLEGE') {
      // Keep university
    } else if (category.id === 'NEARBY') {
      setUniversity('');
    } else if (category.id === 'LANGUAGE') {
      setUniversity('');
    } else if (category.id === 'INTERESTS') {
      setUniversity('');
    } else if (category.id === 'RANDOM') {
      setUniversity('');
      setInterestTags([]);
      setLanguages(['English']);
      setCountry('');
      setState('');
      setCity('');
    }
    setStep(3);
  };

  // Wire Hot chips to existing state handlers
  const handleSelectHotChip = (type: 'university' | 'interest' | 'language', value: string) => {
    if (type === 'university') {
      setUniversity(value);
      setUniversityQuery('');
      setUniversityResults([]);
      trackTelemetry('Hot chip selected', { type, value });
    } else if (type === 'interest') {
      if (interestTags.length < 5 && !interestTags.includes(value)) {
        setInterestTags([...interestTags, value]);
        trackTelemetry('Hot chip selected', { type, value });
      }
    } else if (type === 'language') {
      if (!languages.includes(value)) {
        if (languages.length < 3) {
          setLanguages([...languages, value]);
          trackTelemetry('Hot chip selected', { type, value });
        }
      }
    }
  };

  const handleSave = async () => {
    const nameClean = displayName.trim();
    if (!validateDisplayName()) return;

    setIsSavingState('joining');
    trackTelemetry('Start Conversation clicked');

    localStorage.setItem('kaboom_show_tips', showTips ? 'true' : 'false');
    localStorage.setItem('kaboom_suggestions_enabled', showTips ? 'ON' : 'OFF');
    localStorage.setItem('kaboom_theme', theme);
    document.documentElement.className = `theme-${theme}`;

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
    }, 850);

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
      }, 1650);

      setTimeout(() => {
        setIsFadingOut(true);
      }, 2250);

      setTimeout(() => {
        onClose();
        setIsSavingState('idle');
        setIsFadingOut(false);
      }, 2600);

    } catch (err) {
      alert(err instanceof Error ? err.message : 'Save failed');
      setIsSavingState('idle');
    }
  };

  const activeCategory = MATCH_CATEGORIES.find(c => c.id === selectedCategoryId);

  return (
    <div className={cn(
      "fixed inset-0 z-[999] flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-md transition-all duration-300",
      isFadingOut ? "opacity-0 pointer-events-none scale-95" : "opacity-100 scale-100"
    )}>
      {/* Dynamic inward moving particles keyframe injection */}
      <style>{`
        @keyframes inwardParticle {
          0% { transform: translate(var(--dx), var(--dy)) scale(0); opacity: 0; }
          20% { opacity: 0.9; }
          100% { transform: translate(0, 0) scale(1.1); opacity: 0.1; }
        }
        .btn-particle {
          position: absolute;
          width: 3px;
          height: 3px;
          border-radius: 50%;
          background: rgba(251, 191, 36, 0.85);
          top: 50%;
          left: 50%;
          pointer-events: none;
        }
        .bp-1 { --dx: -75px; --dy: -25px; animation: inwardParticle 2.2s infinite ease-in; }
        .bp-2 { --dx: 80px; --dy: 30px; animation: inwardParticle 2.6s infinite ease-in; animation-delay: 0.4s; }
        .bp-3 { --dx: -45px; --dy: 45px; animation: inwardParticle 2.0s infinite ease-in; animation-delay: 0.8s; }
        .bp-4 { --dx: 65px; --dy: -40px; animation: inwardParticle 2.4s infinite ease-in; animation-delay: 1.2s; }
      `}</style>

      <div className="relative w-full max-w-lg bg-stone-900 border border-white/10 rounded-t-3xl sm:rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[85vh] sm:max-h-[90vh] transition-transform duration-300">
        
        {/* Header with Step Tracker */}
        <div className="px-6 py-4 flex items-center justify-between border-b border-white/10 bg-stone-950">
          <div>
            <h2 className="text-base font-black text-white uppercase tracking-wider">
              {step === 1 && '1. Identify Yourself'}
              {step === 2 && '2. Choose Your Vibe'}
              {step === 3 && `3. ${activeCategory?.title || 'Preference Detail'}`}
              {step === 4 && '4. Fine Tune Match'}
              {step === 5 && '5. Select Matching Style'}
            </h2>
            <div className="flex gap-1.5 mt-1">
              {[1, 2, 3, 4, 5].map((i) => (
                <div
                  key={i}
                  className={cn(
                    "h-1 rounded-full transition-all duration-300",
                    step === i 
                      ? "w-6 bg-amber-500" 
                      : step > i 
                        ? "w-2 bg-amber-500/40" 
                        : "w-2 bg-white/10"
                  )}
                />
              ))}
            </div>
          </div>
          {isSavingState === 'idle' && (
            <button onClick={onClose} className="p-2 text-white/40 hover:text-white rounded-full hover:bg-white/5 transition-colors">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* Form Body with Step Wizard */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {/* STEP 1: IDENTITY */}
          {step === 1 && (
            <div className="space-y-5 animate-fade-in">
              <div className="p-4 bg-amber-500/5 border border-amber-500/10 rounded-2xl">
                <p className="text-[11px] text-amber-500/80 font-bold leading-relaxed">
                  Kaboom is ephemeral. Your display name disappears completely the moment you leave the session.
                </p>
              </div>

              <div>
                <label className="block text-[10px] text-stone-400 uppercase font-black tracking-wider mb-2">Display Name (Mandatory)</label>
                <input
                  type="text"
                  placeholder="Enter name... e.g. Mahes"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-stone-500 focus:outline-none focus:border-amber-500 text-sm font-semibold transition-colors"
                />
              </div>

              <div>
                <label className="block text-[10px] text-stone-400 uppercase font-black tracking-wider mb-2">Bio / Status (Optional)</label>
                <input
                  type="text"
                  placeholder="What's your current vibe? e.g. Just chilling..."
                  value={bio}
                  onChange={(e) => setBio(e.target.value.slice(0, 120))}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-stone-500 focus:outline-none focus:border-amber-500 text-sm font-semibold transition-colors"
                />
              </div>
            </div>
          )}

          {/* STEP 2: CHOOSE VIBE CATEGORY */}
          {step === 2 && (
            <div className="space-y-4 animate-fade-in">
              <h3 className="text-xs font-black text-stone-400 uppercase tracking-widest text-center mb-4">
                Who would you like to meet today?
              </h3>
              <div className="grid grid-cols-1 gap-3">
                {MATCH_CATEGORIES.map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => handleSelectCategoryCard(cat)}
                    className="w-full text-left p-4 rounded-2xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.06] hover:border-white/10 transition-all duration-300 flex items-center justify-between group"
                  >
                    <div className="flex items-center gap-4">
                      <span className="text-2xl group-hover:scale-110 transition-transform duration-300">{cat.icon}</span>
                      <div>
                        <h4 className="text-sm font-black text-white group-hover:text-amber-400 transition-colors">{cat.title}</h4>
                        <p className="text-[11px] text-stone-400 font-medium mt-0.5">{cat.subtitle}</p>
                      </div>
                    </div>
                    <span className="text-stone-500 group-hover:translate-x-1 transition-transform">➔</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* STEP 3: VIBE CONFIG DETAILS */}
          {step === 3 && selectedCategoryId && activeCategory && (
            <div className="space-y-5 animate-fade-in">
              <div className="text-center mb-4">
                <span className="text-4xl inline-block mb-2 animate-bounce">{activeCategory.icon}</span>
                <h3 className="text-lg font-black text-white">{activeCategory.title}</h3>
                <p className="text-xs text-stone-400 font-medium mt-0.5">{activeCategory.subtitle}</p>
              </div>

              {/* Typewriter Rotator simulation */}
              <TypewriterRotator messages={activeCategory.rotatorMessages} />

              {/* COLLEGE VIBE CONFIG */}
              {selectedCategoryId === 'COLLEGE' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-[10px] text-stone-400 uppercase font-black tracking-wider mb-2">Search University</label>
                    <input
                      type="text"
                      placeholder="Type university... e.g. IIT, Saveetha, VIT"
                      value={universityQuery}
                      onChange={(e) => {
                        setUniversityQuery(e.target.value);
                        if (!e.target.value) setUniversity('');
                      }}
                      className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-stone-500 focus:outline-none focus:border-amber-500 text-sm font-semibold"
                    />

                    {/* Autocomplete list */}
                    {universityResults.length > 0 && (
                      <div className="mt-2 bg-stone-950 border border-white/10 rounded-xl max-h-40 overflow-y-auto divide-y divide-white/5 shadow-xl relative z-20">
                        {universityResults.map((u) => (
                          <button
                            key={u.name}
                            type="button"
                            onClick={() => {
                              setUniversity(u.name);
                              setUniversityQuery('');
                              setUniversityResults([]);
                            }}
                            className="w-full px-4 py-3 text-left hover:bg-white/5 text-xs text-white/80 flex justify-between items-center"
                          >
                            <span className="font-bold">{u.name}</span>
                            <span className="text-[10px] text-stone-500">{u.country}</span>
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Active Selected University */}
                    {university && (
                      <div className="mt-3 flex items-center justify-between p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl">
                        <span className="text-xs text-amber-400 font-bold">🎓 {university}</span>
                        <button
                          type="button"
                          onClick={() => setUniversity('')}
                          className="text-[10px] text-red-400 hover:underline font-bold"
                        >
                          Remove
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Campus trending quick-selector list */}
                  <div>
                    <label className="block text-[9px] text-stone-500 uppercase font-black tracking-wider mb-1.5">🔥 Popular Universities</label>
                    <div className="flex flex-wrap gap-1.5">
                      {COLLEGE_SUGGESTIONS.slice(0, 5).map((col) => (
                        <button
                          key={col}
                          type="button"
                          onClick={() => handleSelectHotChip('university', col)}
                          className={cn(
                            "px-2.5 py-1 rounded-full text-[10px] font-bold border transition-colors",
                            university === col
                              ? "bg-amber-500/20 border-amber-500 text-amber-400"
                              : "border-white/5 bg-white/[0.02] text-stone-400 hover:bg-white/5"
                          )}
                        >
                          🏫 {col.split(' ')[0]}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* NEARBY VIBE CONFIG */}
              {selectedCategoryId === 'NEARBY' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-[10px] text-stone-400 uppercase font-black tracking-wider mb-2">Search Location / Country</label>
                    <input
                      type="text"
                      placeholder="Type region, city, or country..."
                      value={locationQuery}
                      onChange={(e) => setLocationQuery(e.target.value)}
                      className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-stone-500 focus:outline-none focus:border-amber-500 text-sm font-semibold"
                    />

                    {locationResults.length > 0 && (
                      <div className="mt-2 bg-stone-950 border border-white/10 rounded-xl max-h-40 overflow-y-auto divide-y divide-white/5 shadow-xl relative z-20">
                        {locationResults.map((loc) => (
                          <button
                            key={loc.id}
                            type="button"
                            onClick={() => handleSelectLocation(loc)}
                            className="w-full px-4 py-3 text-left hover:bg-white/5 text-xs text-white/80 flex justify-between items-center"
                          >
                            <span>{loc.name}</span>
                            <span className="text-[10px] text-stone-500 capitalize">{loc.type}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {(city || state || country) && (
                    <div className="p-4 bg-white/5 rounded-xl border border-white/10 flex items-center justify-between">
                      <div>
                        <h4 className="text-xs font-black text-amber-400">Selected Location:</h4>
                        <p className="text-xs text-white/80 mt-1 font-bold">
                          {[city, state, country].filter(Boolean).join(' • ')}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setCountry('');
                          setState('');
                          setDistrict('');
                          setCity('');
                        }}
                        className="text-[10px] text-red-400 hover:underline font-bold"
                      >
                        Clear
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* LANGUAGE VIBE CONFIG */}
              {selectedCategoryId === 'LANGUAGE' && (
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <label className="block text-[10px] text-stone-400 uppercase font-black tracking-wider">Spoken Languages (Select up to 3)</label>
                    <span className="text-[10px] text-amber-500 font-bold">{languages.length}/3 selected</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {LANGUAGES.map((lang) => {
                      const active = languages.includes(lang);
                      return (
                        <button
                          key={lang}
                          type="button"
                          onClick={() => toggleLanguage(lang)}
                          className={cn(
                            "px-3 py-1.5 rounded-full text-xs font-bold border transition-all duration-200",
                            active 
                              ? "bg-amber-500/20 border-amber-500 text-amber-400" 
                              : "border-white/10 bg-white/5 text-stone-400 hover:bg-white/10"
                          )}
                        >
                          {lang}
                        </button>
                      );
                    })}
                  </div>

                  {/* Hot language selectors */}
                  <div>
                    <label className="block text-[9px] text-stone-500 uppercase font-black tracking-wider mb-1.5">🔥 Popular Languages</label>
                    <div className="flex flex-wrap gap-1.5">
                      {['Telugu', 'Hindi', 'Tamil'].map((lan) => (
                        <button
                          key={lan}
                          type="button"
                          onClick={() => handleSelectHotChip('language', lan)}
                          className="px-2.5 py-1 rounded-full text-[10px] font-bold border border-white/5 bg-white/[0.02] text-stone-400 hover:bg-white/5"
                        >
                          🗣️ {lan}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* INTERESTS VIBE CONFIG */}
              {selectedCategoryId === 'INTERESTS' && (
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <label className="block text-[10px] text-stone-400 uppercase font-black tracking-wider">Hobbies & Interests (Select up to 5)</label>
                    <span className="text-[10px] text-amber-500 font-bold">{interestTags.length}/5 selected</span>
                  </div>
                  
                  <input
                    type="text"
                    placeholder="Search interest... e.g. Gaming, Cricket, Music"
                    value={interestQuery}
                    onChange={(e) => setInterestQuery(e.target.value)}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-stone-500 focus:outline-none focus:border-amber-500 text-sm font-semibold"
                  />

                  {interestResults.length > 0 && (
                    <div className="mt-2 bg-stone-950 border border-white/10 rounded-xl max-h-40 overflow-y-auto divide-y divide-white/5 shadow-xl relative z-20">
                      {interestResults.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => handleSelectInterest(item.name)}
                          className="w-full px-4 py-3 text-left hover:bg-white/5 text-xs text-white/80 flex justify-between items-center"
                        >
                          <span>{item.name}</span>
                          <span className="text-[10px] px-2 py-0.5 bg-white/10 text-stone-300 rounded-full">{item.category}</span>
                        </button>
                      ))}
                    </div>
                  )}

                  {interestTags.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {interestTags.map((tag) => (
                        <span key={tag} className="inline-flex items-center gap-1 px-2.5 py-1 bg-white/10 text-white rounded-full text-xs font-bold border border-white/5">
                          {tag}
                          <button
                            type="button"
                            onClick={() => removeInterest(tag)}
                            className="text-stone-400 hover:text-red-400 font-bold ml-1 text-sm"
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  ) : (
                    <div className="p-4 bg-white/[0.02] border border-white/5 rounded-2xl text-center">
                      <span className="text-xl inline-block mb-1">✨</span>
                      <p className="text-[11px] text-stone-400 font-bold">We will introduce you to someone unexpected.</p>
                    </div>
                  )}

                  {/* Hot trending hobby chips */}
                  <div>
                    <label className="block text-[9px] text-stone-500 uppercase font-black tracking-wider mb-1.5">🔥 Trending Interests</label>
                    <div className="flex flex-wrap gap-1.5">
                      {['Gaming', 'Music', 'AI', 'Cricket'].map((int) => (
                        <button
                          key={int}
                          type="button"
                          onClick={() => handleSelectHotChip('interest', int)}
                          className="px-2.5 py-1 rounded-full text-[10px] font-bold border border-white/5 bg-white/[0.02] text-stone-400 hover:bg-white/5"
                        >
                          🎮 {int}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* RANDOM VIBE CONFIG */}
              {selectedCategoryId === 'RANDOM' && (
                <div className="p-6 bg-amber-500/[0.02] border border-amber-500/10 rounded-2xl text-center space-y-2">
                  <span className="text-3xl inline-block animate-pulse">💫</span>
                  <p className="text-xs text-stone-200 font-black">All preferences are set to global open parameters.</p>
                  <p className="text-[11px] text-stone-400 leading-relaxed max-w-xs mx-auto">
                    No strict filters will be applied. You will connect to the fastest available conversation matches globally.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* STEP 4: FINE TUNE YOUR MATCH ACCORDION */}
          {step === 4 && (
            <div className="space-y-4 animate-fade-in">
              <div className="border border-white/10 rounded-2xl overflow-hidden bg-white/[0.01]">
                <button
                  type="button"
                  onClick={() => {
                    setIsAdvancedOpen(!isAdvancedOpen);
                    trackTelemetry('Advanced filters expanded', { expanded: !isAdvancedOpen });
                  }}
                  className="w-full flex items-center justify-between text-left p-4 focus:outline-none hover:bg-white/[0.02] transition-colors"
                >
                  <div>
                    <h4 className="text-sm font-black text-white flex items-center gap-1.5">
                      <span>✨</span> Fine Tune Your Match
                    </h4>
                    <p className="text-[10px] text-stone-400 mt-0.5">Find someone even closer to your vibe.</p>
                  </div>
                  <span className={cn("text-stone-500 transform transition-transform duration-300", isAdvancedOpen && "rotate-180")}>
                    ▼
                  </span>
                </button>

                {/* Collapsible transition container */}
                <div className={cn(
                  "transition-all duration-300 overflow-hidden",
                  isAdvancedOpen ? "max-h-[600px] border-t border-white/5 p-4 space-y-5 opacity-100" : "max-h-0 opacity-0 pointer-events-none"
                )}>
                  {/* I Am Identity Selector */}
                  <div>
                    <label className="block text-[10px] text-stone-400 uppercase font-black tracking-wider mb-2">My Gender</label>
                    <div className="grid grid-cols-2 gap-1.5">
                      {['Male', 'Female', 'Non Binary', 'Prefer not to say'].map((g) => (
                        <button
                          key={g}
                          type="button"
                          onClick={() => setGender(g)}
                          className={cn(
                            "px-3 py-2 text-xs rounded-xl font-bold border text-center transition-all duration-150",
                            gender === g 
                              ? "bg-amber-500 border-amber-500 text-stone-950 shadow-md" 
                              : "border-white/10 bg-white/5 text-stone-400 hover:bg-white/10"
                          )}
                        >
                          {g}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Looking For Match Target */}
                  <div>
                    <label className="block text-[10px] text-stone-400 uppercase font-black tracking-wider mb-2">Looking For</label>
                    <div className="grid grid-cols-3 gap-1.5">
                      {['Male', 'Female', 'Anyone'].map((l) => (
                        <button
                          key={l}
                          type="button"
                          onClick={() => handleLookingForChange(l)}
                          className={cn(
                            "px-2.5 py-2 text-xs rounded-xl font-bold border text-center transition-all duration-150",
                            lookingFor.includes(l)
                              ? "bg-amber-500 border-amber-500 text-stone-950 shadow-md" 
                              : "border-white/10 bg-white/5 text-stone-400 hover:bg-white/10"
                          )}
                        >
                          {l}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Education / Campus tags */}
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <label className="block text-[10px] text-stone-400 uppercase font-black tracking-wider">Campus / Education Tags</label>
                      <span className="text-[10px] text-amber-500 font-bold">{eduTags.length}/3 tags</span>
                    </div>
                    <input
                      type="text"
                      placeholder="e.g. Intern, GDSC, CS Major... (Enter to add)"
                      value={eduTagInput}
                      onChange={(e) => setEduTagInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          const tag = eduTagInput.trim();
                          if (tag) {
                            if (eduTags.length >= 3) {
                              alert('Maximum of 3 education tags allowed.');
                              return;
                            }
                            if (!eduTags.includes(tag)) {
                              setEduTags([...eduTags, tag]);
                              setEduTagInput('');
                            }
                          }
                        }
                      }}
                      className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-stone-500 focus:outline-none focus:border-amber-500 text-xs font-semibold"
                    />
                    {eduTags.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {eduTags.map((tag) => (
                          <span key={tag} className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-500/10 text-amber-400 rounded-full text-[10px] border border-amber-500/10">
                            {tag}
                            <button
                              type="button"
                              onClick={() => setEduTags(eduTags.filter(x => x !== tag))}
                              className="text-stone-500 hover:text-red-400 font-bold ml-1 text-sm"
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
          )}

          {/* STEP 5: SELECT MATCHING STYLE */}
          {step === 5 && (
            <div className="space-y-4 animate-fade-in">
              <h3 className="text-xs font-black text-stone-400 uppercase tracking-widest text-center mb-2">
                Choose Matching Style
              </h3>
              
              <div className="grid grid-cols-1 gap-3">
                {[
                  {
                    mode: 'RANDOM' as const,
                    icon: '⚡',
                    title: 'Instant Match',
                    desc: 'Meet someone immediately. Prioritizes search speed.'
                  },
                  {
                    mode: 'PREFER' as const,
                    icon: '🧠',
                    title: 'Smart Match',
                    desc: 'Balances speed and compatibility. Uses compatibility score.'
                  },
                  {
                    mode: 'STRICT' as const,
                    icon: '🎯',
                    title: 'Exact Match',
                    desc: 'Waits until every single selected filter matches precisely.'
                  }
                ].map((item) => (
                  <button
                    key={item.mode}
                    type="button"
                    onClick={() => {
                      setMatchMode(item.mode);
                      trackTelemetry('Match style selected', { style: item.mode });
                      if (item.mode === 'STRICT') {
                        setMatchConstraints({
                          university: !!university,
                          city: !!city,
                          country: !!country,
                          languages: languages.length > 0,
                          interests: interestTags.length > 0
                        });
                      }
                    }}
                    className={cn(
                      "w-full text-left p-4 rounded-2xl border transition-all duration-300 flex items-start gap-4",
                      matchMode === item.mode
                        ? "bg-amber-500/10 border-amber-500 text-white shadow-lg"
                        : "border-white/5 bg-white/[0.02] text-stone-400 hover:bg-white/[0.05]"
                    )}
                  >
                    <span className="text-2xl shrink-0">{item.icon}</span>
                    <div>
                      <h4 className={cn("text-sm font-black", matchMode === item.mode ? "text-amber-400" : "text-white")}>
                        {item.title}
                      </h4>
                      <p className="text-[11px] text-stone-400 mt-1 font-medium leading-relaxed">{item.desc}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-white/10 bg-stone-950 flex items-center justify-between">
          <div>
            {step > 1 ? (
              <button
                type="button"
                onClick={() => setStep((prev) => (prev - 1) as any)}
                className="px-4 py-2 border border-white/10 hover:bg-white/5 text-white/70 hover:text-white text-xs rounded-xl font-bold transition-all"
              >
                Back
              </button>
            ) : (
              <button
                type="button"
                onClick={handleReset}
                disabled={isSavingState !== 'idle'}
                className="px-4 py-2 border border-white/10 hover:bg-white/5 text-stone-500 hover:text-stone-300 text-xs rounded-xl font-bold transition-all disabled:opacity-30"
              >
                Reset All
              </button>
            )}
          </div>
          
          <div className="flex gap-2">
            {step < 5 ? (
              <button
                type="button"
                onClick={step === 1 ? handleNextStep1 : () => setStep((prev) => (prev + 1) as any)}
                className="px-5 py-2.5 bg-amber-500 border border-amber-500 text-stone-950 text-xs rounded-xl font-black shadow-md hover:bg-amber-400 transition-all"
              >
                Next
              </button>
            ) : (
              <button
                onClick={handleSave}
                disabled={isSavingState !== 'idle'}
                className="relative overflow-hidden px-6 py-2.5 bg-amber-500 hover:bg-amber-400 text-stone-950 text-xs rounded-xl font-black shadow-lg shadow-amber-500/20 flex items-center gap-2 min-w-[140px] justify-center disabled:opacity-80 select-none group"
              >
                {/* Golden Inward Particle Convergence Layers */}
                <div className="absolute inset-0 rounded-xl overflow-hidden pointer-events-none">
                  <div className="btn-particle bp-1" />
                  <div className="btn-particle bp-2" />
                  <div className="btn-particle bp-3" />
                  <div className="btn-particle bp-4" />
                </div>

                <span className="relative z-10 flex items-center gap-1.5">
                  {isSavingState === 'idle' && '🚀 Start Conversation'}
                  {isSavingState === 'joining' && 'Joining...'}
                  {isSavingState === 'spinner' && (
                    <svg className="animate-spin h-4 w-4 text-stone-950" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                  )}
                  {isSavingState === 'success' && '✓ Ready!'}
                </span>
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}

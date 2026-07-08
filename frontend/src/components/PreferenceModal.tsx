import { useState, useEffect, useRef } from 'react';
import { apiService } from '../services/api.js';
import { cn } from '../utils/index.js';

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

export function PreferenceModal({ isOpen, onClose, onSave, currentPreferences = {} }: PreferenceModalProps) {
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

  // V5.1 App preferences
  const [showTips, setShowTips] = useState(() => {
    return localStorage.getItem('kaboom_show_tips') !== 'false';
  });
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('kaboom_theme') || 'ember';
  });

  // Autocomplete state
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

  const handleSave = async () => {
    // Validate Display Name
    const nameClean = displayName.trim();
    if (!nameClean || nameClean.length < 3) {
      alert('Display Name is mandatory and must be at least 3 characters.');
      return;
    }
    if (nameClean.length > 25) {
      alert('Display Name cannot exceed 25 characters.');
      return;
    }

    // HTML tags check
    if (/<[^>]*>/g.test(nameClean)) {
      alert('Display Name cannot contain HTML tags.');
      return;
    }

    // Emoji spam check
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

    // Basic profanity check
    const badWords = ['fuck', 'shit', 'asshole', 'bitch', 'crap', 'dick', 'pussy', 'bastard', 'cunt', 'nigger', 'faggot'];
    const lowerName = nameClean.toLowerCase();
    if (badWords.some(w => lowerName.includes(w))) {
      alert('Please keep your display name clean and friendly.');
      return;
    }

    setIsSavingState('joining');

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
      "fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/75 backdrop-blur-md transition-all duration-300",
      isFadingOut ? "opacity-0 pointer-events-none scale-95" : "opacity-100 scale-100"
    )}>
      <div className="relative w-full max-w-2xl bg-slate-900 border border-white/10 rounded-t-3xl sm:rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[85vh] sm:max-h-[90vh] transition-transform duration-300">
        {/* Header */}
        <div className="px-6 py-4 flex items-center justify-between border-b border-white/10 bg-slate-950">
          <h2 className="text-xl font-bold text-white bg-gradient-to-r from-accent to-pink-400 bg-clip-text text-transparent">Match Preferences</h2>
          {isSavingState === 'idle' && (
            <button onClick={onClose} className="p-2 text-white/50 hover:text-white rounded-full hover:bg-white/5">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* Form Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* SECTION 1: Your Identity */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold text-accent-light uppercase tracking-wider">Section 1: Your Identity</h3>
            <div className="grid grid-cols-1 gap-4">
              <div>
                <label className="block text-xs text-white/50 uppercase mb-2">Display Name (Mandatory, 3-25 chars)</label>
                <input
                  type="text"
                  placeholder="Enter display name... e.g. Alex"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/30 focus:outline-none focus:border-accent"
                  disabled={isSavingState !== 'idle'}
                />
                <p className="text-[10px] text-amber-500/80 mt-1.5 font-medium leading-relaxed">
                  This name will be visible during this chat only. It disappears after you leave.
                </p>
              </div>
              <div>
                <label className="block text-xs text-white/50 uppercase mb-2">Bio / Status (Optional, Max 120 chars)</label>
                <input
                  type="text"
                  placeholder="e.g. Study buddy, learning English, just chilling..."
                  value={bio}
                  onChange={(e) => setBio(e.target.value.slice(0, 120))}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/30 focus:outline-none focus:border-accent"
                  disabled={isSavingState !== 'idle'}
                />
              </div>
            </div>
          </div>

          <div className="border-t border-white/5" />

          {/* SECTION 2: Basic Match Preferences */}
          <div className="space-y-6">
            <h3 className="text-xs font-bold text-accent-light uppercase tracking-wider">Section 2: Basic Match Preferences</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-2">I Am</label>
                <div className="grid grid-cols-2 gap-2">
                  {['Male', 'Female', 'Non Binary', 'Prefer not to say'].map((g) => (
                    <button
                      key={g}
                      type="button"
                      disabled={isSavingState !== 'idle'}
                      onClick={() => setGender(g)}
                      className={cn(
                        "px-3 py-2 text-sm rounded-xl font-medium border text-center transition-all duration-200",
                        gender === g 
                          ? "bg-accent border-accent text-white shadow-lg shadow-accent/20" 
                          : "border-white/10 bg-white/5 text-white/70 hover:bg-white/10"
                      )}
                    >
                      {g}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-2">Looking For</label>
                <div className="grid grid-cols-3 gap-2">
                  {['Male', 'Female', 'Anyone'].map((l) => (
                    <button
                      key={l}
                      type="button"
                      disabled={isSavingState !== 'idle'}
                      onClick={() => handleLookingForChange(l)}
                      className={cn(
                        "px-3 py-2 text-sm rounded-xl font-medium border text-center transition-all duration-200",
                        lookingFor.includes(l)
                          ? "bg-accent border-accent text-white shadow-lg shadow-accent/20" 
                          : "border-white/10 bg-white/5 text-white/70 hover:bg-white/10"
                      )}
                    >
                      {l}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Languages list */}
            <div>
              <label className="block text-xs text-white/50 uppercase mb-2">Languages You Speak</label>
              <div className="flex flex-wrap gap-2">
                {LANGUAGES.map((lang) => (
                  <button
                    key={lang}
                    type="button"
                    disabled={isSavingState !== 'idle'}
                    onClick={() => toggleLanguage(lang)}
                    className={cn(
                      "px-3 py-1.5 rounded-full text-xs font-semibold border transition-all duration-200",
                      languages.includes(lang) 
                        ? "bg-accent/20 border-accent text-accent-light" 
                        : "border-white/10 bg-white/5 text-white/50 hover:bg-white/10"
                    )}
                  >
                    {lang}
                  </button>
                ))}
              </div>
            </div>

            {/* Search Location */}
            <div>
              <label className="block text-xs text-white/50 uppercase mb-2">Search Location / Country</label>
              <input
                type="text"
                placeholder="Search by city, state, or country..."
                value={locationQuery}
                disabled={isSavingState !== 'idle'}
                onChange={(e) => setLocationQuery(e.target.value)}
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/30 focus:outline-none focus:border-accent"
              />
              {locationResults.length > 0 && (
                <div className="mt-2 bg-slate-950 border border-white/10 rounded-xl max-h-48 overflow-y-auto divide-y divide-white/5 shadow-xl relative z-10">
                  {locationResults.map((loc) => (
                    <button
                      key={loc.id}
                      type="button"
                      onClick={() => handleSelectLocation(loc)}
                      className="w-full px-4 py-3 text-left hover:bg-white/5 text-sm text-white/80 flex justify-between items-center"
                    >
                      <span>{loc.name}</span>
                      <span className="text-xs text-white/30 capitalize">{loc.type}</span>
                    </button>
                  ))}
                </div>
              )}

              {/* Selected Location Details */}
              {(country || state || city) && (
                <div className="p-4 mt-3 bg-white/5 rounded-xl border border-white/10 flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-semibold text-accent-light">Selected Location:</h4>
                    <p className="text-xs text-white/70 mt-1">
                      {[city, state, country].filter(Boolean).join(' • ')}
                    </p>
                  </div>
                  {isSavingState === 'idle' && (
                    <button
                      onClick={() => {
                        setCountry('');
                        setState('');
                        setDistrict('');
                        setCity('');
                      }}
                      className="text-xs text-red-400 hover:underline"
                    >
                      Clear
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="border-t border-white/5" />

          {/* SECTION 3: Collapsible Advanced Filters */}
          <div className="border border-white/5 rounded-2xl p-4 bg-white/[0.01]">
            <button
              type="button"
              onClick={() => setIsAdvancedOpen(!isAdvancedOpen)}
              className="w-full flex items-center justify-between text-left focus:outline-none"
            >
              <div>
                <h4 className="text-sm font-bold text-white flex items-center gap-1.5">
                  <span>⚙️</span> Advanced Filters
                </h4>
                <p className="text-xs text-white/40 mt-0.5">Find people with similar interests, universities, or locations.</p>
              </div>
              <span className={cn("text-white/45 transform transition-transform duration-300", isAdvancedOpen && "rotate-180")}>
                ▼
              </span>
            </button>

            <div className={cn(
              "transition-all duration-300 overflow-hidden",
              isAdvancedOpen ? "max-h-[1200px] mt-6 opacity-100" : "max-h-0 opacity-0 pointer-events-none"
            )}>
              <div className="space-y-6">
                {/* University Search Autocomplete */}
                <div>
                  <label className="block text-xs text-white/50 uppercase mb-2">University / College (Optional)</label>
                  <input
                    type="text"
                    placeholder="Search university... e.g. IIT, Stanford, Osmania"
                    value={universityQuery}
                    disabled={isSavingState !== 'idle'}
                    onChange={(e) => {
                      setUniversityQuery(e.target.value);
                      if (!e.target.value) {
                        setUniversity('');
                      }
                    }}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/30 focus:outline-none focus:border-accent"
                  />
                  {universityResults.length > 0 && (
                    <div className="mt-2 bg-slate-950 border border-white/10 rounded-xl max-h-48 overflow-y-auto divide-y divide-white/5 shadow-xl relative z-10">
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
                          className="w-full px-4 py-3 text-left hover:bg-white/5 text-sm text-white/80 flex justify-between items-center"
                        >
                          <span className="font-medium">{u.name}</span>
                          <span className="text-xs text-white/30">{u.country}</span>
                        </button>
                      ))}
                    </div>
                  )}
                  {university && (
                    <div className="mt-2 flex items-center justify-between p-3 bg-accent/10 border border-accent/20 rounded-xl">
                      <span className="text-xs text-white font-medium">🎓 {university}</span>
                      {isSavingState === 'idle' && (
                        <button
                          type="button"
                          onClick={() => {
                            setUniversity('');
                            setMatchConstraints(prev => ({ ...prev, university: false }));
                          }}
                          className="text-xs text-red-400 hover:underline"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* Campus Education Tags */}
                <div>
                  <label className="block text-xs text-white/50 uppercase mb-2">Campus / Education Tags (Max 3, press Enter to add)</label>
                  <input
                    type="text"
                    placeholder="e.g. Microsoft Internship, AWS Community, GDSC..."
                    value={eduTagInput}
                    disabled={isSavingState !== 'idle'}
                    onChange={(e) => setEduTagInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        const tag = eduTagInput.trim();
                        if (tag && eduTags.length < 3 && !eduTags.includes(tag)) {
                          setEduTags([...eduTags, tag]);
                          setEduTagInput('');
                        }
                      }
                    }}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/30 focus:outline-none focus:border-accent"
                  />
                  {eduTags.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2.5">
                      {eduTags.map((tag) => (
                        <span key={tag} className="inline-flex items-center gap-1.5 px-3 py-1 bg-purple-500/20 text-purple-300 rounded-full text-xs border border-purple-500/20">
                          {tag}
                          {isSavingState === 'idle' && (
                            <button
                              type="button"
                              onClick={() => setEduTags(eduTags.filter(x => x !== tag))}
                              className="hover:text-red-400 font-bold ml-1"
                            >
                              ×
                            </button>
                          )}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Interests Search */}
                <div>
                  <label className="block text-xs text-white/50 uppercase mb-2">Interests (Autocomplete)</label>
                  <input
                    type="text"
                    placeholder="Search e.g. Gaming, Cricket, Chess, AI..."
                    value={interestQuery}
                    disabled={isSavingState !== 'idle'}
                    onChange={(e) => setInterestQuery(e.target.value)}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/30 focus:outline-none focus:border-accent"
                  />
                  {interestResults.length > 0 && (
                    <div className="mt-2 bg-slate-950 border border-white/10 rounded-xl max-h-48 overflow-y-auto divide-y divide-white/5 shadow-xl relative z-10">
                      {interestResults.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => handleSelectInterest(item.name)}
                          className="w-full px-4 py-3 text-left hover:bg-white/5 text-sm text-white/80 flex justify-between items-center"
                        >
                          <span>{item.name}</span>
                          <span className="text-xs px-2 py-0.5 bg-accent/20 text-accent-light rounded-full text-[10px]">{item.category}</span>
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Active Tags */}
                  {interestTags.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-3">
                      {interestTags.map((t) => (
                        <span key={t} className="inline-flex items-center gap-1.5 px-3 py-1 bg-white/10 text-white rounded-full text-xs border border-white/5">
                          {t}
                          {isSavingState === 'idle' && (
                            <button onClick={() => removeInterest(t)} className="hover:text-red-400 font-bold ml-1">×</button>
                          )}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Match Mode Selection */}
                <div>
                  <label className="block text-xs text-white/50 uppercase mb-2">Matchmaking Search Mode</label>
                  <div className="grid grid-cols-3 gap-2">
                    {(['RANDOM', 'PREFER', 'STRICT'] as const).map((m) => (
                      <button
                        key={m}
                        type="button"
                        disabled={isSavingState !== 'idle'}
                        onClick={() => {
                          setMatchMode(m);
                          if (m === 'STRICT') {
                            setMatchConstraints(prev => ({
                              university: !!university,
                              city: !!city,
                              country: !!country,
                              language: false,
                              interests: false,
                              ...prev
                            }));
                          }
                        }}
                        className={cn(
                          "px-3 py-3 text-xs rounded-xl font-bold border text-center transition-all duration-200",
                          matchMode === m
                            ? "bg-gradient-to-r from-accent to-purple-600 border-accent text-white shadow-lg"
                            : "border-white/10 bg-white/5 text-white/70 hover:bg-white/10"
                        )}
                      >
                        {m === 'RANDOM' && '🌍 Random'}
                        {m === 'PREFER' && '🎯 Smart Match'}
                        {m === 'STRICT' && '🔒 Exact Match'}
                      </button>
                    ))}
                  </div>
                  <p className="text-[11px] text-white/40 mt-2 leading-relaxed">
                    {matchMode === 'RANDOM' && '🌍 Random: Connect with anyone instantly. Compatibility scoring & relaxation apply.'}
                    {matchMode === 'PREFER' && '🎯 Smart Match: Prioritizes interests & locations, but relaxes filters if waiting to ensure connection.'}
                    {matchMode === 'STRICT' && '🔒 Exact Match: Never fall back. Wait indefinitely in the queue until a user matches your strict filters.'}
                  </p>
                </div>

                {/* STRICT Constraints selection */}
                {matchMode === 'STRICT' && (
                  <div className="p-4 bg-purple-950/20 border border-purple-500/10 rounded-2xl space-y-3">
                    <h4 className="text-xs font-bold text-purple-300 uppercase tracking-wider">🔒 Strict Constraint Toggles</h4>
                    <p className="text-[10px] text-white/40 leading-relaxed mb-1">
                      Choose which active dimensions MUST match exactly. If checked, you will only match with users who satisfy that parameter.
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {[
                        { key: 'university', label: 'University', enabled: !!university, desc: university ? `Must match: ${university.slice(0, 15)}...` : 'Requires university first' },
                        { key: 'city', label: 'City', enabled: !!city, desc: city ? `Must match: ${city}` : 'Requires city selection' },
                        { key: 'country', label: 'Country', enabled: !!country, desc: country ? `Must match: ${country}` : 'Requires country selection' },
                        { key: 'languages', label: 'Language', enabled: languages.length > 0, desc: `Must speak one of: ${languages.slice(0, 2).join(', ')}` },
                        { key: 'interests', label: 'Interests', enabled: interestTags.length > 0, desc: 'Must share at least 1 interest tag' }
                      ].map((c) => (
                        <button
                          key={c.key}
                          type="button"
                          disabled={!c.enabled || isSavingState !== 'idle'}
                          onClick={() => setMatchConstraints(prev => ({ ...prev, [c.key]: !prev[c.key] }))}
                          className={cn(
                            "p-3 rounded-xl border text-left flex items-start justify-between transition-all duration-200",
                            !c.enabled && "opacity-40 cursor-not-allowed border-white/5",
                            c.enabled && matchConstraints[c.key]
                              ? "bg-purple-500/10 border-purple-500 text-white"
                              : "border-white/10 bg-white/5 text-white/70 hover:bg-white/10"
                          )}
                        >
                          <div>
                            <div className="text-xs font-semibold">{c.label}</div>
                            <div className="text-[9px] text-white/40 mt-0.5">{c.desc}</div>
                          </div>
                          <div className={cn(
                            "w-4 h-4 rounded-full flex items-center justify-center border text-[10px]",
                            matchConstraints[c.key]
                              ? "border-purple-400 bg-purple-500 text-white font-bold"
                              : "border-white/30 bg-transparent text-transparent"
                          )}>
                            ✓
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-white/10 bg-slate-950 flex items-center justify-between">
          <button
            onClick={handleReset}
            disabled={isSavingState !== 'idle'}
            className="px-4 py-2 border border-white/10 hover:bg-white/5 text-white/60 hover:text-white text-sm rounded-xl font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Reset All
          </button>
          <div className="flex gap-3">
            {isSavingState === 'idle' && (
              <button
                onClick={onClose}
                className="px-4 py-2 border border-white/10 hover:bg-white/5 text-white text-sm rounded-xl font-medium"
              >
                Cancel
              </button>
            )}
            <button
              onClick={handleSave}
              disabled={isSavingState !== 'idle'}
              className="px-6 py-2 bg-gradient-to-r from-accent to-purple-600 hover:opacity-90 text-white text-sm rounded-xl font-semibold shadow-lg shadow-accent/20 flex items-center gap-2 min-w-[120px] justify-center disabled:opacity-80"
            >
              {isSavingState === 'idle' && 'Save & Join'}
              {isSavingState === 'joining' && 'Joining...'}
              {isSavingState === 'spinner' && (
                <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              )}
              {isSavingState === 'success' && '✓ Session Created'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

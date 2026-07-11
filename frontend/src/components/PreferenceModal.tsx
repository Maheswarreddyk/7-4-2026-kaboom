import { useState, useEffect, useRef } from 'react';
import { apiService } from '../services/api.js';
import { cn } from '../utils/index.js';
import { COLLEGE_SUGGESTIONS } from '../utils/collegeSuggestions.js';
import { MATCH_CATEGORIES } from '../utils/matchCategories.js';

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

const BANNER_MESSAGES = [
  "Students from Saveetha University are waiting...",
  "People nearby are joining...",
  "Someone who speaks Telugu is online...",
  "Find someone who shares your interests...",
  "Your next conversation starts here..."
];

const NAME_PLACEHOLDERS = ['Rahul', 'Aishu', 'Shadow', 'CoffeeAddict', 'Mahes'];
const BIO_PLACEHOLDERS = ['Coffee first ☕', 'Just finished exams 😴', 'Looking for new friends 👋', 'Anyone up for gaming?', 'Learning AI'];

// CSS Animations: breathing, hammer, particles, and constraint shake
const MODAL_ANIMATION_STYLES = `
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
    transition: animation-duration 0.2s ease;
  }
  .btn-particle-fast {
    animation-duration: 0.8s !important;
  }
  .bp-1 { --dx: -75px; --dy: -25px; animation: inwardParticle 2.2s infinite ease-in; }
  .bp-2 { --dx: 80px; --dy: 30px; animation: inwardParticle 2.6s infinite ease-in; animation-delay: 0.4s; }
  .bp-3 { --dx: -45px; --dy: 45px; animation: inwardParticle 2.0s infinite ease-in; animation-delay: 0.8s; }
  .bp-4 { --dx: 65px; --dy: -40px; animation: inwardParticle 2.4s infinite ease-in; animation-delay: 1.2s; }

  @keyframes hammerTap {
    0%, 90%, 100% { transform: rotate(0deg); }
    92%, 96% { transform: rotate(-24deg); }
    94% { transform: rotate(10deg); }
  }
  .hammer-tap-anim {
    animation: hammerTap 9s ease-in-out infinite;
    transform-origin: bottom right;
  }

  @keyframes buttonBreathe {
    0%, 100% { transform: scale(1); }
    50% { transform: scale(1.025); }
  }
  .button-breathe-slow {
    animation: buttonBreathe 4.5s ease-in-out infinite;
  }

  @keyframes recipeShake {
    0%, 100% { transform: translateX(0); }
    20%, 60% { transform: translateX(-6px); }
    40%, 80% { transform: translateX(6px); }
  }
  .recipe-shake-anim {
    animation: recipeShake 0.4s ease-in-out;
  }
`;

function TypewriterRotator({ messages, speed = 45, delay = 2400 }: { messages: string[], speed?: number, delay?: number }) {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [displayText, setDisplayText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const fullText = messages[currentIdx] || '';
    
    if (isDeleting) {
      timer = setTimeout(() => {
        setDisplayText(fullText.substring(0, displayText.length - 1));
      }, 20);
    } else {
      timer = setTimeout(() => {
        setDisplayText(fullText.substring(0, displayText.length + 1));
      }, speed);
    }

    if (!isDeleting && displayText === fullText) {
      timer = setTimeout(() => {
        setIsDeleting(true);
      }, delay);
    } else if (isDeleting && displayText === '') {
      setIsDeleting(false);
      setCurrentIdx((prev) => (prev + 1) % messages.length);
    }

    return () => clearTimeout(timer);
  }, [displayText, isDeleting, currentIdx, messages, speed, delay]);

  return (
    <div className="h-5 flex items-center justify-center select-none text-[11px] font-semibold text-amber-500/80">
      <span>{displayText}</span>
      <span className="w-1 h-3.5 bg-amber-500/80 ml-0.5 animate-pulse" />
    </div>
  );
}

export function PreferenceModal({ isOpen, onClose, onSave, currentPreferences = {} }: PreferenceModalProps) {
  const modalOpenedTimeRef = useRef<number>(Date.now());
  const hasJoinedQueueRef = useRef<boolean>(false);

  // Tabs and general visual drawers
  const [activeTabId, setActiveTabId] = useState<string>('COLLEGE');
  const [isNewUser, setIsNewUser] = useState<boolean>(true);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [shakeRecipe, setShakeRecipe] = useState(false);

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

  const [universityQuery, setUniversityQuery] = useState('');
  const [universityResults, setUniversityResults] = useState<any[]>([]);

  const universityDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Focus & scrolling tracking references
  const universityInputRef = useRef<HTMLInputElement | null>(null);
  const locationInputRef = useRef<HTMLInputElement | null>(null);
  const interestInputRef = useRef<HTMLInputElement | null>(null);

  // Button magnetic offsets
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const [btnMagneticOffset, setBtnMagneticOffset] = useState({ x: 0, y: 0 });
  const [isHovered, setIsHovered] = useState(false);

  // Rotating identity placeholders index
  const [placeholderIdx, setPlaceholderIdx] = useState(0);

  // Shuffled dynamic hot filter chips
  const [hotChips, setHotChips] = useState<any[]>([]);

  const trackTelemetry = (event: string, meta?: any) => {
    console.log(`[Telemetry Event] ${event}`, meta || {});
  };

  const handleCloseTrigger = () => {
    if (!hasJoinedQueueRef.current) {
      trackTelemetry('Queue abandonment (user closes before joining)', {
        timeSpentMs: Date.now() - modalOpenedTimeRef.current
      });
    }
    onClose();
  };

  useEffect(() => {
    if (isOpen) {
      modalOpenedTimeRef.current = Date.now();
      hasJoinedQueueRef.current = false;
      trackTelemetry('Preference modal opened');
      const hasName = localStorage.getItem('kaboom_display_name');
      setIsNewUser(!hasName);

      // Shuffle popular filters every page load
      const chips = [
        { type: 'university' as const, label: '🏫 Saveetha', val: 'Saveetha University' },
        { type: 'location' as const, label: '🌍 Hyderabad', val: { name: 'Hyderabad, Telangana, India', country: 'India', state: 'Telangana', city: 'Hyderabad' } },
        { type: 'language' as const, label: '💬 Telugu', val: 'Telugu' },
        { type: 'interest' as const, label: '🎮 Gaming', val: 'Gaming' },
        { type: 'interest' as const, label: '🤖 AI', val: 'AI' },
        { type: 'interest' as const, label: '🎵 Music', val: 'Music' }
      ];
      setHotChips(chips.sort(() => Math.random() - 0.5));
    }
  }, [isOpen]);

  // Rotates placeholders every 3.5s
  useEffect(() => {
    if (!isOpen) return;
    const interval = setInterval(() => {
      setPlaceholderIdx((prev) => (prev + 1) % NAME_PLACEHOLDERS.length);
    }, 3500);
    return () => clearInterval(interval);
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

  // Autocomplete location and interest hooks
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

  // Active filter count check (max 3 filters strictly)
  const getActiveFilterCount = () => {
    let count = 0;
    if (university) count++;
    if (city) count++;
    if (languages.filter(l => l !== 'English').length > 0) count++;
    if (interestTags.length > 0) count += interestTags.length;
    return count;
  };

  const checkAndAddFilter = (action: () => void) => {
    if (getActiveFilterCount() >= 3) {
      setShakeRecipe(true);
      setTimeout(() => setShakeRecipe(false), 450);
      return;
    }
    action();
  };

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
    checkAndAddFilter(() => {
      setCountry(loc.country || '');
      setState(loc.state || '');
      setDistrict(loc.district || '');
      setCity(loc.city || '');
      setLocationQuery('');
      setLocationResults([]);
    });
  };

  const handleSelectInterest = (name: string) => {
    if (interestTags.includes(name)) return;
    checkAndAddFilter(() => {
      setInterestTags([...interestTags, name]);
      setInterestQuery('');
      setInterestResults([]);
    });
  };

  const removeInterest = (name: string) => {
    setInterestTags(interestTags.filter(x => x !== name));
  };

  const toggleLanguage = (lang: string) => {
    if (languages.includes(lang)) {
      setLanguages(languages.filter(x => x !== lang));
    } else {
      checkAndAddFilter(() => {
        setLanguages([...languages, lang]);
      });
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

  const handleSelectTabButton = (tabId: string) => {
    trackTelemetry('Tab channel changed', { tabId });
    setActiveTabId(tabId);
    setTimeout(() => {
      if (tabId === 'COLLEGE') universityInputRef.current?.focus();
      else if (tabId === 'NEARBY') locationInputRef.current?.focus();
      else if (tabId === 'INTERESTS') interestInputRef.current?.focus();
    }, 150);
  };

  const handleSelectHotChip = (chip: any) => {
    trackTelemetry('Hot chip selected', { type: chip.type, value: chip.val });
    checkAndAddFilter(() => {
      if (chip.type === 'university') {
        setUniversity(chip.val);
        setUniversityQuery('');
      } else if (chip.type === 'location') {
        setCountry(chip.val.country);
        setState(chip.val.state);
        setCity(chip.val.city);
      } else if (chip.type === 'language') {
        if (!languages.includes(chip.val)) {
          setLanguages([...languages, chip.val]);
        }
      } else if (chip.type === 'interest') {
        if (!interestTags.includes(chip.val)) {
          setInterestTags([...interestTags, chip.val]);
        }
      }
    });
  };

  const handleSave = async () => {
    const nameClean = displayName.trim();
    if (!validateDisplayName()) return;

    setIsSavingState('joining');
    hasJoinedQueueRef.current = true;
    trackTelemetry('Start Conversation clicked');
    trackTelemetry('Average time from modal open to queue join', {
      durationMs: Date.now() - modalOpenedTimeRef.current
    });

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

  // Button magnetic coordinates trackers
  const handleButtonMouseMove = (e: React.MouseEvent) => {
    if (!buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    const bx = rect.left + rect.width / 2;
    const by = rect.top + rect.height / 2;
    const dx = e.clientX - bx;
    const dy = e.clientY - by;
    setBtnMagneticOffset({ x: dx * 0.045, y: dy * 0.045 });
  };

  const handleButtonMouseLeave = () => {
    setBtnMagneticOffset({ x: 0, y: 0 });
    setIsHovered(false);
  };

  const activeCategory = MATCH_CATEGORIES.find(c => c.id === activeTabId);

  return (
    <div className={cn(
      "fixed inset-0 z-[999] flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-md transition-all duration-300 select-none",
      isFadingOut ? "opacity-0 pointer-events-none scale-95" : "opacity-100 scale-100"
    )}>
      <style>{MODAL_ANIMATION_STYLES}</style>

      <div className="relative w-full max-w-lg bg-stone-900 border border-white/10 rounded-t-3xl sm:rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[85vh] sm:max-h-[90vh] transition-transform duration-300">
        
        {/* Header Title */}
        <div className="px-6 py-4 flex items-center justify-between border-b border-white/10 bg-stone-950">
          <div>
            <h2 className="text-base font-black text-white uppercase tracking-wider">
              Who do you want to meet today?
            </h2>
            <p className="text-[10px] text-stone-500 font-bold tracking-wider uppercase mt-0.5">Start with one choice.</p>
          </div>
          {isSavingState === 'idle' && (
            <button onClick={handleCloseTrigger} className="p-2 text-white/40 hover:text-white rounded-full hover:bg-white/5 transition-colors">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* Modal Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          
          <TypewriterRotator messages={BANNER_MESSAGES} />

          {/* IDENTITY SECTION (Name, Bio) */}
          <div className="space-y-4">
            <div>
              <label className="block text-[10px] text-stone-400 uppercase font-black tracking-wider mb-2">
                👋 What should people call you?
              </label>
              <input
                type="text"
                placeholder={NAME_PLACEHOLDERS[placeholderIdx]}
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-stone-600 focus:outline-none focus:border-amber-500 text-sm font-semibold transition-colors"
              />
            </div>

            <div>
              <label className="block text-[10px] text-stone-400 uppercase font-black tracking-wider mb-2">
                ✨ Tell people your vibe
              </label>
              <input
                type="text"
                placeholder={BIO_PLACEHOLDERS[placeholderIdx]}
                value={bio}
                onChange={(e) => setBio(e.target.value.slice(0, 120))}
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-stone-600 focus:outline-none focus:border-amber-500 text-sm font-semibold transition-colors"
              />
            </div>
          </div>

          {/* I AM / LOOKING FOR CHIPS */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] text-stone-400 uppercase font-black tracking-wider mb-2">I Am</label>
              <div className="flex flex-wrap gap-1.5">
                {['Male', 'Female', 'Non Binary', 'Prefer not to say'].map((g) => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => setGender(g)}
                    className={cn(
                      "px-2.5 py-1.5 text-[9px] rounded-lg font-bold border text-center transition-all duration-150 truncate",
                      gender === g 
                        ? "bg-amber-500 border-amber-500 text-stone-950 font-black" 
                        : "border-white/10 bg-white/5 text-stone-400 hover:bg-white/10"
                    )}
                  >
                    {g.split(' ')[0]}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-[10px] text-stone-400 uppercase font-black tracking-wider mb-2">Looking For</label>
              <div className="flex flex-wrap gap-1.5">
                {['Male', 'Female', 'Anyone'].map((l) => (
                  <button
                    key={l}
                    type="button"
                    onClick={() => handleLookingForChange(l)}
                    className={cn(
                      "px-2.5 py-1.5 text-[9px] rounded-lg font-bold border text-center transition-all duration-150",
                      lookingFor.includes(l)
                        ? "bg-amber-500 border-amber-500 text-stone-950 font-black" 
                        : "border-white/10 bg-white/5 text-stone-400 hover:bg-white/10"
                    )}
                  >
                    {l}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* PRIMARY START CONVERSATION CTA */}
          <div className="flex justify-center pt-2">
            <button
              ref={buttonRef}
              onClick={handleSave}
              onMouseMove={handleButtonMouseMove}
              onMouseEnter={() => setIsHovered(true)}
              onMouseLeave={handleButtonMouseLeave}
              disabled={isSavingState !== 'idle'}
              className="relative overflow-hidden px-8 py-3.5 bg-amber-500 text-stone-950 text-xs rounded-2xl font-black shadow-lg shadow-amber-500/10 flex items-center gap-2 min-w-[200px] justify-center select-none transition-all duration-300 active:scale-95 button-breathe-slow hover:-translate-y-0.5 hover:shadow-amber-500/20"
              style={{
                transform: `translate3d(${btnMagneticOffset.x}px, ${btnMagneticOffset.y}px, 0)`,
              }}
            >
              {/* Particle convergence layer */}
              <div className="absolute inset-0 rounded-2xl overflow-hidden pointer-events-none">
                <div className={cn("btn-particle bp-1", isHovered && "btn-particle-fast")} />
                <div className={cn("btn-particle bp-2", isHovered && "btn-particle-fast")} />
                <div className={cn("btn-particle bp-3", isHovered && "btn-particle-fast")} />
                <div className={cn("btn-particle bp-4", isHovered && "btn-particle-fast")} />
              </div>

              {/* Hammer Tap Anim */}
              {isSavingState === 'idle' && (
                <span className="text-xs hammer-tap-anim shrink-0">🔨</span>
              )}

              <span className="relative z-10 flex items-center gap-1.5">
                {isSavingState === 'idle' 
                  ? isNewUser 
                    ? '🚀 Start Conversation' 
                    : 'Continue' 
                  : isSavingState === 'joining' 
                    ? 'Joining...' 
                    : isSavingState === 'spinner' 
                      ? (
                        <svg className="animate-spin h-4 w-4 text-stone-950" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                      )
                      : '✓ Ready!'}
              </span>
            </button>
          </div>

          {/* CHOOSE MATCH STYLE (Always visible) */}
          <div className="space-y-3 pt-2">
            <h3 className="text-[10px] font-black text-stone-500 uppercase tracking-widest text-center">
              Choose Match Style
            </h3>
            
            <div className="grid grid-cols-3 gap-2">
              {[
                {
                  mode: 'RANDOM' as const,
                  icon: '⚡',
                  title: 'Quick',
                  desc: 'Meet someone in seconds. Great when you just want to chat.'
                },
                {
                  mode: 'PREFER' as const,
                  icon: '🧠',
                  title: 'Smart',
                  desc: 'Most popular. Balances speed with compatibility.',
                  recommended: true
                },
                {
                  mode: 'STRICT' as const,
                  icon: '🎯',
                  title: 'Exact',
                  desc: 'Wait longer. Meet only people matching chosen preferences.'
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
                    "p-3 rounded-xl border text-center transition-all duration-300 flex flex-col items-center justify-between min-h-[110px] relative",
                    matchMode === item.mode
                      ? "bg-amber-500/10 border-amber-500 text-white scale-[1.02]"
                      : "border-white/5 bg-white/[0.01] text-stone-400 hover:bg-white/[0.04]"
                  )}
                >
                  {item.recommended && (
                    <span className="absolute -top-1.5 left-1/2 -translate-x-1/2 text-[7px] font-black uppercase bg-amber-500 text-stone-950 px-1 rounded-full whitespace-nowrap">
                      Smart
                    </span>
                  )}
                  <span className="text-lg mt-1">{item.icon}</span>
                  <h4 className={cn("text-xs font-black mt-1", matchMode === item.mode ? "text-amber-400" : "text-white")}>
                    {item.title}
                  </h4>
                  <p className="text-[8px] text-stone-500 leading-tight mt-1 truncate-3-lines">{item.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* DYNAMIC SHUFFLED HOT FILTERS CHIPS */}
          {hotChips.length > 0 && (
            <div className="pt-2">
              <label className="block text-[9px] text-stone-500 uppercase font-black tracking-wider mb-2">🔥 Popular Right Now</label>
              <div className="flex flex-wrap gap-1.5">
                {hotChips.map((chip, idx) => {
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleSelectHotChip(chip)}
                      className="px-2.5 py-1 rounded-full text-[10px] font-bold border border-white/5 bg-white/[0.02] text-stone-400 hover:bg-white/5 transition-colors flex items-center gap-1"
                    >
                      {chip.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* PERSONALIZATION DRAWER ACCORDION */}
          <div className="border border-white/10 rounded-2xl overflow-hidden bg-white/[0.01] pt-1">
            <button
              type="button"
              onClick={() => {
                setIsDrawerOpen(!isDrawerOpen);
                trackTelemetry('Drawer filters expanded', { expanded: !isDrawerOpen });
              }}
              className="w-full flex items-center justify-between text-left p-4 focus:outline-none hover:bg-white/[0.02] transition-colors"
            >
              <div>
                <h4 className="text-sm font-black text-white flex items-center gap-1.5">
                  ✨ Boost Your Match Quality
                </h4>
                <p className="text-[9px] text-stone-500 mt-0.5">
                  More people use these filters to find better conversations. (Optional)
                </p>
              </div>
              <span className="text-xs text-stone-400">{isDrawerOpen ? '▲ Hide' : '▼ Personalize More'}</span>
            </button>

            <div className={cn(
              "transition-all duration-300 overflow-hidden",
              isDrawerOpen ? "max-h-[600px] border-t border-white/5 p-4 space-y-4 opacity-100" : "max-h-0 opacity-0 pointer-events-none"
            )}>
              
              {/* TAB BUTTONS BAR */}
              <div className="flex border-b border-white/10 pb-2 overflow-x-auto gap-2">
                {MATCH_CATEGORIES.map((cat) => {
                  const active = activeTabId === cat.id;
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => handleSelectTabButton(cat.id)}
                      className={cn(
                        "px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 border shrink-0",
                        cat.recommended && !active ? "border-amber-500/20 bg-amber-500/[0.02]" : "border-transparent",
                        active 
                          ? "bg-amber-500 text-stone-950 border-amber-500 font-black" 
                          : "text-stone-400 hover:bg-white/5"
                      )}
                    >
                      <span>{cat.icon}</span>
                      <span>{cat.title.split(' ')[0]}</span>
                      {cat.recommended && (
                        <span className="text-[7px] font-black uppercase bg-amber-500 text-stone-950 px-1 rounded-full">
                          ⭐ Recommended
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Dynamic Content Panel depends on selected tab */}
              <div className="bg-stone-950/60 p-4 border border-white/5 rounded-2xl min-h-[160px] relative">
                
                {/* Simulated continuous typewriter online tickers */}
                {activeCategory && (
                  <div className="mb-3 text-center border-b border-white/5 pb-2">
                    <TypewriterRotator messages={activeCategory.rotatorMessages} speed={30} delay={1800} />
                  </div>
                )}

                {/* College tab content */}
                {activeTabId === 'COLLEGE' && (
                  <div className="space-y-4 animate-fade-in">
                    <div>
                      <input
                        ref={universityInputRef}
                        type="text"
                        placeholder="Search your university... e.g. VIT, SRM, IIT"
                        value={universityQuery}
                        onChange={(e) => {
                          setUniversityQuery(e.target.value);
                          if (!e.target.value) setUniversity('');
                        }}
                        className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-stone-500 focus:outline-none focus:border-amber-500 text-xs font-semibold"
                      />

                      {universityResults.length > 0 && (
                        <div className="mt-2 bg-stone-950 border border-white/10 rounded-xl max-h-32 overflow-y-auto divide-y divide-white/5 shadow-xl relative z-20">
                          {universityResults.map((u) => (
                            <button
                              key={u.name}
                              type="button"
                              onClick={() => {
                                checkAndAddFilter(() => {
                                  setUniversity(u.name);
                                  setUniversityQuery('');
                                  setUniversityResults([]);
                                });
                              }}
                              className="w-full px-4 py-2 text-left hover:bg-white/5 text-xs text-white/80 flex justify-between items-center"
                            >
                              <span className="font-bold">{u.name}</span>
                              <span className="text-[9px] text-stone-500">{u.country}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    <div>
                      <label className="block text-[8px] text-stone-500 uppercase font-black tracking-wider mb-1.5">Popular campuses</label>
                      <div className="flex flex-wrap gap-1.5">
                        {COLLEGE_SUGGESTIONS.slice(0, 4).map((col) => (
                          <button
                            key={col}
                            type="button"
                            onClick={() => {
                              checkAndAddFilter(() => {
                                setUniversity(col);
                              });
                            }}
                            className={cn(
                              "px-2.5 py-1 rounded-full text-[9px] font-bold border transition-colors",
                              university === col
                                ? "bg-amber-500/20 border-amber-500 text-amber-400"
                                : "border-white/5 bg-white/[0.02] text-stone-400 hover:bg-white/5"
                            )}
                          >
                            {col.split(' ')[0]}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Nearby tab content */}
                {activeTabId === 'NEARBY' && (
                  <div className="space-y-4 animate-fade-in">
                    <div>
                      <input
                        ref={locationInputRef}
                        type="text"
                        placeholder="Search by city, state, or country..."
                        value={locationQuery}
                        onChange={(e) => setLocationQuery(e.target.value)}
                        className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-stone-500 focus:outline-none focus:border-amber-500 text-xs font-semibold"
                      />

                      {locationResults.length > 0 && (
                        <div className="mt-2 bg-stone-950 border border-white/10 rounded-xl max-h-32 overflow-y-auto divide-y divide-white/5 shadow-xl relative z-20">
                          {locationResults.map((loc) => (
                            <button
                              key={loc.id}
                              type="button"
                              onClick={() => handleSelectLocation(loc)}
                              className="w-full px-4 py-2 text-left hover:bg-white/5 text-xs text-white/80 flex justify-between items-center"
                            >
                              <span>{loc.name}</span>
                              <span className="text-[9px] text-stone-500 capitalize">{loc.type}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="text-[9px] text-stone-500 leading-relaxed">
                      Nearby conversations happen fastest. Enable a city to improve matching suggestions.
                    </div>
                  </div>
                )}

                {/* Language tab content */}
                {activeTabId === 'LANGUAGE' && (
                  <div className="space-y-4 animate-fade-in">
                    <div className="text-[9px] text-stone-400 mb-1 leading-relaxed">
                      People speaking Telugu and English are highly active now.
                    </div>
                    <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto">
                      {LANGUAGES.map((lang) => {
                        const selected = languages.includes(lang);
                        return (
                          <button
                            key={lang}
                            type="button"
                            onClick={() => toggleLanguage(lang)}
                            className={cn(
                              "px-2.5 py-1 rounded-full text-[10px] font-bold border transition-colors",
                              selected
                                ? "bg-amber-500/20 border-amber-500 text-amber-400"
                                : "border-white/5 bg-white/[0.02] text-stone-400 hover:bg-white/5"
                            )}
                          >
                            {lang}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Interests tab content */}
                {activeTabId === 'INTERESTS' && (
                  <div className="space-y-4 animate-fade-in">
                    <input
                      ref={interestInputRef}
                      type="text"
                      placeholder="Search interests (e.g. Gaming)..."
                      value={interestQuery}
                      onChange={(e) => setInterestQuery(e.target.value)}
                      className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-stone-500 focus:outline-none focus:border-amber-500 text-xs font-semibold"
                    />

                    {interestResults.length > 0 && (
                      <div className="mt-2 bg-stone-950 border border-white/10 rounded-xl max-h-32 overflow-y-auto divide-y divide-white/5 shadow-xl relative z-20">
                        {interestResults.map((item) => (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => handleSelectInterest(item.name)}
                            className="w-full px-4 py-2 text-left hover:bg-white/5 text-xs text-white/80 flex justify-between items-center"
                          >
                            <span>{item.name}</span>
                            <span className="text-[9px] px-1.5 py-0.5 bg-white/5 rounded text-stone-400">{item.category}</span>
                          </button>
                        ))}
                      </div>
                    )}

                    <div className="text-[9px] text-stone-500 leading-relaxed">
                      Gamers and music lovers are connected recently. Select keywords to tune matches.
                    </div>
                  </div>
                )}

                {/* Random tab content */}
                {activeTabId === 'RANDOM' && (
                  <div className="text-center py-6 animate-fade-in text-stone-400 text-xs">
                    🌎 No filters. No expectations. Just one interesting conversation.
                  </div>
                )}

              </div>

              {/* ✨ Your Conversation Vibe (Selected Recipe - Max 3, inline shake warning) */}
              <div className={cn(
                "p-4 bg-white/5 border border-white/10 rounded-2xl relative",
                shakeRecipe && "recipe-shake-anim border-red-500/40"
              )}>
                <div className="flex justify-between items-center mb-2.5">
                  <h4 className="text-xs font-black text-white">✨ Your Conversation Vibe</h4>
                  <span className="text-[9px] font-black text-amber-500">{getActiveFilterCount()}/3</span>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {university && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-500/15 text-amber-400 rounded-full text-[10px] font-bold border border-amber-500/10">
                      🏫 {university.split(' ')[0]}
                      <button type="button" onClick={() => setUniversity('')} className="text-stone-400 hover:text-red-400 font-bold ml-1">×</button>
                    </span>
                  )}
                  {city && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-500/15 text-amber-400 rounded-full text-[10px] font-bold border border-amber-500/10">
                      📍 {city}
                      <button type="button" onClick={() => { setCountry(''); setState(''); setCity(''); }} className="text-stone-400 hover:text-red-400 font-bold ml-1">×</button>
                    </span>
                  )}
                  {languages.filter(l => l !== 'English').map((lang) => (
                    <span key={lang} className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-500/15 text-amber-400 rounded-full text-[10px] font-bold border border-amber-500/10">
                      💬 {lang}
                      <button type="button" onClick={() => toggleLanguage(lang)} className="text-stone-400 hover:text-red-400 font-bold ml-1">×</button>
                    </span>
                  ))}
                  {interestTags.map((tag) => (
                    <span key={tag} className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-500/15 text-amber-400 rounded-full text-[10px] font-bold border border-amber-500/10">
                      🎮 {tag}
                      <button type="button" onClick={() => removeInterest(tag)} className="text-stone-400 hover:text-red-400 font-bold ml-1">×</button>
                    </span>
                  ))}

                  {getActiveFilterCount() === 0 && (
                    <span className="text-[10px] text-stone-500 font-semibold italic">Explore cards to build today's vibe...</span>
                  )}
                </div>

                {shakeRecipe && (
                  <div className="text-[9px] text-red-400 font-bold mt-2">
                    ⚠️ Maximum 3 filters. Choose your strongest preferences.
                  </div>
                )}
              </div>

            </div>
          </div>

        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-white/10 bg-stone-950 flex items-center justify-between">
          <button
            type="button"
            onClick={handleReset}
            disabled={isSavingState !== 'idle'}
            className="px-4 py-2 border border-white/10 hover:bg-white/5 text-stone-500 hover:text-stone-300 text-xs rounded-xl font-bold transition-all disabled:opacity-30"
          >
            Reset All
          </button>

          <span className="text-[10px] text-stone-500 font-bold tracking-wider uppercase">V7.1 Polish</span>
        </div>

      </div>
    </div>
  );
}

import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate, useBlocker } from 'react-router-dom';
import { ConnectionStatusBadge } from '../components/ConnectionStatusBadge.js';
import { LoadingScreen } from '../components/LoadingScreen.js';
import { ReportModal } from '../components/ReportModal.js';
import { SearchingAnimation } from '../components/SearchingAnimation.js';
import { QueueCard } from '../components/QueueCard.js';
import { VideoPlayer } from '../components/VideoPlayer.js';
import { PreferenceModal } from '../components/PreferenceModal.js';
import { TemporaryChat } from '../components/TemporaryChat.js';
import { OnboardingModal } from '../components/OnboardingModal.js';
import { MatchIntroCard } from '../components/MatchIntroCard.js';
import { useSession } from '../contexts/SessionContext.js';
import { useToast } from '../contexts/ToastContext.js';
import { useVideoChat } from '../hooks/useVideoChat.js';
import { useFloatingLayout } from '../contexts/FloatingLayoutContext.js';
import { apiService } from '../services/api.js';
import type { ReportReason } from '../types/index.js';
import { formatDuration } from '../utils/index.js';
import { cn } from '../utils/index.js';
import { playTapSound } from '../utils/audio.js';
import { useResponsiveLayout } from '../hooks/useResponsiveLayout.js';
import { AdaptiveControlsDock } from '../components/AdaptiveControlsDock.js';
import { LayoutDebugger } from '../components/LayoutDebugger.js';
import { MobileHeader } from '../components/MobileHeader.js';
import { GestureLayer } from '../components/GestureLayer.js';
import { MetaManager } from '../components/MetaManager.js';
import { hintEngine } from '../services/HintEngine.js';
import { TutorialOverlay } from '../components/TutorialOverlay.js';
import { TipEngine } from '../components/TipEngine.js';

export function ChatPage() {
  const navigate = useNavigate();
  const { session, endSession, startSession, isLoading } = useSession();
  const { showToast } = useToast();
  const [showReportModal, setShowReportModal] = useState(false);
  const [showPreferenceModal, setShowPreferenceModal] = useState(false);
  const [showEndCallConfirm, setShowEndCallConfirm] = useState(false);
  const [showResumeQueueCard, setShowResumeQueueCard] = useState(() => {
    return localStorage.getItem('kaboom_session_restored') === 'true';
  });
  const [showWelcomeGate, setShowWelcomeGate] = useState(() => {
    return !localStorage.getItem('kaboom_display_name');
  });
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [initializing, setInitializing] = useState(false);
  const [permissionGranted, setPermissionGranted] = useState<boolean | null>(null);
  const chatStartedRef = useRef(false);
  const pendingLeaveRef = useRef(false);
  const hintHideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // V7 Match Intro Card state & tracking
  const [showMatchIntro, setShowMatchIntro] = useState(false);
  const lastPartnerIdRef = useRef<string | null>(null);

  // V5.1 Tutorial / theme setup
  const [showTutorial, setShowTutorial] = useState(() => {
    return localStorage.getItem('kaboom_tutorial_dismissed') !== 'true';
  });

  const { isMobile } = useResponsiveLayout();



  useEffect(() => {
    const activeTheme = localStorage.getItem('kaboom_theme') || 'ember';
    document.documentElement.className = `theme-${activeTheme}`;
  }, []);

  // FaceTime draggable self-preview state
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [snapCorner, setSnapCorner] = useState<'br' | 'bl' | 'tr' | 'tl'>(() => {
    return (localStorage.getItem('pipPosition') as any) || 'tl';
  });
  const dragStart = useRef({ x: 0, y: 0 });
  const [showReactionHub, setShowReactionHub] = useState(false);

  // Onboarding Hint state
  const [activeHint, setActiveHint] = useState<string | null>(null);
  const [hintDismissed, setHintDismissed] = useState(false);
  const [showMutualMatchPopup, setShowMutualMatchPopup] = useState(false);






  // High fidelity reactions
  const [reactions, setReactions] = useState<Array<{ id: number; emoji: string; left: number; delay: number }>>([]);
  const [isPlacementsSwapped, setIsPlacementsSwapped] = useState(false);
  const [pipScale, setPipScale] = useState(1);
  const touchStartDist = useRef<number | null>(null);
  const initialPipScale = useRef<number>(1);

  const triggerReaction = useCallback((emoji: string) => {
    const newReactions = Array.from({ length: 6 }).map((_, i) => ({
      id: Math.random() + i,
      emoji,
      left: Math.random() * 80 + 10,
      delay: Math.random() * 0.4
    }));
    setReactions(prev => [...prev, ...newReactions]);
    setTimeout(() => {
      setReactions(prev => prev.filter(r => !newReactions.some(nr => nr.id === r.id)));
    }, 3000);
  }, []);

  const {
    chatState,
    localStream,
    remoteStream,
    startChat,
    stopChat,
    handleNext,
    toggleMute,
    toggleCamera,
    toggleFullscreen,
    updatePreferences,
    likePartner,
    sendChatMessage,
    setTypingStatus,
    setChatOpen,
    sendReaction,
    isQueuePaused,
    pauseQueue,
    resumeQueue,
    broadcastSkipPending,
    broadcastSkipCancelled,
  } = useVideoChat(session?.sessionId ?? null, session?.sessionToken ?? null, triggerReaction);

  // V7: Trigger Match Reveal card on new match connection (reactively checks profile availability)
  useEffect(() => {
    if (chatState.status === 'CONNECTED' && chatState.partnerSessionId) {
      if (chatState.partnerProfile && chatState.partnerSessionId !== lastPartnerIdRef.current) {
        lastPartnerIdRef.current = chatState.partnerSessionId;
        setShowMatchIntro(true);
      }
    } else if (chatState.status !== 'CONNECTED' && !chatState.partnerSessionId) {
      lastPartnerIdRef.current = null;
      setShowMatchIntro(false);
    }
  }, [chatState.status, chatState.partnerSessionId, chatState.partnerProfile]);

  const [isSkipPending, setIsSkipPending] = useState(false);
  const [skipCountdown, setSkipCountdown] = useState(5);
  const skipTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startSkipCountdown = useCallback(() => {
    if (chatState.status !== 'CONNECTED') {
      handleNext();
      return;
    }

    setIsSkipPending(true);
    setSkipCountdown(5);
    broadcastSkipPending();

    if (skipTimerRef.current) clearInterval(skipTimerRef.current);
    skipTimerRef.current = setInterval(() => {
      setSkipCountdown((prev) => {
        if (prev <= 1) {
          if (skipTimerRef.current) clearInterval(skipTimerRef.current);
          setIsSkipPending(false);
          handleNext();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, [chatState.status, handleNext, broadcastSkipPending]);

  const cancelSkipCountdown = useCallback(() => {
    if (skipTimerRef.current) clearInterval(skipTimerRef.current);
    setIsSkipPending(false);
    broadcastSkipCancelled();
  }, [broadcastSkipCancelled]);

  const forceSkipImmediately = useCallback(() => {
    if (skipTimerRef.current) clearInterval(skipTimerRef.current);
    setIsSkipPending(false);
    handleNext();
  }, [handleNext]);

  useEffect(() => {
    return () => {
      if (skipTimerRef.current) clearInterval(skipTimerRef.current);
    };
  }, []);

  const prevPartnerSkipPendingRef = useRef(false);
  const [showResumedBanner, setShowResumedBanner] = useState(false);

  useEffect(() => {
    if (chatState.status === 'CONNECTED') {
      if (prevPartnerSkipPendingRef.current && !chatState.partnerSkipPending) {
        setShowResumedBanner(true);
        const timer = setTimeout(() => setShowResumedBanner(false), 3000);
        return () => clearTimeout(timer);
      }
    } else {
      setShowResumedBanner(false);
    }
    prevPartnerSkipPendingRef.current = chatState.partnerSkipPending || false;
  }, [chatState.partnerSkipPending, chatState.status]);

  const [goodbyePhase, setGoodbyePhase] = useState<'leaving' | 'cleaning' | 'goodbye' | null>(null);

  const blocker = useBlocker(
    ({ nextLocation }) =>
      chatState.status !== 'IDLE' &&
      chatState.status !== 'ENDED' &&
      !pendingLeaveRef.current &&
      nextLocation.pathname !== '/chat'
  );

  const handleConfirmBlockerLeave = useCallback(async () => {
    pendingLeaveRef.current = true;
    try {
      await stopChat();
      await endSession();
    } catch {}
    if (blocker.proceed) {
      blocker.proceed();
    }
  }, [stopChat, endSession, blocker]);

  useEffect(() => {
    return () => {
      console.log('[ChatPage] Component unmounting — cleaning up WebRTC and session tracks...');
      stopChat().catch((e) => console.warn('[ChatPage] Unmount stopChat failed:', e));
      endSession().catch((e) => console.warn('[ChatPage] Unmount endSession failed:', e));
    };
  }, [stopChat, endSession]);

  const isConnected = chatState.status === 'CONNECTED';
  const isSearching = chatState.status !== 'CONNECTED' && chatState.status !== 'IDLE' && chatState.status !== 'ENDED';

  // Central Responsive Layout Manager hooks
  const { 
    registerComponent, 
    getStyle, 
    controlsVisible, 
    resetInactivityTimeout, 
    setIsSearching, 
    setIsConnected, 
    videoLayout, 
    setVideoLayout 
  } = useFloatingLayout();

  // Sync connection state to global manager (Phase 2)
  useEffect(() => {
    setIsSearching(isSearching);
    setIsConnected(isConnected);
  }, [isSearching, isConnected, setIsSearching, setIsConnected]);

  // Layout switcher cycle function (Phase 4 & 5)
  const cycleLayout = useCallback(() => {
    const nextLayoutMap = { focus: 'split', split: 'pip', pip: 'focus' } as const;
    const next = nextLayoutMap[videoLayout];
    setVideoLayout(next);
    showToast('info', `Layout changed to ${next.toUpperCase()} Mode`);
  }, [videoLayout, setVideoLayout, showToast]);

  // Orientation and resize listener (Phase 4)
  const [isLandscape, setIsLandscape] = useState(window.innerWidth > window.innerHeight);
  useEffect(() => {
    const handleResize = () => {
      setIsLandscape(window.innerWidth > window.innerHeight);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Reset drag offset when layout becomes Focus Mode (Phase 4)
  useEffect(() => {
    if (videoLayout === 'focus') {
      setDragOffset({ x: 0, y: 0 });
    }
  }, [videoLayout]);

  // V6.12 Partner Card expand/collapse state & auto-fade timers
  const [isPartnerCardExpanded, setIsPartnerCardExpanded] = useState(false);
  const partnerCardTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const startPartnerCardTimer = useCallback(() => {
    if (partnerCardTimerRef.current) {
      clearTimeout(partnerCardTimerRef.current);
    }
    partnerCardTimerRef.current = setTimeout(() => {
      setIsPartnerCardExpanded(false);
    }, 5000); // 5 seconds auto-fade (Connected -> Show chips -> 5s -> name only)
  }, []);

  const handleTogglePartnerCard = useCallback(() => {
    setIsPartnerCardExpanded((prev) => {
      const next = !prev;
      if (next) {
        startPartnerCardTimer();
      } else {
        if (partnerCardTimerRef.current) {
          clearTimeout(partnerCardTimerRef.current);
          partnerCardTimerRef.current = null;
        }
      }
      return next;
    });
  }, [startPartnerCardTimer]);

  useEffect(() => {
    if (isConnected && chatState.partnerSessionId) {
      setIsPartnerCardExpanded(true);
      startPartnerCardTimer();
    } else {
      setIsPartnerCardExpanded(false);
      if (partnerCardTimerRef.current) {
        clearTimeout(partnerCardTimerRef.current);
        partnerCardTimerRef.current = null;
      }
    }
    return () => {
      if (partnerCardTimerRef.current) {
        clearTimeout(partnerCardTimerRef.current);
      }
    };
  }, [isConnected, chatState.partnerSessionId, startPartnerCardTimer]);

  // Register searching header indicator
  useEffect(() => {
    const zKey = isSearching ? 'toast' : 'statusBadges';
    registerComponent('searching-header', 'TL', 110, 32, isSearching, zKey, 1);
  }, [isSearching, registerComponent]);

  // Register self-preview PiP
  useEffect(() => {
    const showSelfPreview = isSearching || (isConnected && videoLayout !== 'split');
    const screenPos = isSearching ? 'TL' : (videoLayout === 'focus' ? 'TL' : (snapCorner.toUpperCase() as any));
    const pipW = isSearching ? 100 : (isMobile ? 146 : 185);
    const pipH = isSearching ? 100 : (isMobile ? 110 : 140);
    const priority = isSearching ? 2 : 1;
    const zKey = isSearching ? 'toast' : 'videoLocal';
    registerComponent('self-preview', screenPos, pipW, pipH, showSelfPreview, zKey, priority);
  }, [snapCorner, registerComponent, isSearching, isMobile, videoLayout, isConnected]);

  // Register queue card directly at top level
  useEffect(() => {
    registerComponent('queue-card', 'BC', isMobile ? 340 : 420, isMobile ? 220 : 280, isSearching, 'queueCard', 1);
  }, [isSearching, registerComponent, isMobile]);

  // Register partner info card (hidden in Split mode)
  const showPartnerCard = !!(isConnected && videoLayout !== 'split' && chatState.partnerProfile);
  useEffect(() => {
    registerComponent('partner-card', 'BL', 240, 160, showPartnerCard, 'partnerCard', 1);
  }, [showPartnerCard, registerComponent]);

  // Register temporary chat drawer
  const showChatDrawer = !!chatState.isChatOpen;
  useEffect(() => {
    registerComponent('chat-drawer', 'TR', 360, 400, showChatDrawer, 'chatDrawer', 1);
  }, [showChatDrawer, registerComponent]);

  // Search Elapsed timer state
  const [searchElapsed, setSearchElapsed] = useState(0);
  useEffect(() => {
    if (isSearching) {
      const timer = setInterval(() => {
        setSearchElapsed((prev) => prev + 1);
      }, 1000);
      return () => clearInterval(timer);
    } else {
      setSearchElapsed(0);
    }
  }, [isSearching]);

  // Fluctuate queue statistics during searching
  const [queueStats, setQueueStats] = useState({ online: 127, searching: 41, wait: 8 });
  useEffect(() => {
    if (isSearching) {
      const interval = setInterval(() => {
        setQueueStats((prev) => ({
          online: Math.max(90, Math.min(220, prev.online + Math.floor(Math.random() * 9) - 4)),
          searching: Math.max(15, Math.min(75, prev.searching + Math.floor(Math.random() * 7) - 3)),
          wait: Math.max(5, Math.min(15, prev.wait + Math.floor(Math.random() * 3) - 1))
        }));
      }, 4000);
      return () => clearInterval(interval);
    }
  }, [isSearching]);

  const activeMatchMode = localStorage.getItem('kaboom_match_mode') || 'RANDOM';





  const [remoteAspectRatio, setRemoteAspectRatio] = useState<number | null>(null);
  const [localAspectRatio, setLocalAspectRatio] = useState<number | null>(null);

  const mainAspectRatio = isPlacementsSwapped ? localAspectRatio : remoteAspectRatio;
  const pipAspectRatio = isPlacementsSwapped ? remoteAspectRatio : localAspectRatio;

  useEffect(() => {
    if (!isConnected) {
      setRemoteAspectRatio(null);
    }
  }, [isConnected]);

  const handleRemoteAspectRatioChange = useCallback((ratio: number) => {
    setRemoteAspectRatio(ratio);
  }, []);

  const handleLocalAspectRatioChange = useCallback((ratio: number) => {
    setLocalAspectRatio(ratio);
  }, []);

  const getRemoteContainerStyle = useCallback((): React.CSSProperties => {
    if (!isConnected) {
      // Searching state: remote video covers screen (globe or background animations)
      return {
        width: '100%',
        height: '100%',
        left: 0,
        top: 0,
        zIndex: 5,
      };
    }

    if (videoLayout === 'split') {
      if (isLandscape) {
        // Landscape Split Mode: Remote video occupies the right 50%
        return {
          width: '50%',
          height: '100%',
          left: '50%',
          top: 0,
          zIndex: 5,
        };
      } else {
        // Portrait Split Mode: Remote video occupies the top 50%
        return {
          width: '100%',
          height: '50%',
          left: 0,
          top: 0,
          zIndex: 5,
        };
      }
    }

    // Focus Mode and PiP Mode: Fullscreen/centered base style
    const ratio = mainAspectRatio;
    const baseStyles: React.CSSProperties = {
      position: 'absolute',
      left: '50%',
      top: '50%',
      transform: 'translate(-50%, -50%)',
      borderRadius: isMobile ? 0 : '24px',
      border: isMobile ? 'none' : '1.5px solid rgba(255, 255, 255, 0.08)',
      boxShadow: isMobile ? 'none' : '0 24px 64px rgba(0, 0, 0, 0.9)',
      zIndex: 5,
    };

    if (isMobile || chatState.isFullscreen) {
      return {
        width: '100%',
        height: '100%',
        left: 0,
        top: 0,
        transform: 'none',
        borderRadius: 0,
        border: 'none',
        zIndex: 5,
      };
    } else {
      if (ratio && ratio < 1) {
        return {
          ...baseStyles,
          height: '80vh',
          width: `calc(80vh * ${ratio})`,
          maxHeight: '90%',
          maxWidth: '90%',
        };
      }
      return {
        ...baseStyles,
        width: '80vw',
        height: ratio ? `calc(80vw / ${ratio})` : '80vh',
        maxHeight: '80vh',
        maxWidth: ratio ? `calc(80vh * ${ratio})` : '80vw',
      };
    }
  }, [isConnected, videoLayout, isLandscape, isMobile, chatState.isFullscreen, mainAspectRatio]);

  const getLocalContainerStyle = useCallback((): React.CSSProperties => {
    if (isSearching) {
      // Searching state style: floating preview at top-left
      return {
        width: '100px',
        height: '100px',
        left: '16px',
        top: '76px', // under header
        zIndex: 10,
      };
    }

    if (videoLayout === 'split') {
      if (isLandscape) {
        // Landscape Split Mode: Local video occupies the left 50%
        return {
          width: '50%',
          height: '100%',
          left: 0,
          top: 0,
          zIndex: 10,
        };
      } else {
        // Portrait Split Mode: Local video occupies the bottom 50%
        return {
          width: '100%',
          height: '50%',
          left: 0,
          top: '50%',
          zIndex: 10,
        };
      }
    }

    // Focus Mode and PiP Mode: floating window
    const pipW = isMobile ? 146 : 185;
    const pipH = isMobile ? 110 : 140;

    if (videoLayout === 'focus') {
      // Focus Mode: Docked fixed at top-left corner
      return {
        width: `${pipW}px`,
        height: `${pipH}px`,
        left: '16px',
        top: '76px', // docked under header area
        zIndex: 10,
        transform: 'none',
      };
    }

    // PiP Mode: Draggable snap position
    const layoutStyle = getStyle('self-preview');
    return {
      ...layoutStyle,
      width: `${pipW}px`,
      height: `${pipH}px`,
      zIndex: 10,
      transform: `translate(${dragOffset.x}px, ${dragOffset.y}px)`,
    };
  }, [isSearching, videoLayout, isLandscape, isMobile, dragOffset, getStyle]);

  const handleLike = useCallback(async () => {
    triggerReaction('❤️');
    sendReaction('❤️');
    await likePartner();
  }, [triggerReaction, likePartner, sendReaction]);

  const handleSendReaction = useCallback((emoji: string) => {
    triggerReaction(emoji);
    sendReaction(emoji);
  }, [triggerReaction, sendReaction]);

  const handleDisableStrict = useCallback(async () => {
    localStorage.setItem('kaboom_match_mode', 'PREFER');
    
    // Read local fields
    const savedGender = localStorage.getItem('kaboom_gender') || 'Prefer not to say';
    const savedLooking = JSON.parse(localStorage.getItem('kaboom_looking') || '["Anyone"]');
    const savedLangs = JSON.parse(localStorage.getItem('kaboom_languages') || '["English"]');
    const savedCountry = localStorage.getItem('kaboom_country') || '';
    const savedState = localStorage.getItem('kaboom_state') || '';
    const savedCity = localStorage.getItem('kaboom_city') || '';
    const savedInterests = JSON.parse(localStorage.getItem('kaboom_interest_tags') || '[]');
    const savedName = localStorage.getItem('kaboom_display_name') || 'Guest';
    const savedBio = localStorage.getItem('kaboom_bio') || '';
    const savedConstraints = JSON.parse(localStorage.getItem('kaboom_match_constraints') || '{}');
    const savedUni = localStorage.getItem('kaboom_university') || '';
    const savedEduTags = JSON.parse(localStorage.getItem('kaboom_education_tags') || '[]');

    await updatePreferences({
      gender: savedGender,
      looking_for: savedLooking,
      languages: savedLangs,
      country: savedCountry || null,
      state: savedState || null,
      city: savedCity || null,
      interest_tags: savedInterests,
      display_name: savedName,
      bio: savedBio || null,
      match_mode: 'PREFER',
      match_constraints: savedConstraints,
      match_attributes: {
        university: savedUni ? [savedUni] : [],
        education_tags: savedEduTags,
        city: savedCity ? [savedCity] : [],
        state: savedState ? [savedState] : [],
        country: savedCountry ? [savedCountry] : [],
        languages: savedLangs,
        interests: savedInterests
      }
    });

    showToast('success', 'Strict Matching disabled. Searching globally...');
  }, [updatePreferences, showToast]);

  // V5.1 Root Touch Gestures: Swipe Left to Next, Swipe Down to Leave
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);

  const handleTouchStartRoot = (e: React.TouchEvent) => {
    resetInactivityTimeout();
    const touch = e.touches[0];
    touchStartX.current = touch.clientX;
    touchStartY.current = touch.clientY;
  };

  const handleTouchEndRoot = (e: React.TouchEvent) => {
    if (touchStartX.current === null || touchStartY.current === null) return;
    const touch = e.changedTouches[0];
    const diffX = touch.clientX - touchStartX.current;
    const diffY = touch.clientY - touchStartY.current;

    if (Math.abs(diffX) > Math.abs(diffY)) {
      if (diffX < -90) {
        handleNext();
      }
    }

    touchStartX.current = null;
    touchStartY.current = null;
  };

  // Mutual Match Auto-Dismiss Logic
  useEffect(() => {
    if (chatState.mutualLike) {
      setShowMutualMatchPopup(true);
      const timer = setTimeout(() => {
        setShowMutualMatchPopup(false);
      }, 6000);
      return () => clearTimeout(timer);
    } else {
      setShowMutualMatchPopup(false);
    }
  }, [chatState.mutualLike]);

  // Trigger Heart Burst on Likes
  useEffect(() => {
    if (chatState.partnerLiked || chatState.mutualLike) {
      triggerReaction('❤️');
    }
  }, [chatState.partnerLiked, chatState.mutualLike, triggerReaction]);

  const handleDoubleTapSwap = () => {
    if (isSearching) return;
    setIsPlacementsSwapped((prev) => !prev);
  };

  // Draggable & Pinch Zoom handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (isSearching) return;
    setIsDragging(true);
    dragStart.current = { x: e.clientX - dragOffset.x, y: e.clientY - dragOffset.y };
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (isSearching) return;
    if (e.touches.length === 2) {
      setIsDragging(false);
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      touchStartDist.current = dist;
      initialPipScale.current = pipScale;
    } else {
      setIsDragging(true);
      const touch = e.touches[0];
      dragStart.current = { x: touch.clientX - dragOffset.x, y: touch.clientY - dragOffset.y };
    }
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      setDragOffset({
        x: e.clientX - dragStart.current.x,
        y: e.clientY - dragStart.current.y,
      });
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2 && touchStartDist.current) {
        if (e.cancelable) e.preventDefault();
        const dist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        const factor = dist / touchStartDist.current;
        const newScale = Math.min(Math.max(initialPipScale.current * factor, 0.6), 2.0);
        setPipScale(newScale);
      } else if (isDragging) {
        if (e.cancelable) e.preventDefault();
        const touch = e.touches[0];
        setDragOffset({
          x: touch.clientX - dragStart.current.x,
          y: touch.clientY - dragStart.current.y,
        });
      }
    };

    const handleMouseUp = () => {
      if (!isDragging) {
        setIsDragging(false);
        touchStartDist.current = null;
        return;
      }
      setIsDragging(false);
      touchStartDist.current = null;
      
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const baseWidth = vw < 640 ? vw * 0.28 : 200;
      const pipRatio = pipAspectRatio || 1.33;
      const pipW = baseWidth * pipScale;
      const pipH = (baseWidth / pipRatio) * pipScale;
      
      // Calculate absolute center position relative to active corner
      let currentX = 0;
      let currentY = 0;
      
      const safeBottom = isMobile ? 198 : 100;
      const safeTop = isMobile ? (72 + 54) : (72 + 16); // Account for header size
      
      if (snapCorner === 'br') {
        currentX = vw - 24 - pipW + dragOffset.x;
        currentY = vh - safeBottom - pipH + dragOffset.y;
      } else if (snapCorner === 'bl') {
        currentX = 24 + dragOffset.x;
        currentY = vh - safeBottom - pipH + dragOffset.y;
      } else if (snapCorner === 'tr') {
        currentX = vw - 24 - pipW + dragOffset.x;
        currentY = safeTop + dragOffset.y;
      } else if (snapCorner === 'tl') {
        currentX = 24 + dragOffset.x;
        currentY = safeTop + dragOffset.y;
      }
      
      const isLeft = currentX + pipW / 2 < vw / 2;
      const isTop = currentY + pipH / 2 < vh / 2;
      const finalCorner = isTop ? (isLeft ? 'tl' : 'tr') : (isLeft ? 'bl' : 'br');
      
      setSnapCorner(finalCorner);
      localStorage.setItem('pipPosition', finalCorner);
      setDragOffset({ x: 0, y: 0 });
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('touchmove', handleTouchMove, { passive: false });
    window.addEventListener('touchend', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleMouseUp);
    };
  }, [isDragging, dragOffset, pipScale]);

  // Session Initialization
  useEffect(() => {
    if (isLoading) return; // Wait until session restore loading finishes!
    if (session) return;
    if (showWelcomeGate) return; // Wait until they complete the profile setup!

    let cancelled = false;
    setInitializing(true);

    startSession()
      .catch((error) => {
        if (!cancelled) {
          showToast('error', error instanceof Error ? error.message : 'Failed to start session');
          navigate('/');
        }
      })
      .finally(() => {
        if (!cancelled) setInitializing(false);
      });

    return () => {
      cancelled = true;
    };
  }, [session, isLoading, startSession, showToast, navigate, showWelcomeGate]);

  useEffect(() => {
    if (!session || isLoading) return;

    const checkPermission = async () => {
      if (navigator.permissions && navigator.permissions.query) {
        try {
          const [camStatus, micStatus] = await Promise.all([
            navigator.permissions.query({ name: 'camera' as any }),
            navigator.permissions.query({ name: 'microphone' as any }),
          ]);
          if (camStatus.state === 'granted' && micStatus.state === 'granted') {
            setPermissionGranted(true);
            if (!chatStartedRef.current) {
              chatStartedRef.current = true;
              startChat();
            }
          } else {
            setPermissionGranted(false);
          }
        } catch {
          setPermissionGranted(false);
        }
      } else {
        setPermissionGranted(false);
      }
    };

    checkPermission();
  }, [session, isLoading, startChat]);

  const handleEnableMedia = async () => {
    try {
      setPermissionGranted(true);
      if (!chatStartedRef.current) {
        chatStartedRef.current = true;
        await startChat();
      }
    } catch (error) {
      setPermissionGranted(false);
      chatStartedRef.current = false;
    }
  };

  // Active match counter
  useEffect(() => {
    if (!chatState.matchStartTime || chatState.status !== 'CONNECTED') {
      setElapsedSeconds(0);
      return;
    }

    const interval = setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - chatState.matchStartTime!) / 1000));
    }, 1000);

    return () => clearInterval(interval);
  }, [chatState.matchStartTime, chatState.status]);

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') {
        return;
      }

      switch (e.key.toLowerCase()) {
        case ' ':
          e.preventDefault();
          toggleMute();
          break;
        case 'n':
          handleNext();
          break;
        case 'l':
          likePartner();
          break;
        case 'escape':
          setChatOpen(false);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggleMute, handleNext, likePartner, setChatOpen]);

  // Hint Engine Updates
  useEffect(() => {
    if (!session || chatState.status !== 'CONNECTED') {
      setActiveHint(null);
      return;
    }

    const showHint = () => {
      const hintState = {
        appState: chatState.status as any,
        micMuted: chatState.isMuted,
        cameraOff: chatState.isCameraOff,
        isMobile: isMobile, // uses consistent threshold from useResponsiveLayout (width < 768)
        waitingSeconds: 0,
        connectedSeconds: elapsedSeconds,
        hasExchangedMessages: (chatState.messages?.length ?? 0) > 0,
        hasLiked: chatState.liked || false,
        partnerLiked: chatState.partnerLiked || false,
      };

      const showTips = localStorage.getItem('kaboom_show_tips') !== 'false';
      if (!showTips) return;

      const hint = hintEngine.getHint(hintState);
      if (hint) {
        setActiveHint(hint);
        setHintDismissed(false);
        
        if (hintHideTimerRef.current) clearTimeout(hintHideTimerRef.current);
        hintHideTimerRef.current = setTimeout(() => {
          setActiveHint(null);
        }, 4000);
      }
    };

    const initialTimer = setTimeout(showHint, 10000);
    const interval = setInterval(showHint, 30000);

    return () => {
      clearTimeout(initialTimer);
      clearInterval(interval);
      if (hintHideTimerRef.current) clearTimeout(hintHideTimerRef.current);
    };
  }, [chatState.status, chatState.isMuted, chatState.isCameraOff, chatState.liked, chatState.messages, elapsedSeconds, session]);

  const handleDismissHint = () => {
    setHintDismissed(true);
    if (activeHint?.includes('settings')) {
      hintEngine.dismissOneTimeHint('settings_onboarding');
    } else if (activeHint?.includes('filters')) {
      hintEngine.dismissOneTimeHint('filters_onboarding');
    } else if (activeHint?.includes('rotate')) {
      hintEngine.dismissOneTimeHint('mobile_rotate');
    } else if (activeHint?.includes('double-click')) {
      hintEngine.dismissOneTimeHint('desktop_fullscreen');
    }
  };

  const getActiveFilters = () => {
    const list: string[] = [];
    const uni = localStorage.getItem('kaboom_university');
    if (uni) list.push(`🎓 ${uni}`);

    const city = localStorage.getItem('kaboom_city');
    if (city) list.push(`📍 ${city}`);

    const country = localStorage.getItem('kaboom_country');
    if (country) list.push(`🌍 ${country}`);

    try {
      const interests = JSON.parse(localStorage.getItem('kaboom_interest_tags') || '[]');
      interests.forEach((item: string) => list.push(`🎵 ${item}`));
    } catch {}

    try {
      const langs = JSON.parse(localStorage.getItem('kaboom_languages') || '[]');
      langs.forEach((item: string) => list.push(`💬 ${item}`));
    } catch {}

    return list;
  };

  const leaveCurrentExperience = useCallback(async () => {
    pendingLeaveRef.current = true;
    try {
      setGoodbyePhase('leaving');
      await stopChat();
      await new Promise(r => setTimeout(r, 100));
      setGoodbyePhase('cleaning');
      await endSession();
      setGoodbyePhase('goodbye');
      await new Promise(r => setTimeout(r, 150));
    } catch (e) {
      console.warn('Error during exit cleanup:', e);
    } finally {
      localStorage.removeItem('kaboom_session_restored');
      setElapsedSeconds(0);
      setGoodbyePhase(null);
      pendingLeaveRef.current = false;
      navigate('/');
      showToast('info', 'You left the chat');
    }
  }, [stopChat, endSession, navigate, showToast]);

  const handleLeave = async () => {
    if (chatState.status === 'CONNECTED' || chatState.partnerSessionId) {
      setShowEndCallConfirm(true);
    } else {
      await leaveCurrentExperience();
    }
  };

  const handleReport = async (reason: ReportReason, notes: string) => {
    if (!session || !chatState.partnerSessionId) {
      showToast('error', 'No partner to report');
      return;
    }

    try {
      await apiService.submitReport(
        session.sessionId,
        chatState.partnerSessionId,
        reason,
        notes || undefined
      );
      showToast('success', 'Report submitted. Thank you for keeping the community safe.');
      handleNext();
    } catch (error) {
      showToast('error', error instanceof Error ? error.message : 'Failed to submit report');
    }
  };

  if (!session || initializing || isLoading) {
    return <LoadingScreen message="Setting up your chat..." />;
  }

  if (permissionGranted === false) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-stone-950 p-6 relative overflow-hidden select-none">
        <div className="absolute w-[500px] h-[500px] rounded-full bg-amber-500/5 blur-[120px] pointer-events-none -translate-x-1/2 -translate-y-1/2 left-1/2 top-1/3" />
        
        <div className="max-w-md w-full relative z-10 p-8 rounded-3xl border border-white/5 bg-white/[0.01] shadow-2xl backdrop-blur-md text-center flex flex-col items-center glass">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-3xl mb-6 shadow-inner animate-pulse">
            🎥
          </div>
          
          <h2 className="text-2xl font-bold tracking-tight text-stone-100 mb-3">
            Camera & Mic Permission
          </h2>
          
          <p className="text-stone-400 text-sm leading-relaxed mb-8">
            Kaboom TV connects you with random peers via real-time video. We require camera and microphone access to enable video chat. Your stream is completely peer-to-peer and never saved.
          </p>

          <button
            onClick={handleEnableMedia}
            className="w-full relative group animate-fade-in"
          >
            <div className="absolute -inset-0.5 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 opacity-60 blur-sm group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
            <div className="relative text-sm px-6 py-3.5 bg-stone-900 border border-amber-500/30 text-stone-100 font-bold rounded-2xl hover:scale-[1.02] active:scale-[0.98] transition-all duration-300 flex items-center justify-center gap-2">
              <span>Allow Media Access</span>
              <svg className="w-4 h-4 text-amber-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </button>
        </div>
      </div>
    );
  }


  return (
    /* Root: fills entire 100dvh viewport (set by layout-immersive on parent) */
    <div
      className="absolute inset-0 bg-black overflow-hidden select-none"
      onMouseMove={resetInactivityTimeout}
      onTouchStart={handleTouchStartRoot}
      onTouchEnd={handleTouchEndRoot}
      role="main"
      aria-label="Video chat"
    >
      <MetaManager page="chat" />
      <TipEngine />

      {/* ── VIDEO SCENE (Unified layouts: Focus, Split, PiP) ── */}
      {isMobile ? (
        <GestureLayer
          onSwipeLeft={startSkipCountdown}
          disabled={chatState.isChatOpen || isDragging}
        >
          <div className="absolute inset-0 z-0 bg-stone-950 overflow-hidden">
            {/* Remote Video Container */}
            <div
              className={cn(
                "absolute transition-all duration-[350ms] ease-out overflow-hidden bg-black",
                videoLayout === 'split' ? "border border-white/5" : ""
              )}
              style={getRemoteContainerStyle()}
            >
              <VideoPlayer
                stream={isPlacementsSwapped ? localStream : remoteStream}
                mirrored={isPlacementsSwapped}
                muted={isPlacementsSwapped}
                fullscreen={videoLayout === 'split' || isMobile || chatState.isFullscreen}
                onAspectRatioChange={isPlacementsSwapped ? handleLocalAspectRatioChange : handleRemoteAspectRatioChange}
                placeholder={isSearching ? 'Looking for a partner...' : 'Partner video will appear here'}
                frozen={isPlacementsSwapped ? isSkipPending : false}
              />
            </div>

            {/* Local Video (Self Preview) Container */}
            <div
              onMouseDown={handleMouseDown}
              onTouchStart={handleTouchStart}
              onDoubleClick={handleDoubleTapSwap}
              className={cn(
                "absolute transition-all duration-[350ms] ease-out overflow-hidden bg-black",
                videoLayout === 'split' ? "border border-white/5" : "rounded-2xl border border-white/10 shadow-2xl",
                isDragging && 'shadow-2xl border-amber-500/30 scale-[1.03]',
                (!controlsVisible && videoLayout !== 'split') && 'border-transparent shadow-none'
              )}
              style={getLocalContainerStyle()}
            >
              <VideoPlayer
                stream={isPlacementsSwapped ? remoteStream : localStream}
                muted={!isPlacementsSwapped}
                mirrored={!isPlacementsSwapped}
                onAspectRatioChange={isPlacementsSwapped ? handleRemoteAspectRatioChange : handleLocalAspectRatioChange}
                className="w-full h-full pointer-events-none"
                fullscreen={isSearching || isPlacementsSwapped || videoLayout === 'split'}
                label={
                  isPlacementsSwapped 
                    ? (chatState.partnerProfile?.displayName || 'Partner') 
                    : isSearching 
                      ? (localStorage.getItem('kaboom_display_name')?.split(' ')[0] || 'You')
                      : undefined
                }
                frozen={isPlacementsSwapped ? false : isSkipPending}
              />
            </div>
          </div>
        </GestureLayer>
      ) : (
        <div className="absolute inset-0 z-0 bg-stone-950 overflow-hidden">
          {/* Remote Video Container */}
          <div
            className={cn(
              "absolute transition-all duration-[350ms] ease-out overflow-hidden bg-black",
              videoLayout === 'split' ? "border border-white/5" : ""
            )}
            style={getRemoteContainerStyle()}
          >
            <VideoPlayer
              stream={isPlacementsSwapped ? localStream : remoteStream}
              mirrored={isPlacementsSwapped}
              muted={isPlacementsSwapped}
              fullscreen={videoLayout === 'split' || isMobile || chatState.isFullscreen}
              onAspectRatioChange={isPlacementsSwapped ? handleLocalAspectRatioChange : handleRemoteAspectRatioChange}
              placeholder={isSearching ? 'Looking for a partner...' : 'Partner video will appear here'}
              frozen={isPlacementsSwapped ? isSkipPending : false}
            />
          </div>

          {/* Local Video (Self Preview) Container */}
          <div
            onMouseDown={handleMouseDown}
            onTouchStart={handleTouchStart}
            onDoubleClick={handleDoubleTapSwap}
            className={cn(
              "absolute transition-all duration-[350ms] ease-out overflow-hidden bg-black",
              videoLayout === 'split' ? "border border-white/5" : "rounded-2xl border border-white/10 shadow-2xl",
              isDragging && 'shadow-2xl border-amber-500/30 scale-[1.03]',
              (!controlsVisible && videoLayout !== 'split') && 'border-transparent shadow-none'
            )}
            style={getLocalContainerStyle()}
          >
            <VideoPlayer
              stream={isPlacementsSwapped ? remoteStream : localStream}
              muted={!isPlacementsSwapped}
              mirrored={!isPlacementsSwapped}
              onAspectRatioChange={isPlacementsSwapped ? handleRemoteAspectRatioChange : handleLocalAspectRatioChange}
              className="w-full h-full pointer-events-none"
              fullscreen={isSearching || isPlacementsSwapped || videoLayout === 'split'}
              label={
                isPlacementsSwapped 
                  ? (chatState.partnerProfile?.displayName || 'Partner') 
                  : isSearching 
                    ? (localStorage.getItem('kaboom_display_name')?.split(' ')[0] || 'You')
                    : undefined
              }
              frozen={isPlacementsSwapped ? false : isSkipPending}
            />
          </div>
        </div>
      )}

      {/* Partner Skip Pending status banner */}
      {chatState.partnerSkipPending && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 bg-amber-500/90 backdrop-blur-md text-stone-950 px-4 py-2 rounded-full font-semibold text-xs shadow-lg animate-pulse flex items-center gap-2 z-30 border border-amber-400">
          <span className="w-2 h-2 rounded-full bg-stone-950 animate-ping" />
          Partner is deciding whether to continue...
        </div>
      )}

      {/* Conversation Resumed status banner */}
      {showResumedBanner && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 bg-emerald-500/90 backdrop-blur-md text-white px-4 py-2 rounded-full font-semibold text-xs shadow-lg animate-bounce flex items-center gap-2 z-30 border border-emerald-400">
          <span className="w-2 h-2 rounded-full bg-white" />
          Conversation resumed.
        </div>
      )}

      {/* V6.12 — Floating glass chips (conversation-first, replaces partner card rectangle) */}
      {showPartnerCard && chatState.partnerProfile && (
        <div
          className="absolute flex flex-col items-start gap-[8px] pointer-events-auto select-none transition-all duration-300 z-30"
          style={{ 
            ...getStyle('partner-card'),
            opacity: controlsVisible ? 1 : 0.4
          }}
        >
          {/* Name chip — always visible, tap to expand/collapse tags */}
          <button
            onClick={handleTogglePartnerCard}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-white/10 bg-black/45 backdrop-blur-[12px] shadow-[0_2px_16px_rgba(0,0,0,0.45)] text-stone-100 text-[11px] font-bold leading-none hover:bg-black/60 transition-colors"
            aria-label="Toggle partner info"
          >
            👤 {chatState.partnerProfile.displayName || 'Guest'}
          </button>

          {/* Tag chips — visible when expanded */}
          <div
            className={`flex flex-col items-start gap-[8px] transition-all duration-500 ease-out ${
              isPartnerCardExpanded
                ? 'opacity-100 translate-y-0 pointer-events-auto'
                : 'opacity-0 -translate-y-1 pointer-events-none'
            }`}
          >
            {chatState.partnerProfile?.bio && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full border border-white/10 bg-white/8 backdrop-blur-[12px] shadow-[0_2px_12px_rgba(0,0,0,0.35)] text-stone-300 text-[10px] font-medium leading-none max-w-[160px]">
                <span className="truncate">{chatState.partnerProfile.bio.slice(0, 22)}{chatState.partnerProfile.bio.length > 22 ? '…' : ''}</span>
              </span>
            )}

            {/* Match reason chips — max 3 */}
            {(() => {
              const reasons = chatState.matchReasonMetadata?.matchedBy ?? [];
              const university = chatState.partnerProfile?.matchAttributes?.university?.[0] || (chatState.partnerProfile as any)?.university || '';
              const allTags = [...reasons, ...(university ? [`🎓 ${university}`] : [])];
              const visible = allTags.slice(0, 3);
              const overflow = allTags.length - 3;
              return (
                <>
                  {visible.map((tag, i) => (
                    <span
                      key={i}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full border border-amber-500/20 bg-amber-500/10 backdrop-blur-[12px] shadow-[0_2px_12px_rgba(0,0,0,0.35)] text-amber-300 text-[10px] font-bold leading-none"
                    >
                      🏷 {tag}
                    </span>
                  ))}
                  {overflow > 0 && (
                    <span className="inline-flex items-center px-2 py-1 rounded-full border border-white/10 bg-white/5 backdrop-blur-[12px] text-stone-400 text-[10px] font-bold leading-none">
                      +{overflow}
                    </span>
                  )}
                </>
              );
            })()}
          </div>
        </div>
      )}

      {/* ── LAYER 2: Gradient overlay ─────────────────────── */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          zIndex: 'var(--z-overlay)' as any,
          background: 'linear-gradient(to bottom, rgba(0,0,0,0.35) 0%, transparent 30%, transparent 65%, rgba(0,0,0,0.6) 100%)',
        }}
      />

      {/* ── SEARCHING HEADER INDICATOR PILL (Top-Left Stacked) ── */}
      {isSearching && (
        <div
          style={getStyle('searching-header')}
          className="flex items-center gap-2 px-3.5 py-1.5 bg-stone-900/80 border border-white/10 rounded-full shadow-lg backdrop-blur-md pointer-events-auto"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
          <span className="text-[10px] font-black text-amber-400 uppercase tracking-widest">Searching</span>
        </div>
      )}

      {/* ── BACKGROUND & SEARCHING LAYERS (Globe, Radar, Status) ── */}
      {isSearching && (
        <SearchingAnimation
          status={chatState.status}
          partnerProfile={chatState.partnerProfile}
          isQueuePaused={isQueuePaused}
        />
      )}

      {/* ── QUEUE LAYER (QueueCard Controls Dashboard) ── */}
      {isSearching && (
        <div 
          className="pointer-events-auto"
          style={getStyle('queue-card')}
          data-layout-id="queue-card"
        >
          <QueueCard
            elapsed={searchElapsed}
            matchMode={activeMatchMode}
            isQueuePaused={isQueuePaused}
            onOpenPreferences={async () => {
              await pauseQueue();
              setShowPreferenceModal(true);
            }}
            onResumeQueue={resumeQueue}
            onPauseQueue={pauseQueue}
            onLeaveQueue={handleLeave}
            stats={queueStats}
            onDisableStrict={handleDisableStrict}
          />
        </div>
      )}

      {/* ── MOBILE HEADER (top layout) ── */}
      {isMobile ? (
        <MobileHeader
          elapsedSeconds={elapsedSeconds}
          connectionStatus={chatState.connectionStatus}
          connectionQuality={chatState.connectionQuality ?? null}
          isConnected={isConnected}
          onLeave={handleLeave}
          controlsVisible={controlsVisible}
        />
      ) : (
        /* ── DESKTOP STATUS BAR (top-left, below header) ── */
        <div
          className={cn(
            "absolute left-4 flex items-center gap-3 transition-all duration-300",
            !controlsVisible && "opacity-0 -translate-y-2 pointer-events-none"
          )}
          style={{
            top: 'calc(var(--header-h) + 12px)',
            zIndex: 'var(--z-controls)' as any,
          }}
        >
          {!isConnected && <ConnectionStatusBadge status={chatState.connectionStatus} />}
          {isConnected && (
            <span className="flex items-center gap-2 px-3 py-1 bg-black/40 backdrop-blur-md rounded-full border border-white/10 text-sm text-white/80 font-mono tracking-wider shadow-lg">
              <span className={cn(
                "w-1.5 h-1.5 rounded-full",
                chatState.connectionQuality === 'excellent' ? "bg-emerald-500 animate-pulse" :
                chatState.connectionQuality === 'good' ? "bg-amber-500 animate-pulse" : "bg-red-500 animate-ping"
              )} />
              {formatDuration(elapsedSeconds)}
            </span>
          )}
        </div>
      )}

      {/* ── COACH MARK (hint) — always below header ────────── */}
      {activeHint && !hintDismissed && (
        <div
          className="coach-mark coach-mark--center cursor-pointer hover:bg-white/10 transition-colors"
          style={{
            top: isMobile ? 'calc(var(--header-h) + 54px)' : 'calc(var(--header-h) + 12px)',
          }}
          onClick={handleDismissHint}
          role="status"
          aria-live="polite"
        >
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm leading-snug">{activeHint}</span>
            <button className="text-[11px] text-white/40 hover:text-white/70 shrink-0 transition-colors">
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* ── CONTROLS DOCK ─────────────────────────────────── */}
      <div 
        className={cn(
          "transition-all duration-300 pointer-events-auto",
          !controlsVisible && "opacity-0 scale-95 pointer-events-none"
        )}
        style={getStyle('controls-dock')}
      >
        <AdaptiveControlsDock
          isMuted={chatState.isMuted}
          isCameraOff={chatState.isCameraOff}
          isFullscreen={chatState.isFullscreen}
          onToggleMute={toggleMute}
          onToggleCamera={toggleCamera}
          onNext={startSkipCountdown}
          onReport={() => setShowReportModal(true)}
          onLeave={handleLeave}
          onToggleFullscreen={toggleFullscreen}
          disabled={isSearching}
          isChatOpen={chatState.isChatOpen}
          onToggleChat={() => setChatOpen(!chatState.isChatOpen)}
          liked={chatState.liked}
          onLike={handleLike}
          onOpenPreferences={async () => {
            await pauseQueue();
            setShowPreferenceModal(true);
          }}
          unreadCount={chatState.unreadCount}
          videoLayout={videoLayout}
          onCycleLayout={cycleLayout}
        />
      </div>

      {/* ── FLOATING CHAT OVERLAY ─────────────────────────── */}
      <TemporaryChat
        isOpen={chatState.isChatOpen || false}
        onClose={() => setChatOpen(false)}
        messages={chatState.messages || []}
        onSendMessage={sendChatMessage}
        selfSessionId={session.sessionId}
        partnerTyping={chatState.partnerTyping || false}
        onTyping={setTypingStatus}
        partnerProfile={chatState.partnerProfile}
        matchReasonMetadata={chatState.matchReasonMetadata}
      />

      {/* ── PREFERENCES MODAL ─────────────────────────────── */}
      {/* ── PREFERENCES MODAL ─────────────────────────────── */}
      {showWelcomeGate && (
        <OnboardingModal
          onSave={async (prefs) => {
            await updatePreferences(prefs);
            setShowWelcomeGate(false);
          }}
          onClose={() => navigate('/')}
        />
      )}

      <PreferenceModal
        isOpen={showPreferenceModal && !showWelcomeGate}
        onClose={async () => {
          setShowPreferenceModal(false);
          await resumeQueue();
        }}
        onSave={async (prefs) => {
          await updatePreferences(prefs);
          setShowPreferenceModal(false);
          await resumeQueue();
        }}
        currentPreferences={{
          gender: chatState.gender,
          looking_for: chatState.lookingFor,
          languages: chatState.languages,
          country: chatState.country,
          state: chatState.state,
          district: chatState.district,
          city: chatState.city,
          interest_tags: chatState.interestTags,
          display_name: localStorage.getItem('kaboom_display_name') || '',
          bio: localStorage.getItem('kaboom_bio') || '',
          match_mode: localStorage.getItem('kaboom_match_mode') || 'RANDOM',
          match_constraints: (() => {
            try {
              return JSON.parse(localStorage.getItem('kaboom_match_constraints') || '{}');
            } catch {
              return {};
            }
          })(),
          match_attributes: {
            university: localStorage.getItem('kaboom_university') ? [localStorage.getItem('kaboom_university') || ''] : [],
            education_tags: (() => {
              try {
                return JSON.parse(localStorage.getItem('kaboom_education_tags') || '[]');
              } catch {
                return [];
              }
            })(),
            city: chatState.city ? [chatState.city] : [],
            state: chatState.state ? [chatState.state] : [],
            country: chatState.country ? [chatState.country] : [],
            languages: chatState.languages || [],
            interests: chatState.interestTags || []
          }
        }}
      />

      {/* ── MATCH INTRO REVEAL ────────────────────────────── */}
      {showMatchIntro && chatState.partnerProfile && (
        <MatchIntroCard
          partnerProfile={chatState.partnerProfile}
          matchReasonMetadata={chatState.matchReasonMetadata}
          status={chatState.status}
          isChatOpen={chatState.isChatOpen || false}
          onDismiss={() => setShowMatchIntro(false)}
        />
      )}

      {/* ── MUTUAL MATCH OVERLAY ──────────────────────────── */}
      {showMutualMatchPopup && (
        <div
          className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 backdrop-blur-2xl animate-fade-in"
          style={{ zIndex: 'var(--z-confetti)' as any }}
        >
          <div className="p-8 bg-surface-2 border border-white/10 rounded-3xl text-center shadow-2xl max-w-sm animate-spring-in glass relative overflow-hidden">
            <span className="text-6xl animate-bounce block">🎉</span>
            <span className="text-4xl animate-pulse block mt-2">❤️</span>
            <h3 className="text-2xl font-bold text-white mt-4 bg-gradient-to-r from-accent to-pink-500 bg-clip-text text-transparent">Mutual Match!</h3>
            <p className="text-sm text-white/70 mt-2">Both of you liked each other! Start chatting.</p>
            <div className="flex gap-3 justify-center mt-6">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowMutualMatchPopup(false);
                  setChatOpen(true);
                }}
                className="btn-primary text-sm px-6 py-2.5"
              >
                Start Chatting
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowMutualMatchPopup(false);
                }}
                className="btn-secondary text-sm px-4 py-2.5"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── FLOATING REACTION HUB ─────────────────────────── */}
      {isConnected && (
        <div 
          className="absolute right-5 flex items-center justify-center select-none"
          style={{ 
            zIndex: 'var(--z-controls)' as any,
            bottom: isMobile ? 'calc(env(safe-area-inset-bottom) + 400px)' : '360px'
          }}
        >
          {/* Radial Expansion Emojis */}
          {['🔥', '😂', '🎉', '😍', '👍', '😮'].map((emoji, idx) => {
            const N = 6;
            const startAngle = 100;
            const endAngle = 260;
            const angleStep = (endAngle - startAngle) / (N - 1);
            const theta = startAngle + idx * angleStep;
            const rad = (theta * Math.PI) / 180;
            const distance = 84; // Radius of menu arc
            
            const x = Math.cos(rad) * distance;
            const y = -Math.sin(rad) * distance;

            return (
              <button
                key={emoji}
                onClick={() => {
                  handleSendReaction(emoji);
                  setShowReactionHub(false);
                }}
                className={cn(
                  "absolute w-12 h-12 rounded-full bg-black/60 backdrop-blur-xl border border-white/10 flex items-center justify-center text-xl shadow-lg transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] cursor-pointer hover:scale-125 active:scale-90 hover:bg-black/80 hover:border-amber-400/40",
                  showReactionHub 
                    ? "opacity-100 scale-100 pointer-events-auto" 
                    : "opacity-0 scale-0 pointer-events-none"
                )}
                style={{
                  transform: showReactionHub ? `translate(${x}px, ${y}px)` : 'translate(0px, 0px)',
                  transitionDelay: showReactionHub ? `${idx * 30}ms` : '0ms'
                }}
              >
                {emoji}
              </button>
            );
          })}

          {/* Main Toggle Reaction Hub Button */}
          <button
            onClick={() => {
              playTapSound();
              setShowReactionHub(!showReactionHub);
            }}
            className={cn(
              "w-16 h-16 rounded-full flex items-center justify-center text-2xl shadow-xl transition-all duration-300 active:scale-95 bg-black/40 backdrop-blur-xl border border-white/10",
              showReactionHub 
                ? "border-amber-400 shadow-amber-500/20 scale-105" 
                : "shadow-black/40 hover:scale-105 hover:bg-white/10"
            )}
            style={{
              boxShadow: '0 0 24px rgba(245, 158, 11, 0.15), inset 0 0 12px rgba(255, 255, 255, 0.05)'
            }}
            aria-label="Toggle emoji reactions panel"
          >
            😊
          </button>
        </div>
      )}

      {/* ── FLOATING REACTION EMITTER ─────────────────────── */}
      {reactions.map((r) => (
        <span
          key={r.id}
          className="floating-heart"
          style={{
            left: `${r.left}%`,
            animationDelay: `${r.delay}s`
          }}
        >
          {r.emoji}
        </span>
      ))}

      {/* ── MODALS ────────────────────────────────────────── */}
      <ReportModal
        isOpen={showReportModal}
        onClose={() => setShowReportModal(false)}
        onSubmit={handleReport}
      />
      {/* ── QUEUE RESUME CARD ───────────────────────────── */}
      {showResumeQueueCard && (
        <div 
          className="absolute inset-0 flex items-center justify-center bg-black/85 backdrop-blur-3xl p-6 text-center animate-fade-in animate-fade-in"
          style={{ zIndex: 'calc(var(--z-overlay) + 10)' as any }}
        >
          <div className="max-w-md w-full bg-stone-900/90 border border-white/10 rounded-3xl p-6 md:p-8 shadow-2xl space-y-6 glass text-left relative animate-spring-in">
            <div className="flex items-center gap-3 border-b border-white/5 pb-4">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-xl">
                🔄
              </div>
              <div>
                <h3 className="text-lg font-black text-white">Search Restored</h3>
                <p className="text-xs text-stone-400">Previous matchmaking session resumed</p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <span className="text-[10px] text-stone-500 font-bold uppercase tracking-wider block mb-1">Searching As</span>
                <span className="text-base font-black text-white">
                  {localStorage.getItem('kaboom_display_name') || 'Guest'}
                </span>
              </div>

              <div>
                <span className="text-[10px] text-stone-500 font-bold uppercase tracking-wider block mb-1">Mode</span>
                <span className="text-xs px-2.5 py-1 rounded bg-amber-500/10 border border-amber-500/20 text-amber-400 font-bold">
                  {(() => {
                    const m = localStorage.getItem('kaboom_match_mode') || 'RANDOM';
                    return m === 'STRICT' ? 'Exact Match' : m === 'SMART' ? 'Smart Match' : 'Random Match';
                  })()}
                </span>
              </div>

              <div>
                <span className="text-[10px] text-stone-500 font-bold uppercase tracking-wider block mb-2">Active Filters</span>
                {getActiveFilters().length > 0 ? (
                  <div className="flex flex-wrap gap-2 max-h-[140px] overflow-y-auto pr-1">
                    {getActiveFilters().map((filter, idx) => (
                      <span key={idx} className="text-xs px-3 py-1 rounded-full bg-white/5 border border-white/10 text-stone-200 font-medium">
                        {filter}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-stone-500 italic">No search filters active. Matching anyone!</p>
                )}
              </div>
            </div>

            <div className="pt-2 flex flex-col gap-2">
              <button
                onClick={() => {
                  localStorage.removeItem('kaboom_session_restored');
                  setShowResumeQueueCard(false);
                  showToast('success', 'Resumed searching');
                }}
                className="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-600 text-stone-950 font-black text-sm transition-all active:scale-95 text-center shadow-lg shadow-amber-500/10"
              >
                Continue Searching
              </button>
              <button
                onClick={async () => {
                  localStorage.removeItem('kaboom_session_restored');
                  setShowResumeQueueCard(false);
                  await pauseQueue();
                  setShowPreferenceModal(true);
                }}
                className="w-full py-3 rounded-xl bg-white/5 hover:bg-white/10 text-white font-bold text-sm border border-white/10 transition-all active:scale-95 text-center"
              >
                Edit Filters
              </button>
              <button
                onClick={async () => {
                  localStorage.removeItem('kaboom_session_restored');
                  setShowResumeQueueCard(false);
                  await leaveCurrentExperience();
                }}
                className="w-full py-3 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 font-bold text-sm border border-red-500/25 transition-all active:scale-95 text-center"
              >
                Leave Queue
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── END CALL CONFIRMATION DIALOG ───────────────── */}
      {showEndCallConfirm && (
        <div 
          className="absolute inset-0 flex items-center justify-center bg-black/80 backdrop-blur-md p-6 text-center animate-fade-in"
          style={{ zIndex: 'calc(var(--z-overlay) + 20)' as any }}
        >
          <div className="max-w-xs w-full bg-stone-900 border border-white/10 rounded-3xl p-6 shadow-2xl space-y-6 text-center animate-spring-in">
            <div className="space-y-2">
              <div className="w-12 h-12 rounded-full bg-red-500/10 border border-red-500/20 text-red-500 flex items-center justify-center text-xl mx-auto">
                📞
              </div>
              <h3 className="text-lg font-black text-white">Leave Conversation?</h3>
              <p className="text-stone-400 text-xs leading-relaxed">
                You will leave this chat and return to the home screen.
              </p>
            </div>

            <div className="flex flex-col gap-2 pt-2">
              <button
                onClick={async () => {
                  setShowEndCallConfirm(false);
                  await leaveCurrentExperience();
                }}
                className="w-full py-3 rounded-xl bg-red-600 hover:bg-red-500 text-white font-black text-xs transition-all active:scale-95"
              >
                End Call
              </button>
              <button
                onClick={() => setShowEndCallConfirm(false)}
                className="w-full py-3 rounded-xl bg-white/5 hover:bg-white/10 text-white font-bold text-xs border border-white/10 transition-all active:scale-95"
              >
                Stay
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── SAFE SKIP FLOW OVERLAY ───────────────────────── */}
      {isSkipPending && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 backdrop-blur-md animate-fade-in z-50 p-6 text-center">
          <div className="max-w-xs w-full bg-stone-900 border border-white/10 rounded-3xl p-6 shadow-2xl space-y-6">
            <div className="space-y-2">
              <h3 className="text-xl font-bold text-white">Switching to next person?</h3>
              <p className="text-stone-400 text-sm">Conversation will disconnect in</p>
            </div>
            
            <div className="relative w-24 h-24 mx-auto flex items-center justify-center">
              <svg className="absolute inset-0 w-full h-full transform -rotate-90">
                <circle
                  cx="48"
                  cy="48"
                  r="40"
                  stroke="rgba(255,255,255,0.1)"
                  strokeWidth="6"
                  fill="transparent"
                />
                <circle
                  cx="48"
                  cy="48"
                  r="40"
                  stroke="#f59e0b"
                  strokeWidth="6"
                  fill="transparent"
                  strokeDasharray="251.2"
                  strokeDashoffset={251.2 - (251.2 * skipCountdown) / 5}
                  className="transition-all duration-1000 ease-linear"
                />
              </svg>
              <span className="text-4xl font-extrabold text-amber-500">{skipCountdown}</span>
            </div>

            <div className="flex flex-col gap-2">
              <button
                onClick={cancelSkipCountdown}
                className="w-full py-3 rounded-xl bg-white/10 hover:bg-white/15 text-white font-medium text-sm transition-all active:scale-95"
              >
                Continue Conversation
              </button>
              <button
                onClick={forceSkipImmediately}
                className="w-full py-3 rounded-xl bg-red-500/20 hover:bg-red-500/30 text-red-200 font-semibold text-sm transition-all border border-red-500/30 active:scale-95"
              >
                Skip Now
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── ONBOARDING TUTORIAL WIZARD ───────────────────── */}
      {showTutorial && (
        <TutorialOverlay onClose={() => setShowTutorial(false)} />
      )}



      {/* ── RECONNECTING GRACE PERIOD OVERLAY ───────────── */}
      {chatState.connectionStatus === 'reconnecting' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/85 backdrop-blur-md z-45 p-6 text-center animate-fade-in">
          <div className="space-y-4 max-w-xs w-full bg-stone-900 border border-white/10 rounded-3xl p-6 shadow-2xl">
            <div className="w-12 h-12 rounded-full border border-amber-500/30 bg-amber-500/10 flex items-center justify-center text-xl mx-auto animate-spin">
              🌀
            </div>
            <h3 className="text-lg font-bold text-white">Partner disconnected</h3>
            <p className="text-xs text-stone-400 leading-relaxed">
              Connection lost. Reconnecting in{' '}
              <span className="text-amber-500 font-black text-sm">
                {chatState.reconnectCountdown !== undefined && chatState.reconnectCountdown !== null ? chatState.reconnectCountdown : 10}
              </span>{' '}
              seconds...
            </p>
          </div>
        </div>
      )}

      {/* ── GOODBYE ANIMATION OVERLAY ──────────────────── */}
      {goodbyePhase && (
        <div className="absolute inset-0 bg-stone-950 flex flex-col items-center justify-center z-[100] text-center animate-fade-in">
          <div className="space-y-4 animate-pulse">
            <div className="w-16 h-16 rounded-full border border-amber-500/30 bg-amber-500/10 flex items-center justify-center text-2xl mx-auto shadow-lg">
              ⏳
            </div>
            <h3 className="text-xl font-bold text-white tracking-wide">
              {goodbyePhase === 'leaving' && 'Leaving Queue...'}
              {goodbyePhase === 'cleaning' && 'Cleaning Session...'}
              {goodbyePhase === 'goodbye' && 'Goodbye!'}
            </h3>
            <p className="text-stone-500 text-xs uppercase tracking-widest font-black">
              Kaboom TV Video Chat
            </p>
          </div>
        </div>
      )}

      {/* ── NAVIGATION BLOCKER OVERLAY ──────────────────── */}
      {blocker.state === 'blocked' && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80 backdrop-blur-md z-[90] p-6 text-center">
          <div className="max-w-xs w-full bg-stone-900 border border-white/10 rounded-3xl p-6 shadow-2xl space-y-6 animate-spring-in">
            <div className="space-y-2">
              <h3 className="text-xl font-bold text-white">
                {chatState.status === 'CONNECTED' ? 'Leave Conversation?' : 'Leave Search?'}
              </h3>
              <p className="text-stone-400 text-sm">
                {chatState.status === 'CONNECTED' ? 'Your current chat will end.' : 'Your current search will stop.'}
              </p>
            </div>
            
            <div className="flex flex-col gap-2">
              <button
                onClick={() => blocker.reset && blocker.reset()}
                className="w-full py-3 rounded-xl bg-white/10 hover:bg-white/15 text-white font-medium text-sm transition-all active:scale-95"
              >
                {chatState.status === 'CONNECTED' ? 'Continue Chat' : 'Continue Searching'}
              </button>
              <button
                onClick={handleConfirmBlockerLeave}
                className="w-full py-3 rounded-xl bg-red-500 hover:bg-red-600 text-white font-semibold text-sm transition-all active:scale-95"
              >
                Leave
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Development Layout Debugger */}
      <LayoutDebugger />
    </div>
  );
}


import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChatControls } from '../components/ChatControls.js';
import { ConnectionStatusBadge } from '../components/ConnectionStatusBadge.js';
import { FeedbackModal } from '../components/FeedbackModal.js';
import { LoadingScreen } from '../components/LoadingScreen.js';
import { ReportModal } from '../components/ReportModal.js';
import { SearchingAnimation } from '../components/SearchingAnimation.js';
import { VideoPlayer } from '../components/VideoPlayer.js';
import { PreferenceModal } from '../components/PreferenceModal.js';
import { TemporaryChat } from '../components/TemporaryChat.js';
import { useSession } from '../contexts/SessionContext.js';
import { useToast } from '../contexts/ToastContext.js';
import { useVideoChat } from '../hooks/useVideoChat.js';
import { apiService } from '../services/api.js';
import type { ReportReason } from '../types/index.js';
import { formatDuration } from '../utils/index.js';
import { cn } from '../utils/index.js';
import { playTapSound } from '../utils/audio.js';
import { MobileHeader } from '../components/MobileHeader.js';
import { BottomToolbar } from '../components/BottomToolbar.js';
import { RightActionDock } from '../components/RightActionDock.js';
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
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [showPreferenceModal, setShowPreferenceModal] = useState(false);
  const [showWelcomeGate, setShowWelcomeGate] = useState(() => {
    return !localStorage.getItem('kaboom_display_name');
  });
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [initializing, setInitializing] = useState(false);
  const [permissionGranted, setPermissionGranted] = useState<boolean | null>(null);
  const chatStartedRef = useRef(false);
  const pendingLeaveRef = useRef(false);
  const hintHideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // V5.1 Tutorial / theme setup
  const [showTutorial, setShowTutorial] = useState(() => {
    return localStorage.getItem('kaboom_tutorial_dismissed') !== 'true';
  });

  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 640);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 640);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const activeTheme = localStorage.getItem('kaboom_theme') || 'ember';
    document.documentElement.className = `theme-${activeTheme}`;
  }, []);

  // FaceTime autohide controls state
  const [controlsVisible, setControlsVisible] = useState(true);
  const hideTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  // V6.1 countdown intro states
  const [countdown, setCountdown] = useState<number | null>(null);
  const [showIntro, setShowIntro] = useState(false);
  const [activePartnerProfile, setActivePartnerProfile] = useState<any>(null);


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
  } = useVideoChat(session?.sessionId ?? null, session?.sessionToken ?? null, triggerReaction);

  const isConnected = chatState.status === 'CONNECTED';
  const isSearching = [
    'REQUESTING_MEDIA', 'MEDIA_READY', 'CONNECTING_REALTIME', 
    'SEARCHING', 'REQUEUEING', 'PARTNER_LEFT', 'MATCH_FOUND', 'READY', 'NEGOTIATING', 'ICE_CONNECTING'
  ].includes(chatState.status);

  // Start countdown sequence when matched & connected
  useEffect(() => {
    if (isConnected && chatState.partnerProfile) {
      setActivePartnerProfile(chatState.partnerProfile);
      setShowIntro(true);
      setCountdown(3);
    } else if (!isConnected) {
      setShowIntro(false);
      setCountdown(null);
      setActivePartnerProfile(null);
    }
  }, [isConnected, chatState.partnerProfile]);

  // Countdown timer ticking down
  useEffect(() => {
    if (countdown === null) return;
    
    if (countdown > 0) {
      // Play tick sound
      try {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioContextClass) {
          const ctx = new AudioContextClass();
          const now = ctx.currentTime;
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(1000 + (3 - countdown) * 100, now);
          gain.gain.setValueAtTime(0, now);
          gain.gain.linearRampToValueAtTime(0.08, now + 0.01);
          gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.1);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now);
          osc.stop(now + 0.1);
        }
      } catch {}

      const timer = setTimeout(() => {
        setCountdown(countdown - 1);
      }, 1000);
      return () => clearTimeout(timer);
    } else {
      const timer = setTimeout(() => {
        setShowIntro(false);
        setCountdown(null);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  // Automatically open the chat drawer for 3 seconds when connected
  useEffect(() => {
    if (isConnected && chatState.partnerProfile) {
      setChatOpen(true);
      const timer = setTimeout(() => {
        setChatOpen(false);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [isConnected, chatState.partnerProfile, setChatOpen]);

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

  const getRemoteVideoStyle = useCallback((): React.CSSProperties => {
    const ratio = mainAspectRatio;
    if (!isConnected || !ratio) {
      return { width: '100%', height: '100%', left: 0, top: 0, transform: 'none', borderRadius: 0 };
    }
    
    const baseStyles: React.CSSProperties = {
      position: 'absolute',
      left: '50%',
      top: '50%',
      transform: 'translate(-50%, -50%)',
      borderRadius: '24px',
      border: '1.5px solid rgba(255, 255, 255, 0.08)',
      boxShadow: '0 24px 64px rgba(0, 0, 0, 0.9)',
      overflow: 'hidden',
      transition: 'all 0.5s cubic-bezier(0.16, 1, 0.3, 1)'
    };

    if (isMobile) {
      if (ratio >= 1) {
        return {
          ...baseStyles,
          width: '90vw',
          height: `calc(90vw / ${ratio})`,
          maxWidth: '100%',
          maxHeight: '80vh'
        };
      }
      return { width: '100%', height: '100%', left: 0, top: 0, transform: 'none', borderRadius: 0 };
    } else {
      if (ratio < 1) {
        return {
          ...baseStyles,
          height: '80vh',
          width: `calc(80vh * ${ratio})`,
          maxHeight: '90%',
          maxWidth: '90%'
        };
      }
      return {
        ...baseStyles,
        width: '80vw',
        height: `calc(80vw / ${ratio})`,
        maxHeight: '80vh',
        maxWidth: `calc(80vh * ${ratio})`
      };
    }
  }, [isConnected, isMobile, mainAspectRatio]);

  const renderVideoAndOverlays = useCallback(() => {
    return (
      <div className="w-full h-full relative">
        <VideoPlayer
          stream={isPlacementsSwapped ? localStream : remoteStream}
          mirrored={isPlacementsSwapped}
          muted={isPlacementsSwapped}
          fullscreen={chatState.isFullscreen}
          onAspectRatioChange={isPlacementsSwapped ? handleLocalAspectRatioChange : handleRemoteAspectRatioChange}
          placeholder={isSearching ? 'Looking for a partner...' : 'Partner video will appear here'}
        />

        {/* Partner Card overlay inside video borders */}
        {isConnected && chatState.partnerProfile && (
          <div 
            className="absolute z-20 flex flex-col gap-1 p-3.5 rounded-2xl border border-white/10 bg-black/40 backdrop-blur-xl max-w-[240px] shadow-2xl animate-fade-in pointer-events-none select-none"
            style={{
              left: '16px',
              bottom: '16px',
            }}
          >
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs font-black text-stone-100 tracking-tight/90 line-clamp-1">
                👤 {chatState.partnerProfile.displayName || 'Guest'}
              </span>
              <span className="inline-flex items-center gap-1 text-[8px] px-1.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-black uppercase tracking-wider">
                🟢 Online
              </span>
            </div>

            {/* University */}
            {(chatState.partnerProfile.matchAttributes?.university?.[0] || (chatState.partnerProfile as any).university) && (
              <p className="text-[10px] text-stone-300 font-extrabold leading-normal mt-0.5">
                🎓 {chatState.partnerProfile.matchAttributes?.university?.[0] || (chatState.partnerProfile as any).university}
              </p>
            )}

            {/* Bio / Status */}
            {chatState.partnerProfile.bio && (
              <p className="text-[10px] text-stone-400 font-medium leading-relaxed italic mt-0.5">
                💬 {chatState.partnerProfile.bio}
              </p>
            )}
          </div>
        )}

        {/* Connection Quality widget inside video borders */}
        {isConnected && chatState.connectionQuality && (
          <div
            className="absolute right-4 flex items-center gap-1.5 px-3 py-1.5 rounded-full border bg-black/45 backdrop-blur-md text-[10px] font-extrabold uppercase tracking-wider"
            style={{
              top: '16px',
              zIndex: 20,
              borderColor: 
                chatState.connectionQuality === 'excellent' ? 'rgba(16,185,129,0.2)' :
                chatState.connectionQuality === 'good' ? 'rgba(245,158,11,0.2)' : 'rgba(239,68,68,0.2)',
              color:
                chatState.connectionQuality === 'excellent' ? '#10b981' :
                chatState.connectionQuality === 'good' ? '#f59e0b' : '#ef4444'
            }}
          >
            <span className={cn(
              "w-1.5 h-1.5 rounded-full",
              chatState.connectionQuality === 'excellent' ? "bg-emerald-500 animate-pulse" :
              chatState.connectionQuality === 'good' ? "bg-amber-500 animate-pulse" : "bg-red-500 animate-ping"
            )} />
            <span>Net: {chatState.connectionQuality}</span>
          </div>
        )}
      </div>
    );
  }, [
    isConnected,
    isPlacementsSwapped,
    localStream,
    remoteStream,
    chatState.partnerProfile,
    chatState.connectionQuality,
    chatState.isFullscreen,
    isSearching,
    handleLocalAspectRatioChange,
    handleRemoteAspectRatioChange
  ]);

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
    resetControlsTimeout();
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
    } else {
      if (diffY > 90) {
        handleLeave();
      }
    }

    touchStartX.current = null;
    touchStartY.current = null;
  };

  // Autohide controls logic
  const resetControlsTimeout = useCallback(() => {
    setControlsVisible(true);
    if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
    hideTimeoutRef.current = setTimeout(() => {
      // Keep controls visible if searching or preferences open
      if (chatState.status === 'CONNECTED' && !showPreferenceModal) {
        setControlsVisible(false);
      }
    }, 2500);
  }, [chatState.status, showPreferenceModal]);

  useEffect(() => {
    resetControlsTimeout();
    return () => {
      if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
    };
  }, [resetControlsTimeout]);

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
    setIsPlacementsSwapped((prev) => !prev);
  };

  // Draggable & Pinch Zoom handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    dragStart.current = { x: e.clientX - dragOffset.x, y: e.clientY - dragOffset.y };
  };

  const handleTouchStart = (e: React.TouchEvent) => {
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
        isMobile: window.innerWidth < 640,
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

  const handleLeave = async () => {
    pendingLeaveRef.current = true;
    stopChat();
    setShowFeedbackModal(true);
  };

  const finishLeave = async () => {
    try {
      await endSession();
    } catch {
      // Ignore
    }
    navigate('/');
    showToast('info', 'You left the chat');
    pendingLeaveRef.current = false;
  };

  const handleFeedbackSubmit = async (rating: number, feedback: string) => {
    if (session) {
      try {
        await apiService.submitFeedback(session.sessionId, rating, feedback || undefined);
        showToast('success', 'Thanks for your feedback!');
      } catch {
        // Ignore
      }
    }
    setShowFeedbackModal(false);
    await finishLeave();
  };

  const handleFeedbackClose = async () => {
    setShowFeedbackModal(false);
    if (pendingLeaveRef.current) {
      await finishLeave();
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
      onMouseMove={resetControlsTimeout}
      onTouchStart={handleTouchStartRoot}
      onTouchEnd={handleTouchEndRoot}
      role="main"
      aria-label="Video chat"
    >
      <MetaManager page="chat" />
      <TipEngine />
       {/* ── LAYER 1: Remote video — z-index: var(--z-video) ── */}
      {isMobile ? (
        <GestureLayer
          onSwipeLeft={handleNext}
          onSwipeDown={handleLeave}
          onDoubleTap={handleLike}
          onLongPress={() => setShowPreferenceModal(true)}
          disabled={chatState.isChatOpen || isDragging}
        >
          <div 
            className="video-viewport opacity-100 scale-100 translate-x-0"
            style={getRemoteVideoStyle()}
          >
            {renderVideoAndOverlays()}
          </div>
        </GestureLayer>
      ) : (
        <div 
          className={cn(
            "video-viewport transition-all duration-[750ms] ease-[cubic-bezier(0.16,1,0.3,1)]",
            isConnected ? "opacity-100 scale-100 translate-x-0" : "opacity-0 scale-95 -translate-x-10"
          )}
          style={getRemoteVideoStyle()}
          onDoubleClick={handleLike}
        >
          {renderVideoAndOverlays()}
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

      {/* ── SEARCHING OVERLAY ─────────────────────────────── */}
      {isSearching && (
        <div
          className="absolute inset-0 flex items-center justify-center bg-stone-950"
          style={{ zIndex: 'calc(var(--z-overlay) + 1)' as any }}
        >
          <SearchingAnimation
            queuePosition={chatState.queuePosition}
            matchMode={localStorage.getItem('kaboom_match_mode') || 'RANDOM'}
            onDisableStrict={handleDisableStrict}
            onOpenPreferences={async () => {
              await pauseQueue();
              setShowPreferenceModal(true);
            }}
            status={chatState.status}
            partnerProfile={chatState.partnerProfile}
            isQueuePaused={isQueuePaused}
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
        />
      ) : (
        /* ── DESKTOP STATUS BAR (top-left, below header) ── */
        <div
          className="absolute left-4 flex items-center gap-3"
          style={{
            top: 'calc(var(--header-h) + 12px)',
            zIndex: 'var(--z-controls)' as any,
          }}
        >
          <ConnectionStatusBadge status={chatState.connectionStatus} />
          {isConnected && (
            <span className="px-3 py-1 bg-black/40 backdrop-blur-md rounded-full border border-white/10 text-sm text-white/80 font-mono tracking-wider shadow-lg">
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

      {/* ── SELF-PREVIEW PiP (corner-snapping) ─────────────── */}
      <div
        className={cn('self-preview transition-transform', isDragging && 'shadow-2xl border-amber-500/30')}
        style={{
          width: isMobile ? '28vw' : '200px',
          height: isMobile ? `calc(28vw / ${pipAspectRatio || 1.33})` : `calc(200px / ${pipAspectRatio || 1.33})`,
          transform: `translate(${dragOffset.x}px, ${dragOffset.y}px) scale(${isDragging ? pipScale * 1.03 : pipScale})`,
          bottom: undefined,
          right: undefined,
          ...(snapCorner === 'br' ? { bottom: isMobile ? '198px' : '100px', right: '24px' } : {}),
          ...(snapCorner === 'bl' ? { bottom: isMobile ? '198px' : '100px', left: '24px'  } : {}),
          ...(snapCorner === 'tr' ? { top: isMobile ? 'calc(var(--header-h) + 54px)' : 'calc(var(--header-h) + 16px)', right: '24px' } : {}),
          ...(snapCorner === 'tl' ? { top: isMobile ? 'calc(var(--header-h) + 54px)' : 'calc(var(--header-h) + 16px)', left: '24px' } : {}),
          zIndex: 'var(--z-controls)' as any,
        }}
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
        onDoubleClick={handleDoubleTapSwap}
      >
        <VideoPlayer
          stream={isPlacementsSwapped ? remoteStream : localStream}
          muted={!isPlacementsSwapped}
          mirrored={!isPlacementsSwapped}
          onAspectRatioChange={isPlacementsSwapped ? handleRemoteAspectRatioChange : handleLocalAspectRatioChange}
          className="w-full h-full pointer-events-none"
          label={
            isPlacementsSwapped 
              ? (chatState.partnerProfile?.displayName || 'Partner') 
              : `You • ${localStorage.getItem('kaboom_display_name')?.split(' ')[0] || 'Guest'}`
          }
        />
      </div>

      {/* ── CONTROLS DOCK ─────────────────────────────────── */}
      {isMobile ? (
        <div className={cn("transition-all duration-300 pointer-events-none", !controlsVisible && "opacity-0 scale-95")}>
          <RightActionDock
            onNext={handleNext}
            onToggleChat={() => setChatOpen(!chatState.isChatOpen)}
            onOpenPreferences={async () => {
              await pauseQueue();
              setShowPreferenceModal(true);
            }}
            onReport={() => setShowReportModal(true)}
            unreadCount={chatState.unreadCount}
            isChatOpen={chatState.isChatOpen || false}
            disabled={isSearching}
          />
          <BottomToolbar
            isMuted={chatState.isMuted}
            isCameraOff={chatState.isCameraOff}
            liked={chatState.liked || false}
            onToggleMute={toggleMute}
            onToggleCamera={toggleCamera}
            onLike={handleLike}
            disabled={isSearching}
          />
        </div>
      ) : (
        <div
          className={cn('controls-dock', !controlsVisible && 'controls-dock--hidden')}
        >
          <ChatControls
            isMuted={chatState.isMuted}
            isCameraOff={chatState.isCameraOff}
            isFullscreen={chatState.isFullscreen}
            onToggleMute={toggleMute}
            onToggleCamera={toggleCamera}
            onNext={handleNext}
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
          />
        </div>
      )}

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
      <PreferenceModal
        isOpen={showPreferenceModal || showWelcomeGate}
        onClose={async () => {
          if (showWelcomeGate) {
            navigate('/');
          } else {
            setShowPreferenceModal(false);
            await resumeQueue();
          }
        }}
        onSave={async (prefs) => {
          await updatePreferences(prefs);
          if (showWelcomeGate) {
            setShowWelcomeGate(false);
          }
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
      <FeedbackModal
        isOpen={showFeedbackModal}
        onClose={handleFeedbackClose}
        onSubmit={handleFeedbackSubmit}
      />

      {/* ── ONBOARDING TUTORIAL WIZARD ───────────────────── */}
      {showTutorial && (
        <TutorialOverlay onClose={() => setShowTutorial(false)} />
      )}

      {showIntro && activePartnerProfile && (
        <div
          className="absolute inset-0 flex flex-col items-center justify-center bg-black/95 backdrop-blur-3xl animate-fade-in"
          style={{ zIndex: 'var(--z-overlay)' as any }}
        >
          <div className="text-center max-w-sm px-6 animate-spring-in">
            <span className="text-amber-400 text-xs font-black uppercase tracking-widest block mb-4 animate-pulse">
              ✨ YOU MATCHED ✨
            </span>

            {/* Profile Intro Card */}
            <div className="bg-white/[0.02] border border-white/10 rounded-3xl p-6 shadow-2xl backdrop-blur-md mb-8 flex flex-col items-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-3xl font-black text-amber-400">
                👤
              </div>
              
              <div className="text-center">
                <h3 className="text-2xl font-black text-white">
                  {activePartnerProfile.displayName || 'Guest'}
                </h3>
                
                {/* University */}
                {(activePartnerProfile.matchAttributes?.university?.[0] || (activePartnerProfile as any).university) && (
                  <p className="text-sm font-bold text-stone-300 mt-1 flex items-center justify-center gap-1">
                    🎓 {activePartnerProfile.matchAttributes?.university?.[0] || (activePartnerProfile as any).university}
                  </p>
                )}
                
                {/* Bio */}
                {activePartnerProfile.bio && (
                  <p className="text-xs text-stone-400 mt-2 italic max-w-[240px]">
                    💬 {activePartnerProfile.bio}
                  </p>
                )}
              </div>

              {/* Matched Because Reasons */}
              <div className="w-full border-t border-white/5 pt-4 mt-1 text-center">
                <span className="text-[10px] text-stone-500 font-bold uppercase tracking-wider block mb-2">Matched because</span>
                {(() => {
                  const shared: string[] = [];
                  const myUni = localStorage.getItem('kaboom_university');
                  const pUni = activePartnerProfile.match_attributes?.university?.[0] || (activePartnerProfile as any).university;
                  if (myUni && pUni && myUni.toLowerCase() === pUni.toLowerCase()) shared.push(`🎓 Same University`);

                  const myCity = localStorage.getItem('kaboom_city');
                  const pCity = activePartnerProfile.match_attributes?.city?.[0] || (activePartnerProfile as any).city;
                  if (myCity && pCity && myCity.toLowerCase() === pCity.toLowerCase()) shared.push(`📍 ${myCity}`);

                  const myCountry = localStorage.getItem('kaboom_country');
                  const pCountry = activePartnerProfile.match_attributes?.country?.[0] || (activePartnerProfile as any).country;
                  if (myCountry && pCountry && myCountry.toLowerCase() === pCountry.toLowerCase()) shared.push(`🌍 ${myCountry}`);

                  let myInterests: string[] = [];
                  try { myInterests = JSON.parse(localStorage.getItem('kaboom_interest_tags') || '[]'); } catch {}
                  const pInterests = activePartnerProfile.match_attributes?.interests || activePartnerProfile.interest_tags || [];
                  const sharedInterests = myInterests.filter(x => pInterests.some((y: string) => y.toLowerCase() === x.toLowerCase()));
                  sharedInterests.forEach(i => shared.push(`✨ ${i}`));

                  if (shared.length > 0) {
                    return (
                      <div className="flex flex-wrap gap-1.5 justify-center">
                        {shared.map((attr, idx) => (
                          <span key={idx} className="text-[10px] px-2.5 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-300 font-bold">
                            {attr}
                          </span>
                        ))}
                      </div>
                    );
                  } else {
                    return (
                      <p className="text-[10px] text-stone-400 italic">
                        🎲 Random Match. Meet someone completely new today!
                      </p>
                    );
                  }
                })()}
              </div>
            </div>

            {/* Glowing Big countdown digits */}
            <div className="flex flex-col items-center">
              <div className="w-16 h-16 rounded-full border border-amber-500/30 bg-amber-500/5 flex items-center justify-center text-3xl font-black text-amber-400 shadow-2xl shadow-amber-500/10 animate-ping">
                {countdown}
              </div>
              <span className="text-stone-500 text-[10px] font-bold uppercase tracking-wider mt-4">Starting video feed...</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


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
import { hintEngine } from '../services/HintEngine.js';

export function ChatPage() {
  const navigate = useNavigate();
  const { session, endSession, startSession, isLoading } = useSession();
  const { showToast } = useToast();
  const [showReportModal, setShowReportModal] = useState(false);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [showPreferenceModal, setShowPreferenceModal] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [initializing, setInitializing] = useState(false);
  const chatStartedRef = useRef(false);
  const pendingLeaveRef = useRef(false);

  // FaceTime autohide controls state
  const [controlsVisible, setControlsVisible] = useState(true);
  const hideTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // FaceTime draggable self-preview state
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [snapCorner, setSnapCorner] = useState<'br' | 'bl' | 'tr' | 'tl'>('br');
  const dragStart = useRef({ x: 0, y: 0 });

  // Onboarding Hint state
  const [activeHint, setActiveHint] = useState<string | null>(null);
  const [hintDismissed, setHintDismissed] = useState(false);
  const [showMutualMatchPopup, setShowMutualMatchPopup] = useState(false);
  const [hearts, setHearts] = useState<Array<{ id: number; left: number; delay: number }>>([]);

  const triggerHeartBurst = useCallback(() => {
    const newHearts = Array.from({ length: 8 }).map((_, i) => ({
      id: Math.random() + i,
      left: Math.random() * 80 + 10,
      delay: Math.random() * 0.4
    }));
    setHearts(prev => [...prev, ...newHearts]);
    setTimeout(() => {
      setHearts(prev => prev.filter(h => !newHearts.some(nh => nh.id === h.id)));
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
  } = useVideoChat(session?.sessionId ?? null, session?.sessionToken ?? null);

  const handleLike = useCallback(async () => {
    triggerHeartBurst();
    await likePartner();
  }, [triggerHeartBurst, likePartner]);

  // Autohide controls logic
  const resetControlsTimeout = useCallback(() => {
    setControlsVisible(true);
    if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
    hideTimeoutRef.current = setTimeout(() => {
      // Keep controls visible if searching or preferences open
      if (chatState.status === 'connected' && !showPreferenceModal) {
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
      triggerHeartBurst();
    }
  }, [chatState.partnerLiked, chatState.mutualLike, triggerHeartBurst]);

  // Draggable handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    dragStart.current = { x: e.clientX - dragOffset.x, y: e.clientY - dragOffset.y };
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    setIsDragging(true);
    const touch = e.touches[0];
    dragStart.current = { x: touch.clientX - dragOffset.x, y: touch.clientY - dragOffset.y };
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
      if (!isDragging) return;
      const touch = e.touches[0];
      setDragOffset({
        x: touch.clientX - dragStart.current.x,
        y: touch.clientY - dragStart.current.y,
      });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      // Snap to nearest corner based on accumulated drag position
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const pipW = vw < 640 ? 130 : 220;
      const pipH = vw < 640 ? 80 : 140;
      // Compute absolute position from the br anchor + offset
      const absX = vw - 24 - pipW + dragOffset.x;
      const absY = vh - 100 - pipH + dragOffset.y;
      const isLeft  = absX + pipW / 2 < vw / 2;
      const isTop   = absY + pipH / 2 < vh / 2;
      setSnapCorner(isTop ? (isLeft ? 'tl' : 'tr') : (isLeft ? 'bl' : 'br'));
      setDragOffset({ x: 0, y: 0 });
    };

    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      window.addEventListener('touchmove', handleTouchMove);
      window.addEventListener('touchend', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleMouseUp);
    };
  }, [isDragging, dragOffset]);

  // Session Initialization
  useEffect(() => {
    if (session) return;

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
  }, [session, startSession, showToast, navigate]);

  useEffect(() => {
    if (!session) return;

    if (chatStartedRef.current) return;
    chatStartedRef.current = true;
    startChat();
  }, [session, startChat]);

  // Active match counter
  useEffect(() => {
    if (!chatState.matchStartTime || chatState.status !== 'connected') {
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
    if (!session) return;

    const updateHint = () => {
      const hintState = {
        appState: chatState.status as any,
        micMuted: chatState.isMuted,
        cameraOff: chatState.isCameraOff,
        isMobile: window.innerWidth < 640,
        waitingSeconds: chatState.status === 'waiting' ? elapsedSeconds : 0,
        connectedSeconds: chatState.status === 'connected' ? elapsedSeconds : 0,
        hasExchangedMessages: (chatState.messages?.length ?? 0) > 0,
        hasLiked: chatState.liked || false,
        partnerLiked: chatState.partnerLiked || false,
      };

      const hint = hintEngine.getHint(hintState);
      setActiveHint(hint);
      setHintDismissed(false);
    };

    updateHint();
    const interval = setInterval(updateHint, 20000);
    return () => clearInterval(interval);
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

  const isSearching = chatState.status === 'waiting' || chatState.status === 'starting';
  const isConnected = chatState.status === 'connected';

  return (
    /* Root: fills entire 100dvh viewport (set by layout-immersive on parent) */
    <div
      className="absolute inset-0 bg-black overflow-hidden select-none"
      onMouseMove={resetControlsTimeout}
      onTouchStart={resetControlsTimeout}
      role="main"
      aria-label="Video chat"
    >
      {/* ── LAYER 1: Remote video — z-index: var(--z-video) ── */}
      <div 
        className={cn(
          "video-viewport transition-all duration-[750ms] ease-[cubic-bezier(0.16,1,0.3,1)]",
          isConnected ? "opacity-100 scale-100 translate-x-0" : "opacity-0 scale-95 -translate-x-10"
        )}
      >
        <VideoPlayer
          stream={remoteStream}
          className="w-full h-full object-cover"
          placeholder={isSearching ? 'Looking for a partner...' : 'Partner video will appear here'}
        />
      </div>

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
          className="absolute inset-0 flex items-center justify-center bg-black/70 backdrop-blur-md"
          style={{ zIndex: 'calc(var(--z-overlay) + 1)' as any }}
        >
          <SearchingAnimation queuePosition={chatState.queuePosition} />
        </div>
      )}

      {/* ── STATUS BAR (top-left, below header) ──────────── */}
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

      {/* ── COACH MARK (hint) — always below header ────────── */}
      {activeHint && !hintDismissed && (
        <div
          className="coach-mark coach-mark--center cursor-pointer hover:bg-white/10 transition-colors"
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
        className={cn('self-preview', isDragging && 'scale-105')}
        style={{
          transform: `translate(${dragOffset.x}px, ${dragOffset.y}px)`,
          bottom: undefined,
          right: undefined,
          // Snap to computed corner position
          ...(snapCorner === 'br' ? { bottom: '100px', right: '24px' } : {}),
          ...(snapCorner === 'bl' ? { bottom: '100px', left: '24px'  } : {}),
          ...(snapCorner === 'tr' ? { top: 'calc(var(--header-h) + 16px)', right: '24px' } : {}),
          ...(snapCorner === 'tl' ? { top: 'calc(var(--header-h) + 16px)', left: '24px' } : {}),
          zIndex: 'var(--z-controls)' as any,
        }}
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
      >
        <VideoPlayer
          stream={localStream}
          muted
          mirrored
          className="w-full h-full object-cover pointer-events-none"
          label="You"
        />
      </div>

      {/* ── CONTROLS DOCK ─────────────────────────────────── */}
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
          onOpenPreferences={() => setShowPreferenceModal(true)}
          unreadCount={chatState.unreadCount}
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
      />

      {/* ── PREFERENCES MODAL ─────────────────────────────── */}
      <PreferenceModal
        isOpen={showPreferenceModal}
        onClose={() => setShowPreferenceModal(false)}
        onSave={updatePreferences}
        currentPreferences={{
          gender: chatState.gender,
          looking_for: chatState.lookingFor,
          languages: chatState.languages,
          country: chatState.country,
          state: chatState.state,
          district: chatState.district,
          city: chatState.city,
          interest_tags: chatState.interestTags,
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

      {/* ── FLOATING HEARTS EMITTER ───────────────────────── */}
      {hearts.map((h) => (
        <span
          key={h.id}
          className="floating-heart"
          style={{
            left: `${h.left}%`,
            animationDelay: `${h.delay}s`
          }}
        >
          ❤️
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
    </div>
  );
}


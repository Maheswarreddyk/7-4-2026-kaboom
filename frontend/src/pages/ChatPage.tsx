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
  const dragStart = useRef({ x: 0, y: 0 });

  // Onboarding Hint state
  const [activeHint, setActiveHint] = useState<string | null>(null);
  const [hintDismissed, setHintDismissed] = useState(false);

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

  // Autohide controls logic
  const resetControlsTimeout = useCallback(() => {
    setControlsVisible(true);
    if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
    hideTimeoutRef.current = setTimeout(() => {
      // Keep controls visible if searching or preferences open
      if (chatState.status === 'connected' && !showPreferenceModal) {
        setControlsVisible(false);
      }
    }, 3500);
  }, [chatState.status, showPreferenceModal]);

  useEffect(() => {
    resetControlsTimeout();
    return () => {
      if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
    };
  }, [resetControlsTimeout]);

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

    const handleMouseUp = () => setIsDragging(false);

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
  }, [isDragging]);

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
    <div 
      className="h-[100dvh] w-full flex bg-black relative overflow-hidden select-none"
      onMouseMove={resetControlsTimeout}
      onTouchStart={resetControlsTimeout}
    >
      {/* Immersive Video Screen */}
      <div className="flex-1 flex flex-col relative">
        <div className="absolute top-4 left-4 z-30 flex items-center gap-3">
          <ConnectionStatusBadge status={chatState.connectionStatus} />
          {isConnected && (
            <span className="px-3 py-1 bg-black/40 backdrop-blur-md rounded-full border border-white/10 text-sm text-white/80 font-mono tracking-wider shadow-lg animate-pulse-slow">
              {formatDuration(elapsedSeconds)}
            </span>
          )}
        </div>

        {/* Dynamic Island Contextual Hints */}
        {activeHint && !hintDismissed && (
          <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-30 w-11/12 max-w-sm">
            <div className="flex items-center justify-between gap-3 px-5 py-3 rounded-full bg-white/10 backdrop-blur-xl border border-white/25 shadow-2xl animate-scale-up hover:bg-white/15 transition-colors cursor-pointer" onClick={handleDismissHint}>
              <span className="text-sm font-medium text-white/90 leading-tight">{activeHint}</span>
              <span className="text-xs text-white/40 hover:text-white/60">Dismiss</span>
            </div>
          </div>
        )}

        {/* FaceTime style background container */}
        <div className="flex-1 relative flex items-center justify-center bg-zinc-950">
          <VideoPlayer
            stream={remoteStream}
            className="w-full h-full object-cover absolute inset-0"
            placeholder={isSearching ? 'Looking for a partner...' : 'Partner video will appear here'}
          />

          {isSearching && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/80 backdrop-blur-md z-10">
              <SearchingAnimation queuePosition={chatState.queuePosition} />
            </div>
          )}

          {/* FaceTime Floating Self-Preview */}
          <div
            className={cn(
              "absolute aspect-video w-32 sm:w-48 rounded-2xl overflow-hidden border border-white/20 shadow-2xl z-20 bg-slate-900 cursor-grab active:cursor-grabbing transition-transform duration-200 select-none",
              isDragging ? "scale-105" : ""
            )}
            style={{
              bottom: '100px',
              right: '24px',
              transform: `translate(${dragOffset.x}px, ${dragOffset.y}px)`,
              touchAction: 'none'
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
        </div>

        {/* Floating Controls Dock */}
        <div 
          className={cn(
            "absolute bottom-6 left-1/2 transform -translate-x-1/2 z-30 transition-all duration-300",
            controlsVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10 pointer-events-none"
          )}
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
            onLike={likePartner}
            onOpenPreferences={() => setShowPreferenceModal(true)}
            unreadCount={chatState.unreadCount}
          />
        </div>
      </div>

      {/* Slide-out Collapsible Chat sidebar */}
      {chatState.isChatOpen && (
        <TemporaryChat
          isOpen={chatState.isChatOpen}
          onClose={() => setChatOpen(false)}
          messages={chatState.messages || []}
          onSendMessage={sendChatMessage}
          selfSessionId={session.sessionId}
          partnerTyping={chatState.partnerTyping || false}
          onTyping={setTypingStatus}
        />
      )}

      {/* Preferences Modal */}
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

      {/* Celebration Heart Burst Overlay on Mutual Match */}
      {chatState.mutualLike && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/80 backdrop-blur-2xl animate-fade-in" onClick={() => setChatOpen(true)}>
          {/* Confetti celebration container */}
          <div className="p-8 bg-slate-900 border border-white/10 rounded-3xl text-center shadow-2xl max-w-sm animate-scale-up glass relative overflow-hidden">
            <span className="text-6xl animate-bounce block">🎉</span>
            <span className="text-4xl animate-pulse block mt-2">❤️</span>
            <h3 className="text-2xl font-bold text-white mt-4 bg-gradient-to-r from-accent to-pink-500 bg-clip-text text-transparent">Mutual Match!</h3>
            <p className="text-sm text-white/70 mt-2">Both of you liked each other! Start chatting below.</p>
            <div className="flex gap-3 justify-center mt-6">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setChatOpen(true);
                }}
                className="px-6 py-2.5 bg-gradient-to-r from-accent to-purple-600 text-white rounded-xl font-bold text-sm hover:scale-105 active:scale-95 transition-all shadow-lg shadow-accent/25"
              >
                Start Chatting
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  likePartner().catch(() => {});
                }}
                className="px-4 py-2.5 bg-white/5 border border-white/10 hover:bg-white/10 text-white/80 rounded-xl text-sm transition-all"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
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

import React, { useState, useEffect, useRef } from 'react';
import { cn } from '../utils/index.js';
import { playTapSound } from '../utils/audio.js';

interface TemporaryChatProps {
  isOpen: boolean;
  onClose: () => void;
  messages: Array<{
    id: string;
    senderSessionId: string;
    message: string;
    createdAt: number;
    status?: 'sending' | 'delivered' | 'seen';
  }>;
  onSendMessage: (msg: string) => void;
  selfSessionId: string;
  partnerTyping: boolean;
  onTyping: (typing: boolean) => void;
}

const EMOJIS = ['👋', '❤️', '😂', '🔥', '👍', '😍', '😮', '👏'];

export function TemporaryChat({
  isOpen,
  onClose,
  messages,
  onSendMessage,
  selfSessionId,
  partnerTyping,
  onTyping,
}: TemporaryChatProps) {
  const [inputText, setInputText] = useState('');
  const [isExpandedFull, setIsExpandedFull] = useState(false); // Mobile half vs full sheet
  const [now, setNow] = useState(Date.now());
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Sync current time reference for decaying unpinned messages (8 seconds in V5.1)
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(interval);
  }, []);

  // Auto-scroll messages list
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, partnerTyping, isOpen]);

  // Focus input on drawer open
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 200);
    } else {
      setIsExpandedFull(false);
    }
  }, [isOpen]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    playTapSound();
    onSendMessage(inputText.trim());
    setInputText('');
    onTyping(false);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputText(e.target.value);
    onTyping(true);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      onTyping(false);
    }, 2000);
  };

  const addEmoji = (emoji: string) => {
    playTapSound();
    setInputText((prev) => prev + emoji);
    inputRef.current?.focus();
  };

  // Render Receipt Status Label
  const renderStatus = (status?: 'sending' | 'delivered' | 'seen') => {
    switch (status) {
      case 'sending':
        return <span className="text-[9px] text-white/30 animate-pulse">Sending...</span>;
      case 'delivered':
        return <span className="text-[9px] text-amber-500/50">Delivered</span>;
      case 'seen':
        return <span className="text-[9px] text-amber-400">Seen</span>;
      default:
        return <span className="text-[9px] text-white/30">Delivered</span>;
    }
  };

  // Filter unpinned messages decay timer for closed overlay mode (8 seconds)
  const isMessageVisibleInOverlay = (msg: { createdAt: number; id: string }) => {
    return now - msg.createdAt < 8000;
  };

  // ── RENDER OVERLAY MODE (Closed Drawer, floating transparent notifications) ──
  if (!isOpen) {
    const visibleMessages = messages.filter(isMessageVisibleInOverlay);
    if (visibleMessages.length === 0 && !partnerTyping) return null;

    return (
      <div 
        className="absolute bottom-28 left-4 max-w-[280px] sm:max-w-[320px] flex flex-col gap-2 z-20 pointer-events-none select-none animate-fade-in"
        style={{ bottom: 'calc(env(safe-area-inset-bottom) + 90px)' }}
      >
        <div className="flex flex-col justify-end gap-1.5 pr-2">
          {visibleMessages.slice(-3).map((msg) => {
            const isSelf = msg.senderSessionId === selfSessionId;
            return (
              <div
                key={msg.id}
                className={cn(
                  "flex flex-col gap-0.5 rounded-[18px] rounded-tl-none py-2 px-3.5 shadow-lg max-w-[90%] transition-all duration-300 scale-100 translate-y-0",
                  isSelf
                    ? "bg-amber-500/25 backdrop-blur-md border border-amber-500/15 text-stone-100 self-start"
                    : "bg-stone-900/40 backdrop-blur-md border border-white/5 text-white/90 self-start"
                )}
              >
                <span className="text-[9px] text-white/40 font-bold uppercase tracking-wider">
                  {isSelf ? 'You' : 'Partner'}
                </span>
                <p className="text-[13px] leading-relaxed break-words font-medium tracking-wide drop-shadow-md">
                  {msg.message}
                </p>
              </div>
            );
          })}

          {/* Typing indicator bubble */}
          {partnerTyping && (
            <div className="flex items-center gap-2 bg-stone-900/40 backdrop-blur-md border border-white/5 text-white/50 rounded-full px-3.5 py-2 self-start animate-fade-in shadow-lg">
              <span className="flex gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-white/60 animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1.5 h-1.5 rounded-full bg-white/60 animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1.5 h-1.5 rounded-full bg-white/60 animate-bounce" style={{ animationDelay: '300ms' }} />
              </span>
              <span className="text-[11px] font-bold tracking-wide uppercase">Typing</span>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── RENDER EXPANDED DRAWER MODE (Instagram DM Half/Full Sheet) ──
  return (
    <div className="absolute inset-0 bg-black/45 backdrop-blur-[4px] z-40 flex flex-col justify-end select-none animate-fade-in">
      
      {/* Invisible tap-to-close area on top */}
      <div className="flex-1 w-full" onClick={onClose} />

      {/* Slide up sheet */}
      <div 
        className={cn(
          "w-full bg-stone-950/95 backdrop-blur-2xl border-t border-white/10 rounded-t-[24px] shadow-[0_-16px_48px_rgba(0,0,0,0.8)] flex flex-col transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] pointer-events-auto",
          isExpandedFull ? "h-[88vh]" : "h-[70vh] sm:h-[45vh]"
        )}
      >
        {/* Drag sheet handle */}
        <div 
          onTouchStart={(e) => {
            const touch = e.touches[0];
            (e.currentTarget as any)._startY = touch.clientY;
            (e.currentTarget as any)._isSwiping = true;
          }}
          onTouchMove={(e) => {
            const currentY = e.touches[0].clientY;
            const startY = (e.currentTarget as any)._startY || 0;
            const diffY = currentY - startY;
            if (diffY > 0) {
              const sheetEl = e.currentTarget.parentElement;
              if (sheetEl) sheetEl.style.transform = `translateY(${diffY}px)`;
            }
          }}
          onTouchEnd={(e) => {
            const startY = (e.currentTarget as any)._startY || 0;
            const currentY = e.changedTouches[0].clientY;
            const diffY = currentY - startY;
            const sheetEl = e.currentTarget.parentElement;
            if (sheetEl) sheetEl.style.transform = '';
            
            if (diffY > 80) {
              onClose();
            } else if (diffY > 20) {
              // Toggle expansion instead
              setIsExpandedFull(false);
            }
          }}
          onClick={() => setIsExpandedFull(!isExpandedFull)}
          className="w-full py-2.5 cursor-pointer flex justify-center hover:bg-white/[0.02]"
        >
          <div className="w-12 h-1.5 rounded-full bg-white/20 hover:bg-white/40 transition-colors" />
        </div>

        {/* Drawer Header */}
        <div className="px-5 pb-3 border-b border-white/5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse" />
            <h3 className="text-sm font-bold text-white tracking-wide">Live Conversation</h3>
          </div>
          <button 
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-white/5 flex items-center justify-center text-white/50 hover:text-white hover:bg-white/10 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Messages List Area */}
        <div className="flex-1 overflow-y-auto p-5 space-y-3.5 scrollbar-none">
          {messages.length === 0 ? (
            /* Beautiful empty skeleton state */
            <div className="h-full flex flex-col items-center justify-center text-center p-4">
              <span className="text-3xl mb-2 animate-bounce">👋</span>
              <p className="text-stone-100 font-extrabold text-sm tracking-wide">Say hello!</p>
              <p className="text-[11px] text-stone-500 mt-1 max-w-[220px]">
                People respond twice as fast when you start with a friendly introduction.
              </p>
            </div>
          ) : (
            messages.map((msg) => {
              const isSelf = msg.senderSessionId === selfSessionId;
              return (
                <div
                  key={msg.id}
                  className={cn(
                    "flex flex-col gap-1 max-w-[80%] animate-spring-in",
                    isSelf ? "self-end items-end ml-auto" : "self-start items-startmr-auto"
                  )}
                >
                  <div
                    className={cn(
                      "py-2 px-3.5 rounded-[18px] shadow-md break-words text-[13px] font-medium leading-relaxed tracking-wide",
                      isSelf
                        ? "bg-amber-500 border border-amber-400 text-stone-950 rounded-tr-none"
                        : "bg-stone-900 border border-white/5 text-stone-100 rounded-tl-none"
                    )}
                  >
                    {msg.message}
                  </div>
                  {isSelf && renderStatus(msg.status)}
                </div>
              )
            })
          )}

          {/* Typing Indicator bubbles (iMessage style loop) */}
          {partnerTyping && (
            <div className="flex items-center gap-1.5 bg-stone-900 border border-white/5 text-white/60 rounded-[18px] rounded-tl-none px-3.5 py-2.5 self-start animate-fade-in shadow-md">
              <span className="flex gap-1.5 mt-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-white/70 animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1.5 h-1.5 rounded-full bg-white/77 animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1.5 h-1.5 rounded-full bg-white/85 animate-bounce" style={{ animationDelay: '300ms' }} />
              </span>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Quick Emoji Picker Row */}
        <div className="px-4 py-1.5 border-t border-white/[0.03] flex items-center justify-between overflow-x-auto scrollbar-none gap-2.5">
          {EMOJIS.map((e) => (
            <button
              key={e}
              type="button"
              onClick={() => addEmoji(e)}
              className="text-lg hover:scale-125 active:scale-90 hover:-translate-y-0.5 transition-all duration-200"
            >
              {e}
            </button>
          ))}
        </div>

        {/* Input Form Bar */}
        <form 
          onSubmit={handleSend}
          className="p-4 border-t border-white/5 bg-stone-950/40 flex items-center gap-3"
        >
          <div className="flex-1 bg-stone-900 border border-white/5 rounded-2xl px-4 py-3 flex items-center gap-2">
            <input
              ref={inputRef}
              type="text"
              placeholder="Message partner..."
              value={inputText}
              onChange={handleInputChange}
              className="flex-1 bg-transparent border-0 text-white placeholder-white/30 text-sm font-medium focus:ring-0 focus:outline-none py-0"
            />
          </div>

          <button
            type="submit"
            disabled={!inputText.trim()}
            className="w-11 h-11 rounded-2xl bg-amber-500 border border-amber-400 text-stone-950 flex items-center justify-center disabled:opacity-30 disabled:hover:bg-amber-500 hover:scale-[1.05] active:scale-[0.95] transition-all duration-200"
          >
            <svg className="w-4.5 h-4.5 transform rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </button>
        </form>
      </div>
    </div>
  );
}

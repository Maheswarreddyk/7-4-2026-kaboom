import React, { useState, useEffect, useRef } from 'react';
import { cn } from '../utils/index.js';

interface TemporaryChatProps {
  isOpen: boolean;
  onClose: () => void;
  messages: Array<{ id: string; senderSessionId: string; message: string; createdAt: number }>;
  onSendMessage: (msg: string) => void;
  selfSessionId: string;
  partnerTyping: boolean;
  onTyping: (typing: boolean) => void;
}

const EMOJIS = ['👋', '😊', '😂', '🔥', '❤️', '👍', '🎉', '🙏'];

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
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [pinnedIds, setPinnedIds] = useState<Set<string>>(new Set());
  const [now, setNow] = useState(Date.now());
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Update time reference every 500ms for accurate message decay transitions
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(interval);
  }, []);

  // Auto-scroll to bottom of the message container when a new message arrives
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input when input bar opens
  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
    }
  }, [isOpen]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    onSendMessage(inputText.trim());
    setInputText('');
    onTyping(false);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    
    setTimeout(() => {
      inputRef.current?.focus();
    }, 50);
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
    setInputText((prev) => prev + emoji);
    setShowEmojiPicker(false);
    inputRef.current?.focus();
  };

  const togglePin = (id: string) => {
    setPinnedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Only render container if there are messages or the input/typing bar is active
  const hasMessagesToShow = messages.some(msg => pinnedIds.has(msg.id) || (now - msg.createdAt < 20000));
  if (!hasMessagesToShow && !isOpen && !partnerTyping) return null;

  return (
    <div 
      className="absolute bottom-28 left-4 max-w-[280px] sm:max-w-[320px] flex flex-col gap-2 z-20 pointer-events-none select-none transition-all duration-300"
      style={{
        bottom: isOpen ? 'calc(env(safe-area-inset-bottom) + 96px)' : 'calc(env(safe-area-inset-bottom) + 88px)'
      }}
    >
      {/* ── FLOATING MESSAGE BUBBLES ── */}
      <div className="flex flex-col justify-end overflow-hidden max-h-[220px] sm:max-h-[300px] pointer-events-none">
        <div className="flex flex-col justify-end gap-1.5 overflow-y-auto scrollbar-none pr-2">
          {messages.map((msg) => {
            const isSelf = msg.senderSessionId === selfSessionId;
            const isPinned = pinnedIds.has(msg.id);
            const age = now - msg.createdAt;
            const isExpired = age > 20000;
            const isVisible = isPinned || !isExpired;

            return (
              <div
                key={msg.id}
                onClick={() => togglePin(msg.id)}
                className={cn(
                  "flex flex-col gap-0.5 text-white/95 rounded-2xl rounded-tl-none max-w-[90%] pointer-events-auto cursor-pointer shadow-lg select-text",
                  isSelf 
                    ? "bg-indigo-600/35 backdrop-blur-md border border-indigo-500/25 self-start"
                    : "bg-zinc-900/35 backdrop-blur-md border border-white/10 self-start",
                  isVisible 
                    ? "opacity-100 max-h-[140px] scale-100 translate-y-0 py-2 px-3.5 transition-all duration-500 ease-out" 
                    : "opacity-0 max-h-0 scale-90 -translate-y-4 overflow-hidden py-0 px-3.5 pointer-events-none transition-all duration-700 ease-in-out"
                )}
              >
                <div className="flex items-center gap-1.5 justify-between">
                  <span className="text-[10px] text-white/50 font-medium">
                    {isSelf ? 'You' : 'Partner'}
                  </span>
                  {isPinned && <span className="text-[10px]">📌</span>}
                </div>
                <p className="text-[13px] leading-relaxed break-words font-medium tracking-wide drop-shadow-md">
                  {msg.message}
                </p>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* ── TYPING STATUS BUBBLE ── */}
      {partnerTyping && (
        <div className="flex items-center gap-1.5 bg-zinc-950/40 backdrop-blur-md border border-white/10 text-white/60 rounded-full px-3 py-1.5 self-start text-xs pointer-events-auto animate-pulse">
          <span className="flex gap-0.5 mt-0.5">
            <span className="w-1.5 h-1.5 rounded-full bg-white/60 animate-bounce" />
            <span className="w-1.5 h-1.5 rounded-full bg-white/60 animate-bounce" style={{ animationDelay: '75ms' }} />
            <span className="w-1.5 h-1.5 rounded-full bg-white/60 animate-bounce" style={{ animationDelay: '150ms' }} />
          </span>
          <span className="text-[11px] font-medium tracking-wide">Typing</span>
        </div>
      )}

      {/* ── FLOATING INPUT BAR ── */}
      {isOpen && (
        <form 
          onSubmit={handleSend} 
          className="flex items-center gap-2 p-1.5 bg-zinc-950/75 backdrop-blur-xl border border-white/10 rounded-2xl pointer-events-auto animate-spring-in shadow-2xl"
        >
          {/* Emoji Trigger */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              className="w-8 h-8 flex items-center justify-center text-sm rounded-xl hover:bg-white/10 transition-colors"
            >
              😀
            </button>
            {showEmojiPicker && (
              <div className="absolute bottom-full left-0 mb-2 p-1.5 bg-zinc-950 border border-white/10 rounded-2xl grid grid-cols-4 gap-1 shadow-2xl z-30">
                {EMOJIS.map((e) => (
                  <button
                    key={e}
                    type="button"
                    onClick={() => addEmoji(e)}
                    className="w-8 h-8 text-base hover:bg-white/10 rounded-xl flex items-center justify-center transition-transform hover:scale-115 active:scale-90"
                  >
                    {e}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Input field */}
          <input
            ref={inputRef}
            type="text"
            placeholder="Type a message..."
            value={inputText}
            onChange={handleInputChange}
            className="flex-1 min-w-0 bg-transparent border-0 text-white placeholder-white/30 text-[13px] font-medium focus:ring-0 focus:outline-none py-1.5"
          />

          {/* Close button */}
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center text-white/40 hover:text-white/70 rounded-xl transition-colors"
          >
            ✕
          </button>

          {/* Send Button */}
          <button
            type="submit"
            disabled={!inputText.trim()}
            className="w-8 h-8 flex items-center justify-center bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl disabled:opacity-30 disabled:hover:bg-indigo-600 transition-all active:scale-95"
          >
            <svg className="w-4 h-4 transform rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </button>
        </form>
      )}
    </div>
  );
}

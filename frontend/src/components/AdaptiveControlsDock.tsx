import { useResponsiveLayout } from '../hooks/useResponsiveLayout.js';
import { DockButton } from './DockButton.js';
import { OverflowMenu } from './OverflowMenu.js';

interface AdaptiveControlsDockProps {
  isMuted: boolean;
  isCameraOff: boolean;
  isFullscreen: boolean;
  onToggleMute: () => void;
  onToggleCamera: () => void;
  onNext: () => void;
  onReport: () => void;
  onLeave: () => void;
  onToggleFullscreen: () => void;
  disabled?: boolean;
  isChatOpen?: boolean;
  onToggleChat?: () => void;
  liked?: boolean;
  onLike?: () => void;
  onOpenPreferences?: () => void;
  unreadCount?: number;
}

export const Icons = {
  Settings: () => (
    <svg className="w-5 h-5 transition-transform duration-500 ease-out group-hover:rotate-[60deg]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  ),
  MicOn: () => (
    <svg className="w-5 h-5 transition-all duration-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
    </svg>
  ),
  MicOff: () => (
    <svg className="w-5 h-5 transition-all duration-300 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3l18 18" />
    </svg>
  ),
  CameraOn: () => (
    <svg className="w-5 h-5 transition-transform duration-300 ease-out group-hover:scale-110" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
    </svg>
  ),
  CameraOff: () => (
    <svg className="w-5 h-5 transition-all duration-300 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3l18 18" />
    </svg>
  ),
  LikeOn: () => (
    <svg className="w-5 h-5 text-red-500 fill-red-500 animate-heart-pop" viewBox="0 0 24 24">
      <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
    </svg>
  ),
  LikeOff: () => (
    <svg className="w-5 h-5 text-white/80 group-hover:text-red-400 group-hover:scale-110 transition-all duration-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
    </svg>
  ),
  Chat: () => (
    <svg className="w-5 h-5 transition-transform duration-300 group-hover:scale-105" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
    </svg>
  ),
  Next: () => (
    <svg className="w-6 h-6 text-white transition-transform duration-300 group-hover:translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
    </svg>
  ),
  Report: () => (
    <svg className="w-5 h-5 text-yellow-400 group-hover:scale-110 transition-transform duration-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
  ),
  Fullscreen: () => (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
    </svg>
  ),
  Leave: () => (
    <svg className="w-5 h-5 text-white rotate-[135deg]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.94.725l.548 2.2a1 1 0 01-.321.988l-1.305.98a10.582 10.582 0 004.872 4.872l.98-1.305a1 1 0 01.988-.321l2.2.548a1 1 0 01.725.94V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
    </svg>
  ),
};

/* ── DESKTOP DOCK (Expanded 9-button horizontal layout) ── */
function DesktopDock({ props }: { props: AdaptiveControlsDockProps }) {
  return (
    <div className="flex items-center justify-center gap-[var(--dock-gap)] p-[var(--dock-padding)] rounded-[var(--radius-large)] bg-black/45 backdrop-blur-2xl border border-white/5 shadow-[var(--shadow-elevation)] pointer-events-auto select-none">
      {props.onOpenPreferences && (
        <DockButton
          onClick={props.onOpenPreferences}
          icon={<Icons.Settings />}
          tooltip="Preferences"
        />
      )}

      <DockButton
        onClick={props.onToggleMute}
        icon={props.isMuted ? <Icons.MicOff /> : <Icons.MicOn />}
        warning={props.isMuted}
        disabled={props.disabled}
        tooltip={props.isMuted ? "Unmute Mic" : "Mute Mic"}
      />

      <DockButton
        onClick={props.onToggleCamera}
        icon={props.isCameraOff ? <Icons.CameraOff /> : <Icons.CameraOn />}
        warning={props.isCameraOff}
        disabled={props.disabled}
        tooltip={props.isCameraOff ? "Enable Camera" : "Disable Camera"}
      />

      <div className="h-6 w-px bg-white/10 mx-1 shrink-0" />

      {props.onLike && (
        <DockButton
          onClick={props.onLike}
          icon={props.liked ? <Icons.LikeOn /> : <Icons.LikeOff />}
          active={props.liked}
          disabled={props.disabled}
          soundType="like"
          tooltip="Like Partner"
        />
      )}

      {props.onToggleChat && (
        <DockButton
          onClick={props.onToggleChat}
          icon={<Icons.Chat />}
          active={props.isChatOpen}
          disabled={props.disabled}
          badgeCount={props.unreadCount}
          tooltip="Chat Drawer"
        />
      )}

      <DockButton
        onClick={props.onNext}
        icon={<Icons.Next />}
        active={true}
        disabled={props.disabled}
        soundType="swipe"
        className="w-14 h-14 bg-gradient-to-r from-amber-500 to-amber-600 border-amber-400 text-stone-950 hover:shadow-[0_8px_24px_rgba(245,166,35,0.35)]"
        tooltip="Next Partner"
      />

      <DockButton
        onClick={props.onReport}
        icon={<Icons.Report />}
        disabled={props.disabled}
        tooltip="Report Partner"
      />

      <DockButton
        onClick={props.onToggleFullscreen}
        icon={<Icons.Fullscreen />}
        active={props.isFullscreen}
        disabled={props.disabled}
        tooltip="Fullscreen View"
      />

      <DockButton
        onClick={props.onLeave}
        icon={<Icons.Leave />}
        danger={true}
        tooltip="End Call"
      />
    </div>
  );
}

/* ── TABLET DOCK (Constraint-based with Overflow Menu) ── */
function TabletDock({ props }: { props: AdaptiveControlsDockProps }) {
  return (
    <div className="flex items-center justify-center gap-[var(--dock-gap)] p-[var(--dock-padding)] rounded-[var(--radius-large)] bg-black/45 backdrop-blur-2xl border border-white/5 shadow-[var(--shadow-elevation)] pointer-events-auto select-none">
      
      {/* Critical Core Left */}
      <DockButton
        onClick={props.onToggleMute}
        icon={props.isMuted ? <Icons.MicOff /> : <Icons.MicOn />}
        warning={props.isMuted}
        disabled={props.disabled}
        tooltip={props.isMuted ? "Unmute Mic" : "Mute Mic"}
      />

      <DockButton
        onClick={props.onToggleCamera}
        icon={props.isCameraOff ? <Icons.CameraOff /> : <Icons.CameraOn />}
        warning={props.isCameraOff}
        disabled={props.disabled}
        tooltip={props.isCameraOff ? "Enable Camera" : "Disable Camera"}
      />

      {/* Important Center Docks */}
      {props.onLike && (
        <DockButton
          onClick={props.onLike}
          icon={props.liked ? <Icons.LikeOn /> : <Icons.LikeOff />}
          active={props.liked}
          disabled={props.disabled}
          soundType="like"
          tooltip="Like Partner"
        />
      )}

      {props.onToggleChat && (
        <DockButton
          onClick={props.onToggleChat}
          icon={<Icons.Chat />}
          active={props.isChatOpen}
          disabled={props.disabled}
          badgeCount={props.unreadCount}
          tooltip="Chat Drawer"
        />
      )}

      {/* Swipe Core */}
      <DockButton
        onClick={props.onNext}
        icon={<Icons.Next />}
        active={true}
        disabled={props.disabled}
        soundType="swipe"
        className="w-13 h-13 bg-gradient-to-r from-amber-500 to-amber-600 border-amber-400 text-stone-950 hover:shadow-[0_8px_24px_rgba(245,166,35,0.35)]"
        tooltip="Next Partner"
      />

      {/* Overflow Menu for Low Priority */}
      <OverflowMenu disabled={props.disabled}>
        {props.onOpenPreferences && (
          <DockButton
            onClick={props.onOpenPreferences}
            icon={<Icons.Settings />}
            tooltip="Preferences"
            className="w-10 h-10 border-white/10 bg-white/5"
          />
        )}
        <DockButton
          onClick={props.onReport}
          icon={<Icons.Report />}
          disabled={props.disabled}
          tooltip="Report Partner"
          className="w-10 h-10 border-white/10 bg-white/5"
        />
        <DockButton
          onClick={props.onToggleFullscreen}
          icon={<Icons.Fullscreen />}
          active={props.isFullscreen}
          disabled={props.disabled}
          tooltip="Fullscreen View"
          className="w-10 h-10 border-white/10 bg-white/5"
        />
      </OverflowMenu>

      {/* Critical Core Exit */}
      <DockButton
        onClick={props.onLeave}
        icon={<Icons.Leave />}
        danger={true}
        tooltip="End Call"
      />
    </div>
  );
}

/* ── MOBILE DOCK (FaceTime bottom + Right sidebar split layout) ── */
function MobileDock({ props }: { props: AdaptiveControlsDockProps }) {
  return (
    <div className="fixed inset-0 pointer-events-none z-30 select-none">
      {/* Permanent Bottom Row: Mic, Camera, End Call */}
      <div className="absolute bottom-[20px] left-[20px] flex items-center gap-3.5 pointer-events-auto">
        <DockButton
          onClick={props.onToggleMute}
          disabled={props.disabled}
          icon={props.isMuted ? <Icons.MicOff /> : <Icons.MicOn />}
          warning={props.isMuted}
          className="w-[50px] h-[50px] bg-black/45 backdrop-blur-xl border-white/5"
        />

        <DockButton
          onClick={props.onToggleCamera}
          disabled={props.disabled}
          icon={props.isCameraOff ? <Icons.CameraOff /> : <Icons.CameraOn />}
          warning={props.isCameraOff}
          className="w-[50px] h-[50px] bg-black/45 backdrop-blur-xl border-white/5"
        />

        {props.onLike && (
          <DockButton
            onClick={props.onLike}
            disabled={props.disabled}
            icon={props.liked ? <Icons.LikeOn /> : <Icons.LikeOff />}
            active={props.liked}
            soundType="like"
            className="w-[50px] h-[50px] bg-black/45 backdrop-blur-xl border-white/5"
          />
        )}
      </div>

      {/* Floating Right Stack: Settings, Report, Chat, Next, Leave */}
      <div className="absolute bottom-[20px] right-[20px] flex flex-col items-center gap-3.5 pointer-events-auto">
        {props.onOpenPreferences && (
          <DockButton
            onClick={props.onOpenPreferences}
            icon={<Icons.Settings />}
            className="w-[46px] h-[46px] bg-black/45 backdrop-blur-xl border-white/5"
          />
        )}

        <DockButton
          onClick={props.onReport}
          disabled={props.disabled}
          icon={<Icons.Report />}
          className="w-[46px] h-[46px] bg-black/45 backdrop-blur-xl border-white/5"
        />

        {props.onToggleChat && (
          <DockButton
            onClick={props.onToggleChat}
            disabled={props.disabled}
            icon={<Icons.Chat />}
            active={props.isChatOpen}
            badgeCount={props.unreadCount}
            className="w-[48px] h-[48px] bg-black/45 backdrop-blur-xl border-white/5 text-white/80"
          />
        )}

        {/* Large next swipe trigger */}
        <DockButton
          onClick={props.onNext}
          disabled={props.disabled}
          icon={<Icons.Next />}
          active={true}
          soundType="swipe"
          className="w-[65px] h-[65px] bg-gradient-to-r from-amber-500 to-amber-600 border-amber-400/40 text-stone-950 shadow-[0_8px_24px_rgba(245,166,35,0.35)]"
        />

        <DockButton
          onClick={props.onLeave}
          icon={<Icons.Leave />}
          danger={true}
          className="w-[46px] h-[46px]"
        />
      </div>
    </div>
  );
}

export function AdaptiveControlsDock(props: AdaptiveControlsDockProps) {
  const { dockMode } = useResponsiveLayout();

  switch (dockMode) {
    case 'mobile':
      return <MobileDock props={props} />;
    case 'tablet':
    case 'desktop-compact':
      return <TabletDock props={props} />;
    case 'desktop-expanded':
    default:
      return <DesktopDock props={props} />;
  }
}

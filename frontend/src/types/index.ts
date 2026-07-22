export type SessionStatus =
  | 'IDLE'
  | 'REQUESTING_MEDIA'
  | 'MEDIA_READY'
  | 'CONNECTING_REALTIME'
  | 'SEARCHING'
  | 'MATCH_FOUND'
  | 'READY'
  | 'NEGOTIATING'
  | 'ICE_CONNECTING'
  | 'CONNECTED'
  | 'PARTNER_LEFT'
  | 'REQUEUEING'
  | 'ENDED';
export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'failed' | 'reconnecting';
export type ReportReason = 'spam' | 'nudity' | 'abuse' | 'harassment' | 'other';

export interface SessionData {
  sessionId: string;
  sessionToken: string;
  createdAt: string;
  status?: string;
  activeMatch?: {
    matchId: string;
    partnerSessionId: string;
    isInitiator: boolean;
  } | null;
}

export interface StatsData {
  activeUsers: number;
  waitingUsers: number;
  matchesToday: number;
  onlineNow: number;
}

export interface IceServerConfig {
  urls: string | string[];
  username?: string;
  credential?: string;
}

export interface MatchedPayload {
  matchId: string;
  partnerSessionId: string;
  isInitiator: boolean;
  iceServers: IceServerConfig[];
  partnerProfile?: any;
  matchReasonMetadata?: any;
}

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info' | 'warning';
  message: string;
}

export interface ChatState {
  isMuted: boolean;
  isCameraOff: boolean;
  isFullscreen: boolean;
  matchStartTime: number | null;
  queuePosition: number;
  gender?: string;
  lookingFor?: string[];
  languages?: string[];
  country?: string;
  state?: string;
  district?: string;
  city?: string;
  interestTags?: string[];
  liked?: boolean;
  partnerLiked?: boolean;
  mutualLike?: boolean;
  messages?: Array<{ id: string; senderSessionId: string; message: string; createdAt: number }>;
  unreadCount?: number;
  isChatOpen?: boolean;
  partnerTyping?: boolean;
  connectionQuality?: 'excellent' | 'good' | 'poor' | null;
  reconnectCountdown?: number | null;
  partnerProfile?: {
    displayName: string;
    bio?: string;
    matchMode?: 'RANDOM' | 'PREFER' | 'STRICT' | 'SMART' | 'EXACT';
    matchConstraints?: Record<string, boolean>;
    matchAttributes?: Record<string, string[]>;
    city?: string | null;
    state?: string | null;
    country?: string | null;
    gender?: string | null;
    lookingFor?: string[];
    languages?: string[];
    interestTags?: string[];
  } | null;
  matchReasonMetadata?: {
    reason: 'strict_filters' | 'prefer_filters' | 'random';
    confidence: number;
    matchedBy: string[];
  } | null;
  partnerSkipPending?: boolean;
  partnerLeftCountdown?: number | null;
  // Deprecated fields kept for backwards compatibility with useVideoChat.ts hooks
  status?: string;
  connectionStatus?: 'disconnected' | 'connecting' | 'connected' | 'failed' | 'reconnecting' | null;
  partnerSessionId?: string | null;
  matchId?: string | null;
}

export const REPORT_REASONS: { value: ReportReason; label: string }[] = [
  { value: 'spam', label: 'Spam' },
  { value: 'nudity', label: 'Nudity' },
  { value: 'abuse', label: 'Abuse' },
  { value: 'harassment', label: 'Harassment' },
  { value: 'other', label: 'Other' },
];

export const STORAGE_KEYS = {
  SESSION_ID: 'indiatv_session_id',
  SESSION_TOKEN: 'indiatv_session_token',
} as const;

export type UserBehavior = 
  | 'HAPPY_PATH'
  | 'SKIP_EARLY'
  | 'HARD_CLOSE'
  | 'NETWORK_INTERRUPT'
  | 'REFRESH'
  | 'ABANDON_QUEUE'
  | 'DELAYED_JOIN';

export interface ScenarioConfig {
  mode: 'RANDOM' | 'PREFER' | 'STRICT';
  tags: string[];
  namePrefix: string;
}

export interface ActionLog {
  timestamp: string;
  previousState: string;
  currentState: string;
  action: string;
  result: string;
  durationMs: number;
  success: boolean;
  error?: string;
}

export interface UserAuditTrail {
  userId: string;
  sessionId: string;
  browserContextId: string;
  behavior: UserBehavior;
  profile?: {
    name: string;
    gender: string;
    lookingFor: string;
    bio: string;
  };
  
  joinTime?: string;
  queueEntryTime?: string;
  matchTime?: string;
  matchId?: string;
  partnerUserId?: string;
  
  totalQueueWaitTimeMs: number;
  totalConnectionEstablishmentTimeMs: number;
  totalConnectedDurationMs: number;
  disconnectTime?: string;
  finalOutcome: string;
  
  actions: ActionLog[];
  matchAnalysis?: {
    matchScore: number;
    matchCriteriaUsed: any;
    queuePosition: number;
    waitingTimeComparison: number;
    preferenceApplied: any;
    reservationDetails: any;
    backendDecisionPath: string[];
  };
}

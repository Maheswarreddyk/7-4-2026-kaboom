type Listener = (...args: any[]) => void;

class EventEmitter {
  private events: Record<string, Listener[]> = {};

  on(event: string, listener: Listener): this {
    if (!this.events[event]) this.events[event] = [];
    this.events[event].push(listener);
    return this;
  }

  off(event: string, listener: Listener): this {
    if (!this.events[event]) return this;
    this.events[event] = this.events[event].filter(l => l !== listener);
    return this;
  }

  emit(event: string, ...args: any[]): boolean {
    if (!this.events[event]) return false;
    this.events[event].forEach(l => l(...args));
    return true;
  }
}

export type LifecycleState = 
  | 'HOME'          // Idle on home screen
  | 'CONFIGURING'   // Modifying settings/filters. Queue blocked.
  | 'QUEUEING'      // Waiting for a match
  | 'MATCH_FOUND'   // Match assigned by backend, setting up
  | 'NEGOTIATING'   // WebRTC offer/answer exchange
  | 'MEDIA_SETUP'   // Waiting for local and remote video tracks to flow
  | 'CONNECTED'     // Both peers have media, fully active chat
  | 'TEARDOWN'      // Cleaning up connection to return to QUEUEING or HOME
  | 'ENDED';        // End of session, logging out or fatal error

export interface LifecycleEvent {
  state: LifecycleState;
  metadata?: any;
}

export class LifecycleManager extends EventEmitter {
  private static instance: LifecycleManager;
  private currentState: LifecycleState = 'HOME';
  private matchId: string | null = null;
  private partnerSessionId: string | null = null;
  private isInitiator: boolean = false;

  private constructor() {
    super();
  }

  public static getInstance(): LifecycleManager {
    if (!LifecycleManager.instance) {
      LifecycleManager.instance = new LifecycleManager();
    }
    return LifecycleManager.instance;
  }

  public getState(): LifecycleState {
    return this.currentState;
  }

  public getMatchInfo() {
    return {
      matchId: this.matchId,
      partnerSessionId: this.partnerSessionId,
      isInitiator: this.isInitiator,
    };
  }

  /**
   * Internal transition method. Broadcasts state changes.
   */
  private transitionTo(newState: LifecycleState, metadata?: any) {
    console.log(`[LifecycleManager] Transition: ${this.currentState} -> ${newState}`, metadata);
    this.currentState = newState;
    this.emit('stateChanged', { state: newState, metadata });
  }

  // ==========================================
  // Public Actions (Atomic Transitions)
  // ==========================================

  public enterConfiguring() {
    if (this.currentState === 'CONFIGURING') return;
    
    // Valid from HOME or QUEUEING. 
    // If in MATCH_FOUND, NEGOTIATING, MEDIA_SETUP, or CONNECTED, 
    // we must reject this unless we forcibly leave the chat (which we probably shouldn't do without warning).
    // For now, if they are in queue, they can open settings.
    if (['HOME', 'QUEUEING'].includes(this.currentState)) {
      this.transitionTo('CONFIGURING');
    } else {
      console.warn(`[LifecycleManager] Cannot enter CONFIGURING from ${this.currentState}`);
      throw new Error(`Cannot enter Settings while ${this.currentState}`);
    }
  }

  public exitConfiguring(resumeQueue: boolean) {
    if (this.currentState !== 'CONFIGURING') return;
    
    if (resumeQueue) {
      this.transitionTo('QUEUEING');
    } else {
      this.transitionTo('HOME');
    }
  }

  public joinQueue() {
    if (['HOME', 'CONFIGURING', 'TEARDOWN'].includes(this.currentState)) {
      this.transitionTo('QUEUEING');
    } else {
      console.warn(`[LifecycleManager] Cannot join queue from ${this.currentState}`);
    }
  }

  public leaveQueue() {
    if (this.currentState === 'QUEUEING') {
      this.transitionTo('HOME');
    }
  }

  public onMatchFound(data: { matchId: string, partnerSessionId: string, isInitiator: boolean }) {
    // If the user entered CONFIGURING (Settings) right as the match arrived, reject it immediately.
    if (this.currentState === 'CONFIGURING') {
      console.warn(`[LifecycleManager] Ghost Match Prevented! User is CONFIGURING. Rejecting match ${data.matchId}.`);
      this.abortMatch(data.matchId);
      return;
    }

    if (this.currentState !== 'QUEUEING') {
      console.warn(`[LifecycleManager] Ignored onMatchFound. Current state: ${this.currentState}`);
      return;
    }

    this.matchId = data.matchId;
    this.partnerSessionId = data.partnerSessionId;
    this.isInitiator = data.isInitiator;
    this.transitionTo('MATCH_FOUND', data);
  }

  public onNegotiating() {
    if (this.currentState === 'MATCH_FOUND') {
      this.transitionTo('NEGOTIATING');
    }
  }

  public onMediaSetup() {
    if (['MATCH_FOUND', 'NEGOTIATING'].includes(this.currentState)) {
      this.transitionTo('MEDIA_SETUP');
    }
  }

  public onConnected() {
    if (this.currentState === 'MEDIA_SETUP' || this.currentState === 'NEGOTIATING') {
      this.transitionTo('CONNECTED');
    }
  }

  public skip() {
    if (['MATCH_FOUND', 'NEGOTIATING', 'MEDIA_SETUP', 'CONNECTED'].includes(this.currentState)) {
      this.transitionTo('TEARDOWN', { reason: 'local_skip' });
      this.cleanupState();
    } else {
      console.warn(`[LifecycleManager] Cannot skip from ${this.currentState}`);
    }
  }

  public onPartnerLeft(reason: string = 'partner_left') {
    if (['MATCH_FOUND', 'NEGOTIATING', 'MEDIA_SETUP', 'CONNECTED'].includes(this.currentState)) {
      this.transitionTo('TEARDOWN', { reason });
      this.cleanupState();
    }
  }

  public requeueAfterTeardown() {
    if (this.currentState === 'TEARDOWN') {
      this.transitionTo('QUEUEING');
    }
  }
  
  public goHome() {
    if (this.currentState !== 'ENDED') {
      this.transitionTo('HOME');
      this.cleanupState();
    }
  }

  private abortMatch(matchId: string) {
    // Fire and forget: tell backend we are aborting because we are in settings
    this.emit('abortMatch', { matchId });
  }

  private cleanupState() {
    this.matchId = null;
    this.partnerSessionId = null;
    this.isInitiator = false;
  }
}

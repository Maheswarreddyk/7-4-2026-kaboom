export type StartupState =
  | 'BOOTING'
  | 'STARTING_HTTP'
  | 'CONNECTING_DATABASE'
  | 'INITIALIZING_SERVICES'
  | 'READY'
  | 'DEGRADED'
  | 'FAILED';

export interface StartupProgress {
  state: StartupState;
  progress: number;
  stage: string;
}

const STATE_PROGRESS_MAP: Record<StartupState, number> = {
  BOOTING: 10,
  STARTING_HTTP: 30,
  CONNECTING_DATABASE: 50,
  INITIALIZING_SERVICES: 80,
  READY: 100,
  DEGRADED: 100,
  FAILED: 0,
};

const STATE_STAGE_MAP: Record<StartupState, string> = {
  BOOTING: 'Loading application',
  STARTING_HTTP: 'Starting web server',
  CONNECTING_DATABASE: 'Connecting database',
  INITIALIZING_SERVICES: 'Initializing services',
  READY: 'Ready',
  DEGRADED: 'Running in degraded mode',
  FAILED: 'Failed to start',
};

class StartupManager {
  private currentState: StartupState = 'BOOTING';
  private currentStage: string = STATE_STAGE_MAP.BOOTING;
  private currentProgress: number = STATE_PROGRESS_MAP.BOOTING;
  // Hardcoded to 15.0 to represent this V15 certification version
  private appVersion: string = process.env.npm_package_version || '15.0';

  public setState(state: StartupState, customStage?: string) {
    this.currentState = state;
    this.currentStage = customStage || STATE_STAGE_MAP[state];
    this.currentProgress = STATE_PROGRESS_MAP[state];
    
    // Structured Boot Logging
    console.log(`[BOOT] ${this.currentStage} (${this.currentProgress}%)`);
  }

  public getState(): StartupState {
    return this.currentState;
  }

  public getProgressInfo(): StartupProgress {
    return {
      state: this.currentState,
      progress: this.currentProgress,
      stage: this.currentStage,
    };
  }

  public getVersion(): string {
    return this.appVersion;
  }
}

export const startupManager = new StartupManager();

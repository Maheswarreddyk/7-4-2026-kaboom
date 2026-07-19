import { BrowserContext, Page } from 'playwright';
import { v4 as uuidv4 } from 'uuid';
import { UserBehavior, ScenarioConfig } from './types';
import { store } from './store';
import { config } from './config';

export class UserSimulation {
  public userId: string;
  public sessionId: string = '';
  public behavior: UserBehavior;
  
  private context: BrowserContext;
  private page: Page | null = null;
  private state: string = 'INITIAL';
  public scenario: ScenarioConfig;
  
  constructor(context: BrowserContext, behavior: UserBehavior, scenario: ScenarioConfig) {
    this.userId = uuidv4();
    this.context = context;
    this.behavior = behavior;
    this.scenario = scenario;
    store.initTrail(this.userId, this.sessionId, this.context.browser()?.version() || 'unknown', this.behavior);
    store.updateTrail(this.userId, {
      scenarioMode: scenario.mode,
      scenarioTags: scenario.tags
    } as any);
  }

  private async logTransition(action: string, newState: string, result: string, durationMs: number, success: boolean, error?: string) {
    store.logAction(this.userId, {
      timestamp: new Date().toISOString(),
      previousState: this.state,
      currentState: newState,
      action,
      result,
      durationMs,
      success,
      error
    });
    this.state = newState;
  }

  public async run() {
    const start = Date.now();
    try {
      this.page = await this.context.newPage();
      this.page.on('console', msg => console.log(`[Browser ${this.userId.slice(0,4)}] ${msg.type()}: ${msg.text()}`));
      
      // Navigate to homepage first to establish origin for localStorage
      await this.page.goto(config.TARGET_URL);
      
      // Randomize Profile
      const genders = ['MALE', 'FEMALE', 'NONBINARY', 'ANY'];
      const lookingFors = ['MALE', 'FEMALE', 'NONBINARY', 'ANY'];
      const myGender = genders[Math.floor(Math.random() * genders.length)];
      const lookingFor = lookingFors[Math.floor(Math.random() * lookingFors.length)];
      const myName = `${this.scenario.namePrefix}_${this.userId.split('-')[0]}`;
      const myBio = `I am a digital twin (Behavior: ${this.behavior}, Mode: ${this.scenario.mode}).`;
      
      store.updateTrail(this.userId, { 
        profile: {
          name: myName,
          gender: myGender,
          lookingFor: lookingFor,
          bio: myBio
        }
      });

      // Bypass Onboarding Modal and Setup Scenario Match Mode
      const scenarioMode = this.scenario.mode;
      const scenarioTags = JSON.stringify(this.scenario.tags);
      await this.page.evaluate(({ myName, myBio, myGender, lookingFor, scenarioMode, scenarioTags }) => {
        localStorage.setItem('kaboom_display_name', myName);
        localStorage.setItem('kaboom_bio', myBio);
        localStorage.setItem('kaboom_gender', myGender);
        localStorage.setItem('kaboom_looking_for', JSON.stringify([lookingFor]));
        localStorage.setItem('kaboom_match_mode', scenarioMode);
        localStorage.setItem('kaboom_interest_tags', scenarioTags);
      }, { myName, myBio, myGender, lookingFor, scenarioMode, scenarioTags });

      // Navigate to chat
      await this.page.goto(`${config.TARGET_URL}/chat`, { waitUntil: 'networkidle' });
      await this.logTransition('Navigate', 'CHAT_PAGE', 'Loaded', Date.now() - start, true);

      // Extract Session ID from localStorage (set by frontend initialization)
      this.sessionId = await this.page.evaluate(() => localStorage.getItem('indiatv_session_id') || '');
      if (!this.sessionId) {
        // If not immediately available, wait a bit
        await this.page.waitForTimeout(2000);
        this.sessionId = await this.page.evaluate(() => localStorage.getItem('indiatv_session_id') || '');
      }
      store.updateTrail(this.userId, { sessionId: this.sessionId });

      // Wait for Start Chat button (Lobby) or Allow Media Access
      const joinStart = Date.now();
      
      try {
        // Try to click Allow Media Access if we are prompted
        const allowBtn = this.page.locator('text="Allow Media Access"');
        await allowBtn.waitFor({ state: 'visible', timeout: 5000 });
        await allowBtn.click();
      } catch (e) {
        // May have auto-started if permissions were pre-granted
      }

      store.updateTrail(this.userId, { joinTime: new Date().toISOString() });
      await this.logTransition('ClickStartChat', 'QUEUEING', 'Joined queue', Date.now() - joinStart, true);
      store.updateTrail(this.userId, { queueEntryTime: new Date().toISOString() });

      // Wait for match
      const waitStart = Date.now();
      try {
        await this.page.waitForSelector('.remote-video, .video-chat-container', { timeout: 60000 });
        store.updateTrail(this.userId, { 
          matchTime: new Date().toISOString(),
          totalQueueWaitTimeMs: Date.now() - waitStart 
        });
        await this.logTransition('Matched', 'MATCHED', 'Found partner', Date.now() - waitStart, true);
      } catch (e) {
        if (this.behavior === 'ABANDON_QUEUE') {
          await this.logTransition('AbandonQueue', 'DISCONNECTED', 'Left queue', Date.now() - waitStart, true);
          return;
        }
        throw new Error('Timeout waiting for match');
      }

      // Read match info
      const matchId = await this.page.evaluate(() => window.sessionStorage.getItem('matchId') || 'unknown');
      store.updateTrail(this.userId, { matchId });

      // Simulate connection establishment
      const signalingStart = Date.now();
      // In a real browser, we check if the remote video starts playing
      try {
        await this.page.waitForFunction(() => {
          const v = document.querySelector('video.remote-video') as HTMLVideoElement;
          return v && v.readyState >= 3 && !v.paused;
        }, { timeout: 30000 });
        store.updateTrail(this.userId, { totalConnectionEstablishmentTimeMs: Date.now() - signalingStart });
        await this.logTransition('WebRTCConnected', 'CONNECTED', 'Media flowing', Date.now() - signalingStart, true);
      } catch (e) {
        await this.logTransition('WebRTCFailed', 'FAILED', 'Signaling/ICE failed', Date.now() - signalingStart, false, e instanceof Error ? e.message : 'Unknown');
        return;
      }

      // Connected! Follow behavior pattern
      const connectedStart = Date.now();
      if (this.behavior === 'SKIP_EARLY') {
        await this.page.waitForTimeout(5000);
        try {
          await this.page.click('button[title="Next Partner"]', { timeout: 5000 });
          await this.logTransition('ClickNext', 'DISCONNECTED', 'Skipped', Date.now() - connectedStart, true);
        } catch(e) {}
      } else if (this.behavior === 'HAPPY_PATH') {
        // Stay for 10s for smoke testing, normally 3 minutes
        const duration = 10000;
        await this.page.waitForTimeout(duration);
        
        try {
          // Click End Call in dock
          await this.page.click('button[title="End Call"]', { timeout: 5000 });
          // Click End Call in confirm popup
          await this.page.click('button:has-text("End Call")', { timeout: 5000 });
          await this.logTransition('ClickStop', 'DISCONNECTED', 'Finished chat', Date.now() - connectedStart, true);
        } catch(e) {}
      } else if (this.behavior === 'HARD_CLOSE') {
        await this.page.waitForTimeout(10000);
        await this.page.close();
        await this.logTransition('HardClose', 'CLOSED', 'Tab closed abruptly', Date.now() - connectedStart, true);
      }

      store.updateTrail(this.userId, {
        totalConnectedDurationMs: Date.now() - connectedStart,
        disconnectTime: new Date().toISOString(),
        finalOutcome: 'COMPLETED'
      });

    } catch (e) {
      await this.logTransition('Error', 'ERROR', 'Unhandled error', Date.now() - start, false, e instanceof Error ? e.message : 'Unknown');
      store.updateTrail(this.userId, { finalOutcome: 'ERROR' });
    } finally {
      if (this.page && !this.page.isClosed()) {
        await this.page.close();
      }
    }
  }
}

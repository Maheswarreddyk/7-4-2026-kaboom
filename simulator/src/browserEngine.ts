import { chromium, firefox, webkit, Browser, BrowserContext } from 'playwright';
import { SimulatedUser } from './generator.js';
import { MatrixContext, BROWSER_MATRIX } from './matrix.js';
import { ChaosEngine } from './chaosEngine.js';

export class BrowserEngine {
  private browsers: Map<string, Browser> = new Map();
  private activeContexts: Map<string, BrowserContext> = new Map();

  public async initialize(): Promise<void> {
    console.log('🌐 Starting Playwright Multi-Browser Engine (Phase 3 Matrix)...');
    
    // We launch all 3 engines to support the full matrix
    const launchArgs = [
      '--use-fake-ui-for-media-stream',
      '--use-fake-device-for-media-stream',
      '--disable-web-security'
    ];
    
    this.browsers.set('chromium', await chromium.launch({ headless: true, args: launchArgs }));
    // Firefox and WebKit don't support the exact same flags for fake media, but Playwright headless provides basic mocks or we pass generic args
    this.browsers.set('firefox', await firefox.launch({ headless: true, firefoxUserPrefs: { 'media.navigator.permission.disabled': true, 'media.navigator.streams.fake': true } }));
    // WebKit has limited fake media support, but we attempt to run it for signaling and state verification
    this.browsers.set('webkit', await webkit.launch({ headless: true }));
  }

  public async spawnUser(user: SimulatedUser, matrixProfile: MatrixContext, chaosEngine: ChaosEngine | null = null, targetUrl: string = 'http://127.0.0.1:4173'): Promise<void> {
    const browser = this.browsers.get(matrixProfile.browser);
    if (!browser) throw new Error(`Browser engine ${matrixProfile.browser} not initialized`);

    console.log(`[Browser] Spawning isolated context for ${user.id} at T+${user.arrivalTimeMs}ms using ${matrixProfile.id}`);

    const contextOptions: any = {
      userAgent: matrixProfile.userAgent,
      viewport: matrixProfile.viewport,
    };
    if (matrixProfile.browser === 'chromium') {
      contextOptions.permissions = ['camera', 'microphone'];
    }

    const context = await browser.newContext(contextOptions);

    // Emulate network quality
    if (user.behavior.networkQuality === 'poor') {
      await context.route('**/*', (route) => {
        setTimeout(() => route.continue(), 1500); // 1.5s latency injection
      });
    }

    await context.addInitScript(() => {
      localStorage.setItem('kaboom_display_name', 'SimUser');
      localStorage.setItem('kaboom_tutorial_seen', 'true');
      localStorage.setItem('kaboom_match_mode', 'RANDOM');
    });

    this.activeContexts.set(user.id, context);
    const page = await context.newPage();

    if (chaosEngine) {
      await chaosEngine.injectFaults(page, context, user.id);
    }

    // --- PHASE 1: EXPANDED OBSERVABILITY ---
    page.on('console', msg => {
      const text = msg.text();
      // Filter out noisy React warnings, focus on our structured logs
      if (text.includes('[Lifecycle]') || text.includes('[WebRTC]') || text.includes('[Realtime]') || text.includes('[Kaboom]')) {
        console.log(`[Client:${user.id}] ${text}`);
      }
    });

    page.on('pageerror', error => {
      console.error(`[Client:${user.id}] UNCAUGHT EXCEPTION:`, error);
    });

    page.on('requestfailed', request => {
      console.error(`[Client:${user.id}] Network Request Failed: ${request.url()} - ${request.failure()?.errorText}`);
    });
    // ----------------------------------------

    try {
      await page.goto(targetUrl);
      console.log(`[Browser] ${user.id} landed on ${targetUrl}`);

      await page.waitForSelector('button:has-text("Resume")', { timeout: 10000 }).catch(() => {});
      await page.click('button:has-text("Resume")', { force: true, timeout: 5000 }).catch(() => {});

      // Simulated behaviors based on profile and behavior settings
      
      // 1. Randomly decide if they will use filters (50% chance)
      if (Math.random() < 0.5) {
        // Wait for the Edit button to appear and click it
        const editBtn = page.locator('button:has-text("Edit")').first();
        await editBtn.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});
        if (await editBtn.isVisible().catch(()=>false)) {
          await editBtn.click({ force: true }).catch(() => {});
          
          // Click the LANGUAGES tab
          await page.click('button:has-text("LANGUAGE")', { force: true }).catch(() => {});
          
          // Click a random language based on their profile
          if (user.profile.languages.length > 0) {
            const lang = user.profile.languages[0];
            await page.click(`button:has-text("${lang}")`, { force: true }).catch(() => {});
          }

          // Depending on matchMode, click the appropriate join button
          if (user.profile.matchMode === 'STRICT') {
            await page.click('button:has-text("Exact Match")', { force: true }).catch(() => {});
          } else {
            await page.click('button:has-text("Smart Match")', { force: true }).catch(() => {});
          }
        }
      }

      // 2. Stay on page for their patience duration, or until they skip
      const loopIntervalMs = 5000;
      let elapsed = 0;

      while (elapsed < user.behavior.patienceMs) {
        await page.waitForTimeout(loopIntervalMs);
        elapsed += loopIntervalMs;

        // --- PHASE 3: FAULT INJECTION & CHAOS MATRIX ---
        // 1. Random Refresh (Chaos)
        if (Math.random() < 0.05) { // 5% chance to randomly refresh the page during whatever they are doing
          console.log(`[Chaos:${user.id}] 🌪️ Injecting random page refresh!`);
          await page.reload({ waitUntil: 'networkidle' });
          continue; // skip the rest of this loop iteration
        }

        // 2. Double-Click Join Chaos (only on home screen)
        if (Math.random() < 0.05 && await page.locator('button:has-text("Resume")').isVisible().catch(()=>false)) {
          console.log(`[Chaos:${user.id}] 🌪️ Injecting Double-Click Join!`);
          await page.click('button:has-text("Resume")', { force: true, timeout: 5000 }).catch(()=>null);
          await page.waitForTimeout(50);
          await page.click('button:has-text("Resume")', { force: true, timeout: 5000 }).catch(()=>null);
        }
        // -----------------------------------------------

        // Skip logic
        if (Math.random() < user.behavior.skipProbability) {
          const skipBtn = page.locator('button:has-text("Skip")').first();
          if (await skipBtn.isVisible().catch(() => false)) {
            await skipBtn.click({ force: true }).catch(() => {});
          }
        }

        // Leave midway logic (disconnect early)
        if (Math.random() < user.behavior.leaveMidwayProbability) {
          break; // Exit the loop and close the context early
        }

        // --- PHASE 3.2/3.3: WEBRTC MEDIA & TURN VERIFICATION ---
        try {
          const statsResult = await page.evaluate(async () => {
            const pc = (window as any).__kaboom_pc as RTCPeerConnection | undefined;
            if (!pc || pc.connectionState !== 'connected') return null;

            const stats = await pc.getStats();
            let audioReceived = 0;
            let videoFramesDecoded = 0;
            let currentJitter = 0;
            let packetLoss = 0;
            let localCandidateType = 'unknown';
            let remoteCandidateType = 'unknown';

            let activeCandidatePairId = '';

            stats.forEach(report => {
              // Find the active candidate pair
              if (report.type === 'transport' && report.state === 'connected') {
                activeCandidatePairId = report.selectedCandidatePairId;
              }
              if (report.type === 'inbound-rtp') {
                if (report.kind === 'audio') {
                  audioReceived = report.bytesReceived || 0;
                  currentJitter = report.jitter || 0;
                  packetLoss = report.packetsLost || 0;
                }
                if (report.kind === 'video') {
                  videoFramesDecoded = report.framesDecoded || 0;
                }
              }
            });

            // If we found the active pair, find the candidate types
            if (activeCandidatePairId) {
              const pair = stats.get(activeCandidatePairId);
              if (pair) {
                const local = stats.get(pair.localCandidateId);
                const remote = stats.get(pair.remoteCandidateId);
                if (local) localCandidateType = local.candidateType;
                if (remote) remoteCandidateType = remote.candidateType;
              }
            }

            return {
              audioReceived,
              videoFramesDecoded,
              currentJitter,
              packetLoss,
              localCandidateType,
              remoteCandidateType,
            };
          });

          if (statsResult) {
            console.log(`[WebRTC-Stats:${user.id}] AudioBytes: ${statsResult.audioReceived}, VideoFrames: ${statsResult.videoFramesDecoded}, Jitter: ${statsResult.currentJitter.toFixed(3)}, Loss: ${statsResult.packetLoss}, Pair: ${statsResult.localCandidateType} <-> ${statsResult.remoteCandidateType}`);
          }
        } catch (e) {
          // ignore page.evaluate errors if context closed
        }
        // --------------------------------------------------------
      }

    } catch (error) {
      console.error(`[Browser] ${user.id} failed to complete user journey:`, error);
    } finally {
      // ALWAYS close the context to prevent memory leak and crashing the machine!
      await context.close();
      this.activeContexts.delete(user.id);
    }
  }

  public async teardown(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
    }
  }
}

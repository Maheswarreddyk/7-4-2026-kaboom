import { Page, BrowserContext } from 'playwright';

export class ChaosEngine {
  private active = false;

  public start() {
    this.active = true;
    console.log('[Chaos] Chaos Engine activated. Prepare for infrastructure turbulence.');
  }

  public async injectFaults(page: Page, context: BrowserContext, userId: string) {
    if (!this.active) return;

    const chaosType = Math.random();

    if (chaosType < 0.1) {
      // 10% chance: WebSocket Connection Drop (Abort Supabase Realtime)
      console.log(`[Chaos] Simulating WebSocket failure for ${userId}`);
      await page.route('wss://*.supabase.co/**', route => {
        // Abort the websocket upgrade request
        route.abort('failed');
      });
    } else if (chaosType < 0.2) {
      // 10% chance: Temporary Network Partition (Offline mode)
      console.log(`[Chaos] Simulating Network Partition for ${userId} (offline for 5s)`);
      await context.setOffline(true);
      setTimeout(async () => {
        try {
          await context.setOffline(false);
          console.log(`[Chaos] Network restored for ${userId}`);
        } catch (e) {
          // Context might be closed by the time timeout fires
        }
      }, 5000);
    } else if (chaosType < 0.3) {
      // 10% chance: Signaling Delay
      console.log(`[Chaos] Injecting Signaling Latency (2s - 5s) for ${userId}`);
      await page.route('**/api/match/**', async (route) => {
        const delay = Math.floor(Math.random() * 3000) + 2000;
        setTimeout(() => route.continue(), delay);
      });
    } else if (chaosType < 0.35) {
      // 5% chance: Browser Crash Simulation (OOM / Process killed)
      console.log(`[Chaos] Simulating Browser Crash for ${userId} in 3 seconds`);
      setTimeout(async () => {
        try {
          await page.close({ runBeforeUnload: false });
          console.log(`[Chaos] Page abruptly closed for ${userId} (Simulated Crash)`);
        } catch (e) {
          // Ignore
        }
      }, 3000);
    } else if (chaosType < 0.4) {
      // 5% chance: CPU Starvation
      console.log(`[Chaos] Injecting CPU Starvation for ${userId} in 5 seconds`);
      setTimeout(async () => {
        try {
          await page.evaluate(() => {
            console.warn('[Chaos] Simulating 3s Main Thread Block...');
            const start = Date.now();
            while (Date.now() - start < 3000) {} 
          });
        } catch (e) {
          // Ignore
        }
      }, 5000);
    }
  }
}

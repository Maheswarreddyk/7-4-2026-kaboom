import { SimulatedUser } from './generator.js';
import { BrowserEngine } from './browserEngine.js';
import { getRandomMatrixProfile } from './matrix.js';
import { ChaosEngine } from './chaosEngine.js';

export class SimulationRunner {
  private users: SimulatedUser[];
  private browserEngine: BrowserEngine;
  private isSoak: boolean;
  private soakInterval: ReturnType<typeof setInterval> | null = null;
  private chaosEngine: ChaosEngine | null = null;
  
  constructor(users: SimulatedUser[], isSoak: boolean = false, isChaos: boolean = false) {
    this.users = users;
    this.isSoak = isSoak;
    this.browserEngine = new BrowserEngine();
    if (isChaos) {
      this.chaosEngine = new ChaosEngine();
      this.chaosEngine.start();
    }
  }

  public async start(): Promise<void> {
    console.log(`[Runner] Starting simulation for ${this.users.length} users.`);
    
    await this.browserEngine.initialize();
    
    // Calculate total time
    const maxArrival = this.users[this.users.length - 1].arrivalTimeMs;
    console.log(`[Runner] Total virtual time scheduled: ${maxArrival / 1000}s`);

    // Phase 3.7 Resource Leak Detection (Soak Mode)
    if (this.isSoak) {
      console.log(`[Soak] Starting 60-minute resource leak detection mode...`);
      this.soakInterval = setInterval(() => {
        const memory = process.memoryUsage();
        console.log(`[Soak-Metrics] HeapUsed: ${(memory.heapUsed / 1024 / 1024).toFixed(2)} MB, RSS: ${(memory.rss / 1024 / 1024).toFixed(2)} MB`);
      }, 30000); // Log every 30s
    }

    // We schedule users based on arrivalTimeMs
    const promises = this.users.map(user => {
      return new Promise<void>((resolve) => {
        setTimeout(async () => {
          const matrixProfile = getRandomMatrixProfile();
          await this.browserEngine.spawnUser(user, matrixProfile, this.chaosEngine).catch(console.error);
          resolve();
        }, user.arrivalTimeMs);
      });
    });

    await Promise.all(promises);
  }

  public async teardown(): Promise<void> {
    if (this.soakInterval) clearInterval(this.soakInterval);
    await this.browserEngine.teardown();
  }
}

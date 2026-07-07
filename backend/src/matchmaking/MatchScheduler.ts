import { runGlobalMatchCycle } from './matchingEngine.js';
import { getSupabase } from '../database/client.js';
import { SCHEDULER_INTERVAL_MS } from './config.js';

let running = false;
let isCycleActive = false;
let schedulerTimeout: ReturnType<typeof setTimeout> | null = null;

/**
 * MatchScheduler
 *
 * Runs runGlobalMatchCycle() on a continuous loop (every SCHEDULER_INTERVAL_MS).
 * isCycleActive prevents the scheduler from spawning overlapping cycles.
 *
 * Phase 2: The scheduler now defers to a shared module-level mutex in matchService.ts
 * when triggered from a REST call. The scheduler's own isCycleActive guard prevents
 * self-overlap within the scheduler loop.
 */
export const MatchScheduler = {
  start() {
    if (running) return;
    running = true;
    console.log(`[MatchScheduler] Started (interval=${SCHEDULER_INTERVAL_MS}ms).`);
    void this.loop();
  },

  stop() {
    running = false;
    if (schedulerTimeout) {
      clearTimeout(schedulerTimeout);
      schedulerTimeout = null;
    }
    console.log('[MatchScheduler] Stopped.');
  },

  async loop() {
    if (!running) return;

    if (!isCycleActive) {
      isCycleActive = true;
      try {
        await runGlobalMatchCycle(getSupabase());
      } catch (error) {
        console.error('[MatchScheduler] Cycle error:', error instanceof Error ? error.message : error);
      } finally {
        isCycleActive = false;
      }
    } else {
      console.log('[MatchScheduler] Previous cycle still active — skipping this tick.');
    }

    schedulerTimeout = setTimeout(() => this.loop(), SCHEDULER_INTERVAL_MS);
  }
};

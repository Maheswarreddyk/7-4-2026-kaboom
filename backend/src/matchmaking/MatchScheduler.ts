import { SupabaseClient } from '@supabase/supabase-js';
import { runGlobalMatchCycle } from './matchingEngine.js';
import { getSupabase } from '../database/client.js';
import { SCHEDULER_INTERVAL_MS } from './config.js';

let running = false;
let isCycleActive = false;
let schedulerTimeout: ReturnType<typeof setTimeout> | null = null;

export const MatchScheduler = {
  start() {
    if (running) return;
    running = true;
    console.log(`[MatchScheduler] Continuous matching scheduler started (interval=${SCHEDULER_INTERVAL_MS}ms).`);
    void this.loop();
  },

  stop() {
    running = false;
    if (schedulerTimeout) {
      clearTimeout(schedulerTimeout);
      schedulerTimeout = null;
    }
    console.log('[MatchScheduler] Continuous matching scheduler stopped.');
  },

  async loop() {
    if (!running) return;
    if (!isCycleActive) {
      isCycleActive = true;
      try {
        const supabase = getSupabase();
        await runGlobalMatchCycle(supabase);
      } catch (error) {
        console.error('[MatchScheduler] Error in matching cycle:', error instanceof Error ? error.message : error);
      } finally {
        isCycleActive = false;
      }
    }
    schedulerTimeout = setTimeout(() => this.loop(), SCHEDULER_INTERVAL_MS);
  }
};

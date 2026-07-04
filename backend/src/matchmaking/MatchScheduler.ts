import { SupabaseClient } from '@supabase/supabase-js';
import { runGlobalMatchCycle } from './matchingEngine.js';
import { getSupabase } from '../database/client.js';

let running = false;
let isCycleActive = false;
let schedulerTimeout: ReturnType<typeof setTimeout> | null = null;

export const MatchScheduler = {
  start() {
    if (running) return;
    running = true;
    console.log('[MatchScheduler] Continuous matching scheduler started.');
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
        console.error('[MatchScheduler] Error in matching cycle:', error);
      } finally {
        isCycleActive = false;
      }
    }
    // Sleep for 1500ms before repeating
    schedulerTimeout = setTimeout(() => this.loop(), 1500);
  }
};

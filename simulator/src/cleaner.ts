import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '../.env') });

export class DatabaseCleaner {
  private supabase;

  constructor() {
    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      console.warn('[Cleaner] Missing Supabase credentials. Cannot execute cleanup.');
      this.supabase = null;
      return;
    }

    this.supabase = createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false }
    });
  }

  public async cleanSimulatorData(prefix: string = 'sim_user_'): Promise<void> {
    if (!this.supabase) return;

    console.log(`\n[Cleaner] Commencing database hygiene protocol for prefix: ${prefix}...`);

    try {
      // Clean analytics events
      await this.supabase.from('analytics_events').delete().like('user_id', `${prefix}%`);
      
      // Clean push subscriptions
      await this.supabase.from('push_subscriptions').delete().like('user_id', `${prefix}%`);
      
      // Clean preferences cache
      await this.supabase.from('user_preferences_cache').delete().like('user_id', `${prefix}%`);

      // Clean waiting queue
      await this.supabase.from('waiting_queue').delete().like('user_id', `${prefix}%`);

      // Clean reservations
      await this.supabase.from('reservations').delete().like('user_id', `${prefix}%`);

      // Clean matches (user1_id or user2_id)
      await this.supabase.from('matches').delete().like('user1_id', `${prefix}%`);
      await this.supabase.from('matches').delete().like('user2_id', `${prefix}%`);

      // Clean visitor sessions
      const { data, error } = await this.supabase
        .from('visitor_sessions')
        .delete()
        .like('id', `${prefix}%`)
        .select('id');
        
      if (error) {
        console.error('[Cleaner] Failed to delete visitor sessions:', error);
      } else {
        console.log(`[Cleaner] Hygiene complete. Eradicated ${data?.length || 0} simulated sessions and all associated artifacts.`);
      }

      // Verification Step
      await this.verifyHygiene(prefix);

    } catch (e) {
      console.error('[Cleaner] Fatal error during cleanup:', e);
    }
  }

  private async verifyHygiene(prefix: string): Promise<void> {
    console.log('[Cleaner] Verifying environment reset...');
    const tables = [
      { name: 'visitor_sessions', column: 'id' },
      { name: 'waiting_queue', column: 'user_id' },
      { name: 'matches', column: 'user1_id' },
      { name: 'reservations', column: 'user_id' },
      { name: 'analytics_events', column: 'user_id' }
    ];

    let clean = true;
    for (const table of tables) {
      const { count } = await this.supabase
        .from(table.name)
        .select('*', { count: 'exact', head: true })
        .like(table.column, `${prefix}%`);
      
      if (count && count > 0) {
        console.error(`[Cleaner] HYGIENE FAILURE: ${count} stranded records found in ${table.name}`);
        clean = false;
      }
    }

    if (clean) {
      console.log('[Cleaner] Database verified clean. Zero simulated artifacts remain.\n');
    }
  }
}

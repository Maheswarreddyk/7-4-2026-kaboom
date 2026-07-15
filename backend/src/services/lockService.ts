import { getSupabase } from '../database/client.js';

// Deterministic UUID for the matchmaking distributed lock.
export const GLOBAL_LOCK_ID = 'ffffffff-ffff-ffff-ffff-ffffffffffff';
const LOCK_TIMEOUT_MS = 30000; // 30 seconds

export async function acquireGlobalLock(): Promise<boolean> {
  const supabase = getSupabase();
  const now = new Date();
  
  // Ensure the lock row exists
  // Insert is safe; if it exists, ignoreDuplicates will skip it
  await supabase.from('visitor_sessions').upsert(
    {
      id: GLOBAL_LOCK_ID,
      session_token: GLOBAL_LOCK_ID, // satisfies NOT NULL constraint
      status: 'unlocked',
      last_activity: now.toISOString(),
      user_state: 'active',
      display_name: 'SYSTEM_LOCK',
    },
    { onConflict: 'id', ignoreDuplicates: true }
  );

  const timeoutThreshold = new Date(Date.now() - LOCK_TIMEOUT_MS).toISOString();

  // Atomically update the row ONLY if it's unlocked OR the lock has timed out.
  const { data, error } = await supabase
    .from('visitor_sessions')
    .update({ 
      status: 'locked', 
      last_activity: new Date().toISOString() 
    })
    .eq('id', GLOBAL_LOCK_ID)
    .or(`status.eq.unlocked,last_activity.lt.${timeoutThreshold}`)
    .select();

  if (error) {
    console.error('[LockService] Failed to acquire lock:', error);
    return false;
  }

  // If data is returned, we successfully acquired the lock
  return data && data.length > 0;
}

export async function releaseGlobalLock(): Promise<void> {
  const supabase = getSupabase();
  
  const { error } = await supabase
    .from('visitor_sessions')
    .update({ 
      status: 'unlocked',
      last_activity: new Date().toISOString()
    })
    .eq('id', GLOBAL_LOCK_ID);
    
  if (error) {
    console.error('[LockService] Failed to release lock:', error);
  }
}

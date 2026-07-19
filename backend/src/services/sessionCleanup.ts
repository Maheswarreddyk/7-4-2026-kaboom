import { getSupabase } from '../database/client.js';
import { broadcastToSession } from './broadcast.js';

export async function runFullSessionCleanup(sessionId: string, reason: string) {
  console.log(`[Session Cleanup] Starting full cleanup for ${sessionId}, Reason: ${reason}`);
  const supabase = getSupabase();
  
  // 1. Find any active match involving this session
  const { data: activeMatch } = await supabase
    .from('matches')
    .select('id, user_a, user_b, status')
    .or(`user_a.eq.${sessionId},user_b.eq.${sessionId}`)
    .neq('status', 'ended')
    .limit(1)
    .maybeSingle();
  
  if (activeMatch) {
    // 2. Transition match to TERMINATED (ended)
    await supabase
      .from('matches')
      .update({ status: 'ended', ended_at: new Date().toISOString(), ended_reason: 'disconnect' })
      .eq('id', activeMatch.id);
    
    // 3. Broadcast partner_left (COMMAND_TEARDOWN) to the PARTNER immediately
    const partnerId = activeMatch.user_a === sessionId 
      ? activeMatch.user_b 
      : activeMatch.user_a;
      
    if (partnerId) {
      await broadcastToSession(partnerId, 'partner_left', {
        reason: 'PARTNER_DISCONNECTED'
      }).catch(() => {});
      
      // 4. Requeue the partner immediately
      await supabase
        .from('visitor_sessions')
        .update({ status: 'SEARCHING' })
        .eq('id', partnerId)
        .neq('status', 'TERMINATED');
        
      const { data: existingQ } = await supabase
        .from('waiting_queue')
        .select('id')
        .eq('session_id', partnerId)
        .in('status', ['matched', 'left', 'expired'])
        .limit(1)
        .maybeSingle();
        
      if (existingQ) {
        await supabase.from('waiting_queue').update({ status: 'waiting', last_seen: new Date().toISOString() }).eq('id', existingQ.id);
      } else {
        await supabase.from('waiting_queue').insert({
          session_id: partnerId,
          status: 'waiting',
          joined_at: new Date().toISOString(),
          last_seen: new Date().toISOString(),
        });
      }
    }
  }
  
  // 5. Remove from waiting_queue
  await supabase
    .from('waiting_queue')
    .update({ status: 'left' })
    .eq('session_id', sessionId)
    .in('status', ['waiting', 'matched']); // only update if still active
  
  // 6. Terminate the session itself
  await supabase
    .from('visitor_sessions')
    .update({ status: 'TERMINATED' })
    .eq('id', sessionId)
    .neq('status', 'TERMINATED'); // idempotent
  
  // 7. Clean up any orphaned reservations
  await supabase
    .from('reservations')
    .delete()
    .or(`session_a.eq.${sessionId},session_b.eq.${sessionId}`);
    
  console.log(`[Session Cleanup] Complete for ${sessionId}, Reason: ${reason}`);
}

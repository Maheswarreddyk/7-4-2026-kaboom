import { getSupabase, handleSupabaseError } from '../database/client.js';
import { getIceServers } from '../config/index.js';
import { broadcastToSession } from './broadcast.js';
import { AnalyticsLogger } from '../analytics/logger.js';
import { AppError } from '../middleware/errorHandler.js';
export type MatchEndReason = 'next' | 'leave' | 'disconnect' | 'report' | 'client_aborted_match';

export async function validateSession(sessionId: string, sessionToken: string) {
  if (!sessionId || !sessionToken) return null;

  const { data, error } = await getSupabase()
    .from('visitor_sessions')
    .select('*')
    .eq('id', sessionId)
    .maybeSingle();

  if (error) handleSupabaseError(error, 'Failed to validate session');
  if (!data) return null;
  if (data.session_token !== sessionToken) return null;
  if (data.status === 'ended') return null;
  return data;
}

async function findActiveMatch(sessionId: string) {
  const { data, error } = await getSupabase()
    .from('matches')
    .select('*')
    .is('ended_at', null)
    .or(`user_a.eq.${sessionId},user_b.eq.${sessionId}`)
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) handleSupabaseError(error, 'Failed to find active match');
  return data;
}

export async function endActiveMatch(sessionId: string, reason: MatchEndReason, targetMatchId?: string) {
  const match = await findActiveMatch(sessionId);
  if (!match) return null;

  if (targetMatchId && match.id !== targetMatchId) {
    console.warn(`[MatchService] endActiveMatch blocked friendly fire: target ${targetMatchId} != active ${match.id}`);
    return null;
  }

  const startedAt = new Date(match.started_at).getTime();
  const durationSeconds = Math.floor((Date.now() - startedAt) / 1000);
  const partnerId = match.user_a === sessionId ? match.user_b : match.user_a;

  const { error } = await getSupabase()
    .from('matches')
    .update({
      ended_at: new Date().toISOString(),
      duration_seconds: durationSeconds,
      ended_reason: reason,
    })
    .eq('id', match.id);

  if (error) handleSupabaseError(error, 'Failed to end match');

  AnalyticsLogger.logEvent('CALL_ENDED', sessionId, match.id, {
    duration_sec: durationSeconds,
    reason
  }, `${match.id}_ended`);

  await getSupabase()
    .from('connection_logs')
    .insert({
      session_id: sessionId,
      event: 'match_end',
      details: { matchId: match.id, reason },
    });

  return { match, partnerId };
}

export async function joinQueue(sessionId: string, sessionToken: string, matchMode?: string, tags?: string[], genderPreference?: string[]) {
  const supabase = getSupabase();
  const now = new Date().toISOString();

  const sessionUpdate: any = { 
    status: 'SEARCHING', 
    queue_entered_at: now,
    last_activity: now
  };
  if (matchMode) sessionUpdate.match_mode = matchMode;
  if (tags) sessionUpdate.interest_tags = tags;
  if (genderPreference) sessionUpdate.looking_for = genderPreference;

  await supabase.from('visitor_sessions').update(sessionUpdate).eq('id', sessionId);
  
  await supabase.from('waiting_queue').upsert({
    session_id: sessionId,
    status: 'waiting',
    joined_at: now,
    last_seen: now
  });

  // Call the new highly-concurrent PL/pgSQL RPC
  const { data: matchId, error: rpcErr } = await supabase.rpc('execute_matchmaking', { p_session_id: sessionId });
  
  if (matchId) {
    const { data: match } = await supabase.from('matches').select('*').eq('id', matchId).single();
    if (match) {
      const partnerId = match.user_a === sessionId ? match.user_b : match.user_a;
      
      const iceServers = getIceServers();
      const { data: profiles } = await supabase.from('visitor_sessions').select('*').in('id', [sessionId, partnerId]);
      const pSelf = profiles?.find(p => p.id === sessionId);
      const pPartner = profiles?.find(p => p.id === partnerId);
      
      const formatProfile = (p: any) => ({
        displayName: p?.display_name || 'Guest',
        bio: p?.bio || '',
        matchMode: p?.match_mode || 'RANDOM',
        city: p?.city || null,
        state: p?.state || null,
        country: p?.country || null,
        gender: p?.gender || null,
        lookingFor: p?.looking_for || [],
        languages: p?.languages || [],
        interestTags: p?.interest_tags || [],
      });

      await Promise.all([
        broadcastToSession(sessionId, 'matched', {
          matchId,
          partnerSessionId: partnerId,
          isInitiator: true,
          iceServers,
          partnerProfile: formatProfile(pPartner)
        }).catch(()=>{}),
        broadcastToSession(partnerId, 'matched', {
          matchId,
          partnerSessionId: sessionId,
          isInitiator: false,
          iceServers,
          partnerProfile: formatProfile(pSelf)
        }).catch(()=>{})
      ]);

      return {
        status: 'matched',
        matchId,
        partnerSessionId: partnerId,
        isInitiator: true,
        iceServers,
        partnerProfile: formatProfile(pPartner)
      };
    }
  }

  return { status: 'waiting' as const };
}

export async function getMatchStatus(sessionId: string, sessionToken: string) {
  const session = await validateSession(sessionId, sessionToken);
  if (!session) throw new AppError(401, 'Invalid session');

  const match = await findActiveMatch(sessionId);
  if (match) {
    const partnerId = match.user_a === sessionId ? match.user_b : match.user_a;
    const { data: partnerSession } = await getSupabase()
      .from('visitor_sessions')
      .select('display_name, bio, match_mode, match_constraints, match_attributes, city, state, country, gender, looking_for, languages, interest_tags')
      .eq('id', partnerId)
      .maybeSingle();

    return {
      status: 'matched' as const,
      matchId: match.id,
      partnerSessionId: partnerId,
      isInitiator: match.user_a === sessionId,
      iceServers: getIceServers(),
      queuePosition: 0,
      waitingSeconds: 0,
      partnerProfile: partnerSession ? {
        displayName: partnerSession.display_name || 'Guest',
        bio: partnerSession.bio || '',
        matchMode: partnerSession.match_mode || 'RANDOM',
        city: partnerSession.city || null,
        state: partnerSession.state || null,
        country: partnerSession.country || null,
        gender: partnerSession.gender || null,
        lookingFor: partnerSession.looking_for || [],
        languages: partnerSession.languages || [],
        interestTags: partnerSession.interest_tags || [],
      } : null,
    };
  }

  const { data: queueEntry } = await getSupabase()
    .from('waiting_queue')
    .select('*')
    .eq('session_id', sessionId)
    .in('status', ['waiting', 'matched'])
    .maybeSingle();

  if (queueEntry) {
    return { status: 'waiting' as const };
  }

  return { status: 'idle' as const };
}

export async function markMatchReady(sessionId: string, sessionToken: string, matchId: string) {
  const supabase = getSupabase();
  const { data: match, error: fetchErr } = await supabase
    .from('matches')
    .select('*')
    .eq('id', matchId)
    .single();

  if (fetchErr || !match) throw new AppError(404, 'Match not found');

  const isUserA = match.user_a === sessionId;
  if (!isUserA && match.user_b !== sessionId) {
    throw new AppError(403, 'Unauthorized match participant');
  }

  const updatePayload = isUserA ? { user_a_ready: true } : { user_b_ready: true };

  const { data: updatedMatch, error: updateErr } = await supabase
    .from('matches')
    .update(updatePayload)
    .eq('id', matchId)
    .select()
    .single();

  if (updateErr) throw new AppError(500, updateErr.message);

  if (updatedMatch.user_a_ready && updatedMatch.user_b_ready && !updatedMatch.negotiation_started) {
    await supabase.from('matches').update({ negotiation_started: true }).eq('id', matchId);
    broadcastToSession(match.user_a, 'start_negotiation', { matchId, isInitiator: true });
    broadcastToSession(match.user_b, 'start_negotiation', { matchId, isInitiator: false });
  }

  return { ready: true };
}

export async function leaveQueue(sessionId: string, sessionToken: string, targetMatchId?: string) {
  const session = await validateSession(sessionId, sessionToken);
  if (!session) return;
  const supabase = getSupabase();
  await supabase.from('waiting_queue').delete().eq('session_id', sessionId);
  await supabase.from('visitor_sessions').update({ status: 'READY' }).eq('id', sessionId);
}

async function requeuePartner(partnerId: string): Promise<void> {
  const supabase = getSupabase();
  const { data: partner } = await supabase.from('visitor_sessions').select('*').eq('id', partnerId).maybeSingle();
  if (!partner || partner.status === 'ended' || partner.status === 'SEARCHING' || partner.status === 'READY') {
    return;
  }
  
  await broadcastToSession(partnerId, 'searching', { message: 'Finding someone new...' }).catch(() => {});
  
  const now = new Date().toISOString();
  await supabase.from('visitor_sessions').update({ status: 'SEARCHING', queue_entered_at: now }).eq('id', partnerId);
  await supabase.from('waiting_queue').upsert({ session_id: partnerId, status: 'waiting', joined_at: now, last_seen: now });
  
  const { data: matchId } = await supabase.rpc('execute_matchmaking', { p_session_id: partnerId });
  if (matchId) {
    const { data: match } = await supabase.from('matches').select('*').eq('id', matchId).single();
    if (match) {
      const pId = match.user_a === partnerId ? match.user_b : match.user_a;
      await Promise.all([
        broadcastToSession(partnerId, 'matched', { matchId, partnerSessionId: pId, isInitiator: true, iceServers: getIceServers() }),
        broadcastToSession(pId, 'matched', { matchId, partnerSessionId: partnerId, isInitiator: false, iceServers: getIceServers() })
      ]);
    }
  }
}

export async function nextPartner(sessionId: string, sessionToken: string, targetMatchId?: string, reason: MatchEndReason = 'next') {
  const session = await validateSession(sessionId, sessionToken);
  if (!session) throw new Error('Invalid session');
  
  const ended = await endActiveMatch(sessionId, reason, targetMatchId);
  if (ended?.partnerId) {
    await broadcastToSession(ended.partnerId, 'partner_left', { reason });
    await requeuePartner(ended.partnerId);
  }

  await getSupabase().from('connection_logs').insert({ session_id: sessionId, event: 'next', details: {} });
  return joinQueue(sessionId, sessionToken);
}

export async function notifyPartnerLeft(sessionId: string, sessionToken: string, reason: MatchEndReason, targetMatchId?: string) {
  const session = await validateSession(sessionId, sessionToken);
  if (!session) throw new Error('Invalid session');

  const supabase = getSupabase();
  const nextStatus = (reason === 'leave' || reason === 'client_aborted_match') ? 'READY' : 'ENDED';
  await supabase.from('visitor_sessions').update({ status: nextStatus }).eq('id', sessionId);

  const ended = await endActiveMatch(sessionId, reason, targetMatchId);
  if (ended?.partnerId) {
    await broadcastToSession(ended.partnerId, 'partner_left', { reason });
    await requeuePartner(ended.partnerId);
  }
}

export async function markMediaConnected(sessionId: string, sessionToken: string, matchId: string) {
  const supabase = getSupabase();
  const { data: match } = await supabase.from('matches').select('*').eq('id', matchId).single();
  if (!match) throw new AppError(404, 'Match not found');

  const isUserA = match.user_a === sessionId;
  const updatePayload = isUserA ? { user_a_media_ready: true } : { user_b_media_ready: true };

  await supabase.from('matches').update(updatePayload).eq('id', matchId);
  return { success: true };
}

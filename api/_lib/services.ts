import { v4 as uuidv4 } from 'uuid';
import { getIceServers } from './config.js';
import { leaveQueueEntry, markUserReady, runMatchCycle } from './matchmaking/matchingEngine.js';
import { broadcastToSession } from './realtime.js';
import { getSupabase, handleSupabaseError } from './supabase.js';

export type ReportReason = 'spam' | 'nudity' | 'abuse' | 'harassment' | 'other';
export type MatchEndReason = 'next' | 'leave' | 'disconnect' | 'report';

export async function validateSession(sessionId: string, sessionToken?: string) {
  const { data, error } = await getSupabase()
    .from('visitor_sessions')
    .select('*')
    .eq('id', sessionId)
    .maybeSingle();

  if (error) handleSupabaseError(error, 'Failed to validate session');
  if (!data) return null;
  if (sessionToken && data.session_token !== sessionToken) return null;
  if (data.status === 'ended') return null;
  return data;
}

export async function startSession(data: {
  country?: string;
  browser?: string;
  device?: string;
  platform?: string;
}) {
  const sessionToken = uuidv4();
  const { data: session, error } = await getSupabase()
    .from('visitor_sessions')
    .insert({
      session_token: sessionToken,
      country: data.country ?? null,
      browser: data.browser ?? null,
      device: data.device ?? null,
      platform: data.platform ?? null,
      status: 'active',
    })
    .select()
    .single();

  if (error || !session) handleSupabaseError(error, 'Failed to create session');

  await getSupabase()
    .from('connection_logs')
    .insert({
      session_id: session.id,
      event: 'session_start',
      details: { browser: data.browser, device: data.device },
    });

  return session;
}

export async function endSession(sessionId: string) {
  const { error } = await getSupabase()
    .from('visitor_sessions')
    .update({ status: 'ended', ended_at: new Date().toISOString() })
    .eq('id', sessionId);

  if (error) handleSupabaseError(error, 'Failed to end session');

  await getSupabase().from('waiting_queue').update({ status: 'left' }).eq('session_id', sessionId).eq('status', 'waiting');

  await getSupabase()
    .from('connection_logs')
    .insert({ session_id: sessionId, event: 'session_end', details: {} });
}

export async function getStats() {
  const supabase = getSupabase();
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const [activeRes, waitingRes, matchesRes, onlineRes] = await Promise.all([
    supabase.from('visitor_sessions').select('*', { count: 'exact', head: true }).eq('status', 'active'),
    supabase.from('waiting_queue').select('*', { count: 'exact', head: true }).eq('status', 'waiting'),
    supabase.from('matches').select('*', { count: 'exact', head: true }).gte('started_at', startOfDay.toISOString()),
    supabase
      .from('visitor_sessions')
      .select('*', { count: 'exact', head: true })
      .in('status', ['active', 'waiting', 'matched']),
  ]);

  if (activeRes.error) handleSupabaseError(activeRes.error, 'Failed to count active sessions');
  if (waitingRes.error) handleSupabaseError(waitingRes.error, 'Failed to count waiting users');
  if (matchesRes.error) handleSupabaseError(matchesRes.error, 'Failed to count matches');
  if (onlineRes.error) handleSupabaseError(onlineRes.error, 'Failed to count online users');

  return {
    activeUsers: activeRes.count ?? 0,
    waitingUsers: waitingRes.count ?? 0,
    matchesToday: matchesRes.count ?? 0,
    onlineNow: onlineRes.count ?? 0,
  };
}

export async function submitReport(data: {
  reporterSessionId: string;
  reportedSessionId: string;
  reason: ReportReason;
  notes?: string;
}) {
  const { data: report, error } = await getSupabase()
    .from('reports')
    .insert({
      reporter_session: data.reporterSessionId,
      reported_session: data.reportedSessionId,
      reason: data.reason,
      notes: data.notes ?? null,
    })
    .select()
    .single();

  if (error || !report) handleSupabaseError(error, 'Failed to create report');

  await getSupabase()
    .from('connection_logs')
    .insert({
      session_id: data.reporterSessionId,
      event: 'report',
      details: { reportedSessionId: data.reportedSessionId, reason: data.reason },
    });

  return report;
}

export async function submitFeedback(data: { sessionId: string; rating: number; feedback?: string }) {
  const { data: entry, error } = await getSupabase()
    .from('feedback')
    .insert({
      session_id: data.sessionId,
      rating: data.rating,
      feedback: data.feedback ?? null,
    })
    .select()
    .single();

  if (error || !entry) handleSupabaseError(error, 'Failed to create feedback');
  return entry;
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

export async function endActiveMatch(sessionId: string, reason: MatchEndReason) {
  const match = await findActiveMatch(sessionId);
  if (!match) return null;

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

  await getSupabase()
    .from('connection_logs')
    .insert({
      session_id: sessionId,
      event: 'match_end',
      details: { matchId: match.id, reason },
    });

  return { match, partnerId };
}

export async function joinQueue(sessionId: string, sessionToken: string) {
  return runMatchCycle(getSupabase(), sessionId, sessionToken);
}

export async function markMatchReady(sessionId: string, sessionToken: string, matchId: string) {
  return markUserReady(getSupabase(), sessionId, sessionToken, matchId);
}

export async function leaveQueue(sessionId: string, sessionToken: string) {
  const session = await validateSession(sessionId, sessionToken);
  if (!session) throw new Error('Invalid session');

  await leaveQueueEntry(getSupabase(), sessionId);
}

async function requeuePartner(partnerId: string) {
  const partner = await validateSession(partnerId);
  if (!partner) return;

  await broadcastToSession(partnerId, 'searching', {
    message: 'Finding someone new...',
  });

  try {
    await joinQueue(partnerId, partner.session_token);
  } catch {
    // Partner re-queue is best-effort
  }
}

export async function nextPartner(sessionId: string, sessionToken: string) {
  const session = await validateSession(sessionId, sessionToken);
  if (!session) throw new Error('Invalid session');

  const ended = await endActiveMatch(sessionId, 'next');

  // Delete messages when match ends
  if (ended?.match?.id) {
    await getSupabase().from('temporary_messages').delete().eq('match_id', ended.match.id);
  }

  if (ended?.partnerId) {
    await broadcastToSession(ended.partnerId, 'partner_left', { reason: 'next' });
    await requeuePartner(ended.partnerId);
  }

  await getSupabase()
    .from('connection_logs')
    .insert({ session_id: sessionId, event: 'next', details: {} });

  return joinQueue(sessionId, sessionToken);
}

export async function notifyPartnerLeft(sessionId: string, sessionToken: string, reason: MatchEndReason) {
  const session = await validateSession(sessionId, sessionToken);
  if (!session) throw new Error('Invalid session');

  const ended = await endActiveMatch(sessionId, reason);

  // Delete messages when match ends
  if (ended?.match?.id) {
    await getSupabase().from('temporary_messages').delete().eq('match_id', ended.match.id);
  }

  if (ended?.partnerId) {
    await broadcastToSession(ended.partnerId, 'partner_left', { reason });
    await requeuePartner(ended.partnerId);
  }
}

// 7. Advanced Preferences, Autocomplete, Likes, and Message Services
export async function savePreferences(
  sessionId: string,
  sessionToken: string,
  preferences: {
    gender?: string;
    looking_for?: string[];
    languages?: string[];
    country?: string;
    state?: string;
    district?: string;
    city?: string;
    interest_tags?: string[];
  }
) {
  const session = await validateSession(sessionId, sessionToken);
  if (!session) throw new Error('Invalid session');

  const { error } = await getSupabase()
    .from('visitor_sessions')
    .update({
      gender: preferences.gender ?? null,
      looking_for: preferences.looking_for ?? null,
      languages: preferences.languages ?? null,
      country: preferences.country ?? null,
      state: preferences.state ?? null,
      district: preferences.district ?? null,
      city: preferences.city ?? null,
      interest_tags: preferences.interest_tags ?? null,
      last_activity: new Date().toISOString(),
    })
    .eq('id', sessionId);

  if (error) handleSupabaseError(error, 'Failed to save preferences');
}

export async function getLocations(query: string) {
  const { data, error } = await getSupabase()
    .from('locations')
    .select('*')
    .ilike('name', `%${query}%`)
    .limit(10);

  if (error) handleSupabaseError(error, 'Failed to autocomplete locations');
  return data || [];
}

export async function getInterests(query: string) {
  const { data, error } = await getSupabase()
    .from('interests')
    .select('*')
    .ilike('name', `%${query}%`)
    .limit(10);

  if (error) handleSupabaseError(error, 'Failed to autocomplete interests');
  return data || [];
}

export async function submitLike(sessionId: string, sessionToken: string, matchId: string) {
  const session = await validateSession(sessionId, sessionToken);
  if (!session) throw new Error('Invalid session');

  const supabase = getSupabase();

  // Find active match
  const { data: match, error: matchError } = await supabase
    .from('matches')
    .select('*')
    .eq('id', matchId)
    .maybeSingle();

  if (matchError || !match) {
    throw new Error('Active match not found');
  }

  if (match.user_a !== sessionId && match.user_b !== sessionId) {
    throw new Error('Unauthorized: Session is not a participant of this match');
  }

  // Insert like
  const { error: likeError } = await supabase
    .from('likes')
    .insert({ match_id: matchId, session_id: sessionId });

  if (likeError && likeError.code !== '23505') { // Ignore unique violations
    handleSupabaseError(likeError, 'Failed to submit like');
  }

  // Update match record
  const updateData: any = {};
  if (match.user_a === sessionId) {
    updateData.liked_by_a = true;
  } else {
    updateData.liked_by_b = true;
  }

  const { data: updatedMatch, error: updateError } = await supabase
    .from('matches')
    .update(updateData)
    .eq('id', matchId)
    .select()
    .single();

  if (updateError) handleSupabaseError(updateError, 'Failed to update match likes');

  const partnerId = match.user_a === sessionId ? match.user_b : match.user_a;

  if (updatedMatch.liked_by_a && updatedMatch.liked_by_b) {
    // Mutual like celebration
    await Promise.all([
      broadcastToSession(sessionId, 'mutual_like', { matchId, partnerSessionId: partnerId }),
      broadcastToSession(partnerId, 'mutual_like', { matchId, partnerSessionId: sessionId }),
    ]);
  } else {
    // Notify partner that they are liked
    await broadcastToSession(partnerId, 'partner_liked', { matchId });
  }

  return { success: true, mutual: updatedMatch.liked_by_a && updatedMatch.liked_by_b };
}

export async function submitChatMessage(
  sessionId: string,
  sessionToken: string,
  matchId: string,
  message: string
) {
  const session = await validateSession(sessionId, sessionToken);
  if (!session) throw new Error('Invalid session');

  const supabase = getSupabase();

  const { data: match, error: matchError } = await supabase
    .from('matches')
    .select('*')
    .eq('id', matchId)
    .maybeSingle();

  if (matchError || !match) throw new Error('Match not found');

  if (match.user_a !== sessionId && match.user_b !== sessionId) {
    throw new Error('Unauthorized: Session is not a participant of this match');
  }

  const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hour expiration

  const { data: msg, error: msgError } = await supabase
    .from('temporary_messages')
    .insert({
      match_id: matchId,
      sender_session: sessionId,
      message,
      expires_at: expiresAt,
    })
    .select()
    .single();

  if (msgError) handleSupabaseError(msgError, 'Failed to store temporary message');

  const partnerId = match.user_a === sessionId ? match.user_b : match.user_a;

  await broadcastToSession(partnerId, 'new_message', {
    matchId,
    senderSessionId: sessionId,
    message,
    createdAt: msg.created_at,
  });

  return msg;
}

export async function getAnalytics() {
  const supabase = getSupabase();

  const [
    waitingCount,
    matchesCount,
    likesCount,
    reportsCount,
    sessionsQuery,
  ] = await Promise.all([
    supabase.from('waiting_queue').select('*', { count: 'exact', head: true }).eq('status', 'waiting'),
    supabase.from('matches').select('*', { count: 'exact', head: true }),
    supabase.from('likes').select('*', { count: 'exact', head: true }),
    supabase.from('reports').select('*', { count: 'exact', head: true }),
    supabase.from('visitor_sessions').select('interest_tags, country, state, city, languages'),
  ]);

  // Aggregate interests
  const interestsFreq: Record<string, number> = {};
  const locationsFreq: Record<string, number> = {};
  const languagesFreq: Record<string, number> = {};

  sessionsQuery.data?.forEach((s: any) => {
    if (s.interest_tags) {
      s.interest_tags.forEach((t: string) => {
        interestsFreq[t] = (interestsFreq[t] || 0) + 1;
      });
    }
    if (s.languages) {
      s.languages.forEach((l: string) => {
        languagesFreq[l] = (languagesFreq[l] || 0) + 1;
      });
    }
    if (s.city) {
      locationsFreq[s.city] = (locationsFreq[s.city] || 0) + 1;
    } else if (s.country) {
      locationsFreq[s.country] = (locationsFreq[s.country] || 0) + 1;
    }
  });

  return {
    onlineNow: waitingCount.count ?? 0,
    totalMatches: matchesCount.count ?? 0,
    totalLikes: likesCount.count ?? 0,
    totalReports: reportsCount.count ?? 0,
    topInterests: Object.entries(interestsFreq).sort((a, b) => b[1] - a[1]).slice(0, 5),
    topLocations: Object.entries(locationsFreq).sort((a, b) => b[1] - a[1]).slice(0, 5),
    topLanguages: Object.entries(languagesFreq).sort((a, b) => b[1] - a[1]).slice(0, 5),
  };
}


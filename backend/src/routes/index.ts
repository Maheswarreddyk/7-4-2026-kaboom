import { Router } from 'express';
import {
  feedbackController,
  healthController,
  reportController,
  sessionController,
  statsController,
} from '../controllers/index.js';
import {
  apiRateLimiter,
  reportRateLimiter,
  sessionRateLimiter,
} from '../middleware/rateLimiter.js';

import { getSupabase } from '../database/client.js';
import matchRoutes from './match.js';
import notificationRoutes from './notifications.js';
import { matchmakerMetrics } from '../matchmaking/matchingEngine.js';
import { broadcastToSession } from '../services/broadcast.js';
import { validateSession } from '../services/matchService.js';

const router = Router();

router.use(apiRateLimiter);
router.use('/match', matchRoutes);
router.use('/notifications', notificationRoutes);
import adminNotificationRoutes from './admin-notifications.js';
router.use('/admin/notifications', adminNotificationRoutes);

router.get('/health', healthController.getHealth);
router.get('/stats', statsController.getStats);

router.post('/start-session', sessionRateLimiter, sessionController.startSession);
router.post('/end-session', sessionController.endSession);
router.post('/restore-session', sessionController.restoreSession);
router.post('/session/heartbeat', async (req, res, next) => {
  try {
    const { sessionId, sessionToken, clientState } = req.body;
    if (!sessionId || !sessionToken) {
      return res.status(400).json({ error: 'sessionId and sessionToken are required' });
    }
    
    const supabase = getSupabase();
    const { data: session, error: fetchErr } = await supabase
      .from('visitor_sessions')
      .select('status, match_id')
      .eq('id', sessionId)
      .eq('session_token', sessionToken)
      .single();
      
    if (fetchErr) throw fetchErr;

    // V9 State Synchronization Guardrail
    // If frontend thinks it is IDLE or SEARCHING, but DB thinks it is matched, we have a desync.
    if (clientState && ['IDLE', 'SEARCHING', 'REQUEUEING'].includes(clientState)) {
      if (['RESERVED', 'READY', 'CONNECTED'].includes(session.status) && session.match_id) {
        console.warn(`[Sync Guardrail] Desync detected for ${sessionId}: Client is ${clientState}, DB is ${session.status}. Forcing cleanup.`);
        
        // Notify the ghost partner that this user has left
        const { data: matchInfo } = await supabase
          .from('matches')
          .select('user_a, user_b')
          .eq('id', session.match_id)
          .single();
          
        if (matchInfo) {
          const partnerId = matchInfo.user_a === sessionId ? matchInfo.user_b : matchInfo.user_a;
          await broadcastToSession(partnerId, 'partner_left', { reason: 'desync_recovery' });
        }
        
        // Destroy the ghost match
        await supabase.from('matches').update({ status: 'ended', ended_at: new Date().toISOString() }).eq('id', session.match_id);
        
        // Reset this user to IDLE (they will be re-queued by the frontend if they are SEARCHING)
        await supabase.from('visitor_sessions').update({ status: 'IDLE', match_id: null }).eq('id', sessionId);
      }
    }

    const { error } = await supabase
      .from('visitor_sessions')
      .update({ last_activity: new Date().toISOString() })
      .eq('id', sessionId);
      
    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});
router.post('/report', reportRateLimiter, reportController.submitReport);
router.post('/feedback', feedbackController.submitFeedback);

const SEEDED_UNIVERSITIES = [
  { name: 'Indian Institute of Technology Madras (IIT Madras)', country: 'India' },
  { name: 'Indian Institute of Technology Delhi (IIT Delhi)', country: 'India' },
  { name: 'Indian Institute of Technology Bombay (IIT Bombay)', country: 'India' },
  { name: 'Indian Institute of Technology Kanpur (IIT Kanpur)', country: 'India' },
  { name: 'Indian Institute of Technology Kharagpur (IIT Kharagpur)', country: 'India' },
  { name: 'Indian Institute of Technology Roorkee (IIT Roorkee)', country: 'India' },
  { name: 'Indian Institute of Technology Hyderabad (IIT Hyderabad)', country: 'India' },
  { name: 'Indian Institute of Technology Guwahati (IIT Guwahati)', country: 'India' },
  { name: 'Indian Institute of Science (IISc Bengaluru)', country: 'India' },
  { name: 'National Institute of Technology Tiruchirappalli (NIT Trichy)', country: 'India' },
  { name: 'National Institute of Technology Karnataka (NIT Surathkal)', country: 'India' },
  { name: 'National Institute of Technology Warangal (NIT Warangal)', country: 'India' },
  { name: 'Motilal Nehru National Institute of Technology (MNNIT Allahabad)', country: 'India' },
  { name: 'College of Engineering, Guindy (CEG Chennai)', country: 'India' },
  { name: 'Birla Institute of Technology & Science (BITS Pilani)', country: 'India' },
  { name: 'Vellore Institute of Technology (VIT Vellore)', country: 'India' },
  { name: 'SRM Institute of Science and Technology (SRM Chennai)', country: 'India' },
  { name: 'Amrita School of Engineering (Coimbatore)', country: 'India' },
  { name: 'Thapar Institute of Engineering and Technology (Patiala)', country: 'India' },
  { name: 'Manipal Institute of Technology (MIT Manipal)', country: 'India' },
  { name: 'Chandigarh University (Mohali)', country: 'India' },
  { name: 'International Institute of Information Technology (IIIT Hyderabad)', country: 'India' },
  { name: 'PES University (Bengaluru)', country: 'India' },
  { name: 'Ramaiah Institute of Technology (MSRIT Bengaluru)', country: 'India' },
  { name: 'RV College of Engineering (RVCE Bengaluru)', country: 'India' },
  { name: 'BMS College of Engineering (BMSCE Bengaluru)', country: 'India' },
  { name: 'PSG College of Technology (PSG Tech Coimbatore)', country: 'India' },
  { name: 'Sathyabama Institute of Science and Technology (Chennai)', country: 'India' },
  { name: 'SSN College of Engineering (Chennai)', country: 'India' },
  { name: 'Rajalakshmi Engineering College (Chennai)', country: 'India' },
  { name: 'Kalinga Institute of Industrial Technology (KIIT Bhubaneswar)', country: 'India' },
  { name: 'Siksha O Anusandhan (SOA Bhubaneswar)', country: 'India' },
  { name: 'Amity University (Noida)', country: 'India' },
  { name: 'Lovely Professional University (LPU Phagwara)', country: 'India' },
  { name: 'Nirma University (Ahmedabad)', country: 'India' },
  { name: 'Pandit Deendayal Energy University (PDEU Gandhinagar)', country: 'India' },
  { name: 'Symbiosis Institute of Technology (SIT Pune)', country: 'India' },
  { name: 'Maharashtra Institute of Technology (MIT-WPU Pune)', country: 'India' },
  { name: 'COEP Technological University (Pune)', country: 'India' },
  { name: 'Veermata Jijabai Technological Institute (VJTI Mumbai)', country: 'India' },
  { name: 'Dwarkadas J. Sanghvi College of Engineering (DJSCE Mumbai)', country: 'India' },
  { name: 'Chaitanya Bharathi Institute of Technology (CBIT Hyderabad)', country: 'India' },
  { name: 'VNR Vignana Jyothi Institute of Engineering and Technology (VNR VJIET Hyderabad)', country: 'India' },
  { name: 'Gokaraju Rangaraju Institute of Engineering and Technology (GRIET Hyderabad)', country: 'India' },
  { name: 'Vardhaman College of Engineering (Hyderabad)', country: 'India' },
  { name: 'Institute of Engineering and Management (IEM Kolkata)', country: 'India' },
  { name: 'Heritage Institute of Technology (Kolkata)', country: 'India' },
  { name: 'Anna University (Chennai)', country: 'India' },
  { name: 'Jadavpur University (Kolkata)', country: 'India' },
  { name: 'University of Delhi (DU New Delhi)', country: 'India' },
  { name: 'Jawaharlal Nehru University (JNU New Delhi)', country: 'India' },
  { name: 'Jamia Millia Islamia (JMI New Delhi)', country: 'India' },
  { name: 'Banaras Hindu University (BHU Varanasi)', country: 'India' },
  { name: 'Aligarh Muslim University (AMU Aligarh)', country: 'India' },
  { name: 'Visvesvaraya Technological University (VTU Belagavi)', country: 'India' },
  { name: 'Jawaharlal Nehru Technological University (JNTU Hyderabad)', country: 'India' },
  { name: 'Andhra University (Visakhapatnam)', country: 'India' }
];

const universityCache = new Map<string, any[]>();

router.post('/preferences', async (req, res, next) => {
  try {
    const { sessionId, sessionToken, preferences } = req.body;
    const session = await validateSession(sessionId, sessionToken);
    if (!session) return res.status(401).json({ error: 'Invalid or expired session' });

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
        
        // V6 Identity & Smart Matching Columns
        display_name: preferences.display_name ?? 'Guest',
        bio: preferences.bio ?? null,
        match_mode: preferences.match_mode ?? 'RANDOM',
        match_constraints: preferences.match_constraints ?? {},
        match_attributes: preferences.match_attributes ?? {},
        
        last_activity: new Date().toISOString()
      })
      .eq('id', sessionId);
    if (error) throw error;

    // Phase B: Cache preferences for push notifications if they have a subscription
    const supabase = getSupabase();
    const { data: subs } = await supabase
      .from('push_subscriptions')
      .select('id')
      .eq('session_id', sessionId);
      
    if (subs && subs.length > 0) {
      for (const sub of subs) {
        await supabase
          .from('user_preferences_cache')
          .upsert({
            subscription_id: sub.id,
            display_name: preferences.display_name ?? 'Guest',
            gender: preferences.gender ?? null,
            looking_for: preferences.looking_for ?? null,
            college: preferences.university ?? null, // Note: the frontend passes 'university'
            city: preferences.city ?? null,
            state: preferences.state ?? null,
            country: preferences.country ?? null,
            languages: preferences.languages ?? [],
            interests: preferences.interest_tags ?? [],
            match_mode: preferences.match_mode ?? 'SMART'
          }, { onConflict: 'subscription_id' });
      }
    }

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

router.get('/universities', async (req, res, next) => {
  try {
    const query = (req.query.q as string || '').trim();
    if (!query || query.length < 2) {
      return res.json({ success: true, data: [] });
    }

    const cleanQ = query.toLowerCase();

    // 1. Filter local seeded fallbacks
    const localFiltered = SEEDED_UNIVERSITIES.filter(u => 
      u.name.toLowerCase().includes(cleanQ)
    );

    // 2. Check API Cache
    if (universityCache.has(cleanQ)) {
      return res.json({ success: true, data: universityCache.get(cleanQ) });
    }

    // 3. Fetch from Hipo Labs API using native fetch with 2.5s timeout
    let apiResults: any[] = [];
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2500);

    try {
      const response = await fetch(
        `http://universities.hipolabs.com/search?name=${encodeURIComponent(query)}`,
        { signal: controller.signal }
      );
      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json() as any[];
        apiResults = (data || []).map(u => ({
          name: u.name,
          country: u.country
        }));
      }
    } catch (apiErr) {
      console.warn('[Universities API] Search fetch aborted or failed:', (apiErr as Error).message);
    }

    // 4. Merge results and deduplicate by name
    const merged = [...localFiltered];
    const seenNames = new Set(localFiltered.map(u => u.name.toLowerCase()));

    apiResults.forEach(u => {
      const nameLower = u.name.toLowerCase();
      if (!seenNames.has(nameLower)) {
        seenNames.add(nameLower);
        merged.push(u);
      }
    });

    // Take top 15 results
    const finalResults = merged.slice(0, 15);
    
    // Save to Cache with basic LRU size limit
    if (universityCache.size >= 500) {
      // Delete the oldest entry (Map iteration order is insertion order)
      const firstKey = universityCache.keys().next().value;
      if (firstKey) universityCache.delete(firstKey);
    }
    universityCache.set(cleanQ, finalResults);

    res.json({ success: true, data: finalResults });
  } catch (err) {
    next(err);
  }
});

router.get('/locations', async (req, res, next) => {
  try {
    const query = req.query.q as string;
    if (!query) return res.json({ success: true, data: [] });
    const { data } = await getSupabase()
      .from('locations')
      .select('*')
      .ilike('name', `%${query}%`)
      .limit(10);
    res.json({ success: true, data: data || [] });
  } catch (err) {
    next(err);
  }
});

router.get('/interests', async (req, res, next) => {
  try {
    const query = req.query.q as string;
    if (!query) return res.json({ success: true, data: [] });
    const { data } = await getSupabase()
      .from('interests')
      .select('*')
      .ilike('name', `%${query}%`)
      .limit(10);
    res.json({ success: true, data: data || [] });
  } catch (err) {
    next(err);
  }
});

router.post('/like', async (req, res, next) => {
  try {
    const { sessionId, sessionToken, matchId } = req.body;
    const session = await validateSession(sessionId, sessionToken);
    if (!session) return res.status(401).json({ error: 'Invalid or expired session' });

    const supabase = getSupabase();
    const { data: match } = await supabase.from('matches').select('*').eq('id', matchId).single();
    if (!match) return res.status(404).json({ error: 'Match not found' });
    if (match.user_a !== sessionId && match.user_b !== sessionId) {
      return res.status(403).json({ error: 'Unauthorized match participant' });
    }
    
    await supabase.from('likes').insert({ match_id: matchId, session_id: sessionId });
    
    const updateData: any = {};
    if (match.user_a === sessionId) {
      updateData.liked_by_a = true;
    } else {
      updateData.liked_by_b = true;
    }
    
    const { data: updatedMatch } = await supabase
      .from('matches')
      .update(updateData)
      .eq('id', matchId)
      .select()
      .single();
      
    const isMutual = updatedMatch ? (updatedMatch.liked_by_a && updatedMatch.liked_by_b) : false;

    // Phase 2 Fix: If this like made it mutual, ensure both parties are immediately notified via WebSocket.
    // (Previously, only the HTTP caller knew it was mutual).
    if (isMutual && updatedMatch) {
      const partnerId = match.user_a === sessionId ? match.user_b : match.user_a;
      // We broadcast to BOTH just in case, though the caller already gets HTTP response.
      broadcastToSession(sessionId, 'mutual_like', { matchId, partnerSessionId: partnerId }).catch(e => console.warn('[Like] Broadcast err A:', e.message));
      broadcastToSession(partnerId, 'mutual_like', { matchId, partnerSessionId: sessionId }).catch(e => console.warn('[Like] Broadcast err B:', e.message));
    }
      
    res.json({
      success: true,
      data: {
        success: true,
        mutual: isMutual
      }
    });
  } catch (err) {
    next(err);
  }
});

router.post('/chat', async (req, res, next) => {
  try {
    const { sessionId, sessionToken, matchId, message } = req.body;
    const session = await validateSession(sessionId, sessionToken);
    if (!session) return res.status(401).json({ error: 'Invalid or expired session' });

    const supabase = getSupabase();
    // Validate match participation first
    const { data: match } = await supabase
      .from('matches')
      .select('user_a, user_b')
      .eq('id', matchId)
      .single();

    if (!match) return res.status(404).json({ error: 'Match not found' });
    if (match.user_a !== sessionId && match.user_b !== sessionId) {
      return res.status(403).json({ error: 'Unauthorized match participant' });
    }

    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    const { data } = await supabase
      .from('temporary_messages')
      .insert({
        match_id: matchId,
        sender_session: sessionId,
        message,
        expires_at: expiresAt
      })
      .select()
      .single();

    // Broadcast the new message event to the partner in the match
    if (match) {
      const partnerId = match.user_a === sessionId ? match.user_b : match.user_a;
      broadcastToSession(partnerId, 'new_message', {
        matchId,
        senderSessionId: sessionId,
        message,
        createdAt: data.created_at
      }).catch((err) => {
        console.warn(`[Chat Broadcast] Failed to send new_message to ${partnerId}:`, err.message);
      });
    }

    res.status(201).json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

router.get('/chat/:matchId', async (req, res, next) => {
  try {
    const { matchId } = req.params;
    const sessionId = req.headers['x-session-id'] as string;
    const sessionToken = req.headers['x-session-token'] as string;

    if (!sessionId || !sessionToken) {
      return res.status(401).json({ error: 'Missing session authentication headers' });
    }

    const session = await validateSession(sessionId, sessionToken);
    if (!session) return res.status(401).json({ error: 'Invalid or expired session' });

    const supabase = getSupabase();
    // Validate match participation
    const { data: match } = await supabase
      .from('matches')
      .select('user_a, user_b')
      .eq('id', matchId)
      .single();

    if (!match) return res.status(404).json({ error: 'Match not found' });
    if (match.user_a !== sessionId && match.user_b !== sessionId) {
      return res.status(403).json({ error: 'Unauthorized match participant' });
    }

    const { data } = await supabase
      .from('temporary_messages')
      .select('*')
      .eq('match_id', matchId)
      .order('created_at', { ascending: true });
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

router.get('/analytics', async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || authHeader !== 'Bearer admin-token') {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    const supabase = getSupabase();
    const [waitingCount, matchesCount, likesCount, reportsCount, sessionsQuery] = await Promise.all([
      supabase.from('waiting_queue').select('*', { count: 'exact', head: true }).eq('status', 'waiting'),
      supabase.from('matches').select('*', { count: 'exact', head: true }),
      supabase.from('likes').select('*', { count: 'exact', head: true }),
      supabase.from('reports').select('*', { count: 'exact', head: true }),
      supabase.from('visitor_sessions').select('interest_tags, country, state, city, languages')
    ]);

    const interestsFreq: Record<string, number> = {};
    const locationsFreq: Record<string, number> = {};
    const languagesFreq: Record<string, number> = {};

    sessionsQuery.data?.forEach((s: any) => {
      if (s.interest_tags) s.interest_tags.forEach((t: string) => { interestsFreq[t] = (interestsFreq[t] || 0) + 1; });
      if (s.languages) s.languages.forEach((l: string) => { languagesFreq[l] = (languagesFreq[l] || 0) + 1; });
      if (s.city) {
        locationsFreq[s.city] = (locationsFreq[s.city] || 0) + 1;
      } else if (s.country) {
        locationsFreq[s.country] = (locationsFreq[s.country] || 0) + 1;
      }
    });

    res.json({
      success: true,
      data: {
        onlineNow: waitingCount.count ?? 0,
        totalMatches: matchesCount.count ?? 0,
        totalLikes: likesCount.count ?? 0,
        totalReports: reportsCount.count ?? 0,
        topInterests: Object.entries(interestsFreq).sort((a, b) => b[1] - a[1]).slice(0, 5),
        topLocations: Object.entries(locationsFreq).sort((a, b) => b[1] - a[1]).slice(0, 5),
        topLanguages: Object.entries(languagesFreq).sort((a, b) => b[1] - a[1]).slice(0, 5),
        matchmaker: {
          totalSearchingUsers: matchmakerMetrics.totalSearchingUsers,
          averageWaitTime: matchmakerMetrics.averageWaitTime,
          maximumWaitTime: matchmakerMetrics.maximumWaitTime,
          successfulMatches: matchmakerMetrics.successfulMatches,
          failedMatches: matchmakerMetrics.failedMatches,
          rematches: matchmakerMetrics.rematches,
          abandonedSearches: matchmakerMetrics.abandonedSearches,
        }
      }
    });
  } catch (err) {
    next(err);
  }
});

export default router;

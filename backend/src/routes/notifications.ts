import { Router } from 'express';
import { getSupabase } from '../database/client.js';

const router = Router();

router.post('/subscribe', async (req, res, next) => {
  try {
    const { subscription, sessionId, browser, os, deviceType } = req.body;
    
    if (!subscription || !subscription.endpoint) {
      return res.status(400).json({ error: 'Invalid subscription object' });
    }

    const supabase = getSupabase();

    // 1. Upsert into push_subscriptions using subscription_json as the unique identifier
    const { data: subData, error: subErr } = await supabase
      .from('push_subscriptions')
      .upsert({
        session_id: sessionId || null,
        subscription_json: subscription,
        browser,
        os,
        device_type: deviceType,
        last_seen: new Date().toISOString()
      }, { onConflict: 'subscription_json' })
      .select('id')
      .single();

    if (subErr) throw subErr;

    // 2. If the user had an active session, cache their preferences against this subscription
    if (sessionId && subData) {
      const { data: sessionData } = await supabase
        .from('visitor_sessions')
        .select('display_name, gender, looking_for, college, city, state, country, languages, interest_tags, match_mode')
        .eq('id', sessionId)
        .single();

      if (sessionData) {
        await supabase
          .from('user_preferences_cache')
          .upsert({
            subscription_id: subData.id,
            display_name: sessionData.display_name,
            gender: sessionData.gender,
            looking_for: sessionData.looking_for,
            college: sessionData.college,
            city: sessionData.city,
            state: sessionData.state,
            country: sessionData.country,
            languages: sessionData.languages,
            interests: sessionData.interest_tags,
            match_mode: sessionData.match_mode
          }, { onConflict: 'subscription_id' });
      }
    }

    res.json({ success: true, subscriptionId: subData.id });
  } catch (err) {
    next(err);
  }
});

export default router;

import { Router } from 'express';
import { requireAdminToken } from '../middleware/adminAuth.js';
import { CampaignManager } from '../notifications/CampaignManager.js';
import { TemplateEngine } from '../notifications/TemplateEngine.js';

import { getSupabase } from '../database/client.js';

const router = Router();

router.use(requireAdminToken);

router.get('/stats', async (req, res, next) => {
  try {
    const supabase = getSupabase();
    
    const { count: activeSubs } = await supabase
      .from('push_subscriptions')
      .select('*', { count: 'exact', head: true })
      .eq('enabled', true);

    res.json({
      activeSubs: activeSubs || 0,
      avgCtr: 0 // Future implementation: compute from campaigns
    });
  } catch (err) {
    next(err);
  }
});

router.get('/history', async (req, res, next) => {
  try {
    const supabase = getSupabase();
    
    // Group by campaignId from details payload
    const { data } = await supabase
      .from('analytics_events')
      .select('created_at, payload')
      .eq('event_type', 'NOTIFICATION_SENT')
      .order('created_at', { ascending: false })
      .limit(1000);

    const historyMap = new Map();
    if (data) {
      for (const row of data) {
        const campaignId = row.payload?.campaignId;
        if (!campaignId) continue;
        if (!historyMap.has(campaignId)) {
          historyMap.set(campaignId, { campaignId, sentAt: row.created_at, delivered: 0 });
        }
        historyMap.get(campaignId).delivered++;
      }
    }

    res.json(Array.from(historyMap.values()));
  } catch (err) {
    next(err);
  }
});

router.post('/broadcast', async (req, res, next) => {
  try {
    const { campaignId, templateType, context, deepLink, audienceSegments } = req.body;

    const title = 'Kaboom';
    const body = TemplateEngine.generateContent(templateType, context);

    const result = await CampaignManager.executeBroadcast(
      campaignId,
      title,
      body,
      deepLink,
      audienceSegments
    );

    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
});

router.post('/test', async (req, res, next) => {
  try {
    const { subscriptionJson, templateType, context, deepLink } = req.body;
    
    const title = 'Kaboom (Test)';
    const body = TemplateEngine.generateContent(templateType, context);

    const result = await CampaignManager.sendTestNotification(
      subscriptionJson,
      title,
      body,
      deepLink
    );

    res.json(result);
  } catch (err) {
    next(err);
  }
});

export default router;

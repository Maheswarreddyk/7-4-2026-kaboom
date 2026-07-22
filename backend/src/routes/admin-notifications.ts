import { Hono } from 'hono';
import { requireAdminToken } from '../middleware/adminAuth.js';
import { CampaignManager } from '../notifications/CampaignManager.js';
import { TemplateEngine } from '../notifications/TemplateEngine.js';

import { getSupabase } from '../database/client.js';

const router = new Hono();

router.use(requireAdminToken);

router.get('/stats', async (c: any) => {

    let body: any = {};
    try {
      const contentType = c.req.header('content-type') || '';
      if (contentType.includes('application/json')) {
        body = await c.req.json();
      } else if (contentType) {
        body = await c.req.parseBody();
      }
    } catch(e) {}
    
    const req: any = {
      body,
      query: c.req.query(),
      params: c.req.param(),
      headers: c.req.header(),
      path: c.req.path
    };
    
    const res: any = {
      json: (d: any) => c.json(d),
      status: (s: any) => ({ json: (d: any) => c.json(d, s) }),
      sendStatus: (s: any) => c.body(null, s),
      setHeader: (k: string, v: string) => c.header(k, v)
    };
    const next = (err?: any) => { if(err) throw err; };
  try {
    const supabase = getSupabase();
    
    const [activeSubsRes, inactiveSubsRes, sentRes, clickedRes] = await Promise.all([
      supabase.from('push_subscriptions').select('*', { count: 'exact', head: true }).eq('enabled', true),
      supabase.from('push_subscriptions').select('*', { count: 'exact', head: true }).eq('enabled', false),
      supabase.from('analytics_events').select('*', { count: 'exact', head: true }).eq('event_type', 'NOTIFICATION_SENT'),
      supabase.from('analytics_events').select('*', { count: 'exact', head: true }).eq('event_type', 'NOTIFICATION_CLICKED')
    ]);

    const activeSubs = activeSubsRes.count || 0;
    const inactiveSubs = inactiveSubsRes.count || 0;
    const sent = sentRes.count || 0;
    const clicked = clickedRes.count || 0;
    const avgCtr = sent > 0 ? (clicked / sent) * 100 : 0;

    return res.json({
      activeSubs,
      inactiveSubs,
      sent,
      clicked,
      avgCtr,
      permissionDenied: 0,
      revoked: 0,
      dismissed: 0,
    });
  } catch (err: any) {
    return c.json({ error: err.message || 'Internal error' }, 500);
  }
});

router.get('/history', async (c: any) => {

    let body: any = {};
    try {
      const contentType = c.req.header('content-type') || '';
      if (contentType.includes('application/json')) {
        body = await c.req.json();
      } else if (contentType) {
        body = await c.req.parseBody();
      }
    } catch(e) {}
    
    const req: any = {
      body,
      query: c.req.query(),
      params: c.req.param(),
      headers: c.req.header(),
      path: c.req.path
    };
    
    const res: any = {
      json: (d: any) => c.json(d),
      status: (s: any) => ({ json: (d: any) => c.json(d, s) }),
      sendStatus: (s: any) => c.body(null, s),
      setHeader: (k: string, v: string) => c.header(k, v)
    };
    const next = (err?: any) => { if(err) throw err; };
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

    return res.json(Array.from(historyMap.values()));
  } catch (err: any) {
    return c.json({ error: err.message || 'Internal error' }, 500);
  }
});

router.post('/broadcast', async (c: any) => {

    let body: any = {};
    try {
      const contentType = c.req.header('content-type') || '';
      if (contentType.includes('application/json')) {
        body = await c.req.json();
      } else if (contentType) {
        body = await c.req.parseBody();
      }
    } catch(e) {}
    
    const req: any = {
      body,
      query: c.req.query(),
      params: c.req.param(),
      headers: c.req.header(),
      path: c.req.path
    };
    
    const res: any = {
      json: (d: any) => c.json(d),
      status: (s: any) => ({ json: (d: any) => c.json(d, s) }),
      sendStatus: (s: any) => c.body(null, s),
      setHeader: (k: string, v: string) => c.header(k, v)
    };
    const next = (err?: any) => { if(err) throw err; };
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

    return res.json({ success: true, ...result });
  } catch (err: any) {
    return c.json({ error: err.message || 'Internal error' }, 500);
  }
});

router.post('/test', async (c: any) => {

    let body: any = {};
    try {
      const contentType = c.req.header('content-type') || '';
      if (contentType.includes('application/json')) {
        body = await c.req.json();
      } else if (contentType) {
        body = await c.req.parseBody();
      }
    } catch(e) {}
    
    const req: any = {
      body,
      query: c.req.query(),
      params: c.req.param(),
      headers: c.req.header(),
      path: c.req.path
    };
    
    const res: any = {
      json: (d: any) => c.json(d),
      status: (s: any) => ({ json: (d: any) => c.json(d, s) }),
      sendStatus: (s: any) => c.body(null, s),
      setHeader: (k: string, v: string) => c.header(k, v)
    };
    const next = (err?: any) => { if(err) throw err; };
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

    return res.json(result);
  } catch (err: any) {
    return c.json({ error: err.message || 'Internal error' }, 500);
  }
});

export default router;

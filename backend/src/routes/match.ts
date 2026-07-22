import { Hono } from 'hono';
import {
  joinQueue,
  leaveQueue,
  markMatchReady,
  nextPartner,
  notifyPartnerLeft,
  getMatchStatus,
} from '../services/matchService.js';
import { queueLimiter } from '../middleware/queueLimiter.js';

const router = new Hono();

router.post('/join', queueLimiter, async (c: any) => {

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
    const { sessionId, sessionToken, matchMode, tags, genderPreference } = req.body;
    if (!sessionId || !sessionToken) {
      return res.status(400).json({ error: 'sessionId and sessionToken are required' });
    }
    const result = await joinQueue(sessionId, sessionToken, matchMode, tags, genderPreference);
    return res.json({ success: true, data: result });
  } catch (err: any) {
    return c.json({ error: err.message || 'Internal error' }, 500);
  }
});

router.get('/status', queueLimiter, async (c: any) => {

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
    // Get headers
    const sessionId = req.headers['x-session-id'] as string;
    const sessionToken = req.headers['x-session-token'] as string;
    if (!sessionId || !sessionToken) {
      return res.status(400).json({ error: 'x-session-id and x-session-token headers are required' });
    }
    const result = await getMatchStatus(sessionId, sessionToken);
    return res.json({ success: true, data: result });
  } catch (err: any) {
    return c.json({ error: err.message || 'Internal error' }, 500);
  }
});

router.post('/leave', queueLimiter, async (c: any) => {

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
    const { sessionId, sessionToken, matchId } = req.body;
    if (!sessionId || !sessionToken) {
      return res.status(400).json({ error: 'sessionId and sessionToken are required' });
    }
    await leaveQueue(sessionId, sessionToken, matchId);
    return res.json({ success: true });
  } catch (err: any) {
    if (err.message && err.message.includes('Illegal state transition')) {
      return res.status(409).json({ success: false, error: err.message });
    }
    return c.json({ error: err.message || 'Internal error' }, 500);
  }
});

router.post('/next', queueLimiter, async (c: any) => {

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
    const { sessionId, sessionToken, matchId, reason } = req.body;
    if (!sessionId || !sessionToken) {
      return res.status(400).json({ error: 'sessionId and sessionToken are required' });
    }
    const result = await nextPartner(sessionId, sessionToken, matchId, reason || 'next');
    return res.json({ success: true, data: result });
  } catch (err: any) {
    if (err.message && err.message.includes('Illegal state transition')) {
      return res.status(409).json({ success: false, error: err.message });
    }
    return c.json({ error: err.message || 'Internal error' }, 500);
  }
});

router.post('/disconnect', queueLimiter, async (c: any) => {

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
    const { sessionId, sessionToken, reason, matchId } = req.body;
    if (!sessionId || !sessionToken) {
      return res.status(400).json({ error: 'sessionId and sessionToken are required' });
    }
    await notifyPartnerLeft(sessionId, sessionToken, reason ?? 'disconnect', matchId);
    return res.json({ success: true });
  } catch (err: any) {
    return c.json({ error: err.message || 'Internal error' }, 500);
  }
});

router.post('/ready', queueLimiter, async (c: any) => {

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
    const { sessionId, sessionToken, matchId } = req.body;
    if (!sessionId || !sessionToken || !matchId) {
      return res.status(400).json({ success: false, error: 'sessionId, sessionToken, and matchId are required' });
    }
    const result = await markMatchReady(sessionId, sessionToken, matchId);
    return res.json({ success: true, data: result });
  } catch (err) {
    console.error('[API /ready endpoint error]', err);
    return res.status(422).json({
      success: false,
      error: err instanceof Error ? err.message : 'Failed to mark match ready',
    });
  }
});

router.post('/connected', queueLimiter, async (c: any) => {

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
    const { sessionId, sessionToken, matchId } = req.body;
    if (!sessionId || !sessionToken || !matchId) {
      return res.status(400).json({ success: false, error: 'sessionId, sessionToken, and matchId are required' });
    }
    const { markMediaConnected } = await import('../services/matchService.js');
    const result = await markMediaConnected(sessionId, sessionToken, matchId);
    return res.json({ success: true, data: result });
  } catch (err) {
    console.error('[API /connected endpoint error]', err);
    return res.status(422).json({
      success: false,
      error: err instanceof Error ? err.message : 'Failed to mark media connected',
    });
  }
});

router.post('/ping', async (c: any) => {

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
    const { sessionId } = req.body;
    if (!sessionId) {
      return res.status(400).json({ error: 'sessionId required' });
    }
    
    console.log(`[Ping] Pinging User sessionId: ${sessionId}`);
    
    const { broadcastToSession } = await import('../services/broadcast.js');

    // Send standard ping
    await broadcastToSession(sessionId, 'ping', { time: Date.now() });

    // Send FAKE MATCHED EVENT to test if frontend receives it!
    await broadcastToSession(sessionId, 'matched', {
      matchId: 'test-match-id',
      partnerSessionId: 'fake-partner-id',
      isInitiator: true,
      iceServers: [],
    });

    return res.json({ success: true, message: `Ping + Matched sent to ${sessionId}` });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to ping', details: err instanceof Error ? err.message : String(err) });
  }
});

export default router;

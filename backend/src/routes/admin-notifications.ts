import { Router } from 'express';
import { requireAdminToken } from '../middleware/adminAuth.js';
import { CampaignManager } from '../notifications/CampaignManager.js';
import { TemplateEngine } from '../notifications/TemplateEngine.js';

const router = Router();

router.use(requireAdminToken);

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

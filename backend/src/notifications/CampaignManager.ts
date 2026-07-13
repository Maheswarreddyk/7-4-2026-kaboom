import webPush from 'web-push';
import { getSupabase } from '../database/client.js';
import { NotificationEngine } from './NotificationEngine.js';

export class CampaignManager {
  static init() {
    const pubKey = process.env.VAPID_PUBLIC_KEY;
    const privKey = process.env.VAPID_PRIVATE_KEY;
    const subject = process.env.VAPID_SUBJECT || 'mailto:admin@kaboom-tv.com';

    if (pubKey && privKey) {
      webPush.setVapidDetails(
        subject,
        pubKey,
        privKey
      );
      console.log('[CampaignManager] Web Push initialized successfully.');
    } else {
      console.warn('[CampaignManager] Missing VAPID_PUBLIC_KEY or VAPID_PRIVATE_KEY. Push notifications will not work.');
    }
  }

  // Broadcast to audience
  static async executeBroadcast(campaignId: string, title: string, body: string, deepLink: string, audienceSegments: Record<string, any>) {
    // 1. Resolve Audience
    const targetAudience = await NotificationEngine.resolveAudience(audienceSegments);
    if (!targetAudience.length) return { sent: 0, failed: 0 };

    let sentCount = 0;
    let failedCount = 0;
    const supabase = getSupabase();

    // 2. Fire Push Notifications
    const promises = targetAudience.map(async (user) => {
      const subJSON = user.push_subscriptions.subscription_json;
      
      try {
        await webPush.sendNotification(
          subJSON, 
          JSON.stringify({ title, body, url: deepLink, campaignId })
        );
        sentCount++;
        
        // Log Delivery Success
        await supabase.from('analytics_events').insert({
          event_type: 'NOTIFICATION_SENT',
          session_id: user.subscription_id, // We link to subscription id for offline tracking
          payload: { campaignId }
        });

      } catch (err: any) {
        failedCount++;
        if (err.statusCode === 410 || err.statusCode === 404) {
          // Subscription revoked or expired
          await supabase.from('push_subscriptions').update({ enabled: false }).eq('subscription_json->>endpoint', subJSON.endpoint);
        }
      }
    });

    await Promise.all(promises);

    return { sent: sentCount, failed: failedCount };
  }

  // Used by the Admin Simulator
  static async sendTestNotification(subscriptionJson: any, title: string, body: string, deepLink: string) {
    try {
      await webPush.sendNotification(
        subscriptionJson, 
        JSON.stringify({ title, body, url: deepLink, campaignId: 'TEST_CAMPAIGN' })
      );
      return { success: true };
    } catch (err: any) {
      console.error('Test Push Failed', err);
      return { success: false, error: err.message };
    }
  }
}

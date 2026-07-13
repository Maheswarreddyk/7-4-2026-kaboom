import { safeLocalStorage } from '../utils/index.js';

export class PushService {
  private static readonly VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY || '';
  
  static async registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      console.warn('Push messaging is not supported');
      return null;
    }

    try {
      const registration = await navigator.serviceWorker.register('/sw.js');
      console.log('Service Worker registered successfully');
      return registration;
    } catch (err) {
      console.error('Service Worker registration failed:', err);
      return null;
    }
  }

  static async requestSubscription(): Promise<PushSubscription | null> {
    const registration = await this.registerServiceWorker();
    if (!registration) return null;

    try {
      // 1. Check if permission is already granted. If default, the browser will prompt.
      // But we ONLY call this after the Soft Permission UI.
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        throw new Error('Notification permission denied');
      }

      // 2. Subscribe using VAPID
      const subscribeOptions = {
        userVisibleOnly: true,
        applicationServerKey: this.urlBase64ToUint8Array(this.VAPID_PUBLIC_KEY)
      };

      const subscription = await registration.pushManager.subscribe(subscribeOptions);
      return subscription;
    } catch (err) {
      console.error('Failed to subscribe to push service:', err);
      return null;
    }
  }

  static async sendSubscriptionToBackend(subscription: PushSubscription, sessionId: string | null) {
    try {
      const API_URL = import.meta.env.VITE_API_URL || '';
      
      await fetch(`${API_URL}/api/notifications/subscribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subscription,
          sessionId,
          browser: this.getBrowserName(),
          os: this.getOSName(),
          deviceType: window.innerWidth < 768 ? 'Mobile' : 'Desktop'
        })
      });
      
      // Mark locally that we have successfully subscribed
      safeLocalStorage.setItem('kaboom_push_subscribed', 'true');
      safeLocalStorage.setItem('kaboom_push_subscribed_data', JSON.stringify(subscription));
    } catch (err) {
      console.error('Failed to send subscription to backend:', err);
    }
  }

  // Helper to convert VAPID key
  private static urlBase64ToUint8Array(base64String: string) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
      .replace(/-/g, '+')
      .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }

  private static getBrowserName() {
    const ua = navigator.userAgent;
    if (ua.includes('Firefox/')) return 'Firefox';
    if (ua.includes('Edg/')) return 'Edge';
    if (ua.includes('Chrome/')) return 'Chrome';
    if (ua.includes('Safari/') && !ua.includes('Chrome/')) return 'Safari';
    return 'Unknown Browser';
  }

  private static getOSName() {
    const ua = navigator.userAgent;
    if (ua.includes('Win')) return 'Windows';
    if (ua.includes('Mac')) return 'macOS';
    if (ua.includes('Android')) return 'Android';
    if (ua.includes('Linux')) return 'Linux';
    if (ua.includes('iPhone') || ua.includes('iPad')) return 'iOS';
    return 'Unknown OS';
  }
}

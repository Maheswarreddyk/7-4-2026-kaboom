declare module 'web-push' {
  interface PushSubscription {
    endpoint: string;
    keys: {
      p256dh: string;
      auth: string;
    };
  }

  interface VapidKeys {
    publicKey: string;
    privateKey: string;
  }

  interface RequestDetails {
    method: string;
    headers: Record<string, string>;
    body: string;
    endpoint: string;
    proxy?: string;
    timeout?: number;
  }

  interface SendResult {
    statusCode: number;
    body: string;
    headers: Record<string, string>;
  }

  interface Options {
    gcmAPIKey?: string;
    vapidDetails?: {
      subject: string;
      publicKey: string;
      privateKey: string;
    };
    timeout?: number;
    TTL?: number;
    headers?: Record<string, string>;
    contentEncoding?: string;
    urgency?: 'very-low' | 'low' | 'normal' | 'high';
    topic?: string;
    proxy?: string;
  }

  function setGCMAPIKey(apiKey: string): void;
  function setVapidDetails(subject: string, publicKey: string, privateKey: string): void;
  function generateVAPIDKeys(): VapidKeys;
  function generateRequestDetails(subscription: PushSubscription, payload?: string | Buffer, options?: Options): Promise<RequestDetails>;
  function sendNotification(subscription: PushSubscription, payload?: string | Buffer, options?: Options): Promise<SendResult>;
}

// Kaboom TV Intelligent Browser Push Service Worker
self.addEventListener('push', function(event) {
  if (event.data) {
    try {
      const data = event.data.json();
      
      const options = {
        body: data.body,
        icon: '/kaboom_icon_192.png',
        badge: '/kaboom_badge.png',
        data: {
          url: data.url || '/',
          campaignId: data.campaignId
        },
        vibrate: [200, 100, 200],
        requireInteraction: data.requireInteraction || false
      };

      event.waitUntil(
        self.registration.showNotification(data.title, options)
      );
    } catch (e) {
      console.error('Error parsing push data', e);
    }
  }
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();

  // If we have a campaign ID, we should try to track the click
  // We'll log it in the frontend app, but the SW can also ping an endpoint if needed
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
      // If Kaboom is already open, focus it and send a message
      for (let i = 0; i < clientList.length; i++) {
        const client = clientList[i];
        if (client.url.includes(self.registration.scope) && 'focus' in client) {
          client.postMessage({
            type: 'NOTIFICATION_CLICKED',
            url: event.notification.data.url,
            campaignId: event.notification.data.campaignId
          });
          return client.focus();
        }
      }
      
      // Otherwise open a new window
      if (clients.openWindow) {
        // Append campaign ID so the React app can process it on cold boot
        const targetUrl = new URL(event.notification.data.url, self.location.origin);
        if (event.notification.data.campaignId) {
          targetUrl.searchParams.append('campaign', event.notification.data.campaignId);
        }
        return clients.openWindow(targetUrl.href);
      }
    })
  );
});

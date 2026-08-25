// ==============================================================================
// BUKKIT PRODUCTION UNIFIED SERVICE WORKER (WEB PUSH + FCM + OFFLINE ASSETS)
// ==============================================================================

const CACHE_NAME = 'bukkit-static-v2';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/bukkit-icon.svg',
  '/bukkit-logo.svg',
  '/bukkit-logo-receipt.svg'
];

// Install & Cache Shell
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn('[SW] Cache prefetch notice:', err);
      });
    })
  );
});

// Activate & Cleanup Old Caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

// Import Firebase Messaging compat scripts for background FCM
try {
  importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js');
  importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging-compat.js');

  firebase.initializeApp({
    projectId: "bukkit-61aef",
    appId: "1:737788701507:web:58cae400c951e61c8a9df6",
    apiKey: "AIzaSyCHCNm1k4ILYvKS77gnRnVSGwGXiytVdw8",
    authDomain: "bukkit-61aef.firebaseapp.com",
    storageBucket: "bukkit-61aef.firebasestorage.app",
    messagingSenderId: "737788701507"
  });

  const messaging = firebase.messaging();

  messaging.onBackgroundMessage((payload) => {
    console.log('[SW-FCM] Received background message:', payload);
    const title = payload.notification?.title || payload.data?.title || 'BUKKIT Order Status Update';
    const body = payload.notification?.body || payload.data?.body || 'Your order status has been updated.';
    const deepLink = payload.data?.deep_link || payload.data?.deepLink || (payload.data?.orderId ? `/orders/${payload.data.orderId}` : '/');

    const options = {
      body,
      icon: '/bukkit-icon.svg',
      badge: '/bukkit-icon.svg',
      data: {
        ...(payload.data || {}),
        deepLink,
        url: deepLink
      },
      vibrate: [200, 100, 200, 100, 200],
      tag: payload.data?.orderId ? `bukkit-order-${payload.data.orderId}` : `bukkit-notif-${Date.now()}`,
      renotify: true,
      requireInteraction: payload.data?.severity === 'CRITICAL' || payload.data?.severity === 'WARNING',
      actions: [
        { action: 'open_order', title: '👁️ Open & Track' },
        { action: 'dismiss', title: 'Dismiss' }
      ]
    };

    self.registration.showNotification(title, options);
  });
} catch (e) {
  console.warn('[SW] Firebase messaging compat load notice:', e);
}

// ==============================================================================
// NATIVE WEB PUSH LISTENER (Push API RFC 8030 / VAPID Event Stream)
// ==============================================================================
self.addEventListener('push', (event) => {
  console.log('[SW-WebPush] Push event received:', event);

  let pushData = {
    title: 'BUKKIT Campus Alert 🔔',
    body: 'You have a new campus food update.',
    deepLink: '/',
    severity: 'INFO',
    orderId: undefined,
    conversationId: undefined
  };

  if (event.data) {
    try {
      const parsed = event.data.json();
      pushData = {
        title: parsed.title || parsed.notification?.title || pushData.title,
        body: parsed.body || parsed.message || parsed.notification?.body || pushData.body,
        deepLink: parsed.deep_link || parsed.deepLink || parsed.url || pushData.deepLink,
        severity: parsed.severity || 'INFO',
        orderId: parsed.orderId || parsed.order_id,
        conversationId: parsed.conversationId || parsed.conversation_id,
        ...parsed
      };
    } catch (parseErr) {
      pushData.body = event.data.text() || pushData.body;
    }
  }

  // Derive target deep link according to payload contents if not explicitly specified
  let targetLink = pushData.deepLink;
  if (!targetLink || targetLink === '/') {
    if (pushData.orderId) {
      if (pushData.role === 'kitchen' || pushData.role === 'vendor') {
        targetLink = `/vendor/orders/${pushData.orderId}`;
      } else if (pushData.role === 'rider') {
        targetLink = `/rider/deliveries/${pushData.orderId}`;
      } else {
        targetLink = `/orders/${pushData.orderId}`;
      }
    } else if (pushData.conversationId) {
      targetLink = `/chat/${pushData.conversationId}`;
    }
  }

  const notificationOptions = {
    body: pushData.body,
    icon: '/bukkit-icon.svg',
    badge: '/bukkit-icon.svg',
    data: {
      ...pushData,
      deepLink: targetLink,
      url: targetLink
    },
    vibrate: pushData.severity === 'CRITICAL' ? [300, 100, 300, 100, 300] : [200, 100, 200],
    tag: pushData.orderId ? `bukkit-order-${pushData.orderId}` : `bukkit-push-${Date.now()}`,
    renotify: true,
    requireInteraction: pushData.severity === 'CRITICAL',
    actions: [
      { action: 'view_details', title: '🚀 View Now' },
      { action: 'dismiss', title: 'Dismiss' }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(pushData.title, notificationOptions)
  );
});

// ==============================================================================
// NOTIFICATION CLICK & DEEP LINK ROUTER
// ==============================================================================
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'dismiss') {
    return;
  }

  const notificationData = event.notification.data || {};
  const deepLink = notificationData.deepLink || notificationData.url || '/';

  console.log('[SW] Notification clicked, navigating to deepLink:', deepLink);

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // Check if a BUKKIT window is already open
      for (const client of windowClients) {
        if ('focus' in client) {
          // Send deep link message to frontend router
          client.postMessage({
            type: 'BUKKIT_NOTIFICATION_CLICK',
            deepLink: deepLink,
            data: notificationData
          });
          // Focus and navigate the existing tab
          if ('navigate' in client && deepLink && !client.url.endsWith(deepLink)) {
            client.navigate(deepLink);
          }
          return client.focus();
        }
      }

      // If no window is currently open, open a new window to the deepLink
      if (clients.openWindow) {
        return clients.openWindow(deepLink);
      }
    })
  );
});

// Resubscribe on push subscription change
self.addEventListener('pushsubscriptionchange', (event) => {
  console.log('[SW] Push subscription expired or changed. Resubscribing...');
  event.waitUntil(
    self.registration.pushManager
      .subscribe({ userVisibleOnly: true })
      .then((newSubscription) => {
        return fetch('/api/webpush/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            subscription: newSubscription
          })
        });
      })
      .catch((err) => {
        console.warn('[SW] Error during pushsubscriptionchange:', err);
      })
  );
});

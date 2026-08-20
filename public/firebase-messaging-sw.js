// Firebase Cloud Messaging Background Service Worker for BUKKIT
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging-compat.js');

// Initialize Firebase App inside Service Worker
firebase.initializeApp({
  projectId: "dulcet-signifier-wd2jw",
  appId: "1:168886649227:web:f4a829f20b0add486c6f8e",
  apiKey: "AIzaSyDif6MIgtqb7QobRE-9gvO_H244FJ6sUU8",
  authDomain: "dulcet-signifier-wd2jw.firebaseapp.com",
  storageBucket: "dulcet-signifier-wd2jw.firebasestorage.app",
  messagingSenderId: "168886649227"
});

const messaging = firebase.messaging();

// Handle background FCM notifications
messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message:', payload);
  const notificationTitle = payload.notification?.title || payload.data?.title || 'BUKKIT Order Status Update';
  const deepLink = payload.data?.deep_link || payload.data?.deepLink || (payload.data?.orderId ? `/orders/${payload.data.orderId}` : '/');
  
  const notificationOptions = {
    body: payload.notification?.body || payload.data?.body || 'Your order status has been updated.',
    icon: '/favicon.ico',
    badge: '/favicon.ico',
    data: {
      ...payload.data,
      deepLink: deepLink
    },
    vibrate: [200, 100, 200],
    tag: payload.data?.orderId ? `bukkit-order-${payload.data.orderId}` : 'bukkit-notification',
    renotify: true,
    actions: [
      { action: 'open_order', title: 'Open & View' }
    ]
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

// Handle push notification click and deep link routing
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const deepLink = event.notification.data?.deepLink || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // If a window client already exists, focus it and post a message
      for (const client of windowClients) {
        if (client.url && 'focus' in client) {
          client.postMessage({ type: 'BUKKIT_NOTIFICATION_CLICK', deepLink });
          return client.focus();
        }
      }
      // Otherwise open a new window
      if (clients.openWindow) {
        return clients.openWindow(deepLink);
      }
    })
  );
});

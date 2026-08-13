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
  const notificationOptions = {
    body: payload.notification?.body || payload.data?.body || 'Your order status has been updated.',
    icon: '/favicon.ico',
    badge: '/favicon.ico',
    data: payload.data,
    vibrate: [200, 100, 200],
    tag: payload.data?.orderId || 'bukkit-order-update'
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

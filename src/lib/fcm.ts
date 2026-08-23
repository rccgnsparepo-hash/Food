import { getMessaging, getToken, onMessage, isSupported, Messaging } from 'firebase/messaging';
import { doc, setDoc } from "./embeddedDb";
import { app, db } from './firebase';
import { toast } from 'sonner';

let messagingInstance: Messaging | null = null;

/**
 * Register Service Worker for FCM Background Messages
 */
export async function registerFcmServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js', {
      scope: '/'
    });
    console.log('[FCM] Service Worker registered successfully:', registration.scope);
    return registration;
  } catch (error) {
    console.warn('[FCM] Service Worker registration failed:', error);
    return null;
  }
}

/**
 * Get or initialize Firebase Messaging instance safely
 */
export async function getFcmMessaging(): Promise<Messaging | null> {
  if (messagingInstance) return messagingInstance;

  try {
    const supported = await isSupported();
    if (supported) {
      messagingInstance = getMessaging(app);
      return messagingInstance;
    }
  } catch (error) {
    console.warn('[FCM] Firebase Messaging is not supported in this browser:', error);
  }
  return null;
}

/**
 * Request Notification Permission and retrieve FCM Device Token
 */
export async function requestFCMToken(userId?: string, isUserInitiated: boolean = false): Promise<string | null> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    if (isUserInitiated) {
      toast.error('Notifications are not supported in this browser.');
    }
    return null;
  }

  const isInsideIframe = typeof window !== 'undefined' && window.self !== window.top;

  try {
    // If not user-initiated and permission is not already granted, avoid noisy prompts/errors on load
    if (!isUserInitiated && Notification.permission !== 'granted') {
      return null;
    }

    let permission = Notification.permission;
    if (permission !== 'granted' && isUserInitiated) {
      try {
        permission = await Notification.requestPermission();
      } catch (pErr) {
        console.warn('[FCM] Error requesting permission:', pErr);
      }
    }

    if (permission !== 'granted') {
      if (isUserInitiated) {
        if (isInsideIframe) {
          toast.warning('Notifications are restricted inside embedded preview. Open app in a new tab to enable browser push alerts.');
        } else {
          toast.warning('Notification permission is disabled in browser settings. In-app alerts remain fully active.');
        }
      }
      return null;
    }

    const swRegistration = await registerFcmServiceWorker();
    const messaging = await getFcmMessaging();

    if (!messaging) {
      if (isUserInitiated) {
        toast.info('Firebase Messaging instance unavailable. Standard in-app notifications are active.');
      }
      return null;
    }

    // Retrieve FCM token
    const token = await getToken(messaging, {
      serviceWorkerRegistration: swRegistration || undefined
    });

    if (token) {
      console.log('[FCM] Device Token acquired:', token);

      // Save token to Firestore user profile if logged in
      if (userId) {
        await setDoc(
          doc(db, 'users', userId),
          {
            fcm_token: token,
            fcm_updated_at: new Date().toISOString()
          },
          { merge: true }
        );
      }

      if (isUserInitiated) {
        toast.success('✓ Real-time Order Push Notifications enabled!');
      }
      return token;
    } else {
      console.warn('[FCM] No registration token available.');
      return null;
    }
  } catch (error) {
    console.error('[FCM] Error requesting FCM token:', error);
    if (isUserInitiated) {
      toast.error('Could not activate push notifications in this environment.');
    }
    return null;
  }
}

/**
 * Subscribe to Foreground FCM Messages
 */
export async function setupForegroundFCMListener(
  onNotification?: (title: string, body: string, data?: any) => void
) {
  const messaging = await getFcmMessaging();
  if (!messaging) return () => {};

  const unsubscribe = onMessage(messaging, (payload) => {
    console.log('[FCM] Foreground message received:', payload);
    const title = payload.notification?.title || payload.data?.title || 'Order Update';
    const body = payload.notification?.body || payload.data?.body || 'Your order status has changed!';

    if (onNotification) {
      onNotification(title, body, payload.data);
    } else {
      // Default foreground behavior: show toast and trigger native browser Notification if permitted
      toast.info(`🔔 ${title}: ${body}`);
      if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        new Notification(title, {
          body,
          icon: '/favicon.ico',
          tag: payload.data?.orderId || 'bukkit-order'
        });
      }
    }
  });

  return unsubscribe;
}

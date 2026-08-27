import { getMessaging, getToken, onMessage, isSupported, Messaging } from 'firebase/messaging';
import { doc, setDoc } from "./embeddedDb";
import { app, db } from './firebase';
import { toast } from 'sonner';

let messagingInstance: Messaging | null = null;

/**
 * Register and wait for Service Worker to become ACTIVE for FCM & Web Push
 */
export async function registerFcmServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return null;
  }

  const isElectron = Boolean((window as any).electronAPI) || window.location.protocol === 'file:';
  if (isElectron) {
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js', {
      scope: '/'
    });

    // Wait until service worker is ready & active
    await navigator.serviceWorker.ready;

    // If registration.active is not immediately present, wait for state transition
    if (!registration.active) {
      await new Promise<void>((resolve) => {
        const sw = registration.installing || registration.waiting;
        if (!sw) {
          resolve();
          return;
        }
        if (sw.state === 'activated') {
          resolve();
          return;
        }
        const stateChangeHandler = () => {
          if (sw.state === 'activated' || registration.active) {
            sw.removeEventListener('statechange', stateChangeHandler);
            resolve();
          }
        };
        sw.addEventListener('statechange', stateChangeHandler);
        setTimeout(resolve, 3000); // 3s fallback timeout
      });
    }

    console.log('[FCM] Service Worker active and ready:', registration.scope);
    return registration;
  } catch (error) {
    console.warn('[FCM] Service Worker registration notice:', error);
    return null;
  }
}

/**
 * Get or initialize Firebase Messaging instance safely
 */
export async function getFcmMessaging(): Promise<Messaging | null> {
  if (messagingInstance) return messagingInstance;

  try {
    const isElectron = Boolean((window as any).electronAPI) || (typeof window !== 'undefined' && window.location.protocol === 'file:');
    if (isElectron) return null;

    const supported = await isSupported();
    if (supported) {
      messagingInstance = getMessaging(app);
      return messagingInstance;
    }
  } catch (error) {
    console.warn('[FCM] Firebase Messaging is not supported in this environment:', error);
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

  const isElectron = Boolean((window as any).electronAPI) || window.location.protocol === 'file:';
  if (isElectron) {
    if (isUserInitiated) {
      try {
        if (Notification.permission !== 'granted') {
          await Notification.requestPermission();
        }
        toast.success('✓ Desktop Notifications are active.');
      } catch (e) {
        // Non-blocking
      }
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
          toast.warning('Notifications are restricted inside embedded preview. Open app in a new tab to enable browser push alerts.', {
            action: {
              label: 'Open New Tab',
              onClick: () => {
                window.open(window.location.href, '_blank');
              }
            },
            duration: 6000
          });
        } else {
          toast.warning('Notification permission is disabled in browser settings. In-app alerts remain fully active.');
        }
      }
      return null;
    }

    const swRegistration = await registerFcmServiceWorker();
    if (!swRegistration || !swRegistration.active) {
      console.warn('[FCM] Active Service Worker not ready yet. Skipping token request for now.');
      return null;
    }

    const messaging = await getFcmMessaging();
    if (!messaging) {
      if (isUserInitiated) {
        toast.info('Firebase Messaging instance unavailable. Standard in-app notifications are active.');
      }
      return null;
    }

    // Retrieve FCM token with active service worker
    const token = await getToken(messaging, {
      serviceWorkerRegistration: swRegistration
    });

    if (token) {
      console.log('[FCM] Device Token acquired:', token);

      // Save token to Firestore user profile if logged in
      if (userId) {
        try {
          await setDoc(
            doc(db, 'users', userId),
            {
              fcm_token: token,
              fcm_updated_at: new Date().toISOString()
            },
            { merge: true }
          );
        } catch (dbErr) {
          console.warn('[FCM] Failed to update user fcm_token in Firestore:', dbErr);
        }
      }

      if (isUserInitiated) {
        toast.success('✓ Real-time Order Push Notifications enabled!');
      }
      return token;
    } else {
      console.warn('[FCM] No registration token available.');
      return null;
    }
  } catch (error: any) {
    console.warn('[FCM] Token acquisition notice:', error?.message || error);
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
  try {
    const messaging = await getFcmMessaging();
    if (!messaging) return () => {};

    const unsubscribe = onMessage(messaging, (payload) => {
      console.log('[FCM] Foreground message received:', payload);
      const title = payload.notification?.title || payload.data?.title || 'Order Update';
      const body = payload.notification?.body || payload.data?.body || 'Your order status has changed!';

      if (onNotification) {
        onNotification(title, body, payload.data);
      } else {
        toast.info(`🔔 ${title}: ${body}`);
        if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
          try {
            new Notification(title, {
              body,
              icon: '/bukkit-icon.svg',
              tag: payload.data?.orderId || 'bukkit-order'
            });
          } catch (nErr) {
            // Non-blocking
          }
        }
      }
    });

    return unsubscribe;
  } catch (err) {
    console.warn('[FCM] Error initializing foreground listener:', err);
    return () => {};
  }
}

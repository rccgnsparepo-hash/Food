import { doc, setDoc } from './embeddedDb';
import { db } from './firebase';
import { toast } from 'sonner';
import { apiFetchJson } from './apiConfig';
import { NotificationAppType, PushSubscriptionRecord } from '../types';

/**
 * Convert a base64 string to a Uint8Array for PushManager subscribe
 */
export function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * Check if Web Push and Service Worker are supported in the current environment
 */
export function isWebPushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

/**
 * Get current active Web Push Subscription if any
 */
export async function getExistingWebPushSubscription(): Promise<PushSubscription | null> {
  if (!isWebPushSupported()) return null;

  try {
    const registration = await navigator.serviceWorker.getRegistration();
    if (!registration) return null;
    return await registration.pushManager.getSubscription();
  } catch (err) {
    console.warn('[WebPush Client] Error checking existing subscription:', err);
    return null;
  }
}

/**
 * Register for Web Push Notifications (Standard RFC 8030 Push API + VAPID)
 */
export async function registerWebPush(
  userId?: string,
  role: NotificationAppType = 'CUSTOMER',
  isUserInitiated: boolean = false
): Promise<PushSubscription | null> {
  if (!isWebPushSupported()) {
    if (isUserInitiated) {
      toast.error('Web Push Notifications are not supported on this browser or platform.');
    }
    return null;
  }

  const isInsideIframe = typeof window !== 'undefined' && window.self !== window.top;

  try {
    // Check permission status
    if (!isUserInitiated && Notification.permission !== 'granted') {
      return null;
    }

    let permission = Notification.permission;
    if (permission !== 'granted' && isUserInitiated) {
      permission = await Notification.requestPermission();
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
          toast.warning('Push notifications are disabled in browser settings. You can enable them anytime.');
        }
      }
      return null;
    }

    // Register or get active service worker
    const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js', {
      scope: '/'
    });
    await navigator.serviceWorker.ready;

    // Check if already subscribed
    let subscription = await registration.pushManager.getSubscription();

    if (!subscription) {
      // 1. Fetch VAPID Public Key from authoritative server
      const keyResult = await apiFetchJson<{ success: boolean; publicKey: string }>('/api/webpush/vapid-public-key');
      if (!keyResult.ok || !keyResult.data?.success || !keyResult.data?.publicKey) {
        throw new Error(keyResult.error || 'Could not retrieve VAPID Public Key from server');
      }

      const applicationServerKey = urlBase64ToUint8Array(keyResult.data.publicKey);

      // 2. Subscribe to PushManager
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: applicationServerKey as any
      });
    }

    if (subscription) {
      const subJson = subscription.toJSON();
      const endpoint = subscription.endpoint;
      const p256dh = subJson.keys?.p256dh || '';
      const auth = subJson.keys?.auth || '';

      const platform = /android/i.test(navigator.userAgent)
        ? 'ANDROID'
        : /iphone|ipad|ipod/i.test(navigator.userAgent)
        ? 'IOS'
        : 'WEB';

      const browserInfo = navigator.userAgent.includes('Chrome')
        ? 'Chrome'
        : navigator.userAgent.includes('Firefox')
        ? 'Firefox'
        : navigator.userAgent.includes('Safari')
        ? 'Safari'
        : 'Browser';

      // 3. Register subscription on Authoritative Backend
      await apiFetchJson('/api/webpush/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: userId || 'anonymous_guest',
          subscription: {
            endpoint,
            keys: { p256dh, auth }
          },
          role,
          platform,
          browser: browserInfo,
          userAgent: navigator.userAgent
        })
      });

      // 4. Save to Firestore users/{uid}/pushSubscriptions/{subId}
      if (userId) {
        const subId = `sub_${userId}_${btoa(endpoint).slice(-16).replace(/[^a-zA-Z0-9]/g, '')}`;
        const subRecord: PushSubscriptionRecord = {
          subscription_id: subId,
          user_id: userId,
          endpoint,
          keys: { p256dh, auth },
          platform: platform as any,
          app_type: role,
          device_type: browserInfo,
          user_agent: navigator.userAgent,
          enabled: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          last_seen_at: new Date().toISOString()
        };

        try {
          await setDoc(doc(db, 'users', userId, 'pushSubscriptions', subId), subRecord, { merge: true });
        } catch (e) {
          // Embedded DB fallback
        }
      }

      if (isUserInitiated) {
        toast.success('✓ Real-time Web Push Alerts enabled successfully!');
      }

      console.log('[WebPush Client] Successfully subscribed:', subscription);
      return subscription;
    }

    return null;
  } catch (err: any) {
    console.error('[WebPush Client] Registration error:', err);
    if (isUserInitiated) {
      toast.error('Could not activate Web Push in this environment.');
    }
    return null;
  }
}

/**
 * Unsubscribe from Web Push
 */
export async function unsubscribeWebPush(userId?: string): Promise<boolean> {
  if (!isWebPushSupported()) return false;

  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();

    if (subscription) {
      const endpoint = subscription.endpoint;
      await subscription.unsubscribe();

      await apiFetchJson('/api/webpush/unsubscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          endpoint
        })
      });

      console.log('[WebPush Client] Unsubscribed from Web Push successfully');
      return true;
    }
    return false;
  } catch (err) {
    console.warn('[WebPush Client] Unsubscribe error:', err);
    return false;
  }
}

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
  if (typeof window === 'undefined') return false;
  // Electron environment uses Native System Notification
  if (Boolean((window as any).electronAPI) || window.location.protocol === 'file:') {
    return typeof Notification !== 'undefined';
  }
  return (
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

/**
 * Get current active Web Push Subscription if any
 */
export async function getExistingWebPushSubscription(): Promise<PushSubscription | null> {
  if (!isWebPushSupported() || typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.getRegistration();
    if (!registration) return null;
    return await registration.pushManager.getSubscription();
  } catch (err) {
    console.warn('[WebPush Client] Error checking existing subscription:', err);
    return null;
  }
}

// Deterministic fallback VAPID Public Key for RFC 8292 Web Push
export const DEFAULT_CLIENT_VAPID_PUBLIC_KEY =
  'BPxivn5IjNTybe5RKOPhjXJ5xoiOJxA7S2PgPBj3XRq9EPGJgUZx-pyRb6_eWbs5wsosT8I0FZsXc3-JTP03QD8';

/**
 * Register for Web Push Notifications (Standard RFC 8030 Push API + VAPID)
 */
export async function registerWebPush(
  userId?: string,
  role: NotificationAppType = 'CUSTOMER',
  isUserInitiated: boolean = false
): Promise<PushSubscription | null> {
  if (typeof window === 'undefined') return null;

  const isElectron = Boolean((window as any).electronAPI) || window.location.protocol === 'file:';

  // 1. Electron Desktop Native Notification handling
  if (isElectron) {
    try {
      if (typeof Notification !== 'undefined' && Notification.permission !== 'granted') {
        const perm = await Notification.requestPermission();
        if (perm === 'granted' && isUserInitiated) {
          toast.success('✓ Desktop Notifications enabled successfully!');
        }
      } else if (isUserInitiated) {
        toast.success('✓ Desktop Notifications are active.');
      }
      return null;
    } catch (e) {
      console.warn('[WebPush Client] Electron notification permission notice:', e);
      return null;
    }
  }

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

    // Fetch authoritative VAPID Public Key from server with deterministic fallback
    let rawPublicKey = DEFAULT_CLIENT_VAPID_PUBLIC_KEY;
    try {
      const keyResult = await apiFetchJson<{ success: boolean; publicKey: string }>('/api/webpush/vapid-public-key');
      if (keyResult.ok && keyResult.data?.publicKey) {
        rawPublicKey = keyResult.data.publicKey;
      }
    } catch (kErr) {
      console.warn('[WebPush Client] Using local VAPID fallback key:', kErr);
    }

    const applicationServerKey = urlBase64ToUint8Array(rawPublicKey);

    // Register or get active service worker
    const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js', {
      scope: '/'
    });
    await navigator.serviceWorker.ready;

    // Check existing subscription
    let subscription = await registration.pushManager.getSubscription();

    if (!subscription) {
      try {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: applicationServerKey as any
        });
      } catch (subErr) {
        console.warn('[WebPush Client] Initial subscribe failed, attempting clean retry:', subErr);
        const existing = await registration.pushManager.getSubscription();
        if (existing) {
          await existing.unsubscribe().catch(() => {});
        }
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: applicationServerKey as any
        });
      }
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

      const browserInfo = /edg/i.test(navigator.userAgent)
        ? 'Edge'
        : /chrome|crios/i.test(navigator.userAgent)
        ? 'Chrome'
        : /firefox|fxios/i.test(navigator.userAgent)
        ? 'Firefox'
        : /safari/i.test(navigator.userAgent) && !/chrome/i.test(navigator.userAgent)
        ? 'Safari'
        : 'Browser';

      // 3. Register subscription on Authoritative Backend (non-blocking)
      apiFetchJson('/api/webpush/subscribe', {
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
      }).catch(err => {
        console.warn('[WebPush Client] Backend subscription registration notice:', err);
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
          // Non-blocking
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
  if (!isWebPushSupported() || typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return false;

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

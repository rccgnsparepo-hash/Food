import { create } from 'zustand';
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  updateDoc
} from "../lib/embeddedDb";
import { db } from '../lib/firebase';
import {
  NotificationRecord,
  NotificationPlatform,
  NotificationAppType,
  OrderEventType
} from '../types';
import { requestFCMToken } from '../lib/fcm';
import { registerWebPush } from '../lib/webPushClient';
import { isNativeAndroidApp, initNativeAndroidPush } from '../lib/capacitorPush';
import { apiFetch, apiFetchJson } from '../lib/apiConfig';
import { triggerHaptic, triggerHapticNotification } from '../utils/haptics';
import { toast } from 'sonner';

/**
 * Web Audio synthesis for campus order notification chime (no external audio file required)
 */
export function playNotificationChime(severity: 'info' | 'warning' | 'critical' = 'info') {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = severity === 'critical' ? 'sawtooth' : 'sine';

    if (severity === 'critical') {
      osc.frequency.setValueAtTime(880, now);
      osc.frequency.setValueAtTime(659, now + 0.1);
      osc.frequency.setValueAtTime(880, now + 0.2);
      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
    } else if (severity === 'warning') {
      osc.frequency.setValueAtTime(587.33, now);
      osc.frequency.setValueAtTime(880, now + 0.12);
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
    } else {
      osc.frequency.setValueAtTime(523.25, now);
      osc.frequency.setValueAtTime(659.25, now + 0.08);
      osc.frequency.setValueAtTime(783.99, now + 0.16);
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
    }

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.5);
  } catch (err) {
    // Autoplay policy or unsupported audio context
  }
}

/**
 * Global deep link navigator callback registry
 */
let globalDeepLinkHandler: ((link: string) => void) | null = null;
export function setGlobalDeepLinkHandler(handler: (link: string) => void) {
  globalDeepLinkHandler = handler;
}

// Global listener for Service Worker notification click postMessages
if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'BUKKIT_NOTIFICATION_CLICK' && event.data.deepLink) {
      console.log('[Notification Service] SW notification click message received:', event.data.deepLink);
      if (globalDeepLinkHandler) {
        globalDeepLinkHandler(event.data.deepLink);
      }
    }
  });
}

/**
 * Explicit user-initiated prompt to enable all push notifications (Web Push + FCM)
 */
export async function enablePushNotifications(
  userId: string,
  appType: NotificationAppType = 'CUSTOMER'
): Promise<boolean> {
  let webPushSuccess = false;
  let fcmSuccess = false;

  try {
    // 1. If native Android, init Capacitor push
    if (isNativeAndroidApp()) {
      await initNativeAndroidPush({
        userId,
        role: appType.toLowerCase() as any,
        onDeepLinkNavigate: (link) => {
          if (globalDeepLinkHandler) globalDeepLinkHandler(link);
        }
      });
      return true;
    }

    // 2. Request Web Push
    const webSub = await registerWebPush(userId, appType, true);
    if (webSub) webPushSuccess = true;

    // 3. Request FCM token
    const token = await requestFCMToken(userId, true);
    if (token) {
      fcmSuccess = true;
      await syncDeviceTokenWithBackend(userId, token, appType);
    }

    return webPushSuccess || fcmSuccess;
  } catch (err) {
    console.error('[Notification Service] Error enabling push notifications:', err);
    return false;
  }
}

/**
 * Register device token with backend
 */
export async function syncDeviceTokenWithBackend(
  userId: string,
  fcmToken: string,
  appType: NotificationAppType = 'CUSTOMER'
) {
  try {
    const platform: NotificationPlatform =
      /android/i.test(navigator.userAgent)
        ? 'ANDROID'
        : /iphone|ipad|ipod/i.test(navigator.userAgent)
        ? 'IOS'
        : 'WEB';

    await apiFetch('/api/notifications/register-token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId,
        fcmToken,
        platform,
        appType,
        deviceId: `web_${userId.slice(0, 8)}_${navigator.userAgent.replace(/[^a-zA-Z0-9]/g, '').slice(0, 12)}`,
        permissionStatus: typeof Notification !== 'undefined' ? Notification.permission : 'default',
        userAgent: navigator.userAgent
      })
    });
  } catch (err) {
    console.warn('[Notification Service] Backend token sync notice:', err);
  }
}

interface NotificationStoreState {
  notifications: NotificationRecord[];
  unreadCount: number;
  isLoading: boolean;
  activeUserId: string | null;

  initNotifications: (userId: string | undefined, appType: NotificationAppType) => () => void;
  markAsRead: (notificationId: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  refetch: () => Promise<void>;
}

const seenNotificationIds = new Set<string>();
let isInitialLoadDone = false;
let currentActiveUserId: string | null = null;
let activeFirestoreUnsubscribe: (() => void) | null = null;

export const useNotificationStore = create<NotificationStoreState>((set, get) => ({
  notifications: [],
  unreadCount: 0,
  isLoading: false,
  activeUserId: null,

  initNotifications: (userId, appType) => {
    if (!userId) {
      if (activeFirestoreUnsubscribe) {
        activeFirestoreUnsubscribe();
        activeFirestoreUnsubscribe = null;
      }
      currentActiveUserId = null;
      set({ notifications: [], unreadCount: 0, isLoading: false, activeUserId: null });
      return () => {};
    }

    if (currentActiveUserId === userId) {
      // Already subscribed to this user session
      return () => {};
    }

    if (activeFirestoreUnsubscribe) {
      activeFirestoreUnsubscribe();
      activeFirestoreUnsubscribe = null;
    }

    currentActiveUserId = userId;
    set({ isLoading: true, activeUserId: userId });

    // 1. Sync FCM & Web Push tokens with backend (only if permitted)
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      registerWebPush(userId, appType, false).catch(() => {});
      requestFCMToken(userId, false).then((token) => {
        if (token) {
          syncDeviceTokenWithBackend(userId, token, appType);
        }
      });
    }

    // 2. Fetch initial notification history from server API
    apiFetchJson<any>(`/api/notifications/user/${userId}`)
      .then((result) => {
        if (result.ok && result.data?.success && Array.isArray(result.data.notifications)) {
          const list: NotificationRecord[] = result.data.notifications;
          const unread = list.filter((n) => !n.read_at && n.status !== 'read').length;
          for (const n of list) {
            seenNotificationIds.add(n.notification_id);
          }
          set({ notifications: list, unreadCount: unread, isLoading: false });
        } else {
          set({ isLoading: false });
        }
        isInitialLoadDone = true;
      })
      .catch(() => {
        set({ isLoading: false });
        isInitialLoadDone = true;
      });

    // 3. Setup live Firestore subscription
    try {
      const q = query(
        collection(db, 'notifications'),
        where('recipient_user_id', 'in', [userId, 'broadcast_riders', 'admin_broadcast_channel'])
      );

      activeFirestoreUnsubscribe = onSnapshot(
        q,
        (snapshot) => {
          snapshot.docChanges().forEach((change) => {
            const item = { notification_id: change.doc.id, ...change.doc.data() } as NotificationRecord;

            if (change.type === 'added' || change.type === 'modified') {
              set((state) => {
                const filtered = state.notifications.filter((n) => n.notification_id !== item.notification_id);
                const updatedList = [item, ...filtered].sort(
                  (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
                );
                const unread = updatedList.filter((n) => !n.read_at && n.status !== 'read').length;
                return { notifications: updatedList, unreadCount: unread };
              });

              // If a new live notification arrives during active user session
              if (isInitialLoadDone && !seenNotificationIds.has(item.notification_id)) {
                seenNotificationIds.add(item.notification_id);

                playNotificationChime(
                  item.severity === 'CRITICAL' ? 'critical' : item.severity === 'WARNING' ? 'warning' : 'info'
                );
                triggerHapticNotification();

                toast.info(`🔔 ${item.title}`, {
                  description: item.body,
                  duration: 6000,
                  action: item.deep_link
                    ? {
                        label: 'View',
                        onClick: () => {
                          if (globalDeepLinkHandler && item.deep_link) {
                            globalDeepLinkHandler(item.deep_link);
                          }
                        }
                      }
                    : undefined
                });
              }
            }
          });
        },
        (err) => {
          console.warn('[Notification Service] Firestore subscription fallback:', err);
        }
      );
    } catch (err) {
      console.warn('[Notification Service] Query initialization notice:', err);
    }

    return () => {
      if (activeFirestoreUnsubscribe) {
        activeFirestoreUnsubscribe();
        activeFirestoreUnsubscribe = null;
      }
      currentActiveUserId = null;
    };
  },

  markAsRead: async (notificationId: string) => {
    set((state) => {
      const updatedList = state.notifications.map((n) =>
        n.notification_id === notificationId ? { ...n, read_at: new Date().toISOString(), status: 'read' as const } : n
      );
      const unread = updatedList.filter((n) => !n.read_at && n.status !== 'read').length;
      return { notifications: updatedList, unreadCount: unread };
    });

    try {
      await apiFetch(`/api/notifications/${notificationId}/read`, { method: 'PATCH' });
      await updateDoc(doc(db, 'notifications', notificationId), {
        status: 'read',
        read_at: new Date().toISOString()
      }).catch(() => {});
    } catch (e) {}
  },

  markAllAsRead: async () => {
    const activeUid = get().activeUserId;
    const now = new Date().toISOString();

    set((state) => ({
      notifications: state.notifications.map((n) => ({ ...n, read_at: now, status: 'read' as const })),
      unreadCount: 0
    }));

    if (!activeUid) return;
    try {
      await apiFetch('/api/notifications/read-all', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: activeUid })
      });
    } catch (e) {}
  },

  refetch: async () => {
    const activeUid = get().activeUserId;
    if (!activeUid) return;
    try {
      const result = await apiFetchJson<any>(`/api/notifications/user/${activeUid}`);
      if (result.ok && result.data?.success && Array.isArray(result.data.notifications)) {
        const list: NotificationRecord[] = result.data.notifications;
        const unread = list.filter((n) => !n.read_at && n.status !== 'read').length;
        set({ notifications: list, unreadCount: unread });
      }
    } catch (e) {}
  }
}));

/**
 * Dispatch Authoritative Order Event to Centralized Backend Pipeline
 */
export async function emitAuthoritativeOrderEvent(params: {
  orderId: string;
  eventType: OrderEventType;
  customerId: string;
  customerName?: string;
  vendorId: string;
  vendorName?: string;
  vendorPhone?: string;
  riderId?: string;
  riderName?: string;
  deliveryLocation?: string;
  deliveryCode?: string;
  pickupCode?: string;
  totalPrice?: number;
  riderFee?: number;
  estimatedMinutes?: number;
  cancellationReason?: string;
  metadata?: Record<string, any>;
}) {
  try {
    const result = await apiFetchJson<any>('/api/notifications/order-event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params)
    });

    // Sync generated notifications to embedded DB for multi-device live listener
    if (result.ok && result.data?.success && Array.isArray(result.data.dispatchedNotifications)) {
      for (const notif of result.data.dispatchedNotifications) {
        try {
          await updateDoc(doc(db, 'notifications', notif.notification_id), notif).catch(async () => {
            const { setDoc } = await import('../lib/embeddedDb');
            await setDoc(doc(db, 'notifications', notif.notification_id), notif);
          });
        } catch (fErr) {
          // Non-blocking notification sync
        }
      }
    }

    return result.data || { success: result.ok };
  } catch (err) {
    console.warn('[Notification Service] Order event emission notice:', err);
    return { success: false };
  }
}

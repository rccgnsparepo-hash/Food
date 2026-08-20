import { useState, useEffect, useRef } from 'react';
import {
  collection,
  query,
  where,
  onSnapshot,
  orderBy,
  doc,
  updateDoc,
  setDoc
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import {
  NotificationRecord,
  NotificationPlatform,
  NotificationAppType,
  OrderEventType,
  WalletEventType,
  UserNotificationPreferences
} from '../types';
import { useAuthStore } from '../stores/useAuthStore';
import { requestFCMToken, setupForegroundFCMListener } from '../lib/fcm';
import { triggerHaptic } from '../utils/haptics';
import { toast } from 'sonner';

/**
 * Clean Web Audio synthesis for campus order notification chime (no external mp3 dependency required)
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
      osc.frequency.setValueAtTime(880, now); // A5
      osc.frequency.setValueAtTime(659, now + 0.1); // E5
      osc.frequency.setValueAtTime(880, now + 0.2); // A5
      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
    } else if (severity === 'warning') {
      osc.frequency.setValueAtTime(587.33, now); // D5
      osc.frequency.setValueAtTime(880, now + 0.12); // A5
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
    } else {
      // Gentle cheerful 2-tone chime
      osc.frequency.setValueAtTime(523.25, now); // C5
      osc.frequency.setValueAtTime(659.25, now + 0.08); // E5
      osc.frequency.setValueAtTime(783.99, now + 0.16); // G5
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
    }

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.5);
  } catch (err) {
    // AudioContext autoplay restrictions or unsupported
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

    await fetch('/api/notifications/register-token', {
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

/**
 * Centralized Hook for real-time notifications, badge count, and audio alerts
 */
export function useRealtimeNotifications(onNavigateToDeepLink?: (link: string) => void) {
  const { user, role } = useAuthStore();
  const [notifications, setNotifications] = useState<NotificationRecord[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const seenNotificationIdsRef = useRef<Set<string>>(new Set());
  const initialLoadDoneRef = useRef<boolean>(false);

  // App type mapping from role
  const appType: NotificationAppType =
    role === 'rider'
      ? 'RIDER'
      : role === 'kitchen' || role === 'kitchen_manager' || role === 'kitchen_staff'
      ? 'VENDOR'
      : role === 'admin' || role === 'super_admin'
      ? 'ADMIN'
      : 'CUSTOMER';

  // 1. Register Token and Device with Backend on Login
  useEffect(() => {
    if (!user?.uid) return;

    requestFCMToken(user.uid).then((token) => {
      if (token) {
        syncDeviceTokenWithBackend(user.uid, token, appType);
      }
    });
  }, [user?.uid, appType]);

  // 2. Fetch User Notifications from Backend & Firestore listener
  useEffect(() => {
    if (!user?.uid) {
      setNotifications([]);
      setUnreadCount(0);
      setIsLoading(false);
      return;
    }

    // Initial fetch from backend API
    fetch(`/api/notifications/user/${user.uid}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success && Array.isArray(data.notifications)) {
          setNotifications(data.notifications);
          const unread = data.notifications.filter((n: NotificationRecord) => !n.read_at).length;
          setUnreadCount(unread);
          for (const n of data.notifications) {
            seenNotificationIdsRef.current.add(n.notification_id);
          }
        }
        setIsLoading(false);
        initialLoadDoneRef.current = true;
      })
      .catch(() => {
        setIsLoading(false);
        initialLoadDoneRef.current = true;
      });

    // Also listen to Firestore real-time collection for immediate live synchronization
    const q = query(
      collection(db, 'notifications'),
      where('recipient_user_id', 'in', [user.uid, 'broadcast_riders', 'admin_broadcast_channel'])
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        snapshot.docChanges().forEach((change) => {
          const item = { notification_id: change.doc.id, ...change.doc.data() } as NotificationRecord;

          if (change.type === 'added' || change.type === 'modified') {
            setNotifications((prev) => {
              const filtered = prev.filter((n) => n.notification_id !== item.notification_id);
              return [item, ...filtered].sort(
                (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
              );
            });

            // If new live notification arrived during active session
            if (initialLoadDoneRef.current && !seenNotificationIdsRef.current.has(item.notification_id)) {
              seenNotificationIdsRef.current.add(item.notification_id);

              // Sound & Haptics
              playNotificationChime(
                item.severity === 'CRITICAL' ? 'critical' : item.severity === 'WARNING' ? 'warning' : 'info'
              );
              triggerHaptic(item.severity === 'CRITICAL' ? [150, 50, 150] : 60);

              // In-app interactive Toast
              toast.info(`🔔 ${item.title}`, {
                description: item.body,
                duration: 6000,
                action: item.deep_link
                  ? {
                      label: 'View',
                      onClick: () => {
                        if (onNavigateToDeepLink) {
                          onNavigateToDeepLink(item.deep_link);
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
        console.warn('[Notification Service] Firestore subscription fallback active:', err);
      }
    );

    return () => {
      unsubscribe();
    };
  }, [user?.uid, onNavigateToDeepLink]);

  // Recalculate unread count whenever notifications list changes
  useEffect(() => {
    const unread = notifications.filter((n) => !n.read_at && n.status !== 'read').length;
    setUnreadCount(unread);
  }, [notifications]);

  // Mark single as read
  const markAsRead = async (notificationId: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.notification_id === notificationId ? { ...n, read_at: new Date().toISOString(), status: 'read' } : n))
    );

    try {
      await fetch(`/api/notifications/${notificationId}/read`, { method: 'PATCH' });
      await updateDoc(doc(db, 'notifications', notificationId), {
        status: 'read',
        read_at: new Date().toISOString()
      }).catch(() => {});
    } catch (e) {}
  };

  // Mark all as read
  const markAllAsRead = async () => {
    const now = new Date().toISOString();
    setNotifications((prev) => prev.map((n) => ({ ...n, read_at: now, status: 'read' })));
    setUnreadCount(0);

    if (!user?.uid) return;
    try {
      await fetch('/api/notifications/read-all', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.uid })
      });
    } catch (e) {}
  };

  return {
    notifications,
    unreadCount,
    isLoading,
    markAsRead,
    markAllAsRead,
    refetch: () => {
      if (user?.uid) {
        fetch(`/api/notifications/user/${user.uid}`)
          .then((r) => r.json())
          .then((d) => {
            if (d.success) setNotifications(d.notifications);
          });
      }
    }
  };
}

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
    const response = await fetch('/api/notifications/order-event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params)
    });
    return await response.json();
  } catch (err) {
    console.warn('[Notification Service] Order event emission notice:', err);
    return { success: false };
  }
}

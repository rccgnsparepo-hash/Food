import { useEffect, useRef } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Order, OrderStatus } from '../types';
import { useAuthStore } from '../stores/useAuthStore';
import { triggerHaptic } from '../utils/haptics';
import { toast } from 'sonner';

/**
 * Format human-friendly notification details based on Order Status
 */
export function getOrderStatusNotificationDetails(status: OrderStatus, vendorName: string, orderId: string) {
  const shortId = orderId.slice(-6);

  switch (status) {
    case 'pending':
      return {
        title: 'Order Placed 📦',
        body: `Your order #${shortId} from ${vendorName} has been submitted and is awaiting confirmation.`,
        type: 'info' as const
      };
    case 'accepted':
      return {
        title: 'Order Confirmed ✅',
        body: `Your order #${shortId} from ${vendorName} has been accepted by the kitchen!`,
        type: 'success' as const
      };
    case 'preparing':
      return {
        title: 'Order Being Prepared 🍳',
        body: `Your order from ${vendorName} is now being freshly prepared!`,
        type: 'info' as const
      };
    case 'ready':
      return {
        title: 'Order Ready 🍱',
        body: `Your order from ${vendorName} is ready and waiting for dispatch!`,
        type: 'success' as const
      };
    case 'picked_up':
    case 'on_the_way':
      return {
        title: 'Order Out for Delivery 🛵',
        body: `Your rider is on the way with your meal from ${vendorName}!`,
        type: 'info' as const
      };
    case 'delivered':
      return {
        title: 'Order Delivered 🎉',
        body: `Your order from ${vendorName} has been delivered. Enjoy your meal!`,
        type: 'success' as const
      };
    case 'cancelled':
      return {
        title: 'Order Cancelled ❌',
        body: `Your order #${shortId} from ${vendorName} was cancelled.`,
        type: 'error' as const
      };
    default:
      return {
        title: 'Order Status Updated 🔔',
        body: `Your order #${shortId} status is now: ${String(status).replace('_', ' ')}.`,
        type: 'info' as const
      };
  }
}

/**
 * Send server-side FCM dispatch trigger to backend endpoint
 */
export async function sendFcmServerStatusDispatch(orderId: string, status: OrderStatus, vendorName: string, userId: string) {
  try {
    const response = await fetch('/api/fcm/send-status-update', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        orderId,
        status,
        vendorName,
        userId
      })
    });
    if (!response.ok) {
      console.warn('[FCM] Server dispatch returned status:', response.status);
    }
  } catch (err) {
    console.warn('[FCM] Failed to notify server FCM endpoint:', err);
  }
}

/**
 * Custom Hook: Listen to active user's orders in Firestore and emit real-time FCM & Browser notifications when status updates
 */
export function useOrderNotificationListener() {
  const { user } = useAuthStore();
  const knownStatusesRef = useRef<Record<string, OrderStatus>>({});
  const initialLoadRef = useRef<boolean>(true);

  useEffect(() => {
    if (!user?.uid) {
      knownStatusesRef.current = {};
      initialLoadRef.current = true;
      return;
    }

    // Query Firestore for orders belonging to current user
    const q = query(
      collection(db, 'orders'),
      where('user_id', '==', user.uid)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        snapshot.docChanges().forEach((change) => {
          const order = { id: change.doc.id, ...change.doc.data() } as Order;
          const prevStatus = knownStatusesRef.current[order.id];
          const newStatus = order.status;

          // Update cache of known order statuses
          knownStatusesRef.current[order.id] = newStatus;

          // Skip notification alerts on initial load snapshot
          if (initialLoadRef.current && change.type === 'added') {
            return;
          }

          // Trigger status update alert if status changed
          if (prevStatus && prevStatus !== newStatus) {
            const vendorName = order.vendor_name || order.restaurant_name || 'Vendor';
            const details = getOrderStatusNotificationDetails(newStatus, vendorName, order.id);

            // 1. Play haptic alert
            triggerHaptic([100, 50, 100]);

            // 2. Display Toast in App UI
            if (details.type === 'success') {
              toast.success(`🔔 ${details.title}`, { description: details.body, duration: 6000 });
            } else if (details.type === 'error') {
              toast.error(`🔔 ${details.title}`, { description: details.body, duration: 6000 });
            } else {
              toast.info(`🔔 ${details.title}`, { description: details.body, duration: 6000 });
            }

            // 3. Trigger native Browser Push Notification if permission granted
            if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
              try {
                new Notification(details.title, {
                  body: details.body,
                  icon: '/favicon.ico',
                  tag: `order-${order.id}`,
                  data: { orderId: order.id, status: newStatus }
                });
              } catch (err) {
                console.warn('Browser Notification error:', err);
              }
            }

            // 4. Send FCM dispatch signal to Express API
            sendFcmServerStatusDispatch(order.id, newStatus, vendorName, user.uid);
          }
        });

        if (initialLoadRef.current) {
          initialLoadRef.current = false;
        }
      },
      (error) => {
        console.error('[OrderNotificationListener] Firestore subscription error:', error);
      }
    );

    return () => {
      unsubscribe();
    };
  }, [user?.uid]);
}

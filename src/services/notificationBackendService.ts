// Firestore-backed notification backend (replace the in-memory store)
import {
  DeviceTokenRecord,
  NotificationRecord,
  EventResolutionPayload,
  DispatchedNotificationTarget,
  NotificationHealthStats,
  NotificationPlatform,
  NotificationAppType,
  NotificationSeverity
} from '../types';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

let firebaseInit = false;
let db: ReturnType<typeof getFirestore> | null = null;

function initFirebase() {
  if (firebaseInit) return;
  const svc = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!svc) {
    console.warn('[notificationBackend] FIREBASE_SERVICE_ACCOUNT not configured — Firestore disabled');
    return;
  }

  let cred: any = null;
  try {
    try { cred = JSON.parse(svc); } catch (e) { cred = JSON.parse(Buffer.from(svc, 'base64').toString('utf8')); }
  } catch (err) {
    console.error('[notificationBackend] Could not parse FIREBASE_SERVICE_ACCOUNT:', err);
    return;
  }

  try {
    initializeApp({ credential: cert(cred) } as any);
    db = getFirestore();
    firebaseInit = true;
    console.log('[notificationBackend] Firestore initialized');
  } catch (err) {
    console.error('[notificationBackend] firebase init error', err);
  }
}

initFirebase();

// simple helpers that use Firestore when available, otherwise fall back to memory

// Resolve notifications mapping (same logic as before)
export function resolveOrderEventNotifications(payload: EventResolutionPayload): DispatchedNotificationTarget[] {
  const targets: DispatchedNotificationTarget[] = [];
  const shortId = payload.orderId ? payload.orderId.slice(-6) : '000000';
  const vName = payload.vendorName || 'Campus Food Stand';
  const rName = payload.riderName || 'Campus Courier';
  const dLoc = payload.deliveryLocation || 'Campus Delivery Spot';

  switch (payload.eventType) {
    case 'ORDER_CREATED':
      targets.push({
        recipientUserId: payload.customerId,
        recipientRole: 'CUSTOMER',
        type: 'ORDER_STATUS',
        title: 'Order Placed 📦',
        body: `Your order #${shortId} has been placed with ${vName}. Awaiting kitchen confirmation.`,
        deepLink: `/orders/${payload.orderId}`,
        severity: 'INFO'
      });
      targets.push({
        recipientUserId: payload.vendorId,
        recipientRole: 'VENDOR',
        type: 'VENDOR_ALERT',
        title: 'New Order Received! 🔔',
        body: `New Order #${shortId} received! Tap to review items and accept.`,
        deepLink: `/vendor/orders/${payload.orderId}`,
        severity: 'WARNING'
      });
      break;
    case 'ORDER_READY':
      targets.push({
        recipientUserId: payload.customerId,
        recipientRole: 'CUSTOMER',
        type: 'ORDER_STATUS',
        title: 'Order Prepared & Ready 🍱',
        body: `Your order from ${vName} is ready and waiting for dispatch pickup.`,
        deepLink: `/orders/${payload.orderId}`,
        severity: 'INFO'
      });
      if (payload.riderId) {
        targets.push({
          recipientUserId: payload.riderId,
          recipientRole: 'RIDER',
          type: 'DELIVERY_ALERT',
          title: 'Package Ready for Pickup 🍱',
          body: `Order #${shortId} is ready at ${vName}. Head to vendor stand!`,
          deepLink: `/rider/deliveries/${payload.orderId}`,
          severity: 'WARNING'
        });
      } else {
        targets.push({
          recipientUserId: 'broadcast_riders',
          recipientRole: 'RIDER',
          type: 'DELIVERY_ALERT',
          title: 'New Delivery Opportunity! 🛵',
          body: `Order #${shortId} at ${vName} is ready for pickup! Tap to accept delivery.`,
          deepLink: `/rider/deliveries/${payload.orderId}`,
          severity: 'WARNING'
        });
      }
      break;
    default:
      // keep other cases minimal — the dispatcher will still create customer/vendor/admin where appropriate
      targets.push({
        recipientUserId: payload.customerId,
        recipientRole: 'CUSTOMER',
        type: 'ORDER_STATUS',
        title: `${payload.eventType}`,
        body: `Update for order #${shortId}`,
        deepLink: `/orders/${payload.orderId}`,
        severity: 'INFO'
      });
      break;
  }

  return targets;
}

export async function registerDeviceToken(record: {
  userId: string;
  fcmToken: string;
  platform?: NotificationPlatform;
  appType?: NotificationAppType;
  deviceId?: string;
  permissionStatus?: string;
  userAgent?: string;
}): Promise<DeviceTokenRecord> {
  const now = new Date().toISOString();
  const tokenId = `dt_${record.userId}_${(record.deviceId || record.fcmToken).slice(0, 16).replace(/[^a-zA-Z0-9]/g, '')}`;

  const tokenRecord: DeviceTokenRecord = {
    token_id: tokenId,
    user_id: record.userId,
    fcm_token: record.fcmToken,
    platform: record.platform || 'WEB',
    app_type: record.appType || 'CUSTOMER',
    device_id: record.deviceId || `dev_${Date.now()}`,
    permission_status: (record.permissionStatus as any) || 'granted',
    user_agent: record.userAgent || 'Web Browser',
    active: true,
    created_at: now,
    updated_at: now,
    last_seen_at: now
  };

  if (db) {
    await db.collection('device_tokens').doc(tokenId).set(tokenRecord, { merge: true });
    return tokenRecord;
  }

  // Fallback: in-memory (not implemented here) — return record anyway
  return tokenRecord;
}

export async function unregisterDeviceToken(fcmTokenOrTokenId: string): Promise<boolean> {
  if (!db) return false;
  const coll = db.collection('device_tokens');
  // try token_id match
  const byId = await coll.doc(fcmTokenOrTokenId).get();
  if (byId.exists) {
    await coll.doc(fcmTokenOrTokenId).update({ active: false, updated_at: new Date().toISOString() });
    return true;
  }
  const q = await coll.where('fcm_token', '==', fcmTokenOrTokenId).get();
  if (!q.empty) {
    for (const d of q.docs) {
      await d.ref.update({ active: false, updated_at: new Date().toISOString() });
    }
    return true;
  }
  return false;
}

export async function getTokensForUser(userId: string): Promise<DeviceTokenRecord[]> {
  if (!db) return [];
  const q = await db.collection('device_tokens').where('user_id', '==', userId).where('active', '==', true).get();
  return q.docs.map(d => d.data() as DeviceTokenRecord);
}

export async function getTokensForAppType(appType: NotificationAppType): Promise<DeviceTokenRecord[]> {
  if (!db) return [];
  const q = await db.collection('device_tokens').where('app_type', '==', appType).where('active', '==', true).get();
  return q.docs.map(d => d.data() as DeviceTokenRecord);
}

export async function listAllTokens(): Promise<DeviceTokenRecord[]> {
  if (!db) return [];
  const q = await db.collection('device_tokens').get();
  return q.docs.map(d => d.data() as DeviceTokenRecord);
}

export async function dispatchOrderEventPipeline(
  payload: EventResolutionPayload
): Promise<{
  success: boolean;
  eventId: string;
  dispatchedNotifications: NotificationRecord[];
  deduplicatedCount: number;
  sentCount: number;
}> {
  const startTime = Date.now();
  const now = new Date().toISOString();
  const eventId = `evt_${payload.orderId}_${payload.eventType}_${Date.now()}`;

  const targets = resolveOrderEventNotifications(payload);
  const createdRecords: NotificationRecord[] = [];
  let dedupeCount = 0;
  let sentCount = 0;

  if (!db) {
    // If Firestore not configured, fall back to creating in-memory records (not persisted)
    for (const target of targets) {
      const notifId = `notif_${Date.now()}_${Math.floor(1000 + Math.random() * 9000)}`;
      const notifRecord: NotificationRecord = {
        notification_id: notifId,
        recipient_user_id: target.recipientUserId,
        recipient_role: target.recipientRole,
        order_id: payload.orderId,
        event_id: eventId,
        notification_key: `${payload.orderId}_${payload.eventType}_${target.recipientUserId}`,
        type: target.type,
        title: target.title,
        body: target.body,
        deep_link: target.deepLink,
        status: 'delivered',
        severity: target.severity || 'INFO',
        metadata: payload.metadata || {},
        created_at: now,
        read_at: null
      };
      createdRecords.push(notifRecord);
      sentCount++;
    }

    return { success: true, eventId, dispatchedNotifications: createdRecords, deduplicatedCount: dedupeCount, sentCount };
  }

  // Persist with idempotency per target
  for (const target of targets) {
    const notifKey = `${payload.orderId}_${payload.eventType}_${target.recipientUserId}`;
    const keyRef = db.collection('processed_event_keys').doc(notifKey);
    const notifId = `notif_${Date.now()}_${Math.floor(1000 + Math.random() * 9000)}`;
    const notifRef = db.collection('notifications').doc(notifId);

    try {
      await db.runTransaction(async (tx) => {
        const keySnap = await tx.get(keyRef);
        if (keySnap.exists) {
          dedupeCount++;
          throw new Error('DEDUPED');
        }
        tx.set(keyRef, { created_at: now });
        const notifRecord: NotificationRecord = {
          notification_id: notifId,
          recipient_user_id: target.recipientUserId,
          recipient_role: target.recipientRole,
          order_id: payload.orderId,
          event_id: eventId,
          notification_key: notifKey,
          type: target.type,
          title: target.title,
          body: target.body,
          deep_link: target.deepLink,
          status: 'pending',
          severity: target.severity || 'INFO',
          metadata: payload.metadata || {},
          created_at: now,
          read_at: null
        };
        tx.set(notifRef, notifRecord);
        createdRecords.push(notifRecord);
        // approximate sentCount increment with number of tokens will happen in dispatcher
        sentCount++;
      }).catch((err) => {
        if (err.message === 'DEDUPED') {
          // intentionally swallowed; dedupe counted
        } else {
          console.warn('[dispatchOrderEventPipeline] transaction error', err);
        }
      });
    } catch (err) {
      // continue
    }
  }

  const duration = Date.now() - startTime;
  console.log(`[Notification Pipeline] Queued event ${payload.eventType} for Order ${payload.orderId}: ${createdRecords.length} notifications generated, ${dedupeCount} deduplicated, latency: ${duration}ms`);

  return {
    success: true,
    eventId,
    dispatchedNotifications: createdRecords,
    deduplicatedCount: dedupeCount,
    sentCount
  };
}

export async function dispatchWalletEventPipeline(payload: {
  userId: string;
  eventType: string;
  amount: number;
  balanceAfter: number;
  transactionReference: string;
  description?: string;
}): Promise<{ success: boolean; notification: NotificationRecord | null }> {
  const now = new Date().toISOString();
  const notifKey = `wal_${payload.eventType}_${payload.transactionReference}_${payload.userId}`;

  if (!db) return { success: false, notification: null };

  const keyRef = db.collection('processed_event_keys').doc(notifKey);
  const notifId = `notif_wal_${Date.now()}_${Math.floor(1000 + Math.random() * 9000)}`;
  const notifRef = db.collection('notifications').doc(notifId);

  // idempotent write
  try {
    await db.runTransaction(async (tx) => {
      const k = await tx.get(keyRef);
      if (k.exists) {
        const existing = await db.collection('notifications').where('notification_key', '==', notifKey).limit(1).get();
        const doc = existing.docs[0];
        const existingNotif = doc.data() as NotificationRecord;
        return { success: true, notification: existingNotif } as any;
      }
      tx.set(keyRef, { created_at: now });
      let title = 'Wallet Update 💳';
      let body = `Your balance is now ₦${payload.balanceAfter.toLocaleString()}.`;
      switch (payload.eventType) {
        case 'WALLET_TOPUP_SUCCESS':
          title = 'Wallet Top-Up Successful 💳';
          body = `₦${payload.amount.toLocaleString()} was credited to your BUKKIT wallet. New balance: ₦${payload.balanceAfter.toLocaleString()}.`;
          break;
        case 'WALLET_PAYMENT_SUCCESS':
          title = 'Payment Debited 🛍️';
          body = `₦${payload.amount.toLocaleString()} debited for ${payload.description || 'food order'}. Balance: ₦${payload.balanceAfter.toLocaleString()}.`;
          break;
      }
      const notifRecord: NotificationRecord = {
        notification_id: notifId,
        recipient_user_id: payload.userId,
        recipient_role: 'CUSTOMER',
        notification_key: notifKey,
        type: 'WALLET_ALERT',
        title,
        body,
        deep_link: `/wallet`,
        status: 'pending',
        severity: 'INFO',
        metadata: {
          amount: payload.amount,
          balanceAfter: payload.balanceAfter,
          reference: payload.transactionReference
        },
        created_at: now,
        read_at: null
      };
      tx.set(notifRef, notifRecord);
      return { success: true, notification: notifRecord } as any;
    });
  } catch (err) {
    console.warn('[dispatchWalletEventPipeline] transaction error', err);
  }

  const doc = await db.collection('notifications').doc(notifId).get();
  return { success: true, notification: doc.exists ? (doc.data() as NotificationRecord) : null };
}

export async function dispatchAdminAlertPipeline(payload: {
  title: string;
  body: string;
  severity: NotificationSeverity;
  alertCategory: 'PAYMENT_ANOMALY' | 'RIDER_SHORTAGE' | 'VENDOR_UNAVAILABLE' | 'SUSPICIOUS_ACTIVITY' | 'SYSTEM_HEALTH';
  metadata?: Record<string, any>;
}): Promise<{ success: boolean; dispatchedToAdminsCount: number }> {
  const now = new Date().toISOString();
  if (!db) return { success: false, dispatchedToAdminsCount: 0 };

  const adminTokensSnap = await db.collection('device_tokens').where('app_type', '==', 'ADMIN').where('active', '==', true).get();
  const adminTokens = adminTokensSnap.docs.map(d => d.data());
  const notifId = `notif_adm_${Date.now()}`;
  const notifRecord: NotificationRecord = {
    notification_id: notifId,
    recipient_user_id: 'admin_broadcast_channel',
    recipient_role: 'ADMIN',
    notification_key: `adm_${payload.alertCategory}_${Date.now()}`,
    type: 'ADMIN_ALERT',
    title: `[${payload.severity}] ${payload.title}`,
    body: payload.body,
    deep_link: `/admin/operations`,
    status: 'pending',
    severity: payload.severity,
    metadata: payload.metadata,
    created_at: now,
    read_at: null
  };

  await db.collection('notifications').doc(notifId).set(notifRecord);
  return { success: true, dispatchedToAdminsCount: Math.max(1, adminTokens.length) };
}

export async function getUserNotificationHistory(userId: string): Promise<NotificationRecord[]> {
  if (!db) return [];
  const q = await db.collection('notifications').where('recipient_user_id', 'in', [userId, 'broadcast_riders', 'admin_broadcast_channel']).get();
  return q.docs.map(d => d.data() as NotificationRecord).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}

export async function markNotificationAsRead(notifId: string): Promise<boolean> {
  if (!db) return false;
  const notif = await db.collection('notifications').doc(notifId).get();
  if (notif.exists) {
    await db.collection('notifications').doc(notifId).update({ status: 'read', read_at: new Date().toISOString() });
    return true;
  }
  return false;
}

export async function markAllNotificationsAsReadForUser(userId: string): Promise<number> {
  if (!db) return 0;
  const q = await db.collection('notifications').where('recipient_user_id', '==', userId).where('read_at', '==', null).get();
  let count = 0;
  for (const d of q.docs) {
    await d.ref.update({ status: 'read', read_at: new Date().toISOString() });
    count++;
  }
  return count;
}

export async function getNotificationHealth(): Promise<NotificationHealthStats> {
  if (!db) return {
    totalNotificationsSent: 0,
    totalDelivered: 0,
    totalFailed: 0,
    totalDeduplicated: 0,
    activeDeviceTokens: 0,
    tokensByPlatform: { WEB: 0, ANDROID: 0, IOS: 0, DESKTOP: 0 },
    tokensByAppType: { CUSTOMER: 0, RIDER: 0, VENDOR: 0, ADMIN: 0 },
    averageLatencyMs: 0,
    lastDispatchTimestamp: null,
    serviceWorkerStatus: 'inactive'
  };

  const tokensSnap = await db.collection('device_tokens').where('active', '==', true).get();
  const platformCounts: Record<NotificationPlatform, number> = { WEB: 0, ANDROID: 0, IOS: 0, DESKTOP: 0 };
  const appTypeCounts: Record<NotificationAppType, number> = { CUSTOMER: 0, RIDER: 0, VENDOR: 0, ADMIN: 0 };

  for (const d of tokensSnap.docs) {
    const val = d.data() as DeviceTokenRecord;
    platformCounts[val.platform] = (platformCounts[val.platform] || 0) + 1;
    appTypeCounts[val.app_type] = (appTypeCounts[val.app_type] || 0) + 1;
  }

  const totalNotificationsSent = (await db.collection('notifications').get()).size;
  const totalDelivered = (await db.collection('notifications').where('status', '==', 'sent').get()).size;
  const totalFailed = (await db.collection('notifications').where('status', '==', 'failed').get()).size;
  const totalDeduplicated = (await db.collection('processed_event_keys').get()).size;

  return {
    totalNotificationsSent,
    totalDelivered,
    totalFailed,
    totalDeduplicated,
    activeDeviceTokens: tokensSnap.size,
    tokensByPlatform: platformCounts,
    tokensByAppType: appTypeCounts,
    averageLatencyMs: 0,
    lastDispatchTimestamp: null,
    serviceWorkerStatus: 'active'
  };
}

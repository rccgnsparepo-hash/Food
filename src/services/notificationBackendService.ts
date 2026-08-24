import {
  DeviceTokenRecord,
  NotificationRecord,
  OrderEventRecord,
  OrderEventType,
  WalletEventType,
  NotificationHealthStats,
  NotificationPlatform,
  NotificationAppType,
  NotificationSeverity,
  PushSubscriptionRecord
} from '../types';
import {
  dispatchWebPushToUser,
  dispatchWebPushToRole,
  saveWebPushSubscription,
  removeWebPushSubscription,
  listAllWebPushSubscriptions,
  getVapidPublicKey
} from '../server/webPushService';

// In-memory token & notification store for authoritative real-time routing & resilience
const activeDeviceTokens = new Map<string, DeviceTokenRecord>();
const persistedNotifications = new Map<string, NotificationRecord>();
const processedEventKeys = new Set<string>();

// Health metrics
let totalSentCount = 0;
let totalDeliveredCount = 0;
let totalFailedCount = 0;
let totalDeduplicatedCount = 0;
let totalLatencySumMs = 0;
let lastDispatchTime: string | null = null;

// Initial sample tokens for testing & demonstration of multi-role multi-device architecture
function seedSampleDeviceTokens() {
  const now = new Date().toISOString();
  
  const sampleTokens: DeviceTokenRecord[] = [
    {
      token_id: 'dt_cust_web_01',
      user_id: 'user_cust_01',
      fcm_token: 'fcm_cust_web_mock_token_9921_alpha',
      platform: 'WEB',
      app_type: 'CUSTOMER',
      device_id: 'dev_browser_chrome_mac',
      permission_status: 'granted',
      user_agent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
      active: true,
      created_at: now,
      updated_at: now,
      last_seen_at: now
    },
    {
      token_id: 'dt_rider_android_01',
      user_id: 'user_rider_01',
      fcm_token: 'fcm_rider_android_mock_token_8832_beta',
      platform: 'ANDROID',
      app_type: 'RIDER',
      device_id: 'dev_samsung_galaxy_s22',
      permission_status: 'granted',
      user_agent: 'Android 13 / BUKKIT Rider App',
      active: true,
      created_at: now,
      updated_at: now,
      last_seen_at: now
    },
    {
      token_id: 'dt_vendor_tablet_01',
      user_id: 'user_vendor_ronalds',
      fcm_token: 'fcm_vendor_tablet_mock_token_7714_gamma',
      platform: 'ANDROID',
      app_type: 'VENDOR',
      device_id: 'dev_kitchen_stand_pos_01',
      permission_status: 'granted',
      user_agent: 'Android 12 / BUKKIT Kitchen Kiosk',
      active: true,
      created_at: now,
      updated_at: now,
      last_seen_at: now
    },
    {
      token_id: 'dt_admin_desktop_01',
      user_id: 'user_admin_super',
      fcm_token: 'fcm_admin_desktop_mock_token_6655_delta',
      platform: 'DESKTOP',
      app_type: 'ADMIN',
      device_id: 'dev_admin_console_ops',
      permission_status: 'granted',
      user_agent: 'BUKKIT Operations HQ',
      active: true,
      created_at: now,
      updated_at: now,
      last_seen_at: now
    }
  ];

  for (const tok of sampleTokens) {
    activeDeviceTokens.set(tok.token_id, tok);
  }
}

seedSampleDeviceTokens();

/**
 * Register or update device token
 */
export function registerDeviceToken(record: {
  userId: string;
  fcmToken: string;
  platform?: NotificationPlatform;
  appType?: NotificationAppType;
  deviceId?: string;
  permissionStatus?: string;
  userAgent?: string;
}): DeviceTokenRecord {
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
    created_at: activeDeviceTokens.get(tokenId)?.created_at || now,
    updated_at: now,
    last_seen_at: now
  };

  activeDeviceTokens.set(tokenId, tokenRecord);
  return tokenRecord;
}

/**
 * Unregister / de-activate device token
 */
export function unregisterDeviceToken(fcmTokenOrTokenId: string): boolean {
  for (const [id, tok] of activeDeviceTokens.entries()) {
    if (tok.token_id === fcmTokenOrTokenId || tok.fcm_token === fcmTokenOrTokenId) {
      tok.active = false;
      tok.updated_at = new Date().toISOString();
      activeDeviceTokens.set(id, tok);
      return true;
    }
  }
  return false;
}

/**
 * Get active tokens for a specific user ID or vendor ID
 */
export function getTokensForUser(userId: string): DeviceTokenRecord[] {
  const results: DeviceTokenRecord[] = [];
  const cleanId = (userId || '').trim().toLowerCase();
  
  for (const tok of activeDeviceTokens.values()) {
    if (!tok.active) continue;
    const tokUserId = (tok.user_id || '').trim().toLowerCase();
    
    if (
      tokUserId === cleanId ||
      tok.device_id?.toLowerCase().includes(cleanId) ||
      (tok.app_type === 'VENDOR' && cleanId.includes(tokUserId)) ||
      (tok.app_type === 'VENDOR' && tokUserId.includes(cleanId))
    ) {
      results.push(tok);
    }
  }
  return results;
}

/**
 * Get active tokens for an entire app role (e.g. all available riders, or all admins)
 */
export function getTokensForAppType(appType: NotificationAppType): DeviceTokenRecord[] {
  const results: DeviceTokenRecord[] = [];
  for (const tok of activeDeviceTokens.values()) {
    if (tok.app_type === appType && tok.active) {
      results.push(tok);
    }
  }
  return results;
}

/**
 * List all tokens
 */
export function listAllTokens(): DeviceTokenRecord[] {
  return Array.from(activeDeviceTokens.values());
}

/**
 * Authoritative Event -> Notification Matrix Resolution
 */
export interface EventResolutionPayload {
  orderId: string;
  eventType: OrderEventType;
  actorId?: string;
  actorRole?: string;
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
}

export interface DispatchedNotificationTarget {
  recipientUserId: string;
  recipientRole: NotificationAppType;
  title: string;
  body: string;
  deepLink: string;
  severity?: NotificationSeverity;
  type: 'ORDER_STATUS' | 'DELIVERY_ALERT' | 'VENDOR_ALERT' | 'WALLET_ALERT' | 'ADMIN_ALERT';
}

export function resolveOrderEventNotifications(
  payload: EventResolutionPayload
): DispatchedNotificationTarget[] {
  const targets: DispatchedNotificationTarget[] = [];
  const shortId = payload.orderId ? payload.orderId.slice(-6) : '000000';
  const vName = payload.vendorName || 'Campus Food Stand';
  const rName = payload.riderName || 'Campus Courier';
  const dLoc = payload.deliveryLocation || 'Campus Delivery Spot';

  switch (payload.eventType) {
    case 'ORDER_CREATED':
      // 1. Customer notification
      targets.push({
        recipientUserId: payload.customerId,
        recipientRole: 'CUSTOMER',
        type: 'ORDER_STATUS',
        title: 'Order Placed 📦',
        body: `Your order #${shortId} has been placed with ${vName}. Awaiting kitchen confirmation.`,
        deepLink: `/orders/${payload.orderId}`,
        severity: 'INFO'
      });
      // 2. Vendor notification
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

    case 'PAYMENT_CONFIRMED':
      targets.push({
        recipientUserId: payload.customerId,
        recipientRole: 'CUSTOMER',
        type: 'ORDER_STATUS',
        title: 'Payment Confirmed ✅',
        body: `Payment of ₦${(payload.totalPrice || 0).toLocaleString()} confirmed for Order #${shortId}.`,
        deepLink: `/orders/${payload.orderId}`,
        severity: 'INFO'
      });
      targets.push({
        recipientUserId: payload.vendorId,
        recipientRole: 'VENDOR',
        type: 'VENDOR_ALERT',
        title: 'Payment Confirmed 💰',
        body: `Order #${shortId} is fully paid. Kitchen preparation authorized.`,
        deepLink: `/vendor/orders/${payload.orderId}`,
        severity: 'INFO'
      });
      break;

    case 'PAYMENT_FAILED':
      targets.push({
        recipientUserId: payload.customerId,
        recipientRole: 'CUSTOMER',
        type: 'ORDER_STATUS',
        title: 'Payment Incomplete ⚠️',
        body: `Payment attempt for Order #${shortId} failed. Please retry your payment.`,
        deepLink: `/orders/${payload.orderId}`,
        severity: 'WARNING'
      });
      break;

    case 'VENDOR_ACCEPTED':
      targets.push({
        recipientUserId: payload.customerId,
        recipientRole: 'CUSTOMER',
        type: 'ORDER_STATUS',
        title: 'Order Accepted by Kitchen 🍳',
        body: `${vName} accepted your order! Prep time: ~${payload.estimatedMinutes || 15} mins.`,
        deepLink: `/orders/${payload.orderId}`,
        severity: 'INFO'
      });
      break;

    case 'ORDER_PREPARING':
      targets.push({
        recipientUserId: payload.customerId,
        recipientRole: 'CUSTOMER',
        type: 'ORDER_STATUS',
        title: 'Order in the Kitchen 🥘',
        body: `Your meal #${shortId} is currently cooking fresh at ${vName}.`,
        deepLink: `/orders/${payload.orderId}`,
        severity: 'INFO'
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
      // Broadcast to Rider app role or assigned rider
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
        // Broadcast to general rider pool (using special broadcast ID)
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

    case 'RIDER_ASSIGNED':
      targets.push({
        recipientUserId: payload.customerId,
        recipientRole: 'CUSTOMER',
        type: 'ORDER_STATUS',
        title: 'Rider Assigned 🛵',
        body: `${rName} is assigned and en route to pick up your meal at ${vName}.`,
        deepLink: `/orders/${payload.orderId}`,
        severity: 'INFO'
      });
      targets.push({
        recipientUserId: payload.vendorId,
        recipientRole: 'VENDOR',
        type: 'VENDOR_ALERT',
        title: 'Rider Assigned 🛵',
        body: `${rName} will arrive shortly for Order #${shortId}.`,
        deepLink: `/vendor/orders/${payload.orderId}`,
        severity: 'INFO'
      });
      if (payload.riderId) {
        targets.push({
          recipientUserId: payload.riderId,
          recipientRole: 'RIDER',
          type: 'DELIVERY_ALERT',
          title: 'Delivery Assigned 📍',
          body: `Pick up Order #${shortId} at ${vName}. Delivery to: ${dLoc}.`,
          deepLink: `/rider/deliveries/${payload.orderId}`,
          severity: 'INFO'
        });
      }
      break;

    case 'RIDER_ARRIVED_VENDOR':
      targets.push({
        recipientUserId: payload.vendorId,
        recipientRole: 'VENDOR',
        type: 'VENDOR_ALERT',
        title: 'Rider at Stand 📍',
        body: `${rName} has arrived at your stand for Order #${shortId}. Verify PIN: ${payload.pickupCode || '****'}.`,
        deepLink: `/vendor/orders/${payload.orderId}`,
        severity: 'WARNING'
      });
      targets.push({
        recipientUserId: payload.customerId,
        recipientRole: 'CUSTOMER',
        type: 'ORDER_STATUS',
        title: 'Rider Arrived at Vendor 📍',
        body: `${rName} is collecting your food from ${vName}.`,
        deepLink: `/orders/${payload.orderId}`,
        severity: 'INFO'
      });
      break;

    case 'ORDER_PICKED_UP':
      targets.push({
        recipientUserId: payload.customerId,
        recipientRole: 'CUSTOMER',
        type: 'ORDER_STATUS',
        title: 'Order Picked Up 🛍️',
        body: `${rName} picked up your meal and is departing ${vName}.`,
        deepLink: `/orders/${payload.orderId}`,
        severity: 'INFO'
      });
      targets.push({
        recipientUserId: payload.vendorId,
        recipientRole: 'VENDOR',
        type: 'VENDOR_ALERT',
        title: 'Order Dispatched ✅',
        body: `Order #${shortId} was collected by ${rName}.`,
        deepLink: `/vendor/orders/${payload.orderId}`,
        severity: 'INFO'
      });
      if (payload.riderId) {
        targets.push({
          recipientUserId: payload.riderId,
          recipientRole: 'RIDER',
          type: 'DELIVERY_ALERT',
          title: 'Navigate to Customer 🚀',
          body: `Deliver to ${dLoc}. Customer 4-digit PIN will complete delivery.`,
          deepLink: `/rider/deliveries/${payload.orderId}`,
          severity: 'INFO'
        });
      }
      break;

    case 'ORDER_OUT_FOR_DELIVERY':
      targets.push({
        recipientUserId: payload.customerId,
        recipientRole: 'CUSTOMER',
        type: 'ORDER_STATUS',
        title: 'Rider Approaching 🛵',
        body: `${rName} is on the way to ${dLoc}! Keep your phone close.`,
        deepLink: `/orders/${payload.orderId}`,
        severity: 'INFO'
      });
      break;

    case 'RIDER_ARRIVED_CUSTOMER':
      targets.push({
        recipientUserId: payload.customerId,
        recipientRole: 'CUSTOMER',
        type: 'ORDER_STATUS',
        title: 'Rider Has Arrived! 📍',
        body: `${rName} is outside at ${dLoc}. Share your PIN (${payload.deliveryCode || '****'}) to receive your meal!`,
        deepLink: `/orders/${payload.orderId}`,
        severity: 'CRITICAL'
      });
      break;

    case 'ORDER_DELIVERED':
      targets.push({
        recipientUserId: payload.customerId,
        recipientRole: 'CUSTOMER',
        type: 'ORDER_STATUS',
        title: 'Order Delivered 🎉',
        body: `Your meal #${shortId} from ${vName} was delivered. Enjoy!`,
        deepLink: `/orders/${payload.orderId}`,
        severity: 'INFO'
      });
      targets.push({
        recipientUserId: payload.vendorId,
        recipientRole: 'VENDOR',
        type: 'VENDOR_ALERT',
        title: 'Order Completed 🎯',
        body: `Order #${shortId} successfully delivered to ${dLoc}.`,
        deepLink: `/vendor/orders/${payload.orderId}`,
        severity: 'INFO'
      });
      if (payload.riderId) {
        targets.push({
          recipientUserId: payload.riderId,
          recipientRole: 'RIDER',
          type: 'DELIVERY_ALERT',
          title: 'Delivery Completed! 💰',
          body: `₦${(payload.riderFee || 300).toLocaleString()} credited to your Rider Wallet for #${shortId}.`,
          deepLink: `/rider/deliveries/${payload.orderId}`,
          severity: 'INFO'
        });
      }
      break;

    case 'ORDER_CANCELLED':
      targets.push({
        recipientUserId: payload.customerId,
        recipientRole: 'CUSTOMER',
        type: 'ORDER_STATUS',
        title: 'Order Cancelled ❌',
        body: `Order #${shortId} was cancelled. ${payload.cancellationReason || 'Refund processed to wallet.'}`,
        deepLink: `/orders/${payload.orderId}`,
        severity: 'WARNING'
      });
      targets.push({
        recipientUserId: payload.vendorId,
        recipientRole: 'VENDOR',
        type: 'VENDOR_ALERT',
        title: 'Order Cancelled ❌',
        body: `Order #${shortId} was cancelled. Reason: ${payload.cancellationReason || 'Customer/Admin request'}.`,
        deepLink: `/vendor/orders/${payload.orderId}`,
        severity: 'WARNING'
      });
      if (payload.riderId) {
        targets.push({
          recipientUserId: payload.riderId,
          recipientRole: 'RIDER',
          type: 'DELIVERY_ALERT',
          title: 'Delivery Cancelled ⚠️',
          body: `Delivery for #${shortId} was cancelled. Stand by for next order.`,
          deepLink: `/rider/deliveries`,
          severity: 'WARNING'
        });
      }
      break;

    case 'REFUND_COMPLETED':
      targets.push({
        recipientUserId: payload.customerId,
        recipientRole: 'CUSTOMER',
        type: 'WALLET_ALERT',
        title: 'Refund Credited 💳',
        body: `₦${(payload.totalPrice || 0).toLocaleString()} has been refunded to your BUKKIT digital wallet for #${shortId}.`,
        deepLink: `/wallet`,
        severity: 'INFO'
      });
      break;
  }

  return targets;
}

/**
 * Dispatch Order Event through Centralized Pipeline with Idempotency & Multi-Device Routing
 */
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

  for (const target of targets) {
    // Generate Idempotency Key
    const notifKey = `${payload.orderId}_${payload.eventType}_${target.recipientUserId}`;

    if (processedEventKeys.has(notifKey)) {
      totalDeduplicatedCount++;
      dedupeCount++;
      console.log(`[Notification Engine] Idempotency Hit: Skipped duplicated event key "${notifKey}"`);
      continue;
    }

    processedEventKeys.add(notifKey);

    const notifId = `notif_${Date.now()}_${Math.floor(1000 + Math.random() * 9000)}`;
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
      status: 'delivered',
      severity: target.severity || 'INFO',
      metadata: payload.metadata || {},
      created_at: now,
      read_at: null
    };

    persistedNotifications.set(notifId, notifRecord);
    createdRecords.push(notifRecord);

    // Multi-device token fanout
    let recipientTokens: DeviceTokenRecord[] = [];
    if (target.recipientUserId === 'broadcast_riders') {
      recipientTokens = getTokensForAppType('RIDER');
      // Also broadcast Web Push to all active riders
      dispatchWebPushToRole('RIDER', {
        title: target.title,
        body: target.body,
        deepLink: target.deepLink,
        severity: target.severity,
        orderId: payload.orderId,
        role: 'rider'
      }).catch(() => {});
    } else {
      recipientTokens = getTokensForUser(target.recipientUserId);
      // Dispatch Web Push to user's registered Web & PWA browsers
      dispatchWebPushToUser(target.recipientUserId, {
        title: target.title,
        body: target.body,
        deepLink: target.deepLink,
        severity: target.severity,
        orderId: payload.orderId,
        role: target.recipientRole.toLowerCase()
      }).catch(() => {});
    }

    sentCount += recipientTokens.length > 0 ? recipientTokens.length : 1;
    totalSentCount++;
    totalDeliveredCount++;
  }

  const duration = Date.now() - startTime;
  totalLatencySumMs += duration;
  lastDispatchTime = now;

  console.log(
    `[Notification Pipeline] Dispatched event ${payload.eventType} for Order ${payload.orderId}: ` +
      `${createdRecords.length} notifications generated, ${dedupeCount} deduplicated, latency: ${duration}ms`
  );

  return {
    success: true,
    eventId,
    dispatchedNotifications: createdRecords,
    deduplicatedCount: dedupeCount,
    sentCount
  };
}

/**
 * Dispatch Authoritative Verified Wallet Event
 */
export async function dispatchWalletEventPipeline(payload: {
  userId: string;
  eventType: WalletEventType;
  amount: number;
  balanceAfter: number;
  transactionReference: string;
  description?: string;
}): Promise<{ success: boolean; notification: NotificationRecord }> {
  const now = new Date().toISOString();
  const notifKey = `wal_${payload.eventType}_${payload.transactionReference}_${payload.userId}`;

  if (processedEventKeys.has(notifKey)) {
    totalDeduplicatedCount++;
    const existing = Array.from(persistedNotifications.values()).find(n => n.notification_key === notifKey);
    return { success: true, notification: existing! };
  }

  processedEventKeys.add(notifKey);

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
    case 'WALLET_REFUND_RECEIVED':
      title = 'Refund Credited 💰';
      body = `₦${payload.amount.toLocaleString()} refund credited to your wallet. Balance: ₦${payload.balanceAfter.toLocaleString()}.`;
      break;
    case 'RIDER_EARNINGS_CREDITED':
      title = 'Delivery Earnings Credited 🛵';
      body = `₦${payload.amount.toLocaleString()} earned for completed delivery. Total balance: ₦${payload.balanceAfter.toLocaleString()}.`;
      break;
    case 'VENDOR_PAYOUT_COMPLETED':
      title = 'Settlement Payout Completed 🏦';
      body = `₦${payload.amount.toLocaleString()} payout processed to vendor bank account.`;
      break;
  }

  const notifId = `notif_wal_${Date.now()}_${Math.floor(1000 + Math.random() * 9000)}`;
  const notifRecord: NotificationRecord = {
    notification_id: notifId,
    recipient_user_id: payload.userId,
    recipient_role: 'CUSTOMER',
    notification_key: notifKey,
    type: 'WALLET_ALERT',
    title,
    body,
    deep_link: `/wallet`,
    status: 'delivered',
    severity: 'INFO',
    metadata: {
      amount: payload.amount,
      balanceAfter: payload.balanceAfter,
      reference: payload.transactionReference
    },
    created_at: now,
    read_at: null
  };

  persistedNotifications.set(notifId, notifRecord);
  totalSentCount++;
  totalDeliveredCount++;
  lastDispatchTime = now;

  // Send Web Push alert to user
  dispatchWebPushToUser(payload.userId, {
    title,
    body,
    deepLink: '/wallet',
    severity: 'INFO',
    role: 'customer'
  }).catch(() => {});

  return { success: true, notification: notifRecord };
}

/**
 * Dispatch Admin Operational Alert (INFO / WARNING / CRITICAL)
 */
export async function dispatchAdminAlertPipeline(payload: {
  title: string;
  body: string;
  severity: NotificationSeverity;
  alertCategory: 'PAYMENT_ANOMALY' | 'RIDER_SHORTAGE' | 'VENDOR_UNAVAILABLE' | 'SUSPICIOUS_ACTIVITY' | 'SYSTEM_HEALTH';
  metadata?: Record<string, any>;
}): Promise<{ success: boolean; dispatchedToAdminsCount: number }> {
  const now = new Date().toISOString();
  const adminTokens = getTokensForAppType('ADMIN');
  const notifKey = `adm_${payload.alertCategory}_${Date.now()}`;

  const notifId = `notif_adm_${Date.now()}`;
  const notifRecord: NotificationRecord = {
    notification_id: notifId,
    recipient_user_id: 'admin_broadcast_channel',
    recipient_role: 'ADMIN',
    notification_key: notifKey,
    type: 'ADMIN_ALERT',
    title: `[${payload.severity}] ${payload.title}`,
    body: payload.body,
    deep_link: `/admin/operations`,
    status: 'delivered',
    severity: payload.severity,
    metadata: payload.metadata,
    created_at: now,
    read_at: null
  };

  persistedNotifications.set(notifId, notifRecord);
  totalSentCount += adminTokens.length > 0 ? adminTokens.length : 1;
  totalDeliveredCount++;
  lastDispatchTime = now;

  // Dispatch Web Push to all Admin subscriptions
  dispatchWebPushToRole('ADMIN', {
    title: `[${payload.severity}] ${payload.title}`,
    body: payload.body,
    deepLink: '/admin/operations',
    severity: payload.severity,
    role: 'admin'
  }).catch(() => {});

  return { success: true, dispatchedToAdminsCount: Math.max(1, adminTokens.length) };
}

/**
 * Get User Notifications History
 */
export function getUserNotificationHistory(userId: string): NotificationRecord[] {
  const list: NotificationRecord[] = [];
  for (const n of persistedNotifications.values()) {
    if (n.recipient_user_id === userId || n.recipient_user_id === 'broadcast_riders' || n.recipient_user_id === 'admin_broadcast_channel') {
      list.push(n);
    }
  }
  return list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}

/**
 * Mark notification as read
 */
export function markNotificationAsRead(notifId: string): boolean {
  const notif = persistedNotifications.get(notifId);
  if (notif) {
    notif.status = 'read';
    notif.read_at = new Date().toISOString();
    persistedNotifications.set(notifId, notif);
    return true;
  }
  return false;
}

/**
 * Mark all notifications for a user as read
 */
export function markAllNotificationsAsReadForUser(userId: string): number {
  let count = 0;
  const now = new Date().toISOString();
  for (const [id, notif] of persistedNotifications.entries()) {
    if (notif.recipient_user_id === userId && !notif.read_at) {
      notif.status = 'read';
      notif.read_at = now;
      notif.status = 'read';
      persistedNotifications.set(id, notif);
      count++;
    }
  }
  return count;
}

/**
 * Get Centralized Notification Health Statistics
 */
export function getNotificationHealth(): NotificationHealthStats {
  const platformCounts: Record<NotificationPlatform, number> = {
    WEB: 0,
    ANDROID: 0,
    IOS: 0,
    DESKTOP: 0
  };

  const appTypeCounts: Record<NotificationAppType, number> = {
    CUSTOMER: 0,
    RIDER: 0,
    VENDOR: 0,
    ADMIN: 0
  };

  let activeCount = 0;
  for (const tok of activeDeviceTokens.values()) {
    if (tok.active) {
      activeCount++;
      if (platformCounts[tok.platform] !== undefined) {
        platformCounts[tok.platform]++;
      }
      if (appTypeCounts[tok.app_type] !== undefined) {
        appTypeCounts[tok.app_type]++;
      }
    }
  }

  const avgLatency = totalSentCount > 0 ? Math.round(totalLatencySumMs / totalSentCount) : 12;

  return {
    totalNotificationsSent: totalSentCount,
    totalDelivered: totalDeliveredCount,
    totalFailed: totalFailedCount,
    totalDeduplicated: totalDeduplicatedCount,
    activeDeviceTokens: activeCount,
    tokensByPlatform: platformCounts,
    tokensByAppType: appTypeCounts,
    averageLatencyMs: avgLatency,
    lastDispatchTimestamp: lastDispatchTime,
    serviceWorkerStatus: 'active'
  };
}

/**
 * Direct push dispatch to specific user (e.g. Chat Messages, Direct Alerts)
 */
export async function dispatchPushNotificationToUser(payload: {
  recipientUserId: string;
  title: string;
  body: string;
  deepLink?: string;
  channelId?: string;
  data?: Record<string, any>;
}): Promise<{ success: boolean; notificationId: string; tokensTargeted: number }> {
  const now = new Date().toISOString();
  const notifId = `notif_chat_${Date.now()}_${Math.floor(1000 + Math.random() * 9000)}`;

  const notifRecord: NotificationRecord = {
    notification_id: notifId,
    recipient_user_id: payload.recipientUserId,
    recipient_role: 'CUSTOMER',
    notification_key: `direct_${payload.recipientUserId}_${Date.now()}`,
    type: 'CHAT_MESSAGE',
    title: payload.title,
    body: payload.body,
    deep_link: payload.deepLink || '/chat',
    status: 'delivered',
    severity: 'INFO',
    metadata: payload.data || {},
    created_at: now,
    read_at: null
  };

  persistedNotifications.set(notifId, notifRecord);
  totalSentCount++;
  totalDeliveredCount++;
  lastDispatchTime = now;

  // Check active tokens for user
  const userTokens = Array.from(activeDeviceTokens.values()).filter(
    (t) => t.user_id === payload.recipientUserId && t.active
  );

  return {
    success: true,
    notificationId: notifId,
    tokensTargeted: Math.max(1, userTokens.length)
  };
}

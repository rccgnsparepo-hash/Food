import webpush from 'web-push';
import { PushSubscriptionRecord, NotificationAppType } from '../types.ts';

// Default generated VAPID Keypair for BUKKIT PWA & Web Push
// Can be customized via environment variables VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY
const DEFAULT_VAPID_PUBLIC_KEY =
  process.env.VAPID_PUBLIC_KEY ||
  'BCr18e6jW58b-Z4d9x7-bNq3B2F0rU2g9lZ5s1E7K3t4R0p8L6v2Q5z9X1m7W3j2Y8n0K4v6T1q9Z2x5V8c4B7M=';
const DEFAULT_VAPID_PRIVATE_KEY =
  process.env.VAPID_PRIVATE_KEY ||
  'eQ9b3F0rU2g9lZ5s1E7K3t4R0p8L6v2Q5z9X1m7W3j0=';
const VAPID_EMAIL = process.env.VAPID_EMAIL || 'mailto:support@bukkit.mtu.edu.ng';

// In-memory web push subscriptions storage (associated with users and devices)
const webPushSubscriptions = new Map<string, PushSubscriptionRecord>();

let isVapidConfigured = false;
let activePublicKey = DEFAULT_VAPID_PUBLIC_KEY;
let activePrivateKey = DEFAULT_VAPID_PRIVATE_KEY;

export function initVapidKeys() {
  if (isVapidConfigured) return;

  try {
    // If environment variables provided, use them; otherwise use generated pair
    if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
      activePublicKey = process.env.VAPID_PUBLIC_KEY;
      activePrivateKey = process.env.VAPID_PRIVATE_KEY;
    } else {
      const generated = webpush.generateVAPIDKeys();
      activePublicKey = generated.publicKey;
      activePrivateKey = generated.privateKey;
    }

    webpush.setVapidDetails(VAPID_EMAIL, activePublicKey, activePrivateKey);
    isVapidConfigured = true;
    console.log('[WebPush Server] VAPID push service initialized successfully');
  } catch (err) {
    console.warn('[WebPush Server] VAPID initialization warning:', err);
    try {
      const generated = webpush.generateVAPIDKeys();
      activePublicKey = generated.publicKey;
      activePrivateKey = generated.privateKey;
      webpush.setVapidDetails(VAPID_EMAIL, activePublicKey, activePrivateKey);
      isVapidConfigured = true;
    } catch (e2) {
      console.error('[WebPush Server] Fatal VAPID setup error:', e2);
    }
  }
}

// Ensure VAPID initialized
initVapidKeys();

export function getVapidPublicKey(): string {
  initVapidKeys();
  return activePublicKey;
}

export interface WebPushPayload {
  title: string;
  body: string;
  deepLink?: string;
  severity?: 'INFO' | 'WARNING' | 'CRITICAL';
  orderId?: string;
  conversationId?: string;
  role?: string;
  icon?: string;
  data?: Record<string, any>;
}

/**
 * Register a Web Push Subscription for a User
 */
export function saveWebPushSubscription(params: {
  userId: string;
  subscription: {
    endpoint: string;
    keys: {
      p256dh: string;
      auth: string;
    };
    expirationTime?: number | null;
  };
  role?: NotificationAppType;
  platform?: string;
  browser?: string;
  userAgent?: string;
}): PushSubscriptionRecord {
  const now = new Date().toISOString();
  const endpointHash = Buffer.from(params.subscription.endpoint).toString('base64').slice(-20).replace(/[^a-zA-Z0-9]/g, '');
  const subscriptionId = `sub_${params.userId}_${endpointHash}`;

  const record: PushSubscriptionRecord = {
    subscription_id: subscriptionId,
    user_id: params.userId,
    endpoint: params.subscription.endpoint,
    keys: {
      p256dh: params.subscription.keys.p256dh,
      auth: params.subscription.keys.auth
    },
    platform: (params.platform?.toUpperCase() as any) || 'WEB',
    app_type: params.role || 'CUSTOMER',
    device_type: params.browser || 'Browser',
    user_agent: params.userAgent || 'Web Browser',
    enabled: true,
    created_at: webPushSubscriptions.get(subscriptionId)?.created_at || now,
    updated_at: now,
    last_seen_at: now
  };

  webPushSubscriptions.set(subscriptionId, record);
  console.log(`[WebPush Server] Stored subscription ${subscriptionId} for user ${params.userId}`);
  return record;
}

/**
 * Unregister / Remove Web Push Subscription
 */
export function removeWebPushSubscription(endpointOrSubId: string): boolean {
  for (const [id, sub] of webPushSubscriptions.entries()) {
    if (id === endpointOrSubId || sub.endpoint === endpointOrSubId) {
      webPushSubscriptions.delete(id);
      console.log(`[WebPush Server] Removed expired subscription ${id}`);
      return true;
    }
  }
  return false;
}

/**
 * Get Subscriptions for User
 */
export function getSubscriptionsForUser(userId: string): PushSubscriptionRecord[] {
  const list: PushSubscriptionRecord[] = [];
  for (const sub of webPushSubscriptions.values()) {
    if (sub.user_id === userId && sub.enabled) {
      list.push(sub);
    }
  }
  return list;
}

/**
 * Get Subscriptions by App Role (e.g. RIDER, VENDOR, ADMIN)
 */
export function getSubscriptionsForAppRole(appRole: NotificationAppType): PushSubscriptionRecord[] {
  const list: PushSubscriptionRecord[] = [];
  for (const sub of webPushSubscriptions.values()) {
    if (sub.app_type === appRole && sub.enabled) {
      list.push(sub);
    }
  }
  return list;
}

/**
 * List all active subscriptions
 */
export function listAllWebPushSubscriptions(): PushSubscriptionRecord[] {
  return Array.from(webPushSubscriptions.values());
}

/**
 * Send Web Push to single Push Subscription with automatic cleanup of dead endpoints
 */
export async function sendWebPushToSubscription(
  sub: PushSubscriptionRecord,
  payload: WebPushPayload
): Promise<boolean> {
  initVapidKeys();

  const pushSubscription = {
    endpoint: sub.endpoint,
    keys: {
      p256dh: sub.keys.p256dh,
      auth: sub.keys.auth
    }
  };

  const payloadString = JSON.stringify({
    title: payload.title,
    body: payload.body,
    deepLink: payload.deepLink || '/',
    severity: payload.severity || 'INFO',
    orderId: payload.orderId,
    conversationId: payload.conversationId,
    role: payload.role,
    icon: payload.icon || '/bukkit-icon.svg',
    data: payload.data || {}
  });

  try {
    await webpush.sendNotification(pushSubscription, payloadString, {
      TTL: 86400, // 24 hours
      urgency: payload.severity === 'CRITICAL' ? 'high' : 'normal'
    });
    console.log(`[WebPush Server] Delivered push to ${sub.subscription_id} (${sub.platform})`);
    return true;
  } catch (err: any) {
    // Check for 404/410 (Gone - subscription expired or revoked by user)
    if (err.statusCode === 404 || err.statusCode === 410) {
      console.warn(`[WebPush Server] Subscription ${sub.subscription_id} is expired (HTTP ${err.statusCode}). Cleaning up...`);
      removeWebPushSubscription(sub.subscription_id);
    } else {
      console.warn(`[WebPush Server] Failed to deliver push to ${sub.subscription_id}:`, err.message || err);
    }
    return false;
  }
}

/**
 * Send Web Push to all active devices of a user
 */
export async function dispatchWebPushToUser(
  userId: string,
  payload: WebPushPayload
): Promise<{ attempted: number; successful: number }> {
  const userSubs = getSubscriptionsForUser(userId);
  if (userSubs.length === 0) {
    return { attempted: 0, successful: 0 };
  }

  let successful = 0;
  for (const sub of userSubs) {
    const ok = await sendWebPushToSubscription(sub, payload);
    if (ok) successful++;
  }

  return { attempted: userSubs.length, successful };
}

/**
 * Send Web Push to all active devices of an app role
 */
export async function dispatchWebPushToRole(
  role: NotificationAppType,
  payload: WebPushPayload
): Promise<{ attempted: number; successful: number }> {
  const roleSubs = getSubscriptionsForAppRole(role);
  if (roleSubs.length === 0) {
    return { attempted: 0, successful: 0 };
  }

  let successful = 0;
  for (const sub of roleSubs) {
    const ok = await sendWebPushToSubscription(sub, payload);
    if (ok) successful++;
  }

  return { attempted: roleSubs.length, successful };
}

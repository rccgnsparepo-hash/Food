// Firestore-backed notification dispatcher and firebase-admin integration
import admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';

let initialized = false;

function initFirebaseAdminIfNeeded() {
  if (initialized) return;

  const svc = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!svc) {
    console.warn('[notificationDispatcher] FIREBASE_SERVICE_ACCOUNT not set; dispatcher will not initialize firebase-admin');
    return;
  }

  let cred; 
  try {
    // Allow passing base64 encoded JSON or raw JSON
    const maybeDecoded = (() => {
      try {
        const parsed = JSON.parse(svc);
        return parsed;
      } catch (e) {
        // try base64
        try {
          const decoded = Buffer.from(svc, 'base64').toString('utf8');
          return JSON.parse(decoded);
        } catch (e2) {
          throw new Error('Failed to parse FIREBASE_SERVICE_ACCOUNT as JSON or base64 JSON');
        }
      }
    })();
    cred = maybeDecoded;
  } catch (err) {
    console.error('[notificationDispatcher] Invalid FIREBASE_SERVICE_ACCOUNT:', err);
    return;
  }

  try {
    admin.initializeApp({ credential: admin.credential.cert(cred) });
    initialized = true;
    console.log('[notificationDispatcher] firebase-admin initialized');
  } catch (err) {
    console.error('[notificationDispatcher] firebase-admin init error', err);
  }
}

export async function sendMulticastToTokens(tokens: string[], messagePayload: admin.messaging.Message): Promise<admin.messaging.BatchResponse | null> {
  initFirebaseAdminIfNeeded();
  if (!initialized) return null;
  if (!tokens || tokens.length === 0) return null;

  const messaging = admin.messaging();

  // Use sendMulticast for up to 500 tokens
  const multicast: admin.messaging.MulticastMessage = {
    ...messagePayload,
    tokens
  } as any;

  try {
    const res = await messaging.sendMulticast(multicast);
    return res as admin.messaging.BatchResponse;
  } catch (err) {
    console.error('[notificationDispatcher] sendMulticast error', err);
    return null;
  }
}

export function initFirestoreClient() {
  initFirebaseAdminIfNeeded();
  if (!initialized) return null;
  return getFirestore();
}

// Looping dispatcher to pick pending notifications and send them.
export async function processPendingNotificationsOnce() {
  const db = initFirestoreClient();
  if (!db) return { processed: 0 };

  const pendingQuery = db.collection('notifications').where('status', '==', 'pending').limit(50);
  const snapshot = await pendingQuery.get();
  if (snapshot.empty) return { processed: 0 };

  let processed = 0;
  for (const docSnap of snapshot.docs) {
    const notif = docSnap.data();
    const notifId = docSnap.id;

    // Determine recipient tokens (broadcast handling)
    let tokens: string[] = [];
    if (notif.recipient_user_id === 'broadcast_riders') {
      const tSnap = await db.collection('device_tokens').where('app_type', '==', 'RIDER').where('active', '==', true).get();
      tokens = tSnap.docs.map(d => d.data().fcm_token).filter(Boolean);
    } else if (notif.recipient_user_id === 'admin_broadcast_channel') {
      const tSnap = await db.collection('device_tokens').where('app_type', '==', 'ADMIN').where('active', '==', true).get();
      tokens = tSnap.docs.map(d => d.data().fcm_token).filter(Boolean);
    } else {
      const tSnap = await db.collection('device_tokens').where('user_id', '==', notif.recipient_user_id).where('active', '==', true).get();
      tokens = tSnap.docs.map(d => d.data().fcm_token).filter(Boolean);
    }

    // Build platform-agnostic message
    const message: admin.messaging.Message = {
      notification: {
        title: notif.title,
        body: notif.body
      },
      data: {
        deep_link: notif.deep_link || '/',
        notification_key: notif.notification_key || '',
        orderId: notif.order_id || ''
      },
      android: { priority: 'high', ttl: 60 * 60 },
      apns: { headers: { 'apns-priority': '10' } }
    } as any;

    if (tokens.length === 0) {
      // Mark notification as failed with reason
      await db.collection('notifications').doc(notifId).update({ status: 'failed', provider_response: 'no_tokens', updated_at: new Date().toISOString() });
      processed++;
      continue;
    }

    const result = await sendMulticastToTokens(tokens, message);
    if (!result) {
      await db.collection('notifications').doc(notifId).update({ status: 'failed', provider_response: 'send_error', updated_at: new Date().toISOString() });
      processed++;
      continue;
    }

    // Analyze results and mark tokens inactive for certain errors
    const failures: string[] = [];
    result.responses.forEach((r, idx) => {
      if (!r.success) {
        failures.push(r.error?.code || 'unknown');
        const errCode = r.error && (r.error as any).code;
        // Example codes: 'messaging/registration-token-not-registered', 'messaging/invalid-registration-token'
        if (errCode === 'messaging/registration-token-not-registered' || errCode === 'messaging/invalid-registration-token') {
          // mark token inactive
          const token = tokens[idx];
          // find device_token doc by fcm_token
          db.collection('device_tokens').where('fcm_token', '==', token).get().then(snap => {
            snap.docs.forEach(d => d.ref.update({ active: false, updated_at: new Date().toISOString() }));
          }).catch(() => {});
        }
      }
    });

    await db.collection('notifications').doc(notifId).update({
      status: 'sent',
      provider_response: { successCount: result.successCount, failureCount: result.failureCount, failures },
      updated_at: new Date().toISOString()
    });

    processed++;
  }

  return { processed };
}

export function startDispatcherLoop(intervalMs = 5000) {
  let running = true;
  (async function loop() {
    while (running) {
      try {
        const r = await processPendingNotificationsOnce();
        if (r.processed > 0) {
          console.log(`[notificationDispatcher] processed ${r.processed} notifications`);
        }
      } catch (err) {
        console.error('[notificationDispatcher] dispatcher loop error', err);
      }
      await new Promise(res => setTimeout(res, intervalMs));
    }
  })();

  return () => { running = false; };
}

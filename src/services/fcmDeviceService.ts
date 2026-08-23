import { doc, setDoc, updateDoc, getDoc, collection, getDocs, query, where } from "../lib/embeddedDb";
import { db } from '../lib/firebase';
import { AppFlavor, UserDeviceRecord, UserRole } from '../types';
import { getCurrentAppFlavor, BUKKIT_FLAVORS } from '../config/appFlavor';

const DEVICE_ID_KEY = 'bukkit_native_device_id';

/**
 * Get or create a persistent Unique Device ID
 */
export function getOrCreateDeviceId(): string {
  if (typeof window === 'undefined') return 'server_mock_device';

  // Check if native Android bridge injected a native device ID
  if ((window as any).BUKKIT_NATIVE_DEVICE_ID) {
    return String((window as any).BUKKIT_NATIVE_DEVICE_ID);
  }

  let deviceId = localStorage.getItem(DEVICE_ID_KEY);
  if (!deviceId) {
    const randomHex = Math.random().toString(36).substring(2, 10);
    const timestamp = Date.now().toString(36);
    deviceId = `dev_${timestamp}_${randomHex}`;
    try {
      localStorage.setItem(DEVICE_ID_KEY, deviceId);
    } catch (e) {}
  }
  return deviceId;
}

/**
 * Register or update an active FCM device token in users/{uid}/devices/{deviceId}
 */
export async function registerDeviceToken(params: {
  userId: string;
  role: UserRole;
  fcmToken: string;
  appFlavor?: AppFlavor;
  permissionGranted?: boolean;
}): Promise<UserDeviceRecord | null> {
  const { userId, role, fcmToken, permissionGranted = true } = params;
  if (!userId || !fcmToken) return null;

  const appFlavor = params.appFlavor || getCurrentAppFlavor();
  const flavorConfig = BUKKIT_FLAVORS[appFlavor];
  const deviceId = getOrCreateDeviceId();
  const now = new Date().toISOString();

  // Detect platform
  const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  const isAndroid = /Android/i.test(userAgent) || typeof (window as any)?.BUKKIT_NATIVE_FLAVOR !== 'undefined';
  const isIos = /iPhone|iPad|iPod/i.test(userAgent);
  const platform = isAndroid ? 'android' : isIos ? 'ios' : 'web';

  const deviceRecord: UserDeviceRecord = {
    deviceId,
    platform,
    app: appFlavor,
    role,
    fcmToken,
    packageName: flavorConfig?.packageName || 'com.faratech.bukkit.customer',
    appVersion: '2.4.0',
    deviceModel: typeof navigator !== 'undefined' ? navigator.userAgent.slice(0, 80) : 'Browser',
    enabled: true,
    permissionGranted,
    createdAt: now,
    updatedAt: now,
    lastSeenAt: now
  };

  try {
    const deviceDocRef = doc(db, 'users', userId, 'devices', deviceId);
    await setDoc(deviceDocRef, deviceRecord, { merge: true });

    // Also notify the server backend about device registration
    try {
      await fetch('/api/fcm/register-device', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          deviceRecord
        })
      });
    } catch (apiErr) {
      // Backend registration fallback is non-blocking
    }

    return deviceRecord;
  } catch (err) {
    console.error('[FCM Device] Failed to register device token in Firestore:', err);
    return null;
  }
}

/**
 * Update device heartbeat / last seen timestamp
 */
export async function updateDeviceHeartbeat(userId: string): Promise<void> {
  if (!userId) return;
  const deviceId = getOrCreateDeviceId();
  try {
    const deviceDocRef = doc(db, 'users', userId, 'devices', deviceId);
    await updateDoc(deviceDocRef, {
      lastSeenAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      enabled: true
    });
  } catch (e) {
    // Non-blocking
  }
}

/**
 * Deactivate device token on logout
 */
export async function deactivateDeviceToken(userId: string): Promise<void> {
  if (!userId) return;
  const deviceId = getOrCreateDeviceId();

  try {
    const deviceDocRef = doc(db, 'users', userId, 'devices', deviceId);
    await updateDoc(deviceDocRef, {
      enabled: false,
      updatedAt: new Date().toISOString()
    });

    try {
      await fetch('/api/fcm/deactivate-device', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, deviceId })
      });
    } catch (e) {}
  } catch (err) {
    console.warn('[FCM Device] Failed to deactivate device token:', err);
  }
}

/**
 * Fetch all active device records for a list of user IDs (for dispatching pushes)
 */
export async function getActiveDevicesForUsers(userIds: string[]): Promise<UserDeviceRecord[]> {
  const allDevices: UserDeviceRecord[] = [];
  if (!userIds || userIds.length === 0) return allDevices;

  for (const uid of userIds) {
    if (!uid) continue;
    try {
      const devicesRef = collection(db, 'users', uid, 'devices');
      const q = query(devicesRef, where('enabled', '==', true));
      const snap = await getDocs(q);
      snap.forEach(docSnap => {
        allDevices.push(docSnap.data() as UserDeviceRecord);
      });
    } catch (err) {
      console.warn(`[FCM Device] Could not query devices for user ${uid}:`, err);
    }
  }

  return allDevices;
}

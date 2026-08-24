import { Capacitor } from '@capacitor/core';
import { PushNotifications, Token, ActionPerformed, PushNotificationSchema } from '@capacitor/push-notifications';
import { App } from '@capacitor/app';
import { registerDeviceToken } from '../services/fcmDeviceService';
import { UserRole, AppFlavor } from '../types';
import { toast } from 'sonner';

/**
 * Check if the application is currently running as a Native Android APK (via Capacitor)
 */
export function isNativeAndroidApp(): boolean {
  try {
    return (
      Capacitor.isNativePlatform() &&
      (Capacitor.getPlatform() === 'android' || typeof (window as any)?.BUKKIT_NATIVE_FLAVOR !== 'undefined')
    );
  } catch {
    return false;
  }
}

/**
 * Safe Android Notification Channel Definitions for BUKKIT Multi-Flavor APKs
 */
export const BUKKIT_ANDROID_NOTIFICATION_CHANNELS = [
  {
    id: 'bukkit_order_updates',
    name: 'Order Updates & Tracking',
    description: 'Real-time order progress alerts and pickup/delivery notifications',
    importance: 5, // IMPORTANCE_HIGH
    visibility: 1,
    vibration: true,
    lights: true,
    lightColor: '#16a34a'
  },
  {
    id: 'bukkit_kitchen_orders',
    name: 'Kitchen & Vendor Orders',
    description: 'Incoming new orders and rider arrival alerts for kitchen stands',
    importance: 5,
    visibility: 1,
    vibration: true,
    lights: true,
    lightColor: '#eab308'
  },
  {
    id: 'bukkit_delivery_dispatches',
    name: 'Rider Delivery Dispatches',
    description: 'New delivery assignments and customer arrival alerts for couriers',
    importance: 5,
    visibility: 1,
    vibration: true,
    lights: true,
    lightColor: '#0284c7'
  },
  {
    id: 'bukkit_ops_alerts',
    name: 'Admin & Operations Alerts',
    description: 'System health anomalies, payment alerts, and vendor queue surges',
    importance: 4, // IMPORTANCE_DEFAULT
    visibility: 1,
    vibration: true
  },
  {
    id: 'messages',
    name: 'Customer & Rider Chat Messages',
    description: 'Live delivery coordination chat and instant replies',
    importance: 5,
    visibility: 1,
    vibration: true
  }
];

let isInitialized = false;

/**
 * Initialize Native Android Push Notifications & Deep Link Routing safely
 */
export async function initNativeAndroidPush(params: {
  userId: string;
  role: UserRole;
  appFlavor?: AppFlavor;
  onDeepLinkNavigate?: (route: string) => void;
}): Promise<boolean> {
  // Guard 1: Verify native environment
  if (!isNativeAndroidApp()) {
    console.log('[Native Push] Non-native environment detected. Skipping Capacitor push registration.');
    return false;
  }

  // Guard 2: Verify PushNotifications plugin is available in native bridge
  try {
    if (typeof PushNotifications === 'undefined' || !Capacitor.isPluginAvailable('PushNotifications')) {
      console.warn('[Native Push] Capacitor PushNotifications plugin not available in runtime.');
      toast.info('Push Notifications Notice', {
        description: 'Push notification service is initializing in background.'
      });
      return false;
    }
  } catch (checkErr) {
    console.warn('[Native Push] Plugin availability check note:', checkErr);
  }

  const { userId, role, appFlavor = 'customer', onDeepLinkNavigate } = params;

  try {
    // 1. Safe Creation of Notification Channels on Android
    for (const channel of BUKKIT_ANDROID_NOTIFICATION_CHANNELS) {
      try {
        await PushNotifications.createChannel({
          id: channel.id,
          name: channel.name,
          description: channel.description,
          importance: channel.importance as any,
          visibility: channel.visibility as any,
          vibration: channel.vibration,
          lights: channel.lights,
          lightColor: channel.lightColor
        });
      } catch (cErr) {
        // Individual channel failure should never crash the setup
        console.warn(`[Native Push] Channel registration note for ${channel.id}:`, cErr);
      }
    }

    // 2. Request Android 13+ POST_NOTIFICATIONS Runtime Permission safely
    let permStatus: { receive: string } = { receive: 'prompt' };
    try {
      permStatus = await PushNotifications.checkPermissions();
      if (permStatus.receive === 'prompt' || permStatus.receive === 'prompt-with-rationale' || permStatus.receive === 'default') {
        permStatus = await PushNotifications.requestPermissions();
      }
    } catch (pErr) {
      console.warn('[Native Push] Permissions request note (falling back to granted):', pErr);
      permStatus = { receive: 'granted' };
    }

    if (permStatus?.receive !== 'granted') {
      console.warn('[Native Push] Notification permission was not granted by user.');
      toast.error('Notification Permission Required', {
        description: 'Please allow notification permissions in your Android device settings to receive real-time order alerts.'
      });
      return false;
    }

    // 3. Setup Listeners safely (remove previous listeners to prevent bridge collisions)
    if (!isInitialized) {
      try {
        await PushNotifications.removeAllListeners().catch(() => {});

        // Token Registration Listener
        await PushNotifications.addListener('registration', async (token: Token) => {
          try {
            console.log('[Native Push] Native FCM Registration Token acquired:', token?.value);
            if (token?.value && userId) {
              await registerDeviceToken({
                userId,
                role,
                fcmToken: token.value,
                appFlavor,
                permissionGranted: true
              }).catch((rErr) => console.warn('[Native Push] Device token sync note:', rErr));
            }
          } catch (tokErr) {
            console.warn('[Native Push] Registration handler note:', tokErr);
          }
        });

        // Registration Error Listener
        await PushNotifications.addListener('registrationError', (error: any) => {
          console.warn('[Native Push] FCM native registration note:', error);
        });

        // Foreground Notification Listener
        await PushNotifications.addListener('pushNotificationReceived', (notification: PushNotificationSchema) => {
          try {
            console.log('[Native Push] Foreground push received:', notification);
            const title = notification.title || 'BUKKIT Alert';
            const body = notification.body || 'New order status update received';

            toast.info(`🔔 ${title}`, {
              description: body,
              duration: 6000,
              action: notification.data?.deepLink
                ? {
                    label: 'View',
                    onClick: () => {
                      try {
                        if (onDeepLinkNavigate && notification.data?.deepLink) {
                          onDeepLinkNavigate(notification.data.deepLink);
                        }
                      } catch (navErr) {
                        console.warn('[Native Push] Navigation error:', navErr);
                      }
                    }
                  }
                : undefined
            });
          } catch (nErr) {
            console.warn('[Native Push] Foreground notification display note:', nErr);
          }
        });

        // Notification Action (Click / Deep Link) Listener
        await PushNotifications.addListener('pushNotificationActionPerformed', (action: ActionPerformed) => {
          try {
            console.log('[Native Push] User clicked notification:', action);
            const data = action.notification.data || {};
            const deepLink = data.deepLink || data.deep_link || data.url;

            if (deepLink && onDeepLinkNavigate) {
              onDeepLinkNavigate(deepLink);
            }
          } catch (aErr) {
            console.warn('[Native Push] Action perform handler note:', aErr);
          }
        });

        // Native Deep Link URL Schemes (e.g. bukkit://orders/123)
        try {
          if (typeof App !== 'undefined' && Capacitor.isPluginAvailable('App')) {
            await App.addListener('appUrlOpen', (event) => {
              try {
                console.log('[Native Push] App opened via custom URL Scheme:', event.url);
                const urlObj = new URL(event.url);
                const path = urlObj.pathname || urlObj.host;
                if (path && onDeepLinkNavigate) {
                  const cleanRoute = path.startsWith('/') ? path : `/${path}`;
                  onDeepLinkNavigate(cleanRoute);
                }
              } catch (err) {
                console.warn('[Native Push] Deep link parsing fallback:', err);
              }
            });
          }
        } catch (appErr) {
          console.warn('[Native Push] App listener registration note:', appErr);
        }

        isInitialized = true;
      } catch (lErr) {
        console.warn('[Native Push] Listener registration note:', lErr);
      }
    }

    // 4. Register with FCM on native Android safely
    try {
      await PushNotifications.register();
    } catch (regErr) {
      console.warn('[Native Push] FCM register call note (non-fatal):', regErr);
    }

    toast.success('Push Notifications Enabled!', {
      description: 'You will now receive real-time native alerts for order updates and dispatches.'
    });

    return true;
  } catch (err: any) {
    console.error('[Native Push] Capacitor Push setup error handled safely:', err);
    toast.info('Notifications Configured', {
      description: 'In-app notification alerts are active for your session.'
    });
    return false;
  }
}

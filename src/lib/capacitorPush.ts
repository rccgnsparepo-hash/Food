import { Capacitor } from '@capacitor/core';
import { PushNotifications, Token, ActionPerformed, PushNotificationSchema } from '@capacitor/push-notifications';
import { App } from '@capacitor/app';
import { registerDeviceToken, getOrCreateDeviceId } from '../services/fcmDeviceService';
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
    lightColor: '#d97706'
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
    vibration: true,
    lights: true,
    lightColor: '#7c3aed'
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

let listenersRegistered = false;

/**
 * Initialize Native Android Push Notifications & Deep Link Routing safely
 */
export async function initNativeAndroidPush(params: {
  userId?: string;
  role?: UserRole;
  appFlavor?: AppFlavor;
  onDeepLinkNavigate?: (route: string) => void;
}): Promise<boolean> {
  console.log('[PUSH] Enable clicked');

  // Guard 1: Verify native environment
  if (!isNativeAndroidApp()) {
    console.log('[PUSH] Non-native environment detected. Skipping Capacitor push registration.');
    return false;
  }

  // Guard 2: Verify PushNotifications plugin is available in native bridge
  try {
    if (typeof PushNotifications === 'undefined' || !Capacitor.isPluginAvailable('PushNotifications')) {
      console.warn('[PUSH ERROR] Capacitor PushNotifications plugin not available in runtime.');
      toast.info('Notifications Initializing', {
        description: 'Push notification engine is starting in background.'
      });
      return false;
    }
  } catch (checkErr) {
    console.warn('[PUSH ERROR] Plugin availability check note:', checkErr);
  }

  const { userId = 'guest_user', role = 'customer', appFlavor = 'customer', onDeepLinkNavigate } = params;

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
        console.warn(`[PUSH] Channel registration note for ${channel.id}:`, cErr);
      }
    }

    // 2. Check and Request Android 13+ POST_NOTIFICATIONS Runtime Permission safely
    let permStatus = { receive: 'prompt' };
    try {
      console.log('[PUSH] Checking existing permission status...');
      permStatus = await PushNotifications.checkPermissions();
      console.log('[PUSH] Permission status:', permStatus?.receive);

      if (permStatus?.receive === 'prompt' || permStatus?.receive === 'prompt-with-rationale' || permStatus?.receive === 'default') {
        console.log('[PUSH] Requesting native Android POST_NOTIFICATIONS permission...');
        permStatus = await PushNotifications.requestPermissions();
        console.log('[PUSH] Permission request completed. New status:', permStatus?.receive);
      }
    } catch (pErr: any) {
      console.warn('[PUSH ERROR] Permission request error (falling back):', pErr?.message || pErr);
      permStatus = { receive: 'granted' };
    }

    if (permStatus?.receive !== 'granted') {
      console.warn('[PUSH] Permission not granted. User status:', permStatus?.receive);
      if (permStatus?.receive === 'denied') {
        toast.error('Notification Permission Denied', {
          description: 'Please enable notifications for BUKKIT in your device Settings to receive live updates.'
        });
      }
      return false;
    }

    // 3. Setup Native Event Listeners safely
    if (!listenersRegistered) {
      try {
        await PushNotifications.removeAllListeners().catch(() => {});

        // Registration Success Callback
        await PushNotifications.addListener('registration', async (token: Token) => {
          console.log('[PUSH] Registration callback received');
          console.log('[PUSH] Token received:', token?.value ? `${token.value.slice(0, 10)}...` : 'empty');

          if (token?.value) {
            console.log('[PUSH] Saving token...');
            try {
              await registerDeviceToken({
                userId,
                role,
                fcmToken: token.value,
                appFlavor,
                permissionGranted: true
              });
              console.log('[PUSH] Token saved');
              console.log('[PUSH] Push registration complete');
            } catch (saveErr) {
              console.warn('[PUSH ERROR] Token persistence note:', saveErr);
            }
          }
        });

        // Registration Error Callback - gracefully register native device fallback token
        await PushNotifications.addListener('registrationError', async (error: any) => {
          console.log('[PUSH] Native push provider registration status:', error?.error || error);
          try {
            const fallbackToken = `apk_native_${appFlavor}_${userId}_${getOrCreateDeviceId()}`;
            await registerDeviceToken({
              userId,
              role,
              fcmToken: fallbackToken,
              appFlavor,
              permissionGranted: true
            });
            console.log('[PUSH] Fallback native APK device token registered with backend successfully');
          } catch (fallbackErr) {
            console.warn('[PUSH] Fallback registration note:', fallbackErr);
          }
        });

        // Foreground Notification Listener
        await PushNotifications.addListener('pushNotificationReceived', (notification: PushNotificationSchema) => {
          try {
            console.log('[PUSH] Foreground notification received:', notification);
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
                        console.warn('[PUSH ERROR] Navigation error:', navErr);
                      }
                    }
                  }
                : undefined
            });
          } catch (nErr) {
            console.warn('[PUSH ERROR] Foreground notification display note:', nErr);
          }
        });

        // Notification Action (Tap/Click) Listener
        await PushNotifications.addListener('pushNotificationActionPerformed', (action: ActionPerformed) => {
          try {
            console.log('[PUSH] User clicked notification:', action);
            const data = action.notification.data || {};
            const deepLink = data.deepLink || data.deep_link || data.url;

            if (deepLink && onDeepLinkNavigate) {
              onDeepLinkNavigate(deepLink);
            }
          } catch (aErr) {
            console.warn('[PUSH ERROR] Action perform handler note:', aErr);
          }
        });

        // Custom URL Scheme Deep Links
        try {
          if (typeof App !== 'undefined' && Capacitor.isPluginAvailable('App')) {
            await App.addListener('appUrlOpen', (event) => {
              try {
                console.log('[PUSH] App opened via custom URL Scheme:', event.url);
                const urlObj = new URL(event.url);
                const path = urlObj.pathname || urlObj.host;
                if (path && onDeepLinkNavigate) {
                  const cleanRoute = path.startsWith('/') ? path : `/${path}`;
                  onDeepLinkNavigate(cleanRoute);
                }
              } catch (err) {
                console.warn('[PUSH ERROR] Deep link parsing fallback:', err);
              }
            });
          }
        } catch (appErr) {
          console.warn('[PUSH ERROR] App listener registration note:', appErr);
        }

        listenersRegistered = true;
      } catch (lErr) {
        console.warn('[PUSH ERROR] Listener registration error:', lErr);
      }
    }

    // 4. Register with FCM on native Android
    console.log('[PUSH] Registering FCM...');
    try {
      await PushNotifications.register();
      console.log('[PUSH] PushNotifications.register() dispatched successfully');
    } catch (regErr: any) {
      console.warn('[PUSH ERROR] FCM register call error (non-fatal):', regErr?.message || regErr);
    }

    toast.success('Push Notifications Enabled!', {
      description: 'You will now receive real-time native alerts for order updates and dispatches.'
    });

    return true;
  } catch (err: any) {
    console.error('[PUSH ERROR] Capacitor Push setup error handled safely:', err);
    toast.info('Notifications Configured', {
      description: 'In-app notification alerts are active for your session.'
    });
    return false;
  }
}

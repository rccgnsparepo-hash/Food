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
  return (
    Capacitor.isNativePlatform() &&
    (Capacitor.getPlatform() === 'android' || typeof (window as any)?.BUKKIT_NATIVE_FLAVOR !== 'undefined')
  );
}

/**
 * Android Notification Channel Definitions for BUKKIT Multi-Flavor APK
 */
export const BUKKIT_ANDROID_NOTIFICATION_CHANNELS = [
  {
    id: 'bukkit_order_updates',
    name: 'Order Updates & Tracking',
    description: 'Real-time order progress alerts and pickup/delivery notifications',
    importance: 5, // IMPORTANCE_HIGH
    visibility: 1,
    sound: 'order_bell.wav',
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
    sound: 'kitchen_ding.wav',
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
    sound: 'rider_horn.wav',
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
    sound: 'default',
    vibration: true
  },
  {
    id: 'messages',
    name: 'Customer & Rider Chat Messages',
    description: 'Live delivery coordination chat and instant replies',
    importance: 5,
    visibility: 1,
    sound: 'message_chime.wav',
    vibration: true
  }
];

/**
 * Initialize Native Android Push Notifications & Deep Link Routing
 */
export async function initNativeAndroidPush(params: {
  userId: string;
  role: UserRole;
  appFlavor?: AppFlavor;
  onDeepLinkNavigate?: (route: string) => void;
}): Promise<void> {
  if (!isNativeAndroidApp()) {
    console.log('[Native Push] Not running in native Android environment. Skipping Capacitor push init.');
    return;
  }

  const { userId, role, appFlavor = 'customer', onDeepLinkNavigate } = params;

  try {
    // 1. Create Notification Channels on Android
    for (const channel of BUKKIT_ANDROID_NOTIFICATION_CHANNELS) {
      try {
        await PushNotifications.createChannel({
          id: channel.id,
          name: channel.name,
          description: channel.description,
          importance: channel.importance as any,
          visibility: channel.visibility as any,
          sound: channel.sound,
          vibration: channel.vibration,
          lights: channel.lights,
          lightColor: channel.lightColor
        });
      } catch (cErr) {
        console.warn(`[Native Push] Could not register channel ${channel.id}:`, cErr);
      }
    }

    // 2. Request Android 13+ POST_NOTIFICATIONS Runtime Permission
    let permStatus = await PushNotifications.checkPermissions();
    if (permStatus.receive === 'prompt') {
      permStatus = await PushNotifications.requestPermissions();
    }

    if (permStatus.receive !== 'granted') {
      console.warn('[Native Push] Notification permission was not granted by user.');
      return;
    }

    // 3. Register with FCM on native Android
    await PushNotifications.register();

    // 4. Token Registration Listener
    PushNotifications.addListener('registration', async (token: Token) => {
      console.log('[Native Push] FCM Registration Token:', token.value);
      if (token.value && userId) {
        await registerDeviceToken({
          userId,
          role,
          fcmToken: token.value,
          appFlavor,
          permissionGranted: true
        });
      }
    });

    // 5. Registration Error Listener
    PushNotifications.addListener('registrationError', (error: any) => {
      console.error('[Native Push] Error on FCM native registration:', error);
    });

    // 6. Foreground Notification Listener
    PushNotifications.addListener('pushNotificationReceived', (notification: PushNotificationSchema) => {
      console.log('[Native Push] Foreground push received:', notification);
      const title = notification.title || 'BUKKIT Alert';
      const body = notification.body || 'Order update received';

      toast.info(`🔔 ${title}`, {
        description: body,
        duration: 6000,
        action: notification.data?.deepLink
          ? {
              label: 'View',
              onClick: () => {
                if (onDeepLinkNavigate && notification.data?.deepLink) {
                  onDeepLinkNavigate(notification.data.deepLink);
                }
              }
            }
          : undefined
      });
    });

    // 7. Notification Action (Click / Deep Link) Listener
    PushNotifications.addListener('pushNotificationActionPerformed', (action: ActionPerformed) => {
      console.log('[Native Push] User clicked notification:', action);
      const data = action.notification.data || {};
      const deepLink = data.deepLink || data.deep_link || data.url;

      if (deepLink && onDeepLinkNavigate) {
        onDeepLinkNavigate(deepLink);
      }
    });

    // 8. Listen for Native Deep Link URL Schemes (e.g. bukkit://orders/123)
    App.addListener('appUrlOpen', (event) => {
      console.log('[Native Push] App opened via custom URL Scheme:', event.url);
      try {
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

    console.log('[Native Push] Capacitor Android Push Notifications initialized successfully');
  } catch (err) {
    console.error('[Native Push] Capacitor Push setup error:', err);
  }
}

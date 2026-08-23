import { AppFlavor, AppFlavorConfig, AppIdentifier, UserRole } from '../types';

/**
 * FOUR ANDROID PRODUCT FLAVOR CONFIGURATIONS
 * Package IDs:
 * - Customer: com.faratech.bukkit.customer
 * - Vendor:   com.faratech.bukkit.vendor
 * - Rider:    com.faratech.bukkit.rider
 * - Admin:    com.faratech.bukkit.admin
 */
export const BUKKIT_FLAVORS: Record<AppFlavor, AppFlavorConfig> = {
  customer: {
    flavor: 'customer',
    appIdentifier: 'CUSTOMER_APP',
    appName: 'BUKKIT Campus Food',
    packageName: 'com.faratech.bukkit.customer',
    allowedRoles: ['customer'],
    deepLinkScheme: 'bukkit',
    defaultRoute: 'home',
    themeColor: '#FF5A00',
    notificationChannels: [
      {
        id: 'orders',
        name: 'Order Updates',
        description: 'Real-time order progress, preparation, and delivery alerts',
        importance: 'high'
      },
      {
        id: 'deliveries',
        name: 'Courier Updates',
        description: 'Live rider dispatch, arrival, and pickup notifications',
        importance: 'high'
      },
      {
        id: 'messages',
        name: 'Delivery Chat Messages',
        description: 'Realtime chat messages from your assigned delivery courier',
        importance: 'high'
      },
      {
        id: 'payments',
        name: 'Payments & Refunds',
        description: 'Wallet funding, Paystack checkout, and refund confirmations',
        importance: 'default'
      },
      {
        id: 'account',
        name: 'Account & Security',
        description: 'Verification codes, login alerts, and campus notices',
        importance: 'low'
      }
    ]
  },
  vendor: {
    flavor: 'vendor',
    appIdentifier: 'VENDOR_APP',
    appName: 'BUKKIT Kitchen Partner',
    packageName: 'com.faratech.bukkit.vendor',
    allowedRoles: ['kitchen', 'kitchen_manager', 'kitchen_staff'],
    deepLinkScheme: 'bukkit-vendor',
    defaultRoute: 'kitchen',
    themeColor: '#EA580C',
    notificationChannels: [
      {
        id: 'orders',
        name: 'Incoming Kitchen Orders',
        description: 'Immediate ring alerts for newly submitted campus orders',
        importance: 'high'
      },
      {
        id: 'deliveries',
        name: 'Rider Arrivals',
        description: 'Notifications when assigned courier arrives at stand',
        importance: 'high'
      },
      {
        id: 'messages',
        name: 'Operations & Dispatch',
        description: 'Coordination alerts with dispatch and administration',
        importance: 'default'
      },
      {
        id: 'payments',
        name: 'Vendor Settlements',
        description: 'Daily payouts, batch settlements, and reconciliation',
        importance: 'default'
      },
      {
        id: 'account',
        name: 'Kitchen Stand Settings',
        description: 'Menu status, stall opening/closing confirmation',
        importance: 'low'
      }
    ]
  },
  rider: {
    flavor: 'rider',
    appIdentifier: 'RIDER_APP',
    appName: 'BUKKIT Courier Fleet',
    packageName: 'com.faratech.bukkit.rider',
    allowedRoles: ['rider'],
    deepLinkScheme: 'bukkit-rider',
    defaultRoute: 'rider',
    themeColor: '#059669',
    notificationChannels: [
      {
        id: 'deliveries',
        name: 'Dispatch & Delivery Offers',
        description: 'New delivery assignments, pickup alerts, and route dispatches',
        importance: 'high'
      },
      {
        id: 'messages',
        name: 'Customer Chat Messages',
        description: 'Urgent delivery location and drop-off messages from customers',
        importance: 'high'
      },
      {
        id: 'orders',
        name: 'Order Lifecycle State',
        description: 'Kitchen readiness status and packaging confirmation',
        importance: 'default'
      },
      {
        id: 'payments',
        name: 'Rider Earnings & Tips',
        description: 'Completed delivery payouts, tips, and daily incentives',
        importance: 'default'
      },
      {
        id: 'account',
        name: 'Courier Shift & Status',
        description: 'Online/offline mode, vehicle status, and safety alerts',
        importance: 'low'
      }
    ]
  },
  admin: {
    flavor: 'admin',
    appIdentifier: 'ADMIN_APP',
    appName: 'BUKKIT Admin Console',
    packageName: 'com.faratech.bukkit.admin',
    allowedRoles: ['admin', 'super_admin'],
    deepLinkScheme: 'bukkit-admin',
    defaultRoute: 'admin',
    themeColor: '#4F46E5',
    notificationChannels: [
      {
        id: 'orders',
        name: 'Campus Operations Escalations',
        description: 'Delayed orders, cancelled orders, and critical dispatch alerts',
        importance: 'high'
      },
      {
        id: 'deliveries',
        name: 'Fleet Logistics & Incidents',
        description: 'Rider availability deficits and high campus demand surges',
        importance: 'high'
      },
      {
        id: 'messages',
        name: 'System Notifications',
        description: 'Audit events and campus administration broadcasts',
        importance: 'default'
      },
      {
        id: 'payments',
        name: 'Financial Audits',
        description: 'High-value refunds, escrow disputes, and payout logs',
        importance: 'high'
      },
      {
        id: 'account',
        name: 'Security & Access Logs',
        description: 'RBAC elevation events and administrative login audits',
        importance: 'high'
      }
    ]
  }
};

/**
 * Detect Current App Flavor
 * Resolution Order:
 * 1. Native Android injected global: window.BUKKIT_NATIVE_FLAVOR
 * 2. Build-time environment variable: import.meta.env.VITE_BUKKIT_APP_VARIANT
 * 3. URL Query Parameter (?apk=vendor, ?apk=rider, ?apk=admin, ?apk=customer)
 * 4. LocalStorage persistent preview setting: bukkit_active_apk_flavor
 * 5. Default fallback: 'customer'
 */
export function getCurrentAppFlavor(): AppFlavor {
  // 1. Injected by Native Android WebBridge
  if (typeof window !== 'undefined' && (window as any).BUKKIT_NATIVE_FLAVOR) {
    const nativeFlavor = String((window as any).BUKKIT_NATIVE_FLAVOR).toLowerCase().trim() as AppFlavor;
    if (BUKKIT_FLAVORS[nativeFlavor]) return nativeFlavor;
  }

  // 2. Build-time Vite environment variable
  const envFlavor = ((import.meta as any).env?.VITE_BUKKIT_APP_VARIANT as string)?.toLowerCase()?.trim() as AppFlavor;
  if (envFlavor && BUKKIT_FLAVORS[envFlavor]) {
    return envFlavor;
  }

  // 3. URL query parameter (for previewing and switching flavors)
  if (typeof window !== 'undefined') {
    try {
      const params = new URLSearchParams(window.location.search);
      const urlApk = params.get('apk')?.toLowerCase()?.trim() as AppFlavor;
      if (urlApk && BUKKIT_FLAVORS[urlApk]) {
        localStorage.setItem('bukkit_active_apk_flavor', urlApk);
        return urlApk;
      }
    } catch (e) {}

    // 4. LocalStorage preview selector
    try {
      const storedFlavor = localStorage.getItem('bukkit_active_apk_flavor') as AppFlavor;
      if (storedFlavor && BUKKIT_FLAVORS[storedFlavor]) {
        return storedFlavor;
      }
    } catch (e) {}
  }

  return 'customer';
}

/**
 * Switch Active App Flavor (for development and multi-flavor preview)
 */
export function setDevAppFlavor(flavor: AppFlavor): void {
  if (typeof window !== 'undefined' && BUKKIT_FLAVORS[flavor]) {
    localStorage.setItem('bukkit_active_apk_flavor', flavor);
    const url = new URL(window.location.href);
    url.searchParams.set('apk', flavor);
    window.location.href = url.toString();
  }
}

/**
 * Check whether a user's database role is authorized for the current APK flavor
 */
export function isRoleAuthorizedForFlavor(userRole: UserRole | undefined | null, flavor: AppFlavor): boolean {
  if (!userRole) return false;
  const config = BUKKIT_FLAVORS[flavor];
  if (!config) return false;

  // Normalize kitchen sub-roles
  if (flavor === 'vendor') {
    return ['kitchen', 'kitchen_manager', 'kitchen_staff'].includes(userRole);
  }

  // Normalize admin sub-roles
  if (flavor === 'admin') {
    return ['admin', 'super_admin'].includes(userRole);
  }

  return config.allowedRoles.includes(userRole);
}

/**
 * Get formatted role mismatch error message for UI
 */
export function getRoleMismatchErrorMessage(userRole: UserRole | undefined | null, flavor: AppFlavor): {
  title: string;
  body: string;
  requiredApp: string;
} {
  const currentConfig = BUKKIT_FLAVORS[flavor];
  const roleName = userRole ? userRole.replace('_', ' ').toUpperCase() : 'UNKNOWN';

  let requiredApp = 'Customer App';
  if (['kitchen', 'kitchen_manager', 'kitchen_staff'].includes(userRole as string)) {
    requiredApp = 'BUKKIT Kitchen Partner APK';
  } else if (userRole === 'rider') {
    requiredApp = 'BUKKIT Courier Fleet APK';
  } else if (['admin', 'super_admin'].includes(userRole as string)) {
    requiredApp = 'BUKKIT Admin Console APK';
  }

  return {
    title: `Account Mismatch for ${currentConfig.appName}`,
    body: `This account (Role: ${roleName}) cannot be used with the ${currentConfig.appName}. Please sign in with an authorized ${flavor.toUpperCase()} account or switch to the ${requiredApp}.`,
    requiredApp
  };
}

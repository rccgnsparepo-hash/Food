import { UserRole, Permission, UserIdentity, UserProfile, Order, OrderStatus } from '../types';
import { db, auth } from '../lib/firebase';
import { doc, getDoc, setDoc, updateDoc, collection, query, where, getDocs, limit } from "../lib/embeddedDb";
import { matchOfficialVendor } from './seedService';

const cleanFirestoreData = (data: any): any => {
  return JSON.parse(JSON.stringify(data));
};

export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  customer: [
    'orders.read',
    'orders.create',
    'orders.cancel'
  ],
  rider: [
    'orders.read',
    'orders.pickup',
    'orders.deliver'
  ],
  kitchen_staff: [
    'orders.read',
    'orders.prepare',
    'orders.ready'
  ],
  kitchen: [
    'orders.read',
    'orders.accept',
    'orders.reject',
    'orders.prepare',
    'orders.ready',
    'vendors.manage'
  ],
  kitchen_manager: [
    'orders.read',
    'orders.accept',
    'orders.reject',
    'orders.prepare',
    'orders.ready',
    'vendors.manage'
  ],
  admin: [
    'orders.read',
    'orders.create',
    'orders.accept',
    'orders.reject',
    'orders.prepare',
    'orders.ready',
    'orders.assign_rider',
    'orders.pickup',
    'orders.deliver',
    'orders.cancel',
    'users.manage',
    'vendors.manage',
    'riders.manage',
    'payments.view',
    'analytics.view'
  ],
  super_admin: [
    'orders.read',
    'orders.create',
    'orders.accept',
    'orders.reject',
    'orders.prepare',
    'orders.ready',
    'orders.assign_rider',
    'orders.pickup',
    'orders.deliver',
    'orders.cancel',
    'users.manage',
    'vendors.manage',
    'riders.manage',
    'payments.view',
    'analytics.view'
  ]
};

export function getRolePermissions(role: UserRole): Permission[] {
  return ROLE_PERMISSIONS[role] || ROLE_PERMISSIONS.customer;
}

export function hasPermission(user: { permissions?: Permission[]; active_role?: UserRole; role?: UserRole }, permission: Permission): boolean {
  if (!user) return false;
  if (user.active_role === 'super_admin' || user.role === 'super_admin' || user.active_role === 'admin' || user.role === 'admin') {
    return true;
  }
  if (user.permissions && user.permissions.includes(permission)) {
    return true;
  }
  const effectiveRole = user.active_role || user.role || 'customer';
  const rolePerms = getRolePermissions(effectiveRole);
  return rolePerms.includes(permission);
}

/**
 * Resolves authoritative user profile and sub-profiles directly from Firestore
 */
export async function resolveAuthoritativeUserProfile(uid: string): Promise<UserProfile | null> {
  if (!uid) return null;

  try {
    const userDocRef = doc(db, 'users', uid);
    const userDoc = await getDoc(userDocRef);

    if (!userDoc.exists()) {
      // Fetch sub-profiles in parallel to check if user has a specific role sub-document
      const [custSnap, riderSnap, kitchenSnap, adminSnap] = await Promise.all([
        getDoc(doc(db, 'customer_profiles', uid)).catch(() => null),
        getDoc(doc(db, 'rider_profiles', uid)).catch(() => null),
        getDoc(doc(db, 'kitchen_staff_profiles', uid)).catch(() => null),
        getDoc(doc(db, 'admin_profiles', uid)).catch(() => null)
      ]);

      let detectedRole: UserRole = 'customer';
      if (adminSnap?.exists()) {
        detectedRole = 'admin';
      } else if (kitchenSnap?.exists()) {
        const kRole = kitchenSnap.data()?.role;
        detectedRole = (kRole === 'kitchen_manager' || kRole === 'kitchen_staff') ? kRole : 'kitchen';
      } else if (riderSnap?.exists()) {
        detectedRole = 'rider';
      }

      const currentFbUser = auth.currentUser;
      if (currentFbUser && currentFbUser.uid === uid) {
        const fallbackProfile: UserProfile = {
          id: uid,
          uid,
          email: currentFbUser.email || '',
          phone: currentFbUser.phoneNumber || '',
          first_name: currentFbUser.displayName?.split(' ')[0] || 'BUKKIT',
          last_name: currentFbUser.displayName?.split(' ').slice(1).join(' ') || 'User',
          name: currentFbUser.displayName || 'BUKKIT User',
          avatar_url: currentFbUser.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(currentFbUser.email || uid)}`,
          status: 'active',
          email_verified: !!currentFbUser.emailVerified,
          phone_verified: !!currentFbUser.phoneNumber,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          last_login_at: new Date().toISOString(),
          roles: [detectedRole],
          active_role: detectedRole,
          role: detectedRole,
          permissions: getRolePermissions(detectedRole),
          address: 'Mountain Top University',
          latitude: 6.783,
          longitude: 3.441,
          university_id: 'uni_mtu',
          campus_id: 'campus_mtu_main',
          customer_profile: custSnap?.exists() ? custSnap.data() as any : undefined,
          rider_profile: riderSnap?.exists() ? riderSnap.data() as any : undefined,
          kitchen_profile: kitchenSnap?.exists() ? kitchenSnap.data() as any : undefined,
          admin_profile: adminSnap?.exists() ? adminSnap.data() as any : undefined
        };

        // Persist reconstructed profile into central Firestore
        setDoc(doc(db, 'users', uid), cleanFirestoreData(fallbackProfile)).catch(() => {});
        return fallbackProfile;
      }
      return null;
    }

    const userData = userDoc.data() as Partial<UserProfile>;

    // Fetch sub-profiles in parallel
    const [custSnap, riderSnap, kitchenSnap, adminSnap] = await Promise.all([
      getDoc(doc(db, 'customer_profiles', uid)).catch(() => null),
      getDoc(doc(db, 'rider_profiles', uid)).catch(() => null),
      getDoc(doc(db, 'kitchen_staff_profiles', uid)).catch(() => null),
      getDoc(doc(db, 'admin_profiles', uid)).catch(() => null)
    ]);

    // Discover all assigned roles from user document + sub-profile documents
    const discoveredRoles = new Set<UserRole>(
      userData.roles || (userData.role ? [userData.role] : [])
    );
    if (adminSnap?.exists()) discoveredRoles.add('admin');
    if (kitchenSnap?.exists()) {
      const kRole = kitchenSnap.data()?.role;
      discoveredRoles.add(kRole === 'kitchen_manager' || kRole === 'kitchen_staff' ? kRole : 'kitchen');
    }
    if (riderSnap?.exists()) discoveredRoles.add('rider');
    if (custSnap?.exists()) discoveredRoles.add('customer');
    if (discoveredRoles.size === 0) discoveredRoles.add('customer');

    const roles = Array.from(discoveredRoles);

    // Authoritative active role determination
    let activeRole: UserRole = userData.active_role || userData.role || 'customer';
    
    // If activeRole is 'customer' or default, check if user has a non-customer subprofile or role assignment
    if (activeRole === 'customer' || !activeRole) {
      if (adminSnap?.exists() || roles.includes('admin') || roles.includes('super_admin')) {
        activeRole = roles.includes('super_admin') ? 'super_admin' : 'admin';
      } else if (kitchenSnap?.exists() || roles.includes('kitchen') || roles.includes('kitchen_manager') || roles.includes('kitchen_staff')) {
        const kRole = kitchenSnap?.data()?.role;
        activeRole = (kRole === 'kitchen_manager' || kRole === 'kitchen_staff') ? kRole : 'kitchen';
      } else if (riderSnap?.exists() || roles.includes('rider')) {
        activeRole = 'rider';
      }
    }

    const permissions = userData.permissions || getRolePermissions(activeRole);

    const isKitchenRole = activeRole === 'kitchen' || activeRole === 'kitchen_manager' || activeRole === 'kitchen_staff' || roles.includes('kitchen');
    
    // Check match against the 5 official vendors (Stand-1(Bunlab), Multi-grace, Kitchen3, Mama Fruits, Kitchen5(Mummy and Daddy))
    const matchedVendor = matchOfficialVendor(userData.vendor_id) || 
                          matchOfficialVendor(kitchenSnap?.data()?.vendor_id) || 
                          matchOfficialVendor(kitchenSnap?.data()?.vendor_name) || 
                          matchOfficialVendor(userData.name);

    let resolvedVendorId = matchedVendor 
      ? matchedVendor.id 
      : (userData.vendor_id || (kitchenSnap?.exists() ? kitchenSnap.data()?.vendor_id : undefined));
      
    if (!resolvedVendorId && isKitchenRole) {
      resolvedVendorId = 'vendor_bunlab_01';
    }

    const profile: UserProfile = {
      id: uid,
      uid,
      email: userData.email || '',
      phone: userData.phone || '',
      first_name: userData.first_name || userData.name?.split(' ')[0] || 'BUKKIT',
      last_name: userData.last_name || userData.name?.split(' ').slice(1).join(' ') || 'User',
      name: userData.name || `${userData.first_name || ''} ${userData.last_name || ''}`.trim() || 'BUKKIT User',
      avatar_url: userData.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(userData.email || uid)}`,
      status: userData.status || 'active',
      email_verified: !!userData.email_verified,
      phone_verified: !!userData.phone_verified,
      created_at: userData.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
      last_login_at: new Date().toISOString(),
      roles,
      active_role: activeRole,
      role: activeRole,
      permissions,
      address: userData.address || 'Mountain Top University',
      latitude: userData.latitude || 6.783,
      longitude: userData.longitude || 3.441,
      university_id: userData.university_id || 'uni_mtu',
      campus_id: userData.campus_id || 'campus_mtu_main',
      preferred_zone_id: userData.preferred_zone_id,
      vendor_id: resolvedVendorId,
      customer_profile: custSnap?.exists() ? custSnap.data() as any : undefined,
      rider_profile: riderSnap?.exists() ? riderSnap.data() as any : undefined,
      kitchen_profile: kitchenSnap?.exists() ? kitchenSnap.data() as any : undefined,
      admin_profile: adminSnap?.exists() ? adminSnap.data() as any : undefined
    };

    return profile;
  } catch (err: any) {
    console.warn('[Firestore Auth Profile Resolution Notice]:', err?.message || err);
    const currentFbUser = auth.currentUser;
    if (currentFbUser && currentFbUser.uid === uid) {
      return {
        id: uid,
        uid,
        email: currentFbUser.email || '',
        phone: currentFbUser.phoneNumber || '',
        first_name: currentFbUser.displayName?.split(' ')[0] || 'BUKKIT',
        last_name: currentFbUser.displayName?.split(' ').slice(1).join(' ') || 'User',
        name: currentFbUser.displayName || 'BUKKIT User',
        avatar_url: currentFbUser.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(currentFbUser.email || uid)}`,
        status: 'active',
        email_verified: !!currentFbUser.emailVerified,
        phone_verified: !!currentFbUser.phoneNumber,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        last_login_at: new Date().toISOString(),
        roles: ['customer'],
        active_role: 'customer',
        role: 'customer',
        permissions: getRolePermissions('customer'),
        address: 'Mountain Top University',
        latitude: 6.783,
        longitude: 3.441,
        university_id: 'uni_mtu',
        campus_id: 'campus_mtu_main'
      };
    }
    return null;
  }
}

/**
 * Searches for an existing user profile by email address in the central Firebase Firestore database
 */
export async function findUserProfileByEmail(email: string): Promise<UserProfile | null> {
  if (!email || !email.trim()) return null;
  const cleanEmail = email.trim().toLowerCase();

  try {
    const q = query(collection(db, 'users'), where('email', '==', cleanEmail), limit(1));
    const snap = await getDocs(q);
    if (!snap.empty) {
      const foundUid = snap.docs[0].id;
      return await resolveAuthoritativeUserProfile(foundUid);
    }

    if (cleanEmail !== email.trim()) {
      const qRaw = query(collection(db, 'users'), where('email', '==', email.trim()), limit(1));
      const snapRaw = await getDocs(qRaw);
      if (!snapRaw.empty) {
        return await resolveAuthoritativeUserProfile(snapRaw.docs[0].id);
      }
    }

    return null;
  } catch (err) {
    console.warn('[Firestore Search User by Email Notice]:', err);
    return null;
  }
}

/**
 * Checks if a user already exists in central Firestore by email or UID
 */
export async function checkUserExistsInDatabase(identifier: { email?: string; uid?: string }): Promise<boolean> {
  try {
    if (identifier.uid) {
      const userDocRef = doc(db, 'users', identifier.uid);
      const userDoc = await getDoc(userDocRef);
      if (userDoc.exists()) return true;
    }

    if (identifier.email) {
      const profile = await findUserProfileByEmail(identifier.email);
      if (profile) return true;
    }

    return false;
  } catch (err) {
    console.warn('Error checking user existence in active Firestore:', err);
    return false;
  }
}

/**
 * Validates whether user is authorized to perform an order status transition
 */
export function validateOrderStatusTransition(
  user: UserProfile,
  order: Order,
  targetStatus: OrderStatus
): { allowed: boolean; reason?: string } {
  const role = user.active_role || user.role;

  if (role === 'super_admin' || role === 'admin') {
    return { allowed: true };
  }

  if (user.status === 'suspended') {
    return { allowed: false, reason: 'Account is currently suspended. Action denied.' };
  }

  const currentStatus = order.status;
  const userVendorId = user.vendor_id || user.kitchen_profile?.vendor_id;
  const orderVendorId = order.vendor_id || (order as any).restaurant_id;

  const isMatchingVendor = () => {
    if (!userVendorId || !orderVendorId) return true;
    if (userVendorId === orderVendorId || userVendorId === user.uid) return true;
    const userCanonical = matchOfficialVendor(userVendorId)?.id || userVendorId;
    const orderCanonical = matchOfficialVendor(orderVendorId)?.id || orderVendorId;
    return userCanonical === orderCanonical;
  };

  switch (targetStatus) {
    case 'payment_confirmed':
      if (currentStatus !== 'pending') {
        return { allowed: false, reason: `Cannot confirm payment for order in '${currentStatus}' status.` };
      }
      return { allowed: true };

    case 'vendor_accepted':
    case 'accepted':
      if (role !== 'kitchen' && role !== 'kitchen_manager' && role !== 'kitchen_staff') {
        return { allowed: false, reason: 'Only the kitchen vendor can accept this order.' };
      }
      if (!isMatchingVendor()) {
        return { allowed: false, reason: 'Unauthorized: You can only manage orders for your own kitchen stand.' };
      }
      if (currentStatus !== 'pending' && currentStatus !== 'payment_confirmed') {
        return { allowed: false, reason: `Cannot accept order currently in '${currentStatus}' status.` };
      }
      return { allowed: true };

    case 'preparing':
      if (role !== 'kitchen' && role !== 'kitchen_manager' && role !== 'kitchen_staff') {
        return { allowed: false, reason: 'Only kitchen staff can mark order as preparing.' };
      }
      if (!isMatchingVendor()) {
        return { allowed: false, reason: 'Unauthorized: You can only manage orders for your own kitchen stand.' };
      }
      if (
        currentStatus !== 'accepted' &&
        currentStatus !== 'vendor_accepted' &&
        currentStatus !== 'payment_confirmed' &&
        currentStatus !== 'pending'
      ) {
        return { allowed: false, reason: `Cannot prepare order currently in '${currentStatus}' status.` };
      }
      return { allowed: true };

    case 'ready_for_pickup':
    case 'ready':
      if (role !== 'kitchen' && role !== 'kitchen_manager' && role !== 'kitchen_staff') {
        return { allowed: false, reason: 'Only kitchen staff can mark order as ready for pickup.' };
      }
      if (!isMatchingVendor()) {
        return { allowed: false, reason: 'Unauthorized: You can only manage orders for your own kitchen stand.' };
      }
      if (
        currentStatus !== 'preparing' &&
        currentStatus !== 'accepted' &&
        currentStatus !== 'vendor_accepted'
      ) {
        return { allowed: false, reason: `Cannot mark order ready when status is '${currentStatus}'.` };
      }
      return { allowed: true };

    case 'vendor_rejected':
      if (role !== 'kitchen' && role !== 'kitchen_manager' && role !== 'kitchen_staff') {
        return { allowed: false, reason: 'Only kitchen vendor can reject this order.' };
      }
      if (!isMatchingVendor()) {
        return { allowed: false, reason: 'Unauthorized: You can only manage orders for your own kitchen stand.' };
      }
      if (currentStatus !== 'pending' && currentStatus !== 'payment_confirmed') {
        return { allowed: false, reason: `Cannot reject order that has already progressed beyond initial confirmation.` };
      }
      return { allowed: true };

    case 'rider_assigned':
    case 'assigned':
      if (role !== 'rider') {
        return { allowed: false, reason: 'Only delivery riders can claim orders.' };
      }
      if (
        currentStatus !== 'ready' &&
        currentStatus !== 'ready_for_pickup' &&
        currentStatus !== 'preparing' &&
        currentStatus !== 'vendor_accepted' &&
        currentStatus !== 'accepted'
      ) {
        return { allowed: false, reason: `Cannot claim order with status '${currentStatus}'.` };
      }
      return { allowed: true };

    case 'picked_up':
      if (role !== 'rider') {
        return { allowed: false, reason: 'Only delivery riders can mark orders picked up.' };
      }
      if (
        currentStatus !== 'rider_assigned' &&
        currentStatus !== 'assigned' &&
        currentStatus !== 'ready' &&
        currentStatus !== 'ready_for_pickup'
      ) {
        return { allowed: false, reason: `Cannot pick up order with status '${currentStatus}'.` };
      }
      return { allowed: true };

    case 'out_for_delivery':
    case 'on_the_way':
      if (role !== 'rider') {
        return { allowed: false, reason: 'Only delivery riders can update transit status.' };
      }
      if (currentStatus !== 'picked_up') {
        return { allowed: false, reason: `Order must be picked up before setting to out for delivery.` };
      }
      return { allowed: true };

    case 'delivered':
      if (role !== 'rider') {
        return { allowed: false, reason: 'Only delivery riders can confirm completion.' };
      }
      if (currentStatus !== 'out_for_delivery' && currentStatus !== 'picked_up' && currentStatus !== 'on_the_way') {
        return { allowed: false, reason: `Cannot complete delivery from status '${currentStatus}'.` };
      }
      return { allowed: true };

    case 'cancelled':
      if (role === 'customer') {
        if (order.user_id !== user.uid && order.customer_id !== user.uid) {
          return { allowed: false, reason: 'Unauthorized: You can only cancel your own orders.' };
        }
        if (currentStatus !== 'pending' && currentStatus !== 'payment_confirmed') {
          return { allowed: false, reason: 'Order has already begun preparation and can no longer be cancelled.' };
        }
      }
      return { allowed: true };

    default:
      return { allowed: true };
  }
}

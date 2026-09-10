import { db } from '../lib/firebase';
import { doc, getDoc, setDoc, updateDoc, collection, query, where, orderBy, onSnapshot, getDocs } from "../lib/embeddedDb";
import {
  RiderProfile,
  RiderAvailabilityStatus,
  Order,
  DeliveryEarning,
  RiderEarningsSummary,
  UserProfile,
  UserRole
} from '../types';
import { cleanFirestoreData, transitionOrderStatus } from './orderLifecycleService';
import { recordAuditLog, logAuditEvent } from './auditLogService';
import {
  recordRiderEarningsOnDelivery,
  subscribeToRiderEarnings,
  getRiderEarningsSummary,
  calculateRiderEarnings
} from './earningsService';
import { toast } from 'sonner';

export {
  recordRiderEarningsOnDelivery,
  subscribeToRiderEarnings,
  getRiderEarningsSummary,
  calculateRiderEarnings
};

/**
 * Initializes or fetches a Rider's authoritative profile
 */
export async function getOrCreateRiderProfile(user: UserProfile): Promise<RiderProfile> {
  const riderRef = doc(db, 'rider_profiles', user.uid);
  const snap = await getDoc(riderRef);

  if (snap.exists()) {
    return snap.data() as RiderProfile;
  }

  const now = new Date().toISOString();
  const initialRider: RiderProfile = {
    rider_id: `RDR_${user.uid.substring(0, 8)}`,
    user_id: user.uid,
    full_name: user.name || 'Campus Courier',
    phone: user.phone || '+234 810 000 0000',
    profile_photo: user.avatar_url || '',
    vehicle_type: 'motorcycle',
    vehicle_number: 'MTU-RDR-01',
    plate_number: 'MTU-RDR-01',
    matric_or_id_number: 'MTU/STU/RDR/2026',
    availability_status: 'online',
    is_online: true,
    is_verified: true,
    current_location: {
      latitude: 6.784,
      longitude: 3.442,
      accuracy: 5,
      timestamp: now
    },
    current_latitude: 6.784,
    current_longitude: 3.442,
    rating: 4.9,
    completed_deliveries: 18,
    earnings_balance: 14500,
    university_id: user.university_id || 'uni_mtu',
    campus_id: user.campus_id || 'campus_mtu_main',
    created_at: now,
    updated_at: now
  };

  const cleaned = cleanFirestoreData(initialRider);
  await setDoc(riderRef, cleaned);
  return initialRider;
}

/**
 * Subscribes to real-time rider profile updates
 */
export function subscribeToRiderProfile(
  userId: string,
  callback: (profile: RiderProfile | null) => void
): () => void {
  if (!userId) return () => {};
  const riderRef = doc(db, 'rider_profiles', userId);
  return onSnapshot(riderRef, (snap) => {
    if (snap.exists()) {
      callback(snap.data() as RiderProfile);
    } else {
      callback(null);
    }
  });
}

/**
 * Updates Rider availability status (online, available, offline, etc.)
 */
export async function updateRiderAvailability(
  userId: string,
  status: RiderAvailabilityStatus,
  isOnline: boolean
): Promise<{ success: boolean; error?: string }> {
  try {
    const riderRef = doc(db, 'rider_profiles', userId);
    const now = new Date().toISOString();
    await updateDoc(riderRef, {
      availability_status: status,
      is_online: isOnline,
      updated_at: now
    });
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to update availability' };
  }
}

/**
 * Throttled live GPS location update for active riders
 */
export async function updateRiderLiveLocation(
  userId: string,
  latitude: number,
  longitude: number,
  activeOrderId?: string | null
): Promise<void> {
  try {
    const now = new Date().toISOString();
    const riderRef = doc(db, 'rider_profiles', userId);
    await updateDoc(riderRef, {
      'current_location.latitude': latitude,
      'current_location.longitude': longitude,
      'current_location.timestamp': now,
      current_latitude: latitude,
      current_longitude: longitude,
      updated_at: now
    });

    if (activeOrderId) {
      const orderRef = doc(db, 'orders', activeOrderId);
      await updateDoc(orderRef, {
        rider_current_latitude: latitude,
        rider_current_longitude: longitude,
        updated_at: now
      });
    }
  } catch (err) {
    // Non-blocking throttled warning
  }
}

/**
 * Secure Pickup Verification:
 * Rider enters or scans the 4-digit pickup_code provided by the vendor kitchen.
 */
export async function verifyOrderPickup(params: {
  orderId: string;
  enteredPickupCode: string;
  rider: UserProfile;
}): Promise<{ success: boolean; order?: Order; error?: string }> {
  try {
    const { orderId, enteredPickupCode, rider } = params;
    const orderDocRef = doc(db, 'orders', orderId);
    const snap = await getDoc(orderDocRef);

    if (!snap.exists()) {
      return { success: false, error: 'Order not found.' };
    }

    const order = snap.data() as Order;
    const cleanEntered = enteredPickupCode.trim();
    const cleanExpected = (order.pickup_code || '').trim();

    if (!cleanExpected || cleanEntered !== cleanExpected) {
      return {
        success: false,
        error: 'Invalid Pickup PIN. Please check the 4-digit code displayed on the Vendor Kitchen screen.'
      };
    }

    // Advance order to 'picked_up'
    const now = new Date().toISOString();
    const result = await transitionOrderStatus(orderId, 'picked_up', rider, {
      riderId: rider.uid,
      riderName: rider.name,
      riderPhone: rider.phone
    });

    if (!result.success) {
      return result;
    }

    // Update rider active order and status to 'delivering'
    const riderRef = doc(db, 'rider_profiles', rider.uid);
    await updateDoc(riderRef, {
      availability_status: 'delivering',
      active_order_id: orderId,
      updated_at: now
    });

    await logAuditEvent({
      actor_id: rider.uid,
      actor_name: rider.name,
      actor_role: 'rider',
      action: 'ORDER_PICKUP_VERIFIED',
      order_id: orderId,
      previous_state: 'ready_for_pickup',
      new_state: 'picked_up',
      metadata: { pickup_code_verified: true }
    });

    return { success: true, order: result.order };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Pickup verification failed.' };
  }
}

/**
 * Secure Delivery Verification:
 * Rider enters or scans the 4-digit delivery_code provided by the customer.
 * Upon verification:
 * - Order is transitioned to 'delivered'
 * - Rider delivery earnings (75% rider / 25% commission) are calculated and recorded
 * - Rider status is reset to 'available'
 */
export async function verifyOrderDelivery(params: {
  orderId: string;
  enteredDeliveryCode: string;
  rider: UserProfile;
  method?: 'pin' | 'qr_scan' | 'customer_confirm';
}): Promise<{ success: boolean; order?: Order; error?: string }> {
  try {
    const { orderId, enteredDeliveryCode, rider, method = 'pin' } = params;
    const orderDocRef = doc(db, 'orders', orderId);
    const snap = await getDoc(orderDocRef);

    if (!snap.exists()) {
      return { success: false, error: 'Order not found.' };
    }

    const order = snap.data() as Order;
    const cleanEntered = enteredDeliveryCode.trim();
    const cleanExpected = (order.delivery_code || order.pickup_code || '').trim();

    // Check if security lockout is active
    const nowTime = new Date();
    if (order.pin_locked_until && new Date(order.pin_locked_until) > nowTime) {
      const remainingSec = Math.ceil((new Date(order.pin_locked_until).getTime() - nowTime.getTime()) / 1000);
      const remainingMin = Math.ceil(remainingSec / 60);
      return {
        success: false,
        error: `🔒 Security Lockout Active: Too many failed PIN attempts. Locked for ${remainingMin} more minute(s). Contact customer directly.`
      };
    }

    if (method === 'pin' && cleanExpected && cleanEntered !== cleanExpected) {
      const currentAttempts = (Number(order.pin_attempts) || 0) + 1;
      const isNowLocked = currentAttempts >= 3;
      const lockUntil = isNowLocked ? new Date(Date.now() + 5 * 60 * 1000).toISOString() : undefined;

      await updateDoc(orderDocRef, cleanFirestoreData({
        pin_attempts: currentAttempts,
        pin_locked_until: lockUntil,
        updated_at: new Date().toISOString()
      }));

      await logAuditEvent({
        actor_id: rider.uid,
        actor_name: rider.name,
        actor_role: 'rider',
        action: isNowLocked ? 'PIN_BRUTE_FORCE_LOCKOUT' : 'PIN_VERIFICATION_FAILED',
        order_id: orderId,
        previous_state: order.status,
        new_state: order.status,
        metadata: {
          attempt_number: currentAttempts,
          locked: isNowLocked
        }
      });

      if (isNowLocked) {
        return {
          success: false,
          error: '🚨 3 incorrect attempts entered! Delivery verification locked for 5 minutes to prevent unauthorized claims.'
        };
      }

      return {
        success: false,
        error: `Invalid Delivery PIN. (${3 - currentAttempts} attempt${3 - currentAttempts === 1 ? '' : 's'} remaining before security lockout)`
      };
    }

    const now = new Date().toISOString();

    // Reset attempts on successful PIN entry
    await updateDoc(orderDocRef, cleanFirestoreData({
      pin_attempts: 0,
      pin_locked_until: null,
      delivery_proof_type: 'pin',
      delivery_verification_method: method,
      delivery_verified_at: now
    }));

    // Advance order to 'delivered'
    const transitionResult = await transitionOrderStatus(orderId, 'delivered', rider);
    if (!transitionResult.success) {
      return transitionResult;
    }

    // Automatically calculate and record Rider Delivery Earnings via earningsService
    const earningResult = await recordRiderEarningsOnDelivery(order, rider);

    await logAuditEvent({
      actor_id: rider.uid,
      actor_name: rider.name,
      actor_role: 'rider',
      action: 'ORDER_DELIVERY_VERIFIED',
      order_id: orderId,
      previous_state: 'arrived_at_delivery',
      new_state: 'delivered',
      metadata: {
        verification_method: method,
        rider_earning: earningResult.earning?.rider_earning,
        platform_commission: earningResult.earning?.platform_commission
      }
    });

    return { success: true, order: transitionResult.order };
  } catch (err: any) {
    console.error('Delivery verification error:', err);
    return { success: false, error: err?.message || 'Delivery verification failed.' };
  }
}

/**
 * Fallback Delivery Handover: Hall Porter / Reception Custody
 * Invoked when customer is unreachable or phone died at the hostel gate.
 * Food is deposited securely with the Hall Porter, NOT abandoned or taken by rider.
 */
export async function handoverToHallPorter(params: {
  orderId: string;
  rider: UserProfile;
  hallPorterName: string;
  hallPorterPhone?: string;
  hallPorterPhotoUrl?: string;
  notes?: string;
}): Promise<{ success: boolean; order?: Order; error?: string }> {
  try {
    const { orderId, rider, hallPorterName, hallPorterPhone, hallPorterPhotoUrl, notes } = params;
    if (!hallPorterName.trim()) {
      return { success: false, error: 'Hall Porter or Security Officer name is required for custody handover.' };
    }

    const orderDocRef = doc(db, 'orders', orderId);
    const snap = await getDoc(orderDocRef);
    if (!snap.exists()) {
      return { success: false, error: 'Order not found.' };
    }

    const order = snap.data() as Order;
    const now = new Date().toISOString();

    // Advance order to 'delivered' with porter custody flags
    const updatePayload = cleanFirestoreData({
      delivery_proof_type: 'hall_porter_custody',
      delivery_verification_method: 'hall_porter_custody',
      hall_porter_name: hallPorterName.trim(),
      hall_porter_phone: hallPorterPhone?.trim() || undefined,
      hall_porter_photo_url: hallPorterPhotoUrl || undefined,
      custody_handover_notes: notes?.trim() || undefined,
      payout_held_in_escrow: true,
      delivery_verified_at: now
    });

    await updateDoc(orderDocRef, updatePayload);

    const transitionResult = await transitionOrderStatus(orderId, 'delivered', rider, {
      hallPorterName: hallPorterName.trim(),
      handoverType: 'hall_porter_custody'
    });

    if (!transitionResult.success) {
      return transitionResult;
    }

    // Record earnings in escrow for rider protection
    const earningResult = await recordRiderEarningsOnDelivery(order, rider);

    await logAuditEvent({
      actor_id: rider.uid,
      actor_name: rider.name,
      actor_role: 'rider',
      action: 'ORDER_DELIVERED_TO_HALL_PORTER',
      order_id: orderId,
      previous_state: order.status,
      new_state: 'delivered',
      metadata: {
        hall_porter_name: hallPorterName,
        hall_porter_phone: hallPorterPhone,
        notes: notes,
        payout_held_in_escrow: true,
        rider_earning: earningResult.earning?.rider_earning
      }
    });

    return { success: true, order: transitionResult.order };
  } catch (err: any) {
    console.error('Hall Porter handover error:', err);
    return { success: false, error: err?.message || 'Custody handover failed.' };
  }
}


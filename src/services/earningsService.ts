import { db } from '../lib/firebase';
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  getDocs,
  runTransaction
} from "../lib/embeddedDb";
import {
  Order,
  DeliveryEarning,
  RiderEarningsSummary,
  UserProfile,
  RiderProfile,
  CommissionRules
} from '../types';
import { cleanFirestoreData } from './orderLifecycleService';
import { recordAuditLog } from './auditLogService';

/**
 * Authoritative Backend-Defined Commission Rules for Campus Couriers
 */
export const DEFAULT_COMMISSION_RULES: CommissionRules = {
  rider_percentage: 0.75, // 75% of delivery fee goes directly to Rider
  platform_percentage: 0.25, // 25% retained by BUKKIT platform
  minimum_rider_fee: 300, // Guaranteed minimum payout per completed run (₦300)
  surge_multiplier: 1.0,
  late_night_bonus: 0 // ₦100 extra if run is between 22:00 and 06:00
};

export interface CommissionCalculationResult {
  deliveryFee: number;
  riderEarning: number;
  platformCommission: number;
  commissionRate: number;
  minimumFloorApplied: boolean;
  lateNightBonusApplied: boolean;
  surgeMultiplierApplied: number;
  breakdown: {
    baseDeliveryFee: number;
    standardRiderCut: number;
    platformCut: number;
    effectiveRiderPayout: number;
  };
}

export interface CalculateEarningsOptions {
  surgeMultiplier?: number;
  isLateNight?: boolean;
  customRules?: Partial<CommissionRules>;
}

/**
 * Calculates rider delivery fees and platform commissions based on authoritative rules
 */
export function calculateRiderEarnings(
  deliveryFee: number,
  options?: CalculateEarningsOptions
): CommissionCalculationResult {
  const rules = { ...DEFAULT_COMMISSION_RULES, ...(options?.customRules || {}) };
  const rawFee = Math.max(0, Number(deliveryFee) || 400);

  // Apply surge multiplier if present
  const surge = options?.surgeMultiplier && options.surgeMultiplier > 1 ? options.surgeMultiplier : (rules.surge_multiplier || 1.0);
  const effectiveFee = Math.round(rawFee * surge);

  // Standard percentage split (75% Rider / 25% Platform)
  let standardRiderCut = Math.round(effectiveFee * rules.rider_percentage);
  let minimumFloorApplied = false;

  // Enforce minimum rider earnings floor (e.g. ₦300)
  if (standardRiderCut < rules.minimum_rider_fee) {
    standardRiderCut = rules.minimum_rider_fee;
    minimumFloorApplied = true;
  }

  // Check late night bonus (e.g., between 10 PM and 6 AM)
  let lateNightBonus = 0;
  const currentHour = new Date().getHours();
  const isLateNight = options?.isLateNight ?? (currentHour >= 22 || currentHour < 6);
  if (isLateNight && rules.late_night_bonus) {
    lateNightBonus = rules.late_night_bonus;
  }

  const finalRiderPayout = standardRiderCut + lateNightBonus;
  const platformCut = Math.max(0, effectiveFee - standardRiderCut);

  return {
    deliveryFee: effectiveFee,
    riderEarning: finalRiderPayout,
    platformCommission: platformCut,
    commissionRate: rules.platform_percentage,
    minimumFloorApplied,
    lateNightBonusApplied: lateNightBonus > 0,
    surgeMultiplierApplied: surge,
    breakdown: {
      baseDeliveryFee: effectiveFee,
      standardRiderCut,
      platformCut,
      effectiveRiderPayout: finalRiderPayout
    }
  };
}

/**
 * Automatically calculates and records rider delivery fees and platform commissions
 * into the `rider_earnings` collection immediately after an order is marked as 'DELIVERED'.
 * Includes atomic transaction to update Rider Profile and prevent duplicate payouts.
 */
export async function recordRiderEarningsOnDelivery(
  order: Order,
  rider: UserProfile | { uid: string; name?: string; phone?: string },
  options?: CalculateEarningsOptions
): Promise<{ success: boolean; earning?: DeliveryEarning; error?: string; alreadyProcessed?: boolean }> {
  try {
    const riderId = rider.uid || (rider as any).id;
    if (!riderId) {
      return { success: false, error: 'Rider ID is required to credit delivery earnings.' };
    }

    const orderId = order.id || order.order_id;
    const deterministicEarningId = `EARN_${orderId}`;
    const now = new Date().toISOString();

    const earningDocRef = doc(db, 'rider_earnings', deterministicEarningId);
    const riderProfileRef = doc(db, 'rider_profiles', riderId);

    const calculation = calculateRiderEarnings(order.delivery_fee, options);
    let resultingEarning: DeliveryEarning | undefined;

    // Atomic transaction execution to prevent double-crediting
    await runTransaction(db, async (transaction) => {
      // 1. Check if earning record already exists for this order
      const existingSnap = await transaction.get(earningDocRef);
      if (existingSnap.exists()) {
        const existingData = existingSnap.data() as DeliveryEarning;
        if (existingData.status === 'available' || existingData.status === 'paid_out') {
          resultingEarning = existingData;
          return; // Already processed, return idempotently
        }
      }

      // 2. Prepare earning record
      resultingEarning = {
        delivery_earning_id: deterministicEarningId,
        rider_id: riderId,
        order_id: orderId,
        delivery_fee: calculation.deliveryFee,
        rider_earning: calculation.riderEarning,
        platform_commission: calculation.platformCommission,
        status: 'available',
        created_at: now
      };

      // 3. Update or initialize Rider Profile
      const riderSnap = await transaction.get(riderProfileRef);
      if (riderSnap.exists()) {
        const currentProfile = riderSnap.data() as RiderProfile;
        const newBalance = (currentProfile.earnings_balance || 0) + calculation.riderEarning;
        const newCompleted = (currentProfile.completed_deliveries || 0) + 1;
        const newTotal = (currentProfile.total_deliveries || currentProfile.completed_deliveries || 0) + 1;

        transaction.update(riderProfileRef, {
          earnings_balance: newBalance,
          completed_deliveries: newCompleted,
          total_deliveries: newTotal,
          active_order_id: null,
          availability_status: 'available',
          updated_at: now
        });
      } else {
        // Create initial rider profile if not yet created
        const initialProfile: RiderProfile = {
          rider_id: riderId,
          user_id: riderId,
          full_name: rider.name || 'Campus Courier',
          phone: rider.phone || '+234 810 000 0000',
          vehicle_type: 'motorcycle',
          availability_status: 'available',
          is_online: true,
          is_verified: true,
          rating: 5.0,
          completed_deliveries: 1,
          total_deliveries: 1,
          earnings_balance: calculation.riderEarning,
          created_at: now,
          updated_at: now
        };
        transaction.set(riderProfileRef, cleanFirestoreData(initialProfile));
      }

      // 4. Save to rider_earnings collection
      transaction.set(earningDocRef, cleanFirestoreData(resultingEarning));
    });

    if (!resultingEarning) {
      throw new Error('Failed to record rider delivery earning.');
    }

    // 5. Record Authoritative Audit Log
    await recordAuditLog({
      actor: {
        id: riderId,
        name: rider.name || 'Campus Courier',
        role: 'rider'
      },
      action: 'RIDER_DELIVERY_EARNINGS_SETTLED',
      orderId,
      transactionId: deterministicEarningId,
      previousState: 'in_transit',
      newState: 'delivered',
      metadata: {
        rider_id: riderId,
        delivery_fee: calculation.deliveryFee,
        rider_earning: calculation.riderEarning,
        platform_commission: calculation.platformCommission,
        commission_rate: calculation.commissionRate
      }
    });

    return {
      success: true,
      earning: resultingEarning
    };
  } catch (err: any) {
    console.error('[earningsService] Error recording rider earnings:', err);
    return { success: false, error: err?.message || 'Failed to record rider earnings.' };
  }
}

/**
 * Subscribes to real-time earnings ledger stream for a rider
 */
export function subscribeToRiderEarnings(
  riderId: string,
  callback: (earnings: DeliveryEarning[]) => void
): () => void {
  if (!riderId) return () => {};
  try {
    const q = query(
      collection(db, 'rider_earnings'),
      where('rider_id', '==', riderId),
      orderBy('created_at', 'desc')
    );

    return onSnapshot(
      q,
      (snapshot) => {
        const list: DeliveryEarning[] = [];
        snapshot.forEach((docSnap) => {
          list.push(docSnap.data() as DeliveryEarning);
        });
        callback(list);
      },
      (error) => {
        console.warn('[earningsService] Rider earnings listener warning:', error);
      }
    );
  } catch (err) {
    console.warn('[earningsService] Failed to subscribe to rider earnings:', err);
    return () => {};
  }
}

/**
 * Fetches earning record for a specific order
 */
export async function getRiderEarningsForOrder(orderId: string): Promise<DeliveryEarning | null> {
  try {
    const docSnap = await getDoc(doc(db, 'rider_earnings', `EARN_${orderId}`));
    if (docSnap.exists()) {
      return docSnap.data() as DeliveryEarning;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Computes overall summary statistics for a rider's earnings
 */
export async function getRiderEarningsSummary(riderId: string): Promise<RiderEarningsSummary> {
  const defaultSummary: RiderEarningsSummary = {
    rider_id: riderId,
    available_earnings: 0,
    pending_earnings: 0,
    today_earnings: 0,
    weekly_earnings: 0,
    total_earnings: 0,
    completed_deliveries: 0,
    withdrawable_amount: 0,
    history: []
  };

  try {
    const q = query(
      collection(db, 'rider_earnings'),
      where('rider_id', '==', riderId),
      orderBy('created_at', 'desc')
    );
    const snap = await getDocs(q);

    const history: DeliveryEarning[] = [];
    let total = 0;
    let today = 0;
    let weekly = 0;

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const startOfWeek = new Date();
    startOfWeek.setDate(startOfWeek.getDate() - 7);

    snap.forEach((docSnap) => {
      const earn = docSnap.data() as DeliveryEarning;
      history.push(earn);
      total += earn.rider_earning;

      const createdTime = new Date(earn.created_at).getTime();
      if (createdTime >= startOfToday.getTime()) {
        today += earn.rider_earning;
      }
      if (createdTime >= startOfWeek.getTime()) {
        weekly += earn.rider_earning;
      }
    });

    return {
      rider_id: riderId,
      available_earnings: total,
      pending_earnings: 0,
      today_earnings: today,
      weekly_earnings: weekly,
      total_earnings: total,
      completed_deliveries: history.length,
      withdrawable_amount: total,
      history
    };
  } catch (err) {
    console.warn('[earningsService] Summary calculation warning:', err);
    return defaultSummary;
  }
}

/**
 * Earnings Service Facade
 */
export const earningsService = {
  calculateRiderEarnings,
  recordRiderEarningsOnDelivery,
  subscribeToRiderEarnings,
  getRiderEarningsForOrder,
  getRiderEarningsSummary
};

export default earningsService;

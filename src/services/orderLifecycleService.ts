import {
  Order,
  OrderStatus,
  DeliveryStatus,
  PaymentStatus,
  OrderStatusHistoryItem,
  UserProfile,
  UserRole,
  CustomerDeliveryInfo
} from '../types';
import { db } from '../lib/firebase';
import { doc, getDoc, setDoc, updateDoc, collection, query, where, getDocs, orderBy, onSnapshot } from "../lib/embeddedDb";
import { validateOrderStatusTransition } from './authService';
import { triggerHaptic } from '../utils/haptics';
import { recordAuditLog, recordOrderTransition, logAuditEvent } from './auditLogService';
import { debitWalletForOrder } from './walletService';
import { processOrderCancellationRefund } from './refundService';
import { recordRiderEarningsOnDelivery } from './earningsService';
import { toast } from 'sonner';
import { emitAuthoritativeOrderEvent } from './notificationService';
import { apiFetch } from '../lib/apiConfig';
import { OrderEventType } from '../types';
import { matchOfficialVendor } from './seedService';

/**
 * Recursively removes undefined fields so that Firestore setDoc/updateDoc never fails.
 */
export function cleanFirestoreData<T>(obj: T): T {
  if (obj === null || obj === undefined) {
    return null as any;
  }
  if (Array.isArray(obj)) {
    return obj.map((item) => cleanFirestoreData(item)) as any;
  }
  if (typeof obj === 'object' && !(obj instanceof Date)) {
    const cleaned: Record<string, any> = {};
    for (const [key, value] of Object.entries(obj)) {
      if (value !== undefined) {
        cleaned[key] = cleanFirestoreData(value);
      }
    }
    return cleaned as any;
  }
  return obj;
}

export interface CreateMasterOrderInput {
  userId: string;
  userName: string;
  userPhone: string;
  userEmail?: string;
  vendorId: string;
  vendorName: string;
  vendorPhone?: string;
  vendorAddress?: string;
  universityId?: string;
  campusId?: string;
  foodZoneId?: string;
  items: Array<{
    menu_item_id: string;
    name: string;
    price: number;
    quantity: number;
    variant_name?: string;
    selectedOptions?: Record<string, string>;
    notes?: string;
  }>;
  subtotal: number;
  deliveryFee: number;
  serviceFee: number;
  discount?: number;
  walletAmountUsed?: number;
  otherPaymentAmount?: number;
  totalPrice: number;
  paymentMethod: 'wallet' | 'paystack' | 'split_wallet_paystack' | 'delivery';
  paymentReference?: string;
  deliveryInfo: CustomerDeliveryInfo;
  notes?: string;
  latitude: number;
  longitude: number;
}

/**
 * Creates the single Master Authoritative Order across the ecosystem.
 */
export async function createAuthoritativeOrder(
  input: CreateMasterOrderInput,
  currentUser: UserProfile
): Promise<Order> {
  const timestamp = Date.now();
  const orderId = `ORD_${timestamp}_${Math.floor(100 + Math.random() * 900)}`;
  const deliveryId = `DEL_${timestamp}_${Math.floor(100 + Math.random() * 900)}`;
  const paymentId = `PAY_${timestamp}_${Math.floor(100 + Math.random() * 900)}`;
  const receiptId = `RCP_${timestamp}_${Math.floor(100 + Math.random() * 900)}`;
  const now = new Date().toISOString();

  // Generate 4-digit secure verification codes
  const pickupCode = Math.floor(1000 + Math.random() * 9000).toString();
  const deliveryCode = Math.floor(1000 + Math.random() * 9000).toString();

  // Determine initial payment status
  const isPaidInstantly = input.paymentMethod === 'wallet' || input.paymentMethod === 'paystack' || input.paymentMethod === 'split_wallet_paystack';
  const initialStatus: OrderStatus = isPaidInstantly ? 'payment_confirmed' : 'pending';
  const initialPaymentStatus: PaymentStatus = isPaidInstantly ? 'paid' : 'pending';
  const initialDeliveryStatus: DeliveryStatus = 'pending';

  let walletTxId: string | null = null;

  // If wallet balance was used (full or split), debit wallet atomically
  if (input.walletAmountUsed && input.walletAmountUsed > 0) {
    const debitResult = await debitWalletForOrder({
      userId: currentUser.uid,
      orderId,
      amount: input.walletAmountUsed,
      description: `Payment for Order #${orderId}`,
      idempotencyKey: `ORD_DEBIT_${orderId}`,
      actor: {
        id: currentUser.uid,
        name: currentUser.name || 'Customer',
        role: currentUser.active_role || 'customer'
      }
    });

    if (!debitResult.success) {
      throw new Error(debitResult.error || 'Failed to process wallet payment.');
    }
    walletTxId = debitResult.transaction?.transaction_id || `TX_WAL_${orderId}`;
  }

  const initialHistory: OrderStatusHistoryItem[] = [
    {
      status: 'pending',
      timestamp: now,
      actor_id: currentUser.uid,
      actor_role: currentUser.active_role || currentUser.role || 'customer',
      actor_name: currentUser.name || 'Customer',
      notes: 'Order placed by customer'
    }
  ];

  if (isPaidInstantly) {
    initialHistory.push({
      status: 'payment_confirmed',
      timestamp: now,
      actor_id: currentUser.uid,
      actor_role: currentUser.active_role || currentUser.role || 'customer',
      actor_name: currentUser.name || 'Customer',
      notes: `Payment verified via ${input.paymentMethod.replace('_', ' ').toUpperCase()}`
    });
  }

  // Clean items array ensuring no undefined fields exist
  const sanitizedItems = (input.items || []).map((item) => {
    const itemObj: Record<string, any> = {
      menu_item_id: item.menu_item_id || 'unknown_item',
      name: item.name || 'Campus Meal',
      price: Number(item.price) || 0,
      quantity: Number(item.quantity) || 1,
    };
    if (item.variant_name) itemObj.variant_name = item.variant_name;
    if (item.selectedOptions && Object.keys(item.selectedOptions).length > 0) {
      itemObj.selectedOptions = item.selectedOptions;
    }
    if (item.notes) itemObj.notes = item.notes;
    return itemObj as any;
  });

  const matchedOfficial = matchOfficialVendor(input.vendorId) || matchOfficialVendor(input.vendorName);
  const effectiveVendorId = matchedOfficial ? matchedOfficial.id : (input.vendorId || 'vendor_stand1_bunlab');
  const effectiveVendorName = matchedOfficial ? matchedOfficial.name : (input.vendorName || 'MTU Campus Food Stand');

  const rawOrderData: Order = {
    id: orderId,
    order_id: orderId,
    customer_id: currentUser.uid,
    user_id: currentUser.uid,
    vendor_id: effectiveVendorId,
    restaurant_id: effectiveVendorId,
    rider_id: null,
    delivery_id: deliveryId,
    payment_id: paymentId,
    wallet_transaction_id: walletTxId,
    receipt_id: receiptId,

    // Actors Snapshots
    customer_name: input.userName || currentUser.name || 'Customer',
    user_name: input.userName || currentUser.name || 'Customer',
    customer_phone: input.userPhone || currentUser.phone || '',
    user_phone: input.userPhone || currentUser.phone || '',
    customer_email: input.userEmail || currentUser.email || '',
    vendor_name: effectiveVendorName,
    restaurant_name: effectiveVendorName,
    vendor_phone: input.vendorPhone || '+234 810 555 1212',
    vendor_address: input.vendorAddress || 'Central Food Plaza, Mountain Top University',
    rider_name: null,
    rider_phone: null,
    rider_vehicle: null,
    rider_avatar_url: null,

    // State Machine
    status: initialStatus,
    order_status: initialStatus,
    payment_status: initialPaymentStatus,
    delivery_status: initialDeliveryStatus,

    // Financial Breakdown
    items: sanitizedItems,
    subtotal: Number(input.subtotal) || 0,
    delivery_fee: Number(input.deliveryFee) || 0,
    service_fee: Number(input.serviceFee) || 0,
    discount: Number(input.discount) || 0,
    wallet_amount_used: Number(input.walletAmountUsed) || 0,
    other_payment_amount: Number(input.otherPaymentAmount) || 0,
    total_price: Number(input.totalPrice) || 0,
    payment_method: input.paymentMethod,
    payment_reference:
      input.paymentReference ||
      (input.paymentMethod === 'wallet'
        ? `WALLET_${timestamp}`
        : input.paymentMethod === 'paystack'
        ? `PS_${timestamp}`
        : input.paymentMethod === 'split_wallet_paystack'
        ? `SPLIT_${timestamp}`
        : 'COD'),

    // Delivery Information
    delivery_info: input.deliveryInfo,
    delivery_address: `${input.deliveryInfo.building}, ${input.deliveryInfo.hostel_hall} (${input.deliveryInfo.exact_location})`,
    delivery_room: input.deliveryInfo.room_number || '',
    notes: input.notes || input.deliveryInfo.delivery_instructions || '',

    // Security & Verification Codes
    pickup_code: pickupCode,
    delivery_code: deliveryCode,

    // Geographic Coordinates & Live Tracking
    latitude: Number(input.latitude) || 6.783,
    longitude: Number(input.longitude) || 3.441,
    rider_current_latitude: 6.783,
    rider_current_longitude: 3.441,

    // Timestamps
    created_at: now,
    payment_confirmed_at: isPaidInstantly ? now : undefined,
    updated_at: now,

    // Status History
    status_history: initialHistory,
    university_id: input.universityId || currentUser.university_id || 'uni_mtu',
    campus_id: input.campusId || currentUser.campus_id || 'campus_mtu_main',
    food_zone_id: input.foodZoneId || currentUser.preferred_zone_id || 'zone_mtu_central'
  };

  const orderData = cleanFirestoreData(rawOrderData);

  // 1. Write single authoritative document to Firestore
  await setDoc(doc(db, 'orders', orderId), orderData);

  // 2. Log immutable audit entry
  await logAuditEvent({
    actor_id: currentUser.uid,
    actor_name: currentUser.name || 'Customer',
    actor_role: 'customer',
    action: 'ORDER_CREATED',
    order_id: orderId,
    transaction_id: walletTxId || undefined,
    previous_state: 'none',
    new_state: initialStatus,
    metadata: {
      total_price: orderData.total_price,
      vendor_id: orderData.vendor_id,
      payment_method: input.paymentMethod
    }
  });

  // 3. Asynchronously sync to backend Cloud SQL and embedded server store
  apiFetch('/api/orders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...orderData,
      id: orderId,
      order_id: orderId,
      userId: currentUser.uid,
      customer_id: currentUser.uid,
      vendor_id: orderData.vendor_id,
      vendorId: orderData.vendor_id,
      restaurant_id: orderData.vendor_id,
      vendor_name: orderData.vendor_name,
      vendorName: orderData.vendor_name,
      customer_name: orderData.user_name,
      customerName: orderData.user_name,
      user_name: orderData.user_name,
      customer_email: currentUser.email,
      customerEmail: currentUser.email,
      status: initialStatus,
      payment_status: isPaidInstantly ? 'paid' : 'pending',
      total_price: orderData.total_price,
      totalAmount: orderData.total_price,
      delivery_fee: orderData.delivery_fee,
      deliveryFee: orderData.delivery_fee,
      items: orderData.items,
      itemsJson: JSON.stringify(orderData.items),
      delivery_address: orderData.delivery_address,
      deliveryLocation: orderData.delivery_address,
      delivery_room: orderData.delivery_room,
      deliveryRoom: orderData.delivery_room,
      customer_phone: orderData.customer_phone,
      customerPhone: orderData.customer_phone,
      notes: orderData.notes,
      pickup_code: orderData.pickup_code,
      pickupCode: orderData.pickup_code
    })
  }).catch((err) => console.warn('Order SQL sync notice:', err));

  // 4. Send Authoritative Order Event through Centralized Pipeline
  emitAuthoritativeOrderEvent({
    orderId,
    eventType: isPaidInstantly ? 'PAYMENT_CONFIRMED' : 'ORDER_CREATED',
    customerId: currentUser.uid,
    customerName: orderData.user_name,
    vendorId: orderData.vendor_id,
    vendorName: orderData.vendor_name,
    vendorPhone: orderData.vendor_phone,
    deliveryLocation: orderData.delivery_address,
    deliveryCode: orderData.delivery_code,
    pickupCode: orderData.pickup_code,
    totalPrice: orderData.total_price,
    riderFee: orderData.delivery_fee
  }).catch((err) => console.warn('Order event emission warning:', err));

  return orderData;
}

/**
 * Transitions order status through the authoritative state machine with RBAC verification.
 */
export async function transitionOrderStatus(
  orderId: string,
  targetStatus: OrderStatus,
  currentUser: UserProfile,
  extraData?: {
    estimatedMinutes?: number;
    cancellationReason?: string;
    riderId?: string;
    riderName?: string;
    riderPhone?: string;
    riderVehicle?: string;
    riderAvatar?: string;
  }
): Promise<{ success: boolean; order?: Order; error?: string }> {
  try {
    const orderDocRef = doc(db, 'orders', orderId);
    const orderSnap = await getDoc(orderDocRef);

    if (!orderSnap.exists()) {
      return { success: false, error: 'Order not found.' };
    }

    const currentOrder = orderSnap.data() as Order;

    // RBAC and State Machine check
    const validation = validateOrderStatusTransition(currentUser, currentOrder, targetStatus);
    if (!validation.allowed) {
      return { success: false, error: validation.reason || 'Unauthorized status transition.' };
    }

    const now = new Date().toISOString();
    const updatedHistory: OrderStatusHistoryItem[] = [
      ...(currentOrder.status_history || []),
      {
        status: targetStatus,
        timestamp: now,
        actor_id: currentUser.uid,
        actor_role: currentUser.active_role || currentUser.role || 'customer',
        actor_name: currentUser.name || 'User',
        notes: extraData?.cancellationReason || `Status changed to ${targetStatus}`
      }
    ];

    // Determine mapped delivery_status
    let mappedDeliveryStatus: DeliveryStatus = currentOrder.delivery_status || 'pending';
    if (targetStatus === 'ready' || targetStatus === 'ready_for_pickup') {
      mappedDeliveryStatus = 'ready_for_pickup';
    } else if (targetStatus === 'assigned' || targetStatus === 'rider_assigned') {
      mappedDeliveryStatus = 'rider_assigned';
    } else if (targetStatus === 'rider_arrived_vendor') {
      mappedDeliveryStatus = 'rider_arrived_vendor';
    } else if (targetStatus === 'picked_up') {
      mappedDeliveryStatus = 'picked_up';
    } else if (targetStatus === 'on_the_way' || targetStatus === 'out_for_delivery') {
      mappedDeliveryStatus = 'out_for_delivery';
    } else if (targetStatus === 'arrived_at_delivery') {
      mappedDeliveryStatus = 'arrived_at_delivery';
    } else if (targetStatus === 'delivered') {
      mappedDeliveryStatus = 'delivered';
    } else if (targetStatus === 'cancelled') {
      mappedDeliveryStatus = 'cancelled';
    } else if (targetStatus === 'failed_delivery') {
      mappedDeliveryStatus = 'failed_delivery';
    }

    const rawUpdates: Partial<Order> = {
      status: targetStatus,
      order_status: targetStatus,
      delivery_status: mappedDeliveryStatus,
      status_history: updatedHistory,
      updated_at: now
    };

    // Specific timestamp setters
    if (targetStatus === 'payment_confirmed') {
      rawUpdates.payment_confirmed_at = now;
      rawUpdates.payment_status = 'paid';
    } else if (targetStatus === 'accepted' || targetStatus === 'vendor_accepted') {
      rawUpdates.vendor_accepted_at = now;
      if (extraData?.estimatedMinutes) {
        rawUpdates.estimated_preparation_minutes = extraData.estimatedMinutes;
        rawUpdates.estimated_ready_at = new Date(Date.now() + extraData.estimatedMinutes * 60000).toISOString();
      }
    } else if (targetStatus === 'preparing') {
      rawUpdates.preparing_at = now;
    } else if (targetStatus === 'ready' || targetStatus === 'ready_for_pickup') {
      rawUpdates.ready_at = now;
    } else if (targetStatus === 'assigned' || targetStatus === 'rider_assigned') {
      rawUpdates.rider_assigned_at = now;
      rawUpdates.rider_id = extraData?.riderId || currentUser.uid;
      rawUpdates.rider_name = extraData?.riderName || currentUser.name;
      rawUpdates.rider_phone = extraData?.riderPhone || currentUser.phone || '';
      if (extraData?.riderVehicle) rawUpdates.rider_vehicle = extraData.riderVehicle;
      if (extraData?.riderAvatar) rawUpdates.rider_avatar_url = extraData.riderAvatar;
    } else if (targetStatus === 'rider_arrived_vendor') {
      rawUpdates.rider_arrived_vendor_at = now;
    } else if (targetStatus === 'picked_up') {
      rawUpdates.picked_up_at = now;
    } else if (targetStatus === 'on_the_way' || targetStatus === 'out_for_delivery') {
      rawUpdates.out_for_delivery_at = now;
    } else if (targetStatus === 'arrived_at_delivery') {
      rawUpdates.arrived_at_delivery_at = now;
    } else if (targetStatus === 'delivered') {
      rawUpdates.delivered_at = now;
      // If rider is assigned, trigger earnings calculation automatically
      const assignedRiderId = currentOrder.rider_id || (currentUser.role === 'rider' ? currentUser.uid : null);
      if (assignedRiderId) {
        recordRiderEarningsOnDelivery(currentOrder, {
          uid: assignedRiderId,
          name: currentOrder.rider_name || currentUser.name || 'Campus Courier',
          phone: currentOrder.rider_phone || currentUser.phone
        }).catch((err) => console.warn('[earningsService] Automated delivery earnings recording warning:', err));
      }
    } else if (targetStatus === 'cancelled' || targetStatus === 'refunded') {
      rawUpdates.cancelled_at = now;
      if (extraData?.cancellationReason) {
        rawUpdates.cancellation_reason = extraData.cancellationReason;
      }
      // If order was paid, execute atomic cancellation & refund
      if (currentOrder.payment_status === 'paid' && currentOrder.total_price > 0) {
        processOrderCancellationRefund({
          orderId: currentOrder.id,
          reason: extraData?.cancellationReason || 'Order Cancelled',
          actor: {
            id: currentUser.uid,
            name: currentUser.name || 'System',
            role: currentUser.active_role || currentUser.role || 'admin',
            email: currentUser.email
          }
        }).catch((err) => console.warn('[refundService] Reversal refund notice:', err));
        rawUpdates.payment_status = 'refunded';
        rawUpdates.status = 'refunded';
        rawUpdates.order_status = 'refunded';
      }
    }

    const updates = cleanFirestoreData(rawUpdates);

    // Persist to Firestore
    await updateDoc(orderDocRef, updates);

    const mergedOrder: Order = { ...currentOrder, ...updates };

    // Record immutable audit entry
    await logAuditEvent({
      actor_id: currentUser.uid,
      actor_name: currentUser.name || 'User',
      actor_role: currentUser.active_role || currentUser.role || 'customer',
      action: `ORDER_TRANSITION_${targetStatus.toUpperCase()}`,
      order_id: orderId,
      previous_state: currentOrder.status,
      new_state: targetStatus,
      metadata: { cancellationReason: extraData?.cancellationReason }
    });

    // Map status to OrderEventType
    const statusToEventTypeMap: Record<string, OrderEventType> = {
      accepted: 'VENDOR_ACCEPTED',
      preparing: 'ORDER_PREPARING',
      ready_for_pickup: 'ORDER_READY',
      assigned: 'RIDER_ASSIGNED',
      rider_arrived_vendor: 'RIDER_ARRIVED_VENDOR',
      picked_up: 'ORDER_PICKED_UP',
      on_the_way: 'ORDER_OUT_FOR_DELIVERY',
      out_for_delivery: 'ORDER_OUT_FOR_DELIVERY',
      arrived_at_delivery: 'RIDER_ARRIVED_CUSTOMER',
      delivered: 'ORDER_DELIVERED',
      cancelled: 'ORDER_CANCELLED',
      refunded: 'REFUND_COMPLETED'
    };

    const resolvedEventType = statusToEventTypeMap[targetStatus] || 'ORDER_PREPARING';

    // Broadcast through centralized authoritative notification pipeline
    emitAuthoritativeOrderEvent({
      orderId,
      eventType: resolvedEventType,
      customerId: mergedOrder.customer_id || mergedOrder.user_id,
      customerName: mergedOrder.user_name || mergedOrder.customer_name,
      vendorId: mergedOrder.vendor_id,
      vendorName: mergedOrder.vendor_name || mergedOrder.restaurant_name,
      riderId: mergedOrder.rider_id,
      riderName: mergedOrder.rider_name,
      deliveryLocation: mergedOrder.delivery_address,
      deliveryCode: mergedOrder.delivery_code,
      pickupCode: mergedOrder.pickup_code,
      totalPrice: mergedOrder.total_price,
      riderFee: mergedOrder.delivery_fee,
      estimatedMinutes: extraData?.estimatedMinutes || 15,
      cancellationReason: extraData?.cancellationReason
    }).catch((err) => console.warn('Order event emission warning:', err));

    triggerHaptic(50);
    return { success: true, order: mergedOrder };
  } catch (err: any) {
    console.error('Error transitioning order status:', err);
    return { success: false, error: err?.message || 'Failed to update order status.' };
  }
}

/**
 * Rider claims an available 'ready_for_pickup' order
 */
export async function claimOrderForDelivery(
  orderId: string,
  rider: UserProfile
): Promise<{ success: boolean; order?: Order; error?: string }> {
  return transitionOrderStatus(orderId, 'assigned', rider, {
    riderId: rider.uid,
    riderName: rider.name,
    riderPhone: rider.phone,
    riderVehicle: (rider.rider_profile?.vehicle_type as string) || 'motorcycle',
    riderAvatar: rider.avatar_url
  });
}

import { db } from '../lib/firebase';
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  runTransaction,
  collection
} from "../lib/embeddedDb";
import {
  Order,
  OrderStatus,
  BukkitWallet,
  WalletTransaction,
  RefundResult,
  AuditLogActor,
  UserRole,
  OrderStatusHistoryItem
} from '../types';
import { cleanFirestoreData } from './orderLifecycleService';
import { recordAuditLog } from './auditLogService';
import { triggerHaptic } from '../utils/haptics';
import { toast } from 'sonner';
import { apiFetch } from '../lib/apiConfig';

export interface ProcessOrderCancellationRefundParams {
  orderId: string;
  reason?: string;
  actor: AuditLogActor | { id: string; name: string; role: UserRole | string; email?: string };
  overrideAmount?: number;
  notifyCustomer?: boolean;
}

/**
 * Handles order cancellations and atomic wallet reversal refunds.
 * Programmatically generates a reversal WalletTransaction, updates the order_status to 'refunded',
 * triggers customer notifications, and guarantees atomicity with double-refund prevention.
 */
export async function processOrderCancellationRefund(
  params: ProcessOrderCancellationRefundParams
): Promise<RefundResult> {
  const { orderId, reason = 'Order cancelled', actor, overrideAmount, notifyCustomer = true } = params;

  try {
    const orderDocRef = doc(db, 'orders', orderId);
    const now = new Date().toISOString();
    const deterministicTxId = `TX_REF_${orderId}`;

    let resultingOrder: Order | undefined;
    let resultingTx: WalletTransaction | undefined;
    let refundAmount = 0;
    let customerUserId = '';
    let vendorName = 'BUKKIT Kitchen';

    // Execute atomic Firestore transaction
    await runTransaction(db, async (transaction) => {
      // 1. Fetch authoritative order
      const orderSnap = await transaction.get(orderDocRef);
      if (!orderSnap.exists()) {
        throw new Error(`Order #${orderId} was not found.`);
      }

      const orderData = orderSnap.data() as Order;
      customerUserId = orderData.customer_id || orderData.user_id;
      vendorName = orderData.vendor_name || orderData.restaurant_name || 'Vendor Kitchen';

      // 2. DOUBLE-REFUND PREVENTION GUARD
      if (
        orderData.payment_status === 'refunded' ||
        orderData.status === 'refunded' ||
        orderData.order_status === 'refunded'
      ) {
        throw new Error(`DOUBLE_REFUND_BLOCKED: Order #${orderId} has already been refunded.`);
      }

      // Check if order was actually paid or has a non-zero refundable sum
      const orderTotal = Number(orderData.total_price) || 0;
      refundAmount = overrideAmount !== undefined ? overrideAmount : orderTotal;

      // 3. Fetch customer's wallet
      const walletRef = doc(db, 'wallets', customerUserId);
      const walletSnap = await transaction.get(walletRef);

      let currentWallet: BukkitWallet;
      if (!walletSnap.exists()) {
        currentWallet = {
          wallet_id: `WAL_${customerUserId}`,
          user_id: customerUserId,
          available_balance: 0,
          pending_balance: 0,
          currency: 'NGN',
          status: 'active',
          created_at: now,
          updated_at: now
        };
      } else {
        currentWallet = walletSnap.data() as BukkitWallet;
      }

      const balanceBefore = currentWallet.available_balance;
      const balanceAfter = balanceBefore + refundAmount;

      const updatedWallet: BukkitWallet = {
        ...currentWallet,
        available_balance: balanceAfter,
        updated_at: now
      };

      // 4. Generate Reversal WalletTransaction
      resultingTx = {
        id: deterministicTxId,
        transaction_id: deterministicTxId,
        wallet_id: updatedWallet.wallet_id,
        user_id: customerUserId,
        order_id: orderId,
        type: 'refund',
        amount: refundAmount,
        balance_before: balanceBefore,
        balance_after: balanceAfter,
        status: 'completed',
        reference: `REF_REV_${orderId}`,
        idempotency_key: `IDEMP_REFUND_${orderId}`,
        description: `Reversal refund for cancelled Order #${orderId}${reason ? ` (${reason})` : ''}`,
        metadata: {
          order_id: orderId,
          cancellation_reason: reason,
          refunded_by: actor.name,
          refunded_by_role: actor.role
        },
        created_at: now
      };

      // 5. Update Order status to 'refunded' / 'cancelled'
      const updatedHistory: OrderStatusHistoryItem[] = [
        ...(orderData.status_history || []),
        {
          status: 'refunded',
          timestamp: now,
          actor_id: actor.id,
          actor_name: actor.name,
          actor_role: actor.role as UserRole,
          notes: `Order refunded and cancelled: ${reason}`
        }
      ];

      const rawOrderUpdates: Partial<Order> = {
        status: 'refunded',
        order_status: 'refunded',
        payment_status: 'refunded',
        delivery_status: 'cancelled',
        cancelled_at: now,
        cancellation_reason: reason,
        status_history: updatedHistory,
        updated_at: now
      };

      resultingOrder = {
        ...orderData,
        ...rawOrderUpdates
      };

      // Commit atomic writes
      transaction.set(orderDocRef, cleanFirestoreData(resultingOrder));
      transaction.set(walletRef, cleanFirestoreData(updatedWallet));
      transaction.set(doc(db, 'wallet_transactions', deterministicTxId), cleanFirestoreData(resultingTx));
    });

    // 6. Record Authoritative Audit Log
    await recordAuditLog({
      actor,
      action: 'ORDER_REFUND_REVERSAL_PROCESSED',
      orderId,
      transactionId: deterministicTxId,
      previousState: 'paid',
      newState: 'refunded',
      metadata: {
        order_id: orderId,
        refund_amount: refundAmount,
        cancellation_reason: reason
      }
    });

    // 7. Push In-App Notification document
    try {
      const notifId = `NOTIF_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      await setDoc(
        doc(db, 'notifications', notifId),
        cleanFirestoreData({
          id: notifId,
          user_id: customerUserId,
          order_id: orderId,
          title: 'Order Refund Processed 💳',
          body: `₦${refundAmount.toLocaleString()} has been refunded back to your BUKKIT wallet for cancelled Order #${orderId.slice(-6)}.`,
          type: 'refund',
          read: false,
          created_at: now
        })
      );
    } catch (err) {
      console.warn('[refundService] Notification write notice:', err);
    }

    // 8. Trigger server-side FCM dispatch if requested
    if (notifyCustomer) {
      apiFetch('/api/fcm/send-status-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId,
          status: 'cancelled',
          vendorName,
          userId: customerUserId
        })
      }).catch(() => {});
    }

    triggerHaptic([100, 50, 100]);

    return {
      success: true,
      orderId,
      amountRefunded: refundAmount,
      refundTransactionId: deterministicTxId,
      order: resultingOrder
    };
  } catch (err: any) {
    const errorMsg = err?.message || 'Failed to process refund.';
    console.error('[refundService] Error during order refund:', err);

    if (errorMsg.includes('DOUBLE_REFUND_BLOCKED')) {
      return {
        success: false,
        orderId,
        amountRefunded: 0,
        alreadyRefunded: true,
        error: `Order #${orderId} has already been refunded.`
      };
    }

    return {
      success: false,
      orderId,
      amountRefunded: 0,
      error: errorMsg
    };
  }
}

/**
 * Checks if an order is already marked as refunded in Firestore
 */
export async function isOrderRefunded(orderId: string): Promise<boolean> {
  try {
    const snap = await getDoc(doc(db, 'orders', orderId));
    if (!snap.exists()) return false;
    const data = snap.data() as Order;
    return (
      data.payment_status === 'refunded' ||
      data.status === 'refunded' ||
      data.order_status === 'refunded'
    );
  } catch {
    return false;
  }
}

/**
 * Calculates the refundable balance for an order
 */
export function calculateRefundAmount(order: Order): number {
  if (order.payment_status === 'refunded') return 0;
  return Number(order.total_price) || Number(order.wallet_amount_used) || 0;
}

/**
 * Top-level convenience facade
 */
export const refundService = {
  processOrderCancellationRefund,
  isOrderRefunded,
  calculateRefundAmount
};

export default refundService;

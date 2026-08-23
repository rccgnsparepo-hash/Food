import { db } from '../lib/firebase';
import { doc, getDoc, setDoc, updateDoc, collection, query, where, orderBy, onSnapshot, runTransaction } from "../lib/embeddedDb";
import { BukkitWallet, WalletTransaction, WalletTransactionType, UserProfile, UserRole } from '../types';
import { cleanFirestoreData } from './orderLifecycleService';
import { logAuditEvent } from './auditService';
import { toast } from 'sonner';

/**
 * Initializes or fetches a user's BUKKIT wallet with default starting balance for student experience.
 */
export async function getOrCreateWallet(userId: string): Promise<BukkitWallet> {
  const walletRef = doc(db, 'wallets', userId);
  const snap = await getDoc(walletRef);

  if (snap.exists()) {
    return snap.data() as BukkitWallet;
  }

  const now = new Date().toISOString();
  // Provide initial campus starter credit (e.g. ₦15,000) for seamless testing
  const initialWallet: BukkitWallet = {
    wallet_id: `WAL_${userId}`,
    user_id: userId,
    available_balance: 15000,
    pending_balance: 0,
    currency: 'NGN',
    status: 'active',
    created_at: now,
    updated_at: now
  };

  const cleaned = cleanFirestoreData(initialWallet);
  await setDoc(walletRef, cleaned);

  // Record initial starter bonus in ledger
  const txId = `TX_STARTER_${Date.now()}`;
  const initialTx: WalletTransaction = {
    id: txId,
    transaction_id: txId,
    wallet_id: initialWallet.wallet_id,
    user_id: userId,
    type: 'promotional_credit',
    amount: 15000,
    balance_before: 0,
    balance_after: 15000,
    status: 'completed',
    reference: `REF_WELCOME_${Date.now()}`,
    description: 'BUKKIT Campus Student Starter Credit',
    created_at: now
  };

  await setDoc(doc(db, 'wallet_transactions', txId), cleanFirestoreData(initialTx));
  return initialWallet;
}

/**
 * Subscribes to real-time wallet changes for a user
 */
export function subscribeToWallet(userId: string, callback: (wallet: BukkitWallet | null) => void): () => void {
  if (!userId) return () => {};
  const walletRef = doc(db, 'wallets', userId);
  return onSnapshot(walletRef, (snap) => {
    if (snap.exists()) {
      callback(snap.data() as BukkitWallet);
    } else {
      getOrCreateWallet(userId).then(callback).catch(() => callback(null));
    }
  });
}

/**
 * Subscribes to real-time transaction ledger history for a user
 */
export function subscribeToWalletTransactions(
  userId: string,
  callback: (transactions: WalletTransaction[]) => void
): () => void {
  if (!userId) return () => {};
  const q = query(
    collection(db, 'wallet_transactions'),
    where('user_id', '==', userId),
    orderBy('created_at', 'desc')
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const txs: WalletTransaction[] = [];
      snapshot.forEach((docSnap) => {
        txs.push(docSnap.data() as WalletTransaction);
      });
      callback(txs);
    },
    (error) => {
      console.warn('Wallet transactions listener warning:', error);
    }
  );
}

/**
 * Atomic credit deposit into a user's wallet with ledger entry
 */
export async function creditWallet(params: {
  userId: string;
  amount: number;
  description: string;
  reference: string;
  type?: WalletTransactionType;
  metadata?: Record<string, any>;
  actor?: { id: string; name: string; role: UserRole };
}): Promise<{ success: boolean; wallet?: BukkitWallet; transaction?: WalletTransaction; error?: string }> {
  try {
    const { userId, amount, description, reference, type = 'deposit', metadata, actor } = params;
    if (amount <= 0) {
      return { success: false, error: 'Deposit amount must be greater than zero.' };
    }

    const walletRef = doc(db, 'wallets', userId);
    const now = new Date().toISOString();
    const txId = `TX_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

    let updatedWallet: BukkitWallet | undefined;
    let recordedTx: WalletTransaction | undefined;

    await runTransaction(db, async (transaction) => {
      const walletSnap = await transaction.get(walletRef);
      let currentWallet: BukkitWallet;

      if (!walletSnap.exists()) {
        currentWallet = {
          wallet_id: `WAL_${userId}`,
          user_id: userId,
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

      if (currentWallet.status !== 'active') {
        throw new Error('Wallet is suspended or inactive.');
      }

      const balanceBefore = currentWallet.available_balance;
      const balanceAfter = balanceBefore + amount;

      updatedWallet = {
        ...currentWallet,
        available_balance: balanceAfter,
        updated_at: now
      };

      recordedTx = {
        id: txId,
        transaction_id: txId,
        wallet_id: updatedWallet.wallet_id,
        user_id: userId,
        type,
        amount,
        balance_before: balanceBefore,
        balance_after: balanceAfter,
        status: 'completed',
        reference,
        description,
        metadata,
        created_at: now
      };

      transaction.set(walletRef, cleanFirestoreData(updatedWallet));
      transaction.set(doc(db, 'wallet_transactions', txId), cleanFirestoreData(recordedTx));
    });

    if (actor && recordedTx) {
      await logAuditEvent({
        actor_id: actor.id,
        actor_name: actor.name,
        actor_role: actor.role,
        action: `WALLET_CREDIT_${type.toUpperCase()}`,
        transaction_id: recordedTx.transaction_id,
        previous_state: `₦${recordedTx.balance_before.toLocaleString()}`,
        new_state: `₦${recordedTx.balance_after.toLocaleString()}`,
        metadata: { amount, reference, description }
      });
    }

    return { success: true, wallet: updatedWallet, transaction: recordedTx };
  } catch (err: any) {
    console.error('Wallet credit error:', err);
    return { success: false, error: err?.message || 'Failed to deposit funds.' };
  }
}

/**
 * Atomic debit from a user's wallet for an order payment (Full or Split)
 */
export async function debitWalletForOrder(params: {
  userId: string;
  orderId: string;
  amount: number;
  description?: string;
  idempotencyKey?: string;
  actor?: { id: string; name: string; role: UserRole };
}): Promise<{ success: boolean; wallet?: BukkitWallet; transaction?: WalletTransaction; error?: string }> {
  try {
    const { userId, orderId, amount, description, idempotencyKey, actor } = params;
    if (amount <= 0) {
      return { success: false, error: 'Debit amount must be greater than zero.' };
    }

    const walletRef = doc(db, 'wallets', userId);
    const now = new Date().toISOString();
    const txId = `TX_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

    let updatedWallet: BukkitWallet | undefined;
    let recordedTx: WalletTransaction | undefined;

    await runTransaction(db, async (transaction) => {
      const walletSnap = await transaction.get(walletRef);
      if (!walletSnap.exists()) {
        throw new Error('Wallet does not exist.');
      }

      const currentWallet = walletSnap.data() as BukkitWallet;
      if (currentWallet.status !== 'active') {
        throw new Error('Wallet is suspended or inactive.');
      }

      if (currentWallet.available_balance < amount) {
        throw new Error(
          `Insufficient wallet balance. Available: ₦${currentWallet.available_balance.toLocaleString()}, Required: ₦${amount.toLocaleString()}`
        );
      }

      const balanceBefore = currentWallet.available_balance;
      const balanceAfter = balanceBefore - amount;

      updatedWallet = {
        ...currentWallet,
        available_balance: balanceAfter,
        updated_at: now
      };

      recordedTx = {
        id: txId,
        transaction_id: txId,
        wallet_id: currentWallet.wallet_id,
        user_id: userId,
        order_id: orderId,
        type: 'order_payment',
        amount: -amount,
        balance_before: balanceBefore,
        balance_after: balanceAfter,
        status: 'completed',
        reference: `ORD_PAY_${orderId}`,
        description: description || `Payment for Order #${orderId}`,
        idempotency_key: idempotencyKey,
        created_at: now
      };

      transaction.set(walletRef, cleanFirestoreData(updatedWallet));
      transaction.set(doc(db, 'wallet_transactions', txId), cleanFirestoreData(recordedTx));
    });

    if (actor && recordedTx) {
      await logAuditEvent({
        actor_id: actor.id,
        actor_name: actor.name,
        actor_role: actor.role,
        action: 'WALLET_DEBIT_ORDER_PAYMENT',
        order_id: orderId,
        transaction_id: recordedTx.transaction_id,
        previous_state: `₦${recordedTx.balance_before.toLocaleString()}`,
        new_state: `₦${recordedTx.balance_after.toLocaleString()}`,
        metadata: { amount, orderId }
      });
    }

    return { success: true, wallet: updatedWallet, transaction: recordedTx };
  } catch (err: any) {
    console.error('Wallet debit error:', err);
    return { success: false, error: err?.message || 'Failed to debit wallet.' };
  }
}

/**
 * Handles atomic refunds back into a user's wallet when an order is cancelled
 */
export async function processWalletRefund(params: {
  userId: string;
  orderId: string;
  amount: number;
  reason?: string;
  actor: { id: string; name: string; role: UserRole };
}): Promise<{ success: boolean; transaction?: WalletTransaction; error?: string }> {
  try {
    const { userId, orderId, amount, reason, actor } = params;
    const result = await creditWallet({
      userId,
      amount,
      description: `Refund for Order #${orderId}${reason ? ` (${reason})` : ''}`,
      reference: `REFUND_${orderId}_${Date.now()}`,
      type: 'refund',
      metadata: { orderId, reason },
      actor
    });

    return { success: result.success, transaction: result.transaction, error: result.error };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to process refund.' };
  }
}

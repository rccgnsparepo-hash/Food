import { db } from '../lib/firebase';
import {
  doc,
  setDoc,
  collection,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  getDocs
} from "../lib/embeddedDb";
import { AuditLog, AuditLogActor, UserRole, OrderStatus, WalletTransactionType } from '../types';
import { cleanFirestoreData } from './orderLifecycleService';

export interface RecordAuditLogParams {
  actor: AuditLogActor | { id: string; name: string; role: UserRole | string; email?: string };
  action: string;
  orderId?: string;
  order_id?: string;
  transactionId?: string;
  transaction_id?: string;
  previousState?: string;
  previous_state?: string;
  newState?: string;
  new_state?: string;
  metadata?: Record<string, any>;
}

export interface LegacyAuditLogParams {
  actor_id: string;
  actor_name: string;
  actor_role: UserRole | string;
  action: string;
  order_id?: string;
  transaction_id?: string;
  previous_state?: string;
  new_state?: string;
  metadata?: Record<string, any>;
}

/**
 * Authoritative Centralized Audit Logger
 * Records critical system state changes such as order transitions,
 * wallet movements, and administrative adjustments in the Firestore AuditLog collection.
 */
export async function recordAuditLog(
  params: RecordAuditLogParams | LegacyAuditLogParams
): Promise<AuditLog> {
  const logId = `AUDIT_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const timestamp = new Date().toISOString();

  let actorId: string;
  let actorName: string;
  let actorRole: UserRole | string;
  let actorObj: AuditLogActor;

  if ('actor' in params && params.actor) {
    actorId = params.actor.id || 'system';
    actorName = params.actor.name || 'System';
    actorRole = params.actor.role || 'admin';
    actorObj = {
      id: actorId,
      name: actorName,
      role: actorRole,
      email: (params.actor as any).email
    };
  } else {
    const legacy = params as LegacyAuditLogParams;
    actorId = legacy.actor_id || 'system';
    actorName = legacy.actor_name || 'System';
    actorRole = legacy.actor_role || 'admin';
    actorObj = { id: actorId, name: actorName, role: actorRole };
  }

  const orderId = (params as RecordAuditLogParams).orderId || params.order_id;
  const transactionId = (params as RecordAuditLogParams).transactionId || params.transaction_id;
  const previousState = (params as RecordAuditLogParams).previousState || params.previous_state || 'none';
  const newState = (params as RecordAuditLogParams).newState || params.new_state || 'none';

  const auditEntry: AuditLog = {
    id: logId,
    actor_id: actorId,
    actor_name: actorName,
    actor_role: actorRole,
    actor: actorObj,
    action: params.action,
    order_id: orderId,
    orderId: orderId,
    transaction_id: transactionId,
    transactionId: transactionId,
    previous_state: previousState,
    previousState: previousState,
    new_state: newState,
    newState: newState,
    metadata: params.metadata || {},
    timestamp
  };

  try {
    const cleaned = cleanFirestoreData(auditEntry);
    // Write to audit_logs collection
    await setDoc(doc(db, 'audit_logs', logId), cleaned);
  } catch (err) {
    console.warn('[auditLogService] Audit log write notice:', err);
  }

  return auditEntry;
}

/**
 * Backward-compatible alias for logAuditEvent
 */
export async function logAuditEvent(
  entry: LegacyAuditLogParams | RecordAuditLogParams
): Promise<AuditLog> {
  return recordAuditLog(entry);
}

/**
 * Dedicated helper to record Order Lifecycle status transitions
 */
export async function recordOrderTransition(params: {
  orderId: string;
  previousStatus: OrderStatus | string;
  newStatus: OrderStatus | string;
  actor: AuditLogActor;
  metadata?: Record<string, any>;
}): Promise<AuditLog> {
  return recordAuditLog({
    actor: params.actor,
    action: `ORDER_TRANSITION_${String(params.newStatus).toUpperCase()}`,
    orderId: params.orderId,
    previousState: String(params.previousStatus),
    newState: String(params.newStatus),
    metadata: params.metadata
  });
}

/**
 * Dedicated helper to record Wallet ledger movements
 */
export async function recordWalletMovement(params: {
  walletId: string;
  userId: string;
  transactionId: string;
  type: WalletTransactionType | string;
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  orderId?: string;
  actor: AuditLogActor;
  metadata?: Record<string, any>;
}): Promise<AuditLog> {
  return recordAuditLog({
    actor: params.actor,
    action: `WALLET_${String(params.type).toUpperCase()}`,
    orderId: params.orderId,
    transactionId: params.transactionId,
    previousState: `₦${params.balanceBefore.toLocaleString()}`,
    newState: `₦${params.balanceAfter.toLocaleString()}`,
    metadata: {
      wallet_id: params.walletId,
      user_id: params.userId,
      amount: params.amount,
      ...params.metadata
    }
  });
}

/**
 * Dedicated helper to record Administrative adjustments and overrides
 */
export async function recordAdminAdjustment(params: {
  action: string;
  targetEntity: string;
  targetId: string;
  previousValue?: any;
  newValue?: any;
  actor: AuditLogActor;
  reason?: string;
  metadata?: Record<string, any>;
}): Promise<AuditLog> {
  return recordAuditLog({
    actor: params.actor,
    action: `ADMIN_${params.action.toUpperCase()}`,
    previousState: params.previousValue ? JSON.stringify(params.previousValue) : 'none',
    newState: params.newValue ? JSON.stringify(params.newValue) : 'updated',
    metadata: {
      target_entity: params.targetEntity,
      target_id: params.targetId,
      reason: params.reason,
      ...params.metadata
    }
  });
}

/**
 * Subscribes to live AuditLog stream in real-time
 */
export function subscribeToAuditLogs(
  callback: (logs: AuditLog[]) => void,
  options?: { limitCount?: number; orderId?: string }
): () => void {
  try {
    const limitCount = options?.limitCount || 100;
    let q = query(collection(db, 'audit_logs'), orderBy('timestamp', 'desc'), limit(limitCount));

    if (options?.orderId) {
      q = query(
        collection(db, 'audit_logs'),
        where('order_id', '==', options.orderId),
        orderBy('timestamp', 'desc'),
        limit(limitCount)
      );
    }

    return onSnapshot(
      q,
      (snapshot) => {
        const logs: AuditLog[] = [];
        snapshot.forEach((docSnap) => {
          logs.push(docSnap.data() as AuditLog);
        });
        callback(logs);
      },
      (error) => {
        console.warn('[auditLogService] Audit logs snapshot warning:', error);
      }
    );
  } catch (err) {
    console.warn('[auditLogService] Error subscribing to audit logs:', err);
    return () => {};
  }
}

/**
 * Fetches historical Audit Logs for a specific Order ID
 */
export async function getAuditLogsForOrder(orderId: string): Promise<AuditLog[]> {
  try {
    const q = query(
      collection(db, 'audit_logs'),
      where('order_id', '==', orderId),
      orderBy('timestamp', 'asc')
    );
    const snap = await getDocs(q);
    const logs: AuditLog[] = [];
    snap.forEach((docSnap) => {
      logs.push(docSnap.data() as AuditLog);
    });
    return logs;
  } catch (err) {
    console.warn('[auditLogService] getAuditLogsForOrder warning:', err);
    return [];
  }
}

/**
 * Object-oriented service facade
 */
export const auditLogService = {
  recordAuditLog,
  logAuditEvent,
  recordOrderTransition,
  recordWalletMovement,
  recordAdminAdjustment,
  subscribeToAuditLogs,
  getAuditLogsForOrder
};

export default auditLogService;

import { db } from '../lib/firebase';
import { doc, setDoc, collection, query, orderBy, limit, onSnapshot, getDocs } from 'firebase/firestore';
import { AuditLogEntry, UserRole } from '../types';
import { cleanFirestoreData } from './orderLifecycleService';

/**
 * Authoritative Centralized Audit Logger
 * Records all financial, order status, rider assignment, and administrative events immutably.
 */
export async function logAuditEvent(entry: {
  actor_id: string;
  actor_name: string;
  actor_role: UserRole;
  action: string;
  order_id?: string;
  transaction_id?: string;
  previous_state?: string;
  new_state?: string;
  metadata?: Record<string, any>;
}): Promise<AuditLogEntry> {
  const logId = `AUDIT_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const timestamp = new Date().toISOString();

  const auditEntry: AuditLogEntry = {
    id: logId,
    actor_id: entry.actor_id,
    actor_name: entry.actor_name,
    actor_role: entry.actor_role,
    action: entry.action,
    order_id: entry.order_id,
    transaction_id: entry.transaction_id,
    previous_state: entry.previous_state,
    new_state: entry.new_state,
    metadata: entry.metadata,
    timestamp
  };

  try {
    const cleaned = cleanFirestoreData(auditEntry);
    await setDoc(doc(db, 'audit_logs', logId), cleaned);
  } catch (err) {
    console.warn('Audit log write notice:', err);
  }

  return auditEntry;
}

/**
 * Subscribes to live audit logs for the Admin Dashboard
 */
export function subscribeToAuditLogs(callback: (logs: AuditLogEntry[]) => void): () => void {
  try {
    const q = query(collection(db, 'audit_logs'), orderBy('timestamp', 'desc'), limit(50));
    return onSnapshot(
      q,
      (snapshot) => {
        const logs: AuditLogEntry[] = [];
        snapshot.forEach((docSnap) => {
          logs.push(docSnap.data() as AuditLogEntry);
        });
        callback(logs);
      },
      (error) => {
        console.warn('Audit logs snapshot listener warning:', error);
      }
    );
  } catch (err) {
    console.warn('Error subscribing to audit logs:', err);
    return () => {};
  }
}

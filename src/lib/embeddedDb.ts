/**
 * Authoritative Unified Firestore Engine
 * Provides direct, real-time access to the central Google Cloud Firestore database (bukkit-61aef)
 * with robust undefined-sanitization and offline tolerance across Web and Desktop EXE.
 */

import {
  doc as firestoreDoc,
  getDoc as firestoreGetDoc,
  setDoc as firestoreSetDoc,
  updateDoc as firestoreUpdateDoc,
  deleteDoc as firestoreDeleteDoc,
  collection as firestoreCollection,
  addDoc as firestoreAddDoc,
  query as firestoreQuery,
  where as firestoreWhere,
  orderBy as firestoreOrderBy,
  limit as firestoreLimit,
  getDocs as firestoreGetDocs,
  onSnapshot as firestoreOnSnapshot,
  runTransaction as firestoreRunTransaction,
  serverTimestamp as firestoreServerTimestamp,
  increment as firestoreIncrement,
  arrayUnion as firestoreArrayUnion,
  arrayRemove as firestoreArrayRemove,
  Timestamp,
  DocumentReference,
  CollectionReference,
  Query,
  SetOptions,
  UpdateData,
  Firestore,
  QueryConstraint
} from 'firebase/firestore';
import { db, cleanFirestoreData } from './firebase';

export {
  Timestamp,
  cleanFirestoreData
};

export type { DocumentReference, CollectionReference, Query, SetOptions, UpdateData };

/**
 * Standard doc reference generator ensuring valid Firestore instance
 */
export function doc(
  dbOrColOrPath: any,
  ...pathSegments: string[]
): DocumentReference {
  if (!dbOrColOrPath) {
    if (pathSegments.length >= 2) {
      return (firestoreDoc as any)(db, pathSegments[0], ...pathSegments.slice(1));
    }
    return (firestoreDoc as any)(db, pathSegments[0] || 'default');
  }
  if (typeof dbOrColOrPath === 'string') {
    return (firestoreDoc as any)(db, dbOrColOrPath, ...pathSegments);
  }
  if (dbOrColOrPath.firestore || (dbOrColOrPath.type === 'firestore' || typeof dbOrColOrPath.app !== 'undefined')) {
    return (firestoreDoc as any)(dbOrColOrPath as Firestore, pathSegments[0], ...pathSegments.slice(1));
  }
  return (firestoreDoc as any)(dbOrColOrPath, ...pathSegments);
}

/**
 * Standard collection reference generator ensuring valid Firestore instance
 */
export function collection(
  dbOrPath: any,
  ...pathSegments: string[]
): CollectionReference {
  if (!dbOrPath) {
    return (firestoreCollection as any)(db, pathSegments[0], ...pathSegments.slice(1));
  }
  if (typeof dbOrPath === 'string') {
    return (firestoreCollection as any)(db, dbOrPath, ...pathSegments);
  }
  if (dbOrPath.firestore || (dbOrPath.type === 'firestore' || typeof dbOrPath.app !== 'undefined')) {
    return (firestoreCollection as any)(dbOrPath as Firestore, pathSegments[0], ...pathSegments.slice(1));
  }
  return (firestoreCollection as any)(dbOrPath, ...pathSegments);
}

/**
 * Get document snapshot from central Firestore
 */
export async function getDoc(docRef: DocumentReference): Promise<any> {
  return firestoreGetDoc(docRef);
}

/**
 * Set document data in central Firestore with automatic undefined cleanup
 */
export async function setDoc<T = any>(
  docRef: DocumentReference<T>,
  data: Partial<T> | T | any,
  options?: SetOptions
): Promise<void> {
  const cleaned = cleanFirestoreData(data);
  if (options) {
    return firestoreSetDoc(docRef as any, cleaned as any, options);
  }
  return firestoreSetDoc(docRef as any, cleaned as any);
}

/**
 * Update document data in central Firestore with automatic undefined cleanup
 */
export async function updateDoc<T = any>(
  docRef: DocumentReference<T>,
  data: UpdateData<T> | Partial<T> | any
): Promise<void> {
  const cleaned = cleanFirestoreData(data);
  return firestoreUpdateDoc(docRef as any, cleaned as any);
}

/**
 * Delete document from central Firestore
 */
export async function deleteDoc(docRef: DocumentReference): Promise<void> {
  return firestoreDeleteDoc(docRef);
}

/**
 * Add document to central Firestore collection with automatic undefined cleanup
 */
export async function addDoc<T = any>(
  colRef: CollectionReference<T>,
  data: T | any
): Promise<DocumentReference<T>> {
  const cleaned = cleanFirestoreData(data);
  return firestoreAddDoc(colRef as any, cleaned as any) as any;
}

/**
 * Query builder for Firestore
 */
export function query(
  queryTarget: CollectionReference | Query,
  ...queryConstraints: QueryConstraint[]
): Query {
  return firestoreQuery(queryTarget as any, ...queryConstraints);
}

export function where(fieldPath: string, opStr: any, value: any): QueryConstraint {
  return firestoreWhere(fieldPath, opStr, value);
}

export function orderBy(fieldPath: string, directionStr?: 'asc' | 'desc'): QueryConstraint {
  return firestoreOrderBy(fieldPath, directionStr);
}

export function limit(limitCount: number): QueryConstraint {
  return firestoreLimit(limitCount);
}

/**
 * Fetch documents matching query or collection
 */
export async function getDocs(q: Query | CollectionReference): Promise<any> {
  return firestoreGetDocs(q as any);
}

/**
 * Real-time onSnapshot listener for central Firestore
 */
export function onSnapshot(
  target: DocumentReference | CollectionReference | Query,
  onNext: (snapshot: any) => void,
  onError?: (error: any) => void
): () => void {
  try {
    return firestoreOnSnapshot(
      target as any,
      (snap: any) => {
        try {
          onNext(snap);
        } catch (callbackErr) {
          console.error('[Firestore onSnapshot callback error]:', callbackErr);
        }
      },
      (err: any) => {
        console.warn('[Firestore onSnapshot subscription warning]:', err);
        if (onError) {
          onError(err);
        }
      }
    );
  } catch (err) {
    console.warn('[Firestore onSnapshot initialization notice]:', err);
    return () => {};
  }
}

/**
 * Transaction runner on central Firestore
 */
export async function runTransaction(
  _db: any,
  updateFunction: (transaction: any) => Promise<any>
): Promise<any> {
  return firestoreRunTransaction(db, updateFunction);
}

export function increment(n: number = 1) {
  return firestoreIncrement(n);
}

export function serverTimestamp() {
  return firestoreServerTimestamp();
}

export function arrayUnion(...elements: any[]) {
  return firestoreArrayUnion(...elements);
}

export function arrayRemove(...elements: any[]) {
  return firestoreArrayRemove(...elements);
}

export const embeddedDbInstance = db;

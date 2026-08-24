/**
 * BUKKIT Embedded Database Engine
 * High-performance, zero-external-dependency embedded document database
 * with real-time reactive event listeners, localStorage persistence,
 * and automatic multi-device bi-directional Cloud synchronization.
 */

import { apiFetch, apiUrl } from './apiConfig';

type ListenerCallback = (snapshot: any) => void;

interface QueryConstraint {
  type: 'where' | 'orderBy' | 'limit';
  field?: string;
  op?: string;
  value?: any;
  direction?: 'asc' | 'desc';
  limitCount?: number;
}

class EmbeddedDatabase {
  private memoryStore: Record<string, Record<string, any>> = {};
  private listeners: Map<string, Set<ListenerCallback>> = new Map();
  private storageKey = 'bukkit_embedded_db_v1';
  private syncInterval: any = null;
  private isSyncing = false;

  constructor() {
    this.loadFromLocalStorage();
    this.initBackgroundSync();
    this.startPeriodicSync();
  }

  private loadFromLocalStorage() {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const data = localStorage.getItem(this.storageKey);
        if (data) {
          this.memoryStore = JSON.parse(data);
        }
      }
    } catch (e) {
      console.warn('LocalStorage load error in embedded DB:', e);
    }
  }

  private persistLocal() {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.setItem(this.storageKey, JSON.stringify(this.memoryStore));
      }
    } catch (e) {
      console.warn('LocalStorage persist error:', e);
    }
  }

  public async pullServerUpdates(): Promise<void> {
    if (typeof window === 'undefined' || this.isSyncing) return;
    this.isSyncing = true;

    try {
      const res = await apiFetch('/api/db/dump', {
        headers: { 'Accept': 'application/json' }
      });
      if (res.ok) {
        const serverData = await res.json();
        if (serverData && serverData.store) {
          let hasChanges = false;

          for (const [colName, colData] of Object.entries(serverData.store)) {
            if (!this.memoryStore[colName]) {
              this.memoryStore[colName] = {};
            }
            if (colData && typeof colData === 'object') {
              for (const [docId, docVal] of Object.entries(colData as Record<string, any>)) {
                const currentVal = this.memoryStore[colName][docId];
                // Check if new or updated
                if (!currentVal || JSON.stringify(currentVal) !== JSON.stringify(docVal)) {
                  this.memoryStore[colName][docId] = docVal;
                  hasChanges = true;
                  this.notify(`${colName}/${docId}`);
                }
              }
            }
          }

          if (hasChanges) {
            this.persistLocal();
            this.notifyAllListeners();
          }
        }
      }
    } catch (e) {
      // Graceful network offline handling
    } finally {
      this.isSyncing = false;
    }
  }

  private initBackgroundSync() {
    if (typeof window === 'undefined') return;
    this.pullServerUpdates();
  }

  private startPeriodicSync() {
    if (typeof window === 'undefined') return;
    if (this.syncInterval) clearInterval(this.syncInterval);

    // Sync from server every 2.5 seconds for instant multi-device / multi-APK updates
    this.syncInterval = setInterval(() => {
      this.pullServerUpdates();
    }, 2500);
  }

  private notify(pathKey: string) {
    // Notify direct document listeners
    const docListeners = this.listeners.get(pathKey);
    if (docListeners) {
      const snap = this.getDocSnapByPath(pathKey);
      docListeners.forEach((cb) => {
        try {
          cb(snap);
        } catch (e) {
          console.warn('Listener invocation error:', e);
        }
      });
    }

    // Notify collection-level listeners
    const parts = pathKey.split('/');
    const colName = parts[0];
    const colListeners = this.listeners.get(colName);
    if (colListeners) {
      const snap = this.getCollectionSnap(colName);
      colListeners.forEach((cb) => {
        try {
          cb(snap);
        } catch (e) {
          console.warn('Collection listener invocation error:', e);
        }
      });
    }
  }

  private notifyAllListeners() {
    for (const pathKey of this.listeners.keys()) {
      this.notify(pathKey);
    }
  }

  private syncToServer(colName: string, id: string, data: any, isDelete = false) {
    if (typeof window === 'undefined') return;
    const endpoint = `/api/db/${colName}/${id}`;
    if (isDelete) {
      apiFetch(endpoint, { method: 'DELETE' }).catch(() => {});
    } else {
      apiFetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }).catch(() => {});
    }
  }

  // --- Core Document Operations ---

  getDocData(colName: string, id: string): any | null {
    if (!this.memoryStore[colName]) return null;
    return this.memoryStore[colName][id] || null;
  }

  setDocData(colName: string, id: string, data: any, merge = false): any {
    if (!this.memoryStore[colName]) {
      this.memoryStore[colName] = {};
    }
    const existing = this.memoryStore[colName][id] || {};
    const processed: Record<string, any> = {};

    for (const [k, v] of Object.entries(data || {})) {
      const valObj = v as any;
      if (valObj && typeof valObj === 'object' && valObj.__op === 'increment') {
        processed[k] = (existing[k] || 0) + (valObj.amount || 1);
      } else if (valObj && typeof valObj === 'object' && valObj.__op === 'serverTimestamp') {
        processed[k] = new Date().toISOString();
      } else if (valObj && typeof valObj === 'object' && valObj.__op === 'arrayUnion') {
        const arr = Array.isArray(existing[k]) ? [...existing[k]] : [];
        for (const item of valObj.elements || []) {
          if (!arr.includes(item)) arr.push(item);
        }
        processed[k] = arr;
      } else if (valObj && typeof valObj === 'object' && valObj.__op === 'arrayRemove') {
        const arr = Array.isArray(existing[k]) ? [...existing[k]] : [];
        processed[k] = arr.filter((item: any) => !valObj.elements.includes(item));
      } else {
        processed[k] = v;
      }
    }

    const finalData = merge ? { ...existing, ...processed, id } : { ...processed, id };
    this.memoryStore[colName][id] = finalData;
    this.persistLocal();
    this.notify(`${colName}/${id}`);
    this.syncToServer(colName, id, finalData);
    return finalData;
  }

  updateDocData(colName: string, id: string, partial: any): any {
    return this.setDocData(colName, id, partial, true);
  }

  deleteDocData(colName: string, id: string): boolean {
    if (this.memoryStore[colName] && this.memoryStore[colName][id]) {
      delete this.memoryStore[colName][id];
      this.persistLocal();
      this.notify(`${colName}/${id}`);
      this.syncToServer(colName, id, null, true);
      return true;
    }
    return false;
  }

  getCollectionDocs(colName: string): any[] {
    if (!this.memoryStore[colName]) return [];
    return Object.values(this.memoryStore[colName]);
  }

  // --- Snapshot builders ---

  getDocSnap(colName: string, id: string) {
    const data = this.getDocData(colName, id);
    return {
      id,
      exists: () => data !== null && data !== undefined,
      data: () => data,
      ref: { id, path: `${colName}/${id}` },
    };
  }

  getDocSnapByPath(pathKey: string) {
    const parts = pathKey.split('/');
    const colName = parts[0];
    const id = parts[1] || '';
    return this.getDocSnap(colName, id);
  }

  getCollectionSnap(colName: string, constraints: QueryConstraint[] = []) {
    let docs = this.getCollectionDocs(colName);

    // Apply where filters
    for (const c of constraints) {
      if (c.type === 'where' && c.field && c.op) {
        docs = docs.filter((item) => {
          const val = item[c.field!];
          if (c.op === '==' || c.op === '===') return val === c.value;
          if (c.op === '!=') return val !== c.value;
          if (c.op === '>') return val > c.value;
          if (c.op === '>=') return val >= c.value;
          if (c.op === '<') return val < c.value;
          if (c.op === '<=') return val <= c.value;
          if (c.op === 'in' && Array.isArray(c.value)) return c.value.includes(val);
          if (c.op === 'array-contains') return Array.isArray(val) && val.includes(c.value);
          return true;
        });
      }
    }

    // Apply orderBy
    for (const c of constraints) {
      if (c.type === 'orderBy' && c.field) {
        const dir = c.direction === 'desc' ? -1 : 1;
        docs.sort((a, b) => {
          const aVal = a[c.field!] ?? '';
          const bVal = b[c.field!] ?? '';
          if (aVal < bVal) return -1 * dir;
          if (aVal > bVal) return 1 * dir;
          return 0;
        });
      }
    }

    // Apply limit
    for (const c of constraints) {
      if (c.type === 'limit' && typeof c.limitCount === 'number') {
        docs = docs.slice(0, c.limitCount);
      }
    }

    const docSnaps = docs.map((d) => ({
      id: d.id,
      exists: () => true,
      data: () => d,
      ref: { id: d.id, path: `${colName}/${d.id}` },
    }));

    return {
      docs: docSnaps,
      size: docSnaps.length,
      empty: docSnaps.length === 0,
      forEach: (callback: (snap: any) => void) => docSnaps.forEach(callback),
      docChanges: () =>
        docSnaps.map((docSnap) => ({
          type: 'added' as const,
          doc: docSnap,
          oldIndex: -1,
          newIndex: 0,
        })),
    };
  }

  // --- Subscriptions ---

  subscribe(key: string, callback: ListenerCallback, constraints: QueryConstraint[] = []): () => void {
    if (!this.listeners.has(key)) {
      this.listeners.set(key, new Set());
    }
    const set = this.listeners.get(key)!;
    set.add(callback);

    // Immediate initial invocation
    setTimeout(() => {
      if (key.includes('/')) {
        callback(this.getDocSnapByPath(key));
      } else {
        callback(this.getCollectionSnap(key, constraints));
      }
    }, 0);

    return () => {
      set.delete(callback);
      if (set.size === 0) {
        this.listeners.delete(key);
      }
    };
  }
}

export const embeddedDbInstance = new EmbeddedDatabase();

// --- Firestore API compatibility wrappers ---

export class DocumentReference {
  constructor(public path: string, public id: string) {}
}

export class CollectionReference {
  constructor(public path: string) {}
}

export class QueryRef {
  constructor(public collectionRef: CollectionReference, public constraints: QueryConstraint[] = []) {}
}

export function doc(dbOrCol: any, ...pathSegments: string[]): DocumentReference {
  let fullPath = '';
  if (typeof dbOrCol === 'string') {
    fullPath = [dbOrCol, ...pathSegments].join('/');
  } else if (dbOrCol instanceof CollectionReference) {
    fullPath = [dbOrCol.path, ...pathSegments].join('/');
  } else {
    fullPath = pathSegments.join('/');
  }
  const parts = fullPath.split('/').filter(Boolean);
  const id = parts[parts.length - 1] || '';
  return new DocumentReference(parts.join('/'), id);
}

export function collection(dbOrCol: any, ...pathSegments: string[]): CollectionReference {
  let fullPath = '';
  if (typeof dbOrCol === 'string') {
    fullPath = [dbOrCol, ...pathSegments].join('/');
  } else if (dbOrCol instanceof DocumentReference) {
    fullPath = [dbOrCol.path, ...pathSegments].join('/');
  } else {
    fullPath = pathSegments.join('/');
  }
  return new CollectionReference(fullPath);
}

export async function getDoc(docRef: DocumentReference): Promise<any> {
  const parts = docRef.path.split('/');
  const colName = parts[0];
  const id = parts[1] || '';
  return embeddedDbInstance.getDocSnap(colName, id);
}

export async function setDoc(docRef: DocumentReference, data: any, options?: { merge?: boolean }): Promise<void> {
  const parts = docRef.path.split('/');
  const colName = parts[0];
  const id = parts[1] || docRef.id;
  embeddedDbInstance.setDocData(colName, id, data, options?.merge);
}

export async function updateDoc(docRef: DocumentReference, data: any): Promise<void> {
  const parts = docRef.path.split('/');
  const colName = parts[0];
  const id = parts[1] || docRef.id;
  embeddedDbInstance.updateDocData(colName, id, data);
}

export async function deleteDoc(docRef: DocumentReference): Promise<void> {
  const parts = docRef.path.split('/');
  const colName = parts[0];
  const id = parts[1] || docRef.id;
  embeddedDbInstance.deleteDocData(colName, id);
}

export async function addDoc(colRef: CollectionReference, data: any): Promise<DocumentReference> {
  const id = data.id || `doc_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  embeddedDbInstance.setDocData(colRef.path, id, { ...data, id });
  return new DocumentReference(`${colRef.path}/${id}`, id);
}

export function query(colRefOrQuery: CollectionReference | QueryRef, ...constraints: QueryConstraint[]): QueryRef {
  if (colRefOrQuery instanceof QueryRef) {
    return new QueryRef(colRefOrQuery.collectionRef, [...colRefOrQuery.constraints, ...constraints]);
  }
  return new QueryRef(colRefOrQuery, constraints);
}

export function where(field: string, op: string, value: any): QueryConstraint {
  return { type: 'where', field, op, value };
}

export function orderBy(field: string, direction: 'asc' | 'desc' = 'asc'): QueryConstraint {
  return { type: 'orderBy', field, direction };
}

export function limit(limitCount: number): QueryConstraint {
  return { type: 'limit', limitCount };
}

export async function getDocs(queryOrColRef: QueryRef | CollectionReference): Promise<any> {
  if (queryOrColRef instanceof QueryRef) {
    return embeddedDbInstance.getCollectionSnap(queryOrColRef.collectionRef.path, queryOrColRef.constraints);
  }
  return embeddedDbInstance.getCollectionSnap(queryOrColRef.path);
}

export function onSnapshot(
  target: DocumentReference | CollectionReference | QueryRef,
  callback: (snapshot: any) => void,
  errorCallback?: (err: any) => void
): () => void {
  try {
    if (target instanceof DocumentReference) {
      return embeddedDbInstance.subscribe(target.path, callback);
    } else if (target instanceof CollectionReference) {
      return embeddedDbInstance.subscribe(target.path, callback);
    } else if (target instanceof QueryRef) {
      return embeddedDbInstance.subscribe(target.collectionRef.path, callback, target.constraints);
    }
  } catch (err) {
    if (errorCallback) errorCallback(err);
  }
  return () => {};
}

export async function runTransaction(
  _db: any,
  updateFunction: (transaction: {
    get: (ref: DocumentReference) => Promise<any>;
    set: (ref: DocumentReference, data: any) => void;
    update: (ref: DocumentReference, data: any) => void;
    delete: (ref: DocumentReference) => void;
  }) => Promise<any>
): Promise<any> {
  const transaction = {
    get: async (ref: DocumentReference) => getDoc(ref),
    set: (ref: DocumentReference, data: any) => {
      setDoc(ref, data);
    },
    update: (ref: DocumentReference, data: any) => {
      updateDoc(ref, data);
    },
    delete: (ref: DocumentReference) => {
      deleteDoc(ref);
    },
  };
  return await updateFunction(transaction);
}

export function increment(amount: number = 1) {
  return { __op: 'increment', amount };
}

export function serverTimestamp() {
  return { __op: 'serverTimestamp' };
}

export function arrayUnion(...elements: any[]) {
  return { __op: 'arrayUnion', elements };
}

export function arrayRemove(...elements: any[]) {
  return { __op: 'arrayRemove', elements };
}

export const Timestamp = {
  now: () => ({
    toDate: () => new Date(),
    toMillis: () => Date.now(),
    toISOString: () => new Date().toISOString(),
  }),
  fromDate: (date: Date) => ({
    toDate: () => date,
    toMillis: () => date.getTime(),
    toISOString: () => date.toISOString(),
  }),
  fromMillis: (ms: number) => ({
    toDate: () => new Date(ms),
    toMillis: () => ms,
    toISOString: () => new Date(ms).toISOString(),
  }),
};

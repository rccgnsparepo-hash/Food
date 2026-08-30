import { apiFetchJson } from './apiConfig';
import {
  FALLBACK_MTU_UNIVERSITY,
  FALLBACK_MTU_CAMPUS,
  FALLBACK_MTU_VENDORS,
  FALLBACK_MTU_CATEGORIES,
  FALLBACK_MTU_MENU_ITEMS
} from '../services/seedService';

/**
 * Authoritative Embedded Database Engine
 * Completely self-contained embedded backend store syncing with Node/Express `/api/db/*`,
 * local storage, and real-time BroadcastChannel listeners across tabs, windows, and desktop EXE.
 */

export interface DocumentSnapshot<T = any> {
  id: string;
  exists: () => boolean;
  data: () => T | undefined;
}

export interface QuerySnapshot<T = any> {
  empty: boolean;
  size: number;
  docs: DocumentSnapshot<T>[];
  forEach: (callback: (doc: DocumentSnapshot<T>) => void) => void;
}

export interface DocumentReference<T = any> {
  id: string;
  path: string;
  parent: CollectionReference<T>;
  type: 'document';
}

export interface CollectionReference<T = any> {
  id: string;
  path: string;
  type: 'collection';
}

export interface QueryConstraint {
  type: 'where' | 'orderBy' | 'limit';
  field?: string;
  op?: string;
  value?: any;
  direction?: 'asc' | 'desc';
  limitCount?: number;
}

export interface Query<T = any> {
  collectionPath: string;
  constraints: QueryConstraint[];
}

export type SetOptions = { merge?: boolean };
export type UpdateData<T = any> = Partial<T>;

const STORAGE_KEY = 'bukkit_embedded_local_store';
let inMemoryStore: Record<string, Record<string, any>> = {};

// Initialize inMemoryStore from localStorage or default seed
try {
  if (typeof window !== 'undefined' && window.localStorage) {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      inMemoryStore = JSON.parse(raw);
    }
  }
} catch (e) {
  console.warn('[EmbeddedDb] Cache load notice:', e);
}

// Ensure default fallback data is populated
function ensureSeedData() {
  if (!inMemoryStore['universities']) inMemoryStore['universities'] = {};
  inMemoryStore['universities'][FALLBACK_MTU_UNIVERSITY.id] = FALLBACK_MTU_UNIVERSITY;

  if (!inMemoryStore['campuses']) inMemoryStore['campuses'] = {};
  inMemoryStore['campuses'][FALLBACK_MTU_CAMPUS.id] = FALLBACK_MTU_CAMPUS;

  if (!inMemoryStore['vendors']) inMemoryStore['vendors'] = {};
  if (!inMemoryStore['restaurants']) inMemoryStore['restaurants'] = {};
  for (const v of FALLBACK_MTU_VENDORS) {
    inMemoryStore['vendors'][v.id] = { ...(inMemoryStore['vendors'][v.id] || {}), ...v };
    inMemoryStore['restaurants'][v.id] = {
      id: v.id,
      name: v.name,
      description: v.description || '',
      logo_url: v.logo_url,
      cover_image_url: v.cover_image_url,
      review_count: v.review_count || 0,
      rating: v.rating || 4.9,
      delivery_fee: 200,
      estimated_delivery_time: '10-20 min',
      minimum_order: 500,
      address: v.address,
      latitude: v.latitude,
      longitude: v.longitude,
      is_open: true,
      created_at: v.created_at
    };
  }

  if (!inMemoryStore['food_categories']) inMemoryStore['food_categories'] = {};
  for (const c of FALLBACK_MTU_CATEGORIES) {
    inMemoryStore['food_categories'][c.id] = c;
  }

  if (!inMemoryStore['menu_items']) inMemoryStore['menu_items'] = {};
  for (const m of FALLBACK_MTU_MENU_ITEMS) {
    inMemoryStore['menu_items'][m.id] = { ...(inMemoryStore['menu_items'][m.id] || {}), ...m };
  }
}
ensureSeedData();

// Persist inMemoryStore to localStorage
function persistLocal() {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(inMemoryStore));
    }
  } catch {}
}

// Broadcast Channel for live multi-tab & multi-window sync
let broadcastChannel: BroadcastChannel | null = null;
try {
  if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
    broadcastChannel = new BroadcastChannel('bukkit_embedded_db_sync');
    broadcastChannel.onmessage = (event) => {
      const { type, collection: col, id, data, isDelete } = event.data || {};
      if (type === 'DB_MUTATION' && col && id) {
        if (!inMemoryStore[col]) inMemoryStore[col] = {};
        if (isDelete) {
          delete inMemoryStore[col][id];
        } else {
          inMemoryStore[col][id] = data;
        }
        persistLocal();
        notifyDocListeners(col, id);
        notifyColListeners(col);
      }
    };
  }
} catch {}

function broadcastMutation(col: string, id: string, data: any, isDelete = false) {
  try {
    if (broadcastChannel) {
      broadcastChannel.postMessage({
        type: 'DB_MUTATION',
        collection: col,
        id,
        data,
        isDelete
      });
    }
  } catch {}
}

// Listener registries
const docListeners = new Map<string, Set<(snap: DocumentSnapshot) => void>>();
const colListeners = new Map<string, Set<(snap: QuerySnapshot) => void>>();

function notifyDocListeners(col: string, id: string) {
  const key = `${col}/${id}`;
  const listeners = docListeners.get(key);
  if (listeners && listeners.size > 0) {
    const raw = inMemoryStore[col]?.[id];
    const snap: DocumentSnapshot = {
      id,
      exists: () => Boolean(raw),
      data: () => raw ? JSON.parse(JSON.stringify(raw)) : undefined
    };
    listeners.forEach(fn => {
      try { fn(snap); } catch (e) { console.warn('[EmbeddedDb] Listener error:', e); }
    });
  }
}

function notifyColListeners(col: string) {
  const listeners = colListeners.get(col);
  if (listeners && listeners.size > 0) {
    const colData = inMemoryStore[col] || {};
    const docs = Object.entries(colData).map(([id, item]) => ({
      id,
      exists: () => true,
      data: () => JSON.parse(JSON.stringify(item))
    }));
    const snap: QuerySnapshot = {
      empty: docs.length === 0,
      size: docs.length,
      docs,
      forEach: (cb) => docs.forEach(cb)
    };
    listeners.forEach(fn => {
      try { fn(snap); } catch (e) { console.warn('[EmbeddedDb] Col listener error:', e); }
    });
  }
}

// Background sync and live SSE stream from backend Express `/api/db/stream`
let hasSyncedWithServer = false;
let eventSourceInstance: EventSource | null = null;

function initRealtimeEventStream() {
  if (typeof window === 'undefined' || typeof EventSource === 'undefined') return;

  try {
    if (eventSourceInstance) {
      eventSourceInstance.close();
    }

    eventSourceInstance = new EventSource('/api/db/stream');

    eventSourceInstance.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload?.type === 'DB_MUTATION' && payload.collection && payload.id) {
          const col = payload.collection;
          const id = payload.id;
          if (!inMemoryStore[col]) inMemoryStore[col] = {};

          if (payload.isDelete) {
            delete inMemoryStore[col][id];
          } else {
            inMemoryStore[col][id] = payload.data;
          }

          persistLocal();
          notifyDocListeners(col, id);
          notifyColListeners(col);
        }
      } catch (e) {
        // Non-fatal parse issue
      }
    };

    eventSourceInstance.onerror = () => {
      // EventSource auto-reconnects, but fallback sync can be triggered
      syncDatabaseWithServer().catch(() => {});
    };
  } catch (err) {
    console.warn('[EmbeddedDb] SSE stream setup notice:', err);
  }
}

export async function syncDatabaseWithServer(): Promise<void> {
  try {
    const res = await apiFetchJson<{ success: boolean; store: Record<string, Record<string, any>> }>('/api/db/dump');
    if (res.ok && res.data?.store && typeof res.data.store === 'object') {
      const serverStore = res.data.store;
      let changed = false;
      for (const [colName, colItems] of Object.entries(serverStore)) {
        if (!inMemoryStore[colName]) inMemoryStore[colName] = {};
        for (const [docId, docData] of Object.entries(colItems || {})) {
          if (JSON.stringify(inMemoryStore[colName][docId]) !== JSON.stringify(docData)) {
            inMemoryStore[colName][docId] = docData;
            changed = true;
          }
        }
      }
      if (changed) {
        persistLocal();
        // Notify all active listeners
        for (const col of colListeners.keys()) {
          notifyColListeners(col);
        }
        for (const key of docListeners.keys()) {
          const [col, id] = key.split('/');
          notifyDocListeners(col, id);
        }
      }
      hasSyncedWithServer = true;
    }
  } catch (err) {
    // Non-blocking sync error
  }
}

// Trigger initial background sync and SSE stream
if (typeof window !== 'undefined') {
  setTimeout(() => {
    syncDatabaseWithServer().catch(() => {});
    initRealtimeEventStream();
  }, 100);

  // Active polling safety net (every 3 seconds) for cross-device real-time sync
  setInterval(() => {
    if (colListeners.size > 0 || docListeners.size > 0) {
      syncDatabaseWithServer().catch(() => {});
    }
  }, 3000);
}

/**
 * Standard undefined stripper
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

export const Timestamp = {
  now: () => ({ toISOString: () => new Date().toISOString(), toMillis: () => Date.now(), seconds: Math.floor(Date.now() / 1000) }),
  fromDate: (date: Date) => ({ toISOString: () => date.toISOString(), toMillis: () => date.getTime(), seconds: Math.floor(date.getTime() / 1000) }),
  fromMillis: (ms: number) => ({ toISOString: () => new Date(ms).toISOString(), toMillis: () => ms, seconds: Math.floor(ms / 1000) })
};

export const serverTimestamp = () => new Date().toISOString();
export const increment = (n: number) => (current: number = 0) => (current || 0) + n;
export const arrayUnion = (...items: any[]) => items;
export const arrayRemove = (...items: any[]) => items;

export const db: any = {
  type: 'embedded',
  name: 'bukkit_embedded_database'
};

export function doc(dbOrColOrPath: any, ...pathSegments: string[]): DocumentReference {
  let col = '';
  let id = '';

  if (typeof dbOrColOrPath === 'string') {
    if (pathSegments.length === 0) {
      const parts = dbOrColOrPath.split('/').filter(Boolean);
      col = parts[0] || 'default';
      id = parts[1] || `doc_${Date.now()}`;
    } else {
      col = dbOrColOrPath;
      id = pathSegments[0];
    }
  } else if (dbOrColOrPath?.type === 'collection') {
    col = dbOrColOrPath.path || dbOrColOrPath.id;
    id = pathSegments[0] || `doc_${Date.now()}`;
  } else {
    col = pathSegments[0] || 'default';
    id = pathSegments[1] || `doc_${Date.now()}`;
  }

  const colRef: CollectionReference = {
    id: col,
    path: col,
    type: 'collection'
  };

  return {
    id,
    path: `${col}/${id}`,
    parent: colRef,
    type: 'document'
  };
}

export function collection(dbOrPath: any, ...pathSegments: string[]): CollectionReference {
  let col = '';
  if (typeof dbOrPath === 'string') {
    col = dbOrPath;
  } else {
    col = pathSegments[0] || 'default';
  }
  return {
    id: col,
    path: col,
    type: 'collection'
  };
}

export async function getDoc<T = any>(docRef: DocumentReference<T>): Promise<DocumentSnapshot<T>> {
  const col = docRef.parent?.path || docRef.parent?.id || docRef.path.split('/')[0];
  const id = docRef.id;

  let existing = inMemoryStore[col]?.[id];

  // If not found in local memory cache, try fetching from backend Express API
  if (!existing) {
    try {
      const res = await apiFetchJson<{ success: boolean; data: any }>(`/api/db/${col}/${id}`);
      if (res.ok && res.data?.data) {
        if (!inMemoryStore[col]) inMemoryStore[col] = {};
        inMemoryStore[col][id] = res.data.data;
        existing = res.data.data;
        persistLocal();
      }
    } catch {}
  }

  return {
    id,
    exists: () => Boolean(existing),
    data: () => existing ? JSON.parse(JSON.stringify(existing)) : undefined
  };
}

export async function setDoc<T = any>(
  docRef: DocumentReference<T>,
  data: Partial<T> | T | any,
  options?: SetOptions
): Promise<void> {
  const col = docRef.parent?.path || docRef.parent?.id || docRef.path.split('/')[0];
  const id = docRef.id;

  if (!inMemoryStore[col]) inMemoryStore[col] = {};

  const cleaned = cleanFirestoreData(data);
  const existing = inMemoryStore[col][id] || {};
  const merged = options?.merge ? { ...existing, ...cleaned, id } : { ...cleaned, id };

  inMemoryStore[col][id] = merged;
  persistLocal();

  // Notify listeners and broadcast
  notifyDocListeners(col, id);
  notifyColListeners(col);
  broadcastMutation(col, id, merged, false);

  // Sync to backend Express server
  apiFetchJson(`/api/db/${col}/${id}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(merged)
  }).catch(() => {});
}

export async function updateDoc<T = any>(
  docRef: DocumentReference<T>,
  data: UpdateData<T> | Partial<T> | any
): Promise<void> {
  const col = docRef.parent?.path || docRef.parent?.id || docRef.path.split('/')[0];
  const id = docRef.id;

  if (!inMemoryStore[col]) inMemoryStore[col] = {};

  const cleaned = cleanFirestoreData(data);
  const existing = inMemoryStore[col][id] || {};
  const merged = { ...existing, ...cleaned, id };

  inMemoryStore[col][id] = merged;
  persistLocal();

  notifyDocListeners(col, id);
  notifyColListeners(col);
  broadcastMutation(col, id, merged, false);

  apiFetchJson(`/api/db/${col}/${id}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(merged)
  }).catch(() => {});
}

export async function deleteDoc(docRef: DocumentReference): Promise<void> {
  const col = docRef.parent?.path || docRef.parent?.id || docRef.path.split('/')[0];
  const id = docRef.id;

  if (inMemoryStore[col]?.[id]) {
    delete inMemoryStore[col][id];
    persistLocal();

    notifyDocListeners(col, id);
    notifyColListeners(col);
    broadcastMutation(col, id, null, true);

    apiFetchJson(`/api/db/${col}/${id}`, {
      method: 'DELETE'
    }).catch(() => {});
  }
}

export async function addDoc<T = any>(
  colRef: CollectionReference<T>,
  data: T | any
): Promise<DocumentReference<T>> {
  const col = colRef.path || colRef.id;
  const id = data.id || `${col}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const docRef = doc(col, id);
  await setDoc(docRef, { ...data, id });
  return docRef;
}

export function query(
  queryTarget: CollectionReference | Query,
  ...queryConstraints: QueryConstraint[]
): Query {
  const collectionPath = (queryTarget as any).path || (queryTarget as any).collectionPath || (queryTarget as any).id;
  const existingConstraints = (queryTarget as any).constraints || [];
  return {
    collectionPath,
    constraints: [...existingConstraints, ...queryConstraints]
  };
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

export async function getDocs<T = any>(qOrCol: CollectionReference<T> | Query<T>): Promise<QuerySnapshot<T>> {
  const col = (qOrCol as any).collectionPath || (qOrCol as any).path || (qOrCol as any).id;
  const constraints: QueryConstraint[] = (qOrCol as any).constraints || [];

  if (!inMemoryStore[col]) {
    inMemoryStore[col] = {};
  }

  let items = Object.values(inMemoryStore[col] || {});

  // If local store is empty and not synced yet, attempt quick fetch from server
  if (items.length === 0) {
    try {
      const res = await apiFetchJson<{ success: boolean; data: any[] }>(`/api/db/${col}`);
      if (res.ok && Array.isArray(res.data?.data)) {
        for (const it of res.data.data) {
          if (it.id) inMemoryStore[col][it.id] = it;
        }
        items = Object.values(inMemoryStore[col]);
        persistLocal();
      }
    } catch {}
  }

  for (const c of constraints) {
    if (c.type === 'where' && c.field) {
      items = items.filter(it => {
        const val = it[c.field!];
        if (c.op === '==' || c.op === '===') return val === c.value;
        if (c.op === '!=') return val !== c.value;
        if (c.op === '>') return val > c.value;
        if (c.op === '>=') return val >= c.value;
        if (c.op === '<') return val < c.value;
        if (c.op === '<=') return val <= c.value;
        if (c.op === 'array-contains') return Array.isArray(val) && val.includes(c.value);
        if (c.op === 'in') return Array.isArray(c.value) && c.value.includes(val);
        return true;
      });
    } else if (c.type === 'orderBy' && c.field) {
      items.sort((a, b) => {
        const valA = a[c.field!] || '';
        const valB = b[c.field!] || '';
        if (valA < valB) return c.direction === 'desc' ? 1 : -1;
        if (valA > valB) return c.direction === 'desc' ? -1 : 1;
        return 0;
      });
    } else if (c.type === 'limit' && typeof c.limitCount === 'number') {
      items = items.slice(0, c.limitCount);
    }
  }

  const docs: DocumentSnapshot<T>[] = items.map(it => ({
    id: it.id,
    exists: () => true,
    data: () => JSON.parse(JSON.stringify(it))
  }));

  return {
    empty: docs.length === 0,
    size: docs.length,
    docs,
    forEach: (cb) => docs.forEach(cb)
  };
}

export function onSnapshot(
  target: DocumentReference | CollectionReference | Query | any,
  onNext: (snap: any) => void,
  onError?: (err: any) => void
): () => void {
  const isDoc = target.type === 'document' || target.path?.includes('/');

  if (isDoc) {
    const col = target.parent?.path || target.parent?.id || target.path.split('/')[0];
    const id = target.id || target.path.split('/')[1];
    const key = `${col}/${id}`;

    if (!docListeners.has(key)) {
      docListeners.set(key, new Set());
    }
    docListeners.get(key)!.add(onNext);

    // Immediate callback with current value
    const raw = inMemoryStore[col]?.[id];
    const snap: DocumentSnapshot = {
      id,
      exists: () => Boolean(raw),
      data: () => raw ? JSON.parse(JSON.stringify(raw)) : undefined
    };
    try { onNext(snap); } catch {}

    // Trigger async server fetch
    apiFetchJson<{ success: boolean; data: any }>(`/api/db/${col}/${id}`).then(res => {
      if (res.ok && res.data?.data) {
        if (!inMemoryStore[col]) inMemoryStore[col] = {};
        inMemoryStore[col][id] = res.data.data;
        notifyDocListeners(col, id);
      }
    }).catch(() => {});

    return () => {
      docListeners.get(key)?.delete(onNext);
      if (docListeners.get(key)?.size === 0) {
        docListeners.delete(key);
      }
    };
  } else {
    const col = target.collectionPath || target.path || target.id;

    if (!colListeners.has(col)) {
      colListeners.set(col, new Set());
    }
    colListeners.get(col)!.add(onNext);

    const colData = inMemoryStore[col] || {};
    const docs = Object.entries(colData).map(([id, item]) => ({
      id,
      exists: () => true,
      data: () => JSON.parse(JSON.stringify(item))
    }));
    const snap: QuerySnapshot = {
      empty: docs.length === 0,
      size: docs.length,
      docs,
      forEach: (cb) => docs.forEach(cb)
    };
    try { onNext(snap); } catch {}

    // Trigger async server fetch for collection
    apiFetchJson<{ success: boolean; data: any[] }>(`/api/db/${col}`).then(res => {
      if (res.ok && Array.isArray(res.data?.data)) {
        if (!inMemoryStore[col]) inMemoryStore[col] = {};
        for (const item of res.data.data) {
          if (item.id) inMemoryStore[col][item.id] = item;
        }
        notifyColListeners(col);
      }
    }).catch(() => {});

    return () => {
      colListeners.get(col)?.delete(onNext);
      if (colListeners.get(col)?.size === 0) {
        colListeners.delete(col);
      }
    };
  }
}

export async function runTransaction<T>(
  _firestoreInstance: any,
  updateFunction: (transaction: {
    get: (ref: DocumentReference) => Promise<DocumentSnapshot>;
    set: (ref: DocumentReference, data: any, options?: SetOptions) => void;
    update: (ref: DocumentReference, data: any) => void;
    delete: (ref: DocumentReference) => void;
  }) => Promise<T>
): Promise<T> {
  const transaction = {
    get: getDoc,
    set: (ref: DocumentReference, data: any, options?: SetOptions) => {
      setDoc(ref, data, options);
    },
    update: (ref: DocumentReference, data: any) => {
      updateDoc(ref, data);
    },
    delete: (ref: DocumentReference) => {
      deleteDoc(ref);
    }
  };
  return updateFunction(transaction);
}

import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import {
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  enableIndexedDbPersistence,
  Firestore
} from 'firebase/firestore';
import { getStorage, FirebaseStorage } from 'firebase/storage';
import firebaseConfig from '../../firebase-applet-config.json';

let app: FirebaseApp;
let auth: Auth;
let db: Firestore;
let storage: FirebaseStorage;

const databaseId = (firebaseConfig as any).firestoreDatabaseId || '(default)';

try {
  if (!getApps().length) {
    app = initializeApp(firebaseConfig);
  } else {
    app = getApp();
  }
  auth = getAuth(app);

  // Initialize Firestore with robust multi-tab persistent offline cache
  if (typeof window !== 'undefined') {
    try {
      db = initializeFirestore(app, {
        localCache: persistentLocalCache({
          tabManager: persistentMultipleTabManager()
        })
      }, databaseId);
    } catch {
      db = getFirestore(app, databaseId);
    }
  } else {
    db = getFirestore(app, databaseId);
  }

  storage = getStorage(app);
} catch (error) {
  console.error('Firebase Auth/Firestore initialization notice:', error);
  app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app, databaseId);
  storage = getStorage(app);
}

/**
 * Explicitly configure and verify Firestore persistence in the marketplace initialization flow
 * Ensures that menu items, categories, and vendor data remain accessible during unstable campus network connections.
 */
export async function configureFirestorePersistence(firestoreInstance: Firestore = db): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  try {
    // Attempt fallback IndexedDB persistence if persistentLocalCache was not initialized
    if (typeof (firestoreInstance as any)._settings?.localCache === 'undefined') {
      await enableIndexedDbPersistence(firestoreInstance).catch((err: any) => {
        if (err?.code === 'failed-precondition') {
          console.info('[Firestore Persistence] Multiple tabs open; persistence active in primary tab.');
        } else if (err?.code === 'unimplemented') {
          console.info('[Firestore Persistence] Browser does not support offline persistence.');
        }
      });
    }
    return true;
  } catch (err) {
    console.warn('[Firestore Persistence] Configuration notice:', err);
    return false;
  }
}

export { app, auth, db, storage };

/**
 * Recursively removes all `undefined` properties from an object/array
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

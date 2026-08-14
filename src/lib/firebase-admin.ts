import { initializeApp, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import firebaseConfig from '../../firebase-applet-config.json';

if (!getApps().length) {
  try {
    initializeApp({
      projectId: firebaseConfig.projectId,
    });
  } catch (err) {
    console.warn('Firebase admin initialization fallback:', err);
  }
}

export const adminAuth = getAuth();

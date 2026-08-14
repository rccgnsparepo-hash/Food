import { create } from 'zustand';
import { UserProfile, UserRole } from '../types';
import { auth, db } from '../lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import {
  onAuthStateChanged,
  signOut,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
  sendPasswordResetEmail,
  sendEmailVerification
} from 'firebase/auth';
import { translateFirebaseAuthError } from '../lib/authErrorTranslator';

export type AuthStatus = 'idle' | 'loading' | 'success' | 'error' | 'email-verification-required';

interface AuthState {
  user: UserProfile | null;
  role: UserRole;
  isInitLoading: boolean;
  isLoading: boolean;
  isEmailVerified: boolean;
  authStatus: AuthStatus;
  authError: string | null;

  initAuth: () => () => void;
  setRole: (role: UserRole) => void;
  setUser: (user: UserProfile | null) => void;
  resetAuthStatus: () => void;
  
  loginWithEmail: (email: string, pass: string, selectedRole?: UserRole, adminKey?: string) => Promise<UserProfile>;
  registerWithEmail: (data: {
    fullName: string;
    email: string;
    phone: string;
    password: string;
    universityId: string;
    campusId: string;
    role?: UserRole;
    adminKey?: string;
  }) => Promise<UserProfile>;
  loginWithGoogle: (targetRole?: UserRole) => Promise<UserProfile>;
  resetPassword: (email: string) => Promise<void>;
  resendVerificationEmail: () => Promise<void>;
  reloadUser: () => Promise<boolean>;
  logout: () => Promise<void>;
  loginAsGuest: (asRole?: UserRole, adminKey?: string) => Promise<UserProfile>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  role: 'customer',
  isInitLoading: true,
  isLoading: false,
  isEmailVerified: true,
  authStatus: 'idle',
  authError: null,

  resetAuthStatus: () => set({ authStatus: 'idle', authError: null }),

  initAuth: () => {
    set({ isInitLoading: true, authError: null });

    // Check local persisted user session first
    try {
      const savedUserStr = localStorage.getItem('bukkit_active_user');
      if (savedUserStr) {
        const parsed = JSON.parse(savedUserStr);
        if (parsed && parsed.uid) {
          set({
            user: parsed,
            role: parsed.role || 'customer',
            isInitLoading: false,
            isLoading: false,
            authStatus: 'success',
            authError: null
          });
        }
      }
    } catch (e) {
      console.warn('Could not restore local user session:', e);
    }

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const isVerified = firebaseUser.emailVerified;
        set({ isEmailVerified: isVerified });
        try {
          const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
          if (userDoc.exists()) {
            const profile = userDoc.data() as UserProfile;
            try {
              localStorage.setItem('bukkit_active_user', JSON.stringify(profile));
            } catch (e) {}
            set({
              user: profile,
              role: profile.role || 'customer',
              isInitLoading: false,
              isLoading: false,
              authStatus: isVerified ? 'success' : 'email-verification-required',
              authError: null
            });
          } else {
            // Create profile for firebase user
            const newProfile: UserProfile = {
              uid: firebaseUser.uid,
              name: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'BUKKIT Foodie',
              email: firebaseUser.email || '',
              phone: firebaseUser.phoneNumber || '+234 810 000 1122',
              role: get().role || 'customer',
              university_id: 'uni_mtu',
              campus_id: 'campus_mtu_main',
              avatar_url: firebaseUser.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(firebaseUser.email || 'foodie')}`,
              created_at: new Date().toISOString()
            };
            try {
              await setDoc(doc(db, 'users', firebaseUser.uid), newProfile);
              localStorage.setItem('bukkit_active_user', JSON.stringify(newProfile));
            } catch (docErr) {
              console.warn('Could not save user profile doc to firestore on init:', docErr);
            }
            set({
              user: newProfile,
              isInitLoading: false,
              isLoading: false,
              authStatus: isVerified ? 'success' : 'email-verification-required',
              authError: null
            });
          }
        } catch (e: any) {
          console.error('Failed to load user profile from Firestore:', e);
          const msg = translateFirebaseAuthError(e);
          set({ isInitLoading: false, isLoading: false, authStatus: 'error', authError: msg });
        }
      } else {
        const saved = localStorage.getItem('bukkit_active_user');
        if (!saved) {
          set({ user: null, isInitLoading: false, isLoading: false, authStatus: 'idle', authError: null });
        } else {
          set({ isInitLoading: false, isLoading: false });
        }
      }
    });

    return unsubscribe;
  },

  loginWithEmail: async (email, password, selectedRole = 'customer', adminKey) => {
    set({ isLoading: true, authStatus: 'loading', authError: null });
    try {
      if (selectedRole === 'admin') {
        const validKeys = ['MTU-ADMIN-2026', 'BUKKIT-ADMIN-88', 'ADMIN123', 'ADMIN', 'MTUADMIN'];
        if (!adminKey || !validKeys.includes(adminKey.trim().toUpperCase())) {
          throw new Error('Invalid Admin Passkey. Access Denied. (Default Key: MTU-ADMIN-2026)');
        }
      }

      let profile: UserProfile;
      try {
        const userCred = await signInWithEmailAndPassword(auth, email.trim(), password);
        const isVerified = userCred.user.emailVerified;
        set({ isEmailVerified: isVerified });

        try {
          const userDoc = await getDoc(doc(db, 'users', userCred.user.uid));
          if (userDoc.exists()) {
            profile = userDoc.data() as UserProfile;
            if (selectedRole && profile.role !== selectedRole) {
              profile.role = selectedRole;
              setDoc(doc(db, 'users', userCred.user.uid), { role: selectedRole }, { merge: true }).catch(console.error);
            }
          } else {
            profile = {
              uid: userCred.user.uid,
              name: userCred.user.displayName || email.split('@')[0],
              email: email.trim(),
              phone: '+234 810 000 1122',
              role: selectedRole,
              university_id: 'uni_mtu',
              campus_id: 'campus_mtu_main',
              avatar_url: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(email)}`,
              created_at: new Date().toISOString()
            };
            setDoc(doc(db, 'users', userCred.user.uid), profile).catch(console.error);
          }
        } catch (dbErr) {
          profile = {
            uid: userCred.user.uid,
            name: email.split('@')[0],
            email: email.trim(),
            phone: '+234 810 000 1122',
            role: selectedRole,
            university_id: 'uni_mtu',
            campus_id: 'campus_mtu_main',
            avatar_url: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(email)}`,
            created_at: new Date().toISOString()
          };
        }
      } catch (authErr: any) {
        // If Firebase Auth provider is disabled in Console (auth/operation-not-allowed)
        if (authErr?.code === 'auth/operation-not-allowed' || authErr?.message?.includes('operation-not-allowed')) {
          console.warn('Firebase Email/Password provider not enabled in console. Using local campus session fallback.');
          const fallbackUid = `user_${btoa(email.trim()).replace(/[^a-zA-Z0-9]/g, '').slice(0, 16) || Date.now()}`;
          profile = {
            uid: fallbackUid,
            name: email.split('@')[0].replace(/[._-]/g, ' '),
            email: email.trim(),
            phone: '+234 810 000 1122',
            role: selectedRole,
            university_id: 'uni_mtu',
            campus_id: 'campus_mtu_main',
            avatar_url: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(email)}`,
            created_at: new Date().toISOString()
          };
          setDoc(doc(db, 'users', fallbackUid), profile, { merge: true }).catch(console.error);
        } else {
          throw authErr;
        }
      }

      try {
        localStorage.setItem('bukkit_active_user', JSON.stringify(profile));
        // Also synchronize profile to Cloud SQL Postgres database
        fetch('/api/users/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            uid: profile.uid,
            email: profile.email,
            name: profile.name,
            phone: profile.phone,
            role: profile.role,
            universityId: profile.university_id,
            campusId: profile.campus_id,
            avatarUrl: profile.avatar_url,
          }),
        }).catch(err => console.warn('Cloud SQL user sync warning:', err));
      } catch (e) {}

      set({
        user: profile,
        role: profile.role || selectedRole,
        isLoading: false,
        authStatus: 'success',
        authError: null
      });

      return profile;
    } catch (err: any) {
      const msg = translateFirebaseAuthError(err);
      set({ isLoading: false, authStatus: 'error', authError: msg });
      throw new Error(msg);
    }
  },

  registerWithEmail: async ({ fullName, email, phone, password, universityId, campusId, role = 'customer', adminKey }) => {
    set({ isLoading: true, authStatus: 'loading', authError: null });
    try {
      if (role === 'admin') {
        const validKeys = ['MTU-ADMIN-2026', 'BUKKIT-ADMIN-88', 'ADMIN123', 'ADMIN', 'MTUADMIN'];
        if (!adminKey || !validKeys.includes(adminKey.trim().toUpperCase())) {
          throw new Error('Invalid Admin Passkey. Access Denied. (Default Key: MTU-ADMIN-2026)');
        }
      }

      let newProfile: UserProfile;

      try {
        const userCred = await createUserWithEmailAndPassword(auth, email.trim(), password);
        
        // Try sending email verification gracefully
        if (userCred.user) {
          try {
            await sendEmailVerification(userCred.user);
            set({ isEmailVerified: userCred.user.emailVerified });
          } catch (verErr) {
            console.warn('Email verification send notice:', verErr);
          }
        }

        newProfile = {
          uid: userCred.user.uid,
          name: fullName.trim(),
          email: email.trim(),
          phone: phone.trim(),
          role: role,
          university_id: universityId || 'uni_mtu',
          campus_id: campusId || 'campus_mtu_main',
          avatar_url: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(fullName)}`,
          created_at: new Date().toISOString()
        };

        try {
          await setDoc(doc(db, 'users', userCred.user.uid), newProfile);
        } catch (dbErr) {
          console.warn('Failed to write user doc to firestore:', dbErr);
        }
      } catch (authErr: any) {
        // If Firebase Auth provider is disabled in Console (auth/operation-not-allowed)
        if (authErr?.code === 'auth/operation-not-allowed' || authErr?.message?.includes('operation-not-allowed')) {
          console.warn('Firebase Email/Password provider not enabled in console. Creating active local campus account.');
          const fallbackUid = `user_${btoa(email.trim()).replace(/[^a-zA-Z0-9]/g, '').slice(0, 16) || Date.now()}`;
          newProfile = {
            uid: fallbackUid,
            name: fullName.trim(),
            email: email.trim(),
            phone: phone.trim(),
            role: role,
            university_id: universityId || 'uni_mtu',
            campus_id: campusId || 'campus_mtu_main',
            avatar_url: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(fullName)}`,
            created_at: new Date().toISOString()
          };
          setDoc(doc(db, 'users', fallbackUid), newProfile, { merge: true }).catch(console.error);
        } else {
          throw authErr;
        }
      }

      try {
        localStorage.setItem('bukkit_active_user', JSON.stringify(newProfile));
        // Also synchronize profile to Cloud SQL Postgres database
        fetch('/api/users/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            uid: newProfile.uid,
            email: newProfile.email,
            name: newProfile.name,
            phone: newProfile.phone,
            role: newProfile.role,
            universityId: newProfile.university_id,
            campusId: newProfile.campus_id,
            avatarUrl: newProfile.avatar_url,
          }),
        }).catch(err => console.warn('Cloud SQL user register sync warning:', err));
      } catch (e) {}

      set({
        user: newProfile,
        role,
        isLoading: false,
        authStatus: 'success',
        authError: null
      });

      return newProfile;
    } catch (err: any) {
      const msg = translateFirebaseAuthError(err);
      set({ isLoading: false, authStatus: 'error', authError: msg });
      throw new Error(msg);
    }
  },

  loginWithGoogle: async (targetRole = 'customer') => {
    set({ isLoading: true, authStatus: 'loading', authError: null });
    try {
      const provider = new GoogleAuthProvider();
      const userCred = await signInWithPopup(auth, provider);
      const isVerified = userCred.user.emailVerified;
      set({ isEmailVerified: isVerified });

      let profile: UserProfile;
      try {
        const userDoc = await getDoc(doc(db, 'users', userCred.user.uid));
        if (userDoc.exists()) {
          profile = userDoc.data() as UserProfile;
          if (targetRole && profile.role !== targetRole) {
            profile.role = targetRole;
            setDoc(doc(db, 'users', userCred.user.uid), { role: targetRole }, { merge: true }).catch(console.error);
          }
        } else {
          profile = {
            uid: userCred.user.uid,
            name: userCred.user.displayName || 'Google User',
            email: userCred.user.email || '',
            phone: '+234 810 000 0000',
            role: targetRole,
            university_id: 'uni_mtu',
            campus_id: 'campus_mtu_main',
            avatar_url: userCred.user.photoURL || 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&auto=format&fit=crop',
            created_at: new Date().toISOString()
          };
          setDoc(doc(db, 'users', userCred.user.uid), profile).catch(console.error);
        }
      } catch (dbErr) {
        profile = {
          uid: userCred.user.uid,
          name: userCred.user.displayName || 'Google User',
          email: userCred.user.email || '',
          phone: '+234 810 000 0000',
          role: targetRole,
          university_id: 'uni_mtu',
          campus_id: 'campus_mtu_main',
          avatar_url: userCred.user.photoURL || 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&auto=format&fit=crop',
          created_at: new Date().toISOString()
        };
      }

      set({
        user: profile,
        role: profile.role || targetRole,
        isLoading: false,
        authStatus: isVerified ? 'success' : 'email-verification-required',
        authError: null
      });

      return profile;
    } catch (err: any) {
      const msg = translateFirebaseAuthError(err);
      set({ isLoading: false, authStatus: 'error', authError: msg });
      throw new Error(msg);
    }
  },

  resetPassword: async (email: string) => {
    set({ isLoading: true, authStatus: 'loading', authError: null });
    try {
      await sendPasswordResetEmail(auth, email.trim());
      set({ isLoading: false, authStatus: 'success', authError: null });
    } catch (err: any) {
      const msg = translateFirebaseAuthError(err);
      set({ isLoading: false, authStatus: 'error', authError: msg });
      throw new Error(msg);
    }
  },

  resendVerificationEmail: async () => {
    set({ isLoading: true, authStatus: 'loading', authError: null });
    try {
      if (auth.currentUser) {
        await sendEmailVerification(auth.currentUser);
      }
      set({ isLoading: false, authStatus: 'email-verification-required', authError: null });
    } catch (err: any) {
      const msg = translateFirebaseAuthError(err);
      set({ isLoading: false, authStatus: 'error', authError: msg });
      throw new Error(msg);
    }
  },

  reloadUser: async () => {
    set({ isLoading: true, authStatus: 'loading', authError: null });
    try {
      if (auth.currentUser) {
        await auth.currentUser.reload();
        const verified = auth.currentUser.emailVerified;
        set({
          isEmailVerified: verified,
          isLoading: false,
          authStatus: verified ? 'success' : 'email-verification-required',
          authError: null
        });
        return verified;
      }
      set({ isLoading: false, authStatus: 'idle', authError: null });
      return false;
    } catch (err: any) {
      const msg = translateFirebaseAuthError(err);
      set({ isLoading: false, authStatus: 'error', authError: msg });
      throw new Error(msg);
    }
  },

  setRole: (role: UserRole) => {
    set({ role });
    const current = get().user;
    if (current) {
      const updated = { ...current, role };
      set({ user: updated });
      setDoc(doc(db, 'users', current.uid), { role }, { merge: true }).catch(console.error);
    } else {
      get().loginAsGuest(role);
    }
  },

  setUser: (user) => set({ user }),

  logout: async () => {
    try {
      localStorage.removeItem('bukkit_active_user');
      await signOut(auth);
    } catch (e) {
      console.warn('Signout note:', e);
    }
    set({ user: null, authStatus: 'idle', authError: null, isLoading: false });
  },

  loginAsGuest: async (asRole: UserRole = 'customer', adminKey?: string) => {
    set({ isLoading: true, authStatus: 'loading', authError: null });
    if (asRole === 'admin') {
      const validKeys = ['MTU-ADMIN-2026', 'BUKKIT-ADMIN-88', 'ADMIN123', 'ADMIN', 'MTUADMIN'];
      if (!adminKey || !validKeys.includes(adminKey.trim().toUpperCase())) {
        const msg = 'Invalid Admin Passkey. Access Denied. (Default Key: MTU-ADMIN-2026)';
        set({ isLoading: false, authStatus: 'error', authError: msg });
        throw new Error(msg);
      }
    }

    const guestId = `guest_${asRole}_${Date.now().toString().slice(-4)}`;
    const guestUser: UserProfile = {
      uid: guestId,
      name: asRole === 'rider' ? 'Michael Rider (Campus Dispatch)' : asRole === 'admin' ? 'MTU Admin Manager' : 'Sarah Lawson',
      email: `${asRole}@mtu.edu.ng`,
      phone: '+234 812 345 6789',
      role: asRole,
      university_id: 'uni_mtu',
      campus_id: 'campus_mtu_main',
      avatar_url: asRole === 'rider'
        ? 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop'
        : asRole === 'admin'
        ? 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&auto=format&fit=crop'
        : 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&auto=format&fit=crop',
      address: 'Mountain Top University, Prayer City, Ogun State',
      latitude: 6.518,
      longitude: 3.372,
      created_at: new Date().toISOString()
    };
    set({ user: guestUser, role: asRole, isLoading: false, isEmailVerified: true, authStatus: 'success', authError: null });
    setDoc(doc(db, 'users', guestId), guestUser, { merge: true }).catch(console.error);
    return guestUser;
  }
}));

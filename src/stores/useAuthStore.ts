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
  isLoading: boolean;
  isEmailVerified: boolean;
  authStatus: AuthStatus;
  authError: string | null;

  initAuth: () => () => void;
  setRole: (role: UserRole) => void;
  setUser: (user: UserProfile | null) => void;
  resetAuthStatus: () => void;
  
  loginWithEmail: (email: string, pass: string, selectedRole?: UserRole, adminKey?: string) => Promise<void>;
  registerWithEmail: (data: {
    fullName: string;
    email: string;
    phone: string;
    password: string;
    universityId: string;
    campusId: string;
    role?: UserRole;
    adminKey?: string;
  }) => Promise<void>;
  loginWithGoogle: (targetRole?: UserRole) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  resendVerificationEmail: () => Promise<void>;
  reloadUser: () => Promise<boolean>;
  logout: () => Promise<void>;
  loginAsGuest: (asRole?: UserRole, adminKey?: string) => Promise<UserProfile>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  role: 'customer',
  isLoading: true,
  isEmailVerified: true,
  authStatus: 'idle',
  authError: null,

  resetAuthStatus: () => set({ authStatus: 'idle', authError: null }),

  initAuth: () => {
    set({ isLoading: true, authStatus: 'loading', authError: null });
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const isVerified = firebaseUser.emailVerified;
        set({ isEmailVerified: isVerified });
        try {
          const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
          if (userDoc.exists()) {
            const profile = userDoc.data() as UserProfile;
            set({
              user: profile,
              role: profile.role || 'customer',
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
              avatar_url: firebaseUser.photoURL || 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&auto=format&fit=crop',
              created_at: new Date().toISOString()
            };
            await setDoc(doc(db, 'users', firebaseUser.uid), newProfile);
            set({
              user: newProfile,
              isLoading: false,
              authStatus: isVerified ? 'success' : 'email-verification-required',
              authError: null
            });
          }
        } catch (e: any) {
          console.error('Failed to load user profile from Firestore:', e);
          const msg = translateFirebaseAuthError(e);
          set({ isLoading: false, authStatus: 'error', authError: msg });
        }
      } else {
        set({ user: null, isLoading: false, authStatus: 'idle', authError: null });
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

      const userCred = await signInWithEmailAndPassword(auth, email, password);
      const isVerified = userCred.user.emailVerified;
      set({ isEmailVerified: isVerified });

      const userDoc = await getDoc(doc(db, 'users', userCred.user.uid));
      
      let profile: UserProfile;
      if (userDoc.exists()) {
        profile = userDoc.data() as UserProfile;
        if (selectedRole && profile.role !== selectedRole) {
          profile.role = selectedRole;
          await setDoc(doc(db, 'users', userCred.user.uid), { role: selectedRole }, { merge: true });
        }
      } else {
        profile = {
          uid: userCred.user.uid,
          name: userCred.user.displayName || email.split('@')[0],
          email: email,
          phone: '+234 810 000 1122',
          role: selectedRole,
          university_id: 'uni_mtu',
          campus_id: 'campus_mtu_main',
          avatar_url: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(email)}`,
          created_at: new Date().toISOString()
        };
        await setDoc(doc(db, 'users', userCred.user.uid), profile);
      }

      set({
        user: profile,
        role: profile.role || selectedRole,
        isLoading: false,
        authStatus: isVerified ? 'success' : 'email-verification-required',
        authError: null
      });
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

      const userCred = await createUserWithEmailAndPassword(auth, email, password);
      
      // Send email verification
      if (userCred.user) {
        await sendEmailVerification(userCred.user);
        set({ isEmailVerified: userCred.user.emailVerified });
      }

      const newProfile: UserProfile = {
        uid: userCred.user.uid,
        name: fullName,
        email: email,
        phone: phone,
        role: role,
        university_id: universityId || 'uni_mtu',
        campus_id: campusId || 'campus_mtu_main',
        avatar_url: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(fullName)}`,
        created_at: new Date().toISOString()
      };

      await setDoc(doc(db, 'users', userCred.user.uid), newProfile);
      set({
        user: newProfile,
        role,
        isLoading: false,
        authStatus: 'email-verification-required',
        authError: null
      });
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

      const userDoc = await getDoc(doc(db, 'users', userCred.user.uid));
      let profile: UserProfile;
      if (userDoc.exists()) {
        profile = userDoc.data() as UserProfile;
        if (targetRole && profile.role !== targetRole) {
          profile.role = targetRole;
          await setDoc(doc(db, 'users', userCred.user.uid), { role: targetRole }, { merge: true });
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
        await setDoc(doc(db, 'users', userCred.user.uid), profile);
      }

      set({
        user: profile,
        role: profile.role || targetRole,
        isLoading: false,
        authStatus: isVerified ? 'success' : 'email-verification-required',
        authError: null
      });
    } catch (err: any) {
      const msg = translateFirebaseAuthError(err);
      set({ isLoading: false, authStatus: 'error', authError: msg });
      throw new Error(msg);
    }
  },

  resetPassword: async (email: string) => {
    set({ authStatus: 'loading', authError: null });
    try {
      await sendPasswordResetEmail(auth, email);
      set({ authStatus: 'success', authError: null });
    } catch (err: any) {
      const msg = translateFirebaseAuthError(err);
      set({ authStatus: 'error', authError: msg });
      throw new Error(msg);
    }
  },

  resendVerificationEmail: async () => {
    set({ authStatus: 'loading', authError: null });
    try {
      if (auth.currentUser) {
        await sendEmailVerification(auth.currentUser);
      }
      set({ authStatus: 'email-verification-required', authError: null });
    } catch (err: any) {
      const msg = translateFirebaseAuthError(err);
      set({ authStatus: 'error', authError: msg });
      throw new Error(msg);
    }
  },

  reloadUser: async () => {
    set({ authStatus: 'loading', authError: null });
    try {
      if (auth.currentUser) {
        await auth.currentUser.reload();
        const verified = auth.currentUser.emailVerified;
        set({
          isEmailVerified: verified,
          authStatus: verified ? 'success' : 'email-verification-required',
          authError: null
        });
        return verified;
      }
      set({ authStatus: 'idle', authError: null });
      return false;
    } catch (err: any) {
      const msg = translateFirebaseAuthError(err);
      set({ authStatus: 'error', authError: msg });
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
    await signOut(auth);
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

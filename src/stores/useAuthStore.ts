import { create } from 'zustand';
import { UserProfile, UserRole, Permission, CustomerProfile, RiderProfile, KitchenStaffProfile, AdminProfile } from '../types';
import { auth, db } from '../lib/firebase';
import { doc, getDoc, setDoc, updateDoc, onSnapshot } from 'firebase/firestore';
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
import { resolveAuthoritativeUserProfile, findUserProfileByEmail, checkUserExistsInDatabase, getRolePermissions, hasPermission as checkPermission } from '../services/authService';

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
  setRole: (role: UserRole) => boolean;
  setUser: (user: UserProfile | null) => void;
  resetAuthStatus: () => void;
  hasPermission: (permission: Permission) => boolean;

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
    vendorId?: string;
    vehicleType?: 'bicycle' | 'motorcycle' | 'walking' | 'scooter';
  }) => Promise<UserProfile>;
  loginWithGoogle: (targetRole?: UserRole, isSignUpFlow?: boolean) => Promise<UserProfile>;
  resetPassword: (email: string) => Promise<void>;
  resendVerificationEmail: () => Promise<void>;
  reloadUser: () => Promise<boolean>;
  logout: () => Promise<void>;
  loginAsGuest: (asRole?: UserRole, adminKey?: string) => Promise<UserProfile>;
  updateProfileDetails: (updates: Partial<UserProfile>) => Promise<void>;
  toggleRiderOnlineStatus: (isOnline: boolean) => Promise<void>;
  topUpWallet: (amount: number, reference?: string) => Promise<number>;
  deductWallet: (amount: number, description?: string) => Promise<boolean>;
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

  hasPermission: (permission: Permission) => {
    const user = get().user;
    if (!user) return false;
    return checkPermission(user, permission);
  },

  setRole: (targetRole: UserRole) => {
    const user = get().user;
    if (!user) {
      set({ role: targetRole });
      return true;
    }

    // Strict Account Role Enforcement: An account is strictly bound to its assigned role.
    // Only super_admin or admin accounts can switch roles for testing/governance.
    const isAdmin = user.role === 'admin' || user.role === 'super_admin' || user.roles?.includes('admin') || user.roles?.includes('super_admin');
    const isUserAssignedRole = user.roles?.includes(targetRole) || user.role === targetRole;

    if (!isAdmin && !isUserAssignedRole) {
      console.warn(`[Security Guard] Access Denied: User ${user.uid} with role '${user.role}' cannot switch to '${targetRole}'`);
      return false;
    }

    const updatedUser: UserProfile = {
      ...user,
      active_role: targetRole,
      role: targetRole,
      permissions: getRolePermissions(targetRole)
    };

    try {
      localStorage.setItem('bukkit_active_user', JSON.stringify(updatedUser));
      updateDoc(doc(db, 'users', user.uid), { active_role: targetRole }).catch(() => {});
    } catch (e) {}

    set({ user: updatedUser, role: targetRole });
    return true;
  },

  setUser: (user) => {
    if (user) {
      set({ user, role: user.active_role || user.role || 'customer' });
      try {
        localStorage.setItem('bukkit_active_user', JSON.stringify(user));
      } catch (e) {}
    } else {
      set({ user: null });
      try {
        localStorage.removeItem('bukkit_active_user');
      } catch (e) {}
    }
  },

  initAuth: () => {
    set({ isInitLoading: true, authError: null });

    // Check local session first
    try {
      const savedUserStr = localStorage.getItem('bukkit_active_user');
      if (savedUserStr) {
        const parsed = JSON.parse(savedUserStr);
        if (parsed && parsed.uid) {
          set({
            user: parsed,
            role: parsed.active_role || parsed.role || 'customer',
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
          // Resolve from database
          let profile = await resolveAuthoritativeUserProfile(firebaseUser.uid) || await findUserProfileByEmail(firebaseUser.email || '');
          
          if (!profile) {
            // Check if we have a locally stored session that matches
            const saved = localStorage.getItem('bukkit_active_user');
            if (saved) {
              try {
                const parsed = JSON.parse(saved);
                if (parsed && (parsed.uid === firebaseUser.uid || parsed.email === firebaseUser.email)) {
                  profile = parsed;
                }
              } catch (e) {}
            }
          }

          if (profile) {
            try {
              localStorage.setItem('bukkit_active_user', JSON.stringify(profile));
            } catch (e) {}

            set({
              user: profile,
              role: profile.active_role || profile.role || 'customer',
              isInitLoading: false,
              isLoading: false,
              authStatus: isVerified ? 'success' : 'email-verification-required',
              authError: null
            });
          } else {
            // User does not exist in database (no auto-creation)
            set({
              user: null,
              role: 'customer',
              isInitLoading: false,
              isLoading: false,
              authStatus: 'idle',
              authError: null
            });
          }
        } catch (e: any) {
          console.error('Failed to load user profile from database:', e);
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

  loginWithEmail: async (email, password, _requestedRole, adminKey) => {
    set({ isLoading: true, authStatus: 'loading', authError: null });
    const cleanEmail = email.trim();

    try {
      // Step 1: Pre-check if an account exists in the database for this email
      const existingDbProfile = await findUserProfileByEmail(cleanEmail);

      let profile: UserProfile | null = null;

      try {
        const userCred = await signInWithEmailAndPassword(auth, cleanEmail, password);
        const isVerified = userCred.user.emailVerified;
        set({ isEmailVerified: isVerified });

        const resolved = await resolveAuthoritativeUserProfile(userCred.user.uid) || existingDbProfile;
        if (!resolved) {
          // User authenticated in Firebase but NOT registered in BUKKIT database
          await signOut(auth).catch(() => {});
          throw new Error('No BUKKIT account found with this email. Please sign up first.');
        }

        profile = resolved;

        // Verify admin credentials if account is Admin
        if (profile.role === 'admin' || profile.role === 'super_admin') {
          const validKeys = ['MTU-ADMIN-2026', 'BUKKIT-ADMIN-88', 'ADMIN123', 'ADMIN', 'MTUADMIN'];
          if (adminKey && !validKeys.includes(adminKey.trim().toUpperCase())) {
            throw new Error('Invalid Admin Passkey. Access Denied.');
          }
        }

        await updateDoc(doc(db, 'users', userCred.user.uid), {
          last_login_at: new Date().toISOString()
        }).catch(() => {});

      } catch (authErr: any) {
        if (authErr?.code === 'auth/operation-not-allowed' || authErr?.message?.includes('operation-not-allowed')) {
          // If Firebase Email/Password provider is not active, check if the account was registered in the database
          if (!existingDbProfile) {
            throw new Error('No account found with this email address. Please sign up first.');
          }
          profile = existingDbProfile;
        } else if (authErr?.code === 'auth/user-not-found' || authErr?.code === 'auth/invalid-credential') {
          if (!existingDbProfile) {
            throw new Error('No account found with this email address. Please sign up first.');
          } else {
            throw new Error('Incorrect password. Please verify your password and try again.');
          }
        } else {
          throw authErr;
        }
      }

      if (!profile) {
        throw new Error('No account found with this email. Please sign up first.');
      }

      const authoritativeRole = profile.active_role || profile.role || 'customer';

      try {
        localStorage.setItem('bukkit_active_user', JSON.stringify(profile));
        fetch('/api/users/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            uid: profile.uid,
            email: profile.email,
            name: profile.name,
            phone: profile.phone,
            role: authoritativeRole,
            universityId: profile.university_id,
            campusId: profile.campus_id,
            avatarUrl: profile.avatar_url,
          }),
        }).catch(err => console.warn('Cloud SQL user sync warning:', err));
      } catch (e) {}

      set({
        user: profile,
        role: authoritativeRole,
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

  registerWithEmail: async ({ fullName, email, phone, password, universityId, campusId, role = 'customer', adminKey, vendorId, vehicleType }) => {
    set({ isLoading: true, authStatus: 'loading', authError: null });
    const cleanEmail = email.trim();

    try {
      if (role === 'admin' || role === 'super_admin') {
        const validKeys = ['MTU-ADMIN-2026', 'BUKKIT-ADMIN-88', 'ADMIN123', 'ADMIN', 'MTUADMIN'];
        if (!adminKey || !validKeys.includes(adminKey.trim().toUpperCase())) {
          throw new Error('Invalid Admin Passkey. Access Denied. (Default Key: MTU-ADMIN-2026)');
        }
      }

      // Step 1: Check if an account already exists in database with this email
      const existingInDb = await findUserProfileByEmail(cleanEmail);
      if (existingInDb) {
        throw new Error('An account already exists with this email address. Please switch to Log In.');
      }

      let createdUid = `user_${Date.now()}`;
      let isEmailVerified = false;

      try {
        const userCred = await createUserWithEmailAndPassword(auth, cleanEmail, password);
        createdUid = userCred.user.uid;
        isEmailVerified = userCred.user.emailVerified;

        if (userCred.user) {
          try {
            await sendEmailVerification(userCred.user);
            set({ isEmailVerified: userCred.user.emailVerified });
          } catch (verErr) {
            console.warn('Email verification send notice:', verErr);
          }
        }
      } catch (authErr: any) {
        if (authErr?.code === 'auth/email-already-in-use') {
          throw new Error('An account already exists with this email address. Please switch to Log In.');
        }
        if (authErr?.code === 'auth/operation-not-allowed' || authErr?.message?.includes('operation-not-allowed')) {
          console.warn('Firebase Auth fallback active.');
          createdUid = `user_${btoa(cleanEmail).replace(/[^a-zA-Z0-9]/g, '').slice(0, 16) || Date.now()}`;
          isEmailVerified = true;
        } else {
          throw authErr;
        }
      }

      const now = new Date().toISOString();
      const newProfile: UserProfile = {
        id: createdUid,
        uid: createdUid,
        name: fullName.trim(),
        first_name: fullName.trim().split(' ')[0],
        last_name: fullName.trim().split(' ').slice(1).join(' '),
        email: cleanEmail,
        phone: phone.trim(),
        status: 'active',
        email_verified: isEmailVerified,
        phone_verified: false,
        roles: [role],
        active_role: role,
        role: role,
        permissions: getRolePermissions(role),
        university_id: universityId || 'uni_mtu',
        campus_id: campusId || 'campus_mtu_main',
        vendor_id: (role === 'kitchen' || role === 'kitchen_manager' || role === 'kitchen_staff') ? (vendorId || 'vendor_mtu_canteen') : undefined,
        avatar_url: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(fullName)}`,
        created_at: now,
        updated_at: now,
        last_login_at: now
      };

      // Create main user document in Firestore
      await setDoc(doc(db, 'users', createdUid), newProfile);

      // Create dedicated role profile
      if (role === 'rider') {
        const riderProf: RiderProfile = {
          rider_id: createdUid,
          user_id: createdUid,
          full_name: fullName.trim() || 'Campus Rider',
          phone: phone || '+234 810 000 0000',
          vehicle_type: (vehicleType as any) || 'motorcycle',
          availability_status: 'available',
          is_online: true,
          is_verified: true,
          rating: 5.0,
          completed_deliveries: 0,
          total_deliveries: 0,
          earnings_balance: 0,
          university_id: universityId || 'uni_mtu',
          campus_id: campusId || 'campus_mtu_main',
          created_at: now,
          updated_at: now
        };
        await setDoc(doc(db, 'rider_profiles', createdUid), riderProf);
        newProfile.rider_profile = riderProf;
      } else if (role === 'kitchen' || role === 'kitchen_manager' || role === 'kitchen_staff') {
        const kitchenProf: KitchenStaffProfile = {
          user_id: createdUid,
          vendor_id: vendorId || 'rest_ronalds',
          vendor_name: "Ronald's Food House",
          role: role as any,
          permissions: getRolePermissions(role),
          shift_status: 'on_duty',
          created_at: now,
          updated_at: now
        };
        await setDoc(doc(db, 'kitchen_staff_profiles', createdUid), kitchenProf);
        newProfile.kitchen_profile = kitchenProf;
      } else if (role === 'admin' || role === 'super_admin') {
        const adminProf: AdminProfile = {
          user_id: createdUid,
          department: 'Platform Operations',
          is_super_admin: role === 'super_admin',
          permissions: getRolePermissions(role),
          created_at: now,
          updated_at: now
        };
        await setDoc(doc(db, 'admin_profiles', createdUid), adminProf);
        newProfile.admin_profile = adminProf;
      } else {
        const custProf: CustomerProfile = {
          user_id: createdUid,
          default_address: 'Mountain Top University',
          university_id: universityId || 'uni_mtu',
          campus_id: campusId || 'campus_mtu_main',
          loyalty_points: 50,
          favorite_vendor_ids: [],
          created_at: now,
          updated_at: now
        };
        await setDoc(doc(db, 'customer_profiles', createdUid), custProf);
        newProfile.customer_profile = custProf;
      }

      try {
        localStorage.setItem('bukkit_active_user', JSON.stringify(newProfile));
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
        }).catch(err => console.warn('Cloud SQL sync notice:', err));
      } catch (e) {}

      set({
        user: newProfile,
        role,
        isLoading: false,
        authStatus: isEmailVerified ? 'success' : 'email-verification-required',
        authError: null
      });

      return newProfile;
    } catch (err: any) {
      const msg = translateFirebaseAuthError(err);
      set({ isLoading: false, authStatus: 'error', authError: msg });
      throw new Error(msg);
    }
  },

  loginWithGoogle: async (targetRole = 'customer', isSignUpFlow = false) => {
    set({ isLoading: true, authStatus: 'loading', authError: null });
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const isVerified = result.user.emailVerified;
      set({ isEmailVerified: isVerified });

      let profile = await resolveAuthoritativeUserProfile(result.user.uid) || await findUserProfileByEmail(result.user.email || '');

      if (!isSignUpFlow) {
        // User clicked "Log In" with Google
        if (!profile) {
          await signOut(auth).catch(() => {});
          throw new Error(`No BUKKIT account found for ${result.user.email || 'this Google account'}. Please click "Create Account / Sign Up" first.`);
        }
      } else {
        // User clicked "Sign Up" with Google
        if (!profile) {
          const now = new Date().toISOString();
          profile = {
            id: result.user.uid,
            uid: result.user.uid,
            name: result.user.displayName || 'BUKKIT User',
            first_name: result.user.displayName?.split(' ')[0] || 'BUKKIT',
            last_name: result.user.displayName?.split(' ').slice(1).join(' ') || 'User',
            email: result.user.email || '',
            phone: result.user.phoneNumber || '+234 810 000 1122',
            status: 'active',
            email_verified: isVerified,
            phone_verified: false,
            roles: [targetRole],
            active_role: targetRole,
            role: targetRole,
            permissions: getRolePermissions(targetRole),
            university_id: 'uni_mtu',
            campus_id: 'campus_mtu_main',
            avatar_url: result.user.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(result.user.email || 'user')}`,
            created_at: now,
            updated_at: now,
            last_login_at: now
          };
          await setDoc(doc(db, 'users', result.user.uid), profile);

          if (targetRole === 'customer') {
            await setDoc(doc(db, 'customer_profiles', result.user.uid), {
              user_id: result.user.uid,
              default_address: 'Mountain Top University',
              university_id: 'uni_mtu',
              campus_id: 'campus_mtu_main',
              loyalty_points: 50,
              favorite_vendor_ids: [],
              created_at: now,
              updated_at: now
            });
          }
        }
      }

      try {
        localStorage.setItem('bukkit_active_user', JSON.stringify(profile));
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
        role: profile.active_role || targetRole,
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

  resetPassword: async (email: string) => {
    try {
      await sendPasswordResetEmail(auth, email.trim());
    } catch (err: any) {
      throw new Error(translateFirebaseAuthError(err));
    }
  },

  resendVerificationEmail: async () => {
    if (auth.currentUser) {
      await sendEmailVerification(auth.currentUser);
    }
  },

  reloadUser: async () => {
    if (auth.currentUser) {
      await auth.currentUser.reload();
      const isVerified = auth.currentUser.emailVerified;
      set({ isEmailVerified: isVerified });
      return isVerified;
    }
    return true;
  },

  logout: async () => {
    try {
      await signOut(auth);
    } catch (e) {}
    try {
      localStorage.removeItem('bukkit_active_user');
    } catch (e) {}
    set({ user: null, role: 'customer', authStatus: 'idle', authError: null });
  },

  loginAsGuest: async (asRole = 'customer', adminKey) => {
    if (asRole === 'admin' || asRole === 'super_admin') {
      const validKeys = ['MTU-ADMIN-2026', 'BUKKIT-ADMIN-88', 'ADMIN123', 'ADMIN', 'MTUADMIN'];
      if (!adminKey || !validKeys.includes(adminKey.trim().toUpperCase())) {
        throw new Error('Invalid Admin Passkey. Access Denied. (Default Key: MTU-ADMIN-2026)');
      }
    }

    const guestUid = `guest_${asRole}_${Date.now()}`;
    const guestProfile: UserProfile = {
      id: guestUid,
      uid: guestUid,
      name: asRole === 'admin' ? 'MTU Campus Administrator' : asRole === 'kitchen' ? 'Ronalds Kitchen Chef' : asRole === 'rider' ? 'Speedy Campus Rider' : 'Campus Student (Guest)',
      first_name: asRole === 'admin' ? 'MTU' : asRole === 'kitchen' ? 'Chef' : asRole === 'rider' ? 'Rider' : 'Student',
      last_name: 'Guest',
      email: `${asRole}.guest@mtu.edu.ng`,
      phone: '+234 810 555 9988',
      status: 'active',
      email_verified: true,
      phone_verified: true,
      roles: [asRole],
      active_role: asRole,
      role: asRole,
      permissions: getRolePermissions(asRole),
      university_id: 'uni_mtu',
      campus_id: 'campus_mtu_main',
      avatar_url: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(guestUid)}`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      last_login_at: new Date().toISOString(),
      kitchen_profile: asRole === 'kitchen' ? {
        user_id: guestUid,
        vendor_id: 'rest_ronalds',
        vendor_name: "Ronald's Food House",
        role: 'kitchen_manager',
        permissions: getRolePermissions('kitchen'),
        shift_status: 'on_duty',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      } : undefined,
      rider_profile: asRole === 'rider' ? {
        rider_id: guestUid,
        user_id: guestUid,
        full_name: 'Campus Dispatch Courier',
        phone: '+234 812 345 6789',
        vehicle_type: 'motorcycle',
        availability_status: 'available',
        is_online: true,
        is_verified: true,
        rating: 4.9,
        completed_deliveries: 42,
        total_deliveries: 42,
        earnings_balance: 14500,
        university_id: 'uni_mtu',
        campus_id: 'campus_mtu_main',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      } : undefined,
      admin_profile: asRole === 'admin' ? {
        user_id: guestUid,
        department: 'Student Affairs & Logistics',
        is_super_admin: true,
        permissions: getRolePermissions('admin'),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      } : undefined
    };

    try {
      localStorage.setItem('bukkit_active_user', JSON.stringify(guestProfile));
      await setDoc(doc(db, 'users', guestUid), guestProfile);
    } catch (e) {}

    set({
      user: guestProfile,
      role: asRole,
      isInitLoading: false,
      isLoading: false,
      authStatus: 'success',
      authError: null
    });

    return guestProfile;
  },

  updateProfileDetails: async (updates) => {
    const user = get().user;
    if (!user) return;
    const updated = { ...user, ...updates, updated_at: new Date().toISOString() };
    try {
      localStorage.setItem('bukkit_active_user', JSON.stringify(updated));
      await updateDoc(doc(db, 'users', user.uid), updates);
      set({ user: updated });
    } catch (e) {
      console.error('Failed to update profile:', e);
    }
  },

  toggleRiderOnlineStatus: async (isOnline) => {
    const user = get().user;
    if (!user) return;
    const updated = { ...user, is_online: isOnline };
    if (updated.rider_profile) {
      updated.rider_profile.is_online = isOnline;
    }
    set({ user: updated });
    try {
      localStorage.setItem('bukkit_active_user', JSON.stringify(updated));
      await updateDoc(doc(db, 'users', user.uid), { is_online: isOnline });
      await setDoc(doc(db, 'rider_profiles', user.uid), { is_online: isOnline }, { merge: true });
    } catch (e) {}
  },

  topUpWallet: async (amount: number, reference?: string) => {
    const user = get().user;
    if (!user || amount <= 0) return user?.wallet_balance || 0;

    const currentBal = user.wallet_balance || 0;
    const newBal = currentBal + amount;
    const updatedUser: UserProfile = { ...user, wallet_balance: newBal };

    set({ user: updatedUser });

    try {
      localStorage.setItem('bukkit_active_user', JSON.stringify(updatedUser));
      await updateDoc(doc(db, 'users', user.uid), { wallet_balance: newBal });

      const txId = `tx_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
      await setDoc(doc(db, 'wallet_transactions', txId), {
        id: txId,
        user_id: user.uid,
        type: 'credit',
        amount,
        description: 'Campus Digital Wallet Top-Up',
        reference: reference || `TOPUP_${Date.now()}`,
        status: 'successful',
        created_at: new Date().toISOString()
      });
    } catch (err) {
      console.warn('Wallet top-up firestore sync notice:', err);
    }

    return newBal;
  },

  deductWallet: async (amount: number, description = 'Campus Food Order Payment') => {
    const user = get().user;
    if (!user) return false;

    const currentBal = user.wallet_balance || 0;
    if (currentBal < amount) {
      return false;
    }

    const newBal = currentBal - amount;
    const updatedUser: UserProfile = { ...user, wallet_balance: newBal };

    set({ user: updatedUser });

    try {
      localStorage.setItem('bukkit_active_user', JSON.stringify(updatedUser));
      await updateDoc(doc(db, 'users', user.uid), { wallet_balance: newBal });

      const txId = `tx_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
      await setDoc(doc(db, 'wallet_transactions', txId), {
        id: txId,
        user_id: user.uid,
        type: 'debit',
        amount,
        description,
        status: 'successful',
        created_at: new Date().toISOString()
      });
    } catch (err) {
      console.warn('Wallet deduction firestore sync notice:', err);
    }

    return true;
  }
}));

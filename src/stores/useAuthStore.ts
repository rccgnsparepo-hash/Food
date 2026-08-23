import { create } from 'zustand';
import { UserProfile, UserRole, Permission, CustomerProfile, RiderProfile, KitchenStaffProfile, AdminProfile } from '../types';
import { auth, db, cleanFirestoreData } from '../lib/firebase';
import { doc, getDoc, setDoc, updateDoc, onSnapshot } from "../lib/embeddedDb";
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
import { deactivateDeviceToken } from '../services/fcmDeviceService';

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
  loginWithGoogle: (targetRole?: UserRole, isSignUpFlow?: boolean, adminKey?: string) => Promise<UserProfile>;
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

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const isVerified = firebaseUser.emailVerified;
        set({ isEmailVerified: isVerified });

        // HARD ENFORCEMENT: If email is not verified, block app entry
        if (!isVerified) {
          try {
            localStorage.removeItem('bukkit_active_user');
          } catch (e) {}
          set({
            user: null,
            role: 'customer',
            isInitLoading: false,
            isLoading: false,
            isEmailVerified: false,
            authStatus: 'email-verification-required',
            authError: 'Your email address is not verified yet. Please check your inbox and verify your email to log in.'
          });
          return;
        }

        try {
          // Resolve from database with cache resilience
          let profile = await resolveAuthoritativeUserProfile(firebaseUser.uid) || await findUserProfileByEmail(firebaseUser.email || '');

          if (!profile) {
            // Check local cached profile
            try {
              const raw = localStorage.getItem('bukkit_active_user');
              if (raw) {
                const parsed = JSON.parse(raw);
                if (parsed && (parsed.uid === firebaseUser.uid || parsed.id === firebaseUser.uid)) {
                  profile = parsed;
                }
              }
            } catch (e) {}
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
              authStatus: 'success',
              authError: null
            });
          } else {
            // User authenticated in Firebase but has no profile in Firestore
            try {
              localStorage.removeItem('bukkit_active_user');
            } catch (e) {}
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
          console.warn('Notice loading user profile (non-blocking offline handling):', e);
          // Check local storage before erroring out
          try {
            const raw = localStorage.getItem('bukkit_active_user');
            if (raw) {
              const parsed = JSON.parse(raw);
              if (parsed && (parsed.uid === firebaseUser.uid || parsed.id === firebaseUser.uid)) {
                set({
                  user: parsed,
                  role: parsed.active_role || parsed.role || 'customer',
                  isInitLoading: false,
                  isLoading: false,
                  authStatus: 'success',
                  authError: null
                });
                return;
              }
            }
          } catch (storageErr) {}

          const msg = translateFirebaseAuthError(e);
          set({ isInitLoading: false, isLoading: false, authStatus: 'idle', authError: null });
        }
      } else {
        // Explicitly clear local session if Firebase Auth has no active user
        try {
          localStorage.removeItem('bukkit_active_user');
        } catch (e) {}
        set({ user: null, isInitLoading: false, isLoading: false, authStatus: 'idle', authError: null });
      }
    });

    return unsubscribe;
  },

  loginWithEmail: async (email, password, _requestedRole, adminKey) => {
    set({ isLoading: true, authStatus: 'loading', authError: null });
    const cleanEmail = email.trim();

    try {
      // 1. Strict authentication with Firebase Authentication
      const userCred = await signInWithEmailAndPassword(auth, cleanEmail, password);
      const isVerified = userCred.user.emailVerified;
      set({ isEmailVerified: isVerified });

      // HARD BLOCK: If email is NOT verified, refuse login and require verification
      if (!isVerified) {
        set({
          user: null,
          isLoading: false,
          authStatus: 'email-verification-required',
          authError: 'Your email address is not verified yet. Please check your inbox and click the verification link before logging in.'
        });
        const err: any = new Error('Email not verified. Please verify your email before accessing BUKKIT.');
        err.code = 'auth/email-not-verified';
        throw err;
      }

      // 2. Fetch authoritative user profile from database
      const profile = await resolveAuthoritativeUserProfile(userCred.user.uid) || await findUserProfileByEmail(cleanEmail);
      if (!profile) {
        // User exists in Firebase Auth but has no registered profile in the database
        await signOut(auth).catch(() => {});
        throw new Error('No BUKKIT account found with this email. Please sign up first.');
      }

      // 3. Verify admin credentials if account has Admin privileges
      if (profile.role === 'admin' || profile.role === 'super_admin') {
        const validKeys = ['MTU-ADMIN-2026', 'BUKKIT-ADMIN-88', 'ADMIN123', 'ADMIN', 'MTUADMIN'];
        if (adminKey && !validKeys.includes(adminKey.trim().toUpperCase())) {
          await signOut(auth).catch(() => {});
          throw new Error('Invalid Admin Passkey. Access Denied.');
        }
      }

      await updateDoc(doc(db, 'users', userCred.user.uid), {
        last_login_at: new Date().toISOString()
      }).catch(() => {});

      const authoritativeRole = profile.active_role || profile.role || 'customer';

      try {
        localStorage.setItem('bukkit_active_user', JSON.stringify(profile));
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
      try {
        localStorage.removeItem('bukkit_active_user');
      } catch (e) {}
      const msg = translateFirebaseAuthError(err);
      if (err.code !== 'auth/email-not-verified') {
        set({ user: null, isLoading: false, authStatus: 'error', authError: msg });
      }
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

      // Pre-save pending registration role in local & session storage BEFORE auth state fires
      try {
        localStorage.setItem('bukkit_pending_registration_role', role);
        sessionStorage.setItem('bukkit_pending_registration_role', role);
        localStorage.setItem(`bukkit_pending_email_role_${cleanEmail.toLowerCase()}`, role);
        sessionStorage.setItem(`bukkit_pending_email_role_${cleanEmail.toLowerCase()}`, role);
      } catch (e) {}

      // Register user directly in active Firebase Authentication
      const userCred = await createUserWithEmailAndPassword(auth, cleanEmail, password);
      const createdUid = userCred.user.uid;
      const isEmailVerified = userCred.user.emailVerified;

      // Save pending registration role with UID in local & session storage
      try {
        localStorage.setItem(`bukkit_pending_role_${createdUid}`, role);
        sessionStorage.setItem(`bukkit_pending_role_${createdUid}`, role);
      } catch (e) {}

      // Dispatch email verification link immediately
      if (userCred.user) {
        try {
          await sendEmailVerification(userCred.user);
        } catch (verErr) {
          console.warn('Email verification send notice:', verErr);
        }
      }
      set({ isEmailVerified: userCred.user.emailVerified });

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

      // Prepare sub-profile based on role
      let subProfilePromise: Promise<any> = Promise.resolve();
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
        newProfile.rider_profile = riderProf;
        subProfilePromise = setDoc(doc(db, 'rider_profiles', createdUid), cleanFirestoreData(riderProf)).catch(e => console.warn('Rider profile sync:', e));
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
        newProfile.kitchen_profile = kitchenProf;
        subProfilePromise = setDoc(doc(db, 'kitchen_staff_profiles', createdUid), cleanFirestoreData(kitchenProf)).catch(e => console.warn('Kitchen profile sync:', e));
      } else if (role === 'admin' || role === 'super_admin') {
        const adminProf: AdminProfile = {
          user_id: createdUid,
          department: 'Platform Operations',
          is_super_admin: role === 'super_admin',
          permissions: getRolePermissions(role),
          created_at: now,
          updated_at: now
        };
        newProfile.admin_profile = adminProf;
        subProfilePromise = setDoc(doc(db, 'admin_profiles', createdUid), cleanFirestoreData(adminProf)).catch(e => console.warn('Admin profile sync:', e));
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
        newProfile.customer_profile = custProf;
        subProfilePromise = setDoc(doc(db, 'customer_profiles', createdUid), cleanFirestoreData(custProf)).catch(e => console.warn('Customer profile sync:', e));
      }

      // Save main document & role document with safe timeout/catch
      await Promise.all([
        setDoc(doc(db, 'users', createdUid), cleanFirestoreData(newProfile)).catch(e => console.warn('User doc sync:', e)),
        subProfilePromise
      ]);

      // If user is unverified, DO NOT persist into local storage or set as active logged in user
      if (!isEmailVerified) {
        try {
          localStorage.removeItem('bukkit_active_user');
        } catch (e) {}
        set({
          user: null,
          role,
          isLoading: false,
          isEmailVerified: false,
          authStatus: 'email-verification-required',
          authError: null
        });
        return newProfile;
      }

      try {
        localStorage.setItem('bukkit_active_user', JSON.stringify(newProfile));
      } catch (e) {}

      set({
        user: newProfile,
        role,
        isLoading: false,
        isEmailVerified: true,
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

  loginWithGoogle: async (targetRole = 'customer', isSignUpFlow = false, adminKey?: string) => {
    set({ isLoading: true, authStatus: 'loading', authError: null });
    try {
      if (isSignUpFlow && (targetRole === 'admin' || targetRole === 'super_admin')) {
        const validKeys = ['MTU-ADMIN-2026', 'BUKKIT-ADMIN-88', 'ADMIN123', 'ADMIN', 'MTUADMIN'];
        if (!adminKey || !validKeys.includes(adminKey.trim().toUpperCase())) {
          throw new Error('Invalid Admin Passkey. Access Denied. (Default Key: MTU-ADMIN-2026)');
        }
      }

      // Pre-save pending Google role in local & session storage BEFORE popup
      try {
        localStorage.setItem('bukkit_pending_google_role', targetRole);
        sessionStorage.setItem('bukkit_pending_google_role', targetRole);
        localStorage.setItem('bukkit_pending_google_is_signup', isSignUpFlow ? 'true' : 'false');
      } catch (e) {}

      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const isVerified = result.user.emailVerified;
      set({ isEmailVerified: isVerified });

      let profile = await resolveAuthoritativeUserProfile(result.user.uid) || await findUserProfileByEmail(result.user.email || '');

      if (!isSignUpFlow) {
        // User clicked "Log In" with Google
        if (!profile) {
          await signOut(auth).catch(() => {});
          throw new Error(`No existing BUKKIT account found for ${result.user.email || 'this Google account'}. Please select your account type and sign up.`);
        }
      } else {
        // User clicked "Sign Up" with Google - create or enforce the selected targetRole
        const now = new Date().toISOString();
        const fullName = result.user.displayName || 'BUKKIT User';
        
        // If profile didn't exist OR was created as default customer during signup race, construct authoritative profile
        if (!profile || (profile.role !== targetRole && isSignUpFlow)) {
          profile = {
            id: result.user.uid,
            uid: result.user.uid,
            name: fullName,
            first_name: fullName.split(' ')[0] || 'BUKKIT',
            last_name: fullName.split(' ').slice(1).join(' ') || 'User',
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
            vendor_id: (targetRole === 'kitchen' || targetRole === 'kitchen_manager' || targetRole === 'kitchen_staff') ? 'vendor_mtu_canteen' : undefined,
            avatar_url: result.user.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(result.user.email || 'user')}`,
            created_at: profile?.created_at || now,
            updated_at: now,
            last_login_at: now
          };

          let subProfilePromise: Promise<any> = Promise.resolve();
          if (targetRole === 'rider') {
            const riderProf: RiderProfile = {
              rider_id: result.user.uid,
              user_id: result.user.uid,
              full_name: fullName,
              phone: result.user.phoneNumber || '+234 810 000 1122',
              vehicle_type: 'motorcycle',
              availability_status: 'available',
              is_online: true,
              is_verified: true,
              rating: 5.0,
              completed_deliveries: 0,
              total_deliveries: 0,
              earnings_balance: 0,
              university_id: 'uni_mtu',
              campus_id: 'campus_mtu_main',
              created_at: now,
              updated_at: now
            };
            profile.rider_profile = riderProf;
            subProfilePromise = setDoc(doc(db, 'rider_profiles', result.user.uid), cleanFirestoreData(riderProf)).catch(() => {});
          } else if (targetRole === 'kitchen' || targetRole === 'kitchen_manager' || targetRole === 'kitchen_staff') {
            const kitchenProf: KitchenStaffProfile = {
              user_id: result.user.uid,
              vendor_id: 'rest_ronalds',
              vendor_name: "Ronald's Food House",
              role: targetRole as any,
              permissions: getRolePermissions(targetRole),
              shift_status: 'on_duty',
              created_at: now,
              updated_at: now
            };
            profile.kitchen_profile = kitchenProf;
            subProfilePromise = setDoc(doc(db, 'kitchen_staff_profiles', result.user.uid), cleanFirestoreData(kitchenProf)).catch(() => {});
          } else if (targetRole === 'admin' || targetRole === 'super_admin') {
            const adminProf: AdminProfile = {
              user_id: result.user.uid,
              department: 'Platform Operations',
              is_super_admin: targetRole === 'super_admin',
              permissions: getRolePermissions(targetRole),
              created_at: now,
              updated_at: now
            };
            profile.admin_profile = adminProf;
            subProfilePromise = setDoc(doc(db, 'admin_profiles', result.user.uid), cleanFirestoreData(adminProf)).catch(() => {});
          } else {
            const custProf: CustomerProfile = {
              user_id: result.user.uid,
              default_address: 'Mountain Top University',
              university_id: 'uni_mtu',
              campus_id: 'campus_mtu_main',
              loyalty_points: 50,
              favorite_vendor_ids: [],
              created_at: now,
              updated_at: now
            };
            profile.customer_profile = custProf;
            subProfilePromise = setDoc(doc(db, 'customer_profiles', result.user.uid), cleanFirestoreData(custProf)).catch(() => {});
          }

          await Promise.all([
            setDoc(doc(db, 'users', result.user.uid), cleanFirestoreData(profile)),
            subProfilePromise
          ]);
        }
      }

      // Cleanup pending role helpers
      try {
        localStorage.removeItem('bukkit_pending_google_role');
        sessionStorage.removeItem('bukkit_pending_google_role');
        localStorage.removeItem('bukkit_pending_google_is_signup');
      } catch (e) {}

      // Authoritative role from profile
      const authoritativeRole = profile.active_role || profile.role || targetRole;

      try {
        localStorage.setItem('bukkit_active_user', JSON.stringify(profile));
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

      if (isVerified) {
        try {
          // Update user document status
          const { doc, updateDoc, setDoc } = await import('../lib/embeddedDb');
          try {
            await updateDoc(doc(db, 'users', auth.currentUser.uid), {
              email_verified: true,
              status: 'active',
              updated_at: new Date().toISOString()
            });
          } catch (uErr) {
            // Ignore if doc doesn't exist yet
          }

          let profile = await resolveAuthoritativeUserProfile(auth.currentUser.uid) || await findUserProfileByEmail(auth.currentUser.email || '');
          if (!profile) {
            // Check if there was a pending registration role stored
            let detectedRole: UserRole = 'customer';
            try {
              const pRole = localStorage.getItem(`bukkit_pending_role_${auth.currentUser.uid}`) || sessionStorage.getItem(`bukkit_pending_role_${auth.currentUser.uid}`);
              if (pRole && ['customer', 'rider', 'kitchen', 'admin', 'kitchen_manager', 'kitchen_staff', 'super_admin'].includes(pRole)) {
                detectedRole = pRole as UserRole;
              }
            } catch (e) {}

            const now = new Date().toISOString();
            const emailVal = auth.currentUser.email || '';
            profile = {
              id: auth.currentUser.uid,
              uid: auth.currentUser.uid,
              email: emailVal,
              phone: auth.currentUser.phoneNumber || '',
              first_name: auth.currentUser.displayName?.split(' ')[0] || 'BUKKIT',
              last_name: auth.currentUser.displayName?.split(' ').slice(1).join(' ') || 'User',
              name: auth.currentUser.displayName || 'BUKKIT User',
              avatar_url: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(emailVal)}`,
              status: 'active',
              email_verified: true,
              phone_verified: false,
              created_at: now,
              updated_at: now,
              last_login_at: now,
              roles: [detectedRole],
              active_role: detectedRole,
              role: detectedRole,
              permissions: getRolePermissions(detectedRole),
              university_id: 'uni_mtu',
              campus_id: 'campus_mtu_main'
            };
            await setDoc(doc(db, 'users', auth.currentUser.uid), cleanFirestoreData(profile));
          } else {
            profile.email_verified = true;
          }

          try {
            localStorage.setItem('bukkit_active_user', JSON.stringify(profile));
          } catch (e) {}

          set({
            user: profile,
            role: profile.active_role || profile.role || 'customer',
            isEmailVerified: true,
            authStatus: 'idle',
            authError: null
          });
        } catch (e) {
          console.warn('Profile resolution after verification:', e);
        }
      }

      return isVerified;
    }
    return false;
  },

  logout: async () => {
    try {
      const currentUser = auth.currentUser;
      if (currentUser?.uid) {
        await deactivateDeviceToken(currentUser.uid).catch(() => {});
      }
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
      await setDoc(doc(db, 'users', guestUid), cleanFirestoreData(guestProfile));
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
      await updateDoc(doc(db, 'users', user.uid), cleanFirestoreData(updates));
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
      await updateDoc(doc(db, 'users', user.uid), cleanFirestoreData({ is_online: isOnline }));
      await setDoc(doc(db, 'rider_profiles', user.uid), cleanFirestoreData({ is_online: isOnline }), { merge: true });
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
      await updateDoc(doc(db, 'users', user.uid), cleanFirestoreData({ wallet_balance: newBal }));

      const txId = `tx_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
      await setDoc(doc(db, 'wallet_transactions', txId), cleanFirestoreData({
        id: txId,
        user_id: user.uid,
        type: 'credit',
        amount,
        description: 'Campus Digital Wallet Top-Up',
        reference: reference || `TOPUP_${Date.now()}`,
        status: 'successful',
        created_at: new Date().toISOString()
      }));
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

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
import { resolveAuthoritativeUserProfile, findUserProfileByEmail, getRolePermissions, hasPermission as checkPermission } from '../services/authService';
import { deactivateDeviceToken } from '../services/fcmDeviceService';
import { matchOfficialVendor, VENDOR_CREATION_ADMIN_PIN, FALLBACK_MTU_VENDORS } from '../services/seedService';

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

let userProfileDocUnsubscribe: (() => void) | null = null;

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

    updateDoc(doc(db, 'users', user.uid), cleanFirestoreData({ active_role: targetRole, role: targetRole })).catch(() => {});

    set({ user: updatedUser, role: targetRole });
    return true;
  },

  setUser: (user) => {
    if (user) {
      set({ user, role: user.active_role || user.role || 'customer' });
    } else {
      if (userProfileDocUnsubscribe) {
        userProfileDocUnsubscribe();
        userProfileDocUnsubscribe = null;
      }
      set({ user: null });
    }
  },

  initAuth: () => {
    set({ isInitLoading: true, authError: null });

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      // Clean up any existing real-time user doc listener
      if (userProfileDocUnsubscribe) {
        userProfileDocUnsubscribe();
        userProfileDocUnsubscribe = null;
      }

      if (firebaseUser) {
        const isVerified = firebaseUser.emailVerified;
        set({ isEmailVerified: isVerified });

        if (!isVerified) {
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
          // Resolve initial authoritative profile directly from Firestore
          const profile = await resolveAuthoritativeUserProfile(firebaseUser.uid) || await findUserProfileByEmail(firebaseUser.email || '');

          if (profile) {
            set({
              user: profile,
              role: profile.active_role || profile.role || 'customer',
              isInitLoading: false,
              isLoading: false,
              authStatus: 'success',
              authError: null
            });

            // Set up real-time live sync on user's Firestore document
            userProfileDocUnsubscribe = onSnapshot(doc(db, 'users', firebaseUser.uid), (docSnap) => {
              if (docSnap.exists()) {
                const liveData = docSnap.data() as Partial<UserProfile>;
                const currentUser = get().user;
                if (currentUser) {
                  const merged: UserProfile = {
                    ...currentUser,
                    ...liveData,
                    uid: firebaseUser.uid,
                    id: firebaseUser.uid
                  };
                  const effRole = merged.active_role || merged.role || 'customer';
                  set({ user: merged, role: effRole });
                }
              }
            }, (snapErr) => console.warn('[Firestore user listener warning]:', snapErr));

          } else {
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
          console.warn('[Firestore Auth Profile Resolution Notice]:', e);
          set({ isInitLoading: false, isLoading: false, authStatus: 'idle', authError: null });
        }
      } else {
        if (userProfileDocUnsubscribe) {
          userProfileDocUnsubscribe();
          userProfileDocUnsubscribe = null;
        }
        set({ user: null, isInitLoading: false, isLoading: false, authStatus: 'idle', authError: null });
      }
    });

    return unsubscribe;
  },

  loginWithEmail: async (email, password, _requestedRole, adminKey) => {
    set({ isLoading: true, authStatus: 'loading', authError: null });
    const cleanEmail = email.trim();

    try {
      const userCred = await signInWithEmailAndPassword(auth, cleanEmail, password);
      const isVerified = userCred.user.emailVerified;
      set({ isEmailVerified: isVerified });

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

      const profile = await resolveAuthoritativeUserProfile(userCred.user.uid) || await findUserProfileByEmail(cleanEmail);
      if (!profile) {
        await signOut(auth).catch(() => {});
        throw new Error('No BUKKIT account found with this email. Please sign up first.');
      }

      if (profile.role === 'admin' || profile.role === 'super_admin') {
        const validKeys = ['MTU-ADMIN-2026', 'BUKKIT-ADMIN-88', 'ADMIN123', 'ADMIN', 'MTUADMIN'];
        if (adminKey && !validKeys.includes(adminKey.trim().toUpperCase())) {
          await signOut(auth).catch(() => {});
          throw new Error('Invalid Admin Passkey. Access Denied.');
        }
      }

      await updateDoc(doc(db, 'users', userCred.user.uid), cleanFirestoreData({
        last_login_at: new Date().toISOString()
      })).catch(() => {});

      const authoritativeRole = profile.active_role || profile.role || 'customer';

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

      const userCred = await createUserWithEmailAndPassword(auth, cleanEmail, password);
      const createdUid = userCred.user.uid;
      const isEmailVerified = userCred.user.emailVerified;

      if (userCred.user) {
        try {
          await sendEmailVerification(userCred.user);
        } catch (verErr) {
          console.warn('Email verification send notice:', verErr);
        }
      }
      set({ isEmailVerified: userCred.user.emailVerified });

      const now = new Date().toISOString();
      
      let effectiveVendorId: string | undefined = undefined;
      let effectiveVendorName = fullName.trim() || 'Campus Food Stand';
      let matchedOfficialVendor: any = null;

      if (role === 'kitchen' || role === 'kitchen_manager' || role === 'kitchen_staff') {
        // Check if matching one of the 5 official campus vendors:
        // 1. Stand-1(Bunlab), 2. Multi-grace, 3. Kitchen3, 4. Mama Fruits, 5. Kitchen5(Mummy and Daddy)
        matchedOfficialVendor = matchOfficialVendor(vendorId) || matchOfficialVendor(fullName);

        if (matchedOfficialVendor) {
          effectiveVendorId = matchedOfficialVendor.id;
          effectiveVendorName = matchedOfficialVendor.name;
        } else {
          // Custom vendor creation requires the Admin PIN 100110011001
          const enteredPin = (adminKey || '').trim();
          if (enteredPin !== VENDOR_CREATION_ADMIN_PIN && enteredPin !== '100110011001' && enteredPin !== 'MTU-ADMIN-2026') {
            throw new Error('Authorized Admin PIN (100110011001) is required to create a new custom vendor account. Or select one of the 5 campus stands.');
          }
          effectiveVendorId = vendorId || `vendor_${createdUid.slice(0, 10)}`;
        }
      }

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
        vendor_id: effectiveVendorId,
        avatar_url: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(fullName)}`,
        created_at: now,
        updated_at: now,
        last_login_at: now
      };

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
        subProfilePromise = setDoc(doc(db, 'rider_profiles', createdUid), cleanFirestoreData(riderProf));
      } else if (role === 'kitchen' || role === 'kitchen_manager' || role === 'kitchen_staff') {
        const vendorDocData = matchedOfficialVendor ? {
          ...matchedOfficialVendor,
          id: effectiveVendorId,
          name: matchedOfficialVendor.name,
          owner_uid: createdUid,
          email: cleanEmail,
          phone: phone.trim(),
          is_active: true,
          is_open: true,
          updated_at: now
        } : {
          id: effectiveVendorId,
          name: effectiveVendorName,
          slogan: 'Fresh, hot meals served daily on campus!',
          rating: 5.0,
          total_ratings: 1,
          estimated_delivery_time: '15-25 min',
          cover_image_url: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=800&auto=format&fit=crop',
          logo_url: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=200&auto=format&fit=crop',
          opening_time: '07:30',
          closing_time: '21:00',
          is_active: true,
          is_open: true,
          is_verified: true,
          food_zone_id: 'zone_central',
          university_id: universityId || 'uni_mtu',
          campus_id: campusId || 'campus_mtu_main',
          owner_uid: createdUid,
          email: cleanEmail,
          phone: phone.trim(),
          delivery_fee: 350,
          min_order: 500,
          created_at: now,
          updated_at: now
        };

        const kitchenProf: KitchenStaffProfile = {
          user_id: createdUid,
          vendor_id: effectiveVendorId!,
          vendor_name: effectiveVendorName,
          role: role as any,
          permissions: getRolePermissions(role),
          shift_status: 'on_duty',
          created_at: now,
          updated_at: now
        };
        newProfile.kitchen_profile = kitchenProf;
        subProfilePromise = Promise.all([
          setDoc(doc(db, 'kitchen_staff_profiles', createdUid), cleanFirestoreData(kitchenProf)),
          setDoc(doc(db, 'vendors', effectiveVendorId!), cleanFirestoreData(vendorDocData), { merge: true }),
          setDoc(doc(db, 'restaurants', effectiveVendorId!), cleanFirestoreData({
            id: effectiveVendorId,
            name: effectiveVendorName,
            is_open: true,
            updated_at: now
          }), { merge: true })
        ]);
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
        subProfilePromise = setDoc(doc(db, 'admin_profiles', createdUid), cleanFirestoreData(adminProf));
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
        subProfilePromise = setDoc(doc(db, 'customer_profiles', createdUid), cleanFirestoreData(custProf));
      }

      await Promise.all([
        setDoc(doc(db, 'users', createdUid), cleanFirestoreData(newProfile)),
        subProfilePromise
      ]);

      if (!isEmailVerified) {
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

      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      const userCred = await signInWithPopup(auth, provider);
      const fbUser = userCred.user;

      let profile = await resolveAuthoritativeUserProfile(fbUser.uid);

      if (!profile) {
        const nameParts = (fbUser.displayName || 'BUKKIT User').trim().split(' ');
        const firstName = nameParts[0] || 'BUKKIT';
        const lastName = nameParts.slice(1).join(' ') || 'User';
        const now = new Date().toISOString();

        const newProfile: UserProfile = {
          id: fbUser.uid,
          uid: fbUser.uid,
          name: fbUser.displayName || 'BUKKIT User',
          first_name: firstName,
          last_name: lastName,
          email: fbUser.email || '',
          phone: fbUser.phoneNumber || '',
          status: 'active',
          email_verified: true,
          phone_verified: !!fbUser.phoneNumber,
          roles: [targetRole],
          active_role: targetRole,
          role: targetRole,
          permissions: getRolePermissions(targetRole),
          university_id: 'uni_mtu',
          campus_id: 'campus_mtu_main',
          avatar_url: fbUser.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(fbUser.uid)}`,
          created_at: now,
          updated_at: now,
          last_login_at: now
        };

        if (targetRole === 'rider') {
          const riderProf: RiderProfile = {
            rider_id: fbUser.uid,
            user_id: fbUser.uid,
            full_name: fbUser.displayName || 'Campus Rider',
            phone: fbUser.phoneNumber || '+234 810 000 0000',
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
          newProfile.rider_profile = riderProf;
          await setDoc(doc(db, 'rider_profiles', fbUser.uid), cleanFirestoreData(riderProf));
        } else if (targetRole === 'kitchen' || targetRole === 'kitchen_manager' || targetRole === 'kitchen_staff') {
          const kitchenProf: KitchenStaffProfile = {
            user_id: fbUser.uid,
            vendor_id: fbUser.uid,
            vendor_name: fbUser.displayName || 'Campus Kitchen',
            role: targetRole as any,
            permissions: getRolePermissions(targetRole),
            shift_status: 'on_duty',
            created_at: now,
            updated_at: now
          };
          newProfile.kitchen_profile = kitchenProf;
          newProfile.vendor_id = fbUser.uid;
          await setDoc(doc(db, 'kitchen_staff_profiles', fbUser.uid), cleanFirestoreData(kitchenProf));
        }

        await setDoc(doc(db, 'users', fbUser.uid), cleanFirestoreData(newProfile));
        profile = newProfile;
      } else {
        await updateDoc(doc(db, 'users', fbUser.uid), cleanFirestoreData({
          last_login_at: new Date().toISOString()
        })).catch(() => {});
      }

      const authoritativeRole = profile.active_role || profile.role || 'customer';

      set({
        user: profile,
        role: authoritativeRole,
        isLoading: false,
        isEmailVerified: true,
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
    set({ isLoading: true, authError: null });
    try {
      await sendPasswordResetEmail(auth, email.trim());
      set({ isLoading: false });
    } catch (err: any) {
      const msg = translateFirebaseAuthError(err);
      set({ isLoading: false, authError: msg });
      throw new Error(msg);
    }
  },

  resendVerificationEmail: async () => {
    const fbUser = auth.currentUser;
    if (!fbUser) {
      throw new Error('No user is currently signed in to send verification email to.');
    }
    await sendEmailVerification(fbUser);
  },

  reloadUser: async () => {
    const fbUser = auth.currentUser;
    if (!fbUser) return false;
    await fbUser.reload();
    const verified = fbUser.emailVerified;
    set({ isEmailVerified: verified });
    if (verified) {
      const profile = await resolveAuthoritativeUserProfile(fbUser.uid);
      if (profile) {
        set({
          user: profile,
          role: profile.active_role || profile.role || 'customer',
          authStatus: 'success',
          authError: null
        });
      }
    }
    return verified;
  },

  logout: async () => {
    set({ isLoading: true });
    try {
      const activeUser = get().user;
      if (activeUser?.uid) {
        deactivateDeviceToken(activeUser.uid).catch(() => {});
      }
      if (userProfileDocUnsubscribe) {
        userProfileDocUnsubscribe();
        userProfileDocUnsubscribe = null;
      }
      await signOut(auth);
    } catch (err) {
      console.warn('Sign out warning:', err);
    } finally {
      set({
        user: null,
        role: 'customer',
        isLoading: false,
        isInitLoading: false,
        authStatus: 'idle',
        authError: null
      });
    }
  },

  loginAsGuest: async (asRole = 'customer', adminKey?: string) => {
    set({ isLoading: true, authStatus: 'loading', authError: null });
    const guestUid = `guest_${Date.now()}`;
    const now = new Date().toISOString();

    const guestProfile: UserProfile = {
      id: guestUid,
      uid: guestUid,
      name: `Guest (${asRole.toUpperCase()})`,
      first_name: 'Guest',
      last_name: asRole.toUpperCase(),
      email: `${guestUid}@bukkit.guest`,
      phone: '+234 800 000 0000',
      status: 'active',
      email_verified: true,
      phone_verified: false,
      roles: [asRole],
      active_role: asRole,
      role: asRole,
      permissions: getRolePermissions(asRole),
      university_id: 'uni_mtu',
      campus_id: 'campus_mtu_main',
      avatar_url: `https://api.dicebear.com/7.x/avataaars/svg?seed=${guestUid}`,
      created_at: now,
      updated_at: now,
      last_login_at: now,
      wallet_balance: 15000
    };

    try {
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
      await updateDoc(doc(db, 'users', user.uid), cleanFirestoreData(updates));
      set({ user: updated });
    } catch (e) {
      console.error('Failed to update profile in Firestore:', e);
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
      await updateDoc(doc(db, 'users', user.uid), cleanFirestoreData({ wallet_balance: newBal }));

      const txId = `tx_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
      await setDoc(doc(db, 'wallet_transactions', txId), cleanFirestoreData({
        id: txId,
        user_id: user.uid,
        type: 'debit',
        amount,
        description,
        status: 'successful',
        created_at: new Date().toISOString()
      }));
    } catch (err) {
      console.warn('Wallet deduction firestore sync notice:', err);
    }

    return true;
  }
}));

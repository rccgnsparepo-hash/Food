import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Mail,
  Lock,
  User,
  Phone,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  KeyRound,
  Bike,
  ShoppingBag,
  Eye,
  EyeOff,
  RefreshCw,
  RotateCcw,
  Sparkles,
  Utensils,
  Clock,
  Award,
  Users,
  Gift,
  HelpCircle,
  Compass,
  MessageCircle,
  Globe,
  LogIn,
  Check,
  ChefHat,
  Store,
  ShieldAlert
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuthStore } from '../../stores/useAuthStore';
import { useMarketplaceStore } from '../../stores/useMarketplaceStore';
import { translateFirebaseAuthError } from '../../lib/authErrorTranslator';
import { PasswordStrengthMeter } from './PasswordStrengthMeter';
import { BukkitLogo } from '../common/BukkitLogo';
import { UserRole } from '../../types';
import { FALLBACK_MTU_VENDORS, matchOfficialVendor, VENDOR_CREATION_ADMIN_PIN } from '../../services/seedService';

type AuthStatus = 'idle' | 'loading' | 'success' | 'error' | 'email-verification-required';

export const AuthGatewayPage: React.FC = () => {
  const {
    loginWithEmail,
    registerWithEmail,
    loginWithGoogle,
    loginAsGuest,
    resetPassword,
    resendVerificationEmail,
    reloadUser,
    isEmailVerified,
    authStatus: globalAuthStatus,
    user
  } = useAuthStore();

  const { universities, campuses, vendors } = useMarketplaceStore();

  const [selectedRole, setSelectedRole] = useState<UserRole>('customer');
  const [mode, setMode] = useState<'login' | 'register' | 'forgot_password' | 'verify_email'>(
    globalAuthStatus === 'email-verification-required' || (!isEmailVerified && user?.uid && !user.uid.startsWith('guest_'))
      ? 'verify_email'
      : 'login'
  );
  const [authStatus, setAuthStatus] = useState<AuthStatus>(
    globalAuthStatus === 'email-verification-required' ? 'email-verification-required' : 'idle'
  );

  // Form input states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [adminKey, setAdminKey] = useState('');
  const [universityId, setUniversityId] = useState('uni_mtu');
  const [campusId, setCampusId] = useState('campus_mtu_main');
  const [selectedVendorId, setSelectedVendorId] = useState('');

  // UI Toggles & Feedback
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [loadingText, setLoadingText] = useState('Processing...');

  // Track manual mode changes so the user isn't stuck on verify_email
  const [hasManuallySwitched, setHasManuallySwitched] = useState(false);

  // Dedicated email verification states
  const [verificationState, setVerificationState] = useState<'idle' | 'checking' | 'verified' | 'unverified' | 'error'>('idle');
  const [verificationFeedback, setVerificationFeedback] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);

  // Reactive synchronization with global auth store
  useEffect(() => {
    if (!hasManuallySwitched && (globalAuthStatus === 'email-verification-required' || (!isEmailVerified && user?.uid && !user.uid.startsWith('guest_')))) {
      setMode('verify_email');
      setAuthStatus('email-verification-required');
      setLoadingText('Processing...');
    }
  }, [globalAuthStatus, isEmailVerified, user?.uid, hasManuallySwitched]);

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const interval = setInterval(() => {
      setResendCooldown(prev => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [resendCooldown]);

  // Automatic verification detection on tab focus or visibility change
  useEffect(() => {
    if (mode !== 'verify_email' || isEmailVerified || verificationState === 'verified') return;

    const handleAutoCheck = () => {
      if (document.visibilityState === 'visible' && verificationState !== 'checking' && verificationState !== 'verified') {
        handleCheckVerification(true);
      }
    };

    window.addEventListener('focus', handleAutoCheck);
    document.addEventListener('visibilitychange', handleAutoCheck);

    // Periodic check every 6 seconds
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible' && verificationState !== 'checking' && verificationState !== 'verified') {
        handleAutoCheck();
      }
    }, 6000);

    return () => {
      window.removeEventListener('focus', handleAutoCheck);
      document.removeEventListener('visibilitychange', handleAutoCheck);
      clearInterval(interval);
    };
  }, [mode, isEmailVerified, verificationState]);

  const availableCampuses = campuses.filter(c => c.university_id === universityId);

  // Clear errors and perform real-time field validation
  const validateSingleField = (field: string, val: string, passVal?: string) => {
    let err = '';
    if (field === 'fullName') {
      if (!val.trim()) err = 'Full name is required.';
      else if (val.trim().length < 2) err = 'Full name must be at least 2 characters.';
    } else if (field === 'phone') {
      const clean = val.trim().replace(/\D/g, '');
      if (!val.trim()) err = 'Phone number is required.';
      else if (clean.length < 8) err = 'Please enter a valid phone number (at least 8 digits).';
    } else if (field === 'universityId') {
      if (!val) err = 'Please select your university.';
    } else if (field === 'campusId') {
      if (!val) err = 'Please select your campus.';
    } else if (field === 'email') {
      if (!val.trim()) err = 'Email address is required.';
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val.trim())) err = 'Please enter a valid email address.';
    } else if (field === 'password') {
      if (!val) err = 'Password is required.';
      else if (val.length < 6) err = 'Password must be at least 6 characters long.';
    } else if (field === 'confirmPassword') {
      const comparePass = passVal !== undefined ? passVal : password;
      if (!val) err = 'Please confirm your password.';
      else if (val !== comparePass) err = 'Passwords do not match.';
    }
    return err;
  };

  const handleInputChange = (field: string, value: string, setter: (val: string) => void) => {
    setter(value);
    if (errorMsg) setErrorMsg(null);
    if (authStatus === 'error') setAuthStatus('idle');

    if (mode === 'register') {
      const err = validateSingleField(field, value);
      setFieldErrors(prev => {
        const next = { ...prev };
        if (err) next[field] = err;
        else delete next[field];
        return next;
      });
    } else {
      if (fieldErrors[field]) {
        setFieldErrors(prev => {
          const next = { ...prev };
          delete next[field];
          return next;
        });
      }
    }
  };

  const handleUniversityChange = (id: string) => {
    setUniversityId(id);
    const camps = campuses.filter(c => c.university_id === id);
    const nextCampusId = camps.length > 0 ? camps[0].id : '';
    setCampusId(nextCampusId);

    if (mode === 'register') {
      const univErr = validateSingleField('universityId', id);
      const campErr = validateSingleField('campusId', nextCampusId);
      setFieldErrors(prev => {
        const next = { ...prev };
        if (univErr) next.universityId = univErr; else delete next.universityId;
        if (campErr) next.campusId = campErr; else delete next.campusId;
        return next;
      });
    } else {
      if (fieldErrors.universityId || fieldErrors.campusId) {
        setFieldErrors(prev => {
          const next = { ...prev };
          delete next.universityId;
          delete next.campusId;
          return next;
        });
      }
    }
  };

  const handleTryAgain = () => {
    setErrorMsg(null);
    setAuthStatus('idle');
    setFieldErrors({});
    setLoadingText('Processing...');
  };

  const handleRoleChange = (role: UserRole) => {
    setSelectedRole(role);
    setErrorMsg(null);
    setSuccessMsg(null);
    setFieldErrors({});
    setAuthStatus('idle');
  };

  const switchMode = (newMode: 'login' | 'register' | 'forgot_password' | 'verify_email') => {
    setHasManuallySwitched(true);
    setMode(newMode);
    setErrorMsg(null);
    setSuccessMsg(null);
    setFieldErrors({});
    setAuthStatus('idle');
    setVerificationState('idle');
    setVerificationFeedback(null);
  };

  // 1. HANDLE LOGIN
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);
    setFieldErrors({});

    const errors: Record<string, string> = {};
    if (!email.trim()) errors.email = 'Email address is required.';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      errors.email = 'Please enter a valid email address.';
    }
    if (!password) errors.password = 'Password is required.';
    if (selectedRole === 'admin' && !adminKey.trim()) {
      errors.adminKey = 'Admin Passkey is required to access the admin portal.';
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      const firstErr = Object.values(errors)[0];
      setErrorMsg(firstErr);
      setAuthStatus('error');
      toast.error(firstErr);
      return;
    }

    setAuthStatus('loading');
    setLoadingText('Signing in...');
    toast.info('Signing you in to BUKKIT...');

    try {
      await loginWithEmail(email.trim(), password, selectedRole, adminKey.trim());
      setAuthStatus('success');
      setSuccessMsg(`Login successful! Welcome back to BUKKIT.`);
      toast.success('✓ Login successful! Welcome back.');
    } catch (err: any) {
      const isUnverified = err?.message?.toLowerCase().includes('not verified') || err?.code === 'auth/email-not-verified';
      if (isUnverified) {
        setAuthStatus('email-verification-required');
        setMode('verify_email');
        const msg = 'Your email address is not verified yet. Please check your email inbox and click the verification link.';
        setErrorMsg(msg);
        toast.warning(msg);
      } else {
        setAuthStatus('error');
        const humanError = translateFirebaseAuthError(err);
        setErrorMsg(humanError);
        toast.error(humanError);
      }
    }
  };

  // 2. HANDLE REGISTER
  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);
    setFieldErrors({});

    const errors: Record<string, string> = {};
    if (!fullName.trim()) errors.fullName = 'Full name is required.';
    if (!email.trim()) errors.email = 'Email address is required.';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      errors.email = 'Please enter a valid email address.';
    }
    if (!phone.trim()) errors.phone = 'Phone number is required.';
    if (!password) errors.password = 'Password is required.';
    else if (password.length < 6) errors.password = 'Password must be at least 6 characters.';
    if (password !== confirmPassword) {
      errors.confirmPassword = 'Passwords do not match.';
    }
    if (selectedRole === 'admin' && !adminKey.trim()) {
      errors.adminKey = 'Admin Passkey is required for administrative registration.';
    }

    // Kitchen/Vendor Stand PIN Validation:
    // If selecting/creating a kitchen account:
    // If the name or selection matches one of the 5 official stands, NO PIN is required!
    // If creating a new custom stand, require Admin PIN (100110011001).
    if (selectedRole === 'kitchen') {
      const isOfficialMatch = matchOfficialVendor(selectedVendorId) || matchOfficialVendor(fullName);
      if (!isOfficialMatch) {
        if (!adminKey.trim()) {
          errors.adminKey = 'Admin PIN (100110011001) is required to create a new custom food vendor stand.';
        } else if (adminKey.trim() !== VENDOR_CREATION_ADMIN_PIN && adminKey.trim() !== '100110011001' && adminKey.trim() !== 'MTU-ADMIN-2026') {
          errors.adminKey = 'Invalid Admin PIN. Authorized PIN is 100110011001.';
        }
      }
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      const firstErr = Object.values(errors)[0];
      setErrorMsg(firstErr);
      setAuthStatus('error');
      toast.error(firstErr);
      return;
    }

    setAuthStatus('loading');
    setLoadingText('Creating account...');
    toast.info('Creating your BUKKIT account...');

    try {
      await registerWithEmail({
        fullName: fullName.trim(),
        email: email.trim(),
        phone: phone.trim(),
        password,
        universityId,
        campusId,
        role: selectedRole,
        adminKey: adminKey.trim(),
        vendorId: selectedRole === 'kitchen' ? (selectedVendorId || undefined) : undefined
      });
      setAuthStatus('email-verification-required');
      setMode('verify_email');
      setSuccessMsg('Account created successfully! Please verify your email.');
      toast.success('✓ Account created! Check your email to verify.');
    } catch (err: any) {
      setAuthStatus('error');
      const humanError = translateFirebaseAuthError(err);
      setErrorMsg(humanError);
      toast.error(humanError);
    }
  };

  // 3. GOOGLE SIGN IN
  const handleGoogleSignIn = async () => {
    setErrorMsg(null);
    setSuccessMsg(null);

    // If signing up as Admin with Google, check admin passkey
    if (mode === 'register' && selectedRole === 'admin') {
      if (!adminKey.trim()) {
        const err = 'Admin Security Passkey is required to register an Admin account.';
        setErrorMsg(err);
        toast.error(err);
        return;
      }
    }

    setAuthStatus('loading');
    setLoadingText('Connecting to Google...');
    toast.info('Connecting to Google Account...');

    try {
      const isSignUpFlow = mode === 'register';
      await loginWithGoogle(selectedRole, isSignUpFlow, adminKey.trim());
      setAuthStatus('success');
      setSuccessMsg(`Google sign-in successful!`);
      toast.success('✓ Google sign-in successful!');
    } catch (err: any) {
      setAuthStatus('error');
      const humanError = translateFirebaseAuthError(err);
      setErrorMsg(humanError);
      toast.error(humanError);

      // If user attempted login but has no account, help them switch to create account with selected role
      if (humanError.includes('No existing BUKKIT account') || humanError.includes('sign up')) {
        setTimeout(() => {
          setMode('register');
        }, 1500);
      }
    }
  };

  // 4. FORGOT PASSWORD
  const handleForgotPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);
    setFieldErrors({});

    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      const err = 'Please enter a valid registered email address.';
      setErrorMsg(err);
      setFieldErrors({ email: err });
      setAuthStatus('error');
      toast.error(err);
      return;
    }

    setAuthStatus('loading');
    setLoadingText('Sending link...');

    try {
      await resetPassword(email.trim());
      setAuthStatus('success');
      const msg = `Password reset instructions sent to ${email.trim()}`;
      setSuccessMsg(msg);
      toast.success('✓ Password reset link sent!');
    } catch (err: any) {
      setAuthStatus('error');
      const msg = 'If an account exists for this email, you will receive a password reset link shortly.';
      setSuccessMsg(msg);
      toast.info(msg);
    }
  };

  // 5. RESEND VERIFICATION
  const handleResendVerification = async () => {
    if (resendCooldown > 0 || verificationState === 'checking') return;
    setErrorMsg(null);
    setSuccessMsg(null);
    setVerificationFeedback(null);
    setAuthStatus('loading');
    setLoadingText('Resending email...');

    try {
      await resendVerificationEmail();
      setAuthStatus('email-verification-required');
      const targetEm = user?.email || email || 'your inbox';
      const msg = `Verification email resent to ${targetEm}! Please check your email inbox and spam folder.`;
      setSuccessMsg(msg);
      setVerificationFeedback(msg);
      toast.success('✓ Verification email resent.');
      setResendCooldown(30);
    } catch (err: any) {
      console.error('Resend verification error:', err);
      setAuthStatus('email-verification-required');
      const humanError = translateFirebaseAuthError(err);
      setErrorMsg(humanError);
      setVerificationFeedback(humanError);
      toast.error(humanError);
    }
  };

  // 6. CHECK VERIFICATION
  const handleCheckVerification = async (isAutoCheck = false) => {
    if (verificationState === 'checking' || verificationState === 'verified') return;

    setVerificationState('checking');
    setAuthStatus('loading');
    setLoadingText('Checking verification…');
    setErrorMsg(null);
    setSuccessMsg(null);
    setVerificationFeedback(null);

    if (!isAutoCheck) {
      toast.info('Checking your email verification status…');
    }

    try {
      const verified = await reloadUser();
      if (verified) {
        setVerificationState('verified');
        setAuthStatus('success');
        const successText = 'Email verified successfully! You can now log in.';
        setSuccessMsg(successText);
        setVerificationFeedback(successText);
        toast.success('✓ Email verified successfully! You can now log in.');

        // Automatically transition to login view after 1.5s
        setTimeout(() => {
          setHasManuallySwitched(true);
          setMode('login');
          setAuthStatus('idle');
          setVerificationState('idle');
          setSuccessMsg('Email verified successfully! You can now log in.');
        }, 1500);
      } else {
        setVerificationState('unverified');
        setAuthStatus('email-verification-required');
        const unverifiedMsg = "We haven't detected your email verification yet. Please make sure you clicked the verification link in your email, then try again.";
        setErrorMsg(unverifiedMsg);
        setVerificationFeedback(unverifiedMsg);
        if (!isAutoCheck) {
          toast.warning(unverifiedMsg);
        }
      }
    } catch (err: any) {
      console.error('Check verification error:', err);
      setVerificationState('error');
      setAuthStatus('email-verification-required');
      const errorMsgText = "We couldn't check your verification status. Please try again.";
      setErrorMsg(errorMsgText);
      setVerificationFeedback(errorMsgText);
      if (!isAutoCheck) {
        toast.error(errorMsgText);
      }
    }
  };

  const isLoadingState = authStatus === 'loading';

  return (
    <div className="min-h-screen bg-[#F3F4F7] dark:bg-slate-950 text-slate-800 dark:text-slate-100 font-sans selection:bg-[#D6001C] selection:text-white flex flex-col justify-between relative overflow-hidden transition-colors">
      
      {/* GIANT BACKGROUND WATERMARK HEADING (Matches Reference Screenshot "Signup") */}
      <div className="absolute top-0 left-0 right-0 text-center pointer-events-none select-none overflow-hidden opacity-[0.06] dark:opacity-[0.03] z-0 pt-2">
        <span className="font-serif font-black text-[140px] sm:text-[180px] md:text-[220px] lg:text-[260px] tracking-tight text-slate-900 dark:text-white uppercase leading-none block">
          {mode === 'register' ? 'Signup' : 'BUKKIT'}
        </span>
      </div>

      {/* CULINARY FOOD ACCENTS IN CORNERS (Matches Reference Screenshot food bowls) */}
      <div 
        className="hidden md:block absolute -top-12 -right-12 w-72 lg:w-96 h-72 lg:h-96 bg-cover bg-center rounded-full shadow-2xl pointer-events-none z-0 border-8 border-white/40 dark:border-slate-800/40"
        style={{
          backgroundImage: `url('https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800&auto=format&fit=crop')`
        }}
      />
      <div 
        className="hidden md:block absolute -bottom-16 -left-16 w-64 lg:w-80 h-64 lg:h-80 bg-cover bg-center rounded-full shadow-2xl pointer-events-none z-0 border-8 border-white/40 dark:border-slate-800/40"
        style={{
          backgroundImage: `url('https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=800&auto=format&fit=crop')`
        }}
      />

      {/* MAIN CONTAINER: DESKTOP & TABLET TWO-COLUMN LAYOUT */}
      <div className="w-full max-w-6xl mx-auto flex-1 flex flex-col justify-center p-4 sm:p-6 md:p-8 lg:p-12 z-10 my-auto">
        
        {/* MAIN GRID */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 lg:gap-12 items-center">
          
          {/* LEFT COLUMN: FLOATING AUTH FORM CARD */}
          <div className="md:col-span-6 lg:col-span-5">
            <motion.div
              initial={{ opacity: 0, scale: 0.98, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="bg-white dark:bg-slate-900 rounded-[32px] p-6 sm:p-8 shadow-2xl border border-slate-100/90 dark:border-slate-800 relative z-20 w-full max-w-md mx-auto transition-colors"
            >
              {/* TOP BRAND BADGE */}
              <div className="flex items-center justify-between mb-5">
                <BukkitLogo variant="full" size="sm" subtitleText="MTU MARKETPLACE" />

                <span className="text-[10px] font-black bg-slate-900 dark:bg-slate-800 text-white px-3 py-1 rounded-full uppercase tracking-wider border border-transparent dark:border-slate-700">
                  {selectedRole}
                </span>
              </div>

              {/* ROLE SWITCHER TABS - 4 PHASES */}
              <div className="mb-5">
                <div className="grid grid-cols-4 gap-1 bg-[#F4F5F8] dark:bg-slate-800 p-1 rounded-full border border-slate-200/80 dark:border-slate-700">
                  <button
                    type="button"
                    disabled={isLoadingState}
                    onClick={() => handleRoleChange('customer')}
                    className={`py-1.5 px-1 rounded-full text-[10px] sm:text-[11px] font-black transition-all flex items-center justify-center gap-1 cursor-pointer disabled:opacity-50 ${
                      selectedRole === 'customer'
                        ? 'bg-[#D6001C] text-white shadow-sm'
                        : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    <ShoppingBag className="w-3 h-3" />
                    <span>Customer</span>
                  </button>

                  <button
                    type="button"
                    disabled={isLoadingState}
                    onClick={() => handleRoleChange('kitchen')}
                    className={`py-1.5 px-1 rounded-full text-[10px] sm:text-[11px] font-black transition-all flex items-center justify-center gap-1 cursor-pointer disabled:opacity-50 ${
                      selectedRole === 'kitchen'
                        ? 'bg-[#D6001C] text-white shadow-sm'
                        : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    <Utensils className="w-3 h-3" />
                    <span>Kitchen</span>
                  </button>

                  <button
                    type="button"
                    disabled={isLoadingState}
                    onClick={() => handleRoleChange('rider')}
                    className={`py-1.5 px-1 rounded-full text-[10px] sm:text-[11px] font-black transition-all flex items-center justify-center gap-1 cursor-pointer disabled:opacity-50 ${
                      selectedRole === 'rider'
                        ? 'bg-[#D6001C] text-white shadow-sm'
                        : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    <Bike className="w-3 h-3" />
                    <span>Rider</span>
                  </button>

                  <button
                    type="button"
                    disabled={isLoadingState}
                    onClick={() => handleRoleChange('admin')}
                    className={`py-1.5 px-1 rounded-full text-[10px] sm:text-[11px] font-black transition-all flex items-center justify-center gap-1 cursor-pointer disabled:opacity-50 ${
                      selectedRole === 'admin'
                        ? 'bg-slate-900 dark:bg-slate-700 text-white shadow-sm'
                        : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    <ShieldCheck className="w-3 h-3" />
                    <span>Admin</span>
                  </button>
                </div>
              </div>

              {/* DYNAMIC ALERT MESSAGES */}
              <AnimatePresence mode="wait">
                {errorMsg && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mb-4 p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 rounded-2xl text-xs font-medium text-red-900 dark:text-red-200 flex flex-col gap-2 shadow-xs overflow-hidden"
                  >
                    <div className="flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 text-[#D6001C] dark:text-red-400 shrink-0 mt-0.5" />
                      <div className="flex-1 text-[11px] leading-relaxed">
                        <strong className="block font-bold text-red-950 dark:text-red-100 mb-0.5">Authentication Error</strong>
                        <span>{errorMsg}</span>
                      </div>
                    </div>
                    <div className="flex justify-end pt-1.5 border-t border-red-200/80 dark:border-red-900/50">
                      <button
                        type="button"
                        onClick={handleTryAgain}
                        className="px-3 py-1 bg-white dark:bg-slate-800 border border-red-200 dark:border-red-900/50 hover:bg-red-100/60 dark:hover:bg-red-950/60 text-red-700 dark:text-red-300 hover:text-red-900 dark:hover:text-red-100 rounded-xl text-[11px] font-extrabold transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs active:scale-95"
                      >
                        <RotateCcw className="w-3 h-3 text-red-600 dark:text-red-400" />
                        <span>Try Again</span>
                      </button>
                    </div>
                  </motion.div>
                )}

                {successMsg && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mb-4 p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/50 rounded-2xl text-xs font-medium text-emerald-900 dark:text-emerald-200 flex items-start gap-2 shadow-xs overflow-hidden"
                  >
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                    <div className="flex-1 text-[11px] leading-relaxed">
                      <span>{successMsg}</span>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* 1. LOGIN FORM */}
              {mode === 'login' && (
                <form onSubmit={handleLoginSubmit} className="space-y-3.5">
                  {selectedRole === 'admin' && (
                    <div className="bg-slate-900 text-white p-3 rounded-2xl space-y-1.5 border border-slate-800 shadow-sm">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-bold text-amber-400 flex items-center gap-1">
                          <KeyRound className="w-3 h-3" /> Admin Security Passkey
                        </span>
                        <span className="font-mono text-[9px] text-slate-400">I WONT TELL YOU</span>
                      </div>
                      <input
                        type="password"
                        disabled={isLoadingState}
                        value={adminKey}
                        onChange={(e) => handleInputChange('adminKey', e.target.value, setAdminKey)}
                        placeholder="Enter Admin Passkey"
                        className="w-full bg-slate-800 border border-slate-700 rounded-full px-3.5 py-1.5 text-xs font-mono text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-400"
                      />
                    </div>
                  )}

                  {/* Email Input (Rounded Pill) */}
                  <div>
                    <div className="relative">
                      <input
                        type="email"
                        disabled={isLoadingState}
                        value={email}
                        onChange={(e) => handleInputChange('email', e.target.value, setEmail)}
                        placeholder="Enter Email Address"
                        className={`w-full bg-[#F8F9FC] dark:bg-slate-800 border rounded-full px-4 py-3 pl-11 text-xs font-semibold text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:bg-white dark:focus:bg-slate-800/90 focus:ring-2 transition-all ${
                          fieldErrors.email
                            ? 'border-red-400 focus:ring-red-400/20'
                            : 'border-slate-200 dark:border-slate-700 focus:border-[#D6001C] focus:ring-red-500/10'
                        }`}
                      />
                      <Mail className="w-4 h-4 text-slate-400 absolute left-4 top-3.5" />
                    </div>
                    {fieldErrors.email && (
                      <p className="text-[10px] text-red-600 dark:text-red-400 font-bold mt-1 pl-4">{fieldErrors.email}</p>
                    )}
                  </div>

                  {/* Password Input (Rounded Pill) */}
                  <div>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        disabled={isLoadingState}
                        value={password}
                        onChange={(e) => handleInputChange('password', e.target.value, setPassword)}
                        placeholder="Password"
                        className={`w-full bg-[#F8F9FC] dark:bg-slate-800 border rounded-full px-4 py-3 pl-11 pr-11 text-xs font-semibold text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:bg-white dark:focus:bg-slate-800/90 focus:ring-2 transition-all ${
                          fieldErrors.password
                            ? 'border-red-400 focus:ring-red-400/20'
                            : 'border-slate-200 dark:border-slate-700 focus:border-[#D6001C] focus:ring-red-500/10'
                        }`}
                      />
                      <Lock className="w-4 h-4 text-slate-400 absolute left-4 top-3.5" />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-4 top-3.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    <div className="flex justify-end mt-1 pr-2">
                      <button
                        type="button"
                        disabled={isLoadingState}
                        onClick={() => switchMode('forgot_password')}
                        className="text-[11px] text-[#D6001C] dark:text-red-400 hover:underline font-bold cursor-pointer"
                      >
                        Forgot password?
                      </button>
                    </div>
                  </div>

                  {/* Vibrant Red Pill CTA Button */}
                  <button
                    type="submit"
                    disabled={isLoadingState}
                    className="w-full bg-[#D6001C] hover:bg-[#B50018] text-white font-black rounded-full py-3.5 text-xs uppercase tracking-wider shadow-lg shadow-red-500/30 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 mt-2"
                  >
                    {isLoadingState ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span>{loadingText}</span>
                      </>
                    ) : (
                      <>
                        <span>LOG IN</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>

                  <p className="text-[11px] text-slate-400 font-medium text-center leading-tight pt-1">
                    By clicking on 'LOG IN' you agree to the{' '}
                    <span className="text-slate-700 dark:text-slate-300 font-bold underline cursor-pointer">Terms of Service</span> and{' '}
                    <span className="text-slate-700 dark:text-slate-300 font-bold underline cursor-pointer">Privacy Policy</span>.
                  </p>

                  {/* Google Sign In */}
                  {selectedRole !== 'admin' && (
                    <>
                      <div className="relative my-2">
                        <div className="absolute inset-0 flex items-center">
                          <div className="w-full border-t border-slate-200 dark:border-slate-800" />
                        </div>
                        <div className="relative flex justify-center text-[10px]">
                          <span className="bg-white dark:bg-slate-900 px-2.5 text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">
                            Join with
                          </span>
                        </div>
                      </div>

                      <div className="flex justify-center gap-3">
                        <button
                          type="button"
                          onClick={handleGoogleSignIn}
                          disabled={isLoadingState}
                          className="w-10 h-10 rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-750 flex items-center justify-center transition-all shadow-xs cursor-pointer"
                        >
                          <svg className="w-4 h-4" viewBox="0 0 24 24">
                            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                          </svg>
                        </button>
                      </div>
                    </>
                  )}

                  <p className="text-center text-xs text-slate-500 dark:text-slate-400 font-bold pt-2">
                    Need an account?{' '}
                    <button
                      type="button"
                      onClick={() => switchMode('register')}
                      className="text-[#D6001C] dark:text-red-400 font-black hover:underline cursor-pointer uppercase text-xs"
                    >
                      CREATE ACCOUNT
                    </button>
                  </p>
                </form>
              )}

              {/* 2. REGISTER FORM */}
              {mode === 'register' && (
                <form onSubmit={handleRegisterSubmit} className="space-y-3">
                  {selectedRole === 'admin' && (
                    <div className="bg-slate-900 text-white p-3 rounded-2xl space-y-1.5 border border-slate-800 shadow-sm">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-bold text-amber-400 flex items-center gap-1">
                          <KeyRound className="w-3 h-3" /> Admin Passkey
                        </span>
                        <span className="font-mono text-[9px] text-slate-400"></span>
                      </div>
                      <input
                        type="password"
                        disabled={isLoadingState}
                        value={adminKey}
                        onChange={(e) => handleInputChange('adminKey', e.target.value, setAdminKey)}
                        placeholder="Enter Admin Passkey"
                        className="w-full bg-slate-800 border border-slate-700 rounded-full px-3.5 py-1.5 text-xs font-mono text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-400"
                      />
                    </div>
                  )}

                  {/* Full Name */}
                  <div>
                    <div className="relative">
                      <input
                        type="text"
                        disabled={isLoadingState}
                        value={fullName}
                        onChange={(e) => handleInputChange('fullName', e.target.value, setFullName)}
                        placeholder="Full Name"
                        className={`w-full bg-[#F8F9FC] dark:bg-slate-800 border rounded-full px-4 py-2.5 pl-11 text-xs font-semibold text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:bg-white dark:focus:bg-slate-800/90 focus:ring-2 transition-all ${
                          fieldErrors.fullName ? 'border-red-400' : 'border-slate-200 dark:border-slate-700 focus:border-[#D6001C]'
                        }`}
                      />
                      <User className="w-4 h-4 text-slate-400 absolute left-4 top-3" />
                    </div>
                    {fieldErrors.fullName && (
                      <p className="text-[10px] text-red-600 dark:text-red-400 font-bold mt-1 pl-4">{fieldErrors.fullName}</p>
                    )}
                  </div>

                  {/* Email Address */}
                  <div>
                    <div className="relative">
                      <input
                        type="email"
                        disabled={isLoadingState}
                        value={email}
                        onChange={(e) => handleInputChange('email', e.target.value, setEmail)}
                        placeholder="Enter Email Address"
                        className={`w-full bg-[#F8F9FC] dark:bg-slate-800 border rounded-full px-4 py-2.5 pl-11 text-xs font-semibold text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:bg-white dark:focus:bg-slate-800/90 focus:ring-2 transition-all ${
                          fieldErrors.email ? 'border-red-400' : 'border-slate-200 dark:border-slate-700 focus:border-[#D6001C]'
                        }`}
                      />
                      <Mail className="w-4 h-4 text-slate-400 absolute left-4 top-3" />
                    </div>
                    {fieldErrors.email && (
                      <p className="text-[10px] text-red-600 dark:text-red-400 font-bold mt-1 pl-4">{fieldErrors.email}</p>
                    )}
                  </div>

                  {/* Phone & Password */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div>
                      <div className="relative">
                        <input
                          type="tel"
                          disabled={isLoadingState}
                          value={phone}
                          onChange={(e) => handleInputChange('phone', e.target.value, setPhone)}
                          placeholder="Phone Number"
                          className={`w-full bg-[#F8F9FC] dark:bg-slate-800 border rounded-full px-3.5 py-2.5 pl-9 text-xs font-semibold text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:bg-white dark:focus:bg-slate-800/90 focus:ring-2 transition-all ${
                            fieldErrors.phone ? 'border-red-400' : 'border-slate-200 dark:border-slate-700 focus:border-[#D6001C]'
                          }`}
                        />
                        <Phone className="w-3.5 h-3.5 text-slate-400 absolute left-3.5 top-3" />
                      </div>
                    </div>

                    <div>
                      <div className="relative">
                        <input
                          type={showPassword ? 'text' : 'password'}
                          disabled={isLoadingState}
                          value={password}
                          onChange={(e) => handleInputChange('password', e.target.value, setPassword)}
                          placeholder="Password"
                          className={`w-full bg-[#F8F9FC] dark:bg-slate-800 border rounded-full px-3.5 py-2.5 pl-9 pr-8 text-xs font-semibold text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:bg-white dark:focus:bg-slate-800/90 focus:ring-2 transition-all ${
                            fieldErrors.password ? 'border-red-400' : 'border-slate-200 dark:border-slate-700 focus:border-[#D6001C]'
                          }`}
                        />
                        <Lock className="w-3.5 h-3.5 text-slate-400 absolute left-3.5 top-3" />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-3 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
                        >
                          {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>
                  </div>

                  <PasswordStrengthMeter password={password} />

                  {/* Confirm Password */}
                  <div>
                    <div className="relative">
                      <input
                        type={showConfirmPassword ? 'text' : 'password'}
                        disabled={isLoadingState}
                        value={confirmPassword}
                        onChange={(e) => handleInputChange('confirmPassword', e.target.value, setConfirmPassword)}
                        placeholder="Confirm Password"
                        className={`w-full bg-[#F8F9FC] dark:bg-slate-800 border rounded-full px-4 py-2.5 pl-11 pr-11 text-xs font-semibold text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:bg-white dark:focus:bg-slate-800/90 focus:ring-2 transition-all ${
                          fieldErrors.confirmPassword ? 'border-red-400' : 'border-slate-200 dark:border-slate-700 focus:border-[#D6001C]'
                        }`}
                      />
                      <Lock className="w-4 h-4 text-slate-400 absolute left-4 top-3" />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-4 top-3 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
                      >
                        {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    {fieldErrors.confirmPassword && (
                      <p className="text-[10px] text-red-600 dark:text-red-400 font-bold mt-1 pl-4">{fieldErrors.confirmPassword}</p>
                    )}
                  </div>

                  {/* Kitchen Stand Selection (for kitchen staff / owners) */}
                  {selectedRole === 'kitchen' && (
                    <div className="bg-rose-50/80 dark:bg-slate-800/90 p-3.5 rounded-2xl border border-rose-200 dark:border-slate-700 space-y-2.5 text-left shadow-xs">
                      <div className="flex items-center justify-between">
                        <label className="text-[11px] font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                          <ChefHat className="w-4 h-4 text-[#D6001C]" />
                          <span>Select MTU Campus Food Stand</span>
                        </label>
                        <span className="text-[10px] font-extrabold text-[#D6001C] bg-rose-100 dark:bg-rose-950/60 px-2 py-0.5 rounded-full">
                          5 Official Stands
                        </span>
                      </div>

                      <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-tight">
                        Select your official stand below, or type its name in <span className="font-bold text-slate-800 dark:text-slate-200">Full Name</span>. Custom stands require Admin PIN (<span className="font-mono font-bold text-[#D6001C]">100110011001</span>).
                      </p>

                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                        {FALLBACK_MTU_VENDORS.map((v) => {
                          const isSelected = selectedVendorId === v.id || fullName.trim().toLowerCase() === v.name.toLowerCase();
                          return (
                            <button
                              key={v.id}
                              type="button"
                              onClick={() => {
                                setSelectedVendorId(v.id);
                                setFullName(v.name);
                                if (fieldErrors.fullName) {
                                  setFieldErrors(prev => {
                                    const next = { ...prev };
                                    delete next.fullName;
                                    return next;
                                  });
                                }
                              }}
                              className={`px-2.5 py-2 rounded-xl text-left border text-[11px] font-bold transition-all flex flex-col justify-between ${
                                isSelected
                                  ? 'bg-[#D6001C] text-white border-[#D6001C] shadow-sm'
                                  : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-red-300'
                              }`}
                            >
                              <span className="truncate">{v.name}</span>
                              <span className={`text-[9px] font-medium ${isSelected ? 'text-red-100' : 'text-slate-400'}`}>
                                {v.slogan || 'Campus Stand'}
                              </span>
                            </button>
                          );
                        })}

                        <button
                          type="button"
                          onClick={() => {
                            setSelectedVendorId('custom');
                          }}
                          className={`px-2.5 py-2 rounded-xl text-left border text-[11px] font-bold transition-all flex flex-col justify-between ${
                            selectedVendorId === 'custom' || (!matchOfficialVendor(selectedVendorId) && !matchOfficialVendor(fullName) && fullName.trim().length > 0)
                              ? 'bg-amber-500 text-white border-amber-500 shadow-sm'
                              : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-dashed border-slate-300 dark:border-slate-600 hover:border-amber-400'
                          }`}
                        >
                          <span className="truncate flex items-center gap-1">
                            <Store className="w-3 h-3 shrink-0" />
                            <span>+ Custom Stand</span>
                          </span>
                          <span className="text-[9px] font-medium opacity-80">Requires PIN</span>
                        </button>
                      </div>

                      {/* If custom stand or unmapped name, show Admin PIN input */}
                      {(!matchOfficialVendor(selectedVendorId) && !matchOfficialVendor(fullName)) && (
                        <div className="bg-amber-50 dark:bg-amber-950/40 p-3 rounded-xl border border-amber-200 dark:border-amber-900/60 space-y-2 mt-2">
                          <div className="flex items-center justify-between">
                            <label className="text-[11px] font-bold text-amber-900 dark:text-amber-300 flex items-center gap-1.5">
                              <KeyRound className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                              <span>Vendor Creation Admin PIN</span>
                            </label>
                            <span className="text-[10px] font-mono font-bold bg-amber-200/70 dark:bg-amber-900/80 px-2 py-0.5 rounded-full text-amber-900 dark:text-amber-200">
                              PIN: 100110011001
                            </span>
                          </div>
                          <input
                            type="password"
                            disabled={isLoadingState}
                            value={adminKey}
                            onChange={(e) => handleInputChange('adminKey', e.target.value, setAdminKey)}
                            placeholder="Enter 12-digit Admin PIN (100110011001)"
                            className="w-full bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-700 rounded-lg px-3 py-2 text-xs font-mono text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                          />
                          {fieldErrors.adminKey && (
                            <p className="text-[11px] text-red-600 dark:text-red-400 font-semibold flex items-center gap-1">
                              <AlertCircle className="w-3 h-3 shrink-0" />
                              <span>{fieldErrors.adminKey}</span>
                            </p>
                          )}
                        </div>
                      )}

                      {(matchOfficialVendor(selectedVendorId) || matchOfficialVendor(fullName)) && (
                        <div className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-1.5 rounded-lg border border-emerald-200 dark:border-emerald-900/60">
                          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          <span>Official Campus Stand linked: {(matchOfficialVendor(selectedVendorId) || matchOfficialVendor(fullName))?.name} (No PIN required)</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Vibrant Red Pill Button */}
                  <button
                    type="submit"
                    disabled={isLoadingState}
                    className="w-full bg-[#D6001C] hover:bg-[#B50018] text-white font-black rounded-full py-3.5 text-xs uppercase tracking-wider shadow-lg shadow-red-500/30 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 mt-2"
                  >
                    {isLoadingState ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span>{loadingText}</span>
                      </>
                    ) : (
                      <>
                        <span>CREATE ACCOUNT AS {selectedRole.toUpperCase()}</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>

                  {/* Or divider */}
                  <div className="flex items-center gap-3 my-1">
                    <div className="flex-1 h-px bg-slate-200 dark:bg-slate-800" />
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">or sign up with</span>
                    <div className="flex-1 h-px bg-slate-200 dark:bg-slate-800" />
                  </div>

                  {/* Google Sign Up Button */}
                  <button
                    type="button"
                    onClick={handleGoogleSignIn}
                    disabled={isLoadingState}
                    className="w-full bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-750 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-bold rounded-full py-2.5 px-4 text-xs transition-all flex items-center justify-center gap-2.5 shadow-sm cursor-pointer disabled:opacity-50"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24">
                      <path
                        fill="#4285F4"
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      />
                      <path
                        fill="#34A853"
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                      />
                      <path
                        fill="#EA4335"
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                      />
                    </svg>
                    <span>Sign up with Google as {selectedRole.toUpperCase()}</span>
                  </button>

                  <p className="text-[10px] text-slate-400 font-medium text-center leading-tight">
                    By clicking on 'CREATE ACCOUNT' you agree to the{' '}
                    <span className="text-slate-700 dark:text-slate-300 font-bold underline cursor-pointer">Terms of Service</span> and{' '}
                    <span className="text-slate-700 dark:text-slate-300 font-bold underline cursor-pointer">Privacy Policy</span>.
                  </p>

                  <p className="text-center text-xs text-slate-500 dark:text-slate-400 font-bold pt-1">
                    Already have an account?{' '}
                    <button
                      type="button"
                      onClick={() => switchMode('login')}
                      className="text-[#D6001C] dark:text-red-400 font-black hover:underline cursor-pointer uppercase text-xs"
                    >
                      LOG IN
                    </button>
                  </p>
                </form>
              )}

              {/* 3. FORGOT PASSWORD FORM */}
              {mode === 'forgot_password' && (
                <form onSubmit={handleForgotPasswordSubmit} className="space-y-4">
                  <div>
                    <div className="relative">
                      <input
                        type="email"
                        disabled={isLoadingState}
                        value={email}
                        onChange={(e) => handleInputChange('email', e.target.value, setEmail)}
                        placeholder="Enter Registered Email"
                        className={`w-full bg-[#F8F9FC] dark:bg-slate-800 border rounded-full px-4 py-3 pl-11 text-xs font-semibold text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:bg-white dark:focus:bg-slate-800/90 focus:ring-2 transition-all ${
                          fieldErrors.email ? 'border-red-400' : 'border-slate-200 dark:border-slate-700 focus:border-[#D6001C]'
                        }`}
                      />
                      <Mail className="w-4 h-4 text-slate-400 absolute left-4 top-3.5" />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isLoadingState}
                    className="w-full bg-[#D6001C] hover:bg-[#B50018] text-white font-black rounded-full py-3.5 text-xs uppercase tracking-wider shadow-lg shadow-red-500/30 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {isLoadingState ? (
                      <span>Sending...</span>
                    ) : (
                      <span>SEND RESET LINK</span>
                    )}
                  </button>

                  <p className="text-center text-xs text-slate-500 dark:text-slate-400 font-bold">
                    <button
                      type="button"
                      onClick={() => switchMode('login')}
                      className="text-[#D6001C] dark:text-red-400 hover:underline font-extrabold cursor-pointer"
                    >
                      Back to Sign In
                    </button>
                  </p>
                </form>
              )}

              {/* 4. VERIFY EMAIL VIEW */}
              {mode === 'verify_email' && (
                <div className="text-center space-y-4 py-2" role="region" aria-label="Email verification status">
                  {/* Status Icon Header */}
                  <div className="flex justify-center">
                    {verificationState === 'verified' ? (
                      <div className="w-14 h-14 bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 rounded-full flex items-center justify-center shadow-xs">
                        <CheckCircle2 className="w-7 h-7 animate-scale" />
                      </div>
                    ) : verificationState === 'checking' ? (
                      <div className="w-14 h-14 bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-800 rounded-full flex items-center justify-center shadow-xs">
                        <div className="w-6 h-6 border-3 border-blue-600 dark:border-blue-400 border-t-transparent rounded-full animate-spin" />
                      </div>
                    ) : verificationState === 'unverified' ? (
                      <div className="w-14 h-14 bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800 rounded-full flex items-center justify-center shadow-xs">
                        <AlertCircle className="w-7 h-7" />
                      </div>
                    ) : verificationState === 'error' ? (
                      <div className="w-14 h-14 bg-red-50 dark:bg-red-950/60 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 rounded-full flex items-center justify-center shadow-xs">
                        <AlertCircle className="w-7 h-7" />
                      </div>
                    ) : (
                      <div className="w-14 h-14 bg-red-50 dark:bg-red-950/60 text-[#D6001C] dark:text-rose-400 border border-red-100 dark:border-red-800 rounded-full flex items-center justify-center shadow-xs">
                        <Mail className="w-7 h-7 animate-bounce" />
                      </div>
                    )}
                  </div>

                  {/* Header Titles */}
                  <div className="space-y-1">
                    <h3 className="text-base font-black text-slate-900 dark:text-slate-100">
                      {verificationState === 'verified'
                        ? 'Email Verified Successfully!'
                        : verificationState === 'checking'
                        ? 'Checking Verification Status…'
                        : 'Verify Your Email Address'}
                    </h3>
                    <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed max-w-xs mx-auto">
                      {verificationState === 'verified'
                        ? 'Your email is confirmed. Redirecting you to sign in...'
                        : 'We sent a verification link to:'}
                    </p>
                  </div>

                  {/* Target Email Capsule Display */}
                  <div className="bg-slate-100 dark:bg-slate-800 border border-slate-200/90 dark:border-slate-700 rounded-2xl p-2.5 max-w-xs mx-auto shadow-2xs">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">
                      Registered Email
                    </span>
                    <span className="text-xs font-black text-slate-900 dark:text-slate-100 break-all select-all">
                      {user?.email || email || 'your email'}
                    </span>
                  </div>

                  {/* Explicit Dynamic Feedback Card */}
                  {verificationState === 'verified' && (
                    <div className="bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 rounded-2xl p-3 text-xs font-bold flex items-center justify-center gap-2 max-w-xs mx-auto shadow-2xs animate-fade-in">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      <span>Email verified successfully! You can now log in.</span>
                    </div>
                  )}

                  {verificationState === 'unverified' && (
                    <div className="bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200 rounded-2xl p-3 text-xs font-semibold text-left flex items-start gap-2.5 max-w-xs mx-auto shadow-2xs animate-fade-in" role="alert">
                      <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                      <div className="space-y-1">
                        <p className="font-bold text-amber-900 dark:text-amber-100">Verification not detected yet</p>
                        <p className="text-[11px] text-amber-800 dark:text-amber-300 leading-normal">
                          Please make sure you clicked the verification link in your email, then click <strong>Check Again</strong> below.
                        </p>
                      </div>
                    </div>
                  )}

                  {verificationState === 'error' && (
                    <div className="bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-200 rounded-2xl p-3 text-xs font-semibold text-left flex items-start gap-2.5 max-w-xs mx-auto shadow-2xs animate-fade-in" role="alert">
                      <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
                      <div className="space-y-1">
                        <p className="font-bold text-red-900 dark:text-red-100">Couldn't check verification</p>
                        <p className="text-[11px] text-red-800 dark:text-red-300 leading-normal">
                          We couldn't check your verification status. Please check your connection and try again.
                        </p>
                      </div>
                    </div>
                  )}

                  {verificationState === 'idle' && (
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-normal max-w-xs mx-auto">
                      Click the link in your email, then tap <strong>I'VE VERIFIED MY EMAIL</strong> to activate your account.
                    </p>
                  )}

                  {/* Verification Actions */}
                  <div className="space-y-2.5 pt-1 max-w-xs mx-auto">
                    {/* Primary Button */}
                    <button
                      type="button"
                      disabled={verificationState === 'checking' || verificationState === 'verified'}
                      onClick={() => handleCheckVerification(false)}
                      className={`w-full text-white font-black py-3.5 rounded-full text-xs uppercase tracking-wider shadow-lg flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed ${
                        verificationState === 'verified'
                          ? 'bg-emerald-600 shadow-emerald-500/25'
                          : 'bg-[#D6001C] hover:bg-[#B50018] shadow-red-500/25'
                      }`}
                    >
                      {verificationState === 'checking' ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          <span>CHECKING VERIFICATION…</span>
                        </>
                      ) : verificationState === 'verified' ? (
                        <>
                          <Check className="w-4 h-4" />
                          <span>✓ VERIFIED! REDIRECTING…</span>
                        </>
                      ) : verificationState === 'unverified' ? (
                        <>
                          <RefreshCw className="w-4 h-4" />
                          <span>CHECK AGAIN</span>
                        </>
                      ) : verificationState === 'error' ? (
                        <>
                          <RotateCcw className="w-4 h-4" />
                          <span>TRY AGAIN</span>
                        </>
                      ) : (
                        <>
                          <RefreshCw className="w-4 h-4" />
                          <span>I'VE VERIFIED MY EMAIL</span>
                        </>
                      )}
                    </button>

                    {/* Resend Email Button */}
                    <button
                      type="button"
                      disabled={resendCooldown > 0 || verificationState === 'checking' || verificationState === 'verified'}
                      onClick={handleResendVerification}
                      className="w-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200/80 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 font-extrabold py-2.5 rounded-full text-xs transition-colors cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5"
                    >
                      <Mail className="w-3.5 h-3.5 text-slate-600 dark:text-slate-400" />
                      <span>{resendCooldown > 0 ? `RESEND EMAIL (${resendCooldown}s)` : 'RESEND EMAIL'}</span>
                    </button>

                    {/* Return to Sign In */}
                    <button
                      type="button"
                      onClick={() => switchMode('login')}
                      className="text-xs text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 font-bold underline cursor-pointer pt-1 block mx-auto transition-colors"
                    >
                      Return to Sign In
                    </button>
                  </div>
                </div>
              )}

            </motion.div>
          </div>

          {/* RIGHT COLUMN: ELEGANT FEATURE CHECKLIST PANEL (Matches Reference Design) */}
          <div className="md:col-span-6 lg:col-span-7 pl-0 md:pl-4 lg:pl-8 space-y-6">
            
            {/* Display Heading & Subtitle */}
            <div className="space-y-2">
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-slate-900 dark:text-white tracking-tight font-serif leading-none transition-colors">
                {mode === 'register' ? 'Create Account' : 'Welcome Back'}
              </h2>
              <h3 className="text-lg sm:text-xl font-extrabold text-slate-800 dark:text-slate-200 transition-colors">
                What you will get?
              </h3>
            </div>

            {/* Feature Checklist (Italian Pizza / Modern Refined Style) */}
            <div className="space-y-4 pt-2 max-w-lg">
              
              <div className="flex items-start gap-3.5 group">
                <div className="w-6 h-6 rounded-full bg-rose-100 dark:bg-rose-950/60 text-[#D6001C] dark:text-rose-400 flex items-center justify-center shrink-0 mt-0.5 group-hover:scale-110 transition-transform">
                  <Utensils className="w-3.5 h-3.5" />
                </div>
                <p className="text-xs sm:text-sm font-semibold text-slate-600 dark:text-slate-300 leading-snug transition-colors">
                  Order campus meals the easy way from all MTU cafeterias & student food hubs.
                </p>
              </div>

              <div className="flex items-start gap-3.5 group">
                <div className="w-6 h-6 rounded-full bg-rose-100 dark:bg-rose-950/60 text-[#D6001C] dark:text-rose-400 flex items-center justify-center shrink-0 mt-0.5 group-hover:scale-110 transition-transform">
                  <Clock className="w-3.5 h-3.5" />
                </div>
                <p className="text-xs sm:text-sm font-semibold text-slate-600 dark:text-slate-300 leading-snug transition-colors">
                  Express 15-minute hall-to-hall delivery by verified MTU student riders.
                </p>
              </div>

              <div className="flex items-start gap-3.5 group">
                <div className="w-6 h-6 rounded-full bg-rose-100 dark:bg-rose-950/60 text-[#D6001C] dark:text-rose-400 flex items-center justify-center shrink-0 mt-0.5 group-hover:scale-110 transition-transform">
                  <Award className="w-3.5 h-3.5" />
                </div>
                <p className="text-xs sm:text-sm font-semibold text-slate-600 dark:text-slate-300 leading-snug transition-colors">
                  Secure payments with Paystack debit card, USSD transfer, or BUKKIT campus wallet.
                </p>
              </div>

              <div className="flex items-start gap-3.5 group">
                <div className="w-6 h-6 rounded-full bg-rose-100 dark:bg-rose-950/60 text-[#D6001C] dark:text-rose-400 flex items-center justify-center shrink-0 mt-0.5 group-hover:scale-110 transition-transform">
                  <Users className="w-3.5 h-3.5" />
                </div>
                <p className="text-xs sm:text-sm font-semibold text-slate-600 dark:text-slate-300 leading-snug transition-colors">
                  Organize group orders with courtyard roommates and split delivery costs easily.
                </p>
              </div>

              <div className="flex items-start gap-3.5 group">
                <div className="w-6 h-6 rounded-full bg-rose-100 dark:bg-rose-950/60 text-[#D6001C] dark:text-rose-400 flex items-center justify-center shrink-0 mt-0.5 group-hover:scale-110 transition-transform">
                  <Gift className="w-3.5 h-3.5" />
                </div>
                <p className="text-xs sm:text-sm font-semibold text-slate-600 dark:text-slate-300 leading-snug transition-colors">
                  Earn reward points with every meal order and unlock student food discounts in a flash.
                </p>
              </div>

            </div>

            {/* Subtle Campus Sub-Tag */}
            <div className="pt-2 flex items-center gap-2 text-xs font-bold text-slate-400 dark:text-slate-500">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Mountain Top University Marketplace • Prayer City, Ogun State</span>
            </div>

          </div>

        </div>

      </div>

      {/* FOOTER BAR (Matches Reference Screenshot Footer Bar) */}
      <footer className="w-full bg-white/70 dark:bg-slate-900/80 backdrop-blur-md border-t border-slate-200/80 dark:border-slate-800 py-3.5 px-6 text-xs text-slate-500 dark:text-slate-400 font-semibold z-10 transition-colors">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          
          <div className="flex items-center gap-5">
            <span className="hover:text-[#D6001C] dark:hover:text-rose-400 cursor-pointer transition-colors">Explore</span>
            <span className="hover:text-[#D6001C] dark:hover:text-rose-400 cursor-pointer transition-colors">What</span>
            <span className="hover:text-[#D6001C] dark:hover:text-rose-400 cursor-pointer transition-colors">Help & feedback</span>
            <span className="hover:text-[#D6001C] dark:hover:text-rose-400 cursor-pointer transition-colors">Contact</span>
          </div>

          <div className="flex items-center gap-4 text-[11px] text-slate-400 dark:text-slate-500 font-medium">
            <span>© 2026 BUKKIT. All rights reserved.</span>
          </div>

        </div>
      </footer>

    </div>
  );
};


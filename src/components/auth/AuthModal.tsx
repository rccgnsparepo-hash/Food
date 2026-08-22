import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  Mail,
  Lock,
  User,
  Phone,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Eye,
  EyeOff,
  RotateCcw,
  Sparkles,
  KeyRound,
  ShieldCheck,
  ShoppingBag,
  Bike,
  Utensils,
  Building2,
  GraduationCap,
  Check
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuthStore } from '../../stores/useAuthStore';
import { useMarketplaceStore } from '../../stores/useMarketplaceStore';
import { translateFirebaseAuthError } from '../../lib/authErrorTranslator';
import { PasswordStrengthMeter } from './PasswordStrengthMeter';
import { BukkitLogo } from '../common/BukkitLogo';
import { UserRole } from '../../types';

interface AuthModalProps {
  initialMode?: 'login' | 'register' | 'forgot_password';
  onClose: () => void;
  onSuccess?: () => void;
}

type AuthStatus = 'idle' | 'loading' | 'success' | 'error' | 'email-verification-required';

export const AuthModal: React.FC<AuthModalProps> = ({ initialMode = 'login', onClose, onSuccess }) => {
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

  const { universities, campuses } = useMarketplaceStore();

  const [mode, setMode] = useState<'login' | 'register' | 'forgot_password' | 'verify_email'>(
    globalAuthStatus === 'email-verification-required' || (!isEmailVerified && user?.uid && !user.uid.startsWith('guest_'))
      ? 'verify_email'
      : initialMode
  );

  const [selectedRole, setSelectedRole] = useState<UserRole>('customer');
  const [authStatus, setAuthStatus] = useState<AuthStatus>(
    globalAuthStatus === 'email-verification-required' ? 'email-verification-required' : 'idle'
  );
  const [loadingText, setLoadingText] = useState('Processing...');

  // Form input states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [adminKey, setAdminKey] = useState('');
  const [universityId, setUniversityId] = useState('uni_mtu');
  const [campusId, setCampusId] = useState('campus_mtu_main');

  // UI Toggles & Feedback
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Dedicated email verification states
  const [hasManuallySwitched, setHasManuallySwitched] = useState(false);
  const [verificationState, setVerificationState] = useState<'idle' | 'checking' | 'verified' | 'unverified' | 'error'>('idle');
  const [verificationFeedback, setVerificationFeedback] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);

  // Reactive synchronization with global auth store
  React.useEffect(() => {
    if (!hasManuallySwitched && (globalAuthStatus === 'email-verification-required' || (!isEmailVerified && user?.uid && !user.uid.startsWith('guest_')))) {
      setMode('verify_email');
      setAuthStatus('email-verification-required');
      setLoadingText('Processing...');
    }
  }, [globalAuthStatus, isEmailVerified, user?.uid, hasManuallySwitched]);

  // Resend cooldown timer
  React.useEffect(() => {
    if (resendCooldown <= 0) return;
    const interval = setInterval(() => {
      setResendCooldown(prev => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [resendCooldown]);

  // Automatic verification detection on tab focus or visibility change
  React.useEffect(() => {
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

  // Reset error & auth state
  const handleTryAgain = () => {
    setErrorMsg(null);
    setAuthStatus('idle');
    setFieldErrors({});
  };

  // 1. LOGIN SUBMIT
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
    toast.info('Signing you in...');

    try {
      await loginWithEmail(email.trim(), password, selectedRole, adminKey.trim());
      setAuthStatus('success');
      setSuccessMsg('Login successful! Welcome back.');
      toast.success('✓ Login successful!');
      setTimeout(() => {
        if (onSuccess) onSuccess();
        onClose();
      }, 600);
    } catch (err: any) {
      const isUnverified = err?.message?.toLowerCase().includes('not verified') || err?.code === 'auth/email-not-verified';
      if (isUnverified) {
        setAuthStatus('email-verification-required');
        setMode('verify_email');
        const msg = 'Your email is not verified yet. Please check your email inbox and click the verification link.';
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

  // 2. REGISTER SUBMIT (WITH INLINE VALIDATION FOR ALL INPUTS)
  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);
    setFieldErrors({});

    const errors: Record<string, string> = {};

    // Name Validation
    if (!fullName.trim()) {
      errors.fullName = 'Full name is required.';
    } else if (fullName.trim().length < 2) {
      errors.fullName = 'Full name must be at least 2 characters.';
    }

    // Email Validation
    if (!email.trim()) {
      errors.email = 'Email address is required.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      errors.email = 'Please enter a valid email address.';
    }

    // Phone Validation
    const cleanPhone = phone.trim().replace(/\D/g, '');
    if (!phone.trim()) {
      errors.phone = 'Phone number is required.';
    } else if (cleanPhone.length < 8) {
      errors.phone = 'Please enter a valid phone number (at least 8 digits).';
    }

    // University Validation
    if (!universityId) {
      errors.universityId = 'Please select your university.';
    }

    // Campus Validation
    if (!campusId) {
      errors.campusId = 'Please select your campus.';
    }

    // Password Validation
    if (!password) {
      errors.password = 'Password is required.';
    } else if (password.length < 6) {
      errors.password = 'Password must be at least 6 characters long.';
    }

    // Confirm Password Validation
    if (!confirmPassword) {
      errors.confirmPassword = 'Please confirm your password.';
    } else if (password !== confirmPassword) {
      errors.confirmPassword = 'Passwords do not match.';
    }

    // Admin Passkey Validation
    if (selectedRole === 'admin' && !adminKey.trim()) {
      errors.adminKey = 'Admin Security Passkey is required.';
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      const firstErr = Object.values(errors)[0];
      setErrorMsg(firstErr);
      setAuthStatus('error');
      toast.error('Please fix the errors highlighted below.');
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
        adminKey: adminKey.trim()
      });
      setAuthStatus('email-verification-required');
      setMode('verify_email');
      setSuccessMsg('Account created successfully! Please check your email inbox to verify your account.');
      toast.success('✓ Account created! Please verify your email.');
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
      setSuccessMsg('Google sign-in successful!');
      toast.success('✓ Google sign-in successful!');
      setTimeout(() => {
        if (onSuccess) onSuccess();
        onClose();
      }, 600);
    } catch (err: any) {
      setAuthStatus('error');
      const humanError = translateFirebaseAuthError(err);
      setErrorMsg(humanError);
      toast.error(humanError);

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
      const msg = 'If an account exists for this email, you will receive a reset link.';
      setSuccessMsg(msg);
      toast.info(msg);
    }
  };

  // 5. RESEND VERIFICATION EMAIL
  const handleResendVerification = async () => {
    if (resendCooldown > 0 || verificationState === 'checking') return;
    setErrorMsg(null);
    setSuccessMsg(null);
    setVerificationFeedback(null);
    setAuthStatus('loading');
    setLoadingText('Resending verification email...');

    try {
      await resendVerificationEmail();
      setAuthStatus('email-verification-required');
      const targetEm = user?.email || email || 'your inbox';
      const msg = `Verification email resent to ${targetEm}! Please check your spam folder if not found.`;
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

  // 6. CHECK VERIFICATION STATUS
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

        setTimeout(() => {
          setHasManuallySwitched(true);
          setMode('login');
          setAuthStatus('idle');
          setVerificationState('idle');
          setSuccessMsg('Email verified successfully! You can now log in.');
          if (onSuccess) onSuccess();
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
  const targetEmail = user?.email || email || 'student@mtu.edu.ng';

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 12 }}
        className="bg-white dark:bg-slate-900 rounded-[32px] max-w-md w-full shadow-2xl border border-red-100 dark:border-slate-800 overflow-hidden relative my-auto"
      >
        {/* Red Brand Header Banner */}
        <div className="bg-slate-950 text-white p-6 text-center relative border-b border-slate-800">
          <button
            onClick={onClose}
            disabled={isLoadingState}
            className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer disabled:opacity-50"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="flex justify-center mb-2">
            <BukkitLogo variant="stacked" size="md" theme="dark" subtitleText="CAMPUS FOOD DELIVERY" />
          </div>
          <h2 className="text-lg font-extrabold tracking-tight text-white flex items-center justify-center gap-1.5 mt-1">
            <span>
              {mode === 'login' && 'Sign In to Account'}
              {mode === 'register' && 'Create Campus Account'}
              {mode === 'forgot_password' && 'Reset Password'}
              {mode === 'verify_email' && 'Verify Email Address'}
            </span>
            <Sparkles className="w-4 h-4 text-amber-400 animate-pulse" />
          </h2>
          <p className="text-[11px] font-medium text-slate-400 mt-0.5">
            Mountain Top University • Prayer City Marketplace
          </p>
        </div>

        <div className="p-6">
          {/* ROLE SELECTOR CAPSULE */}
          {mode !== 'verify_email' && mode !== 'forgot_password' && (
            <div className="mb-5">
              <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-1.5 text-center">
                Select Account Role
              </label>
              <div className="grid grid-cols-4 gap-1 bg-slate-100 dark:bg-slate-800 p-1.5 rounded-2xl border border-slate-200/80 dark:border-slate-700">
                <button
                  type="button"
                  disabled={isLoadingState}
                  onClick={() => handleRoleChange('customer')}
                  className={`py-2 px-1 rounded-xl text-[11px] font-extrabold transition-all flex items-center justify-center gap-1 cursor-pointer disabled:opacity-50 ${
                    selectedRole === 'customer'
                      ? 'bg-[#D6001C] text-white shadow-md shadow-red-500/25'
                      : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-200/60 dark:hover:bg-slate-700/60'
                  }`}
                >
                  <ShoppingBag className="w-3 h-3" />
                  <span>Customer</span>
                </button>

                <button
                  type="button"
                  disabled={isLoadingState}
                  onClick={() => handleRoleChange('kitchen')}
                  className={`py-2 px-1 rounded-xl text-[11px] font-extrabold transition-all flex items-center justify-center gap-1 cursor-pointer disabled:opacity-50 ${
                    selectedRole === 'kitchen'
                      ? 'bg-[#D6001C] text-white shadow-md shadow-red-500/25'
                      : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-200/60 dark:hover:bg-slate-700/60'
                  }`}
                >
                  <Utensils className="w-3 h-3" />
                  <span>Kitchen</span>
                </button>

                <button
                  type="button"
                  disabled={isLoadingState}
                  onClick={() => handleRoleChange('rider')}
                  className={`py-2 px-1 rounded-xl text-[11px] font-extrabold transition-all flex items-center justify-center gap-1 cursor-pointer disabled:opacity-50 ${
                    selectedRole === 'rider'
                      ? 'bg-[#D6001C] text-white shadow-md shadow-red-500/25'
                      : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-200/60 dark:hover:bg-slate-700/60'
                  }`}
                >
                  <Bike className="w-3 h-3" />
                  <span>Rider</span>
                </button>

                <button
                  type="button"
                  disabled={isLoadingState}
                  onClick={() => handleRoleChange('admin')}
                  className={`py-2 px-1 rounded-xl text-[11px] font-extrabold transition-all flex items-center justify-center gap-1 cursor-pointer disabled:opacity-50 ${
                    selectedRole === 'admin'
                      ? 'bg-slate-900 dark:bg-slate-700 text-white shadow-md'
                      : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-200/60 dark:hover:bg-slate-700/60'
                  }`}
                >
                  <ShieldCheck className="w-3 h-3" />
                  <span>Admin</span>
                </button>
              </div>
            </div>
          )}

          {/* DYNAMIC ERROR DISPLAY WITH 'TRY AGAIN' BUTTON */}
          <AnimatePresence mode="wait">
            {errorMsg && (
              <motion.div
                initial={{ opacity: 0, height: 0, y: -6 }}
                animate={{ opacity: 1, height: 'auto', y: 0 }}
                exit={{ opacity: 0, height: 0, y: -6 }}
                className="mb-4 p-3.5 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 rounded-2xl text-xs font-medium text-red-900 dark:text-red-200 flex flex-col gap-2.5 shadow-xs overflow-hidden"
              >
                <div className="flex items-start gap-2.5">
                  <AlertCircle className="w-4.5 h-4.5 text-[#D6001C] dark:text-red-400 shrink-0 mt-0.5" />
                  <div className="flex-1 leading-relaxed">
                    <strong className="block font-extrabold text-red-950 dark:text-red-100 mb-0.5">Authentication Error</strong>
                    <span>{errorMsg}</span>
                  </div>
                </div>

                {/* Explicit 'Try Again' button to clear error and reset state to idle */}
                <div className="flex justify-end pt-2 border-t border-red-200/80 dark:border-red-900/50">
                  <button
                    type="button"
                    onClick={handleTryAgain}
                    className="px-3.5 py-1.5 bg-white dark:bg-slate-800 border border-red-200 dark:border-red-900/50 hover:bg-red-100/60 dark:hover:bg-red-950/60 text-red-700 dark:text-red-300 hover:text-red-900 dark:hover:text-red-100 rounded-xl text-xs font-extrabold transition-all flex items-center gap-1.5 cursor-pointer shadow-xs active:scale-95"
                  >
                    <RotateCcw className="w-3.5 h-3.5 text-red-600 dark:text-red-400" />
                    <span>Try Again</span>
                  </button>
                </div>
              </motion.div>
            )}

            {successMsg && (
              <motion.div
                initial={{ opacity: 0, height: 0, y: -6 }}
                animate={{ opacity: 1, height: 'auto', y: 0 }}
                exit={{ opacity: 0, height: 0, y: -6 }}
                className="mb-4 p-3.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/50 rounded-2xl text-xs font-medium text-emerald-900 dark:text-emerald-200 flex items-start gap-2.5 shadow-xs overflow-hidden"
              >
                <CheckCircle2 className="w-4.5 h-4.5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                <div className="leading-relaxed">
                  <strong className="block font-bold text-emerald-950 dark:text-emerald-100 mb-0.5">Success</strong>
                  <span>{successMsg}</span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Mode Tabs (Sign In / Create Account) */}
          {mode !== 'forgot_password' && mode !== 'verify_email' && (
            <div className="flex border-b border-slate-200 dark:border-slate-800 mb-5 text-xs font-bold text-slate-400">
              <button
                type="button"
                disabled={isLoadingState}
                onClick={() => switchMode('login')}
                className={`flex-1 pb-3 text-center transition-colors cursor-pointer ${
                  mode === 'login'
                    ? 'border-b-2 border-[#D6001C] text-[#D6001C] dark:text-red-400 font-black text-sm'
                    : 'hover:text-slate-700 dark:hover:text-slate-300'
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                disabled={isLoadingState}
                onClick={() => switchMode('register')}
                className={`flex-1 pb-3 text-center transition-colors cursor-pointer ${
                  mode === 'register'
                    ? 'border-b-2 border-[#D6001C] text-[#D6001C] dark:text-red-400 font-black text-sm'
                    : 'hover:text-slate-700 dark:hover:text-slate-300'
                }`}
              >
                Create Account
              </button>
            </div>
          )}

          {/* 1. SIGN IN FORM */}
          {mode === 'login' && (
            <form onSubmit={handleLoginSubmit} className="space-y-4">
              {selectedRole === 'admin' && (
                <div className="bg-slate-900 text-white p-3.5 rounded-2xl space-y-2 border border-slate-800 shadow-md">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
                      <KeyRound className="w-3.5 h-3.5 text-amber-400" />
                      <span>Admin Security Passkey</span>
                    </label>
                    <span className="text-[10px] font-mono bg-slate-800 px-2 py-0.5 rounded-full text-slate-300">
                      Default: MTU-ADMIN-2026
                    </span>
                  </div>
                  <input
                    type="password"
                    disabled={isLoadingState}
                    value={adminKey}
                    onChange={(e) => handleInputChange('adminKey', e.target.value, setAdminKey)}
                    placeholder="Enter Admin Passkey"
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2 text-xs font-mono text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-400"
                  />
                  {fieldErrors.adminKey && (
                    <p className="text-[11px] text-amber-400 font-semibold flex items-center gap-1">
                      <AlertCircle className="w-3 h-3 shrink-0" />
                      <span>{fieldErrors.adminKey}</span>
                    </p>
                  )}
                </div>
              )}

              {/* Email Address */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Email Address</label>
                <div className="relative">
                  <input
                    type="email"
                    disabled={isLoadingState}
                    value={email}
                    onChange={(e) => handleInputChange('email', e.target.value, setEmail)}
                    placeholder={
                      selectedRole === 'admin'
                        ? 'admin@mtu.edu.ng'
                        : selectedRole === 'rider'
                        ? 'rider@mtu.edu.ng'
                        : 'student@mtu.edu.ng'
                    }
                    className={`w-full bg-slate-50 dark:bg-slate-800 border rounded-full px-4 py-3 pl-10 text-xs font-semibold text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:bg-white dark:focus:bg-slate-800/90 focus:ring-2 transition-all disabled:opacity-50 ${
                      fieldErrors.email
                        ? 'border-red-400 focus:ring-red-400/20'
                        : 'border-slate-200 dark:border-slate-700 focus:border-[#D6001C] focus:ring-red-500/10'
                    }`}
                  />
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                </div>
                {fieldErrors.email && (
                  <p className="text-[11px] text-red-600 dark:text-red-400 font-semibold mt-1 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3 shrink-0" />
                    <span>{fieldErrors.email}</span>
                  </p>
                )}
              </div>

              {/* Password */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">Password</label>
                  <button
                    type="button"
                    disabled={isLoadingState}
                    onClick={() => setMode('forgot_password')}
                    className="text-xs text-[#D6001C] dark:text-red-400 hover:underline font-bold cursor-pointer"
                  >
                    Forgot password?
                  </button>
                </div>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    disabled={isLoadingState}
                    value={password}
                    onChange={(e) => handleInputChange('password', e.target.value, setPassword)}
                    placeholder="••••••••"
                    className={`w-full bg-slate-50 dark:bg-slate-800 border rounded-full px-4 py-3 pl-10 pr-10 text-xs font-semibold text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:bg-white dark:focus:bg-slate-800/90 focus:ring-2 transition-all disabled:opacity-50 ${
                      fieldErrors.password
                        ? 'border-red-400 focus:ring-red-400/20'
                        : 'border-slate-200 dark:border-slate-700 focus:border-[#D6001C] focus:ring-red-500/10'
                    }`}
                  />
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-3.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {fieldErrors.password && (
                  <p className="text-[11px] text-red-600 dark:text-red-400 font-semibold mt-1 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3 shrink-0" />
                    <span>{fieldErrors.password}</span>
                  </p>
                )}
              </div>

              {/* Action Button */}
              <button
                type="submit"
                disabled={isLoadingState}
                className="w-full bg-[#D6001C] hover:bg-[#B50018] text-white font-black rounded-full py-3.5 text-xs uppercase tracking-wider shadow-lg shadow-red-500/25 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 mt-2 active:scale-[0.99]"
              >
                {isLoadingState ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>{loadingText}</span>
                  </>
                ) : (
                  <>
                    <span>CONTINUE AS {selectedRole.toUpperCase()}</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>

              {/* Google Sign In */}
              {selectedRole !== 'admin' && (
                <>
                  <div className="relative my-3">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-slate-200 dark:border-slate-800" />
                    </div>
                    <div className="relative flex justify-center text-[10px]">
                      <span className="bg-white dark:bg-slate-900 px-2 text-slate-400 dark:text-slate-500 font-extrabold uppercase tracking-wider">
                        or continue with
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleGoogleSignIn}
                    disabled={isLoadingState}
                    className="w-full bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-750 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-bold rounded-full py-3 text-xs transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 shadow-xs"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                    </svg>
                    <span>Google Account</span>
                  </button>
                </>
              )}

              <p className="text-center text-xs text-slate-500 dark:text-slate-400 font-semibold pt-1">
                Don't have an account?{' '}
                <button
                  type="button"
                  onClick={() => switchMode('register')}
                  className="text-[#D6001C] dark:text-red-400 font-black hover:underline cursor-pointer uppercase text-xs"
                >
                  REGISTER
                </button>
              </p>
            </form>
          )}

          {/* 2. REGISTER FORM WITH INLINE VALIDATION FOR ALL INPUTS & PASSWORD STRENGTH METER */}
          {mode === 'register' && (
            <form onSubmit={handleRegisterSubmit} className="space-y-3.5">
              {selectedRole === 'admin' && (
                <div className="bg-slate-900 text-white p-3.5 rounded-2xl space-y-2 border border-slate-800 shadow-md">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
                      <KeyRound className="w-3.5 h-3.5 text-amber-400" />
                      <span>Admin Security Passkey</span>
                    </label>
                    <span className="text-[10px] font-mono bg-slate-800 px-2 py-0.5 rounded-full text-slate-300">
                      Default: MTU-ADMIN-2026
                    </span>
                  </div>
                  <input
                    type="password"
                    disabled={isLoadingState}
                    value={adminKey}
                    onChange={(e) => handleInputChange('adminKey', e.target.value, setAdminKey)}
                    placeholder="Enter Admin Passkey"
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2 text-xs font-mono text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-400"
                  />
                  {fieldErrors.adminKey && (
                    <p className="text-[11px] text-amber-400 font-semibold flex items-center gap-1">
                      <AlertCircle className="w-3 h-3 shrink-0" />
                      <span>{fieldErrors.adminKey}</span>
                    </p>
                  )}
                </div>
              )}

              {/* Full Name */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Full Name</label>
                <div className="relative">
                  <input
                    type="text"
                    disabled={isLoadingState}
                    value={fullName}
                    onChange={(e) => handleInputChange('fullName', e.target.value, setFullName)}
                    placeholder="Akinola David"
                    className={`w-full bg-slate-50 dark:bg-slate-800 border rounded-full px-4 py-2.5 pl-10 text-xs font-semibold text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:bg-white dark:focus:bg-slate-800/90 focus:ring-2 transition-all disabled:opacity-50 ${
                      fieldErrors.fullName
                        ? 'border-red-400 focus:ring-red-400/20'
                        : 'border-slate-200 dark:border-slate-700 focus:border-[#D6001C] focus:ring-red-500/10'
                    }`}
                  />
                  <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                </div>
                {fieldErrors.fullName && (
                  <p className="text-[11px] text-red-600 dark:text-red-400 font-semibold mt-1 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3 shrink-0" />
                    <span>{fieldErrors.fullName}</span>
                  </p>
                )}
              </div>

              {/* Email Address & Phone Number Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Email Address</label>
                  <div className="relative">
                    <input
                      type="email"
                      disabled={isLoadingState}
                      value={email}
                      onChange={(e) => handleInputChange('email', e.target.value, setEmail)}
                      placeholder="student@mtu.edu.ng"
                      className={`w-full bg-slate-50 dark:bg-slate-800 border rounded-full px-3.5 py-2.5 pl-9 text-xs font-semibold text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:bg-white dark:focus:bg-slate-800/90 focus:ring-2 transition-all disabled:opacity-50 ${
                        fieldErrors.email
                          ? 'border-red-400 focus:ring-red-400/20'
                          : 'border-slate-200 dark:border-slate-700 focus:border-[#D6001C] focus:ring-red-500/10'
                      }`}
                    />
                    <Mail className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
                  </div>
                  {fieldErrors.email && (
                    <p className="text-[11px] text-red-600 dark:text-red-400 font-semibold mt-1 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3 shrink-0" />
                      <span>{fieldErrors.email}</span>
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Phone Number</label>
                  <div className="relative">
                    <input
                      type="tel"
                      disabled={isLoadingState}
                      value={phone}
                      onChange={(e) => handleInputChange('phone', e.target.value, setPhone)}
                      placeholder="+234 810 000 1122"
                      className={`w-full bg-slate-50 dark:bg-slate-800 border rounded-full px-3.5 py-2.5 pl-9 text-xs font-semibold text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:bg-white dark:focus:bg-slate-800/90 focus:ring-2 transition-all disabled:opacity-50 ${
                        fieldErrors.phone
                          ? 'border-red-400 focus:ring-red-400/20'
                          : 'border-slate-200 dark:border-slate-700 focus:border-[#D6001C] focus:ring-red-500/10'
                      }`}
                    />
                    <Phone className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
                  </div>
                  {fieldErrors.phone && (
                    <p className="text-[11px] text-red-600 dark:text-red-400 font-semibold mt-1 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3 shrink-0" />
                      <span>{fieldErrors.phone}</span>
                    </p>
                  )}
                </div>
              </div>

              {/* University & Campus Selection Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">University</label>
                  <div className="relative">
                    <select
                      disabled={isLoadingState}
                      value={universityId}
                      onChange={(e) => handleUniversityChange(e.target.value)}
                      className={`w-full bg-slate-50 dark:bg-slate-800 border rounded-full px-3.5 py-2.5 pl-9 text-xs font-semibold text-slate-800 dark:text-slate-100 focus:outline-none focus:bg-white dark:focus:bg-slate-800 focus:ring-2 transition-all disabled:opacity-50 appearance-none cursor-pointer ${
                        fieldErrors.universityId
                          ? 'border-red-400 focus:ring-red-400/20'
                          : 'border-slate-200 dark:border-slate-700 focus:border-[#D6001C] focus:ring-red-500/10'
                      }`}
                    >
                      {universities.map(u => (
                        <option key={u.id} value={u.id}>{u.short_name || u.name}</option>
                      ))}
                      {universities.length === 0 && <option value="uni_mtu">Mountain Top Univ.</option>}
                    </select>
                    <GraduationCap className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3 pointer-events-none" />
                  </div>
                  {fieldErrors.universityId && (
                    <p className="text-[11px] text-red-600 dark:text-red-400 font-semibold mt-1 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3 shrink-0" />
                      <span>{fieldErrors.universityId}</span>
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Campus Zone</label>
                  <div className="relative">
                    <select
                      disabled={isLoadingState}
                      value={campusId}
                      onChange={(e) => handleInputChange('campusId', e.target.value, setCampusId)}
                      className={`w-full bg-slate-50 dark:bg-slate-800 border rounded-full px-3.5 py-2.5 pl-9 text-xs font-semibold text-slate-800 dark:text-slate-100 focus:outline-none focus:bg-white dark:focus:bg-slate-800 focus:ring-2 transition-all disabled:opacity-50 appearance-none cursor-pointer ${
                        fieldErrors.campusId
                          ? 'border-red-400 focus:ring-red-400/20'
                          : 'border-slate-200 dark:border-slate-700 focus:border-[#D6001C] focus:ring-red-500/10'
                      }`}
                    >
                      {availableCampuses.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                      {availableCampuses.length === 0 && <option value="campus_mtu_main">Main Campus (Prayer City)</option>}
                    </select>
                    <Building2 className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3 pointer-events-none" />
                  </div>
                  {fieldErrors.campusId && (
                    <p className="text-[11px] text-red-600 dark:text-red-400 font-semibold mt-1 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3 shrink-0" />
                      <span>{fieldErrors.campusId}</span>
                    </p>
                  )}
                </div>
              </div>

              {/* Password & Confirm Password Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Password</label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      disabled={isLoadingState}
                      value={password}
                      onChange={(e) => handleInputChange('password', e.target.value, setPassword)}
                      placeholder="••••••••"
                      className={`w-full bg-slate-50 dark:bg-slate-800 border rounded-full px-3.5 py-2.5 pr-8 text-xs font-semibold text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:bg-white dark:focus:bg-slate-800/90 focus:ring-2 transition-all disabled:opacity-50 ${
                        fieldErrors.password
                          ? 'border-red-400 focus:ring-red-400/20'
                          : 'border-slate-200 dark:border-slate-700 focus:border-[#D6001C] focus:ring-red-500/10'
                      }`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-3 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                  {fieldErrors.password && (
                    <p className="text-[11px] text-red-600 dark:text-red-400 font-semibold mt-1 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3 shrink-0" />
                      <span>{fieldErrors.password}</span>
                    </p>
                  )}

                  {/* Password Strength Meter Component */}
                  <PasswordStrengthMeter password={password} />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Confirm Password</label>
                  <div className="relative">
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      disabled={isLoadingState}
                      value={confirmPassword}
                      onChange={(e) => handleInputChange('confirmPassword', e.target.value, setConfirmPassword)}
                      placeholder="••••••••"
                      className={`w-full bg-slate-50 dark:bg-slate-800 border rounded-full px-3.5 py-2.5 pr-8 text-xs font-semibold text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:bg-white dark:focus:bg-slate-800/90 focus:ring-2 transition-all disabled:opacity-50 ${
                        fieldErrors.confirmPassword
                          ? 'border-red-400 focus:ring-red-400/20'
                          : 'border-slate-200 dark:border-slate-700 focus:border-[#D6001C] focus:ring-red-500/10'
                      }`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-3 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
                    >
                      {showConfirmPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                  {fieldErrors.confirmPassword && (
                    <p className="text-[11px] text-red-600 dark:text-red-400 font-semibold mt-1 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3 shrink-0" />
                      <span>{fieldErrors.confirmPassword}</span>
                    </p>
                  )}
                </div>
              </div>

              <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium text-center pt-1">
                By continuing you confirm that you agree with our{' '}
                <span className="text-[#D6001C] dark:text-red-400 font-bold cursor-pointer hover:underline">Terms & Conditions</span>
              </p>

              {/* Submit Registration Button */}
              <button
                type="submit"
                disabled={isLoadingState}
                className="w-full bg-[#D6001C] hover:bg-[#B50018] text-white font-black rounded-full py-3.5 text-xs tracking-wider uppercase shadow-lg shadow-red-500/25 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 active:scale-[0.99] mt-2"
              >
                {isLoadingState ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>{loadingText}</span>
                  </>
                ) : (
                  <>
                    <span>CONTINUE AS {selectedRole.toUpperCase()}</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>

              {/* Or divider */}
              <div className="flex items-center gap-3 my-1">
                <div className="flex-1 h-px bg-slate-200 dark:bg-slate-800" />
                <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">or sign up with</span>
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

              <p className="text-center text-xs text-slate-500 dark:text-slate-400 font-semibold pt-1">
                Already have an account?{' '}
                <button
                  type="button"
                  onClick={() => switchMode('login')}
                  className="text-[#D6001C] dark:text-red-400 font-black hover:underline cursor-pointer uppercase text-xs"
                >
                  LOGIN
                </button>
              </p>
            </form>
          )}

          {/* 3. FORGOT PASSWORD FORM */}
          {mode === 'forgot_password' && (
            <form onSubmit={handleForgotPasswordSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Enter your Registered Email Address
                </label>
                <div className="relative">
                  <input
                    type="email"
                    disabled={isLoadingState}
                    value={email}
                    onChange={(e) => handleInputChange('email', e.target.value, setEmail)}
                    placeholder="student@mtu.edu.ng"
                    className={`w-full bg-slate-50 dark:bg-slate-800 border rounded-full px-4 py-3 pl-10 text-xs font-semibold text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:bg-white dark:focus:bg-slate-800/90 focus:ring-2 transition-all disabled:opacity-50 ${
                      fieldErrors.email
                        ? 'border-red-400 focus:ring-red-400/20'
                        : 'border-slate-200 dark:border-slate-700 focus:border-[#D6001C] focus:ring-red-500/10'
                    }`}
                  />
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                </div>
                {fieldErrors.email && (
                  <p className="text-[11px] text-red-600 dark:text-red-400 font-semibold mt-1 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3 shrink-0" />
                    <span>{fieldErrors.email}</span>
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={isLoadingState}
                className="w-full bg-[#D6001C] hover:bg-[#B50018] text-white font-black rounded-full py-3.5 text-xs uppercase tracking-wider shadow-lg shadow-red-500/25 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isLoadingState ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>{loadingText}</span>
                  </>
                ) : (
                  <span>SEND RESET LINK</span>
                )}
              </button>

              <p className="text-center text-xs text-slate-500 dark:text-slate-400 font-semibold pt-1">
                Remember your password?{' '}
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

          {/* 4. SPECIALIZED EMAIL VERIFICATION SCREEN */}
          {mode === 'verify_email' && (
            <div className="text-center space-y-4 py-2" role="region" aria-label="Email verification status">
              {/* Status Icon Header */}
              <div className="flex justify-center">
                {verificationState === 'verified' ? (
                  <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/50 rounded-3xl flex items-center justify-center mx-auto shadow-xs">
                    <CheckCircle2 className="w-8 h-8 animate-scale" />
                  </div>
                ) : verificationState === 'checking' ? (
                  <div className="w-16 h-16 bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-900/50 rounded-3xl flex items-center justify-center mx-auto shadow-xs">
                    <div className="w-7 h-7 border-3 border-blue-600 dark:border-blue-400 border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : verificationState === 'unverified' ? (
                  <div className="w-16 h-16 bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-900/50 rounded-3xl flex items-center justify-center mx-auto shadow-xs">
                    <AlertCircle className="w-8 h-8" />
                  </div>
                ) : verificationState === 'error' ? (
                  <div className="w-16 h-16 bg-red-50 dark:bg-red-950/60 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900/50 rounded-3xl flex items-center justify-center mx-auto shadow-xs">
                    <AlertCircle className="w-8 h-8" />
                  </div>
                ) : (
                  <div className="w-16 h-16 bg-red-50 dark:bg-red-950/60 text-[#D6001C] dark:text-red-400 border border-red-100 dark:border-red-900/50 rounded-3xl flex items-center justify-center mx-auto shadow-xs">
                    <Mail className="w-8 h-8 animate-bounce" />
                  </div>
                )}
              </div>

              {/* Title & Description */}
              <div className="space-y-1.5">
                <h3 className="text-lg font-black text-slate-900 dark:text-slate-100">
                  {verificationState === 'verified'
                    ? 'Email Verified Successfully!'
                    : verificationState === 'checking'
                    ? 'Checking Verification Status…'
                    : 'Verify Your Email Address'}
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed max-w-xs mx-auto">
                  {verificationState === 'verified'
                    ? 'Your email is confirmed. Redirecting you to sign in...'
                    : 'We sent a confirmation email with a verification link to:'}
                </p>

                {/* Email Address Capsule Display */}
                <div className="bg-slate-100 dark:bg-slate-800 border border-slate-200/90 dark:border-slate-700 rounded-2xl p-3 max-w-xs mx-auto my-2 shadow-2xs">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">
                    Target Email
                  </span>
                  <span className="text-xs font-black text-slate-900 dark:text-slate-100 break-all select-all">
                    {targetEmail}
                  </span>
                </div>

                {/* Explicit Dynamic Feedback Card */}
                {verificationState === 'verified' && (
                  <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/50 text-emerald-800 dark:text-emerald-300 rounded-2xl p-3 text-xs font-bold flex items-center justify-center gap-2 max-w-xs mx-auto shadow-2xs animate-fade-in">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <span>Email verified successfully! You can now log in.</span>
                  </div>
                )}

                {verificationState === 'unverified' && (
                  <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/50 text-amber-800 dark:text-amber-300 rounded-2xl p-3 text-xs font-semibold text-left flex items-start gap-2.5 max-w-xs mx-auto shadow-2xs animate-fade-in" role="alert">
                    <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <p className="font-bold text-amber-900 dark:text-amber-200">Verification not detected yet</p>
                      <p className="text-[11px] text-amber-800 dark:text-amber-300 leading-normal">
                        Please make sure you clicked the verification link in your email, then click <strong>Check Again</strong> below.
                      </p>
                    </div>
                  </div>
                )}

                {verificationState === 'error' && (
                  <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 text-red-800 dark:text-red-300 rounded-2xl p-3 text-xs font-semibold text-left flex items-start gap-2.5 max-w-xs mx-auto shadow-2xs animate-fade-in" role="alert">
                    <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <p className="font-bold text-red-900 dark:text-red-200">Couldn't check verification</p>
                      <p className="text-[11px] text-red-800 dark:text-red-300 leading-normal">
                        We couldn't check your verification status. Please check your connection and try again.
                      </p>
                    </div>
                  </div>
                )}

                {verificationState === 'idle' && (
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-normal max-w-xs mx-auto">
                    Please click the link in your email to activate your BUKKIT account and start placing food orders.
                  </p>
                )}
              </div>

              {/* Action Buttons for Verification Flow */}
              <div className="space-y-2.5 pt-2 max-w-xs mx-auto">
                {/* 1. I'VE VERIFIED MY EMAIL / CHECK AGAIN */}
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

                {/* 2. RESEND EMAIL */}
                <button
                  type="button"
                  disabled={resendCooldown > 0 || verificationState === 'checking' || verificationState === 'verified'}
                  onClick={handleResendVerification}
                  className="w-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200/80 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 font-extrabold py-3 rounded-full text-xs transition-colors cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5"
                >
                  <Mail className="w-3.5 h-3.5 text-slate-600 dark:text-slate-400" />
                  <span>{resendCooldown > 0 ? `RESEND EMAIL (${resendCooldown}s)` : 'RESEND EMAIL'}</span>
                </button>

                {/* Return to Sign In / Switch Account */}
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
        </div>
      </motion.div>
    </div>
  );
};

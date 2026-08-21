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
  Check
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuthStore } from '../../stores/useAuthStore';
import { useMarketplaceStore } from '../../stores/useMarketplaceStore';
import { translateFirebaseAuthError } from '../../lib/authErrorTranslator';
import { PasswordStrengthMeter } from './PasswordStrengthMeter';
import { UserRole } from '../../types';

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

  const { universities, campuses } = useMarketplaceStore();

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

  // UI Toggles & Feedback
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [loadingText, setLoadingText] = useState('Processing...');

  // Track manual mode changes so the user isn't stuck on verify_email
  const [hasManuallySwitched, setHasManuallySwitched] = useState(false);

  // Reactive synchronization with global auth store
  useEffect(() => {
    if (!hasManuallySwitched && (globalAuthStatus === 'email-verification-required' || (!isEmailVerified && user?.uid && !user.uid.startsWith('guest_')))) {
      setMode('verify_email');
      setAuthStatus('email-verification-required');
      setLoadingText('Processing...');
    }
  }, [globalAuthStatus, isEmailVerified, user?.uid, hasManuallySwitched]);

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

  const switchMode = (newMode: 'login' | 'register' | 'forgot_password') => {
    setMode(newMode);
    setErrorMsg(null);
    setSuccessMsg(null);
    setFieldErrors({});
    setAuthStatus('idle');
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
        adminKey: adminKey.trim()
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
    setAuthStatus('loading');
    setLoadingText('Connecting to Google...');
    toast.info('Connecting to Google Account...');

    try {
      const isSignUpFlow = mode === 'register';
      await loginWithGoogle(selectedRole, isSignUpFlow);
      setAuthStatus('success');
      setSuccessMsg(`Google sign-in successful! Signed in as ${selectedRole.toUpperCase()}.`);
      toast.success('✓ Google sign-in successful!');
    } catch (err: any) {
      setAuthStatus('error');
      const humanError = translateFirebaseAuthError(err);
      setErrorMsg(humanError);
      toast.error(humanError);
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
    setErrorMsg(null);
    setSuccessMsg(null);
    setAuthStatus('loading');
    setLoadingText('Resending email...');

    try {
      await resendVerificationEmail();
      setAuthStatus('email-verification-required');
      const msg = 'Verification email resent! Please check your email inbox.';
      setSuccessMsg(msg);
      toast.success('✓ Verification email resent.');
    } catch (err: any) {
      setAuthStatus('error');
      const humanError = translateFirebaseAuthError(err);
      setErrorMsg(humanError);
      toast.error(humanError);
    }
  };

  // 6. CHECK VERIFICATION
  const handleCheckVerification = async () => {
    setAuthStatus('loading');
    setLoadingText('Verifying status...');
    toast.info('Checking email verification status...');

    try {
      const verified = await reloadUser();
      if (verified) {
        setAuthStatus('success');
        setSuccessMsg('Email verified successfully! Welcome to BUKKIT.');
        toast.success('✓ Email verified! Welcome to BUKKIT.');
      } else {
        setAuthStatus('email-verification-required');
        const msg = 'Email is not verified yet. Please click the link in your email inbox.';
        setErrorMsg(msg);
        toast.warning(msg);
      }
    } catch (err: any) {
      setAuthStatus('error');
      const humanError = translateFirebaseAuthError(err);
      setErrorMsg(humanError);
      toast.error(humanError);
    }
  };

  const isLoadingState = authStatus === 'loading';

  return (
    <div className="min-h-screen bg-[#F3F4F7] text-slate-800 font-sans selection:bg-[#D6001C] selection:text-white flex flex-col justify-between relative overflow-hidden">
      
      {/* GIANT BACKGROUND WATERMARK HEADING (Matches Reference Screenshot "Signup") */}
      <div className="absolute top-0 left-0 right-0 text-center pointer-events-none select-none overflow-hidden opacity-[0.06] z-0 pt-2">
        <span className="font-serif font-black text-[140px] sm:text-[180px] md:text-[220px] lg:text-[260px] tracking-tight text-slate-900 uppercase leading-none block">
          {mode === 'register' ? 'Signup' : 'BUKKIT'}
        </span>
      </div>

      {/* CULINARY FOOD ACCENTS IN CORNERS (Matches Reference Screenshot food bowls) */}
      <div 
        className="hidden md:block absolute -top-12 -right-12 w-72 lg:w-96 h-72 lg:h-96 bg-cover bg-center rounded-full shadow-2xl pointer-events-none z-0 border-8 border-white/40"
        style={{
          backgroundImage: `url('https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800&auto=format&fit=crop')`
        }}
      />
      <div 
        className="hidden md:block absolute -bottom-16 -left-16 w-64 lg:w-80 h-64 lg:h-80 bg-cover bg-center rounded-full shadow-2xl pointer-events-none z-0 border-8 border-white/40"
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
              className="bg-white rounded-[32px] p-6 sm:p-8 shadow-2xl border border-slate-100/90 relative z-20 w-full max-w-md mx-auto"
            >
              {/* TOP BRAND BADGE (Circular Pizza/Food Logo like screenshot) */}
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full border-2 border-[#D6001C]/20 bg-rose-50 flex items-center justify-center relative shadow-sm shrink-0">
                    <div className="w-8 h-8 rounded-full bg-[#D6001C] text-white flex items-center justify-center font-black text-sm">
                      B
                    </div>
                    {/* Tiny badge dot */}
                    <span className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-amber-400 rounded-full border-2 border-white" />
                  </div>
                  <div>
                    <h1 className="text-xs font-black tracking-tight text-slate-900 uppercase">
                      BUKKIT CAMPUS FOOD
                    </h1>
                    <p className="text-[10px] font-bold text-slate-400 tracking-wider">
                      MTU MARKETPLACE
                    </p>
                  </div>
                </div>

                <span className="text-[10px] font-extrabold bg-rose-50 text-[#D6001C] px-2.5 py-1 rounded-full border border-rose-100 uppercase">
                  {selectedRole}
                </span>
              </div>

              {/* ROLE SWITCHER TABS - 4 PHASES */}
              <div className="mb-5">
                <div className="grid grid-cols-4 gap-1 bg-[#F4F5F8] p-1 rounded-full border border-slate-200/80">
                  <button
                    type="button"
                    disabled={isLoadingState}
                    onClick={() => handleRoleChange('customer')}
                    className={`py-1.5 px-1 rounded-full text-[10px] sm:text-[11px] font-black transition-all flex items-center justify-center gap-1 cursor-pointer disabled:opacity-50 ${
                      selectedRole === 'customer'
                        ? 'bg-[#D6001C] text-white shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
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
                        : 'text-slate-600 hover:text-slate-900'
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
                        : 'text-slate-600 hover:text-slate-900'
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
                        ? 'bg-slate-900 text-white shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
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
                    className="mb-4 p-3 bg-red-50 border border-red-200 rounded-2xl text-xs font-medium text-red-900 flex flex-col gap-2 shadow-xs overflow-hidden"
                  >
                    <div className="flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 text-[#D6001C] shrink-0 mt-0.5" />
                      <div className="flex-1 text-[11px] leading-relaxed">
                        <strong className="block font-bold text-red-950 mb-0.5">Authentication Error</strong>
                        <span>{errorMsg}</span>
                      </div>
                    </div>
                    <div className="flex justify-end pt-1.5 border-t border-red-200/80">
                      <button
                        type="button"
                        onClick={handleTryAgain}
                        className="px-3 py-1 bg-white border border-red-200 hover:bg-red-100/60 text-red-700 hover:text-red-900 rounded-xl text-[11px] font-extrabold transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs active:scale-95"
                      >
                        <RotateCcw className="w-3 h-3 text-red-600" />
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
                    className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs font-medium text-emerald-900 flex items-start gap-2 shadow-xs overflow-hidden"
                  >
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
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
                        className={`w-full bg-[#F8F9FC] border rounded-full px-4 py-3 pl-11 text-xs font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:ring-2 transition-all ${
                          fieldErrors.email
                            ? 'border-red-400 focus:ring-red-400/20'
                            : 'border-slate-200 focus:border-[#D6001C] focus:ring-red-500/10'
                        }`}
                      />
                      <Mail className="w-4 h-4 text-slate-400 absolute left-4 top-3.5" />
                    </div>
                    {fieldErrors.email && (
                      <p className="text-[10px] text-red-600 font-bold mt-1 pl-4">{fieldErrors.email}</p>
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
                        className={`w-full bg-[#F8F9FC] border rounded-full px-4 py-3 pl-11 pr-11 text-xs font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:ring-2 transition-all ${
                          fieldErrors.password
                            ? 'border-red-400 focus:ring-red-400/20'
                            : 'border-slate-200 focus:border-[#D6001C] focus:ring-red-500/10'
                        }`}
                      />
                      <Lock className="w-4 h-4 text-slate-400 absolute left-4 top-3.5" />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-4 top-3.5 text-slate-400 hover:text-slate-700 cursor-pointer"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    <div className="flex justify-end mt-1 pr-2">
                      <button
                        type="button"
                        disabled={isLoadingState}
                        onClick={() => switchMode('forgot_password')}
                        className="text-[11px] text-[#D6001C] hover:underline font-bold cursor-pointer"
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
                    <span className="text-slate-700 font-bold underline cursor-pointer">Terms of Service</span> and{' '}
                    <span className="text-slate-700 font-bold underline cursor-pointer">Privacy Policy</span>.
                  </p>

                  {/* Google Sign In */}
                  {selectedRole !== 'admin' && (
                    <>
                      <div className="relative my-2">
                        <div className="absolute inset-0 flex items-center">
                          <div className="w-full border-t border-slate-200" />
                        </div>
                        <div className="relative flex justify-center text-[10px]">
                          <span className="bg-white px-2.5 text-slate-400 font-bold uppercase tracking-wider">
                            Join with
                          </span>
                        </div>
                      </div>

                      <div className="flex justify-center gap-3">
                        <button
                          type="button"
                          onClick={handleGoogleSignIn}
                          disabled={isLoadingState}
                          className="w-10 h-10 rounded-full border border-slate-200 bg-white hover:bg-slate-50 flex items-center justify-center transition-all shadow-xs cursor-pointer"
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

                  <p className="text-center text-xs text-slate-500 font-bold pt-2">
                    Need an account?{' '}
                    <button
                      type="button"
                      onClick={() => switchMode('register')}
                      className="text-[#D6001C] font-black hover:underline cursor-pointer uppercase text-xs"
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
                        className={`w-full bg-[#F8F9FC] border rounded-full px-4 py-2.5 pl-11 text-xs font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:ring-2 transition-all ${
                          fieldErrors.fullName ? 'border-red-400' : 'border-slate-200 focus:border-[#D6001C]'
                        }`}
                      />
                      <User className="w-4 h-4 text-slate-400 absolute left-4 top-3" />
                    </div>
                    {fieldErrors.fullName && (
                      <p className="text-[10px] text-red-600 font-bold mt-1 pl-4">{fieldErrors.fullName}</p>
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
                        className={`w-full bg-[#F8F9FC] border rounded-full px-4 py-2.5 pl-11 text-xs font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:ring-2 transition-all ${
                          fieldErrors.email ? 'border-red-400' : 'border-slate-200 focus:border-[#D6001C]'
                        }`}
                      />
                      <Mail className="w-4 h-4 text-slate-400 absolute left-4 top-3" />
                    </div>
                    {fieldErrors.email && (
                      <p className="text-[10px] text-red-600 font-bold mt-1 pl-4">{fieldErrors.email}</p>
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
                          className={`w-full bg-[#F8F9FC] border rounded-full px-3.5 py-2.5 pl-9 text-xs font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:ring-2 transition-all ${
                            fieldErrors.phone ? 'border-red-400' : 'border-slate-200 focus:border-[#D6001C]'
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
                          className={`w-full bg-[#F8F9FC] border rounded-full px-3.5 py-2.5 pl-9 pr-8 text-xs font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:ring-2 transition-all ${
                            fieldErrors.password ? 'border-red-400' : 'border-slate-200 focus:border-[#D6001C]'
                          }`}
                        />
                        <Lock className="w-3.5 h-3.5 text-slate-400 absolute left-3.5 top-3" />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-3 text-slate-400 hover:text-slate-700 cursor-pointer"
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
                        className={`w-full bg-[#F8F9FC] border rounded-full px-4 py-2.5 pl-11 pr-11 text-xs font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:ring-2 transition-all ${
                          fieldErrors.confirmPassword ? 'border-red-400' : 'border-slate-200 focus:border-[#D6001C]'
                        }`}
                      />
                      <Lock className="w-4 h-4 text-slate-400 absolute left-4 top-3" />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-4 top-3 text-slate-400 hover:text-slate-700 cursor-pointer"
                      >
                        {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    {fieldErrors.confirmPassword && (
                      <p className="text-[10px] text-red-600 font-bold mt-1 pl-4">{fieldErrors.confirmPassword}</p>
                    )}
                  </div>

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
                        <span>CREATE ACCOUNT</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>

                  <p className="text-[10px] text-slate-400 font-medium text-center leading-tight">
                    By clicking on 'CREATE ACCOUNT' you agree to the{' '}
                    <span className="text-slate-700 font-bold underline cursor-pointer">Terms of Service</span> and{' '}
                    <span className="text-slate-700 font-bold underline cursor-pointer">Privacy Policy</span>.
                  </p>

                  <p className="text-center text-xs text-slate-500 font-bold pt-1">
                    Already have an account?{' '}
                    <button
                      type="button"
                      onClick={() => switchMode('login')}
                      className="text-[#D6001C] font-black hover:underline cursor-pointer uppercase text-xs"
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
                        className={`w-full bg-[#F8F9FC] border rounded-full px-4 py-3 pl-11 text-xs font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:ring-2 transition-all ${
                          fieldErrors.email ? 'border-red-400' : 'border-slate-200 focus:border-[#D6001C]'
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

                  <p className="text-center text-xs text-slate-500 font-bold">
                    <button
                      type="button"
                      onClick={() => switchMode('login')}
                      className="text-[#D6001C] hover:underline font-extrabold cursor-pointer"
                    >
                      Back to Sign In
                    </button>
                  </p>
                </form>
              )}

              {/* 4. VERIFY EMAIL VIEW */}
              {mode === 'verify_email' && (
                <div className="text-center space-y-4 py-2">
                  <div className="w-12 h-12 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto">
                    <Mail className="w-6 h-6 animate-bounce" />
                  </div>

                  <div className="space-y-1">
                    <h3 className="text-sm font-extrabold text-slate-900">Verify your Email Address</h3>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Link sent to: <strong className="text-slate-900 font-extrabold">{user?.email || email}</strong>
                    </p>
                  </div>

                  <div className="space-y-2 pt-2">
                    <button
                      type="button"
                      disabled={isLoadingState}
                      onClick={handleCheckVerification}
                      className="w-full bg-[#D6001C] hover:bg-[#B50018] text-white font-black py-3 rounded-full text-xs uppercase tracking-wider shadow-md flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>I'VE VERIFIED MY EMAIL</span>
                    </button>

                    <button
                      type="button"
                      disabled={isLoadingState}
                      onClick={handleResendVerification}
                      className="w-full bg-slate-100 text-slate-800 font-bold py-2 rounded-full text-xs cursor-pointer"
                    >
                      RESEND EMAIL
                    </button>

                    <button
                      type="button"
                      onClick={() => switchMode('login')}
                      className="text-xs text-slate-500 hover:text-slate-800 font-bold underline cursor-pointer block mx-auto pt-1"
                    >
                      Return to Login
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
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-slate-900 tracking-tight font-serif leading-none">
                {mode === 'register' ? 'Create Account' : 'Welcome Back'}
              </h2>
              <h3 className="text-lg sm:text-xl font-extrabold text-slate-800">
                What you will get?
              </h3>
            </div>

            {/* Feature Checklist (Italian Pizza / Modern Refined Style) */}
            <div className="space-y-4 pt-2 max-w-lg">
              
              <div className="flex items-start gap-3.5 group">
                <div className="w-6 h-6 rounded-full bg-rose-100 text-[#D6001C] flex items-center justify-center shrink-0 mt-0.5 group-hover:scale-110 transition-transform">
                  <Utensils className="w-3.5 h-3.5" />
                </div>
                <p className="text-xs sm:text-sm font-semibold text-slate-600 leading-snug">
                  Order campus meals the easy way from all MTU cafeterias & student food hubs.
                </p>
              </div>

              <div className="flex items-start gap-3.5 group">
                <div className="w-6 h-6 rounded-full bg-rose-100 text-[#D6001C] flex items-center justify-center shrink-0 mt-0.5 group-hover:scale-110 transition-transform">
                  <Clock className="w-3.5 h-3.5" />
                </div>
                <p className="text-xs sm:text-sm font-semibold text-slate-600 leading-snug">
                  Express 15-minute hall-to-hall delivery by verified MTU student riders.
                </p>
              </div>

              <div className="flex items-start gap-3.5 group">
                <div className="w-6 h-6 rounded-full bg-rose-100 text-[#D6001C] flex items-center justify-center shrink-0 mt-0.5 group-hover:scale-110 transition-transform">
                  <Award className="w-3.5 h-3.5" />
                </div>
                <p className="text-xs sm:text-sm font-semibold text-slate-600 leading-snug">
                  Secure payments with Paystack debit card, USSD transfer, or BUKKIT campus wallet.
                </p>
              </div>

              <div className="flex items-start gap-3.5 group">
                <div className="w-6 h-6 rounded-full bg-rose-100 text-[#D6001C] flex items-center justify-center shrink-0 mt-0.5 group-hover:scale-110 transition-transform">
                  <Users className="w-3.5 h-3.5" />
                </div>
                <p className="text-xs sm:text-sm font-semibold text-slate-600 leading-snug">
                  Organize group orders with courtyard roommates and split delivery costs easily.
                </p>
              </div>

              <div className="flex items-start gap-3.5 group">
                <div className="w-6 h-6 rounded-full bg-rose-100 text-[#D6001C] flex items-center justify-center shrink-0 mt-0.5 group-hover:scale-110 transition-transform">
                  <Gift className="w-3.5 h-3.5" />
                </div>
                <p className="text-xs sm:text-sm font-semibold text-slate-600 leading-snug">
                  Earn reward points with every meal order and unlock student food discounts in a flash.
                </p>
              </div>

            </div>

            {/* Subtle Campus Sub-Tag */}
            <div className="pt-2 flex items-center gap-2 text-xs font-bold text-slate-400">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Mountain Top University Marketplace • Prayer City, Ogun State</span>
            </div>

          </div>

        </div>

      </div>

      {/* FOOTER BAR (Matches Reference Screenshot Footer Bar) */}
      <footer className="w-full bg-white/70 backdrop-blur-md border-t border-slate-200/80 py-3.5 px-6 text-xs text-slate-500 font-semibold z-10">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          
          <div className="flex items-center gap-5">
            <span className="hover:text-[#D6001C] cursor-pointer transition-colors">Explore</span>
            <span className="hover:text-[#D6001C] cursor-pointer transition-colors">What</span>
            <span className="hover:text-[#D6001C] cursor-pointer transition-colors">Help & feedback</span>
            <span className="hover:text-[#D6001C] cursor-pointer transition-colors">Contact</span>
          </div>

          <div className="flex items-center gap-4 text-[11px] text-slate-400 font-medium">
            <span>© 2026 BUKKIT. All rights reserved.</span>
          </div>

        </div>
      </footer>

    </div>
  );
};


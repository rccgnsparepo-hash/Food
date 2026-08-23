import React from 'react';
import { motion } from 'motion/react';
import { ShieldAlert, LogOut, Smartphone, AlertCircle, ArrowRight, RefreshCw } from 'lucide-react';
import { useAuthStore } from '../../stores/useAuthStore';
import { AppFlavor, UserRole } from '../../types';
import { BUKKIT_FLAVORS, getRoleMismatchErrorMessage, setDevAppFlavor } from '../../config/appFlavor';
import { BukkitLogo } from '../common/BukkitLogo';
import { triggerHaptic } from '../../utils/haptics';

interface AppRoleMismatchScreenProps {
  currentFlavor: AppFlavor;
  userRole: UserRole;
}

export const AppRoleMismatchScreen: React.FC<AppRoleMismatchScreenProps> = ({
  currentFlavor,
  userRole
}) => {
  const { user, logout } = useAuthStore();
  const currentConfig = BUKKIT_FLAVORS[currentFlavor];
  const { title, body, requiredApp } = getRoleMismatchErrorMessage(userRole, currentFlavor);

  // Map user role to the correct APK flavor for easy switching in preview mode
  let targetFlavor: AppFlavor = 'customer';
  if (['kitchen', 'kitchen_manager', 'kitchen_staff'].includes(userRole)) {
    targetFlavor = 'vendor';
  } else if (userRole === 'rider') {
    targetFlavor = 'rider';
  } else if (['admin', 'super_admin'].includes(userRole)) {
    targetFlavor = 'admin';
  }

  const handleLogout = async () => {
    triggerHaptic(25);
    await logout();
  };

  const handleSwitchFlavor = () => {
    triggerHaptic(30);
    setDevAppFlavor(targetFlavor);
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 sm:p-6 text-white relative overflow-hidden">
      {/* Background Ambience */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-red-600/10 rounded-full blur-3xl pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6 relative z-10"
      >
        {/* Branding Header */}
        <div className="flex flex-col items-center text-center space-y-3">
          <BukkitLogo variant="stacked" size="md" theme="dark" subtitleText={currentConfig.appName.toUpperCase()} />
          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-red-500/10 border border-red-500/30 rounded-full text-red-400 text-xs font-black uppercase tracking-wider">
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>APK Role Mismatch</span>
          </div>
        </div>

        {/* Lockout Box */}
        <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 text-center space-y-3">
          <div className="w-12 h-12 rounded-full bg-red-500/20 text-red-400 flex items-center justify-center mx-auto">
            <AlertCircle className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-base font-extrabold text-white">{title}</h2>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
              {body}
            </p>
          </div>
        </div>

        {/* User Profile Snapshot */}
        <div className="bg-slate-800/50 rounded-2xl p-4 border border-slate-700/60 space-y-2 text-xs">
          <div className="flex justify-between items-center text-slate-400">
            <span>Signed-in Account:</span>
            <span className="font-semibold text-white truncate max-w-[200px]">{user?.email}</span>
          </div>
          <div className="flex justify-between items-center text-slate-400">
            <span>User Name:</span>
            <span className="font-semibold text-white">{user?.name || 'BUKKIT User'}</span>
          </div>
          <div className="flex justify-between items-center text-slate-400">
            <span>Verified Database Role:</span>
            <span className="font-black text-amber-400 uppercase bg-amber-400/10 px-2 py-0.5 rounded-md">
              {String(userRole).replace('_', ' ')}
            </span>
          </div>
          <div className="flex justify-between items-center text-slate-400">
            <span>Current APK Package:</span>
            <span className="font-mono text-[11px] text-slate-300">{currentConfig.packageName}</span>
          </div>
        </div>

        {/* Action Controls */}
        <div className="space-y-3">
          {/* Switch to Matching APK (Preview/Dev Mode) */}
          <button
            onClick={handleSwitchFlavor}
            className="w-full bg-[#FF5A00] hover:bg-[#E04F00] text-white font-extrabold py-3.5 px-4 rounded-2xl text-xs flex items-center justify-center gap-2 shadow-lg shadow-orange-500/20 transition-all cursor-pointer"
          >
            <Smartphone className="w-4 h-4" />
            <span>Launch {requiredApp}</span>
            <ArrowRight className="w-4 h-4 ml-auto" />
          </button>

          {/* Log Out & Switch Account */}
          <button
            onClick={handleLogout}
            className="w-full bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold py-3.5 px-4 rounded-2xl text-xs flex items-center justify-center gap-2 transition-all cursor-pointer border border-slate-700"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out & Use Another Account</span>
          </button>
        </div>

        <div className="text-center">
          <p className="text-[11px] text-slate-500">
            Need elevated role access for campus operations? Contact Mountain Top University IT Support.
          </p>
        </div>
      </motion.div>
    </div>
  );
};

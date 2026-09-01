import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ShoppingBag,
  MapPin,
  User,
  Shield,
  Bike,
  UtensilsCrossed,
  Store,
  Clock,
  Wallet,
  LogOut,
  ChevronDown,
  Bell,
  Sun,
  Moon,
  Monitor
} from 'lucide-react';
import { BukkitLogo } from '../common/BukkitLogo';
import { useAuthStore } from '../../stores/useAuthStore';
import { useCartStore } from '../../stores/useCartStore';
import { useThemeStore } from '../../stores/useThemeStore';

interface NavbarProps {
  onOpenCart: () => void;
  onOpenAuth: () => void;
  onOpenNotifications?: () => void;
  unreadNotificationsCount?: number;
  activeView: string;
  setActiveView: (view: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  onOpenCart,
  onOpenAuth,
  onOpenNotifications,
  unreadNotificationsCount = 0,
  activeView,
  setActiveView
}) => {
  const { user, role, logout } = useAuthStore();
  const effectiveRole = (user?.active_role || user?.role || role) as string;
  const { items, setCartOpen } = useCartStore();
  const { theme, resolvedTheme, toggleTheme, setTheme } = useThemeStore();
  const [showProfileMenu, setShowProfileMenu] = useState(false);

  const totalCartItems = items.reduce((sum, item) => sum + item.quantity, 0);
  const isGuest = !user?.uid || user.uid.startsWith('guest_');

  return (
    <header className="sticky top-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-emerald-100/80 dark:border-slate-800 shadow-2xs transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        
        {/* Brand Logo & Context */}
        <motion.div
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.97 }}
          onClick={() => {
            if (effectiveRole === 'customer') {
              setActiveView('home');
            }
          }}
          className="flex items-center gap-2.5 cursor-pointer group"
        >
          <BukkitLogo variant="full" size="sm" />
          {effectiveRole !== 'customer' && (
            <span className="bg-[#0D472B] dark:bg-emerald-600 text-white text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider shadow-xs">
              {effectiveRole === 'rider' ? 'RIDER' : (effectiveRole === 'kitchen' || effectiveRole === 'kitchen_manager' || effectiveRole === 'kitchen_staff') ? 'KITCHEN' : 'ADMIN'}
            </span>
          )}
        </motion.div>

        {/* CUSTOMER DESKTOP NAVIGATION: Strictly Home, Menu, Vendors, Wallet, Orders */}
        {effectiveRole === 'customer' && (
          <nav className="hidden md:flex items-center gap-1 lg:gap-2">
            {[
              { id: 'home', label: 'Home', icon: UtensilsCrossed },
              { id: 'menu', label: 'Menu', icon: UtensilsCrossed },
              { id: 'vendors', label: 'Vendors', icon: Store },
              { id: 'wallet', label: 'Wallet', icon: Wallet },
              { id: 'orders', label: 'Orders', icon: Clock },
            ].map((navItem) => {
              const isActive = activeView === navItem.id || (navItem.id === 'orders' && activeView === 'tracking');
              return (
                <button
                  key={navItem.id}
                  id={`nav-link-${navItem.id}`}
                  onClick={() => setActiveView(navItem.id)}
                  className={`relative px-4 py-2 rounded-full text-xs lg:text-sm font-extrabold transition-all cursor-pointer flex items-center gap-1.5 ${
                    isActive
                      ? 'text-white'
                      : 'text-slate-600 dark:text-slate-300 hover:text-emerald-950 dark:hover:text-white hover:bg-emerald-50/80 dark:hover:bg-slate-800'
                  }`}
                >
                  {isActive && (
                    <motion.span
                      layoutId="navbarActiveIndicator"
                      transition={{ type: 'spring', stiffness: 450, damping: 30 }}
                      className="absolute inset-0 bg-[#0D472B] dark:bg-emerald-600 rounded-full shadow-xs"
                    />
                  )}
                  <span className="relative z-10">{navItem.label}</span>
                </button>
              );
            })}
          </nav>
        )}

        {/* Non-Customer Portal Context Info */}
        {effectiveRole === 'rider' && (
          <div className="hidden sm:flex items-center gap-2 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800/60 text-emerald-800 dark:text-emerald-300 text-xs font-extrabold px-3 py-1.5 rounded-full">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
            <span>Rider Active & Ready for Orders</span>
          </div>
        )}

        {(effectiveRole === 'kitchen' || effectiveRole === 'kitchen_manager' || effectiveRole === 'kitchen_staff') && (
          <div className="hidden sm:flex items-center gap-2 bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800/60 text-amber-900 dark:text-amber-300 text-xs font-extrabold px-3 py-1.5 rounded-full">
            <Store className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
            <span>{user?.kitchen_profile?.vendor_name || 'Campus Kitchen Stand'}</span>
          </div>
        )}

        {(effectiveRole === 'admin' || effectiveRole === 'super_admin') && (
          <div className="hidden sm:flex items-center gap-2 bg-slate-900 dark:bg-slate-800 text-white text-xs font-extrabold px-3.5 py-1.5 rounded-full shadow-xs border border-slate-700">
            <Shield className="w-3.5 h-3.5 text-red-400" />
            <span>Campus Control Console</span>
          </div>
        )}

        {/* Right Side Actions */}
        <div className="flex items-center gap-2 sm:gap-3">
          
          {/* Customer Location */}
          {role === 'customer' && (
            <motion.div
              whileHover={{ y: -1, scale: 1.01 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setActiveView('orders')}
              className="hidden lg:flex items-center gap-2 bg-rose-50/80 dark:bg-slate-800/80 border border-rose-100 dark:border-slate-700 rounded-full px-3.5 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 cursor-pointer hover:bg-rose-100/60 dark:hover:bg-slate-700 transition-colors shadow-2xs"
            >
              <MapPin className="w-3.5 h-3.5 text-[#D6001C] dark:text-red-400" />
              <span className="text-slate-900 dark:text-slate-100 font-bold truncate max-w-[140px]">
                {user?.address || 'Mountain Top Univ'}
              </span>
            </motion.div>
          )}

          {/* Dedicated Dark Mode Toggle Button */}
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.92 }}
            onClick={toggleTheme}
            className="p-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-2xl transition-colors cursor-pointer border border-slate-200 dark:border-slate-700 shadow-2xs flex items-center justify-center"
            title={resolvedTheme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            aria-label="Toggle Dark Mode"
          >
            {resolvedTheme === 'dark' ? (
              <Sun className="w-5 h-5 text-amber-400 fill-amber-400/20 transition-transform rotate-0" />
            ) : (
              <Moon className="w-5 h-5 text-slate-700 fill-slate-700/10 transition-transform rotate-0" />
            )}
          </motion.button>

          {/* Cart Drawer Button */}
          {role === 'customer' && (
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.92 }}
              onClick={() => setCartOpen(true)}
              className="relative p-2.5 bg-rose-50 dark:bg-slate-800 text-[#D6001C] dark:text-red-400 hover:bg-rose-100 dark:hover:bg-slate-700 rounded-2xl transition-colors cursor-pointer border border-rose-100 dark:border-slate-700 shadow-2xs"
              title="Open Cart"
            >
              <ShoppingBag className="w-5 h-5" />
              {totalCartItems > 0 && (
                <motion.span
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 20 }}
                  className="absolute -top-1 -right-1 bg-[#D6001C] text-white text-[11px] font-black w-5 h-5 rounded-full flex items-center justify-center border-2 border-white dark:border-slate-900 shadow-xs"
                >
                  {totalCartItems}
                </motion.span>
              )}
            </motion.button>
          )}

          {/* Centralized Notification Bell Drawer Button */}
          {onOpenNotifications && (
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.92 }}
              onClick={onOpenNotifications}
              className="relative p-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-2xl transition-colors cursor-pointer border border-slate-200 dark:border-slate-700 shadow-2xs"
              title="Notification Center"
            >
              <Bell className="w-5 h-5" />
              {unreadNotificationsCount > 0 && (
                <motion.span
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 20 }}
                  className="absolute -top-1 -right-1 bg-[#D6001C] text-white text-[10px] font-black w-4 h-4 rounded-full flex items-center justify-center border-2 border-white dark:border-slate-900 shadow-xs"
                >
                  {unreadNotificationsCount > 9 ? '9+' : unreadNotificationsCount}
                </motion.span>
              )}
            </motion.button>
          )}

          {/* User Profile Avatar with Direct Logout & Theme Menu */}
          <div className="relative">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setShowProfileMenu(!showProfileMenu)}
              className="flex items-center gap-2 p-1 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer border border-slate-200 dark:border-slate-700"
            >
              <div className="w-8 h-8 rounded-full overflow-hidden border border-rose-200 dark:border-slate-600 shadow-2xs">
                <img
                  src={user?.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(user?.email || 'user')}`}
                  alt={user?.name || 'User'}
                  className="w-full h-full object-cover"
                />
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-slate-600 dark:text-slate-400 mr-1" />
            </motion.button>

            {/* Profile & Session Dropdown Menu */}
            <AnimatePresence>
              {showProfileMenu && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setShowProfileMenu(false)}
                  />
                  <motion.div
                    initial={{ opacity: 0, y: 8, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 8, scale: 0.96 }}
                    transition={{ duration: 0.15 }}
                    className="absolute right-0 mt-2 w-64 bg-white dark:bg-slate-900 rounded-3xl shadow-xl border border-rose-100 dark:border-slate-800 p-4 z-50 space-y-3"
                  >
                    <div className="border-b border-slate-100 dark:border-slate-800 pb-3">
                      <p className="text-xs font-black text-slate-900 dark:text-slate-100 truncate">{user?.name || 'BUKKIT User'}</p>
                      <p className="text-[11px] text-slate-400 dark:text-slate-500 font-medium truncate">{user?.email}</p>
                      <div className="mt-1.5 flex items-center justify-between">
                        <span className="inline-block bg-[#D6001C]/10 dark:bg-red-950/40 text-[#D6001C] dark:text-red-400 text-[10px] font-black px-2 py-0.5 rounded-full uppercase">
                          Account: {role.toUpperCase()}
                        </span>
                        {role === 'customer' && (
                          <span className="text-[11px] font-extrabold text-emerald-600 dark:text-emerald-400">
                            ₦{(user?.wallet_balance ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Quick Theme Selector in Profile Menu */}
                    <div className="space-y-1.5 pb-2 border-b border-slate-100 dark:border-slate-800">
                      <div className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider px-1">
                        Theme Preference
                      </div>
                      <div className="grid grid-cols-3 gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-2xl">
                        <button
                          onClick={() => setTheme('light')}
                          className={`py-1 px-2 rounded-xl text-[11px] font-bold flex items-center justify-center gap-1 transition-all cursor-pointer ${
                            theme === 'light'
                              ? 'bg-white text-slate-900 shadow-2xs font-black'
                              : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                          }`}
                        >
                          <Sun className="w-3 h-3 text-amber-500" />
                          <span>Light</span>
                        </button>
                        <button
                          onClick={() => setTheme('dark')}
                          className={`py-1 px-2 rounded-xl text-[11px] font-bold flex items-center justify-center gap-1 transition-all cursor-pointer ${
                            theme === 'dark'
                              ? 'bg-slate-900 text-white shadow-2xs font-black'
                              : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                          }`}
                        >
                          <Moon className="w-3 h-3 text-blue-400" />
                          <span>Dark</span>
                        </button>
                        <button
                          onClick={() => setTheme('system')}
                          className={`py-1 px-2 rounded-xl text-[11px] font-bold flex items-center justify-center gap-1 transition-all cursor-pointer ${
                            theme === 'system'
                              ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs font-black'
                              : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                          }`}
                        >
                          <Monitor className="w-3 h-3 text-emerald-500" />
                          <span>Auto</span>
                        </button>
                      </div>
                    </div>

                    {role === 'customer' && (
                      <div className="space-y-1">
                        <button
                          onClick={() => {
                            setActiveView('profile');
                            setShowProfileMenu(false);
                          }}
                          className="w-full text-left px-3 py-2 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-rose-50 dark:hover:bg-slate-800 hover:text-[#D6001C] dark:hover:text-red-400 transition-colors flex items-center gap-2 cursor-pointer"
                        >
                          <User className="w-3.5 h-3.5" />
                          <span>My Account & Notifications</span>
                        </button>
                        <button
                          onClick={() => {
                            setActiveView('orders');
                            setShowProfileMenu(false);
                          }}
                          className="w-full text-left px-3 py-2 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-rose-50 dark:hover:bg-slate-800 hover:text-[#D6001C] dark:hover:text-red-400 transition-colors flex items-center gap-2 cursor-pointer"
                        >
                          <Clock className="w-3.5 h-3.5" />
                          <span>Track Active Orders</span>
                        </button>
                      </div>
                    )}

                    <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                      <button
                        onClick={() => {
                          setShowProfileMenu(false);
                          logout();
                        }}
                        className="w-full text-left px-3 py-2.5 rounded-2xl text-xs font-black text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors flex items-center gap-2 cursor-pointer"
                      >
                        <LogOut className="w-4 h-4" />
                        <span>Sign Out of Account</span>
                      </button>
                    </div>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>

        </div>

      </div>
    </header>
  );
};


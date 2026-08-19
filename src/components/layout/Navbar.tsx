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
  Power
} from 'lucide-react';
import { BukkitLogo } from '../common/BukkitLogo';
import { useAuthStore } from '../../stores/useAuthStore';
import { useCartStore } from '../../stores/useCartStore';

interface NavbarProps {
  onOpenCart: () => void;
  onOpenAuth: () => void;
  activeView: string;
  setActiveView: (view: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({ onOpenCart, onOpenAuth, activeView, setActiveView }) => {
  const { user, role, logout } = useAuthStore();
  const { items, setCartOpen } = useCartStore();
  const [showProfileMenu, setShowProfileMenu] = useState(false);

  const totalCartItems = items.reduce((sum, item) => sum + item.quantity, 0);
  const isGuest = !user?.uid || user.uid.startsWith('guest_');

  // Specific portal branding subtitle based on authenticated role
  const portalTitle =
    role === 'rider'
      ? 'Rider Delivery Portal'
      : role === 'kitchen' || role === 'kitchen_manager' || role === 'kitchen_staff'
      ? 'Kitchen Stand Portal'
      : role === 'admin' || role === 'super_admin'
      ? 'Campus Admin Suite'
      : 'Campus Food Delivery';

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-emerald-100/80 shadow-2xs transition-all">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        
        {/* Brand Logo & Context */}
        <motion.div
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.97 }}
          onClick={() => {
            if (role === 'customer') {
              setActiveView('home');
            }
          }}
          className="flex items-center gap-2.5 cursor-pointer group"
        >
          <BukkitLogo variant="full" size="sm" />
          {role !== 'customer' && (
            <span className="bg-[#0D472B] text-white text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider shadow-xs">
              {role === 'rider' ? 'RIDER' : role === 'kitchen' ? 'KITCHEN' : 'ADMIN'}
            </span>
          )}
        </motion.div>

        {/* CUSTOMER DESKTOP NAVIGATION: Strictly Home, Menu, Vendors, Wallet, Orders */}
        {role === 'customer' && (
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
                      : 'text-slate-600 hover:text-emerald-950 hover:bg-emerald-50/80'
                  }`}
                >
                  {isActive && (
                    <motion.span
                      layoutId="navbarActiveIndicator"
                      transition={{ type: 'spring', stiffness: 450, damping: 30 }}
                      className="absolute inset-0 bg-[#0D472B] rounded-full shadow-xs"
                    />
                  )}
                  <span className="relative z-10">{navItem.label}</span>
                </button>
              );
            })}
          </nav>
        )}

        {/* Non-Customer Portal Context Info */}
        {role === 'rider' && (
          <div className="hidden sm:flex items-center gap-2 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-extrabold px-3 py-1.5 rounded-full">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
            <span>Rider Active & Ready for Orders</span>
          </div>
        )}

        {role === 'kitchen' && (
          <div className="hidden sm:flex items-center gap-2 bg-amber-50 border border-amber-200 text-amber-900 text-xs font-extrabold px-3 py-1.5 rounded-full">
            <Store className="w-3.5 h-3.5 text-amber-600" />
            <span>{user?.kitchen_profile?.vendor_name || 'Campus Kitchen Stand'}</span>
          </div>
        )}

        {role === 'admin' && (
          <div className="hidden sm:flex items-center gap-2 bg-slate-900 text-white text-xs font-extrabold px-3.5 py-1.5 rounded-full shadow-xs">
            <Shield className="w-3.5 h-3.5 text-red-400" />
            <span>Campus Control Console</span>
          </div>
        )}

        {/* Right Side Actions */}
        <div className="flex items-center gap-3">
          
          {/* Customer Location & Cart */}
          {role === 'customer' && (
            <>
              <motion.div
                whileHover={{ y: -1, scale: 1.01 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setActiveView('orders')}
                className="hidden lg:flex items-center gap-2 bg-rose-50/80 border border-rose-100 rounded-full px-3.5 py-1.5 text-xs font-semibold text-slate-700 cursor-pointer hover:bg-rose-100/60 transition-colors shadow-2xs"
              >
                <MapPin className="w-3.5 h-3.5 text-[#D6001C]" />
                <span className="text-slate-900 font-bold truncate max-w-[140px]">
                  {user?.address || 'Mountain Top Univ'}
                </span>
              </motion.div>

              {/* Cart Drawer Button */}
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.92 }}
                onClick={() => setCartOpen(true)}
                className="relative p-2.5 bg-rose-50 text-[#D6001C] hover:bg-rose-100 rounded-2xl transition-colors cursor-pointer border border-rose-100 shadow-2xs"
                title="Open Cart"
              >
                <ShoppingBag className="w-5 h-5" />
                {totalCartItems > 0 && (
                  <motion.span
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 20 }}
                    className="absolute -top-1 -right-1 bg-[#D6001C] text-white text-[11px] font-black w-5 h-5 rounded-full flex items-center justify-center border-2 border-white shadow-xs"
                  >
                    {totalCartItems}
                  </motion.span>
                )}
              </motion.button>
            </>
          )}

          {/* User Profile Avatar with Direct Logout Menu */}
          <div className="relative">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setShowProfileMenu(!showProfileMenu)}
              className="flex items-center gap-2 p-1 rounded-full bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer border border-slate-200"
            >
              <div className="w-8 h-8 rounded-full overflow-hidden border border-rose-200 shadow-2xs">
                <img
                  src={user?.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(user?.email || 'user')}`}
                  alt={user?.name || 'User'}
                  className="w-full h-full object-cover"
                />
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-slate-600 mr-1" />
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
                    className="absolute right-0 mt-2 w-64 bg-white rounded-3xl shadow-xl border border-rose-100 p-4 z-50 space-y-3"
                  >
                    <div className="border-b border-slate-100 pb-3">
                      <p className="text-xs font-black text-slate-900 truncate">{user?.name || 'BUKKIT User'}</p>
                      <p className="text-[11px] text-slate-400 font-medium truncate">{user?.email}</p>
                      <div className="mt-1.5 flex items-center justify-between">
                        <span className="inline-block bg-[#D6001C]/10 text-[#D6001C] text-[10px] font-black px-2 py-0.5 rounded-full uppercase">
                          Account: {role.toUpperCase()}
                        </span>
                        {role === 'customer' && (
                          <span className="text-[11px] font-extrabold text-emerald-600">
                            ₦{(user?.wallet_balance ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </span>
                        )}
                      </div>
                    </div>

                    {role === 'customer' && (
                      <div className="space-y-1">
                        <button
                          onClick={() => {
                            setActiveView('profile');
                            setShowProfileMenu(false);
                          }}
                          className="w-full text-left px-3 py-2 rounded-xl text-xs font-bold text-slate-700 hover:bg-rose-50 hover:text-[#D6001C] transition-colors flex items-center gap-2 cursor-pointer"
                        >
                          <User className="w-3.5 h-3.5" />
                          <span>My Account & Notifications</span>
                        </button>
                        <button
                          onClick={() => {
                            setActiveView('orders');
                            setShowProfileMenu(false);
                          }}
                          className="w-full text-left px-3 py-2 rounded-xl text-xs font-bold text-slate-700 hover:bg-rose-50 hover:text-[#D6001C] transition-colors flex items-center gap-2 cursor-pointer"
                        >
                          <Clock className="w-3.5 h-3.5" />
                          <span>Track Active Orders</span>
                        </button>
                      </div>
                    )}

                    <div className="pt-2 border-t border-slate-100">
                      <button
                        onClick={() => {
                          setShowProfileMenu(false);
                          logout();
                        }}
                        className="w-full text-left px-3 py-2.5 rounded-2xl text-xs font-black text-red-600 hover:bg-red-50 transition-colors flex items-center gap-2 cursor-pointer"
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

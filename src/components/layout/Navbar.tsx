import React from 'react';
import { motion } from 'motion/react';
import { ShoppingBag, MapPin, User, Shield, Bike, UtensilsCrossed, Store, Clock, Wallet } from 'lucide-react';
import { useAuthStore } from '../../stores/useAuthStore';
import { useCartStore } from '../../stores/useCartStore';

interface NavbarProps {
  onOpenCart: () => void;
  onOpenAuth: () => void;
  activeView: string;
  setActiveView: (view: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({ onOpenCart, onOpenAuth, activeView, setActiveView }) => {
  const { user, role, setRole } = useAuthStore();
  const { items, setCartOpen } = useCartStore();
  const totalCartItems = items.reduce((sum, item) => sum + item.quantity, 0);

  const isGuest = !user?.uid || user.uid.startsWith('guest_');

  return (
    <header className="sticky top-0 z-40 bg-white/85 backdrop-blur-md border-b border-rose-100/80 shadow-2xs transition-all">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        
        {/* Brand Logo */}
        <motion.div
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.97 }}
          onClick={() => setActiveView('home')}
          className="flex items-center gap-2 cursor-pointer group"
        >
          <div className="w-10 h-10 rounded-2xl bg-[#D6001C] flex items-center justify-center text-white font-extrabold text-xl shadow-md shadow-red-500/20 group-hover:rotate-3 transition-transform">
            B
          </div>
          <div>
            <span className="text-lg font-black text-slate-900 tracking-tight block leading-none">
              BUKKIT
            </span>
            <span className="text-[10px] font-bold text-[#D6001C] tracking-widest uppercase block mt-0.5">
              Campus Marketplace
            </span>
          </div>
        </motion.div>

        {/* Desktop Navigation Links (Visible on Tablet & Desktop) */}
        <nav className="hidden md:flex items-center gap-1 lg:gap-2">
          {[
            { id: 'home', label: 'Home', icon: UtensilsCrossed },
            { id: 'menu', label: 'Menu', icon: UtensilsCrossed },
            { id: 'vendors', label: 'Vendors', icon: Store },
            { id: 'wallet', label: 'Wallet', icon: Wallet },
            { id: 'orders', label: 'Orders', icon: Clock },
          ].map((navItem) => {
            const isActive = activeView === navItem.id || (navItem.id === 'home' && activeView === 'home');
            return (
              <button
                key={navItem.id}
                id={`nav-link-${navItem.id}`}
                onClick={() => setActiveView(navItem.id)}
                className={`relative px-3.5 lg:px-4 py-2 rounded-full text-xs lg:text-sm font-extrabold transition-all cursor-pointer flex items-center gap-1.5 ${
                  isActive
                    ? 'text-white'
                    : 'text-slate-600 hover:text-slate-950 hover:bg-rose-50/70'
                }`}
              >
                {isActive && (
                  <motion.span
                    layoutId="navbarActiveIndicator"
                    transition={{ type: 'spring', stiffness: 450, damping: 30 }}
                    className="absolute inset-0 bg-slate-950 rounded-full shadow-sm"
                  />
                )}
                <span className="relative z-10">{navItem.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Address Selector (Desktop) */}
        <motion.div
          whileHover={{ y: -1, scale: 1.01 }}
          whileTap={{ scale: 0.98 }}
          className="hidden lg:flex items-center gap-2 bg-rose-50/80 border border-rose-100 rounded-full px-3.5 py-1.5 text-xs font-semibold text-slate-700 cursor-pointer hover:bg-rose-100/60 transition-colors shadow-2xs"
        >
          <MapPin className="w-3.5 h-3.5 text-[#D6001C]" />
          <span className="text-slate-900 font-bold truncate max-w-[150px]">
            {user?.address || 'Mountain Top Univ'}
          </span>
        </motion.div>

        {/* Actions & Role Controls */}
        <div className="flex items-center gap-3">
          
          {/* Admin Role Switcher (Visible ONLY to Admin accounts) */}
          {user?.role === 'admin' && (
            <div className="bg-slate-100/90 p-1 rounded-full flex items-center gap-1 text-xs font-semibold border border-slate-200/50">
              {[
                { id: 'customer', label: 'Store View', icon: UtensilsCrossed, targetView: 'home' },
                { id: 'rider', label: 'Rider View', icon: Bike, targetView: 'rider' },
                { id: 'admin', label: 'Admin Portal', icon: Shield, targetView: 'admin' },
              ].map((r) => {
                const Icon = r.icon;
                const isActive = role === r.id;
                return (
                  <button
                    key={r.id}
                    onClick={() => {
                      setRole(r.id as any);
                      setActiveView(r.targetView);
                    }}
                    className={`relative px-3 py-1.5 rounded-full flex items-center gap-1.5 text-xs font-extrabold transition-colors cursor-pointer ${
                      isActive ? 'text-white' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {isActive && (
                      <motion.span
                        layoutId="roleActivePill"
                        transition={{ type: 'spring', stiffness: 450, damping: 28 }}
                        className="absolute inset-0 bg-[#D6001C] rounded-full shadow-xs"
                      />
                    )}
                    <span className="relative z-10 flex items-center gap-1.5">
                      <Icon className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">{r.label}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Cart Icon */}
          {role === 'customer' && (
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.92 }}
              onClick={() => setCartOpen(true)}
              className="relative p-2.5 bg-rose-50 text-[#D6001C] hover:bg-rose-100 rounded-2xl transition-colors cursor-pointer border border-rose-100 shadow-2xs"
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
          )}

          {/* User Profile / Auth Button */}
          {isGuest ? (
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.95 }}
              onClick={onOpenAuth}
              className="bg-[#D6001C] hover:bg-red-700 text-white font-extrabold text-xs px-3.5 py-2 rounded-full shadow-xs transition-all cursor-pointer flex items-center gap-1.5"
            >
              <User className="w-3.5 h-3.5" />
              <span>Log In</span>
            </motion.button>
          ) : (
            <motion.div
              whileHover={{ scale: 1.08 }}
              whileTap={{ scale: 0.92 }}
              onClick={() => setActiveView('profile')}
              className="w-9 h-9 rounded-full overflow-hidden border-2 border-rose-200 cursor-pointer hover:border-[#D6001C] transition-colors shadow-xs"
            >
              <img
                src={user?.avatar_url || 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&auto=format&fit=crop'}
                alt={user?.name}
                className="w-full h-full object-cover"
              />
            </motion.div>
          )}
        </div>

      </div>
    </header>
  );
};


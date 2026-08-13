import React from 'react';
import { motion } from 'motion/react';
import { Home, Heart, ShoppingBag, User, Clock } from 'lucide-react';
import { useCartStore } from '../../stores/useCartStore';

interface BottomNavProps {
  activeView: string;
  setActiveView: (view: string) => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({ activeView, setActiveView }) => {
  const { items, setCartOpen } = useCartStore();
  const totalCartItems = items.reduce((sum, item) => sum + item.quantity, 0);

  const navItems = [
    { id: 'home', label: 'Home', icon: Home },
    { id: 'favorites', label: 'Favorites', icon: Heart },
    { id: 'cart', label: 'Cart', icon: ShoppingBag, badge: totalCartItems },
    { id: 'orders', label: 'Orders', icon: Clock },
    { id: 'profile', label: 'Profile', icon: User }
  ];

  return (
    <div className="fixed bottom-4 left-0 right-0 z-40 px-6 sm:hidden pointer-events-none">
      <div className="max-w-md mx-auto bg-[#D6001C]/95 backdrop-blur-md rounded-full shadow-2xl shadow-red-950/40 p-2 flex items-center justify-around pointer-events-auto border border-red-500/30">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeView === item.id;

          return (
            <motion.button
              key={item.id}
              whileTap={{ scale: 0.88 }}
              onClick={() => {
                if (item.id === 'cart') {
                  setCartOpen(true);
                } else {
                  setActiveView(item.id);
                }
              }}
              className={`relative flex flex-col items-center justify-center p-2.5 rounded-full transition-colors ${
                isActive ? 'text-white' : 'text-red-200/80 hover:text-white'
              }`}
            >
              <Icon className="w-5 h-5 stroke-[2.2]" />

              {/* Active Gliding Pill/Dot with layoutId */}
              {isActive && (
                <motion.span
                  layoutId="bottomNavActiveDot"
                  transition={{ type: 'spring', stiffness: 450, damping: 30 }}
                  className="w-1.5 h-1.5 bg-white rounded-full mt-1 shadow-xs"
                />
              )}

              {/* Badge for Cart */}
              {item.badge !== undefined && item.badge > 0 && (
                <motion.span
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="absolute -top-1 -right-1 bg-white text-[#D6001C] font-black text-[10px] w-4 h-4 rounded-full flex items-center justify-center shadow-xs"
                >
                  {item.badge}
                </motion.span>
              )}
            </motion.button>
          );
        })}
      </div>
    </div>
  );
};


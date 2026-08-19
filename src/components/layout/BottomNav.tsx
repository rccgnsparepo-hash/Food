import React from 'react';
import { motion } from 'motion/react';
import { Home, UtensilsCrossed, Store, Wallet, Clock } from 'lucide-react';
import { useAuthStore } from '../../stores/useAuthStore';

interface BottomNavProps {
  activeView: string;
  setActiveView: (view: string) => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({ activeView, setActiveView }) => {
  const { role } = useAuthStore();

  if (role !== 'customer') {
    return null;
  }

  const navItems = [
    { id: 'home', label: 'Home', icon: Home },
    { id: 'menu', label: 'Menu', icon: UtensilsCrossed },
    { id: 'vendors', label: 'Vendors', icon: Store },
    { id: 'wallet', label: 'Wallet', icon: Wallet },
    { id: 'orders', label: 'Orders', icon: Clock }
  ];

  return (
    <div className="fixed bottom-3 left-0 right-0 z-40 px-3 sm:hidden pointer-events-none">
      <div className="max-w-sm mx-auto bg-slate-950/95 backdrop-blur-md rounded-2xl shadow-2xl shadow-slate-950/60 py-1.5 px-2 flex items-center justify-around pointer-events-auto border border-slate-800">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeView === item.id || (item.id === 'orders' && activeView === 'tracking');

          return (
            <button
              key={item.id}
              onClick={() => setActiveView(item.id)}
              className={`relative flex flex-col items-center justify-center py-1 px-2.5 rounded-xl transition-all cursor-pointer ${
                isActive ? 'text-white font-black' : 'text-slate-400 hover:text-slate-200 font-medium'
              }`}
            >
              <div className="relative">
                <Icon className={`w-5 h-5 transition-transform ${isActive ? 'text-[#D6001C] scale-110' : ''}`} />
              </div>
              <span className={`text-[10px] mt-0.5 tracking-tight ${isActive ? 'text-white font-extrabold' : 'text-slate-400'}`}>
                {item.label}
              </span>
              {isActive && (
                <motion.span
                  layoutId="bottomNavActiveDot"
                  transition={{ type: 'spring', stiffness: 450, damping: 30 }}
                  className="w-1.5 h-1.5 bg-[#D6001C] rounded-full mt-0.5"
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};

import React from 'react';
import { motion } from 'motion/react';
import { Wallet, Tag, Gift, Plus, ArrowUpRight, ArrowDownLeft, ShieldCheck, Sparkles } from 'lucide-react';
import { useAuthStore } from '../../stores/useAuthStore';
import { pageVariants, staggerContainer, staggerItem } from '../../utils/motion';

export const WalletDealsView: React.FC = () => {
  const { user } = useAuthStore();

  const deals = [
    {
      id: 'deal-1',
      code: 'MTUFIRST10',
      title: '10% Off First Campus Order',
      description: 'Valid across all Mountain Top University cafeterias and stands.',
      discount: '10% OFF',
      expires: 'Valid until 31 Dec 2026',
    },
    {
      id: 'deal-2',
      code: 'FREEZOBO',
      title: 'Free Chilled Zobo with Jollof Combos',
      description: 'Order any Jollof or Fried Rice platter and get a free 50cl organic zobo.',
      discount: 'FREE ITEM',
      expires: 'Daily Special',
    },
    {
      id: 'deal-3',
      code: 'NIGHTBITE',
      title: '₦300 Off Late Night Shawarma & Grills',
      description: 'Valid between 8:00 PM and 10:30 PM on orders over ₦2,000.',
      discount: '₦300 OFF',
      expires: 'Valid Mon - Sat',
    },
  ];

  return (
    <motion.div
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      className="space-y-8 pb-24 max-w-5xl mx-auto"
    >
      {/* Wallet Card */}
      <div className="bg-gradient-to-br from-slate-950 via-slate-900 to-rose-950 text-white rounded-3xl p-6 sm:p-8 relative overflow-hidden shadow-2xl border border-rose-900/30">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-[11px] font-extrabold text-rose-300 border border-white/10 uppercase tracking-wider">
              <Wallet className="w-3.5 h-3.5 text-[#D6001C]" />
              <span>Campus Digital Wallet</span>
            </div>
            <p className="text-xs text-slate-300 font-medium">Available Balance</p>
            <h2 className="text-3xl sm:text-5xl font-black text-white tracking-tight">
              ₦8,500<span className="text-xl sm:text-2xl text-rose-400">.00</span>
            </h2>
            <div className="flex items-center gap-2 text-xs text-emerald-400 font-semibold pt-1">
              <ShieldCheck className="w-4 h-4" />
              <span>Secured by Campus Pay • Mountain Top Univ</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="px-6 py-3.5 bg-[#D6001C] hover:bg-red-700 text-white font-extrabold rounded-2xl text-xs flex items-center gap-2 shadow-lg shadow-red-600/30 cursor-pointer transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Top Up Wallet</span>
            </motion.button>
          </div>
        </div>
      </div>

      {/* Deals & Promo Vouchers */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
            <Tag className="w-4 h-4 text-[#D6001C]" />
            <span>Active Student Promos & Vouchers</span>
          </h3>
        </div>

        <motion.div
          variants={staggerContainer}
          initial="hidden"
          animate="show"
          className="grid grid-cols-1 md:grid-cols-3 gap-4"
        >
          {deals.map((deal) => (
            <motion.div
              key={deal.id}
              variants={staggerItem}
              className="bg-white border border-rose-100 rounded-3xl p-5 shadow-xs flex flex-col justify-between space-y-4 relative overflow-hidden"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="bg-rose-50 text-[#D6001C] text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider border border-rose-200">
                    {deal.discount}
                  </span>
                  <span className="text-[10px] font-bold text-slate-400">{deal.expires}</span>
                </div>
                <h4 className="font-extrabold text-slate-900 text-sm">{deal.title}</h4>
                <p className="text-xs text-slate-500 font-medium leading-relaxed">
                  {deal.description}
                </p>
              </div>

              <div className="pt-3 border-t border-rose-50 flex items-center justify-between">
                <code className="bg-slate-100 text-slate-800 font-mono text-xs font-bold px-3 py-1 rounded-lg">
                  {deal.code}
                </code>
                <span className="text-[11px] font-bold text-[#D6001C]">Auto-applied at checkout</span>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </motion.div>
  );
};

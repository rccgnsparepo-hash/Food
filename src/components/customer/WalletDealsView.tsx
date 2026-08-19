import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Wallet,
  Tag,
  Gift,
  Plus,
  ArrowUpRight,
  ArrowDownLeft,
  ShieldCheck,
  Sparkles,
  CreditCard,
  CheckCircle2,
  X,
  Clock,
  Copy,
  Check,
  AlertCircle
} from 'lucide-react';
import { useAuthStore } from '../../stores/useAuthStore';
import { pageVariants, staggerContainer, staggerItem } from '../../utils/motion';
import { triggerHaptic } from '../../utils/haptics';
import { db } from '../../lib/firebase';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { WalletTransaction } from '../../types';

export const WalletDealsView: React.FC = () => {
  const { user, topUpWallet } = useAuthStore();
  const [showTopUpModal, setShowTopUpModal] = useState(false);
  const [topUpAmount, setTopUpAmount] = useState<number>(2000);
  const [customAmount, setCustomAmount] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const balance = user?.wallet_balance ?? 0.0;

  // Real-time live transactions listener
  useEffect(() => {
    if (!user?.uid) return;

    try {
      const q = query(
        collection(db, 'wallet_transactions'),
        where('user_id', '==', user.uid)
      );

      const unsub = onSnapshot(q, (snapshot) => {
        const txs: WalletTransaction[] = [];
        snapshot.forEach((doc) => {
          txs.push({ id: doc.id, ...doc.data() } as WalletTransaction);
        });
        txs.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        setTransactions(txs);
      }, (err) => {
        console.warn('Offline wallet transactions listener:', err);
      });

      return () => unsub();
    } catch (e) {
      console.warn('Could not initialize transactions subscription:', e);
    }
  }, [user?.uid]);

  const handleTopUp = async () => {
    const amount = customAmount ? parseFloat(customAmount) : topUpAmount;
    if (isNaN(amount) || amount <= 0) return;

    setIsProcessing(true);
    triggerHaptic(50);

    try {
      await topUpWallet(amount, `PAYSTACK_${Date.now()}`);
      setSuccessMessage(`₦${amount.toLocaleString()} has been credited to your Campus Wallet.`);
      setShowTopUpModal(false);
      setCustomAmount('');
      setTimeout(() => setSuccessMessage(null), 5000);
    } catch (e) {
      console.error('Failed to top up wallet:', e);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCopyCode = (code: string) => {
    triggerHaptic(20);
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2500);
  };

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
      {/* Toast Notification */}
      <AnimatePresence>
        {successMessage && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center gap-3 text-emerald-800 text-xs font-bold shadow-sm"
          >
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Real-time Authoritative Wallet Card */}
      <div className="bg-gradient-to-br from-slate-950 via-slate-900 to-rose-950 text-white rounded-3xl p-6 sm:p-8 relative overflow-hidden shadow-2xl border border-rose-900/30">
        <div className="absolute top-0 right-0 w-96 h-96 bg-[#D6001C]/15 rounded-full blur-3xl pointer-events-none" />
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-[11px] font-extrabold text-rose-300 border border-white/10 uppercase tracking-wider">
              <Wallet className="w-3.5 h-3.5 text-[#D6001C]" />
              <span>Campus Digital Wallet</span>
            </div>
            <p className="text-xs text-slate-300 font-medium">Real-Time Available Balance</p>
            <h2 className="text-3xl sm:text-5xl font-black text-white tracking-tight flex items-baseline gap-1">
              <span>₦{balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </h2>
            <div className="flex items-center gap-2 text-xs text-emerald-400 font-semibold pt-1">
              <ShieldCheck className="w-4 h-4" />
              <span>Real-Time Authoritative Balance • Mountain Top University</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => {
                triggerHaptic(20);
                setShowTopUpModal(true);
              }}
              className="px-6 py-3.5 bg-[#D6001C] hover:bg-red-700 text-white font-extrabold rounded-2xl text-xs flex items-center gap-2 shadow-lg shadow-red-600/30 cursor-pointer transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Top Up Wallet</span>
            </motion.button>
          </div>
        </div>
      </div>

      {/* Real-time Transactions & Activity History */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
            <Clock className="w-4 h-4 text-[#D6001C]" />
            <span>Recent Wallet Transactions</span>
          </h3>
          <span className="text-xs font-bold text-slate-400">
            {transactions.length} recorded
          </span>
        </div>

        {transactions.length > 0 ? (
          <div className="bg-white rounded-3xl border border-rose-100 divide-y divide-rose-50 overflow-hidden shadow-xs">
            {transactions.slice(0, 5).map((tx) => (
              <div key={tx.id} className="p-4 flex items-center justify-between hover:bg-slate-50/60 transition-colors">
                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                    tx.type === 'credit' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-[#D6001C]'
                  }`}>
                    {tx.type === 'credit' ? <ArrowDownLeft className="w-4 h-4" /> : <ArrowUpRight className="w-4 h-4" />}
                  </div>
                  <div>
                    <h4 className="text-xs font-extrabold text-slate-900">{tx.description}</h4>
                    <p className="text-[10px] text-slate-400 font-medium">
                      {new Date(tx.created_at).toLocaleString()} • {tx.reference || 'Wallet Tx'}
                    </p>
                  </div>
                </div>

                <div className="text-right">
                  <p className={`text-xs font-black ${
                    tx.type === 'credit' ? 'text-emerald-600' : 'text-slate-900'
                  }`}>
                    {tx.type === 'credit' ? '+' : '-'}₦{tx.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </p>
                  <span className="text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                    {tx.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-3xl p-6 text-center border border-rose-100 text-slate-400 space-y-1">
            <Wallet className="w-8 h-8 mx-auto text-slate-300 mb-2" />
            <p className="text-xs font-bold text-slate-700">No transactions recorded yet</p>
            <p className="text-[11px]">Top up your wallet or order meals to view instant transaction history.</p>
          </div>
        )}
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
                <button
                  onClick={() => handleCopyCode(deal.code)}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-800 font-mono text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1.5 cursor-pointer transition-colors"
                >
                  <span>{deal.code}</span>
                  {copiedCode === deal.code ? (
                    <Check className="w-3 h-3 text-emerald-600" />
                  ) : (
                    <Copy className="w-3 h-3 text-slate-400" />
                  )}
                </button>
                <span className="text-[11px] font-bold text-[#D6001C]">
                  {copiedCode === deal.code ? 'Copied!' : 'Click to copy'}
                </span>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>

      {/* Top-Up Modal */}
      <AnimatePresence>
        {showTopUpModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-rose-100 space-y-6 relative"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-rose-100 flex items-center justify-center text-[#D6001C]">
                    <CreditCard className="w-4 h-4" />
                  </div>
                  <h3 className="text-base font-extrabold text-slate-900">Fund Campus Wallet</h3>
                </div>
                <button
                  onClick={() => setShowTopUpModal(false)}
                  className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Quick Selection */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700">Select Amount</label>
                <div className="grid grid-cols-3 gap-2">
                  {[1000, 2000, 5000].map((amt) => (
                    <button
                      key={amt}
                      onClick={() => {
                        triggerHaptic(20);
                        setTopUpAmount(amt);
                        setCustomAmount('');
                      }}
                      className={`py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                        topUpAmount === amt && !customAmount
                          ? 'bg-[#D6001C] text-white shadow-md shadow-red-500/20'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      ₦{amt.toLocaleString()}
                    </button>
                  ))}
                </div>
              </div>

              {/* Custom Input */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">Or Enter Custom Amount (₦)</label>
                <input
                  type="number"
                  placeholder="e.g. 3500"
                  value={customAmount}
                  onChange={(e) => {
                    setCustomAmount(e.target.value);
                  }}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-[#D6001C]/20 focus:border-[#D6001C]"
                />
              </div>

              <div className="p-3 bg-rose-50/60 rounded-2xl flex items-start gap-2.5 text-[11px] text-slate-600 font-medium">
                <ShieldCheck className="w-4 h-4 text-[#D6001C] shrink-0 mt-0.5" />
                <span>Instant balance deposit secured by Paystack & Mountain Top University campus payment gateway.</span>
              </div>

              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleTopUp}
                disabled={isProcessing}
                className="w-full py-3.5 bg-[#D6001C] hover:bg-red-700 disabled:opacity-50 text-white font-extrabold rounded-2xl text-xs flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-red-600/30 transition-all"
              >
                {isProcessing ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <span>
                    Pay ₦
                    {(customAmount ? parseFloat(customAmount) || 0 : topUpAmount).toLocaleString()}{' '}
                    & Credit Wallet
                  </span>
                )}
              </motion.button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

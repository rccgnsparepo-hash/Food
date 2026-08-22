import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Clock, TrendingUp, Eye, ArrowRight, FileText, Download, Star, Sparkles } from 'lucide-react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { Order } from '../../types';
import { useAuthStore } from '../../stores/useAuthStore';
import { OrderDetailModal } from './OrderDetailModal';
import { OrderReceiptModal } from './OrderReceiptModal';
import { OrderFeedbackModal } from './OrderFeedbackModal';
import { downloadOrderReceiptPDF } from '../../services/receiptService';
import { triggerHaptic } from '../../utils/haptics';
import { staggerContainer, staggerItem } from '../../utils/motion';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip
} from 'recharts';

interface OrdersHistoryProps {
  onTrackOrder: (orderId: string) => void;
}

interface MonthlySpendPoint {
  month: string;
  spending: number;
  ordersCount: number;
}

export const OrdersHistory: React.FC<OrdersHistoryProps> = ({ onTrackOrder }) => {
  const { user } = useAuthStore();
  const [orders, setOrders] = useState<Order[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [receiptOrder, setReceiptOrder] = useState<Order | null>(null);
  const [feedbackOrder, setFeedbackOrder] = useState<Order | null>(null);

  useEffect(() => {
    if (!user?.uid) return;

    const q = query(collection(db, 'orders'), where('user_id', '==', user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: Order[] = [];
      snapshot.forEach((doc) => {
        list.push({ id: doc.id, ...doc.data() } as Order);
      });
      list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setOrders(list);
    }, (err) => console.error('Orders snapshot error:', err));

    return () => unsubscribe();
  }, [user?.uid]);

  const handleFeedbackSubmitted = (updatedOrder: Order) => {
    setOrders((prev) =>
      prev.map((o) => (o.id === updatedOrder.id ? { ...o, ...updatedOrder } : o))
    );
  };

  // Compute monthly spending analytics across semester (e.g. Sep - Feb / 6 Months)
  const semesterMonths = ['Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb'];
  
  const chartData: MonthlySpendPoint[] = semesterMonths.map((monthName) => {
    const matchingOrders = orders.filter((ord) => {
      if (!ord.created_at) return false;
      const d = new Date(ord.created_at);
      const mName = d.toLocaleString('en-US', { month: 'short' });
      return mName === monthName && ord.status !== 'cancelled';
    });

    const totalSpend = matchingOrders.reduce((sum, o) => sum + (o.total_price || 0), 0);
    return {
      month: monthName,
      spending: totalSpend,
      ordersCount: matchingOrders.length
    };
  });

  const totalSemesterSpend = chartData.reduce((sum, d) => sum + d.spending, 0);
  const avgMonthlySpend = Math.round(totalSemesterSpend / (semesterMonths.length || 1));

  // Custom Recharts Tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const dataPoint = payload[0].payload as MonthlySpendPoint;
      return (
        <div className="bg-slate-900 text-white p-3.5 rounded-2xl shadow-xl text-xs space-y-1 border border-slate-700">
          <p className="font-extrabold text-slate-300 text-[11px] uppercase tracking-wider">{label} Spending</p>
          <p className="text-base font-black text-emerald-400">
            ₦{dataPoint.spending.toLocaleString()}
          </p>
          <p className="text-[10px] text-slate-400">
            {dataPoint.ordersCount} {dataPoint.ordersCount === 1 ? 'order' : 'orders'} placed
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.3 }}
      className="space-y-6 pb-24 max-w-4xl mx-auto"
    >
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-rose-100 dark:border-slate-800 shadow-xs flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-rose-50 dark:bg-rose-950/60 text-[#D6001C] dark:text-rose-400 rounded-2xl">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-black text-slate-900 dark:text-slate-100">Your Orders</h1>
            <p className="text-xs text-slate-400 dark:text-slate-400">Track active deliveries, view spending analytics, and past history</p>
          </div>
        </div>
      </div>

      {/* Semester Monthly Food Spending Analytics Chart */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-rose-100 dark:border-slate-800 shadow-xs space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-4">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 rounded-xl">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-extrabold text-slate-900 dark:text-slate-100 text-base">Semester Monthly Food Spending</h2>
              <p className="text-xs text-slate-400 dark:text-slate-400">Recharts monthly breakdown across the academic term</p>
            </div>
          </div>

          <div className="flex items-center gap-3 text-xs">
            <div className="bg-rose-50 dark:bg-rose-950/50 px-3 py-1.5 rounded-xl border border-rose-100 dark:border-rose-900/60">
              <span className="text-[10px] text-slate-400 block font-bold uppercase">Total Spent</span>
              <span className="font-black text-[#D6001C] dark:text-rose-400">₦{totalSemesterSpend.toLocaleString()}</span>
            </div>
            <div className="bg-slate-50 dark:bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700">
              <span className="text-[10px] text-slate-400 block font-bold uppercase">Monthly Avg</span>
              <span className="font-black text-slate-800 dark:text-slate-200">₦{avgMonthlySpend.toLocaleString()}</span>
            </div>
          </div>
        </div>

        {/* Recharts Line Chart Container */}
        <div className="w-full h-64 pt-2">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" />
              <XAxis
                dataKey="month"
                tickLine={false}
                axisLine={{ stroke: '#475569' }}
                tick={{ fill: '#94A3B8', fontSize: 12, fontWeight: 700 }}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tick={{ fill: '#94A3B8', fontSize: 11 }}
                tickFormatter={(val) => `₦${val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val}`}
              />
              <Tooltip content={<CustomTooltip />} />
              <Line
                type="monotone"
                dataKey="spending"
                name="Food Spend (₦)"
                stroke="#D6001C"
                strokeWidth={3}
                dot={{ r: 6, fill: '#D6001C', strokeWidth: 2, stroke: '#FFFFFF' }}
                activeDot={{ r: 8, fill: '#D6001C', stroke: '#FEE2E2', strokeWidth: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {orders.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-12 text-center border border-rose-100 dark:border-slate-800 space-y-3">
          <Clock className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto" />
          <h3 className="font-bold text-slate-800 dark:text-slate-200 text-base">No Orders Placed Yet</h3>
          <p className="text-xs text-slate-400 dark:text-slate-400">Your food orders will appear here once placed.</p>
        </div>
      ) : (
        <motion.div
          variants={staggerContainer}
          initial="initial"
          animate="animate"
          className="space-y-4"
        >
          {orders.map((ord) => {
            const isActive = !['delivered', 'cancelled'].includes(ord.status);
            return (
              <motion.div
                key={ord.id}
                variants={staggerItem}
                whileHover={{ y: -3, transition: { duration: 0.15 } }}
                onClick={() => {
                  triggerHaptic(30);
                  setSelectedOrder(ord);
                }}
                className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-rose-100 dark:border-slate-800 shadow-xs hover:shadow-md transition-all space-y-4 cursor-pointer group"
              >
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                  <div>
                    <span className="text-xs font-bold text-slate-400 block font-mono">
                      #{ord.id}
                    </span>
                    <h3 className="font-black text-slate-900 dark:text-slate-100 text-base group-hover:text-[#D6001C] dark:group-hover:text-rose-400 transition-colors">
                      {ord.restaurant_name}
                    </h3>
                  </div>
                  <span className={`font-extrabold text-xs px-3 py-1 rounded-full uppercase tracking-wider ${
                    ord.status === 'delivered'
                      ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800'
                      : 'bg-rose-50 dark:bg-rose-950/60 text-[#D6001C] dark:text-rose-400 border border-rose-200 dark:border-rose-800'
                  }`}>
                    {ord.status.replace('_', ' ')}
                  </span>
                </div>

                {/* Items summary */}
                <div className="space-y-1">
                  {ord.items.map((i, idx) => (
                    <div key={idx} className="flex justify-between text-xs font-medium text-slate-700 dark:text-slate-300">
                      <span>{i.quantity}x {i.name}</span>
                      <span>₦{(i.price * i.quantity).toLocaleString()}</span>
                    </div>
                  ))}
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 block uppercase">
                      {ord.payment_status === 'paid' ? 'Total Paid' : 'Amount Due'}
                    </span>
                    <span className="text-base font-black text-[#D6001C] dark:text-rose-400">
                      ₦{ord.total_price.toLocaleString()}
                    </span>
                  </div>

                  <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                    {/* Post-order Rating & Feedback Button for Delivered Orders */}
                    {ord.status === 'delivered' && (
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => {
                          triggerHaptic(30);
                          setFeedbackOrder(ord);
                        }}
                        className={`p-2.5 sm:px-3 rounded-2xl text-xs font-black transition-colors cursor-pointer border flex items-center gap-1.5 ${
                          ord.food_rating
                            ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800 hover:bg-amber-100 dark:hover:bg-amber-900/80'
                            : 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 dark:hover:bg-emerald-900/80'
                        }`}
                        title={ord.food_rating ? 'Update Order Review' : 'Rate & Review Order'}
                      >
                        <Star className={`w-3.5 h-3.5 ${ord.food_rating ? 'text-amber-500 fill-amber-500' : 'text-emerald-600 dark:text-emerald-400'}`} />
                        <span className="hidden sm:inline">
                          {ord.food_rating ? `${ord.food_rating}★ Rated` : 'Rate Order'}
                        </span>
                      </motion.button>
                    )}

                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => {
                        triggerHaptic(30);
                        setReceiptOrder(ord);
                      }}
                      className="p-2.5 bg-rose-50 dark:bg-rose-950/60 hover:bg-rose-100 dark:hover:bg-rose-900/80 text-[#D6001C] dark:text-rose-400 rounded-2xl text-xs font-bold transition-colors cursor-pointer border border-rose-100 dark:border-rose-900/50 flex items-center gap-1.5"
                      title="View Official Receipt"
                    >
                      <FileText className="w-4 h-4" />
                      <span className="hidden sm:inline">Receipt</span>
                    </motion.button>

                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => {
                        triggerHaptic(40);
                        setSelectedOrder(ord);
                      }}
                      className="bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold px-4 py-2.5 rounded-2xl text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Details</span>
                    </motion.button>

                    {isActive && (
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => {
                          triggerHaptic(50);
                          onTrackOrder(ord.id);
                        }}
                        className="bg-[#D6001C] hover:bg-red-700 text-white font-bold px-4 py-2.5 rounded-2xl text-xs flex items-center gap-1.5 shadow-md shadow-red-500/20 cursor-pointer"
                      >
                        <span>Track</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </motion.button>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </motion.div>
      )}

      {/* Order Detail Modal */}
      {selectedOrder && (
        <OrderDetailModal
          order={selectedOrder}
          onClose={() => setSelectedOrder(null)}
          onTrackOrder={onTrackOrder}
        />
      )}

      {/* Authoritative Order Receipt Modal */}
      {receiptOrder && (
        <OrderReceiptModal
          order={receiptOrder}
          customerProfile={user}
          onClose={() => setReceiptOrder(null)}
        />
      )}

      {/* Post-Order Feedback & Rating Modal */}
      {feedbackOrder && (
        <OrderFeedbackModal
          order={feedbackOrder}
          isOpen={Boolean(feedbackOrder)}
          onClose={() => setFeedbackOrder(null)}
          onFeedbackSubmitted={handleFeedbackSubmitted}
        />
      )}
    </motion.div>
  );
};


import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Clock, TrendingUp, Eye, ArrowRight } from 'lucide-react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { Order } from '../../types';
import { useAuthStore } from '../../stores/useAuthStore';
import { OrderDetailModal } from './OrderDetailModal';
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
      <div className="bg-white rounded-3xl p-6 border border-rose-100 shadow-xs flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-rose-50 text-[#D6001C] rounded-2xl">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-black text-slate-900">Your Orders</h1>
            <p className="text-xs text-slate-400">Track active deliveries, view spending analytics, and past history</p>
          </div>
        </div>
      </div>

      {/* Semester Monthly Food Spending Analytics Chart */}
      <div className="bg-white rounded-3xl p-6 border border-rose-100 shadow-xs space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-extrabold text-slate-900 text-base">Semester Monthly Food Spending</h2>
              <p className="text-xs text-slate-400">Recharts monthly breakdown across the academic term</p>
            </div>
          </div>

          <div className="flex items-center gap-3 text-xs">
            <div className="bg-rose-50 px-3 py-1.5 rounded-xl border border-rose-100">
              <span className="text-[10px] text-slate-400 block font-bold uppercase">Total Spent</span>
              <span className="font-black text-[#D6001C]">₦{totalSemesterSpend.toLocaleString()}</span>
            </div>
            <div className="bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">
              <span className="text-[10px] text-slate-400 block font-bold uppercase">Monthly Avg</span>
              <span className="font-black text-slate-800">₦{avgMonthlySpend.toLocaleString()}</span>
            </div>
          </div>
        </div>

        {/* Recharts Line Chart Container */}
        <div className="w-full h-64 pt-2">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
              <XAxis
                dataKey="month"
                tickLine={false}
                axisLine={{ stroke: '#E2E8F0' }}
                tick={{ fill: '#64748B', fontSize: 12, fontWeight: 700 }}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tick={{ fill: '#64748B', fontSize: 11 }}
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
        <div className="bg-white rounded-3xl p-12 text-center border border-rose-100 space-y-3">
          <Clock className="w-12 h-12 text-slate-300 mx-auto" />
          <h3 className="font-bold text-slate-800 text-base">No Orders Placed Yet</h3>
          <p className="text-xs text-slate-400">Your food orders will appear here once placed.</p>
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
                className="bg-white rounded-3xl p-6 border border-rose-100 shadow-xs hover:shadow-md transition-all space-y-4 cursor-pointer group"
              >
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div>
                    <span className="text-xs font-bold text-slate-400 block font-mono">
                      #{ord.id}
                    </span>
                    <h3 className="font-black text-slate-900 text-base group-hover:text-[#D6001C] transition-colors">
                      {ord.restaurant_name}
                    </h3>
                  </div>
                  <span className={`font-extrabold text-xs px-3 py-1 rounded-full uppercase tracking-wider ${
                    ord.status === 'delivered'
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : 'bg-rose-50 text-[#D6001C] border border-rose-200'
                  }`}>
                    {ord.status.replace('_', ' ')}
                  </span>
                </div>

                {/* Items summary */}
                <div className="space-y-1">
                  {ord.items.map((i, idx) => (
                    <div key={idx} className="flex justify-between text-xs font-medium text-slate-700">
                      <span>{i.quantity}x {i.name}</span>
                      <span>₦{(i.price * i.quantity).toLocaleString()}</span>
                    </div>
                  ))}
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 block uppercase">
                      Total Paid
                    </span>
                    <span className="text-base font-black text-[#D6001C]">
                      ₦{ord.total_price.toLocaleString()}
                    </span>
                  </div>

                  <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => {
                        triggerHaptic(40);
                        setSelectedOrder(ord);
                      }}
                      className="bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold px-4 py-2.5 rounded-2xl text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Order Details</span>
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
    </motion.div>
  );
};


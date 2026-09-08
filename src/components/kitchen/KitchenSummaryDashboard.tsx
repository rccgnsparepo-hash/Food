import React, { useState, useMemo } from 'react';
import { motion } from 'motion/react';
import {
  DollarSign,
  TrendingUp,
  ShoppingBag,
  Clock,
  Award,
  Flame,
  CheckCircle2,
  Calendar,
  ChevronRight,
  Filter,
  BarChart3,
  UtensilsCrossed,
  ArrowUpRight,
  Star,
  Users
} from 'lucide-react';
import { Order, MenuItem, Vendor } from '../../types';
import { triggerHaptic } from '../../utils/haptics';

interface KitchenSummaryDashboardProps {
  orders: Order[];
  vendor?: Vendor | null;
  menuItems: MenuItem[];
  onNavigateToOrders?: () => void;
}

export const KitchenSummaryDashboard: React.FC<KitchenSummaryDashboardProps> = ({
  orders,
  vendor,
  menuItems,
  onNavigateToOrders
}) => {
  const [timeRange, setTimeRange] = useState<'today' | 'week' | 'all'>('today');

  // Compute metrics based on selected time range
  const {
    filteredOrders,
    totalRevenue,
    dailyRevenue,
    todayOrderCount,
    averageOrderValue,
    completedCount,
    preparingCount,
    cancelledCount,
    popularItems,
    peakHoursData,
    averageRating
  } = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Orders strictly from today
    const todayOrders = orders.filter((ord) => {
      const d = new Date(ord.created_at);
      return d >= startOfToday && ord.status !== 'cancelled' && ord.status !== 'refunded';
    });

    const dRevenue = todayOrders.reduce((sum, ord) => sum + (Number(ord.total_price) || 0), 0);

    // Filter by selected range
    const rangeOrders = orders.filter((ord) => {
      if (ord.status === 'cancelled' || ord.status === 'refunded') return false;
      const d = new Date(ord.created_at);
      if (timeRange === 'today') return d >= startOfToday;
      if (timeRange === 'week') return d >= sevenDaysAgo;
      return true;
    });

    const rev = rangeOrders.reduce((sum, ord) => sum + (Number(ord.total_price) || 0), 0);
    const aov = rangeOrders.length > 0 ? Math.round(rev / rangeOrders.length) : 0;

    // Status counts for selected range
    const completed = rangeOrders.filter((o) => o.status === 'delivered').length;
    const preparing = rangeOrders.filter((o) =>
      ['preparing', 'ready', 'accepted', 'payment_confirmed', 'assigned'].includes(o.status)
    ).length;
    const cancelled = orders.filter((o) => {
      const d = new Date(o.created_at);
      const inRange =
        timeRange === 'today' ? d >= startOfToday : timeRange === 'week' ? d >= sevenDaysAgo : true;
      return inRange && (o.status === 'cancelled' || o.status === 'refunded');
    }).length;

    // Popular Items Aggregation
    const itemMap = new Map<string, { id: string; name: string; quantity: number; revenue: number }>();

    rangeOrders.forEach((ord) => {
      if (Array.isArray(ord.items)) {
        ord.items.forEach((it) => {
          const key = it.name.trim().toLowerCase();
          const existing = itemMap.get(key) || {
            id: it.id || key,
            name: it.name,
            quantity: 0,
            revenue: 0
          };
          existing.quantity += Number(it.quantity) || 1;
          existing.revenue += (Number(it.price) || 0) * (Number(it.quantity) || 1);
          itemMap.set(key, existing);
        });
      }
    });

    const popular = Array.from(itemMap.values()).sort((a, b) => b.quantity - a.quantity);

    // Peak Hours Breakdown (0-23 hours)
    const hourBuckets: Record<string, number> = {
      'Morning (7-11 AM)': 0,
      'Lunch Rush (11 AM-2 PM)': 0,
      'Afternoon (2-6 PM)': 0,
      'Dinner Rush (6-10 PM)': 0
    };

    rangeOrders.forEach((ord) => {
      const h = new Date(ord.created_at).getHours();
      if (h >= 7 && h < 11) hourBuckets['Morning (7-11 AM)']++;
      else if (h >= 11 && h < 14) hourBuckets['Lunch Rush (11 AM-2 PM)']++;
      else if (h >= 14 && h < 18) hourBuckets['Afternoon (2-6 PM)']++;
      else if (h >= 18 && h <= 22) hourBuckets['Dinner Rush (6-10 PM)']++;
    });

    // Rating calculation
    const ratedOrders = rangeOrders.filter((o) => o.food_rating && o.food_rating > 0);
    const avgRating =
      ratedOrders.length > 0
        ? (ratedOrders.reduce((acc, o) => acc + (o.food_rating || 5), 0) / ratedOrders.length).toFixed(1)
        : vendor?.rating?.toFixed(1) || '4.9';

    return {
      filteredOrders: rangeOrders,
      totalRevenue: rev,
      dailyRevenue: dRevenue,
      todayOrderCount: todayOrders.length,
      averageOrderValue: aov,
      completedCount: completed,
      preparingCount: preparing,
      cancelledCount: cancelled,
      popularItems: popular,
      peakHoursData: hourBuckets,
      averageRating: avgRating
    };
  }, [orders, timeRange, vendor?.rating]);

  const maxItemQty = popularItems[0]?.quantity || 1;

  return (
    <div className="space-y-6">
      {/* 1. TOP HEADER & RANGE SELECTOR */}
      <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
              Live Real-Time Kitchen Metrics
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white mt-1">
            Kitchen Performance Summary
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {vendor?.name || 'Campus Kitchen'} • Synced with live Firestore orders
          </p>
        </div>

        <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 p-1.5 rounded-2xl self-start sm:self-auto">
          {(['today', 'week', 'all'] as const).map((r) => (
            <button
              key={r}
              onClick={() => {
                triggerHaptic(20);
                setTimeRange(r);
              }}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                timeRange === r
                  ? 'bg-[#D6001C] text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {r === 'today' ? "Today's Live" : r === 'week' ? 'Past 7 Days' : 'All Time'}
            </button>
          ))}
        </div>
      </div>

      {/* 2. PRIMARY KPI METRIC CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1: Total Daily Revenue */}
        <div className="bg-linear-to-br from-emerald-50 to-teal-50/40 dark:from-slate-900 dark:to-emerald-950/20 p-5 rounded-3xl border border-emerald-200/80 dark:border-emerald-900/40 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-emerald-800 dark:text-emerald-300 uppercase tracking-wider">
              {timeRange === 'today' ? 'Total Daily Revenue' : 'Total Period Revenue'}
            </span>
            <div className="w-9 h-9 rounded-2xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-emerald-900 dark:text-emerald-100">
            ₦{(timeRange === 'today' ? dailyRevenue : totalRevenue).toLocaleString()}
          </div>
          <p className="text-[11px] text-emerald-700/80 dark:text-emerald-400 mt-2 flex items-center gap-1 font-bold">
            <TrendingUp className="w-3.5 h-3.5" />
            <span>Based on {filteredOrders.length} confirmed orders</span>
          </p>
        </div>

        {/* Metric 2: Today's Orders Volume */}
        <div className="bg-linear-to-br from-rose-50 to-orange-50/40 dark:from-slate-900 dark:to-rose-950/20 p-5 rounded-3xl border border-rose-200/80 dark:border-rose-900/40 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-rose-800 dark:text-rose-300 uppercase tracking-wider">
              Orders Volume
            </span>
            <div className="w-9 h-9 rounded-2xl bg-rose-500/15 text-[#D6001C] dark:text-rose-400 flex items-center justify-center">
              <ShoppingBag className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">
            {filteredOrders.length}
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-2 flex items-center gap-1 font-bold">
            <span className="text-emerald-600 dark:text-emerald-400 font-extrabold">{completedCount} delivered</span>
            <span>•</span>
            <span className="text-amber-600 dark:text-amber-400 font-extrabold">{preparingCount} active</span>
          </p>
        </div>

        {/* Metric 3: Average Order Value */}
        <div className="bg-linear-to-br from-amber-50 to-yellow-50/40 dark:from-slate-900 dark:to-amber-950/20 p-5 rounded-3xl border border-amber-200/80 dark:border-amber-900/40 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-amber-800 dark:text-amber-300 uppercase tracking-wider">
              Avg Order Value (AOV)
            </span>
            <div className="w-9 h-9 rounded-2xl bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <BarChart3 className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">
            ₦{averageOrderValue.toLocaleString()}
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-2 font-bold">
            Student basket size across campus
          </p>
        </div>

        {/* Metric 4: Kitchen Rating & Quality */}
        <div className="bg-linear-to-br from-indigo-50 to-blue-50/40 dark:from-slate-900 dark:to-indigo-950/20 p-5 rounded-3xl border border-indigo-200/80 dark:border-indigo-900/40 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-indigo-800 dark:text-indigo-300 uppercase tracking-wider">
              Kitchen Rating
            </span>
            <div className="w-9 h-9 rounded-2xl bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <Star className="w-5 h-5 fill-amber-400 text-amber-400" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white flex items-center gap-1.5">
            <span>{averageRating}</span>
            <span className="text-xs text-slate-400 font-bold">/ 5.0</span>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-2 font-bold">
            Customer meal & taste feedback
          </p>
        </div>
      </div>

      {/* 3. POPULAR ITEMS SECTION (Crucial user request) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Popular Items Leaderboard */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
                <Flame className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900 dark:text-white">
                  Popular Items & Best Sellers
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Most frequently ordered dishes based on real-time order history
                </p>
              </div>
            </div>

            <span className="text-xs font-bold text-slate-400">
              {popularItems.length} unique dishes sold
            </span>
          </div>

          {popularItems.length === 0 ? (
            <div className="py-12 text-center text-slate-400 space-y-2">
              <UtensilsCrossed className="w-10 h-10 mx-auto opacity-40 text-slate-400" />
              <p className="text-xs font-bold">No orders recorded in this time range.</p>
            </div>
          ) : (
            <div className="space-y-3.5">
              {popularItems.slice(0, 8).map((item, idx) => {
                const percentage = Math.round((item.quantity / maxItemQty) * 100);
                const isTop = idx === 0;

                return (
                  <div
                    key={item.id || idx}
                    className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 space-y-2 transition-all hover:bg-slate-100/80"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2.5">
                        <span
                          className={`w-6 h-6 rounded-xl flex items-center justify-center font-black text-[11px] ${
                            idx === 0
                              ? 'bg-amber-400 text-slate-950 shadow-xs shadow-amber-400/30'
                              : idx === 1
                              ? 'bg-slate-300 text-slate-800'
                              : idx === 2
                              ? 'bg-amber-700 text-amber-100'
                              : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400'
                          }`}
                        >
                          #{idx + 1}
                        </span>
                        <div>
                          <span className="font-extrabold text-slate-900 dark:text-white text-xs block">
                            {item.name}
                          </span>
                          <span className="text-[10px] text-slate-400 font-medium">
                            ₦{item.revenue.toLocaleString()} in sales
                          </span>
                        </div>
                      </div>

                      <div className="text-right">
                        <span className="font-black text-emerald-600 dark:text-emerald-400 text-xs">
                          {item.quantity} {item.quantity === 1 ? 'order' : 'orders'}
                        </span>
                        {isTop && (
                          <span className="block text-[9px] font-black text-amber-500 uppercase tracking-widest">
                            ★ Campus Favorite
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Progress visual bar */}
                    <div className="w-full bg-slate-200 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${percentage}%` }}
                        transition={{ duration: 0.6, delay: idx * 0.05 }}
                        className={`h-full rounded-full ${
                          idx === 0
                            ? 'bg-gradient-to-r from-amber-500 to-red-500'
                            : 'bg-gradient-to-r from-emerald-500 to-teal-500'
                        }`}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* 4. KITCHEN PEAK RUSH HOURS & ORDER VELOCITY */}
        <div className="space-y-6">
          {/* Rush Hour Distribution */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <Clock className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-black text-slate-900 dark:text-white">
                  Peak Rush Distribution
                </h3>
                <p className="text-[11px] text-slate-500">
                  Campus dining traffic patterns
                </p>
              </div>
            </div>

            <div className="space-y-3">
              {Object.entries(peakHoursData).map(([slot, count]) => {
                const countNum = Number(count) || 0;
                const total = filteredOrders.length || 1;
                const pct = Math.round((countNum / total) * 100);
                return (
                  <div key={slot} className="space-y-1">
                    <div className="flex justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
                      <span>{slot}</span>
                      <span className="text-slate-500">{countNum} orders ({pct}%)</span>
                    </div>
                    <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                      <div
                        className="bg-[#D6001C] h-full rounded-full transition-all duration-500"
                        style={{ width: `${Math.max(4, pct)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Quick Action Link to Orders Queue */}
          {onNavigateToOrders && (
            <div className="bg-linear-to-r from-slate-900 to-slate-950 text-white rounded-3xl p-5 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-black text-sm">Active Kitchen Orders Queue</h4>
                <span className="px-2.5 py-0.5 rounded-full bg-amber-500 text-slate-950 font-black text-[10px]">
                  {preparingCount} in prep
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Switch over to update order stages, assign couriers, or print tickets.
              </p>
              <button
                onClick={onNavigateToOrders}
                className="w-full py-2.5 bg-[#D6001C] hover:bg-red-700 text-white rounded-xl text-xs font-black transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-md shadow-red-500/20"
              >
                <span>Manage Live Orders</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

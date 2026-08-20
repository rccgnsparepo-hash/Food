import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import {
  DollarSign,
  TrendingUp,
  Wallet,
  Bike,
  Store,
  ArrowUpRight,
  ArrowDownRight,
  ShieldCheck,
  RefreshCw,
  Clock,
  FileSpreadsheet
} from 'lucide-react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { Order, DeliveryEarning, WalletTransaction } from '../../types';
import { toast } from 'sonner';

export const FinancialsManager: React.FC = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [earnings, setEarnings] = useState<DeliveryEarning[]>([]);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setIsLoading(true);

    const unsubOrders = onSnapshot(collection(db, 'orders'), (snapshot) => {
      const list: Order[] = [];
      snapshot.forEach((d) => list.push(d.data() as Order));
      setOrders(list);
      setIsLoading(false);
    });

    const unsubEarnings = onSnapshot(collection(db, 'rider_earnings'), (snapshot) => {
      const list: DeliveryEarning[] = [];
      snapshot.forEach((d) => list.push(d.data() as DeliveryEarning));
      setEarnings(list);
    });

    const unsubTx = onSnapshot(collection(db, 'wallet_transactions'), (snapshot) => {
      const list: WalletTransaction[] = [];
      snapshot.forEach((d) => list.push(d.data() as WalletTransaction));
      setTransactions(list);
    });

    return () => {
      unsubOrders();
      unsubEarnings();
      unsubTx();
    };
  }, []);

  // Aggregations
  const totalGrossOrderVolume = orders.reduce((sum, o) => sum + (o.payment_status === 'paid' ? o.total_price : 0), 0);
  const totalDeliveryFees = orders.reduce((sum, o) => sum + (o.payment_status === 'paid' ? (o.delivery_fee || 350) : 0), 0);
  const totalRiderPayouts = earnings.reduce((sum, e) => sum + e.rider_earning, 0);
  const totalPlatformCommissions = earnings.reduce((sum, e) => sum + e.platform_commission, 0) || Math.round(totalDeliveryFees * 0.25);
  const totalWalletDeposits = transactions.filter((t) => t.type === 'deposit' || t.type === 'promotional_credit').reduce((sum, t) => sum + t.amount, 0);
  const totalWalletDebited = transactions.filter((t) => t.type === 'order_payment').reduce((sum, t) => sum + Math.abs(t.amount), 0);
  const totalRefunds = transactions.filter((t) => t.type === 'refund').reduce((sum, t) => sum + t.amount, 0);

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-slate-900 text-white rounded-3xl p-6 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-emerald-600 flex items-center justify-center text-white shadow-lg">
            <DollarSign className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-black">Financials, Ledger & Commission Reconciliation</h2>
            <p className="text-xs text-slate-400">
              Live double-entry reconciliation connecting Customer payments, Vendor orders, Rider earnings, and Wallet balances
            </p>
          </div>
        </div>
        <div className="text-right bg-slate-800 px-4 py-2 rounded-2xl border border-slate-700">
          <span className="text-[10px] font-bold text-slate-400 uppercase block">Platform Commission Earned</span>
          <span className="text-base font-black text-emerald-400">₦{totalPlatformCommissions.toLocaleString()}</span>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs">
          <span className="text-xs font-bold text-slate-500 block uppercase">Gross Order Volume</span>
          <p className="text-2xl font-black text-slate-900 mt-1">₦{totalGrossOrderVolume.toLocaleString()}</p>
          <span className="text-[11px] font-bold text-emerald-600">Settled campus meals</span>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs">
          <span className="text-xs font-bold text-slate-500 block uppercase">Total Delivery Fees</span>
          <p className="text-2xl font-black text-slate-900 mt-1">₦{totalDeliveryFees.toLocaleString()}</p>
          <span className="text-[11px] font-bold text-blue-600">Collected from students</span>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs">
          <span className="text-xs font-bold text-slate-500 block uppercase">Rider Payouts (75%)</span>
          <p className="text-2xl font-black text-slate-900 mt-1">₦{totalRiderPayouts.toLocaleString()}</p>
          <span className="text-[11px] font-bold text-emerald-600">Credited to couriers</span>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs">
          <span className="text-xs font-bold text-slate-500 block uppercase">BUKKIT Wallet Float</span>
          <p className="text-2xl font-black text-slate-900 mt-1">₦{(totalWalletDeposits - totalWalletDebited).toLocaleString()}</p>
          <span className="text-[11px] font-bold text-purple-600">Active student balance</span>
        </div>
      </div>

      {/* Commission Structure & Rate Rules */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <h3 className="font-extrabold text-sm text-slate-900">Authoritative Platform Rate Rules</h3>
          <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full">
            Active MTU Campus Policy
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 space-y-1">
            <span className="font-extrabold text-slate-700 block">Courier Delivery Split</span>
            <p className="text-xl font-black text-emerald-700">75% / 25%</p>
            <p className="text-slate-500">75% directly to Rider per completed verified delivery, 25% to BUKKIT operations.</p>
          </div>

          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 space-y-1">
            <span className="font-extrabold text-slate-700 block">Student Campus Delivery Base</span>
            <p className="text-xl font-black text-slate-900">₦350 - ₦450</p>
            <p className="text-slate-500">Standardized across all Mountain Top University hostels and academic faculties.</p>
          </div>

          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 space-y-1">
            <span className="font-extrabold text-slate-700 block">Instant Wallet Top-Up Fee</span>
            <p className="text-xl font-black text-slate-900">0% FREE</p>
            <p className="text-slate-500">No deposit surcharge for students topping up via Paystack card or bank transfer.</p>
          </div>
        </div>
      </div>

      {/* Recent Ledger Entries */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-extrabold text-sm text-slate-900">Recent Wallet & Earning Transactions</h3>
          <span className="text-xs text-slate-400 font-medium">Real-time Stream</span>
        </div>

        <div className="divide-y divide-slate-100">
          {transactions.slice(0, 8).map((tx) => (
            <div key={tx.id || tx.transaction_id} className="py-3 flex items-center justify-between text-xs">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-[10px] text-slate-400">
                    {tx.transaction_id || tx.id}
                  </span>
                  <span
                    className={`font-black px-2 py-0.2 rounded-full text-[10px] uppercase ${
                      tx.type === 'order_payment'
                        ? 'bg-amber-100 text-amber-800'
                        : tx.type === 'refund'
                        ? 'bg-purple-100 text-purple-800'
                        : 'bg-emerald-100 text-emerald-800'
                    }`}
                  >
                    {tx.type}
                  </span>
                </div>
                <p className="font-bold text-slate-800">{tx.description}</p>
                {tx.order_id && <p className="text-[10px] text-slate-500 font-mono">Linked Order: #{tx.order_id.slice(-6)}</p>}
              </div>

              <div className="text-right">
                <span
                  className={`font-black text-sm block ${
                    tx.amount < 0 ? 'text-slate-900' : 'text-emerald-600'
                  }`}
                >
                  {tx.amount < 0 ? `-₦${Math.abs(tx.amount).toLocaleString()}` : `+₦${tx.amount.toLocaleString()}`}
                </span>
                <span className="text-[10px] text-slate-400 font-mono">
                  {new Date(tx.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

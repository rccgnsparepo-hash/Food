import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
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
  FileSpreadsheet,
  Calendar,
  Filter,
  Plus,
  Server,
  Receipt,
  Download,
  AlertTriangle,
  CheckCircle,
  HelpCircle,
  CreditCard,
  Building,
  Scale
} from 'lucide-react';
import { apiFetchJson } from '../../lib/apiConfig';
import {
  FinancialMetrics,
  DailyFinancialItem,
  MonthlyFinancialItem,
  FinancialLedgerEntry,
  BusinessExpense
} from '../../types';
import { toast } from 'sonner';

type DateFilterType = 'today' | 'yesterday' | '7days' | '30days' | 'this_month' | 'last_month' | 'all';

export const FinancialsManager: React.FC = () => {
  const [selectedFilter, setSelectedFilter] = useState<DateFilterType>('30days');
  const [activeTab, setActiveTab] = useState<'overview' | 'daily' | 'monthly' | 'ledger' | 'expenses' | 'settlements'>('overview');
  const [ledgerFilter, setLedgerFilter] = useState<string>('all');
  const [isLoading, setIsLoading] = useState(true);

  // Financial State
  const [metrics, setMetrics] = useState<FinancialMetrics>({
    totalOrders: 0,
    totalCustomerGMV: 0,
    totalRestaurantPayable: 0,
    totalRiderPayable: 0,
    totalBukkitGrossRevenue: 0,
    totalPaystackFees: 0,
    totalBukkitNetTransactionRevenue: 0,
    totalOperatingExpenses: 0,
    totalRefunds: 0,
    totalPayouts: 0,
    netProfit: 0,
    averageOrderValue: 0,
    platformRevenuePerOrder: 0,
    paymentProcessingCostPerOrder: 0
  });

  const [dailyData, setDailyData] = useState<DailyFinancialItem[]>([]);
  const [monthlyData, setMonthlyData] = useState<MonthlyFinancialItem[]>([]);
  const [recentLedger, setRecentLedger] = useState<FinancialLedgerEntry[]>([]);
  const [restaurantBalances, setRestaurantBalances] = useState<any[]>([]);
  const [riderBalances, setRiderBalances] = useState<any[]>([]);
  const [gatewayConfig, setGatewayConfig] = useState<any>({
    configured: false,
    mode: 'unconfigured',
    hasPublicKey: false,
    hasSecretKey: false
  });

  // New Expense Modal State
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [newExpenseCategory, setNewExpenseCategory] = useState<string>('servers');
  const [newExpenseAmount, setNewExpenseAmount] = useState<string>('');
  const [newExpenseDesc, setNewExpenseDesc] = useState<string>('');
  const [isSubmittingExpense, setIsSubmittingExpense] = useState(false);

  const fetchFinancials = async () => {
    setIsLoading(true);
    try {
      // Calculate date range based on filter
      let startDate: string | undefined;
      let endDate: string | undefined;
      const now = new Date();

      if (selectedFilter === 'today') {
        const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        startDate = start.toISOString();
      } else if (selectedFilter === 'yesterday') {
        const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
        const end = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        startDate = start.toISOString();
        endDate = end.toISOString();
      } else if (selectedFilter === '7days') {
        const start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        startDate = start.toISOString();
      } else if (selectedFilter === '30days') {
        const start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        startDate = start.toISOString();
      } else if (selectedFilter === 'this_month') {
        const start = new Date(now.getFullYear(), now.getMonth(), 1);
        startDate = start.toISOString();
      } else if (selectedFilter === 'last_month') {
        const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const end = new Date(now.getFullYear(), now.getMonth(), 1);
        startDate = start.toISOString();
        endDate = end.toISOString();
      }

      const params = new URLSearchParams();
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);

      const [finRes, dailyRes, monthlyRes] = await Promise.all([
        apiFetchJson<any>(`/api/admin/financials?${params.toString()}`),
        apiFetchJson<any>('/api/admin/financials/daily?days=30'),
        apiFetchJson<any>('/api/admin/financials/monthly?months=6')
      ]);

      if (finRes.ok && finRes.data) {
        setMetrics(finRes.data.metrics || {});
        setGatewayConfig(finRes.data.config || {});
        setRecentLedger(finRes.data.recentLedger || []);
        setRestaurantBalances(finRes.data.restaurantBalances || []);
        setRiderBalances(finRes.data.riderBalances || []);
      }

      if (dailyRes.ok && dailyRes.data?.daily) {
        setDailyData(dailyRes.data.daily);
      }

      if (monthlyRes.ok && monthlyRes.data?.monthly) {
        setMonthlyData(monthlyRes.data.monthly);
      }
    } catch (e: any) {
      console.error('Financials fetch error:', e);
      toast.error('Could not load financial records');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchFinancials();
  }, [selectedFilter]);

  const handleCreateExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newExpenseAmount || !newExpenseDesc.trim()) {
      toast.error('Please enter valid amount and description');
      return;
    }

    setIsSubmittingExpense(true);
    try {
      const res = await apiFetchJson<any>('/api/admin/financials/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category: newExpenseCategory,
          amount: parseFloat(newExpenseAmount),
          description: newExpenseDesc.trim(),
          recorded_by: 'BUKKIT Finance Admin'
        })
      });

      if (res.ok) {
        toast.success('Operating expense logged & posted to ledger');
        setShowExpenseModal(false);
        setNewExpenseAmount('');
        setNewExpenseDesc('');
        fetchFinancials();
      } else {
        throw new Error(res.error || 'Failed to save expense');
      }
    } catch (err: any) {
      toast.error(err.message || 'Error recording expense');
    } finally {
      setIsSubmittingExpense(false);
    }
  };

  const exportDailyCSV = () => {
    const headers = [
      'Date',
      'Paid Orders',
      'Customer GMV (NGN)',
      'BUKKIT Gross Revenue (NGN)',
      'Paystack Fees (NGN)',
      'BUKKIT Net Revenue (NGN)',
      'Restaurant Payable (NGN)',
      'Rider Payable (NGN)',
      'Operating Expenses (NGN)',
      'Net Profit (NGN)'
    ];

    const rows = dailyData.map((d) => [
      d.date,
      d.orders,
      d.gmv,
      d.companyGross,
      d.paystackFees,
      d.companyNet,
      d.restaurantPayable,
      d.riderPayable,
      d.operatingExpenses,
      d.netProfit
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `BUKKIT_Financial_Report_${selectedFilter}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Financial report exported to CSV');
  };

  const filteredLedger = recentLedger.filter((entry) => {
    if (ledgerFilter === 'all') return true;
    return entry.type === ledgerFilter;
  });

  return (
    <div className="space-y-6">
      {/* Top Header & Context Banner */}
      <div className="bg-slate-950 text-white rounded-3xl p-6 shadow-2xl border border-slate-800 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-[#D6001C] flex items-center justify-center text-white shadow-lg shadow-red-600/30 shrink-0">
            <Scale className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-black text-slate-100">Financial Ledger & Accounting Reconciliation</h2>
              <span className="text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                DOUBLE-ENTRY ENGINE
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Authoritative model: Customer Total (₦2,350) = Food Subtotal (₦2,000) + Platform Gross (₦250) + Rider Payable (₦100)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => fetchFinancials()}
            className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
            title="Refresh Ledger"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={() => setShowExpenseModal(true)}
            className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold px-3.5 py-2.5 rounded-xl transition-colors border border-slate-700"
          >
            <Plus className="w-3.5 h-3.5 text-emerald-400" />
            Record Expense
          </button>

          <button
            onClick={exportDailyCSV}
            className="flex items-center gap-1.5 bg-[#D6001C] hover:bg-red-700 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition-all shadow-md shadow-red-600/20"
          >
            <Download className="w-3.5 h-3.5" />
            Export CSV Report
          </button>
        </div>
      </div>

      {/* Paystack Gateway Configuration & Readiness Notice */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className={`rounded-2xl p-4 border flex items-center justify-between ${
          gatewayConfig.configured
            ? 'bg-emerald-50/70 border-emerald-200 text-emerald-950'
            : 'bg-amber-50/80 border-amber-200 text-amber-950'
        }`}>
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
              gatewayConfig.configured ? 'bg-emerald-600 text-white' : 'bg-amber-500 text-white'
            }`}>
              <CreditCard className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider">Paystack Gateway Status</p>
              <p className="text-sm font-black mt-0.5">
                {gatewayConfig.configured
                  ? (gatewayConfig.mode === 'test' ? 'Test Mode Active' : 'Live Production Active')
                  : 'Awaiting Credentials'}
              </p>
            </div>
          </div>
          <span className={`text-[10px] font-mono font-bold px-2 py-1 rounded-lg ${
            gatewayConfig.configured ? 'bg-emerald-200 text-emerald-800' : 'bg-amber-200 text-amber-900'
          }`}>
            {gatewayConfig.configured ? 'CONFIGURED' : 'UNCONFIGURED'}
          </span>
        </div>

        <div className="rounded-2xl p-4 border border-slate-200 bg-white shadow-xs flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center">
              <Receipt className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Avg Transaction Size</p>
              <p className="text-base font-black text-slate-900 mt-0.5">
                ₦{metrics.averageOrderValue.toLocaleString()}
              </p>
            </div>
          </div>
          <span className="text-[11px] font-bold text-slate-500 font-mono">
            {metrics.totalOrders} paid orders
          </span>
        </div>

        <div className="rounded-2xl p-4 border border-slate-200 bg-white shadow-xs flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-600 text-white flex items-center justify-center">
              <Server className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Operating Costs</p>
              <p className="text-base font-black text-purple-900 mt-0.5">
                ₦{metrics.totalOperatingExpenses.toLocaleString()}
              </p>
            </div>
          </div>
          <span className="text-[11px] font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded">
            Servers & Ops
          </span>
        </div>
      </div>

      {/* Date Filter Bar */}
      <div className="flex items-center justify-between gap-2 bg-white p-2.5 rounded-2xl border border-slate-200 shadow-xs overflow-x-auto">
        <div className="flex items-center gap-1.5">
          <Calendar className="w-4 h-4 text-slate-400 ml-2 mr-1" />
          {(
            [
              { id: 'today', label: 'Today' },
              { id: 'yesterday', label: 'Yesterday' },
              { id: '7days', label: 'Last 7 Days' },
              { id: '30days', label: 'Last 30 Days' },
              { id: 'this_month', label: 'This Month' },
              { id: 'last_month', label: 'Last Month' },
              { id: 'all', label: 'All-Time' }
            ] as const
          ).map((filter) => (
            <button
              key={filter.id}
              onClick={() => setSelectedFilter(filter.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                selectedFilter === filter.id
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>

        {/* View Tabs */}
        <div className="flex items-center gap-1 border-l border-slate-200 pl-2">
          {(
            [
              { id: 'overview', label: 'Overview' },
              { id: 'daily', label: 'Daily Breakdown' },
              { id: 'monthly', label: 'Monthly Summary' },
              { id: 'ledger', label: 'Double-Entry Ledger' },
              { id: 'settlements', label: 'Settlements' }
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                activeTab === tab.id
                  ? 'bg-[#D6001C] text-white shadow-xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* TAB 1: EXECUTIVE FINANCIAL OVERVIEW */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Master 8-Box Accounting Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {/* 1. Customer GMV */}
            <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">1. Customer GMV</span>
                <span className="text-[10px] bg-slate-100 text-slate-600 font-bold px-1.5 py-0.5 rounded">Total Paid</span>
              </div>
              <p className="text-2xl font-black text-slate-900 font-mono">
                ₦{metrics.totalCustomerGMV.toLocaleString()}
              </p>
              <p className="text-[11px] text-slate-500">Gross funds transacted through checkout</p>
            </div>

            {/* 2. Restaurant Payable */}
            <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">2. Restaurant Payable</span>
                <span className="text-[10px] bg-amber-50 text-amber-700 font-bold px-1.5 py-0.5 rounded">Not Platform Rev</span>
              </div>
              <p className="text-2xl font-black text-amber-900 font-mono">
                ₦{metrics.totalRestaurantPayable.toLocaleString()}
              </p>
              <p className="text-[11px] text-slate-500">100% food subtotal owed to campus kitchens</p>
            </div>

            {/* 3. Rider Payable */}
            <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">3. Rider Payable</span>
                <span className="text-[10px] bg-blue-50 text-blue-700 font-bold px-1.5 py-0.5 rounded">₦100/Deliv</span>
              </div>
              <p className="text-2xl font-black text-blue-900 font-mono">
                ₦{metrics.totalRiderPayable.toLocaleString()}
              </p>
              <p className="text-[11px] text-slate-500">100% courier delivery earnings</p>
            </div>

            {/* 4. BUKKIT Gross Platform Revenue */}
            <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">4. BUKKIT Gross Rev</span>
                <span className="text-[10px] bg-emerald-50 text-emerald-700 font-bold px-1.5 py-0.5 rounded">₦250/Order</span>
              </div>
              <p className="text-2xl font-black text-emerald-800 font-mono">
                ₦{metrics.totalBukkitGrossRevenue.toLocaleString()}
              </p>
              <p className="text-[11px] text-slate-500">Platform service charge recognized</p>
            </div>

            {/* 5. Paystack Processing Fees */}
            <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">5. Paystack Fees</span>
                <span className="text-[10px] bg-rose-50 text-rose-700 font-bold px-1.5 py-0.5 rounded">1.5% Gateway</span>
              </div>
              <p className="text-2xl font-black text-rose-700 font-mono">
                ₦{metrics.totalPaystackFees.toLocaleString()}
              </p>
              <p className="text-[11px] text-slate-500">Processing fee deducted from gross</p>
            </div>

            {/* 6. BUKKIT Net Platform Revenue */}
            <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">6. Net Transaction Rev</span>
                <span className="text-[10px] bg-emerald-50 text-emerald-700 font-bold px-1.5 py-0.5 rounded">Gross - Fees</span>
              </div>
              <p className="text-2xl font-black text-emerald-900 font-mono">
                ₦{metrics.totalBukkitNetTransactionRevenue.toLocaleString()}
              </p>
              <p className="text-[11px] text-slate-500">Net revenue after Paystack deduction</p>
            </div>

            {/* 7. Operating Expenses */}
            <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">7. Operating Expenses</span>
                <span className="text-[10px] bg-purple-50 text-purple-700 font-bold px-1.5 py-0.5 rounded">Servers/SMS/Ops</span>
              </div>
              <p className="text-2xl font-black text-purple-900 font-mono">
                ₦{metrics.totalOperatingExpenses.toLocaleString()}
              </p>
              <p className="text-[11px] text-slate-500">Hosting, database, and marketing costs</p>
            </div>

            {/* 8. True Net Profit */}
            <div className="bg-slate-900 text-white p-5 rounded-3xl shadow-lg border border-slate-800 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-300 uppercase tracking-wide">8. True Net Profit</span>
                <span className="text-[10px] bg-emerald-500/20 text-emerald-400 font-bold px-1.5 py-0.5 rounded">Final Bottom Line</span>
              </div>
              <p className="text-2xl font-black text-emerald-400 font-mono">
                ₦{metrics.netProfit.toLocaleString()}
              </p>
              <p className="text-[11px] text-slate-400">Net Platform Revenue - Operating Expenses</p>
            </div>
          </div>

          {/* Authoritative Accounting Flow Diagram */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-extrabold text-sm text-slate-900">Authoritative Per-Order Accounting Formula</h3>
                <p className="text-xs text-slate-500">Every paid order strictly executes the following ledger allocations:</p>
              </div>
              <span className="text-xs font-bold text-emerald-800 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
                Formula Validated
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
                <span className="text-xs font-bold text-slate-600 block">Customer Paid (Total)</span>
                <p className="text-xl font-black text-slate-900 mt-1 font-mono">₦2,350</p>
                <span className="text-[11px] text-slate-500 mt-1 block">₦2,000 + ₦250 + ₦100</span>
              </div>

              <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200">
                <span className="text-xs font-bold text-amber-800 block">Restaurant Payable</span>
                <p className="text-xl font-black text-amber-900 mt-1 font-mono">₦2,000</p>
                <span className="text-[11px] text-amber-700 mt-1 block">Restaurant money (Food Subtotal)</span>
              </div>

              <div className="p-4 rounded-2xl bg-blue-50/70 border border-blue-200">
                <span className="text-xs font-bold text-blue-800 block">Rider Delivery Charge</span>
                <p className="text-xl font-black text-blue-900 mt-1 font-mono">₦100</p>
                <span className="text-[11px] text-blue-700 mt-1 block">Rider money (Courier Earning)</span>
              </div>

              <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200">
                <span className="text-xs font-bold text-emerald-800 block">BUKKIT Platform Revenue</span>
                <p className="text-xl font-black text-emerald-900 mt-1 font-mono">₦250</p>
                <span className="text-[11px] text-emerald-700 mt-1 block">BUKKIT Gross Platform Revenue</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: DAILY FINANCIAL BREAKDOWN */}
      {activeTab === 'daily' && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-5 border-b border-slate-100 flex items-center justify-between flex-wrap gap-2">
            <div>
              <h3 className="font-extrabold text-sm text-slate-900">Daily Financial Breakdown (Past 30 Days)</h3>
              <p className="text-xs text-slate-500">Granular daily accounting totals for audit & reconciliation</p>
            </div>
            <button
              onClick={exportDailyCSV}
              className="flex items-center gap-1.5 text-xs font-bold text-[#D6001C] hover:bg-red-50 px-3 py-1.5 rounded-xl border border-red-200 transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              Download CSV
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200 uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-3">Orders</th>
                  <th className="py-3 px-3">Customer GMV</th>
                  <th className="py-3 px-3">BUKKIT Gross (₦250)</th>
                  <th className="py-3 px-3">Paystack Fees</th>
                  <th className="py-3 px-3">BUKKIT Net Rev</th>
                  <th className="py-3 px-3">Restaurant Payable</th>
                  <th className="py-3 px-3">Rider Payable</th>
                  <th className="py-3 px-3">Operating Exp</th>
                  <th className="py-3 px-4 text-right">Net Profit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                {dailyData.map((d) => (
                  <tr key={d.date} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4 font-sans font-medium text-slate-900">{d.dayLabel}</td>
                    <td className="py-3 px-3 font-sans font-bold text-slate-700">{d.orders}</td>
                    <td className="py-3 px-3 text-slate-900 font-bold">₦{d.gmv.toLocaleString()}</td>
                    <td className="py-3 px-3 text-emerald-700 font-bold">₦{d.companyGross.toLocaleString()}</td>
                    <td className="py-3 px-3 text-rose-600">₦{d.paystackFees.toLocaleString()}</td>
                    <td className="py-3 px-3 text-emerald-800 font-bold">₦{d.companyNet.toLocaleString()}</td>
                    <td className="py-3 px-3 text-amber-800">₦{d.restaurantPayable.toLocaleString()}</td>
                    <td className="py-3 px-3 text-blue-800">₦{d.riderPayable.toLocaleString()}</td>
                    <td className="py-3 px-3 text-purple-700">₦{d.operatingExpenses.toLocaleString()}</td>
                    <td className={`py-3 px-4 text-right font-black ${d.netProfit >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
                      ₦{d.netProfit.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: MONTHLY SUMMARY */}
      {activeTab === 'monthly' && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-5 border-b border-slate-100">
            <h3 className="font-extrabold text-sm text-slate-900">Monthly Accounting Performance</h3>
            <p className="text-xs text-slate-500">6-Month consolidated revenue, cost, and net profit ledger</p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200 uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-3.5 px-4">Month</th>
                  <th className="py-3.5 px-3">Orders</th>
                  <th className="py-3.5 px-3">Customer GMV</th>
                  <th className="py-3.5 px-3">Platform Gross</th>
                  <th className="py-3.5 px-3">Paystack Processing</th>
                  <th className="py-3.5 px-3">Net Platform Revenue</th>
                  <th className="py-3.5 px-3">Restaurant Outflow</th>
                  <th className="py-3.5 px-3">Rider Outflow</th>
                  <th className="py-3.5 px-4 text-right">Net Profit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                {monthlyData.map((m) => (
                  <tr key={m.month} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3.5 px-4 font-sans font-bold text-slate-900">{m.monthLabel}</td>
                    <td className="py-3.5 px-3 font-sans font-bold text-slate-700">{m.orders}</td>
                    <td className="py-3.5 px-3 text-slate-900 font-bold">₦{m.gmv.toLocaleString()}</td>
                    <td className="py-3.5 px-3 text-emerald-700 font-bold">₦{m.companyGross.toLocaleString()}</td>
                    <td className="py-3.5 px-3 text-rose-600">₦{m.paystackFees.toLocaleString()}</td>
                    <td className="py-3.5 px-3 text-emerald-800 font-bold">₦{m.companyNet.toLocaleString()}</td>
                    <td className="py-3.5 px-3 text-amber-800">₦{m.restaurantPayable.toLocaleString()}</td>
                    <td className="py-3.5 px-3 text-blue-800">₦{m.riderPayable.toLocaleString()}</td>
                    <td className={`py-3.5 px-4 text-right font-black ${m.netProfit >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
                      ₦{m.netProfit.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: LIVE DOUBLE-ENTRY LEDGER */}
      {activeTab === 'ledger' && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden space-y-4 p-5">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <h3 className="font-extrabold text-sm text-slate-900">Live Double-Entry Journal Entries</h3>
              <p className="text-xs text-slate-500">Immutable ledger transaction log with credit/debit directions</p>
            </div>

            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs text-slate-500 font-medium mr-1">Filter Type:</span>
              {(
                [
                  { id: 'all', label: 'All' },
                  { id: 'CUSTOMER_PAYMENT', label: 'Customer' },
                  { id: 'COMPANY_REVENUE', label: 'Platform Gross' },
                  { id: 'PAYSTACK_FEE', label: 'Paystack Fee' },
                  { id: 'RESTAURANT_PAYABLE', label: 'Restaurant' },
                  { id: 'RIDER_PAYABLE', label: 'Rider' },
                  { id: 'OPERATING_EXPENSE', label: 'Expense' }
                ] as const
              ).map((f) => (
                <button
                  key={f.id}
                  onClick={() => setLedgerFilter(f.id)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors ${
                    ledgerFilter === f.id
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200 uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-3 px-3">Entry ID</th>
                  <th className="py-3 px-3">Type</th>
                  <th className="py-3 px-3">Recipient</th>
                  <th className="py-3 px-3">Description</th>
                  <th className="py-3 px-3">Direction</th>
                  <th className="py-3 px-3">Amount</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-4 text-right">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                {filteredLedger.map((entry) => (
                  <tr key={entry.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-3 font-mono text-slate-500">{entry.id.slice(-10)}</td>
                    <td className="py-3 px-3 font-sans">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        entry.type === 'CUSTOMER_PAYMENT'
                          ? 'bg-emerald-100 text-emerald-800'
                          : entry.type === 'COMPANY_REVENUE'
                          ? 'bg-red-100 text-[#D6001C]'
                          : entry.type === 'PAYSTACK_FEE'
                          ? 'bg-rose-100 text-rose-800'
                          : entry.type === 'RESTAURANT_PAYABLE'
                          ? 'bg-amber-100 text-amber-800'
                          : entry.type === 'RIDER_PAYABLE'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-purple-100 text-purple-800'
                      }`}>
                        {entry.type}
                      </span>
                    </td>
                    <td className="py-3 px-3 font-sans font-medium text-slate-800">{entry.recipient_type}</td>
                    <td className="py-3 px-3 font-sans text-slate-700 max-w-xs truncate">{entry.description}</td>
                    <td className="py-3 px-3 font-bold">
                      <span className={entry.direction === 'credit' ? 'text-emerald-700' : 'text-slate-600'}>
                        {entry.direction.toUpperCase()}
                      </span>
                    </td>
                    <td className={`py-3 px-3 font-black ${entry.direction === 'credit' ? 'text-emerald-700' : 'text-slate-900'}`}>
                      {entry.direction === 'credit' ? '+' : '-'}₦{entry.amount.toLocaleString()}
                    </td>
                    <td className="py-3 px-3">
                      <span className="bg-slate-100 text-slate-700 font-bold px-1.5 py-0.5 rounded text-[10px] uppercase">
                        {entry.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right text-slate-400 font-sans text-[10px]">
                      {new Date(entry.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 5: RESTAURANT & RIDER SETTLEMENT BALANCES */}
      {activeTab === 'settlements' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Restaurant Balances */}
          <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Store className="w-5 h-5 text-amber-600" />
                <h3 className="font-extrabold text-sm text-slate-900">Campus Restaurant Balances</h3>
              </div>
              <span className="text-xs font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded">
                100% Food Subtotal
              </span>
            </div>

            {restaurantBalances.length === 0 ? (
              <p className="text-xs text-slate-400 py-6 text-center">No restaurant balances accrued yet.</p>
            ) : (
              <div className="divide-y divide-slate-100">
                {restaurantBalances.map((rb) => (
                  <div key={rb.restaurant_id} className="py-3 flex items-center justify-between">
                    <div>
                      <p className="font-bold text-xs text-slate-900">{rb.restaurant_name || rb.restaurant_id}</p>
                      <p className="text-[11px] text-slate-500 font-mono">
                        Pending: ₦{(rb.pending_amount || 0).toLocaleString()} • Available: ₦{(rb.available_for_settlement || 0).toLocaleString()}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-black text-amber-900 font-mono">
                        ₦{((rb.available_for_settlement || 0) + (rb.pending_amount || 0)).toLocaleString()}
                      </p>
                      <span className="text-[10px] text-emerald-600 font-bold">Settled: ₦{(rb.paid_out_amount || 0).toLocaleString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Rider Balances */}
          <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Bike className="w-5 h-5 text-blue-600" />
                <h3 className="font-extrabold text-sm text-slate-900">Campus Rider Balances</h3>
              </div>
              <span className="text-xs font-bold text-blue-800 bg-blue-50 px-2 py-0.5 rounded">
                ₦100 per Delivery
              </span>
            </div>

            {riderBalances.length === 0 ? (
              <p className="text-xs text-slate-400 py-6 text-center">No rider balances accrued yet.</p>
            ) : (
              <div className="divide-y divide-slate-100">
                {riderBalances.map((rd) => (
                  <div key={rd.rider_id} className="py-3 flex items-center justify-between">
                    <div>
                      <p className="font-bold text-xs text-slate-900">{rd.rider_name || rd.rider_id}</p>
                      <p className="text-[11px] text-slate-500 font-mono">
                        Pending: ₦{(rd.pending_amount || 0).toLocaleString()} • Available: ₦{(rd.available_amount || 0).toLocaleString()}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-black text-blue-900 font-mono">
                        ₦{((rd.available_amount || 0) + (rd.pending_amount || 0)).toLocaleString()}
                      </p>
                      <span className="text-[10px] text-emerald-600 font-bold">Paid: ₦{(rd.paid_amount || 0).toLocaleString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* RECORD OPERATING EXPENSE MODAL */}
      <AnimatePresence>
        {showExpenseModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <Server className="w-5 h-5 text-purple-600" />
                  <h3 className="font-bold text-slate-900 text-sm">Record Business Operating Expense</h3>
                </div>
                <button
                  onClick={() => setShowExpenseModal(false)}
                  className="text-slate-400 hover:text-slate-600 font-bold text-lg p-1"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleCreateExpense} className="space-y-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Expense Category</label>
                  <select
                    value={newExpenseCategory}
                    onChange={(e) => setNewExpenseCategory(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-[#D6001C]"
                  >
                    <option value="servers">Servers & Cloud Hosting (Cloud Run / DB)</option>
                    <option value="sms">SMS OTP & Notification Alerts</option>
                    <option value="email">Transactional Email Gateway</option>
                    <option value="marketing">Campus Marketing & Promo Credits</option>
                    <option value="staff">Operations & Support Staff</option>
                    <option value="operations">General Campus Delivery Operations</option>
                    <option value="refund_losses">Merchant Refund Losses</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Amount (NGN)</label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-xs font-bold text-slate-400">₦</span>
                    <input
                      type="number"
                      required
                      min="1"
                      step="any"
                      placeholder="5000"
                      value={newExpenseAmount}
                      onChange={(e) => setNewExpenseAmount(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-7 pr-3 py-2 text-xs font-mono font-bold text-slate-800 outline-none focus:ring-2 focus:ring-[#D6001C]"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Description / Memo</label>
                  <textarea
                    required
                    rows={3}
                    placeholder="e.g. Monthly container infrastructure on Cloud Run & PostgreSQL"
                    value={newExpenseDesc}
                    onChange={(e) => setNewExpenseDesc(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-800 outline-none focus:ring-2 focus:ring-[#D6001C]"
                  />
                </div>

                <div className="pt-2 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowExpenseModal(false)}
                    className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingExpense}
                    className="bg-[#D6001C] hover:bg-red-700 text-white text-xs font-bold px-5 py-2 rounded-xl shadow-md transition-all flex items-center gap-1.5"
                  >
                    <CheckCircle className="w-3.5 h-3.5" />
                    {isSubmittingExpense ? 'Posting Entry...' : 'Save & Post to Ledger'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

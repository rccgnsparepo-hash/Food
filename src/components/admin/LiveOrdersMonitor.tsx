import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Activity,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  Bike,
  Store,
  User,
  AlertTriangle,
  RefreshCw,
  Eye,
  ShieldCheck,
  RotateCcw,
  Sliders,
  DollarSign,
  ChevronRight,
  Phone,
  MapPin
} from 'lucide-react';
import { collection, onSnapshot, query, orderBy, doc, updateDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { Order, OrderStatus, UserProfile } from '../../types';
import { useAuthStore } from '../../stores/useAuthStore';
import { transitionOrderStatus } from '../../services/orderLifecycleService';
import { triggerHaptic } from '../../utils/haptics';
import { toast } from 'sonner';

export const LiveOrdersMonitor: React.FC = () => {
  const { user } = useAuthStore();
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [isIntervening, setIsIntervening] = useState(false);
  const [overrideStatus, setOverrideStatus] = useState<OrderStatus>('ready');
  const [reassignRiderName, setReassignRiderName] = useState('');
  const [reassignRiderPhone, setReassignRiderPhone] = useState('');
  const [cancellationReason, setCancellationReason] = useState('');

  useEffect(() => {
    setIsLoading(true);
    const q = query(collection(db, 'orders'));
    const unsub = onSnapshot(
      q,
      (snapshot) => {
        const list: Order[] = [];
        snapshot.forEach((d) => {
          list.push({ id: d.id, ...d.data() } as Order);
        });
        list.sort((a, b) => new Date(b.created_at || '').getTime() - new Date(a.created_at || '').getTime());
        setOrders(list);
        setIsLoading(false);
      },
      (err) => {
        console.warn('Live orders error:', err);
        setIsLoading(false);
      }
    );

    return () => unsub();
  }, []);

  const filteredOrders = orders.filter((ord) => {
    const matchesSearch =
      ord.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ord.user_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ord.restaurant_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ord.rider_name?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = statusFilter === 'all' || ord.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const activeOrdersCount = orders.filter((o) => ['pending', 'accepted', 'preparing', 'ready', 'assigned', 'picked_up', 'on_the_way'].includes(o.status)).length;
  const completedOrdersCount = orders.filter((o) => o.status === 'delivered').length;
  const totalGrossRevenue = orders.reduce((sum, o) => sum + (o.payment_status === 'paid' ? o.total_price : 0), 0);

  const handleApplyIntervention = async () => {
    if (!selectedOrder || !user) return;
    setIsIntervening(true);
    triggerHaptic(50);

    try {
      const res = await transitionOrderStatus(selectedOrder.id, overrideStatus, user, {
        cancellationReason: overrideStatus === 'cancelled' ? cancellationReason : undefined,
        riderName: reassignRiderName || undefined,
        riderPhone: reassignRiderPhone || undefined
      });

      if (res.success) {
        toast.success(`✓ Admin override applied! Order #${selectedOrder.id.slice(-6)} set to ${overrideStatus.toUpperCase()}`);
        setSelectedOrder(null);
      } else {
        toast.error(res.error || 'Failed to apply admin intervention');
      }
    } catch (err: any) {
      toast.error(err.message || 'Intervention failed');
    } finally {
      setIsIntervening(false);
    }
  };

  const getStatusBadge = (status: OrderStatus) => {
    const styles: Record<OrderStatus, string> = {
      pending: 'bg-amber-100 text-amber-900 border-amber-300',
      accepted: 'bg-blue-100 text-blue-900 border-blue-300',
      preparing: 'bg-orange-100 text-orange-900 border-orange-300',
      ready: 'bg-purple-100 text-purple-900 border-purple-300',
      assigned: 'bg-indigo-100 text-indigo-900 border-indigo-300',
      picked_up: 'bg-sky-100 text-sky-900 border-sky-300',
      on_the_way: 'bg-cyan-100 text-cyan-900 border-cyan-300',
      delivered: 'bg-emerald-100 text-emerald-900 border-emerald-300',
      cancelled: 'bg-rose-100 text-rose-900 border-rose-300'
    };

    return (
      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${styles[status] || 'bg-slate-100 text-slate-800'}`}>
        {status.replace('_', ' ')}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      
      {/* 1. Real-time Platform Metrics Bar */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold text-slate-500 uppercase tracking-wider">Active Deliveries</span>
            <Activity className="w-5 h-5 text-[#D6001C] animate-pulse" />
          </div>
          <p className="text-3xl font-black text-slate-900 mt-2">{activeOrdersCount}</p>
          <span className="text-[11px] font-bold text-amber-600">Live on-campus</span>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold text-slate-500 uppercase tracking-wider">Completed Orders</span>
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
          </div>
          <p className="text-3xl font-black text-slate-900 mt-2">{completedOrdersCount}</p>
          <span className="text-[11px] font-bold text-emerald-600">Successfully delivered</span>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold text-slate-500 uppercase tracking-wider">Total Volume</span>
            <Store className="w-5 h-5 text-indigo-600" />
          </div>
          <p className="text-3xl font-black text-slate-900 mt-2">{orders.length}</p>
          <span className="text-[11px] font-bold text-indigo-600">Total orders synced</span>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold text-slate-500 uppercase tracking-wider">Gross Platform GMV</span>
            <DollarSign className="w-5 h-5 text-emerald-600" />
          </div>
          <p className="text-2xl sm:text-3xl font-black text-slate-900 mt-2">₦{totalGrossRevenue.toLocaleString()}</p>
          <span className="text-[11px] font-bold text-slate-500">Verified transactions</span>
        </div>
      </div>

      {/* 2. Filter & Search Controls */}
      <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-2xs flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
          <input
            type="text"
            placeholder="Search order ID, customer, vendor, rider..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-900 placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-[#D6001C]"
          />
        </div>

        {/* Status Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto pb-1 md:pb-0 scrollbar-none">
          {[
            { id: 'all', label: 'All Orders' },
            { id: 'pending', label: 'Pending' },
            { id: 'preparing', label: 'In Kitchen' },
            { id: 'ready', label: 'Ready' },
            { id: 'on_the_way', label: 'In Transit' },
            { id: 'delivered', label: 'Delivered' },
            { id: 'cancelled', label: 'Cancelled' }
          ].map((pill) => (
            <button
              key={pill.id}
              onClick={() => setStatusFilter(pill.id)}
              className={`px-3 py-1.5 rounded-full text-xs font-extrabold transition-all cursor-pointer shrink-0 ${
                statusFilter === pill.id
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {pill.label}
            </button>
          ))}
        </div>
      </div>

      {/* 3. Live Synchronized Orders Table */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-[#D6001C]" />
            <h2 className="font-extrabold text-slate-900 text-base">Live Order Stream ({filteredOrders.length})</h2>
          </div>
          <span className="text-xs font-bold text-emerald-600 flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
            Synchronized with Central Backend
          </span>
        </div>

        {isLoading ? (
          <div className="p-12 text-center text-slate-500 font-bold text-xs">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-[#D6001C]" />
            Connecting to Real-Time Order Stream...
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="p-12 text-center text-slate-400 font-bold text-xs">
            No orders match the current filter or search criteria.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 text-[11px] font-black text-slate-500 uppercase tracking-wider border-b border-slate-200">
                <tr>
                  <th className="px-5 py-3">Order ID</th>
                  <th className="px-5 py-3">Customer</th>
                  <th className="px-5 py-3">Vendor / Kitchen</th>
                  <th className="px-5 py-3">Rider</th>
                  <th className="px-5 py-3">Amount</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Placed At</th>
                  <th className="px-5 py-3 text-right">Intervention</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredOrders.map((ord) => (
                  <tr key={ord.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-5 py-3 font-mono font-black text-slate-900">
                      #{ord.id.slice(-8)}
                    </td>
                    <td className="px-5 py-3 font-bold text-slate-900">
                      <div>{ord.user_name || 'Student'}</div>
                      <div className="text-[10px] text-slate-400 font-medium">{ord.customer_phone || ord.user_phone || 'N/A'}</div>
                    </td>
                    <td className="px-5 py-3 font-extrabold text-slate-800">
                      {ord.restaurant_name || ord.vendor_name || 'Kitchen'}
                    </td>
                    <td className="px-5 py-3">
                      {ord.rider_name ? (
                        <div className="font-bold text-slate-900 flex items-center gap-1">
                          <Bike className="w-3.5 h-3.5 text-[#D6001C]" />
                          <span>{ord.rider_name}</span>
                        </div>
                      ) : (
                        <span className="text-slate-400 italic">Unassigned</span>
                      )}
                    </td>
                    <td className="px-5 py-3 font-black text-slate-900">
                      ₦{ord.total_price.toLocaleString()}
                      <div className="text-[9px] font-bold text-emerald-600 uppercase">{ord.payment_status}</div>
                    </td>
                    <td className="px-5 py-3">
                      {getStatusBadge(ord.status)}
                    </td>
                    <td className="px-5 py-3 text-slate-400 font-medium">
                      {new Date(ord.created_at || '').toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <button
                        onClick={() => {
                          setSelectedOrder(ord);
                          setOverrideStatus(ord.status);
                          setReassignRiderName(ord.rider_name || '');
                          setReassignRiderPhone(ord.rider_phone || '');
                        }}
                        className="bg-slate-900 hover:bg-black text-white text-[11px] font-black px-3 py-1.5 rounded-xl transition-colors cursor-pointer shadow-2xs"
                      >
                        Intervene
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 4. Administrative Intervention Modal */}
      <AnimatePresence>
        {selectedOrder && (
          <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl border border-slate-200 space-y-5 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div>
                  <h3 className="font-black text-lg text-slate-900">Admin Order Intervention</h3>
                  <p className="text-xs font-mono font-bold text-slate-400">Order ID: #{selectedOrder.id}</p>
                </div>
                {getStatusBadge(selectedOrder.status)}
              </div>

              {/* Order Context Details */}
              <div className="bg-slate-50 p-4 rounded-2xl text-xs space-y-2 border border-slate-200">
                <div className="flex justify-between">
                  <span className="text-slate-500 font-bold">Customer:</span>
                  <span className="font-black text-slate-900">{selectedOrder.user_name} ({selectedOrder.customer_phone || selectedOrder.user_phone})</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-bold">Vendor:</span>
                  <span className="font-black text-slate-900">{selectedOrder.restaurant_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-bold">Dropoff Address:</span>
                  <span className="font-bold text-slate-800">{selectedOrder.delivery_address}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-bold">Total Amount:</span>
                  <span className="font-black text-[#D6001C]">₦{selectedOrder.total_price.toLocaleString()} ({selectedOrder.payment_status.toUpperCase()})</span>
                </div>
              </div>

              {/* Intervention Controls */}
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-black text-slate-700 uppercase tracking-wider mb-1.5">
                    Override Order Status
                  </label>
                  <select
                    value={overrideStatus}
                    onChange={(e) => setOverrideStatus(e.target.value as OrderStatus)}
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-extrabold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-[#D6001C]"
                  >
                    <option value="pending">Pending</option>
                    <option value="accepted">Accepted by Kitchen</option>
                    <option value="preparing">Preparing in Kitchen</option>
                    <option value="ready">Ready for Dispatch</option>
                    <option value="assigned">Assigned to Rider</option>
                    <option value="picked_up">Picked Up</option>
                    <option value="on_the_way">On The Way</option>
                    <option value="delivered">Delivered (Complete)</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>

                {overrideStatus === 'cancelled' && (
                  <div>
                    <label className="block text-xs font-black text-slate-700 uppercase tracking-wider mb-1.5">
                      Cancellation Reason
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Vendor out of ingredients / Customer requested refund"
                      value={cancellationReason}
                      onChange={(e) => setCancellationReason(e.target.value)}
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-[#D6001C]"
                    />
                  </div>
                )}

                {/* Rider Assignment Override */}
                <div className="border-t border-slate-100 pt-4 space-y-3">
                  <label className="block text-xs font-black text-slate-700 uppercase tracking-wider">
                    Manual Dispatch / Rider Reassignment
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      placeholder="Rider Full Name"
                      value={reassignRiderName}
                      onChange={(e) => setReassignRiderName(e.target.value)}
                      className="p-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-900"
                    />
                    <input
                      type="text"
                      placeholder="Rider Phone Number"
                      value={reassignRiderPhone}
                      onChange={(e) => setReassignRiderPhone(e.target.value)}
                      className="p-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-900"
                    />
                  </div>
                </div>
              </div>

              {/* Modal Actions */}
              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedOrder(null)}
                  className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-2xl text-xs transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleApplyIntervention}
                  disabled={isIntervening}
                  className="flex-1 py-3 bg-[#D6001C] hover:bg-red-700 text-white font-black rounded-2xl text-xs transition-colors cursor-pointer shadow-md shadow-red-500/20"
                >
                  {isIntervening ? 'Applying...' : 'Apply Override'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
};

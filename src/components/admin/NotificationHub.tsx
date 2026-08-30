import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import {
  Bell,
  Radio,
  Smartphone,
  Server,
  Activity,
  Send,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Zap,
  Users,
  ShieldAlert,
  Flame,
  Layers,
  Database
} from 'lucide-react';
import {
  NotificationHealthStats,
  DeviceTokenRecord,
  OrderEventType,
  NotificationAppType,
  NotificationSeverity
} from '../../types';
import { apiFetchJson, formatApiErrorMessage } from '../../lib/apiConfig';
import { triggerHaptic } from '../../utils/haptics';
import { toast } from 'sonner';

export const NotificationHub: React.FC = () => {
  const [stats, setStats] = useState<NotificationHealthStats | null>(null);
  const [tokens, setTokens] = useState<DeviceTokenRecord[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSending, setIsSending] = useState<boolean>(false);

  // Simulation form states
  const [targetRole, setTargetRole] = useState<NotificationAppType>('CUSTOMER');
  const [selectedEventType, setSelectedEventType] = useState<OrderEventType>('ORDER_CREATED');
  const [customOrderId, setCustomOrderId] = useState<string>('ORD-MTU-8821');
  const [vendorName, setVendorName] = useState<string>("Ronald's Food House");
  const [riderName, setRiderName] = useState<string>('Speedy Rider Emmanuel');
  const [deliveryLocation, setDeliveryLocation] = useState<string>('Daniel Hall Block B');
  const [adminAlertSeverity, setAdminAlertSeverity] = useState<NotificationSeverity>('WARNING');
  const [adminAlertText, setAdminAlertText] = useState<string>('Peak Lunchtime Surge at Mountain Top University');

  const fetchHealthAndTokens = async () => {
    setIsLoading(true);
    try {
      const [healthRes, tokensRes] = await Promise.all([
        apiFetchJson<any>('/api/notifications/health'),
        apiFetchJson<any>('/api/notifications/tokens')
      ]);

      if (healthRes.ok && healthRes.data?.success) setStats(healthRes.data.stats);
      if (tokensRes.ok && tokensRes.data?.success) setTokens(tokensRes.data.tokens);
    } catch (err) {
      console.warn('Failed to load notification hub metrics:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchHealthAndTokens();
    const interval = setInterval(fetchHealthAndTokens, 8000);
    return () => clearInterval(interval);
  }, []);

  const handleTriggerDispatch = async () => {
    setIsSending(true);
    triggerHaptic(30);

    try {
      let result;
      if (targetRole === 'ADMIN') {
        result = await apiFetchJson<any>('/api/notifications/admin-alert', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: adminAlertText,
            body: `Operational notification generated from Admin Notification Control Hub at ${new Date().toLocaleTimeString()}`,
            severity: adminAlertSeverity,
            alertCategory: 'SYSTEM_HEALTH'
          })
        });
      } else {
        result = await apiFetchJson<any>('/api/notifications/order-event', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            orderId: customOrderId,
            eventType: selectedEventType,
            customerId: 'user_cust_01',
            customerName: 'Campus Student',
            vendorId: 'user_vendor_ronalds',
            vendorName,
            riderId: 'user_rider_01',
            riderName,
            deliveryLocation,
            deliveryCode: '4912',
            pickupCode: '7721',
            totalPrice: 2800,
            riderFee: 350,
            estimatedMinutes: 15
          })
        });
      }

      if (result.ok && result.data?.success) {
        toast.success(`✓ Notification Pipeline Dispatched: ${targetRole === 'ADMIN' ? 'Admin Alert' : selectedEventType}`, {
          description: `${result.data.dispatchedNotifications?.length || 1} push notification payload(s) routed.`
        });
        fetchHealthAndTokens();
      } else {
        const errorText = formatApiErrorMessage(result.error || result.data?.message || result.data?.error || 'Server response error');
        toast.error(`Dispatch failed: ${errorText}`);
      }
    } catch (err: any) {
      const errorText = formatApiErrorMessage(err?.message || err || 'Network error');
      toast.error(`Dispatch error: ${errorText}`);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-slate-900 text-white rounded-3xl p-6 sm:p-8 shadow-xl border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-[#D6001C] rounded-2xl shadow-lg shadow-red-500/20">
              <Radio className="w-6 h-6 text-white animate-pulse" />
            </div>
            <div>
              <h2 className="text-xl font-black tracking-tight text-white">Centralized Firebase Push & Notification Architecture</h2>
              <p className="text-xs text-slate-400">
                Authoritative backend pipeline routing to Customer, Rider, Kitchen, and Admin across Web & Mobile
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              triggerHaptic(20);
              fetchHealthAndTokens();
            }}
            disabled={isLoading}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs flex items-center gap-2 border border-slate-700 transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Refresh Diagnostics</span>
          </button>
        </div>
      </div>

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Total Dispatches</span>
            <Send className="w-4 h-4 text-blue-500" />
          </div>
          <p className="text-2xl font-black text-slate-900">{stats?.totalNotificationsSent ?? 0}</p>
          <p className="text-[11px] text-emerald-600 font-extrabold mt-1">100% Delivered</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Active Device Tokens</span>
            <Smartphone className="w-4 h-4 text-emerald-500" />
          </div>
          <p className="text-2xl font-black text-slate-900">{stats?.activeDeviceTokens ?? tokens.length}</p>
          <p className="text-[11px] text-slate-400 font-bold mt-1">Web, Android & Desktop</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Deduplicated</span>
            <Layers className="w-4 h-4 text-amber-500" />
          </div>
          <p className="text-2xl font-black text-slate-900">{stats?.totalDeduplicated ?? 0}</p>
          <p className="text-[11px] text-slate-500 font-medium mt-1">Idempotency protection</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Average Pipeline Latency</span>
            <Zap className="w-4 h-4 text-[#D6001C]" />
          </div>
          <p className="text-2xl font-black text-slate-900">{stats?.averageLatencyMs ?? 12} ms</p>
          <p className="text-[11px] text-emerald-600 font-bold mt-1">Sub-second real-time fanout</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Event Dispatch & Testing Simulator */}
        <div className="lg:col-span-7 bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-5">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-[#D6001C]" />
              <h3 className="font-extrabold text-base text-slate-900">Authoritative Event Dispatch Simulator</h3>
            </div>
            <span className="bg-rose-50 text-[#D6001C] text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider">
              Live Pipeline
            </span>
          </div>

          {/* Role selector */}
          <div className="space-y-2">
            <label className="text-xs font-black uppercase tracking-wider text-slate-600">Target Role Application</label>
            <div className="grid grid-cols-4 gap-2">
              {(['CUSTOMER', 'RIDER', 'VENDOR', 'ADMIN'] as NotificationAppType[]).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => {
                    triggerHaptic(20);
                    setTargetRole(r);
                  }}
                  className={`py-2.5 px-3 rounded-xl text-xs font-black transition-all cursor-pointer ${
                    targetRole === r
                      ? 'bg-[#D6001C] text-white shadow-md shadow-red-500/20'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          {targetRole !== 'ADMIN' ? (
            <>
              {/* Order Event Type Selector */}
              <div className="space-y-2">
                <label className="text-xs font-black uppercase tracking-wider text-slate-600">Order Event Trigger</label>
                <select
                  value={selectedEventType}
                  onChange={(e) => setSelectedEventType(e.target.value as OrderEventType)}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:ring-2 focus:ring-[#D6001C] focus:outline-none"
                >
                  <option value="ORDER_CREATED">ORDER_CREATED (New Order Placed)</option>
                  <option value="PAYMENT_CONFIRMED">PAYMENT_CONFIRMED (Payment Verified)</option>
                  <option value="VENDOR_ACCEPTED">VENDOR_ACCEPTED (Kitchen Accepted)</option>
                  <option value="ORDER_PREPARING">ORDER_PREPARING (Meal Cooking)</option>
                  <option value="ORDER_READY">ORDER_READY (Ready for Rider Pickup)</option>
                  <option value="RIDER_ASSIGNED">RIDER_ASSIGNED (Courier Dispatched)</option>
                  <option value="RIDER_ARRIVED_VENDOR">RIDER_ARRIVED_VENDOR (Rider at Kitchen Stand)</option>
                  <option value="ORDER_PICKED_UP">ORDER_PICKED_UP (Food Collected)</option>
                  <option value="ORDER_OUT_FOR_DELIVERY">ORDER_OUT_FOR_DELIVERY (En Route to Campus Hostel)</option>
                  <option value="RIDER_ARRIVED_CUSTOMER">RIDER_ARRIVED_CUSTOMER (Rider Outside PIN Prompt)</option>
                  <option value="ORDER_DELIVERED">ORDER_DELIVERED (Delivery Completed & Confirmed)</option>
                  <option value="ORDER_CANCELLED">ORDER_CANCELLED (Order Cancelled & Refunded)</option>
                  <option value="REFUND_COMPLETED">REFUND_COMPLETED (Wallet Refund Credited)</option>
                </select>
              </div>

              {/* Order Metadata Parameters */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="text-[11px] font-bold text-slate-500 block mb-1">Order Reference</label>
                  <input
                    type="text"
                    value={customOrderId}
                    onChange={(e) => setCustomOrderId(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-500 block mb-1">Vendor Stand Name</label>
                  <input
                    type="text"
                    value={vendorName}
                    onChange={(e) => setVendorName(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-500 block mb-1">Assigned Rider</label>
                  <input
                    type="text"
                    value={riderName}
                    onChange={(e) => setRiderName(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-500 block mb-1">Campus Delivery Spot</label>
                  <input
                    type="text"
                    value={deliveryLocation}
                    onChange={(e) => setDeliveryLocation(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800"
                  />
                </div>
              </div>
            </>
          ) : (
            <div className="space-y-3">
              <div>
                <label className="text-xs font-black uppercase tracking-wider text-slate-600 block mb-1">
                  Alert Severity Level
                </label>
                <div className="flex items-center gap-2">
                  {(['INFO', 'WARNING', 'CRITICAL'] as NotificationSeverity[]).map((sev) => (
                    <button
                      key={sev}
                      type="button"
                      onClick={() => setAdminAlertSeverity(sev)}
                      className={`flex-1 py-2 rounded-xl text-xs font-black transition-colors cursor-pointer ${
                        adminAlertSeverity === sev
                          ? sev === 'CRITICAL'
                            ? 'bg-red-600 text-white'
                            : sev === 'WARNING'
                            ? 'bg-amber-500 text-white'
                            : 'bg-blue-600 text-white'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {sev}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-500 block mb-1">Admin Broadcast Title</label>
                <input
                  type="text"
                  value={adminAlertText}
                  onChange={(e) => setAdminAlertText(e.target.value)}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800"
                />
              </div>
            </div>
          )}

          {/* Dispatch Button */}
          <button
            onClick={handleTriggerDispatch}
            disabled={isSending}
            className="w-full py-3.5 bg-[#D6001C] hover:bg-red-700 text-white font-black text-sm rounded-2xl shadow-lg shadow-red-500/20 flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
          >
            <Send className={`w-4 h-4 ${isSending ? 'animate-bounce' : ''}`} />
            <span>{isSending ? 'Routing Event through Pipeline...' : 'Dispatch Authoritative Event'}</span>
          </button>
        </div>

        {/* Right: Registered Device Tokens & Active Nodes */}
        <div className="lg:col-span-5 bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div className="flex items-center gap-2">
              <Smartphone className="w-5 h-5 text-slate-700" />
              <h3 className="font-extrabold text-base text-slate-900">Active Device Registry</h3>
            </div>
            <span className="text-xs font-bold text-slate-500">{tokens.length} Connected</span>
          </div>

          <div className="space-y-3 max-h-[380px] overflow-y-auto pr-1">
            {tokens.map((token) => (
              <div
                key={token.token_id}
                className="p-3.5 bg-slate-50 hover:bg-slate-100/80 rounded-2xl border border-slate-200 transition-colors"
              >
                <div className="flex items-center justify-between mb-1">
                  <span
                    className={`text-[10px] font-black px-2 py-0.5 rounded-md uppercase tracking-wider ${
                      token.app_type === 'CUSTOMER'
                        ? 'bg-blue-100 text-blue-800'
                        : token.app_type === 'RIDER'
                        ? 'bg-emerald-100 text-emerald-800'
                        : token.app_type === 'VENDOR'
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-purple-100 text-purple-800'
                    }`}
                  >
                    {token.app_type} • {token.platform}
                  </span>
                  <span className="text-[10px] text-emerald-600 font-extrabold flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Active
                  </span>
                </div>

                <p className="text-xs font-bold text-slate-800 truncate">{token.device_id}</p>
                <p className="text-[10px] text-slate-400 font-mono truncate mt-0.5">
                  FCM: {token.fcm_token.slice(0, 24)}...
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

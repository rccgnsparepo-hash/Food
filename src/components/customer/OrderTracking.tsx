import React, { useEffect, useState } from 'react';
import { doc, onSnapshot } from "../../lib/embeddedDb";
import { db } from '../../lib/firebase';
import { Order, OrderStatus } from '../../types';
import { MapPicker } from '../ui/MapPicker';
import { OrderDetailModal } from './OrderDetailModal';
import { RealtimeDeliveryChatModal } from '../common/RealtimeDeliveryChatModal';
import { OrderReceiptModal } from './OrderReceiptModal';
import { OrderStatusAnimation } from './OrderStatusAnimation';
import {
  ArrowLeft,
  Bike,
  Phone,
  MessageSquare,
  CheckCircle2,
  Clock,
  MapPin,
  ShieldCheck,
  Building,
  Home,
  QrCode,
  KeyRound,
  Download,
  Receipt,
  User,
  AlertCircle,
  Sparkles,
  Gift,
  Share2,
  Copy,
  Check,
  Link2,
  ShoppingBag,
  ChefHat,
  UserCheck,
  Calendar
} from 'lucide-react';
import { useAuthStore } from '../../stores/useAuthStore';
import { triggerHaptic } from '../../utils/haptics';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';
import { buildValidatedOrderReceipt, generateBukkitReceiptPDF } from '../../services/receiptService';

interface OrderTrackingProps {
  orderId: string;
  onBack: () => void;
}

export const OrderTracking: React.FC<OrderTrackingProps> = ({ orderId, onBack }) => {
  const { user } = useAuthStore();
  const [order, setOrder] = useState<Order | null>(null);
  const [riderLat, setRiderLat] = useState(6.784);
  const [riderLng, setRiderLng] = useState(3.442);
  const [showChat, setShowChat] = useState(false);
  const [showReceipt, setShowReceipt] = useState(false);
  const [hasCopiedLink, setHasCopiedLink] = useState(false);
  const [isSharing, setIsSharing] = useState(false);

  const handleShareOrder = async () => {
    if (!order) return;
    triggerHaptic(40);
    setIsSharing(true);

    const trackingUrl = `${window.location.origin}${window.location.pathname}?trackOrder=${encodeURIComponent(order.id)}`;
    const statusLabel = order.status.replace(/_/g, ' ').toUpperCase();
    const vendorName = order.vendor_name || 'BUKKIT Kitchen';
    const tokenInfo = order.daily_token ? ` Token #${order.daily_token}` : '';
    const shareTitle = `BUKKIT Order #${order.id.slice(-6)}: ${statusLabel}`;
    const shareText = `Tracking my BUKKIT meal from ${vendorName}!\nStatus: ${statusLabel}${tokenInfo ? ` • ${tokenInfo}` : ''}\nTotal: ₦${order.total_price.toLocaleString()}\nLive Tracking:`;

    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        await navigator.share({
          title: shareTitle,
          text: shareText,
          url: trackingUrl,
        });
        triggerHaptic(60);
        toast.success('✓ Order status shared successfully!');
      } catch (err: any) {
        if (err?.name !== 'AbortError') {
          console.warn('Web Share API error, falling back to copy:', err);
          await handleCopyTrackingLink();
        }
      } finally {
        setIsSharing(false);
      }
    } else {
      // Fallback for browsers / iframes that do not support Web Share API
      await handleCopyTrackingLink();
      setIsSharing(false);
      toast.info('Direct tracking link copied to clipboard. Share on WhatsApp or messaging apps!');
    }
  };

  const handleCopyTrackingLink = async () => {
    if (!order) return;
    triggerHaptic(50);
    const trackingUrl = `${window.location.origin}${window.location.pathname}?trackOrder=${encodeURIComponent(order.id)}`;

    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(trackingUrl);
      } else {
        const textArea = document.createElement('textarea');
        textArea.value = trackingUrl;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }
      setHasCopiedLink(true);
      toast.success('✓ Live tracking link copied to clipboard! Share it with friends or roommates.');
      setTimeout(() => setHasCopiedLink(false), 2500);
    } catch (err) {
      console.warn('Clipboard write error:', err);
      toast.info(`Tracking Link: ${trackingUrl}`);
    }
  };

  // Real-time Firestore Order listener
  useEffect(() => {
    if (!orderId) return;

    const unsubOrder = onSnapshot(
      doc(db, 'orders', orderId),
      (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data() as Order;
          setOrder(data);
          if (data.rider_current_latitude && data.rider_current_longitude) {
            setRiderLat(data.rider_current_latitude);
            setRiderLng(data.rider_current_longitude);
          }
        }
      },
      (err) => console.error('Order tracking snapshot error:', err)
    );

    return () => unsubOrder();
  }, [orderId]);

  if (!order) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center space-y-3">
          <div className="w-12 h-12 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin mx-auto" />
          <p className="text-sm font-bold text-slate-700">Connecting to BUKKIT Live Delivery Stream...</p>
        </div>
      </div>
    );
  }

  // Authoritative Status Lifecycle Steps: 'Order Placed', 'Kitchen Preparing', 'Rider Assigned', 'Out for Delivery'
  const lifecycleSteps = [
    {
      id: 'placed',
      label: 'Order Placed',
      sublabel: 'Confirmed',
      desc: 'Order received & queued with kitchen',
      icon: ShoppingBag
    },
    {
      id: 'kitchen_preparing',
      label: 'Kitchen Preparing',
      sublabel: 'In Kitchen',
      desc: 'Meal is being prepared and cooked fresh',
      icon: ChefHat
    },
    {
      id: 'rider_assigned',
      label: 'Rider Assigned',
      sublabel: 'Courier Matched',
      desc: 'Courier assigned and en route to kitchen',
      icon: UserCheck
    },
    {
      id: 'out_for_delivery',
      label: 'Out for Delivery',
      sublabel: 'On the Way',
      desc: 'Courier heading to your campus drop-off',
      icon: Bike
    }
  ] as const;

  const getLifecycleStage = (status: OrderStatus): number => {
    switch (status) {
      case 'pending':
      case 'payment_confirmed':
        return 0; // 'Order Placed'
      case 'accepted':
      case 'vendor_accepted':
      case 'preparing':
      case 'ready':
      case 'ready_for_pickup':
        return 1; // 'Kitchen Preparing'
      case 'assigned':
      case 'rider_assigned':
      case 'rider_arrived_vendor':
      case 'picked_up':
        return 2; // 'Rider Assigned'
      case 'on_the_way':
      case 'out_for_delivery':
      case 'arrived_at_delivery':
        return 3; // 'Out for Delivery'
      case 'delivered':
        return 4; // Completed (all steps finished)
      case 'cancelled':
      case 'failed_delivery':
      case 'refunded':
        return -1;
      default:
        return 0;
    }
  };

  const currentLifecycleStage = getLifecycleStage(order.status);
  const isCancelled = order.status === 'cancelled' || order.status === 'refunded';
  const isDelivered = order.status === 'delivered';

  const handleDownloadPDF = async () => {
    triggerHaptic(50);
    try {
      const res = await buildValidatedOrderReceipt(order, user);
      if (res.receipt) {
        await generateBukkitReceiptPDF(res.receipt);
        toast.success('Official BUKKIT Receipt PDF downloaded');
      } else {
        toast.error(res.error || 'Failed to generate receipt PDF');
      }
    } catch (err) {
      toast.error('Could not generate receipt PDF');
    }
  };

  const handleSharePickupPass = async () => {
    if (!order) return;
    triggerHaptic(25);
    const pin = order.delivery_code || order.pickup_code || '4829';
    const token = order.daily_token || `#${order.id.slice(-4)}`;
    const recipient = order.recipient_name || order.customer_name || 'Roommate';
    const dropoff = order.delivery_address || 'Hostel Gate';
    const courier = order.rider_name || 'Assigned Courier';

    const text = `🍔 *BUKKIT CAMPUS PICKUP PASS*\n` +
      `🎫 *Daily Token:* ${token}\n` +
      `👤 *Recipient:* ${recipient}\n` +
      `📍 *Drop-off:* ${dropoff}\n` +
      `🛵 *Courier:* ${courier}\n\n` +
      `🔑 *YOUR 4-DIGIT PIN: ${pin}*\n\n` +
      `⚠️ *Anti-Scam Security:* Show or read this 4-digit PIN to courier upon arrival at gate. The meal cannot be released without this PIN.`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: `Bukkit Pickup Pass - Token ${token}`,
          text: text
        });
        toast.success('Pickup Pass shared successfully!');
        return;
      } catch (e) {
        // Fallback to clipboard
      }
    }

    try {
      await navigator.clipboard.writeText(text);
      toast.success('✓ Pickup Pass copied to clipboard! Paste it to your roommate on WhatsApp.');
    } catch (e) {
      window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 pb-20">
      {/* Top Header */}
      <div className="sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-slate-200 px-4 py-3.5">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <button
            onClick={onBack}
            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="text-center">
            <div className="flex items-center justify-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <h1 className="text-base font-black text-slate-900">Order #{order.id.slice(-6)}</h1>
            </div>
            <p className="text-[11px] text-slate-500 font-medium">{order.vendor_name || 'Campus Kitchen'}</p>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2">
            <button
              onClick={handleShareOrder}
              disabled={isSharing}
              className="p-2 sm:px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white transition-colors flex items-center gap-1.5 text-xs font-bold cursor-pointer shadow-xs disabled:opacity-75"
              title="Share live order status via external messaging apps"
            >
              <Share2 className="w-4 h-4 text-white" />
              <span className="hidden sm:inline">Share Order</span>
            </button>

            <button
              onClick={handleCopyTrackingLink}
              className={`p-2 sm:px-3 rounded-xl transition-colors flex items-center gap-1.5 text-xs font-bold cursor-pointer ${
                hasCopiedLink
                  ? 'bg-slate-800 text-white shadow-xs'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
              }`}
              title="Copy direct live tracking link to clipboard"
            >
              {hasCopiedLink ? <Check className="w-4 h-4 text-white" /> : <Link2 className="w-4 h-4 text-emerald-600" />}
              <span className="hidden sm:inline">{hasCopiedLink ? 'Copied!' : 'Copy Link'}</span>
            </button>

            <button
              onClick={() => setShowReceipt(true)}
              className="p-2 rounded-xl bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors flex items-center gap-1 text-xs font-bold cursor-pointer"
            >
              <Receipt className="w-4 h-4" />
              <span className="hidden sm:inline">Receipt</span>
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto p-4 sm:p-6 space-y-4">
        {/* VISUAL STATUS TRANSITION ANIMATIONS (Preparing, Out for Delivery, Delivered) */}
        <OrderStatusAnimation
          status={order.status}
          vendorName={order.vendor_name || 'Campus Kitchen'}
          riderName={order.rider_name}
          deliveryCode={order.delivery_code || order.pickup_code}
        />

        {/* SECTION 1: LIVE STATUS HERO CARD */}
        <div className="bg-white rounded-3xl p-5 shadow-xs border border-slate-200 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-[10px] uppercase tracking-wider font-extrabold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                {order.status.replace(/_/g, ' ').toUpperCase()}
              </span>
              <h2 className="text-lg font-black text-slate-900 mt-2">
                {isDelivered
                  ? 'Meal Delivered Successfully!'
                  : isCancelled
                  ? 'Order Cancelled'
                  : 'Delivery in Progress'}
              </h2>
            </div>
            <div className="text-right">
              <span className="text-xs text-slate-400 font-bold block">Authoritative Total</span>
              <span className="text-xl font-black text-slate-900">₦{order.total_price.toLocaleString()}</span>
            </div>
          </div>

          {/* Quick Share Status Action Banner */}
          <div className="flex items-center justify-between gap-3 p-3 rounded-2xl bg-emerald-50/70 border border-emerald-100">
            <div className="flex items-center gap-2 text-xs text-emerald-900 font-medium min-w-0">
              <Share2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span className="truncate">Share live delivery status & ETA with roommates via external apps:</span>
            </div>
            <button
              onClick={handleShareOrder}
              disabled={isSharing}
              className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs transition-colors flex items-center gap-1.5 shrink-0 cursor-pointer shadow-xs disabled:opacity-75"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>Share Status</span>
            </button>
          </div>

          {/* Hall Porter Custody Alert (If applicable) */}
          {order.delivery_proof_type === 'hall_porter_custody' && (
            <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 space-y-1">
              <div className="flex items-center gap-2">
                <Building className="w-4 h-4 text-amber-700 shrink-0" />
                <span className="text-xs font-black">Deposited with Hall Porter / Reception</span>
              </div>
              <p className="text-xs">
                Your courier deposited the food with <strong>{order.hall_porter_name || 'Hall Porter'}</strong>
                {order.hall_porter_phone ? ` (${order.hall_porter_phone})` : ''} at the hostel lodge.
                Show your Daily Token <strong>{order.daily_token || order.id.slice(-6)}</strong> at the desk to collect.
              </p>
              {order.custody_handover_notes && (
                <p className="text-[11px] text-amber-700 italic">"{order.custody_handover_notes}"</p>
              )}
            </div>
          )}

          {/* Scheduled Delivery Banner (If pre-ordered for later) */}
          {order.is_scheduled && order.scheduled_time_slot && (
            <div className="p-4 rounded-2xl bg-indigo-50 border border-indigo-200 text-indigo-950 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                  <Calendar className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-black uppercase tracking-wider bg-indigo-200 text-indigo-900 px-2 py-0.5 rounded-full">
                      Scheduled Delivery
                    </span>
                  </div>
                  <h4 className="text-sm font-black text-indigo-950 mt-0.5">
                    Preferred Time Slot: {order.scheduled_time_slot}
                  </h4>
                  <p className="text-xs text-indigo-800">
                    Delivery Date: <strong>{order.scheduled_delivery_date || 'Today'}</strong>. The kitchen and courier dispatch will activate automatically for this scheduled window.
                  </p>
                </div>
              </div>
              <div className="text-left sm:text-right shrink-0">
                <span className="text-[11px] font-bold text-indigo-700 bg-white px-3 py-1.5 rounded-xl border border-indigo-200 shadow-2xs block">
                  ⏰ Slot: {order.scheduled_time_slot}
                </span>
              </div>
            </div>
          )}

          {/* VISUAL STEP-PROGRESS INDICATOR ('Order Placed', 'Kitchen Preparing', 'Rider Assigned', 'Out for Delivery') */}
          {!isCancelled && (
            <div className="p-4 sm:p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black uppercase tracking-wider text-slate-500">
                  Delivery Lifecycle Progress
                </span>
                <span className="text-xs font-black text-emerald-700 bg-emerald-100 px-2.5 py-0.5 rounded-full">
                  {isDelivered
                    ? 'All 4 Steps Completed'
                    : `Step ${Math.min(4, Math.max(1, currentLifecycleStage + 1))} of 4`}
                </span>
              </div>

              {/* 4-Step Horizontal Progress Stepper */}
              <div className="relative pt-2 pb-1">
                {/* Connecting Track Behind Step Circles */}
                <div className="absolute top-6 left-6 right-6 h-1 bg-slate-200 -translate-y-1/2 z-0">
                  <div
                    className="h-full bg-emerald-500 transition-all duration-700 rounded-full"
                    style={{
                      width: isDelivered
                        ? '100%'
                        : `${Math.max(0, Math.min(100, (currentLifecycleStage / (lifecycleSteps.length - 1)) * 100))}%`
                    }}
                  />
                </div>

                {/* Step Circles & Labels */}
                <div className="relative z-10 grid grid-cols-4 gap-1 text-center">
                  {lifecycleSteps.map((step, idx) => {
                    const isCompleted = isDelivered || currentLifecycleStage > idx;
                    const isCurrent = !isDelivered && currentLifecycleStage === idx;
                    const StepIcon = step.icon;

                    return (
                      <div key={step.id} className="flex flex-col items-center">
                        {/* Step Circle */}
                        <div
                          className={`w-9 h-9 sm:w-11 sm:h-11 rounded-full flex items-center justify-center transition-all duration-300 shadow-xs ${
                            isCompleted
                              ? 'bg-emerald-600 text-white ring-4 ring-emerald-100'
                              : isCurrent
                              ? 'bg-white text-emerald-600 border-2 border-emerald-600 ring-4 ring-emerald-200/80 animate-pulse'
                              : 'bg-white text-slate-400 border-2 border-slate-200'
                          }`}
                        >
                          {isCompleted ? (
                            <Check className="w-4 h-4 sm:w-5 sm:h-5 stroke-[3]" />
                          ) : (
                            <StepIcon className="w-4 h-4 sm:w-5 sm:h-5" />
                          )}
                        </div>

                        {/* Step Label */}
                        <div className="mt-2 space-y-0.5 px-0.5">
                          <p
                            className={`text-[11px] sm:text-xs font-black leading-tight ${
                              isCompleted
                                ? 'text-emerald-800'
                                : isCurrent
                                ? 'text-slate-900 font-black'
                                : 'text-slate-400'
                            }`}
                          >
                            {step.label}
                          </p>
                          <span
                            className={`hidden sm:inline-block text-[10px] font-bold px-1.5 py-0.2 rounded-md ${
                              isCompleted
                                ? 'text-emerald-700 bg-emerald-50'
                                : isCurrent
                                ? 'text-emerald-700 bg-emerald-100 font-extrabold'
                                : 'text-slate-400 bg-slate-100'
                            }`}
                          >
                            {isCompleted ? 'Done' : isCurrent ? 'In Progress' : 'Pending'}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Active Step Highlight Card */}
              <div className="p-3.5 rounded-xl bg-white border border-slate-200/90 shadow-2xs flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-emerald-50 text-emerald-700 shrink-0">
                    {isDelivered ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                    ) : (
                      React.createElement(
                        lifecycleSteps[Math.max(0, Math.min(3, currentLifecycleStage))].icon,
                        { className: 'w-5 h-5 text-emerald-600 animate-pulse' }
                      )
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] uppercase tracking-wider font-black text-slate-400">
                        Current Status
                      </span>
                      {!isDelivered && (
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                      )}
                    </div>
                    <h4 className="text-xs sm:text-sm font-black text-slate-900">
                      {isDelivered
                        ? 'Order Delivered Successfully'
                        : lifecycleSteps[Math.max(0, Math.min(3, currentLifecycleStage))].label}
                    </h4>
                    <p className="text-[11px] text-slate-500 font-medium">
                      {isDelivered
                        ? 'Handoff confirmed at your destination.'
                        : lifecycleSteps[Math.max(0, Math.min(3, currentLifecycleStage))].desc}
                    </p>
                  </div>
                </div>

                {/* Token or Room Reference */}
                <div className="text-right shrink-0">
                  <span className="text-[9px] uppercase font-bold text-slate-400 block">Meal Token</span>
                  <span className="text-xs sm:text-sm font-mono font-black text-slate-900 bg-slate-100 px-2 py-0.5 rounded-md">
                    {order.daily_token || `#${order.id.slice(-4)}`}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Copy Live Tracking Link Quick Action */}
          <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/90 rounded-2xl p-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-emerald-100 text-emerald-800 shrink-0">
                <Link2 className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-black text-slate-900">Share Live Tracking</h4>
                <p className="text-[11px] text-slate-500 font-medium">
                  Allow friends or roommates to view live delivery status & courier route
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleCopyTrackingLink}
              className={`w-full sm:w-auto px-4 py-2.5 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 shrink-0 cursor-pointer shadow-xs active:scale-95 border ${
                hasCopiedLink
                  ? 'bg-emerald-600 text-white border-emerald-600'
                  : 'bg-white hover:bg-slate-50 text-slate-800 border-slate-200'
              }`}
            >
              {hasCopiedLink ? (
                <>
                  <Check className="w-4 h-4 text-white" />
                  <span>Link Copied to Clipboard!</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4 text-emerald-600" />
                  <span>Copy Tracking Link</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* SECTION 2: CUSTOMER DELIVERY PIN & VERIFICATION CODES */}
        {!isDelivered && !isCancelled && (
          <div className="bg-linear-to-r from-emerald-600 to-teal-700 text-white rounded-3xl p-5 shadow-lg space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-6 h-6 text-emerald-200" />
                <div>
                  <h3 className="text-sm font-black">Your Customer Delivery PIN</h3>
                  <p className="text-[11px] text-emerald-100">
                    Give this 4-digit code to the rider at handoff to complete delivery
                  </p>
                </div>
              </div>
              <KeyRound className="w-5 h-5 text-emerald-200 opacity-60" />
            </div>

            {/* Daily Token + PIN Grid */}
            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 grid grid-cols-3 gap-2 border border-white/20 items-center text-center">
              <div>
                <span className="text-[10px] uppercase font-bold text-emerald-200 block mb-0.5">
                  Bag Token
                </span>
                <span className="text-lg font-black font-mono text-emerald-100 block">
                  {order.daily_token || `#${order.id.slice(-4)}`}
                </span>
              </div>

              <div className="border-x border-white/20 px-2">
                <span className="text-[10px] uppercase font-bold text-emerald-200 block mb-0.5">
                  Delivery PIN
                </span>
                <span className="text-3xl font-black tracking-widest text-white block">
                  {order.delivery_code || order.pickup_code || '4829'}
                </span>
              </div>

              <div>
                <span className="text-[10px] uppercase font-bold text-emerald-200 block mb-0.5">
                  Reference
                </span>
                <span className="text-xs font-mono font-bold text-emerald-100 block">
                  {order.id.slice(-6)}
                </span>
              </div>
            </div>

            {/* Roommate / Proxy Recipient Card */}
            {order.is_proxy_order && (
              <div className="bg-emerald-800/40 rounded-2xl p-3 border border-emerald-400/30 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Gift className="w-4 h-4 text-emerald-300 shrink-0" />
                  <div>
                    <span className="text-xs font-bold text-white block">
                      Roommate Order for: {order.recipient_name || 'Friend'}
                    </span>
                    <span className="text-[11px] text-emerald-200 block">
                      Recipient Contact: {order.recipient_phone || 'N/A'}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Action buttons to share Tracking Link & Pickup Pass to Roommate */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                type="button"
                onClick={handleCopyTrackingLink}
                className="w-full py-2.5 px-4 rounded-xl bg-emerald-800/60 hover:bg-emerald-800 text-white font-extrabold text-xs transition-all flex items-center justify-center gap-2 border border-emerald-400/40 shadow-xs cursor-pointer active:scale-95"
              >
                {hasCopiedLink ? (
                  <>
                    <Check className="w-4 h-4 text-emerald-300" />
                    <span>Tracking Link Copied!</span>
                  </>
                ) : (
                  <>
                    <Link2 className="w-4 h-4 text-emerald-200" />
                    <span>Copy Tracking Link</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handleSharePickupPass}
                className="w-full py-2.5 px-4 rounded-xl bg-white text-emerald-800 font-extrabold text-xs hover:bg-emerald-50 transition-all flex items-center justify-center gap-2 shadow-xs cursor-pointer active:scale-95"
              >
                <Share2 className="w-4 h-4 text-emerald-600" />
                <span>Share Pickup Pass</span>
              </button>
            </div>

            {/* Anti-Scam Non-Repudiation Policy Notice */}
            <p className="text-[10px] text-emerald-100/80 leading-relaxed text-center">
              🔒 <strong>Non-Repudiation Policy:</strong> The 4-digit PIN is the sole authentication key for meal handoff. Forwarding this PIN authorizes your recipient to claim the order. Delivery confirmations via valid PIN are non-disputable.
            </p>
          </div>
        )}

        {/* SECTION 3: RIDER CARD (IF ASSIGNED) */}
        {order.rider_id ? (
          <div className="bg-white rounded-3xl p-5 shadow-xs border border-slate-200 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-emerald-100 flex items-center justify-center text-emerald-800 font-black text-lg">
                  <Bike className="w-6 h-6 text-emerald-600" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900">{order.rider_name || 'Emmanuel Adeyemi'}</h3>
                  <p className="text-xs text-slate-500 font-medium">
                    {order.rider_vehicle || 'Motorcycle'} • Plate: MTU-RDR-01
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={`tel:${order.rider_phone || '+2348109981234'}`}
                  className="p-3 rounded-2xl bg-slate-100 hover:bg-emerald-50 text-slate-700 hover:text-emerald-700 transition-colors"
                >
                  <Phone className="w-4 h-4" />
                </a>
                <button
                  onClick={() => setShowChat(true)}
                  className="p-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white transition-colors"
                >
                  <MessageSquare className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-amber-50/70 border border-amber-200 rounded-3xl p-4 flex items-center gap-3">
            <Clock className="w-5 h-5 text-amber-600 shrink-0" />
            <p className="text-xs font-bold text-amber-900">
              Awaiting Rider Assignment: System is dispatching the nearest campus courier once the kitchen confirms the order.
            </p>
          </div>
        )}

        {/* SECTION 4: CAMPUS DELIVERY INFORMATION SECTION */}
        <div className="bg-white rounded-3xl p-5 shadow-xs border border-slate-200 space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <Building className="w-5 h-5 text-emerald-600" />
            <div>
              <h3 className="text-sm font-extrabold text-slate-900">Customer & Delivery Information</h3>
              <p className="text-xs text-slate-500">Authoritative destination snapshot</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <span className="font-bold text-slate-400 block mb-0.5">CUSTOMER</span>
              <p className="font-extrabold text-slate-900">{order.customer_name || order.user_name || 'Student Customer'}</p>
              <p className="text-slate-600">{order.customer_phone || order.user_phone || '+234 810 000 0000'}</p>
              {order.customer_email && <p className="text-slate-500">{order.customer_email}</p>}
            </div>

            <div>
              <span className="font-bold text-slate-400 block mb-0.5">DELIVERY LOCATION</span>
              <p className="font-extrabold text-slate-900">
                {order.delivery_info?.building || 'Campus Hall'}, {order.delivery_info?.hostel_hall || 'Block B'}
              </p>
              {order.delivery_info?.room_number && (
                <p className="text-emerald-700 font-bold">Room / Office: {order.delivery_info.room_number}</p>
              )}
              <p className="text-slate-500">{order.delivery_address}</p>
            </div>
          </div>

          {order.notes && (
            <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100 text-xs">
              <span className="font-bold text-slate-600 block mb-0.5">Rider Delivery Instructions:</span>
              <p className="text-slate-800 font-medium italic">"{order.notes}"</p>
            </div>
          )}
        </div>

        {/* SECTION 5: LIVE INTERACTIVE MAP */}
        <div className="bg-white rounded-3xl p-5 shadow-xs border border-slate-200 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MapPin className="w-5 h-5 text-emerald-600" />
              <div>
                <h3 className="text-sm font-extrabold text-slate-900">Live Campus Delivery Navigation</h3>
                <p className="text-[11px] text-slate-500 font-medium">Real-time courier GPS & campus pathway</p>
              </div>
            </div>
            <span className="text-[11px] font-black px-2.5 py-1 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200">
              MTU Campus
            </span>
          </div>

          <MapPicker
            latitude={order.latitude || 6.7638}
            longitude={order.longitude || 3.3782}
            riderLat={order.rider_id ? (order.rider_current_latitude || riderLat) : undefined}
            riderLng={order.rider_id ? (order.rider_current_longitude || riderLng) : undefined}
            restaurantLat={6.7628}
            restaurantLng={3.3768}
            vendorName={order.vendor_name || 'Kitchen Stand'}
            customerName={order.customer_name || 'Your Drop-off'}
            orderStatus={order.status}
            isTrackingMode={true}
            height="260px"
          />
        </div>

        {/* SECTION 6: ORDER ITEMS & FINANCIAL BREAKDOWN */}
        <div className="bg-white rounded-3xl p-5 shadow-xs border border-slate-200 space-y-3">
          <h3 className="text-sm font-extrabold text-slate-900">Purchased Items</h3>
          <div className="divide-y divide-slate-100">
            {order.items.map((item, idx) => (
              <div key={idx} className="flex justify-between py-2 text-xs">
                <div>
                  <span className="font-bold text-slate-900">
                    {item.quantity}x {item.name}
                  </span>
                  {item.variant_name && <span className="text-slate-500 ml-1">({item.variant_name})</span>}
                </div>
                <span className="font-bold text-slate-900">
                  ₦{(item.price * item.quantity).toLocaleString()}
                </span>
              </div>
            ))}
          </div>

          <div className="border-t border-slate-100 pt-3 space-y-1.5 text-xs">
            <div className="flex justify-between text-slate-500">
              <span>Subtotal</span>
              <span>₦{order.subtotal?.toLocaleString() || order.total_price.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-slate-500">
              <span>Campus Delivery Fee</span>
              <span>₦{order.delivery_fee?.toLocaleString() || '350'}</span>
            </div>
            {order.wallet_amount_used ? (
              <div className="flex justify-between text-emerald-700 font-bold">
                <span>Paid via BUKKIT Wallet</span>
                <span>-₦{order.wallet_amount_used.toLocaleString()}</span>
              </div>
            ) : null}
            <div className="flex justify-between font-black text-sm text-slate-900 pt-2 border-t border-slate-100">
              <span>Final Total</span>
              <span className="text-emerald-700">₦{order.total_price.toLocaleString()}</span>
            </div>
          </div>

          {/* Action to View Official Receipt */}
          <div className="pt-2">
            <button
              onClick={() => setShowReceipt(true)}
              className="w-full py-3 rounded-2xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-800 text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <Receipt className="w-4 h-4 text-emerald-600" />
              <span>View Official Tax & Delivery Receipt</span>
            </button>
          </div>
        </div>
      </div>

      {/* Customer Delivery Chat Modal */}
      {showChat && order && (
        <RealtimeDeliveryChatModal
          orderId={order.id}
          orderNumber={order.order_number || order.id.slice(-6)}
          currentUserId={user?.uid || ''}
          currentUserName={user?.name || 'Customer'}
          currentUserRole="customer"
          recipientId={order.rider_id || 'rider'}
          recipientName={order.rider_name || 'Delivery Courier'}
          vendorName={order.vendor_name || 'Vendor Kitchen'}
          isOrderDelivered={order.status === 'delivered'}
          onClose={() => setShowChat(false)}
        />
      )}

      {/* Official Receipt Modal */}
      {showReceipt && (
        <OrderReceiptModal
          order={order}
          onClose={() => setShowReceipt(false)}
        />
      )}
    </div>
  );
};

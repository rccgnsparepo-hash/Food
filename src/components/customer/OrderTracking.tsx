import React, { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { Order, OrderStatus } from '../../types';
import { MapPicker } from '../ui/MapPicker';
import { CustomerChat } from './CustomerChat';
import { OrderReceiptModal } from './OrderReceiptModal';
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
  Sparkles
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

  const steps: { status: OrderStatus; label: string; desc: string }[] = [
    { status: 'pending', label: 'Order Placed', desc: 'Waiting for vendor acceptance' },
    { status: 'payment_confirmed', label: 'Payment Confirmed', desc: 'Wallet/Gateway settled' },
    { status: 'vendor_accepted', label: 'Vendor Accepted', desc: 'Kitchen acknowledged order' },
    { status: 'preparing', label: 'Preparing', desc: 'Meal is cooking in kitchen' },
    { status: 'ready_for_pickup', label: 'Ready for Pickup', desc: 'Packaged with pickup code' },
    { status: 'rider_assigned', label: 'Rider Assigned', desc: 'Courier heading to vendor' },
    { status: 'picked_up', label: 'Picked Up', desc: 'Courier collected order' },
    { status: 'out_for_delivery', label: 'Out for Delivery', desc: 'On the way to your room' },
    { status: 'arrived_at_delivery', label: 'Arrived at Hall', desc: 'Courier waiting at drop-off' },
    { status: 'delivered', label: 'Delivered', desc: 'Handoff verified successfully' }
  ];

  const getStepIndex = (status: OrderStatus) => {
    switch (status) {
      case 'pending': return 0;
      case 'payment_confirmed': return 1;
      case 'accepted':
      case 'vendor_accepted': return 2;
      case 'preparing': return 3;
      case 'ready':
      case 'ready_for_pickup': return 4;
      case 'assigned':
      case 'rider_assigned':
      case 'rider_arrived_vendor': return 5;
      case 'picked_up': return 6;
      case 'on_the_way':
      case 'out_for_delivery': return 7;
      case 'arrived_at_delivery': return 8;
      case 'delivered': return 9;
      case 'cancelled':
      case 'failed_delivery':
      case 'refunded': return -1;
      default: return 0;
    }
  };

  const currentStepIdx = getStepIndex(order.status);
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
          <button
            onClick={() => setShowReceipt(true)}
            className="p-2 rounded-xl bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors flex items-center gap-1 text-xs font-bold"
          >
            <Receipt className="w-4 h-4" />
            <span className="hidden sm:inline">Receipt</span>
          </button>
        </div>
      </div>

      <div className="max-w-3xl mx-auto p-4 sm:p-6 space-y-4">
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

          {/* Progress Bar */}
          {!isCancelled && (
            <div className="space-y-2 pt-2">
              <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                <div
                  className="bg-emerald-600 h-full rounded-full transition-all duration-700"
                  style={{ width: `${Math.max(10, Math.min(100, ((currentStepIdx + 1) / steps.length) * 100))}%` }}
                />
              </div>
              <div className="flex justify-between text-[11px] font-bold text-slate-500">
                <span>Stage {Math.max(1, currentStepIdx + 1)} of {steps.length}</span>
                <span className="text-emerald-700 font-extrabold">
                  {steps[Math.max(0, currentStepIdx)]?.label || order.status}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* SECTION 2: CUSTOMER DELIVERY PIN & VERIFICATION CODES */}
        {!isDelivered && !isCancelled && (
          <div className="bg-linear-to-r from-emerald-600 to-teal-700 text-white rounded-3xl p-5 shadow-lg space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-6 h-6 text-emerald-200" />
                <div>
                  <h3 className="text-sm font-black">Your Customer Delivery PIN</h3>
                  <p className="text-[11px] text-emerald-100">
                    Read this 4-digit code to the rider upon meal handoff to verify delivery
                  </p>
                </div>
              </div>
              <KeyRound className="w-5 h-5 text-emerald-200 opacity-60" />
            </div>

            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 flex items-center justify-around border border-white/20">
              <div className="text-center">
                <span className="text-[10px] uppercase font-bold text-emerald-200 block mb-0.5">
                  Delivery PIN Code
                </span>
                <span className="text-3xl font-black tracking-widest text-white">
                  {order.delivery_code || order.pickup_code || '4829'}
                </span>
              </div>
              <div className="h-10 w-px bg-white/20" />
              <div className="text-center">
                <span className="text-[10px] uppercase font-bold text-emerald-200 block mb-0.5">
                  Order Reference
                </span>
                <span className="text-xs font-mono font-bold text-emerald-100 block">
                  {order.id.slice(-8)}
                </span>
              </div>
            </div>
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
              <h3 className="text-sm font-extrabold text-slate-900">Live Campus Delivery Route</h3>
            </div>
            <span className="text-[11px] font-bold text-slate-500">Mountain Top University</span>
          </div>

          <MapPicker
            latitude={order.latitude || 6.783}
            longitude={order.longitude || 3.441}
            riderLat={riderLat}
            riderLng={riderLng}
            height="220px"
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

      {/* Customer Chat Drawer */}
      {showChat && (
        <CustomerChat
          orderId={order.id}
          vendorName={order.vendor_name || 'Vendor Kitchen'}
          riderName={order.rider_name || 'Rider'}
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

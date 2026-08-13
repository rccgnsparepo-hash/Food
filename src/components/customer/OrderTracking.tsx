import React, { useEffect, useState } from 'react';
import { doc, onSnapshot, updateDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { Order, OrderStatus } from '../../types';
import { MapPicker } from '../ui/MapPicker';
import { CustomerChat } from './CustomerChat';
import { ArrowLeft, Bike, Phone, MessageSquare, CheckCircle2, Clock, MapPin, Navigation, Bell, Zap, Download, FileText } from 'lucide-react';
import { useAuthStore } from '../../stores/useAuthStore';
import { requestFCMToken } from '../../lib/fcm';
import { triggerHaptic } from '../../utils/haptics';
import { toast } from 'sonner';
import { motion } from 'motion/react';
import { jsPDF } from 'jspdf';

interface OrderTrackingProps {
  orderId: string;
  onBack: () => void;
}

/**
 * Generate and download printable PDF receipt using jsPDF
 */
export function downloadOrderReceiptPDF(order: Order) {
  try {
    const doc = new jsPDF();

    // Red Brand Header Banner
    doc.setFillColor(214, 0, 28); // BUKKIT #D6001C
    doc.rect(0, 0, 210, 34, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(22);
    doc.text('BUKKIT CAMPUS FOOD', 14, 18);

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text('Official Order Receipt & Delivery Confirmation', 14, 26);

    // Order Meta Info
    doc.setTextColor(30, 41, 59);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text(`Receipt ID: #${order.id}`, 14, 44);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(`Date & Time: ${new Date(order.created_at || Date.now()).toLocaleString()}`, 14, 51);
    doc.text(`Customer Name: ${order.user_name || 'Valued Student/Customer'}`, 14, 57);
    doc.text(`Vendor: ${order.restaurant_name}`, 14, 63);
    doc.text(`Delivery Location: ${order.delivery_address || 'Campus Food Zone'}`, 14, 69);
    doc.text(`Order Status: ${order.status.toUpperCase()}`, 14, 75);

    // Separator line
    doc.setDrawColor(226, 232, 240);
    doc.line(14, 80, 196, 80);

    // Items Table Header
    doc.setFillColor(248, 250, 252);
    doc.rect(14, 84, 182, 8, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text('Item Description', 18, 89);
    doc.text('Qty', 125, 89);
    doc.text('Unit Price', 148, 89);
    doc.text('Total Price', 174, 89);

    // Items List
    let y = 98;
    order.items.forEach((item) => {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.text(item.name.substring(0, 42), 18, y);
      doc.text(`${item.quantity}`, 127, y);
      doc.text(`N${item.price.toLocaleString()}`, 148, y);
      doc.text(`N${(item.price * item.quantity).toLocaleString()}`, 174, y);
      y += 8;
    });

    // Separator line
    doc.setDrawColor(226, 232, 240);
    doc.line(14, y, 196, y);
    y += 8;

    // Totals Calculation
    const deliveryFee = order.delivery_fee || 350;
    const subtotal = Math.max(0, order.total_price - deliveryFee);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text('Subtotal:', 135, y);
    doc.text(`N${subtotal.toLocaleString()}`, 174, y);
    y += 6;

    doc.text('Campus Delivery Fee:', 135, y);
    doc.text(`N${deliveryFee.toLocaleString()}`, 174, y);
    y += 8;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(214, 0, 28);
    doc.text('Total Paid:', 135, y);
    doc.text(`N${order.total_price.toLocaleString()}`, 174, y);

    // Footer
    y += 24;
    doc.setFontSize(8);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(148, 163, 184);
    doc.text('Thank you for choosing BUKKIT Campus Food Delivery!', 14, y);
    doc.text('For support or inquiries, email support@bukkit.campus.ng', 14, y + 5);

    // Trigger save
    doc.save(`BUKKIT_Receipt_${order.id.slice(-8)}.pdf`);
    toast.success('✓ Order Receipt PDF downloaded successfully!');
  } catch (err) {
    console.error('Failed to generate PDF receipt:', err);
    toast.error('Failed to generate PDF receipt.');
  }
}

export const OrderTracking: React.FC<OrderTrackingProps> = ({ orderId, onBack }) => {
  const { user } = useAuthStore();
  const [order, setOrder] = useState<Order | null>(null);
  const [riderLat, setRiderLat] = useState(6.522);
  const [riderLng, setRiderLng] = useState(3.375);
  const [showChat, setShowChat] = useState(false);
  const [fcmEnabled, setFcmEnabled] = useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  // Real-time Firestore Order listener
  useEffect(() => {
    if (!orderId) return;

    const unsubOrder = onSnapshot(doc(db, 'orders', orderId), (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data() as Order;
        setOrder(data);
      }
    }, (err) => console.error('Order tracking snapshot error:', err));

    return () => unsubOrder();
  }, [orderId]);

  // Check initial notification permission
  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setFcmEnabled(Notification.permission === 'granted');
    }
  }, []);

  const handleEnableFcm = async () => {
    triggerHaptic(50);
    const token = await requestFCMToken(user?.uid);
    if (token) {
      setFcmEnabled(true);
    }
  };

  const handleSimulateStatusUpdate = async (nextStatus: OrderStatus) => {
    if (!order) return;
    setIsUpdatingStatus(true);
    triggerHaptic([50, 30, 50]);

    try {
      await updateDoc(doc(db, 'orders', order.id), {
        status: nextStatus,
        updated_at: new Date().toISOString()
      });
      toast.success(`Firestore Order Status updated to: ${nextStatus.toUpperCase()}`);
    } catch (err) {
      console.error('Failed to update order status in Firestore:', err);
      toast.error('Failed to update Firestore order status');
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  // Real-time rider location listener
  useEffect(() => {
    if (!order?.rider_id) return;

    const unsubLoc = onSnapshot(doc(db, 'rider_locations', order.rider_id), (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        if (data.latitude && data.longitude) {
          setRiderLat(data.latitude);
          setRiderLng(data.longitude);
        }
      }
    }, (err) => console.error('Rider location snapshot error:', err));

    return () => unsubLoc();
  }, [order?.rider_id]);

  if (!order) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="w-12 h-12 border-4 border-rose-200 border-t-[#D6001C] rounded-full animate-spin mx-auto" />
          <p className="text-sm font-bold text-slate-700">Loading order tracking...</p>
        </div>
      </div>
    );
  }

  const steps: { status: OrderStatus; label: string }[] = [
    { status: 'pending', label: 'Order Placed' },
    { status: 'accepted', label: 'Accepted' },
    { status: 'preparing', label: 'Preparing' },
    { status: 'picked_up', label: 'Picked Up' },
    { status: 'on_the_way', label: 'On The Way' },
    { status: 'delivered', label: 'Delivered' }
  ];

  const getStepIndex = (status: OrderStatus) => {
    switch (status) {
      case 'pending': return 0;
      case 'accepted': return 1;
      case 'preparing': return 2;
      case 'ready': return 3;
      case 'picked_up': return 3;
      case 'on_the_way': return 4;
      case 'delivered': return 5;
      default: return 0;
    }
  };

  const currentStep = getStepIndex(order.status);
  const progressPercent = Math.min(100, Math.max(0, (currentStep / (steps.length - 1)) * 100));

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-24">
      
      {/* Top Header with Download Receipt PDF Action */}
      <div className="bg-white rounded-3xl p-6 shadow-xs border border-rose-100 flex items-center justify-between gap-2">
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={onBack}
          className="p-2.5 rounded-2xl bg-rose-50 text-[#D6001C] hover:bg-rose-100 transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-5 h-5" />
        </motion.button>

        <div className="text-center">
          <h1 className="text-lg font-black text-slate-900">Track Order</h1>
          <p className="text-xs text-slate-400 font-mono">#{order.id}</p>
        </div>

        {/* Download Receipt PDF Button */}
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => {
            triggerHaptic(40);
            downloadOrderReceiptPDF(order);
          }}
          className="bg-slate-900 hover:bg-black text-white font-extrabold text-xs px-3.5 py-2.5 rounded-2xl transition-all shadow-md cursor-pointer flex items-center gap-1.5 shrink-0"
        >
          <Download className="w-3.5 h-3.5 text-rose-400" />
          <span className="hidden sm:inline">Download Receipt</span>
          <span className="sm:hidden">Receipt</span>
        </motion.button>
      </div>

      {/* Live Map Tracking View */}
      <div className="bg-white rounded-3xl p-6 shadow-xs border border-rose-100 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-rose-500 uppercase tracking-wider block">
              Estimated Delivery
            </span>
            <span className="text-2xl font-black text-slate-900">15 - 25 mins</span>
          </div>
          <span className="bg-emerald-500 text-white font-extrabold text-xs px-3 py-1.5 rounded-full uppercase tracking-wider">
            {order.status.replace('_', ' ')}
          </span>
        </div>

        {/* Live Rider Location Firestore Snapshot Badge */}
        <div className="bg-slate-900 text-white px-4 py-2.5 rounded-2xl flex items-center justify-between text-xs font-mono">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
            </span>
            <span className="font-bold text-slate-200">LIVE RIDER GPS:</span>
          </div>
          <div className="flex items-center gap-2 text-emerald-400 font-extrabold">
            <Navigation className="w-3.5 h-3.5 animate-pulse" />
            <span>{riderLat.toFixed(4)}° N, {riderLng.toFixed(4)}° E</span>
          </div>
        </div>

        <MapPicker
          latitude={order.latitude || 6.518}
          longitude={order.longitude || 3.372}
          riderLat={riderLat}
          riderLng={riderLng}
          restaurantLat={6.519}
          restaurantLng={3.373}
          height="320px"
          isTrackingMode={true}
        />
      </div>

      {/* FCM Order Push Notification Status Banner */}
      <div className="bg-gradient-to-r from-red-900 to-slate-900 text-white rounded-3xl p-5 shadow-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border border-red-800/40">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-[#D6001C] text-white flex items-center justify-center shrink-0 shadow-md">
            <Bell className="w-5 h-5 animate-bounce" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-black text-sm text-white">Firebase Push Notifications</h3>
              <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${fcmEnabled ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40' : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'}`}>
                {fcmEnabled ? 'ACTIVE' : 'PERMISSION NEEDED'}
              </span>
            </div>
            <p className="text-xs text-slate-300 mt-0.5">
              Receive instant FCM alerts when your meal status changes in Firestore (e.g. "Your order is being prepared").
            </p>
          </div>
        </div>

        {!fcmEnabled && (
          <button
            onClick={handleEnableFcm}
            className="bg-[#D6001C] hover:bg-red-600 text-white font-extrabold text-xs px-4 py-2.5 rounded-xl transition-all shadow-md shrink-0 cursor-pointer flex items-center gap-1.5"
          >
            <Bell className="w-3.5 h-3.5" />
            <span>Enable FCM Alerts</span>
          </button>
        )}
      </div>

      {/* Order Progress Stepper with Framer Motion Smooth Animated Bar & Firestore Status Updater */}
      <div className="bg-white rounded-3xl p-6 shadow-xs border border-rose-100 space-y-5">
        <div className="flex items-center justify-between">
          <h3 className="font-extrabold text-slate-900 text-sm">Order Status Progress</h3>
          <span className="text-[11px] font-bold text-slate-400">Real-time Firestore Sync</span>
        </div>

        {/* Framer Motion Smooth Sliding Progress Bar Line */}
        <div className="relative w-full h-3 bg-slate-100 rounded-full overflow-hidden border border-slate-200/80 shadow-inner">
          <motion.div
            className="h-full bg-gradient-to-r from-red-600 via-[#D6001C] to-emerald-500 rounded-full relative"
            initial={{ width: '0%' }}
            animate={{ width: `${progressPercent}%` }}
            transition={{ type: 'spring', stiffness: 70, damping: 15 }}
          >
            <motion.div
              className="absolute right-0 top-0 bottom-0 w-3 bg-white/50 rounded-full"
              animate={{ opacity: [0.3, 1, 0.3] }}
              transition={{ repeat: Infinity, duration: 1.2 }}
            />
          </motion.div>
        </div>

        <div className="flex items-center justify-between relative overflow-x-auto no-scrollbar pt-1 pb-1">
          {steps.map((st, idx) => {
            const isCompleted = idx <= currentStep;
            return (
              <div key={st.status} className="flex flex-col items-center shrink-0 min-w-[70px]">
                <motion.div
                  animate={{
                    scale: isCompleted ? [1, 1.2, 1] : 1,
                    boxShadow: isCompleted ? '0 10px 15px -3px rgba(214, 0, 28, 0.3)' : 'none'
                  }}
                  transition={{ duration: 0.4 }}
                  className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs transition-colors ${
                    isCompleted
                      ? 'bg-[#D6001C] text-white shadow-md'
                      : 'bg-slate-100 text-slate-400'
                  }`}
                >
                  {isCompleted ? <CheckCircle2 className="w-5 h-5" /> : idx + 1}
                </motion.div>
                <span className={`text-[10px] font-bold mt-1.5 text-center ${isCompleted ? 'text-slate-900' : 'text-slate-400'}`}>
                  {st.label}
                </span>
              </div>
            );
          })}
        </div>

        {/* Firestore Order Document Status Controller (Interactive Simulation) */}
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-black text-slate-800">
              <Zap className="w-4 h-4 text-[#D6001C]" />
              <span>Simulate Firestore Order Status Change:</span>
            </div>
            <span className="text-[10px] font-bold text-slate-500 bg-slate-200 px-2 py-0.5 rounded-md">
              Current: {order.status}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            {[
              { id: 'preparing', label: '🍳 Preparing' },
              { id: 'ready', label: '🍱 Ready' },
              { id: 'on_the_way', label: '🛵 On The Way' },
              { id: 'delivered', label: '🎉 Delivered' },
              { id: 'cancelled', label: '❌ Cancelled' }
            ].map((st) => (
              <button
                key={st.id}
                disabled={isUpdatingStatus}
                onClick={() => handleSimulateStatusUpdate(st.id as OrderStatus)}
                className={`py-2 px-2.5 rounded-xl text-[11px] font-extrabold border transition-all cursor-pointer ${
                  order.status === st.id
                    ? 'bg-[#D6001C] text-white border-[#D6001C] shadow-xs'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100 hover:border-slate-300'
                }`}
              >
                {st.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Rider Info & Direct Messaging trigger */}
      <div className="bg-white rounded-3xl p-6 shadow-xs border border-rose-100 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-rose-100 flex items-center justify-center text-[#D6001C]">
            <Bike className="w-6 h-6" />
          </div>
          <div>
            <h4 className="font-bold text-slate-900 text-sm">
              {order.rider_name || 'Michael Rider'}
            </h4>
            <p className="text-xs text-slate-400">Assigned Delivery Agent</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <a
            href="tel:+2348012345678"
            className="p-3 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-2xl transition-colors"
          >
            <Phone className="w-5 h-5" />
          </a>

          <button
            onClick={() => {
              triggerHaptic(40);
              setShowChat(true);
            }}
            className="px-4 py-3 bg-[#D6001C] hover:bg-red-700 text-white rounded-2xl font-bold text-xs flex items-center gap-2 shadow-md shadow-red-500/20 cursor-pointer"
          >
            <MessageSquare className="w-4 h-4" />
            <span>Chat Rider</span>
          </button>
        </div>
      </div>

      {/* Realtime Chat Popup */}
      {showChat && user && (
        <CustomerChat
          orderId={order.id}
          currentUserId={user.uid}
          currentUserName={user.name}
          currentUserRole="customer"
          receiverId={order.rider_id || 'rider_default_1'}
          onClose={() => setShowChat(false)}
        />
      )}

    </div>
  );
};

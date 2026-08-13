import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowLeft, MapPin, CreditCard, ShieldCheck, Truck } from 'lucide-react';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useCartStore } from '../../stores/useCartStore';
import { useAuthStore } from '../../stores/useAuthStore';
import { Order, OrderStatus } from '../../types';
import { MapPicker } from '../ui/MapPicker';
import { PaystackModal } from '../ui/PaystackModal';
import { triggerHaptic } from '../../utils/haptics';
import { toast } from 'sonner';
import { modalOverlayVariants, modalDialogVariants, staggerContainer, staggerItem } from '../../utils/motion';

interface CheckoutModalProps {
  onClose: () => void;
  onOrderCreated: (orderId: string) => void;
}

export const CheckoutModal: React.FC<CheckoutModalProps> = ({ onClose, onOrderCreated }) => {
  const { items, restaurantId, restaurantName, getSubtotal, getDeliveryFee, getServiceFee, getTotal, clearCart } = useCartStore();
  const { user } = useAuthStore();

  const [address, setAddress] = useState(user?.address || '15 Commercial Avenue, Yaba, Lagos');
  const [lat, setLat] = useState(user?.latitude || 6.518);
  const [lng, setLng] = useState(user?.longitude || 3.372);
  const [paymentMethod, setPaymentMethod] = useState<'paystack' | 'delivery'>('paystack');
  const [showPaystack, setShowPaystack] = useState(false);
  const [isPlacing, setIsPlacing] = useState(false);

  const subtotal = getSubtotal();
  const deliveryFee = getDeliveryFee();
  const serviceFee = getServiceFee();
  const total = getTotal();

  const handleCreateOrder = async (payRef: string) => {
    if (!user) return;
    setIsPlacing(true);

    const orderId = `ORD_${Date.now()}`;
    const newOrder: Order = {
      id: orderId,
      user_id: user.uid,
      user_name: user.name,
      user_phone: user.phone,
      vendor_id: restaurantId || 'rest_ronalds',
      vendor_name: restaurantName || "Ronald's Food House",
      restaurant_id: restaurantId || 'rest_ronalds',
      restaurant_name: restaurantName || "Ronald's Food House",
      items: items.map((i) => ({
        menu_item_id: i.menuItem.id,
        name: i.menuItem.name,
        price: i.menuItem.price,
        quantity: i.quantity,
        selectedOptions: i.selectedOptions
      })),
      status: 'pending' as OrderStatus,
      payment_status: payRef ? 'paid' : 'pending',
      payment_reference: payRef || 'COD',
      subtotal,
      delivery_fee: deliveryFee,
      service_fee: serviceFee,
      total_price: total,
      delivery_address: address,
      latitude: lat,
      longitude: lng,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    try {
      await setDoc(doc(db, 'orders', orderId), newOrder);
      clearCart();
      setIsPlacing(false);
      toast.success('✓ Order placed successfully!');
      onOrderCreated(orderId);
    } catch (err) {
      console.error('Failed to create order in Firestore:', err);
      setIsPlacing(false);
      toast.error('Order creation failed. Please try again.');
    }
  };

  const handleConfirmCheckout = () => {
    triggerHaptic([60, 40, 60]);
    if (paymentMethod === 'paystack') {
      setShowPaystack(true);
    } else {
      handleCreateOrder('CASH_ON_DELIVERY');
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-slate-100 overflow-y-auto flex flex-col justify-between p-4 sm:p-6"
    >
      
      {/* Top Header */}
      <div className="max-w-3xl mx-auto w-full bg-white rounded-3xl p-6 shadow-xs border border-rose-100 flex items-center justify-between mb-6">
        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={onClose}
          className="p-2 rounded-full bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-5 h-5 text-slate-700" />
        </motion.button>
        <h1 className="text-xl font-extrabold text-slate-900">Checkout</h1>
        <div className="w-9" />
      </div>

      <motion.div
        variants={staggerContainer}
        initial="initial"
        animate="animate"
        className="max-w-3xl mx-auto w-full space-y-6 flex-1"
      >
        
        {/* 1. Delivery Address Selection & Interactive Map */}
        <motion.div variants={staggerItem} className="bg-white rounded-3xl p-6 shadow-xs border border-rose-100 space-y-4">
          <div className="flex items-center gap-2">
            <MapPin className="w-5 h-5 text-[#D6001C]" />
            <h2 className="font-extrabold text-slate-900 text-base">Delivery Address</h2>
          </div>

          <MapPicker
            latitude={lat}
            longitude={lng}
            height="220px"
            onLocationSelect={(newLat, newLng, newAddr) => {
              setLat(newLat);
              setLng(newLng);
              setAddress(newAddr);
            }}
          />

          <input
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium text-slate-800 focus:ring-2 focus:ring-[#D6001C] outline-none"
            placeholder="Enter street address, building, apartment..."
          />
        </motion.div>

        {/* 2. Order Summary */}
        <motion.div variants={staggerItem} className="bg-white rounded-3xl p-6 shadow-xs border border-rose-100 space-y-3">
          <h2 className="font-extrabold text-slate-900 text-base mb-2">Order Items</h2>
          {items.map((i) => (
            <div key={i.menuItem.id} className="flex items-center justify-between text-xs py-1.5 border-b border-slate-100">
              <span className="font-semibold text-slate-800">
                {i.quantity}x {i.menuItem.name}
              </span>
              <span className="font-extrabold text-slate-900">
                ₦{(i.menuItem.price * i.quantity).toLocaleString()}
              </span>
            </div>
          ))}
        </motion.div>

        {/* 3. Payment Method */}
        <motion.div variants={staggerItem} className="bg-white rounded-3xl p-6 shadow-xs border border-rose-100 space-y-3">
          <h2 className="font-extrabold text-slate-900 text-base">Payment Method</h2>

          <div className="grid grid-cols-2 gap-3">
            <motion.button
              type="button"
              whileTap={{ scale: 0.97 }}
              onClick={() => setPaymentMethod('paystack')}
              className={`p-4 rounded-2xl border-2 text-left transition-all flex flex-col justify-between cursor-pointer ${
                paymentMethod === 'paystack'
                  ? 'border-[#D6001C] bg-rose-50/60'
                  : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <div className="flex items-center justify-between">
                <CreditCard className="w-5 h-5 text-[#D6001C]" />
                <span className="bg-emerald-500 text-white font-black text-[9px] px-1.5 py-0.5 rounded">
                  PAYSTACK
                </span>
              </div>
              <span className="font-bold text-xs text-slate-900 mt-2 block">
                Paystack / Card
              </span>
            </motion.button>

            <motion.button
              type="button"
              whileTap={{ scale: 0.97 }}
              onClick={() => setPaymentMethod('delivery')}
              className={`p-4 rounded-2xl border-2 text-left transition-all flex flex-col justify-between cursor-pointer ${
                paymentMethod === 'delivery'
                  ? 'border-[#D6001C] bg-rose-50/60'
                  : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <Truck className="w-5 h-5 text-slate-700" />
              <span className="font-bold text-xs text-slate-900 mt-2 block">
                Pay on Delivery
              </span>
            </motion.button>
          </div>
        </motion.div>

        {/* 4. Total Cost breakdown */}
        <motion.div variants={staggerItem} className="bg-slate-900 text-white rounded-3xl p-6 space-y-2 shadow-lg">
          <div className="flex justify-between text-xs text-slate-300">
            <span>Subtotal</span>
            <span>₦{subtotal.toLocaleString()}</span>
          </div>
          <div className="flex justify-between text-xs text-slate-300">
            <span>Delivery Fee</span>
            <span>₦{deliveryFee.toLocaleString()}</span>
          </div>
          <div className="flex justify-between text-xs text-slate-300">
            <span>Service Charge (5%)</span>
            <span>₦{serviceFee.toLocaleString()}</span>
          </div>
          <div className="border-t border-slate-700 pt-3 flex justify-between text-lg font-black text-white">
            <span>Total Payable</span>
            <span className="text-yellow-400">₦{total.toLocaleString()}</span>
          </div>
        </motion.div>

      </motion.div>

      {/* Pay Now Action */}
      <div className="max-w-3xl mx-auto w-full pt-6">
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.96 }}
          onClick={handleConfirmCheckout}
          disabled={isPlacing}
          className="w-full bg-[#D6001C] hover:bg-red-700 text-white font-extrabold py-4 rounded-full shadow-2xl shadow-red-500/30 text-base transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
        >
          {isPlacing ? (
            <span>Placing Order...</span>
          ) : (
            <>
              <ShieldCheck className="w-5 h-5" />
              <span>Confirm Order (₦{total.toLocaleString()})</span>
            </>
          )}
        </motion.button>
      </div>

      {/* Paystack Modal trigger */}
      {showPaystack && (
        <PaystackModal
          amount={total}
          email={user?.email || 'customer@foodapp.com'}
          orderId={`ORD_${Date.now()}`}
          onClose={() => setShowPaystack(false)}
          onSuccess={(ref) => {
            setShowPaystack(false);
            handleCreateOrder(ref);
          }}
        />
      )}

    </motion.div>
  );
};


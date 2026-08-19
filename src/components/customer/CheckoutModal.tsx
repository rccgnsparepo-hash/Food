import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ArrowLeft,
  MapPin,
  CreditCard,
  ShieldCheck,
  Truck,
  Wallet,
  AlertCircle,
  Building,
  Home,
  CheckCircle2,
  Sparkles,
  Phone,
  User,
  Info
} from 'lucide-react';
import { useCartStore } from '../../stores/useCartStore';
import { useAuthStore } from '../../stores/useAuthStore';
import {
  Order,
  PreferredDeliveryOption,
  CustomerDeliveryInfo
} from '../../types';
import { MapPicker } from '../ui/MapPicker';
import { PaystackModal } from '../ui/PaystackModal';
import { triggerHaptic } from '../../utils/haptics';
import { toast } from 'sonner';
import { staggerContainer, staggerItem } from '../../utils/motion';
import { createAuthoritativeOrder } from '../../services/orderLifecycleService';
import { subscribeToWallet } from '../../services/walletService';

interface CheckoutModalProps {
  onClose: () => void;
  onOrderCreated: (orderId: string) => void;
}

export const CheckoutModal: React.FC<CheckoutModalProps> = ({ onClose, onOrderCreated }) => {
  const { items, restaurantId, restaurantName, getSubtotal, getDeliveryFee, getServiceFee, getTotal, clearCart } =
    useCartStore();
  const { user } = useAuthStore();

  // Live Wallet Balance from Firestore
  const [walletBalance, setWalletBalance] = useState<number>(user?.wallet_balance ?? 15000);

  useEffect(() => {
    if (user?.uid) {
      const unsub = subscribeToWallet(user.uid, (wallet) => {
        if (wallet) {
          setWalletBalance(wallet.available_balance);
        }
      });
      return () => unsub();
    }
  }, [user?.uid]);

  // Customer Contact State
  const [customerName, setCustomerName] = useState(user?.name || '');
  const [customerPhone, setCustomerPhone] = useState(user?.phone || '+234 810 000 0000');
  const [customerEmail, setCustomerEmail] = useState(user?.email || '');

  // Campus Delivery Details State
  const [campus, setCampus] = useState('Mountain Top University (Main Campus)');
  const [building, setBuilding] = useState('Daniel Hall of Residence');
  const [hostelHall, setHostelHall] = useState('Block B, 2nd Floor');
  const [roomNumber, setRoomNumber] = useState('Room 214');
  const [exactLocation, setExactLocation] = useState('Near West Staircase Entrance');
  const [deliveryInstructions, setDeliveryInstructions] = useState('Please call when you arrive at the hostel gate.');
  const [preferredOption, setPreferredOption] = useState<PreferredDeliveryOption>('room_delivery');
  const [contactless, setContactless] = useState<boolean>(false);

  // Map Coordinates
  const [lat, setLat] = useState(user?.latitude || 6.783);
  const [lng, setLng] = useState(user?.longitude || 3.441);

  // Payment Selection State: 'wallet' | 'split_wallet_paystack' | 'paystack' | 'delivery'
  const [paymentMethod, setPaymentMethod] = useState<'wallet' | 'split_wallet_paystack' | 'paystack' | 'delivery'>('wallet');
  const [showPaystack, setShowPaystack] = useState(false);
  const [isPlacing, setIsPlacing] = useState(false);

  const subtotal = getSubtotal();
  const deliveryFee = getDeliveryFee();
  const serviceFee = getServiceFee();
  const total = getTotal();

  // Compute full/split calculations
  const canPayFullWallet = walletBalance >= total;
  const walletDeduction = paymentMethod === 'wallet' ? total : paymentMethod === 'split_wallet_paystack' ? Math.min(walletBalance, total) : 0;
  const remainingCardAmount = Math.max(0, total - walletDeduction);

  const handleCreateOrder = async (payRef?: string) => {
    if (!user) {
      toast.error('Please log in to place an order.');
      return;
    }

    if (!customerPhone.trim()) {
      toast.error('Please provide a valid phone number for rider delivery contact.');
      return;
    }

    setIsPlacing(true);

    try {
      const deliveryInfo: CustomerDeliveryInfo = {
        campus,
        building,
        hostel_hall: hostelHall,
        room_number: roomNumber,
        exact_location: exactLocation,
        delivery_instructions: deliveryInstructions,
        preferred_option: preferredOption,
        contactless
      };

      const createdOrder = await createAuthoritativeOrder(
        {
          userId: user.uid,
          userName: customerName || user.name || 'Student Customer',
          userPhone: customerPhone,
          userEmail: customerEmail,
          vendorId: restaurantId || 'vendor_mtu_canteen',
          vendorName: restaurantName || 'MTU Student Central Canteen',
          universityId: user.university_id || 'uni_mtu',
          campusId: user.campus_id || 'campus_mtu_main',
          items: items.map((i) => {
            const itemPrice = i.menuItem.base_price ?? i.menuItem.price ?? 0;
            const res: Record<string, any> = {
              menu_item_id: i.menuItem.id,
              name: i.menuItem.name,
              price: itemPrice,
              quantity: i.quantity
            };
            if (i.selectedOptions && Object.keys(i.selectedOptions).length > 0) {
              res.selectedOptions = i.selectedOptions;
            }
            if (i.selectedVariant?.name) {
              res.variant_name = i.selectedVariant.name;
            }
            if (i.notes) {
              res.notes = i.notes;
            }
            return res as any;
          }),
          subtotal,
          deliveryFee,
          serviceFee,
          discount: 0,
          walletAmountUsed: walletDeduction,
          otherPaymentAmount: remainingCardAmount,
          totalPrice: total,
          paymentMethod,
          paymentReference: payRef,
          deliveryInfo,
          notes: deliveryInstructions,
          latitude: lat,
          longitude: lng
        },
        user
      );

      clearCart();
      setIsPlacing(false);
      triggerHaptic([100, 50, 100]);
      toast.success(`✓ Order #${createdOrder.id.slice(-6)} placed with authoritative verification codes!`);
      onOrderCreated(createdOrder.id);
    } catch (err: any) {
      console.error('Failed to create order:', err);
      setIsPlacing(false);
      toast.error(err?.message || 'Order creation failed. Please try again.');
    }
  };

  const handleConfirmCheckout = () => {
    triggerHaptic(60);

    if (paymentMethod === 'paystack') {
      setShowPaystack(true);
    } else if (paymentMethod === 'split_wallet_paystack') {
      if (remainingCardAmount > 0) {
        setShowPaystack(true);
      } else {
        handleCreateOrder(`SPLIT_FULL_WALLET_${Date.now()}`);
      }
    } else if (paymentMethod === 'wallet') {
      if (walletBalance < total) {
        toast.error(`Wallet balance (₦${walletBalance.toLocaleString()}) is less than total (₦${total.toLocaleString()}). Select Split Payment or Paystack.`);
        return;
      }
      handleCreateOrder(`WALLET_${Date.now()}`);
    } else {
      handleCreateOrder('CASH_ON_DELIVERY');
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs overflow-y-auto flex flex-col justify-between p-3 sm:p-6"
    >
      {/* Top Bar */}
      <div className="max-w-3xl mx-auto w-full bg-white rounded-3xl p-5 shadow-lg border border-emerald-100 flex items-center justify-between mb-4">
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={onClose}
          className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </motion.button>
        <div className="text-center">
          <h1 className="text-lg font-black text-slate-900">Checkout & Delivery Setup</h1>
          <p className="text-xs text-emerald-700 font-medium">{restaurantName || 'MTU Campus Food'}</p>
        </div>
        <div className="w-9" />
      </div>

      <motion.div
        variants={staggerContainer}
        initial="initial"
        animate="animate"
        className="max-w-3xl mx-auto w-full space-y-4 flex-1 pb-6"
      >
        {/* SECTION 1: CUSTOMER CONTACT INFORMATION */}
        <motion.div variants={staggerItem} className="bg-white rounded-3xl p-5 shadow-xs border border-slate-200 space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <User className="w-5 h-5 text-emerald-600" />
            <div>
              <h2 className="font-extrabold text-slate-900 text-sm">Customer Contact Information</h2>
              <p className="text-xs text-slate-500">For rider communications and arrival alerts</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">Full Name</label>
              <input
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="e.g. Oluwaseun Adeleke"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-medium text-slate-900 focus:ring-2 focus:ring-emerald-600 outline-none"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">Phone Number (Required for Rider)</label>
              <input
                type="tel"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                placeholder="e.g. +234 810 123 4567"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-medium text-slate-900 focus:ring-2 focus:ring-emerald-600 outline-none"
              />
            </div>
          </div>
        </motion.div>

        {/* SECTION 2: CAMPUS FOOD DELIVERY INFORMATION */}
        <motion.div variants={staggerItem} className="bg-white rounded-3xl p-5 shadow-xs border border-slate-200 space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <Building className="w-5 h-5 text-emerald-600" />
            <div>
              <h2 className="font-extrabold text-slate-900 text-sm">Campus Food Delivery Location</h2>
              <p className="text-xs text-slate-500">Exact campus building, hostel, room, and drop-off guidance</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">Campus / Institution</label>
              <input
                type="text"
                value={campus}
                onChange={(e) => setCampus(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-medium text-slate-900 focus:ring-2 focus:ring-emerald-600 outline-none"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">Building / Department / Faculty</label>
              <input
                type="text"
                value={building}
                onChange={(e) => setBuilding(e.target.value)}
                placeholder="e.g. Daniel Hall / CBAS Complex"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-medium text-slate-900 focus:ring-2 focus:ring-emerald-600 outline-none"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">Hostel / Hall / Wing</label>
              <input
                type="text"
                value={hostelHall}
                onChange={(e) => setHostelHall(e.target.value)}
                placeholder="e.g. Block B, 2nd Floor"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-medium text-slate-900 focus:ring-2 focus:ring-emerald-600 outline-none"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">Room / Office Number</label>
              <input
                type="text"
                value={roomNumber}
                onChange={(e) => setRoomNumber(e.target.value)}
                placeholder="e.g. Room 214 / Office G12"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-medium text-slate-900 focus:ring-2 focus:ring-emerald-600 outline-none"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">Exact Landmark / Meeting Point</label>
            <input
              type="text"
              value={exactLocation}
              onChange={(e) => setExactLocation(e.target.value)}
              placeholder="e.g. In front of Daniel Hall Porter's Lodge or Cafeteria Stairs"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-medium text-slate-900 focus:ring-2 focus:ring-emerald-600 outline-none"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">Delivery Instructions for Rider</label>
            <textarea
              rows={2}
              value={deliveryInstructions}
              onChange={(e) => setDeliveryInstructions(e.target.value)}
              placeholder="e.g. Please ring phone on arrival. Don't honk at the gate."
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-900 focus:ring-2 focus:ring-emerald-600 outline-none resize-none"
            />
          </div>

          {/* Delivery Option Selector */}
          <div>
            <label className="text-xs font-bold text-slate-700 block mb-2">Preferred Delivery Option</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {[
                { id: 'room_delivery', label: 'Room Delivery', desc: 'Direct to door' },
                { id: 'hostel_gate_dropoff', label: 'Hostel Gate', desc: 'Pickup at gate' },
                { id: 'department_foyer', label: 'Faculty Foyer', desc: 'Class / Department' }
              ].map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setPreferredOption(opt.id as PreferredDeliveryOption)}
                  className={`p-2.5 rounded-xl border text-left transition-all ${
                    preferredOption === opt.id
                      ? 'border-emerald-600 bg-emerald-50 text-emerald-900 font-bold'
                      : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300'
                  }`}
                >
                  <p className="text-xs font-extrabold">{opt.label}</p>
                  <p className="text-[10px] text-slate-500">{opt.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Contactless Toggle */}
          <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 border border-slate-200">
            <div>
              <span className="text-xs font-bold text-slate-900 block">Contactless Drop-off</span>
              <span className="text-[11px] text-slate-500">Rider leaves meal securely at designated spot</span>
            </div>
            <input
              type="checkbox"
              checked={contactless}
              onChange={(e) => setContactless(e.target.checked)}
              className="w-5 h-5 accent-emerald-600 cursor-pointer rounded"
            />
          </div>

          {/* Map Pin Locator */}
          <div className="pt-2">
            <div className="flex items-center gap-1.5 mb-2">
              <MapPin className="w-4 h-4 text-emerald-600" />
              <span className="text-xs font-bold text-slate-700">Campus GPS Pin Position</span>
            </div>
            <MapPicker
              latitude={lat}
              longitude={lng}
              height="180px"
              onLocationSelect={(newLat, newLng) => {
                setLat(newLat);
                setLng(newLng);
              }}
            />
          </div>
        </motion.div>

        {/* SECTION 3: ORDER ITEMS SNAPSHOT */}
        <motion.div variants={staggerItem} className="bg-white rounded-3xl p-5 shadow-xs border border-slate-200 space-y-3">
          <h2 className="font-extrabold text-slate-900 text-sm">Order Items Summary</h2>
          <div className="divide-y divide-slate-100">
            {items.map((i) => (
              <div key={i.menuItem.id} className="flex items-center justify-between py-2 text-xs">
                <div>
                  <span className="font-bold text-slate-900">
                    {i.quantity}x {i.menuItem.name}
                  </span>
                  {i.selectedVariant?.name && (
                    <span className="text-[10px] text-slate-500 ml-1">({i.selectedVariant.name})</span>
                  )}
                </div>
                <span className="font-black text-slate-900">
                  ₦{((i.menuItem.base_price ?? i.menuItem.price ?? 0) * i.quantity).toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </motion.div>

        {/* SECTION 4: PAYMENT SELECTION (WALLET / SPLIT / PAYSTACK) */}
        <motion.div variants={staggerItem} className="bg-white rounded-3xl p-5 shadow-xs border border-slate-200 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-extrabold text-slate-900 text-sm">Authoritative Payment Method</h2>
            <div className="flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
              <Wallet className="w-3.5 h-3.5" />
              <span>Wallet: ₦{walletBalance.toLocaleString()}</span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* 1. BUKKIT Full Wallet */}
            <button
              type="button"
              onClick={() => setPaymentMethod('wallet')}
              className={`p-3.5 rounded-2xl border-2 text-left transition-all flex flex-col justify-between ${
                paymentMethod === 'wallet'
                  ? 'border-emerald-600 bg-emerald-50/70 shadow-xs'
                  : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <div className="flex items-center justify-between w-full">
                <Wallet className="w-5 h-5 text-emerald-600" />
                <span className="bg-emerald-600 text-white font-black text-[9px] px-1.5 py-0.5 rounded">
                  BUKKIT WALLET
                </span>
              </div>
              <div className="mt-3">
                <span className="font-extrabold text-xs text-slate-900 block">100% In-App Wallet</span>
                <span className="text-[10px] text-slate-500 block">
                  {canPayFullWallet ? 'Instant 1-Click Debit' : 'Insufficient Balance'}
                </span>
              </div>
            </button>

            {/* 2. Split Payment (Wallet + Card) */}
            <button
              type="button"
              onClick={() => setPaymentMethod('split_wallet_paystack')}
              className={`p-3.5 rounded-2xl border-2 text-left transition-all flex flex-col justify-between ${
                paymentMethod === 'split_wallet_paystack'
                  ? 'border-emerald-600 bg-emerald-50/70 shadow-xs'
                  : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <div className="flex items-center justify-between w-full">
                <Sparkles className="w-5 h-5 text-amber-500" />
                <span className="bg-amber-500 text-white font-black text-[9px] px-1.5 py-0.5 rounded">
                  SPLIT PAYMENT
                </span>
              </div>
              <div className="mt-3">
                <span className="font-extrabold text-xs text-slate-900 block">Wallet + Card</span>
                <span className="text-[10px] text-slate-500 block">Use wallet & pay balance</span>
              </div>
            </button>

            {/* 3. Paystack Online Card / Transfer */}
            <button
              type="button"
              onClick={() => setPaymentMethod('paystack')}
              className={`p-3.5 rounded-2xl border-2 text-left transition-all flex flex-col justify-between ${
                paymentMethod === 'paystack'
                  ? 'border-emerald-600 bg-emerald-50/70 shadow-xs'
                  : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <div className="flex items-center justify-between w-full">
                <CreditCard className="w-5 h-5 text-emerald-600" />
                <span className="bg-emerald-600 text-white font-black text-[9px] px-1.5 py-0.5 rounded">
                  PAYSTACK
                </span>
              </div>
              <div className="mt-3">
                <span className="font-extrabold text-xs text-slate-900 block">Direct Card / Bank</span>
                <span className="text-[10px] text-slate-500 block">Instant secure gateway</span>
              </div>
            </button>
          </div>

          {/* Breakdown if split payment */}
          {paymentMethod === 'split_wallet_paystack' && (
            <div className="p-3 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-900 space-y-1">
              <div className="flex justify-between font-bold">
                <span>Deduct from Wallet:</span>
                <span>₦{walletDeduction.toLocaleString()}</span>
              </div>
              <div className="flex justify-between font-bold">
                <span>Balance to Pay via Paystack:</span>
                <span className="text-amber-800 font-black">₦{remainingCardAmount.toLocaleString()}</span>
              </div>
            </div>
          )}
        </motion.div>

        {/* SECTION 5: FINANCIAL TOTALS */}
        <motion.div variants={staggerItem} className="bg-slate-900 text-white rounded-3xl p-5 space-y-2 shadow-xl">
          <div className="flex justify-between text-xs text-slate-300">
            <span>Meal Subtotal</span>
            <span>₦{subtotal.toLocaleString()}</span>
          </div>
          <div className="flex justify-between text-xs text-slate-300">
            <span>Campus Delivery Fee</span>
            <span>₦{deliveryFee.toLocaleString()}</span>
          </div>
          <div className="flex justify-between text-xs text-slate-300">
            <span>Platform Service Fee</span>
            <span>₦{serviceFee.toLocaleString()}</span>
          </div>
          <div className="border-t border-slate-800 pt-2.5 flex justify-between items-baseline">
            <div>
              <span className="text-base font-black text-white block">Final Total</span>
              <span className="text-[10px] text-slate-400">Includes secure QR/PIN verification codes</span>
            </div>
            <span className="text-xl font-black text-emerald-400">₦{total.toLocaleString()}</span>
          </div>
        </motion.div>
      </motion.div>

      {/* Action Footer */}
      <div className="max-w-3xl mx-auto w-full pt-2">
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={handleConfirmCheckout}
          disabled={isPlacing}
          className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold py-4 rounded-2xl shadow-xl shadow-emerald-600/30 text-base transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
        >
          {isPlacing ? (
            <span>Authorizing Order...</span>
          ) : (
            <>
              <ShieldCheck className="w-5 h-5" />
              <span>Place Order (₦{total.toLocaleString()})</span>
            </>
          )}
        </motion.button>
      </div>

      {/* Paystack Online Payment Modal */}
      {showPaystack && (
        <PaystackModal
          amount={paymentMethod === 'split_wallet_paystack' ? remainingCardAmount : total}
          email={customerEmail || user?.email || 'student@mtu.edu.ng'}
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

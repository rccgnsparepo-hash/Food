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
  CustomerDeliveryInfo,
  CampusLocation
} from '../../types';
import { MapPicker } from '../ui/MapPicker';
import { PaystackModal } from '../ui/PaystackModal';
import { triggerHaptic, triggerHapticSuccess, triggerHapticError } from '../../utils/haptics';
import { toast } from 'sonner';
import { staggerContainer, staggerItem } from '../../utils/motion';
import { createAuthoritativeOrder } from '../../services/orderLifecycleService';
import { subscribeToWallet } from '../../services/walletService';
import { calculateDeliveryFee } from '../../services/deliveryFeeService';
import { DEFAULT_MTU_CAMPUS_LOCATIONS, DEFAULT_MTU_BOUNDARY, isWithinCampusBoundary } from '../../services/campusLocationService';
import { BukkitLogo } from '../common/BukkitLogo';

interface CheckoutModalProps {
  onClose: () => void;
  onOrderCreated: (orderId: string) => void;
}

export const CheckoutModal: React.FC<CheckoutModalProps> = ({ onClose, onOrderCreated }) => {
  const { items, restaurantId, restaurantName, getSubtotal, getDeliveryFee, getServiceFee, getTotal, clearCart, setDeliveryFee } =
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

  // Map Coordinates (Defaults to Mountain Top University Central Campus)
  const [lat, setLat] = useState(user?.latitude || 6.7638);
  const [lng, setLng] = useState(user?.longitude || 3.3782);
  const [detectedZoneInfo, setDetectedZoneInfo] = useState<string>('Zone B — Hostels (10-15 min)');

  // Authoritative Delivery Fee Breakdown
  useEffect(() => {
    const breakdown = calculateDeliveryFee({
      customerLat: lat,
      customerLng: lng,
      vendorLat: 6.7628,
      vendorLng: 3.3768,
      preferredOption
    });
    useCartStore.getState().setDeliveryFee(breakdown.totalDeliveryFee);
    setDetectedZoneInfo(`${breakdown.zoneName} • ${breakdown.distanceKm} km • ${breakdown.estimatedDeliveryTime}`);
  }, [lat, lng, preferredOption]);

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
      triggerHapticSuccess();
      toast.success(`✓ Order #${createdOrder.id.slice(-6)} placed with authoritative verification codes!`);
      onOrderCreated(createdOrder.id);
    } catch (err: any) {
      console.error('Failed to create order:', err);
      setIsPlacing(false);
      triggerHapticError();
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
      <div className="max-w-3xl mx-auto w-full bg-white dark:bg-slate-900 rounded-3xl p-5 shadow-lg border border-emerald-100 dark:border-slate-800 flex items-center justify-between mb-4">
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={onClose}
          className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-5 h-5" />
        </motion.button>
        <div className="text-center">
          <h1 className="text-lg font-black text-slate-900 dark:text-slate-100">Checkout & Delivery Setup</h1>
          <p className="text-xs text-emerald-700 dark:text-emerald-400 font-medium">{restaurantName || 'MTU Campus Food'}</p>
        </div>
        <BukkitLogo variant="icon" size="sm" />
      </div>

      <motion.div
        variants={staggerContainer}
        initial="initial"
        animate="animate"
        className="max-w-3xl mx-auto w-full space-y-4 flex-1 pb-6"
      >
        {/* SECTION 1: CUSTOMER CONTACT INFORMATION */}
        <motion.div variants={staggerItem} className="bg-white dark:bg-slate-900 rounded-3xl p-5 shadow-xs border border-slate-200 dark:border-slate-800 space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
            <User className="w-5 h-5 text-emerald-600" />
            <div>
              <h2 className="font-extrabold text-slate-900 dark:text-slate-100 text-sm">Customer Contact Information</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">For rider communications and arrival alerts</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">Full Name</label>
              <input
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="e.g. Oluwaseun Adeleke"
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-xs font-medium text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-emerald-600 outline-none"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">Phone Number (Required for Rider)</label>
              <input
                type="tel"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                placeholder="e.g. +234 810 123 4567"
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-xs font-medium text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-emerald-600 outline-none"
              />
            </div>
          </div>
        </motion.div>

        {/* SECTION 2: CAMPUS FOOD DELIVERY INFORMATION */}
        <motion.div variants={staggerItem} className="bg-white dark:bg-slate-900 rounded-3xl p-5 shadow-xs border border-slate-200 dark:border-slate-800 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <Building className="w-5 h-5 text-emerald-600" />
              <div>
                <h2 className="font-extrabold text-slate-900 dark:text-slate-100 text-sm">Campus Food Delivery Location</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">Live GPS pin, campus hall, room number & drop-off guidance</p>
              </div>
            </div>
            <span className="text-[11px] font-black bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 px-2.5 py-1 rounded-xl border border-emerald-200 dark:border-emerald-900/50">
              {detectedZoneInfo.split('•')[0] || 'Zone A'}
            </span>
          </div>

          {/* Quick Select Campus Locations */}
          <div>
            <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1.5">
              ⚡ Quick Select Campus Landmark / Hostel
            </label>
            <div className="flex flex-wrap gap-1.5">
              {DEFAULT_MTU_CAMPUS_LOCATIONS.slice(0, 8).map((loc) => (
                <button
                  key={loc.id}
                  type="button"
                  onClick={() => {
                    triggerHaptic(20);
                    setLat(loc.latitude);
                    setLng(loc.longitude);
                    setBuilding(loc.name);
                    if (loc.type === 'hostel') {
                      setHostelHall(loc.name.split('(')[0].trim());
                      setExactLocation(`Porter's Lodge Entrance (${loc.building_code || ''})`);
                    } else {
                      setExactLocation(`Main Reception / Ground Foyer (${loc.building_code || ''})`);
                    }
                    toast.success(`Selected: ${loc.name}`);
                  }}
                  className={`text-xs font-semibold px-2.5 py-1.5 rounded-xl border transition-all cursor-pointer ${
                    Math.abs(lat - loc.latitude) < 0.0003 && Math.abs(lng - loc.longitude) < 0.0003
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                      : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'
                  }`}
                >
                  {loc.name.split('(')[0].trim()}
                </button>
              ))}
            </div>
          </div>

          {/* Interactive Campus Map Picker */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-emerald-600" />
                Live Campus GPS Pin & Drop-off Spot
              </span>
              <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                Tap map, drag pin or click GPS button
              </span>
            </div>
            <MapPicker
              latitude={lat}
              longitude={lng}
              height="220px"
              onLocationSelect={(newLat, newLng, address) => {
                setLat(newLat);
                setLng(newLng);
              }}
              onCampusLocationPick={(loc) => {
                setLat(loc.latitude);
                setLng(loc.longitude);
                setBuilding(loc.name);
                if (loc.type === 'hostel') {
                  setHostelHall(loc.name.split('(')[0].trim());
                  setExactLocation(`Porter's Lodge Entrance (${loc.building_code || ''})`);
                } else {
                  setExactLocation(`Main Foyer / Ground Floor (${loc.building_code || ''})`);
                }
              }}
            />
          </div>

          {/* Delivery Zone & Fee Summary Pill */}
          <div className="bg-emerald-50/80 dark:bg-emerald-950/40 border border-emerald-200/80 dark:border-emerald-900/50 rounded-2xl p-3 flex items-center justify-between text-xs text-emerald-950 dark:text-emerald-200">
            <div className="space-y-0.5">
              <p className="font-extrabold flex items-center gap-1.5">
                <Truck className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400" />
                {detectedZoneInfo}
              </p>
              <p className="text-[10px] text-emerald-700 dark:text-emerald-400 font-medium">
                Calculated authoritatively from kitchen coordinates to your campus drop-off
              </p>
            </div>
            <div className="text-right shrink-0">
              <span className="text-xs text-emerald-700 dark:text-emerald-400 font-bold block">Delivery Fee</span>
              <span className="text-sm font-black text-emerald-950 dark:text-emerald-100">₦{deliveryFee.toLocaleString()}</span>
            </div>
          </div>

          {/* Detailed Address Inputs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">Campus / Institution</label>
              <input
                type="text"
                value={campus}
                onChange={(e) => setCampus(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-xs font-medium text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-emerald-600 outline-none"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">Building / Department / Faculty</label>
              <input
                type="text"
                value={building}
                onChange={(e) => setBuilding(e.target.value)}
                placeholder="e.g. Daniel Hall / CBAS Complex"
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-xs font-medium text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-emerald-600 outline-none"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">Hostel / Hall / Wing</label>
              <input
                type="text"
                value={hostelHall}
                onChange={(e) => setHostelHall(e.target.value)}
                placeholder="e.g. Block B, 2nd Floor"
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-xs font-medium text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-emerald-600 outline-none"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">Room / Office Number</label>
              <input
                type="text"
                value={roomNumber}
                onChange={(e) => setRoomNumber(e.target.value)}
                placeholder="e.g. Room 214 / Office G12"
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-xs font-medium text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-emerald-600 outline-none"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">Exact Landmark / Meeting Point</label>
            <input
              type="text"
              value={exactLocation}
              onChange={(e) => setExactLocation(e.target.value)}
              placeholder="e.g. In front of Daniel Hall Porter's Lodge or Cafeteria Stairs"
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-xs font-medium text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-emerald-600 outline-none"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">Delivery Instructions for Courier</label>
            <textarea
              rows={2}
              value={deliveryInstructions}
              onChange={(e) => setDeliveryInstructions(e.target.value)}
              placeholder="e.g. Please call when you reach the gate. Meet me at the ground floor foyer."
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-medium text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-emerald-600 outline-none resize-none"
            />
          </div>

          {/* Delivery Option Selector */}
          <div>
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-2">Preferred Delivery Option</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {[
                { id: 'room_delivery', label: 'Room Delivery', desc: 'Direct to room door' },
                { id: 'hostel_gate_dropoff', label: 'Hostel Gate', desc: 'Pickup at porters/gate' },
                { id: 'department_foyer', label: 'Faculty Foyer', desc: 'Ground floor lounge' }
              ].map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setPreferredOption(opt.id as PreferredDeliveryOption)}
                  className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                    preferredOption === opt.id
                      ? 'border-emerald-600 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-900 dark:text-emerald-200 font-bold'
                      : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-600'
                  }`}
                >
                  <p className="text-xs font-extrabold">{opt.label}</p>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400">{opt.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Contactless Toggle */}
          <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
            <div>
              <span className="text-xs font-bold text-slate-900 dark:text-slate-100 block">Contactless Drop-off</span>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">Rider leaves meal securely at designated spot</span>
            </div>
            <input
              type="checkbox"
              checked={contactless}
              onChange={(e) => setContactless(e.target.checked)}
              className="w-5 h-5 accent-emerald-600 cursor-pointer rounded"
            />
          </div>
        </motion.div>

        {/* SECTION 3: ORDER ITEMS SNAPSHOT */}
        <motion.div variants={staggerItem} className="bg-white dark:bg-slate-900 rounded-3xl p-5 shadow-xs border border-slate-200 dark:border-slate-800 space-y-3">
          <h2 className="font-extrabold text-slate-900 dark:text-slate-100 text-sm">Order Items Summary</h2>
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {items.map((i) => (
              <div key={i.menuItem.id} className="flex items-center justify-between py-2 text-xs">
                <div>
                  <span className="font-bold text-slate-900 dark:text-slate-100">
                    {i.quantity}x {i.menuItem.name}
                  </span>
                  {i.selectedVariant?.name && (
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 ml-1">({i.selectedVariant.name})</span>
                  )}
                </div>
                <span className="font-black text-slate-900 dark:text-slate-100">
                  ₦{((i.menuItem.base_price ?? i.menuItem.price ?? 0) * i.quantity).toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </motion.div>

        {/* SECTION 4: PAYMENT SELECTION (WALLET / SPLIT / PAYSTACK) */}
        <motion.div variants={staggerItem} className="bg-white dark:bg-slate-900 rounded-3xl p-5 shadow-xs border border-slate-200 dark:border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-extrabold text-slate-900 dark:text-slate-100 text-sm">Authoritative Payment Method</h2>
            <div className="flex items-center gap-1 text-[11px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-full">
              <Wallet className="w-3.5 h-3.5" />
              <span>Wallet: ₦{walletBalance.toLocaleString()}</span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* 1. BUKKIT Full Wallet */}
            <button
              type="button"
              onClick={() => setPaymentMethod('wallet')}
              className={`p-3.5 rounded-2xl border-2 text-left transition-all flex flex-col justify-between cursor-pointer ${
                paymentMethod === 'wallet'
                  ? 'border-emerald-600 bg-emerald-50/70 dark:bg-emerald-950/50 shadow-xs'
                  : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-slate-300 dark:hover:border-slate-600'
              }`}
            >
              <div className="flex items-center justify-between w-full">
                <Wallet className="w-5 h-5 text-emerald-600" />
                <span className="bg-emerald-600 text-white font-black text-[9px] px-1.5 py-0.5 rounded">
                  BUKKIT WALLET
                </span>
              </div>
              <div className="mt-3">
                <span className="font-extrabold text-xs text-slate-900 dark:text-slate-100 block">100% In-App Wallet</span>
                <span className="text-[10px] text-slate-500 dark:text-slate-400 block">
                  {canPayFullWallet ? 'Instant 1-Click Debit' : 'Insufficient Balance'}
                </span>
              </div>
            </button>

            {/* 2. Split Payment (Wallet + Card) */}
            <button
              type="button"
              onClick={() => setPaymentMethod('split_wallet_paystack')}
              className={`p-3.5 rounded-2xl border-2 text-left transition-all flex flex-col justify-between cursor-pointer ${
                paymentMethod === 'split_wallet_paystack'
                  ? 'border-emerald-600 bg-emerald-50/70 dark:bg-emerald-950/50 shadow-xs'
                  : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-slate-300 dark:hover:border-slate-600'
              }`}
            >
              <div className="flex items-center justify-between w-full">
                <Sparkles className="w-5 h-5 text-amber-500" />
                <span className="bg-amber-500 text-white font-black text-[9px] px-1.5 py-0.5 rounded">
                  SPLIT PAYMENT
                </span>
              </div>
              <div className="mt-3">
                <span className="font-extrabold text-xs text-slate-900 dark:text-slate-100 block">Wallet + Card</span>
                <span className="text-[10px] text-slate-500 dark:text-slate-400 block">Use wallet & pay balance</span>
              </div>
            </button>

            {/* 3. Paystack Online Card / Transfer */}
            <button
              type="button"
              onClick={() => setPaymentMethod('paystack')}
              className={`p-3.5 rounded-2xl border-2 text-left transition-all flex flex-col justify-between cursor-pointer ${
                paymentMethod === 'paystack'
                  ? 'border-emerald-600 bg-emerald-50/70 dark:bg-emerald-950/50 shadow-xs'
                  : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-slate-300 dark:hover:border-slate-600'
              }`}
            >
              <div className="flex items-center justify-between w-full">
                <CreditCard className="w-5 h-5 text-emerald-600" />
                <span className="bg-emerald-600 text-white font-black text-[9px] px-1.5 py-0.5 rounded">
                  PAYSTACK
                </span>
              </div>
              <div className="mt-3">
                <span className="font-extrabold text-xs text-slate-900 dark:text-slate-100 block">Direct Card / Bank</span>
                <span className="text-[10px] text-slate-500 dark:text-slate-400 block">Instant secure gateway</span>
              </div>
            </button>
          </div>

          {/* Breakdown if split payment */}
          {paymentMethod === 'split_wallet_paystack' && (
            <div className="p-3 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/50 text-xs text-amber-900 dark:text-amber-300 space-y-1">
              <div className="flex justify-between font-bold">
                <span>Deduct from Wallet:</span>
                <span>₦{walletDeduction.toLocaleString()}</span>
              </div>
              <div className="flex justify-between font-bold">
                <span>Balance to Pay via Paystack:</span>
                <span className="text-amber-800 dark:text-amber-300 font-black">₦{remainingCardAmount.toLocaleString()}</span>
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
          <div className="border-t border-slate-800 pt-2.5 flex justify-between items-baseline">
            <div>
              <span className="text-base font-black text-white block">Final Total</span>
              <span className="text-[10px] text-slate-400">Includes secure delivery verification codes</span>
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
          foodSubtotal={subtotal}
          deliveryFee={deliveryFee || 350}
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

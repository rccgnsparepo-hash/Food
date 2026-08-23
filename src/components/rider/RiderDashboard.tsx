import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Bike,
  MapPin,
  CheckCircle2,
  MessageSquare,
  ShieldAlert,
  ShieldCheck,
  KeyRound,
  Phone,
  Building,
  DollarSign,
  TrendingUp,
  Clock,
  Sparkles,
  User,
  AlertCircle
} from 'lucide-react';
import { collection, query, where, onSnapshot, doc, updateDoc, setDoc, orderBy } from "../../lib/embeddedDb";
import { db } from '../../lib/firebase';
import { Order, OrderStatus, DeliveryEarning, RiderProfile } from '../../types';
import { useAuthStore } from '../../stores/useAuthStore';
import { MapPicker } from '../ui/MapPicker';
import { RealtimeDeliveryChatModal } from '../common/RealtimeDeliveryChatModal';
import { triggerHaptic } from '../../utils/haptics';
import { toast } from 'sonner';
import { staggerContainer, staggerItem } from '../../utils/motion';
import { BukkitLogo, BukkitIcon } from '../common/BukkitLogo';
import {
  getOrCreateRiderProfile,
  updateRiderAvailability,
  verifyOrderPickup,
  verifyOrderDelivery,
  subscribeToRiderEarnings,
  updateRiderLiveLocation
} from '../../services/riderService';
import { transitionOrderStatus, claimOrderForDelivery } from '../../services/orderLifecycleService';

export const RiderDashboard: React.FC = () => {
  const { user } = useAuthStore();
  const [riderProfile, setRiderProfile] = useState<RiderProfile | null>(null);
  const [availableOrders, setAvailableOrders] = useState<Order[]>([]);
  const [myActiveOrder, setMyActiveOrder] = useState<Order | null>(null);
  const [completedOrders, setCompletedOrders] = useState<Order[]>([]);
  const [earningsLedger, setEarningsLedger] = useState<DeliveryEarning[]>([]);

  // MTU Campus Coordinates Default
  const [riderLat, setRiderLat] = useState(6.7635);
  const [riderLng, setRiderLng] = useState(3.3780);
  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null);
  const [showChat, setShowChat] = useState(false);
  const [isOnline, setIsOnline] = useState(true);

  // Continuous GPS watch for online couriers
  useEffect(() => {
    if (!user?.uid || !isOnline) return;

    if ('geolocation' in navigator) {
      let lastSyncTime = 0;

      const watchId = navigator.geolocation.watchPosition(
        (pos) => {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          const accuracy = Math.round(pos.coords.accuracy);

          setRiderLat(lat);
          setRiderLng(lng);
          setGpsAccuracy(accuracy);

          const now = Date.now();
          // Throttle updates to Firestore every 6 seconds to optimize battery and bandwidth
          if (now - lastSyncTime > 6000) {
            lastSyncTime = now;
            updateRiderLiveLocation(user.uid, lat, lng, myActiveOrder?.id || null);
          }
        },
        (err) => {
          console.warn('Rider GPS watch notice:', err.message);
        },
        {
          enableHighAccuracy: true,
          maximumAge: 10000,
          timeout: 15000
        }
      );

      return () => {
        navigator.geolocation.clearWatch(watchId);
      };
    }
  }, [user?.uid, isOnline, myActiveOrder?.id]);

  // Verification PIN dialogs state
  const [pickupModalOpen, setPickupModalOpen] = useState(false);
  const [pickupCodeInput, setPickupCodeInput] = useState('');
  const [isVerifyingPickup, setIsVerifyingPickup] = useState(false);

  const [deliveryModalOpen, setDeliveryModalOpen] = useState(false);
  const [deliveryCodeInput, setDeliveryCodeInput] = useState('');
  const [isVerifyingDelivery, setIsVerifyingDelivery] = useState(false);

  // Initialize or fetch authoritative Rider Profile
  useEffect(() => {
    if (!user?.uid) return;
    getOrCreateRiderProfile(user).then((profile) => {
      setRiderProfile(profile);
      setIsOnline(profile.is_online);
    });

    const unsubEarnings = subscribeToRiderEarnings(user.uid, setEarningsLedger);
    return () => unsubEarnings();
  }, [user?.uid]);

  // Real-time Firestore sync for available & active orders
  useEffect(() => {
    if (!user?.uid) return;

    // Available orders query
    const qAvail = query(
      collection(db, 'orders'),
      where('status', 'in', ['ready', 'ready_for_pickup', 'accepted', 'vendor_accepted', 'preparing'])
    );
    const unsubAvail = onSnapshot(
      qAvail,
      (snapshot) => {
        const list: Order[] = [];
        snapshot.forEach((docSnap) => {
          const ord = docSnap.data() as Order;
          // Orders not yet assigned to any rider, or assigned to this rider
          if (!ord.rider_id || ord.rider_id === '') {
            list.push(ord);
          }
        });
        setAvailableOrders(list);
      },
      (err) => console.error('Available orders snapshot error:', err)
    );

    // Active order assigned to current rider
    const qMy = query(collection(db, 'orders'), where('rider_id', '==', user.uid));
    const unsubMy = onSnapshot(
      qMy,
      (snapshot) => {
        let active: Order | null = null;
        const done: Order[] = [];
        snapshot.forEach((docSnap) => {
          const ord = docSnap.data() as Order;
          if (['assigned', 'rider_assigned', 'rider_arrived_vendor', 'picked_up', 'on_the_way', 'out_for_delivery', 'arrived_at_delivery'].includes(ord.status)) {
            active = ord;
          } else if (ord.status === 'delivered') {
            done.push(ord);
          }
        });
        setMyActiveOrder(active);
        setCompletedOrders(done);
      },
      (err) => console.error('Rider active orders snapshot error:', err)
    );

    return () => {
      unsubAvail();
      unsubMy();
    };
  }, [user?.uid]);

  // Online / Offline Availability Switch
  const handleToggleOnline = async () => {
    if (!user) return;
    triggerHaptic([40, 20, 40]);
    const nextState = !isOnline;
    setIsOnline(nextState);

    await updateRiderAvailability(user.uid, nextState ? 'available' : 'offline', nextState);
    if (nextState) {
      toast.success('🟢 Online: You are ready to receive and claim campus deliveries.');
    } else {
      toast.warning('⚪ Offline: Delivery dispatch is paused.');
    }
  };

  // Claim order for delivery
  const handleClaimOrder = async (orderId: string) => {
    if (!user) return;
    triggerHaptic(50);
    const result = await claimOrderForDelivery(orderId, user);
    if (result.success) {
      toast.success(`✓ Order #${orderId.slice(-6)} assigned to you! Proceed to vendor kitchen for pickup.`);
    } else {
      toast.error(result.error || 'Failed to claim order.');
    }
  };

  // Advance order to rider_arrived_vendor
  const handleArrivedAtVendor = async () => {
    if (!myActiveOrder || !user) return;
    triggerHaptic(40);
    const result = await transitionOrderStatus(myActiveOrder.id, 'rider_arrived_vendor', user);
    if (result.success) {
      toast.success('Status updated: Arrived at Vendor Kitchen');
    }
  };

  // Perform Secure Pickup Verification
  const handleConfirmPickupWithPIN = async () => {
    if (!myActiveOrder || !user) return;
    if (!pickupCodeInput.trim()) {
      toast.error('Please enter the 4-digit pickup code shown by the kitchen.');
      return;
    }

    setIsVerifyingPickup(true);
    triggerHaptic(60);

    const result = await verifyOrderPickup({
      orderId: myActiveOrder.id,
      enteredPickupCode: pickupCodeInput,
      rider: user
    });

    setIsVerifyingPickup(false);
    if (result.success) {
      setPickupModalOpen(false);
      setPickupCodeInput('');
      toast.success('✓ Pickup Verified! Heading out for customer delivery.');
    } else {
      toast.error(result.error || 'Invalid Pickup PIN.');
    }
  };

  // Advance order to arrived_at_delivery
  const handleArrivedAtCustomer = async () => {
    if (!myActiveOrder || !user) return;
    triggerHaptic(40);
    const result = await transitionOrderStatus(myActiveOrder.id, 'arrived_at_delivery', user);
    if (result.success) {
      toast.success('Status updated: Arrived at Delivery Hall / Drop-off');
    }
  };

  // Perform Secure Delivery Verification
  const handleConfirmDeliveryWithPIN = async () => {
    if (!myActiveOrder || !user) return;
    if (!deliveryCodeInput.trim()) {
      toast.error('Please enter the 4-digit delivery PIN provided by the customer.');
      return;
    }

    setIsVerifyingDelivery(true);
    triggerHaptic([60, 40, 60]);

    const result = await verifyOrderDelivery({
      orderId: myActiveOrder.id,
      enteredDeliveryCode: deliveryCodeInput,
      rider: user
    });

    setIsVerifyingDelivery(false);
    if (result.success) {
      setDeliveryModalOpen(false);
      setDeliveryCodeInput('');
      toast.success('✓ Order Delivered! Delivery payout credited to your balance.');
    } else {
      toast.error(result.error || 'Invalid Delivery PIN.');
    }
  };

  const totalCalculatedEarnings = earningsLedger.reduce((sum, e) => sum + e.rider_earning, 0) || (riderProfile?.earnings_balance ?? 14500);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="max-w-6xl mx-auto space-y-6 pb-24"
    >
      {/* HEADER BANNER */}
      <div className="bg-slate-900 text-white rounded-3xl p-6 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <BukkitLogo variant="badge" size="sm" theme="dark" subtitleText="CAMPUS COURIER FLEET" />
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-extrabold">{user?.name || 'Campus Courier'}</h1>
              <span
                className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                  isOnline
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                    : 'bg-slate-700 text-slate-400 border border-slate-600'
                }`}
              >
                {isOnline ? 'Online • Ready' : 'Offline'}
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Vehicle: {riderProfile?.vehicle_type || 'Motorcycle'} ({riderProfile?.plate_number || 'MTU-RDR-01'}) • Campus Courier
            </p>
          </div>
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleToggleOnline}
            className={`flex items-center gap-3 px-4 py-2.5 rounded-2xl border transition-all cursor-pointer ${
              isOnline
                ? 'bg-emerald-950/80 border-emerald-500/50 text-emerald-300 shadow-lg shadow-emerald-900/20'
                : 'bg-slate-800 border-slate-700 text-slate-400'
            }`}
          >
            <div className="text-left">
              <span className="text-[9px] font-bold uppercase tracking-widest block text-slate-400">
                Dispatch Duty
              </span>
              <span className="text-xs font-black">{isOnline ? 'ACCEPTING RUNS' : 'OFF-DUTY'}</span>
            </div>
            <div
              className={`w-10 h-5 rounded-full p-0.5 transition-colors relative flex items-center ${
                isOnline ? 'bg-emerald-500' : 'bg-slate-600'
              }`}
            >
              <div
                className={`w-4 h-4 rounded-full bg-white shadow-md transform transition-transform ${
                  isOnline ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </div>
          </button>

          <div className="text-right bg-slate-800 px-4 py-2.5 rounded-2xl border border-slate-700">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              Earnings Balance
            </span>
            <span className="text-lg font-black text-emerald-400">
              ₦{totalCalculatedEarnings.toLocaleString()}
            </span>
          </div>
        </div>
      </div>

      {/* ACTIVE TASK SECTION */}
      {myActiveOrder ? (
        <motion.div
          initial={{ scale: 0.98, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-md border-2 border-emerald-600 dark:border-emerald-500 space-y-4"
        >
          <div className="flex items-center justify-between border-b border-emerald-100 dark:border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <span className="bg-emerald-600 text-white font-extrabold text-xs px-3 py-1 rounded-full uppercase tracking-wider">
                ACTIVE RUN (#{myActiveOrder.id.slice(-6)})
              </span>
              <span className="text-xs font-bold text-slate-600 dark:text-slate-300">
                Status: {myActiveOrder.status.replace(/_/g, ' ').toUpperCase()}
              </span>
            </div>
            <span className="text-sm font-black text-emerald-700 dark:text-emerald-400">
              Delivery Fee: ₦{(myActiveOrder.delivery_fee || 400).toLocaleString()} (Earn ₦{Math.round((myActiveOrder.delivery_fee || 400) * 0.75).toLocaleString()})
            </span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left Column: Details & Step Controls */}
            <div className="space-y-4">
              {/* Pickup info */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700">
                <span className="text-[10px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-wider block mb-1">
                  1. VENDOR KITCHEN PICKUP
                </span>
                <h3 className="font-extrabold text-slate-900 dark:text-slate-100 text-sm">
                  {myActiveOrder.vendor_name || myActiveOrder.restaurant_name}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">{myActiveOrder.vendor_address || 'Central Campus Plaza'}</p>
              </div>

              {/* Delivery destination info */}
              <div className="p-4 rounded-2xl bg-emerald-50/60 dark:bg-slate-800/80 border border-emerald-200 dark:border-emerald-800/50">
                <span className="text-[10px] font-extrabold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider block mb-1">
                  2. CUSTOMER DESTINATION
                </span>
                <h3 className="font-extrabold text-slate-900 dark:text-slate-100 text-sm">
                  {myActiveOrder.customer_name || myActiveOrder.user_name}
                </h3>
                <p className="text-xs font-bold text-slate-800 dark:text-slate-200">{myActiveOrder.delivery_address}</p>
                {myActiveOrder.delivery_room && (
                  <p className="text-xs font-black text-emerald-800 dark:text-emerald-400 mt-0.5">Room: {myActiveOrder.delivery_room}</p>
                )}
                {myActiveOrder.notes && (
                  <p className="text-[11px] text-slate-600 dark:text-slate-300 italic mt-1 bg-white dark:bg-slate-900 p-2 rounded-xl border border-emerald-100 dark:border-slate-700">
                    "{myActiveOrder.notes}"
                  </p>
                )}
              </div>

              {/* Contact Actions */}
              <div className="flex items-center gap-3">
                <a
                  href={`tel:${myActiveOrder.customer_phone || '+2348100000000'}`}
                  className="flex-1 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-xl text-xs font-bold flex items-center justify-center gap-2"
                >
                  <Phone className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span>Call Customer</span>
                </a>
                <button
                  onClick={() => setShowChat(true)}
                  className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 cursor-pointer"
                >
                  <MessageSquare className="w-4 h-4" />
                  <span>Chat Customer</span>
                </button>
              </div>

              {/* STATE MACHINE STEP ACTIONS */}
              <div className="pt-2 space-y-2">
                {/* Step A: Heading to vendor -> arrived at vendor */}
                {['assigned', 'rider_assigned'].includes(myActiveOrder.status) && (
                  <button
                    onClick={handleArrivedAtVendor}
                    className="w-full py-3 rounded-2xl bg-amber-500 hover:bg-amber-600 text-white font-extrabold text-xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <span>Mark: Arrived at Vendor Kitchen</span>
                  </button>
                )}

                {/* Step B: At vendor -> Verify Pickup with 4-Digit Code */}
                {['rider_arrived_vendor', 'ready', 'ready_for_pickup'].includes(myActiveOrder.status) && (
                  <button
                    onClick={() => setPickupModalOpen(true)}
                    className="w-full py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs shadow-lg shadow-emerald-600/30 transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <KeyRound className="w-4 h-4" />
                    <span>Enter Kitchen Pickup Code to Collect Meal</span>
                  </button>
                )}

                {/* Step C: Picked up -> Heading to customer / Arrived at Hall */}
                {['picked_up', 'out_for_delivery', 'on_the_way'].includes(myActiveOrder.status) && (
                  <button
                    onClick={handleArrivedAtCustomer}
                    className="w-full py-3 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <span>Mark: Arrived at Customer Hall / Room</span>
                  </button>
                )}

                {/* Step D: Arrived at customer -> Verify Delivery with 4-Digit PIN */}
                {['arrived_at_delivery', 'out_for_delivery', 'on_the_way'].includes(myActiveOrder.status) && (
                  <button
                    onClick={() => setDeliveryModalOpen(true)}
                    className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white font-black text-xs shadow-xl shadow-emerald-600/30 transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <ShieldCheck className="w-4 h-4" />
                    <span>Enter Customer Delivery PIN to Complete Run</span>
                  </button>
                )}
              </div>
            </div>

            {/* Right Column: Live Campus Navigation Map */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-extrabold text-slate-900 dark:text-slate-100">
                  <MapPin className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span>Campus Turn-by-Turn Route</span>
                </div>
                {gpsAccuracy !== null && (
                  <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-lg">
                    GPS Accuracy: ±{gpsAccuracy}m
                  </span>
                )}
              </div>
              <MapPicker
                latitude={myActiveOrder.latitude || 6.7638}
                longitude={myActiveOrder.longitude || 3.3782}
                riderLat={riderLat}
                riderLng={riderLng}
                restaurantLat={6.7628}
                restaurantLng={3.3768}
                vendorName={myActiveOrder.vendor_name || 'Kitchen Stand'}
                customerName={myActiveOrder.customer_name || 'Student Drop-off'}
                orderStatus={myActiveOrder.status}
                isTrackingMode={true}
                height="340px"
              />
            </div>
          </div>
        </motion.div>
      ) : null}

      {/* AVAILABLE RUNS POOL */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-xs border border-slate-200 dark:border-slate-800 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-black text-slate-900 dark:text-slate-100">Available Campus Orders</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">Claim nearby kitchen orders ready for student delivery</p>
          </div>
          <span className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold px-3 py-1 rounded-full">
            {availableOrders.length} Available
          </span>
        </div>

        {availableOrders.length === 0 ? (
          <div className="text-center py-10 text-slate-400 dark:text-slate-500 space-y-2">
            <Clock className="w-8 h-8 mx-auto opacity-40" />
            <p className="text-xs font-bold">No unassigned orders in the campus dispatch queue.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {availableOrders.map((ord) => (
              <div
                key={ord.id}
                className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 hover:border-emerald-500 dark:hover:border-emerald-500 bg-slate-50/50 dark:bg-slate-800/50 space-y-3 transition-all"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-slate-900 dark:text-slate-100">#{ord.id.slice(-6)}</span>
                  <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-full">
                    Earn ₦{Math.round((ord.delivery_fee || 400) * 0.75).toLocaleString()}
                  </span>
                </div>

                <div className="text-xs space-y-1">
                  <p className="font-bold text-slate-800 dark:text-slate-200">From: {ord.vendor_name || ord.restaurant_name}</p>
                  <p className="text-slate-600 dark:text-slate-400">To: {ord.delivery_address}</p>
                  {ord.delivery_room && <p className="text-emerald-700 dark:text-emerald-400 font-bold">Room: {ord.delivery_room}</p>}
                </div>

                <button
                  onClick={() => handleClaimOrder(ord.id)}
                  disabled={!isOnline || !!myActiveOrder}
                  className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs transition-colors disabled:opacity-40 cursor-pointer"
                >
                  {myActiveOrder ? 'Finish Active Run First' : 'Claim Delivery'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* EARNINGS LEDGER */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-xs border border-slate-200 dark:border-slate-800 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-black text-slate-900 dark:text-slate-100">Delivery Earnings Ledger</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">Authoritative audit of payouts per delivery</p>
          </div>
          <DollarSign className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
        </div>

        {earningsLedger.length === 0 ? (
          <div className="text-xs text-slate-400 dark:text-slate-500 py-4 text-center">
            Completed delivery earnings will appear here in real-time.
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {earningsLedger.slice(0, 5).map((earn) => (
              <div key={earn.delivery_earning_id} className="py-2.5 flex items-center justify-between text-xs">
                <div>
                  <span className="font-bold text-slate-900 dark:text-slate-100">Order #{earn.order_id.slice(-6)}</span>
                  <span className="text-[10px] text-slate-400 dark:text-slate-500 block">
                    {new Date(earn.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <div className="text-right">
                  <span className="font-black text-emerald-600 dark:text-emerald-400">+₦{earn.rider_earning.toLocaleString()}</span>
                  <span className="text-[10px] text-slate-400 dark:text-slate-500 block">Fee: ₦{earn.delivery_fee}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* MODAL 1: ENTER KITCHEN PICKUP PIN */}
      {pickupModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 max-w-sm w-full space-y-4 shadow-2xl border border-emerald-100 dark:border-slate-800 text-center">
            <div className="w-12 h-12 rounded-2xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 flex items-center justify-center mx-auto">
              <KeyRound className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-black text-slate-900 dark:text-slate-100 text-base">Verify Kitchen Pickup</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Enter the 4-digit Pickup Code displayed on the Vendor's screen
              </p>
            </div>

            <input
              type="text"
              maxLength={4}
              value={pickupCodeInput}
              onChange={(e) => setPickupCodeInput(e.target.value)}
              placeholder="e.g. 4829"
              className="w-full text-center tracking-widest text-2xl font-black bg-slate-50 dark:bg-slate-800 border-2 border-emerald-500 rounded-2xl py-3 text-slate-900 dark:text-slate-100 outline-none focus:ring-4 focus:ring-emerald-500/20"
            />

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setPickupModalOpen(false)}
                className="flex-1 py-3 rounded-xl bg-slate-100 dark:bg-slate-800 font-bold text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmPickupWithPIN}
                disabled={isVerifyingPickup}
                className="flex-1 py-3 rounded-xl bg-emerald-600 font-black text-xs text-white hover:bg-emerald-700 shadow-md shadow-emerald-600/30 cursor-pointer"
              >
                {isVerifyingPickup ? 'Verifying...' : 'Verify Pickup'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: ENTER CUSTOMER DELIVERY PIN */}
      {deliveryModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 max-w-sm w-full space-y-4 shadow-2xl border border-emerald-100 dark:border-slate-800 text-center">
            <div className="w-12 h-12 rounded-2xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 flex items-center justify-center mx-auto">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-black text-slate-900 dark:text-slate-100 text-base">Verify Customer Delivery</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Ask the customer for their 4-digit Delivery PIN shown on their screen
              </p>
            </div>

            <input
              type="text"
              maxLength={4}
              value={deliveryCodeInput}
              onChange={(e) => setDeliveryCodeInput(e.target.value)}
              placeholder="e.g. 7192"
              className="w-full text-center tracking-widest text-2xl font-black bg-slate-50 dark:bg-slate-800 border-2 border-emerald-500 rounded-2xl py-3 text-slate-900 dark:text-slate-100 outline-none focus:ring-4 focus:ring-emerald-500/20"
            />

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setDeliveryModalOpen(false)}
                className="flex-1 py-3 rounded-xl bg-slate-100 dark:bg-slate-800 font-bold text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDeliveryWithPIN}
                disabled={isVerifyingDelivery}
                className="flex-1 py-3 rounded-xl bg-emerald-600 font-black text-xs text-white hover:bg-emerald-700 shadow-md shadow-emerald-600/30 cursor-pointer"
              >
                {isVerifyingDelivery ? 'Verifying...' : 'Complete Run'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* REALTIME DELIVERY CHAT MODAL (Rider <-> Customer) */}
      {showChat && myActiveOrder && (
        <RealtimeDeliveryChatModal
          orderId={myActiveOrder.id}
          orderNumber={myActiveOrder.order_number || myActiveOrder.id.slice(-6)}
          currentUserId={user?.uid || ''}
          currentUserName={user?.name || 'Delivery Courier'}
          currentUserRole="rider"
          recipientId={myActiveOrder.customer_id || myActiveOrder.user_id || 'customer'}
          recipientName={myActiveOrder.customer_name || myActiveOrder.user_name || 'Customer'}
          vendorName={myActiveOrder.vendor_name || 'Vendor Kitchen'}
          isOrderDelivered={myActiveOrder.status === 'delivered'}
          onClose={() => setShowChat(false)}
        />
      )}
    </motion.div>
  );
};

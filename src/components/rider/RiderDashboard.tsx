import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Bike, MapPin, CheckCircle2, MessageSquare, ShieldAlert, BellOff } from 'lucide-react';
import { collection, query, where, onSnapshot, doc, updateDoc, setDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { Order, OrderStatus } from '../../types';
import { useAuthStore } from '../../stores/useAuthStore';
import { MapPicker } from '../ui/MapPicker';
import { CustomerChat } from '../customer/CustomerChat';
import { triggerHaptic } from '../../utils/haptics';
import { toast } from 'sonner';
import { staggerContainer, staggerItem } from '../../utils/motion';

export const RiderDashboard: React.FC = () => {
  const { user } = useAuthStore();
  const [availableOrders, setAvailableOrders] = useState<Order[]>([]);
  const [myActiveOrder, setMyActiveOrder] = useState<Order | null>(null);
  const [completedOrders, setCompletedOrders] = useState<Order[]>([]);
  const [riderLat, setRiderLat] = useState(6.520);
  const [riderLng, setRiderLng] = useState(3.374);
  const [showChat, setShowChat] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [isToggling, setIsToggling] = useState(false);

  // Real-time listener for rider's status in `riders` Firestore collection
  useEffect(() => {
    if (!user?.uid) return;

    const unsubRider = onSnapshot(doc(db, 'riders', user.uid), (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        if (typeof data.is_online === 'boolean') {
          setIsOnline(data.is_online);
        }
      }
    }, (err) => console.error('Rider doc snapshot error:', err));

    return () => unsubRider();
  }, [user?.uid]);

  const handleToggleAvailability = async () => {
    if (!user?.uid) return;
    triggerHaptic([40, 20, 40]);
    setIsToggling(true);
    const nextState = !isOnline;
    setIsOnline(nextState);

    try {
      // 1. Update active status in 'riders' collection
      await setDoc(doc(db, 'riders', user.uid), {
        id: user.uid,
        name: user.name || 'Rider',
        phone: user.phone || '',
        is_online: nextState,
        is_active: nextState,
        updated_at: new Date().toISOString()
      }, { merge: true });

      // 2. Also update user profile
      await setDoc(doc(db, 'users', user.uid), {
        is_online: nextState,
        updated_at: new Date().toISOString()
      }, { merge: true });

      if (nextState) {
        toast.success('🟢 You are ONLINE! Receiving incoming delivery notifications.');
      } else {
        toast.warning('🔴 You are OFF-DUTY. Hidden from incoming order notifications.');
      }
    } catch (err) {
      console.error('Failed to update rider status in Firestore riders collection:', err);
      toast.error('Failed to update rider status.');
      setIsOnline(!nextState);
    } finally {
      setIsToggling(false);
    }
  };

  // Real-time Firestore sync for available orders
  useEffect(() => {
    const qAvail = query(collection(db, 'orders'), where('status', 'in', ['pending', 'accepted']));
    const unsubAvail = onSnapshot(qAvail, (snapshot) => {
      const list: Order[] = [];
      snapshot.forEach((doc) => {
        const ord = { id: doc.id, ...doc.data() } as Order;
        if (!ord.rider_id || ord.rider_id === user?.uid) {
          list.push(ord);
        }
      });
      setAvailableOrders(list);
    }, (err) => console.error('Available orders snapshot error:', err));

    // My active assigned order
    if (user?.uid) {
      const qActive = query(collection(db, 'orders'), where('rider_id', '==', user.uid));
      const unsubActive = onSnapshot(qActive, (snapshot) => {
        let active: Order | null = null;
        const doneList: Order[] = [];
        snapshot.forEach((doc) => {
          const ord = { id: doc.id, ...doc.data() } as Order;
          if (['accepted', 'preparing', 'ready', 'picked_up', 'on_the_way'].includes(ord.status)) {
            active = ord;
          } else if (ord.status === 'delivered') {
            doneList.push(ord);
          }
        });
        setMyActiveOrder(active);
        setCompletedOrders(doneList);
      }, (err) => console.error('Active order snapshot error:', err));

      return () => {
        unsubAvail();
        unsubActive();
      };
    }

    return () => unsubAvail();
  }, [user?.uid]);

  // Broadcast rider location updates to Firestore `rider_locations` collection
  const updateRiderLocation = async (newLat: number, newLng: number) => {
    setRiderLat(newLat);
    setRiderLng(newLng);

    if (user?.uid && myActiveOrder) {
      try {
        await setDoc(doc(db, 'rider_locations', user.uid), {
          id: user.uid,
          rider_id: user.uid,
          order_id: myActiveOrder.id,
          latitude: newLat,
          longitude: newLng,
          updated_at: new Date().toISOString()
        });
      } catch (err) {
        console.error('Failed to update rider location:', err);
      }
    }
  };

  const handleAcceptOrder = async (orderId: string) => {
    if (!user) return;
    triggerHaptic([50, 30, 50]);
    try {
      await updateDoc(doc(db, 'orders', orderId), {
        rider_id: user.uid,
        rider_name: user.name,
        status: 'accepted' as OrderStatus,
        updated_at: new Date().toISOString()
      });
    } catch (err) {
      console.error('Failed to accept order:', err);
    }
  };

  const handleUpdateStatus = async (newStatus: OrderStatus) => {
    if (!myActiveOrder) return;
    triggerHaptic(50);
    try {
      await updateDoc(doc(db, 'orders', myActiveOrder.id), {
        status: newStatus,
        updated_at: new Date().toISOString()
      });
    } catch (err) {
      console.error('Failed to update status:', err);
    }
  };

  const totalEarnings = completedOrders.reduce((sum, o) => sum + (o.delivery_fee || 350), 0);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.3 }}
      className="max-w-6xl mx-auto space-y-6 pb-24"
    >
      
      {/* Header Banner with Online/Offline Toggle Availability Switch */}
      <div className="bg-slate-900 text-white rounded-3xl p-6 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-[#D6001C] flex items-center justify-center text-white shadow-lg">
            <Bike className="w-8 h-8" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-extrabold">{user?.name || 'Rider Agent'}</h1>
              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                isOnline ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40' : 'bg-slate-700 text-slate-400 border border-slate-600'
              }`}>
                {isOnline ? 'Online' : 'Offline'}
              </span>
            </div>
            <p className="text-xs text-slate-400">Rider ID: {user?.uid.slice(0, 8)} • Dispatch Network</p>
          </div>
        </div>

        {/* Right Header Actions: Toggle Switch & Earnings */}
        <div className="flex items-center gap-3">
          {/* Toggle Availability Switch Button */}
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.96 }}
            onClick={handleToggleAvailability}
            disabled={isToggling}
            className={`flex items-center gap-3 px-4 py-2.5 rounded-2xl border transition-all cursor-pointer select-none ${
              isOnline
                ? 'bg-emerald-950/80 border-emerald-500/50 text-emerald-300 hover:bg-emerald-900/80 shadow-lg shadow-emerald-900/20'
                : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-750'
            }`}
          >
            <div className="text-left">
              <span className="text-[9px] font-extrabold uppercase tracking-widest block text-slate-400">
                Availability
              </span>
              <span className="text-xs font-black">
                {isOnline ? 'ACCEPTING ORDERS' : 'OFFLINE (PAUSED)'}
              </span>
            </div>

            {/* Custom iOS style switch graphic */}
            <div className={`w-11 h-6 rounded-full p-1 transition-colors relative flex items-center ${
              isOnline ? 'bg-emerald-500' : 'bg-slate-600'
            }`}>
              <motion.div
                layout
                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                className={`w-4 h-4 rounded-full bg-white shadow-md transform ${
                  isOnline ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </div>
          </motion.button>

          <div className="text-right bg-slate-800 px-4 py-2.5 rounded-2xl border border-slate-700">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Today's Earnings</span>
            <span className="text-lg font-black text-emerald-400">₦{totalEarnings.toLocaleString()}</span>
          </div>
        </div>
      </div>

      {/* Offline Alert Banner if rider toggles offline */}
      <AnimatePresence>
        {!isOnline && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-amber-50 border-2 border-amber-300 rounded-3xl p-5 flex items-center gap-4 text-amber-900 shadow-xs"
          >
            <ShieldAlert className="w-8 h-8 text-amber-600 shrink-0" />
            <div className="text-xs font-medium">
              <h4 className="font-extrabold text-sm text-amber-900">You are currently OFFLINE</h4>
              <p className="text-amber-700 mt-0.5">
                Your status is set to offline in Firestore. Toggle availability above when you are ready to accept new customer deliveries.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Active Order Card */}
      {myActiveOrder ? (
        <motion.div
          initial={{ scale: 0.98, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="bg-white rounded-3xl p-6 shadow-md border-2 border-[#D6001C] space-y-4"
        >
          <div className="flex items-center justify-between border-b border-rose-100 pb-3">
            <span className="bg-[#D6001C] text-white font-extrabold text-xs px-3 py-1 rounded-full uppercase tracking-wider">
              ACTIVE DELIVERY (#{myActiveOrder.id})
            </span>
            <span className="text-xs font-bold text-slate-600">
              Customer: {myActiveOrder.user_name || 'Customer'}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <h3 className="font-extrabold text-slate-900 text-base">
                Pickup from: {myActiveOrder.restaurant_name}
              </h3>
              <p className="text-xs text-slate-600 flex items-center gap-1">
                <MapPin className="w-4 h-4 text-[#D6001C]" />
                Deliver to: {myActiveOrder.delivery_address}
              </p>

              <div className="pt-2 flex items-center gap-2">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setShowChat(true)}
                  className="px-4 py-2.5 bg-[#D6001C] text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-xs cursor-pointer"
                >
                  <MessageSquare className="w-4 h-4" />
                  <span>Chat Customer</span>
                </motion.button>
              </div>
            </div>

            <MapPicker
              latitude={myActiveOrder.latitude || 6.518}
              longitude={myActiveOrder.longitude || 3.372}
              riderLat={riderLat}
              riderLng={riderLng}
              restaurantLat={6.519}
              restaurantLng={3.373}
              height="200px"
              onLocationSelect={(l1, l2) => updateRiderLocation(l1, l2)}
            />
          </div>

          {/* Rider Status Update Buttons */}
          <div className="pt-4 border-t border-rose-100 flex flex-wrap gap-2">
            {myActiveOrder.status === 'accepted' && (
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => handleUpdateStatus('preparing')}
                className="bg-amber-500 text-white font-bold px-4 py-2.5 rounded-xl text-xs cursor-pointer"
              >
                1. Confirm Restaurant Preparing
              </motion.button>
            )}
            {myActiveOrder.status === 'preparing' && (
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => handleUpdateStatus('picked_up')}
                className="bg-blue-600 text-white font-bold px-4 py-2.5 rounded-xl text-xs cursor-pointer"
              >
                2. Mark Order Picked Up
              </motion.button>
            )}
            {myActiveOrder.status === 'picked_up' && (
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => handleUpdateStatus('on_the_way')}
                className="bg-purple-600 text-white font-bold px-4 py-2.5 rounded-xl text-xs cursor-pointer"
              >
                3. Start Navigation (On The Way)
              </motion.button>
            )}
            {myActiveOrder.status === 'on_the_way' && (
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => handleUpdateStatus('delivered')}
                className="bg-emerald-600 text-white font-black px-6 py-3 rounded-xl text-xs flex items-center gap-2 shadow-lg cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>4. Complete & Mark Delivered!</span>
              </motion.button>
            )}
          </div>
        </motion.div>
      ) : (
        <div className="bg-rose-50/60 rounded-3xl p-6 text-center border border-rose-100 space-y-2">
          <Bike className="w-10 h-10 text-[#D6001C] mx-auto" />
          <h3 className="font-extrabold text-slate-800 text-base">Ready for Next Delivery</h3>
          <p className="text-xs text-slate-500">Accept available delivery requests below to start earning.</p>
        </div>
      )}

      {/* Available Order Requests Feed */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-black text-slate-900">Available Delivery Jobs</h2>
          {isOnline ? (
            <span className="text-[10px] font-extrabold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              Live Dispatch Stream Active
            </span>
          ) : (
            <span className="text-[10px] font-extrabold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full border border-slate-200">
              Dispatch Paused
            </span>
          )}
        </div>

        {!isOnline ? (
          <div className="bg-slate-900 text-white rounded-3xl p-8 text-center border border-slate-800 space-y-3 shadow-md">
            <BellOff className="w-10 h-10 text-amber-400 mx-auto animate-bounce" />
            <h3 className="font-extrabold text-base text-slate-100">Notifications Paused (Off-Duty)</h3>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              Your status in the <code className="text-rose-400 font-mono">riders</code> Firestore collection is set to off-duty. Switch your availability to <strong>ACCEPTING ORDERS</strong> above to start receiving real-time delivery requests.
            </p>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleToggleAvailability}
              className="mt-2 bg-[#D6001C] hover:bg-red-600 text-white font-extrabold text-xs px-5 py-2.5 rounded-2xl transition-all cursor-pointer shadow-md"
            >
              Go Online Now
            </motion.button>
          </div>
        ) : availableOrders.length === 0 ? (
          <div className="bg-white rounded-3xl p-8 text-center border border-rose-100 text-xs text-slate-400">
            No pending delivery requests right now. Checking Realtime...
          </div>
        ) : (
          <motion.div
            variants={staggerContainer}
            initial="initial"
            animate="animate"
            className="grid grid-cols-1 md:grid-cols-2 gap-4"
          >
            {availableOrders.map((ord) => (
              <motion.div
                key={ord.id}
                variants={staggerItem}
                whileHover={{ y: -2 }}
                className="bg-white rounded-3xl p-5 border border-rose-100 shadow-xs space-y-3"
              >
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-slate-900 text-sm">{ord.restaurant_name}</span>
                  <span className="font-black text-emerald-600 text-sm">₦{ord.delivery_fee || 350} Fee</span>
                </div>

                <p className="text-xs text-slate-600 truncate">
                  📍 {ord.delivery_address}
                </p>

                <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                  <span className="text-xs font-bold text-slate-900">Total ₦{ord.total_price.toLocaleString()}</span>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => handleAcceptOrder(ord.id)}
                    className="bg-[#D6001C] hover:bg-red-700 text-white font-extrabold text-xs px-4 py-2 rounded-xl shadow-xs cursor-pointer"
                  >
                    Accept Order
                  </motion.button>
                </div>
              </motion.div>
            ))}
          </motion.div>
        )}
      </div>

      {/* Customer Chat modal */}
      {showChat && myActiveOrder && user && (
        <CustomerChat
          orderId={myActiveOrder.id}
          currentUserId={user.uid}
          currentUserName={user.name}
          currentUserRole="rider"
          receiverId={myActiveOrder.user_id}
          onClose={() => setShowChat(false)}
        />
      )}

    </motion.div>
  );
};


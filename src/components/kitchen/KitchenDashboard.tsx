import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  UtensilsCrossed,
  Store,
  Clock,
  CheckCircle2,
  AlertCircle,
  Plus,
  Edit2,
  Trash2,
  Users,
  Image,
  Sparkles,
  DollarSign,
  Eye,
  EyeOff,
  Phone,
  Power,
  Shield,
  ShoppingBag,
  ChefHat,
  Bell,
  RefreshCw,
  TrendingUp,
  Tag
} from 'lucide-react';
import { doc, updateDoc, setDoc, collection, onSnapshot, query, where } from "../../lib/embeddedDb";
import { db } from '../../lib/firebase';
import { useAuthStore } from '../../stores/useAuthStore';
import { useMarketplaceStore } from '../../stores/useMarketplaceStore';
import { Vendor, MenuItem, Order, VendorWorker, KitchenDetails } from '../../types';
import { triggerHaptic } from '../../utils/haptics';
import { toast } from 'sonner';
import { ImageUploadInput } from '../common/ImageUploadInput';
import { BukkitLogo } from '../common/BukkitLogo';
import { updateKitchenDetails } from '../../services/kitchenService';
import { transitionOrderStatus } from '../../services/orderLifecycleService';

export const KitchenDashboard: React.FC = () => {
  const { user } = useAuthStore();
  const { vendors, menuItems, foodZones } = useMarketplaceStore();

  // Authoritative vendor resolution
  const userVendorId = user?.vendor_id || user?.kitchen_profile?.vendor_id;
  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin' || user?.active_role === 'admin' || user?.active_role === 'super_admin';

  // Find vendor associated with this kitchen user or use user UID
  const [activeVendorId, setActiveVendorId] = useState<string>(() => {
    if (userVendorId) return userVendorId;
    if (user?.uid) {
      const matched = vendors.find(v => v.owner_uid === user?.uid || v.email?.toLowerCase() === user?.email?.toLowerCase() || v.id === user?.uid);
      return matched ? matched.id : user.uid;
    }
    return vendors[0]?.id || 'vendor_mama_cass';
  });

  useEffect(() => {
    if (userVendorId && !isAdmin) {
      setActiveVendorId(userVendorId);
    } else if (user?.uid) {
      const matched = vendors.find(v => v.owner_uid === user?.uid || v.email?.toLowerCase() === user?.email?.toLowerCase() || v.id === user?.uid);
      if (matched) {
        setActiveVendorId(matched.id);
      } else if (!isAdmin) {
        setActiveVendorId(user.uid);
      }
    }
  }, [userVendorId, isAdmin, user?.uid, user?.email, vendors]);

  const currentVendor = vendors.find(v => v.id === activeVendorId || v.owner_uid === user?.uid) || (user?.uid ? {
    id: activeVendorId,
    name: user.name || 'Campus Kitchen',
    slogan: 'Fresh, hot meals served daily on campus!',
    rating: 5.0,
    total_ratings: 1,
    estimated_delivery_time: '15-25 min',
    cover_image_url: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=800&auto=format&fit=crop',
    logo_url: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=200&auto=format&fit=crop',
    opening_time: '07:30',
    closing_time: '21:00',
    is_active: true,
    is_open: true,
    is_verified: true,
    food_zone_id: 'zone_central',
    university_id: user.university_id || 'uni_mtu',
    campus_id: user.campus_id || 'campus_mtu_main',
    owner_uid: user.uid,
    email: user.email || '',
    phone: user.phone || ''
  } as any : vendors[0]);
  const vendorMenu = menuItems.filter(m => m.vendor_id === activeVendorId || m.restaurant_id === activeVendorId);
  const currentZone = foodZones.find(z => z.id === currentVendor?.food_zone_id);

  // Active Tab
  const [activeTab, setActiveTab] = useState<'orders' | 'menu' | 'profile' | 'workers'>('orders');

  // Live Orders
  const [liveOrders, setLiveOrders] = useState<Order[]>([]);
  const [isLoadingOrders, setIsLoadingOrders] = useState(true);

  // Profile Edit State
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [slogan, setSlogan] = useState(currentVendor?.slogan || 'Fresh, hot meals served daily on campus!');
  const [coverUrl, setCoverUrl] = useState(currentVendor?.cover_image_url || 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=800&auto=format&fit=crop');
  const [logoUrl, setLogoUrl] = useState(currentVendor?.logo_url || 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=200&auto=format&fit=crop');
  const [openingTime, setOpeningTime] = useState(currentVendor?.opening_time || '07:30');
  const [closingTime, setClosingTime] = useState(currentVendor?.closing_time || '21:00');
  const [prepTime, setPrepTime] = useState(currentVendor?.estimated_delivery_time || '15-25 min');

  // Workers State
  const [workers, setWorkers] = useState<VendorWorker[]>(currentVendor?.workers || [
    { id: 'w1', name: 'Chef Emmanuel', role: 'Head Cook & Griller', phone: '+234 802 345 6789', is_active: true },
    { id: 'w2', name: 'Blessing Adebayo', role: 'Cashier & Dispatch Lead', phone: '+234 813 456 7890', is_active: true }
  ]);
  const [showAddWorker, setShowAddWorker] = useState(false);
  const [newWorkerName, setNewWorkerName] = useState('');
  const [newWorkerRole, setNewWorkerRole] = useState('Cook');
  const [newWorkerPhone, setNewWorkerPhone] = useState('');

  // New Dish Modal
  const [showAddDish, setShowAddDish] = useState(false);
  const [dishName, setDishName] = useState('');
  const [dishDesc, setDishDesc] = useState('');
  const [dishPrice, setDishPrice] = useState('');
  const [dishImage, setDishImage] = useState('https://images.unsplash.com/photo-1512058564366-18510be2db19?w=600&auto=format&fit=crop');
  const [dishCategory, setDishCategory] = useState('Rice & Grains');

  // Sync state if vendor changes
  useEffect(() => {
    if (currentVendor) {
      setSlogan(currentVendor.slogan || 'Fresh campus meals made with love');
      setCoverUrl(currentVendor.cover_image_url || 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=800&auto=format&fit=crop');
      setLogoUrl(currentVendor.logo_url || 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=200&auto=format&fit=crop');
      setOpeningTime(currentVendor.opening_time || '07:30');
      setClosingTime(currentVendor.closing_time || '21:00');
      setPrepTime(currentVendor.estimated_delivery_time || '15-25 min');
      if (currentVendor.workers) setWorkers(currentVendor.workers);
    }
  }, [currentVendor?.id]);

  // Real-time Orders Listener for this Vendor (supporting all ID and name mappings)
  useEffect(() => {
    setIsLoadingOrders(true);

    try {
      const q = query(collection(db, 'orders'));

      const unsub = onSnapshot(q, (snapshot) => {
        const ords: Order[] = [];
        snapshot.forEach((d) => {
          const data = d.data() as any;
          const matchesVendorId =
            data.vendor_id === activeVendorId ||
            data.restaurant_id === activeVendorId ||
            data.vendorId === activeVendorId ||
            data.restaurantId === activeVendorId ||
            data.vendor_id === user?.uid ||
            data.restaurant_id === user?.uid;

          const matchesVendorName =
            currentVendor &&
            (data.vendor_name === currentVendor.name || data.restaurant_name === currentVendor.name);

          if (matchesVendorId || matchesVendorName) {
            ords.push({ id: d.id, ...data } as Order);
          }
        });
        ords.sort((a, b) => new Date(b.created_at || '').getTime() - new Date(a.created_at || '').getTime());
        setLiveOrders(ords);
        setIsLoadingOrders(false);
      }, (err) => {
        console.warn('Orders listener notice:', err);
        setIsLoadingOrders(false);
      });

      return () => unsub();
    } catch (e) {
      console.warn('Orders query catch:', e);
      setIsLoadingOrders(false);
    }
  }, [activeVendorId, currentVendor?.name, user?.uid]);

  // Toggle Stand Open/Closed in Firestore
  const handleToggleStoreOpen = async () => {
    if (!currentVendor) return;
    const nextState = !currentVendor.is_open;
    triggerHaptic(50);

    try {
      await updateDoc(doc(db, 'vendors', currentVendor.id), {
        is_open: nextState,
        updated_at: new Date().toISOString()
      });
      await updateDoc(doc(db, 'restaurants', currentVendor.id), {
        is_open: nextState,
        updated_at: new Date().toISOString()
      }).catch(() => {});

      toast.success(nextState ? `🟢 ${currentVendor.name} is now OPEN for orders!` : `🔴 ${currentVendor.name} is now CLOSED.`);
    } catch (e) {
      console.error('Error toggling vendor open status:', e);
      toast.error('Could not update stand open status.');
    }
  };

  // Toggle Item Availability (In Stock / Sold Out)
  const handleToggleItemAvailability = async (item: MenuItem) => {
    triggerHaptic(30);
    const nextAvail = !item.available;
    try {
      await updateDoc(doc(db, 'menu_items', item.id), {
        available: nextAvail,
        updated_at: new Date().toISOString()
      });
      toast.info(`${item.name} marked as ${nextAvail ? 'AVAILABLE' : 'SOLD OUT'}`);
    } catch (e) {
      console.error('Error toggling item availability:', e);
      toast.error('Failed to update dish status.');
    }
  };

  // Save Stand Profile & Slogan
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentVendor) return;
    triggerHaptic(40);

    const workerIds = workers.map(w => w.id);

    try {
      const updates = {
        slogan,
        cover_image_url: coverUrl,
        logo_url: logoUrl,
        opening_time: openingTime,
        closing_time: closingTime,
        estimated_delivery_time: prepTime,
        workers,
        worker_ids: workerIds,
        updated_at: new Date().toISOString()
      };

      await updateDoc(doc(db, 'vendors', currentVendor.id), updates);
      await updateDoc(doc(db, 'restaurants', currentVendor.id), {
        logo_url: logoUrl,
        slogan: slogan,
        cover_image_url: coverUrl,
        estimated_delivery_time: prepTime,
        updated_at: new Date().toISOString()
      }).catch(() => {});

      // Sync to standalone kitchen_details collection
      await updateKitchenDetails(currentVendor.id, {
        slogan,
        cover_image_url: coverUrl,
        worker_ids: workerIds,
        banner_url: coverUrl,
        contact_phone: currentVendor.phone || '+234 800 123 4567'
      });

      setIsEditingProfile(false);
      toast.success('✓ Kitchen stand details and slogan updated successfully!');
    } catch (e) {
      console.error('Error saving kitchen profile:', e);
      toast.error('Failed to save profile changes.');
    }
  };

  // Add Worker
  const handleAddWorker = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWorkerName.trim()) return;

    const newW: VendorWorker = {
      id: `w_${Date.now()}`,
      name: newWorkerName.trim(),
      role: newWorkerRole.trim(),
      phone: newWorkerPhone.trim() || '+234 800 000 0000',
      is_active: true
    };

    const updated = [...workers, newW];
    setWorkers(updated);
    setNewWorkerName('');
    setNewWorkerPhone('');
    setShowAddWorker(false);

    if (currentVendor) {
      updateDoc(doc(db, 'vendors', currentVendor.id), { workers: updated }).catch(console.error);
    }
    toast.success(`✓ Added ${newW.name} to kitchen staff list.`);
  };

  // Remove Worker
  const handleRemoveWorker = (workerId: string) => {
    const updated = workers.filter(w => w.id !== workerId);
    setWorkers(updated);
    if (currentVendor) {
      updateDoc(doc(db, 'vendors', currentVendor.id), { workers: updated }).catch(console.error);
    }
    toast.info('Staff member removed.');
  };

  // Add New Dish
  const handleCreateDish = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dishName.trim() || !dishPrice || !currentVendor) return;
    triggerHaptic(40);

    try {
      const dishId = `dish_${dishName.toLowerCase().replace(/[^a-z0-9]+/g, '_')}_${Date.now().toString().slice(-4)}`;
      const catId = `cat_${dishCategory.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`;

      const newDish: MenuItem = {
        id: dishId,
        vendor_id: currentVendor.id,
        restaurant_id: currentVendor.id,
        category_id: catId,
        name: dishName.trim(),
        description: dishDesc.trim(),
        price: parseFloat(dishPrice),
        base_price: parseFloat(dishPrice),
        available: true,
        image_url: dishImage || 'https://images.unsplash.com/photo-1512058564366-18510be2db19?w=600&auto=format&fit=crop',
        verification_status: 'verified',
        status: 'Published',
        created_at: new Date().toISOString()
      };

      await setDoc(doc(db, 'menu_items', dishId), newDish);
      setShowAddDish(false);
      setDishName('');
      setDishDesc('');
      setDishPrice('');
      toast.success(`✓ Added "${newDish.name}" to your kitchen menu!`);
    } catch (e) {
      console.error('Error creating dish:', e);
      toast.error('Failed to create new dish.');
    }
  };

  // Update Order Status (e.g. Preparing -> Ready for Dispatch)
  const handleUpdateOrderStatus = async (orderId: string, nextStatus: 'vendor_accepted' | 'preparing' | 'ready_for_pickup' | 'cancelled', reason?: string) => {
    if (!user) return;
    triggerHaptic(40);
    try {
      const res = await transitionOrderStatus(orderId, nextStatus as any, user, {
        cancellationReason: reason
      });
      if (res.success) {
        toast.success(`✓ Order status transitioned to: ${nextStatus.replace(/_/g, ' ').toUpperCase()}`);
      } else {
        toast.error(res.error || 'Failed to update order status');
      }
    } catch (e: any) {
      console.error('Error updating order:', e);
      toast.error(e?.message || 'Failed to update order status.');
    }
  };

  return (
    <div className="space-y-6 pb-20 animate-in fade-in duration-200">
      
      {/* 1. STAND HERO HEADER */}
      <div className="relative rounded-[32px] overflow-hidden bg-slate-900 text-white shadow-xl border border-slate-800">
        
        {/* Cover Image Background */}
        <div 
          className="absolute inset-0 bg-cover bg-center opacity-30 blur-[1px]"
          style={{ backgroundImage: `url('${currentVendor?.cover_image_url || coverUrl}')` }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-900/80 to-transparent" />

        <div className="relative z-10 p-6 sm:p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          
          {/* Logo & Stand Details */}
          <div className="flex items-center gap-4">
            <div className="w-20 h-20 rounded-3xl overflow-hidden border-4 border-white/20 shadow-2xl shrink-0 bg-slate-800">
              <img
                src={currentVendor?.logo_url || logoUrl}
                alt={currentVendor?.name}
                className="w-full h-full object-cover"
              />
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <BukkitLogo variant="badge" size="xs" subtitleText="KITCHEN PARTNER" />
                <span className="bg-white/10 text-slate-200 text-xs font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1">
                  <ChefHat className="w-3 h-3 text-amber-400" />
                  {currentZone?.name || 'Campus Food Stand'}
                </span>
              </div>

              <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
                {currentVendor?.name || 'My Kitchen Stand'}
              </h1>
              <p className="text-xs sm:text-sm text-slate-300 italic font-medium">
                "{currentVendor?.slogan || slogan}"
              </p>
            </div>
          </div>

          {/* Quick Controls: Stand Open Switcher & Active Hours */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 bg-white/10 backdrop-blur-md p-3 rounded-2xl border border-white/10 w-full md:w-auto">
            
            {/* Open / Closed Toggle */}
            <button
              onClick={handleToggleStoreOpen}
              className={`w-full sm:w-auto px-4 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg ${
                currentVendor?.is_open
                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-900/30'
                  : 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-900/30'
              }`}
            >
              <Power className="w-4 h-4" />
              <span>{currentVendor?.is_open ? 'STAND IS OPEN' : 'STAND IS CLOSED'}</span>
            </button>

            {/* Operating Hours Capsule */}
            <div className="text-right px-2 py-1 text-xs text-slate-300">
              <div className="flex items-center gap-1 text-[11px] font-bold text-slate-400">
                <Clock className="w-3 h-3 text-amber-400" /> Hours:
              </div>
              <div className="font-mono font-bold text-white">
                {currentVendor?.opening_time || openingTime} - {currentVendor?.closing_time || closingTime}
              </div>
            </div>

            {/* Stand Switcher (if user manages multiple stands) */}
            {vendors.length > 1 && (
              <select
                value={activeVendorId}
                onChange={(e) => setActiveVendorId(e.target.value)}
                className="bg-slate-800 text-white text-xs font-bold py-2 px-3 rounded-xl border border-slate-700 outline-none"
              >
                {vendors.map(v => (
                  <option key={v.id} value={v.id}>{v.name}</option>
                ))}
              </select>
            )}

          </div>

        </div>

        {/* Phase Navigation Tabs */}
        <div className="relative z-10 bg-slate-950/90 border-t border-slate-800 px-6 flex items-center gap-2 overflow-x-auto scrollbar-none py-2 text-xs font-black">
          {[
            { id: 'menu', label: 'Dish Menu & Stock', icon: UtensilsCrossed, count: vendorMenu.length },
            { id: 'orders', label: 'Incoming Orders', icon: ShoppingBag, count: liveOrders.length },
            { id: 'profile', label: 'Stand Identity & Slogan', icon: Store },
            { id: 'workers', label: 'Staff & Workers', icon: Users, count: workers.length }
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  triggerHaptic(20);
                  setActiveTab(tab.id as any);
                }}
                className={`px-4 py-2 rounded-xl flex items-center gap-2 transition-all cursor-pointer ${
                  isActive
                    ? 'bg-[#D6001C] text-white shadow-sm'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
                {tab.count !== undefined && (
                  <span className={`text-[10px] font-black px-1.5 py-0.2 rounded-full ${isActive ? 'bg-white text-[#D6001C]' : 'bg-slate-800 text-slate-300'}`}>
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

      </div>

      {/* 2. TAB CONTENT */}
      <AnimatePresence mode="wait">
        
        {/* TAB 1: MENU & STOCK MANAGEMENT */}
        {activeTab === 'menu' && (
          <motion.div
            key="menu-tab"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="space-y-6"
          >
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-5 rounded-3xl border border-rose-100 dark:border-slate-800 shadow-xs">
              <div>
                <h2 className="text-lg font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <UtensilsCrossed className="w-5 h-5 text-[#D6001C]" />
                  <span>Live Menu & Food Stock Controls</span>
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Toggle items in or out of stock instantly. Out-of-stock items will not appear for ordering.
                </p>
              </div>

              <button
                onClick={() => setShowAddDish(true)}
                className="bg-[#D6001C] hover:bg-red-700 text-white font-extrabold px-4 py-2.5 rounded-2xl text-xs flex items-center gap-1.5 shadow-md shadow-red-500/20 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Add New Food Item</span>
              </button>
            </div>

            {/* Menu Items Grid */}
            {vendorMenu.length === 0 ? (
              <div className="bg-white dark:bg-slate-900 p-12 rounded-3xl border border-rose-100 dark:border-slate-800 text-center space-y-3">
                <ChefHat className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto" />
                <h3 className="font-extrabold text-base text-slate-700 dark:text-slate-300">No dishes uploaded yet for this stand</h3>
                <p className="text-xs text-slate-400 dark:text-slate-500 max-w-sm mx-auto">
                  Click "Add New Food Item" above or use the Admin Bulk CSV importer to populate your food catalog.
                </p>
                <button
                  onClick={() => setShowAddDish(true)}
                  className="bg-slate-900 dark:bg-slate-800 text-white font-bold px-4 py-2 rounded-xl text-xs cursor-pointer hover:bg-slate-800 dark:hover:bg-slate-700"
                >
                  Create First Dish
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {vendorMenu.map((item) => (
                  <div
                    key={item.id}
                    className={`bg-white dark:bg-slate-900 rounded-3xl p-4 border transition-all shadow-xs flex flex-col justify-between ${
                      item.available ? 'border-slate-200/90 dark:border-slate-800' : 'border-rose-200 dark:border-rose-900/50 bg-rose-50/20 dark:bg-rose-950/10 opacity-80'
                    }`}
                  >
                    <div className="space-y-3">
                      <div className="relative h-36 rounded-2xl overflow-hidden bg-slate-100 dark:bg-slate-800">
                        <img
                          src={item.image_url || 'https://images.unsplash.com/photo-1512058564366-18510be2db19?w=500&auto=format&fit=crop'}
                          alt={item.name}
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute top-2 right-2">
                          <span className={`text-[10px] font-black px-2.5 py-1 rounded-full uppercase shadow-xs ${
                            item.available ? 'bg-emerald-500 text-white' : 'bg-rose-600 text-white'
                          }`}>
                            {item.available ? 'IN STOCK' : 'SOLD OUT'}
                          </span>
                        </div>
                      </div>

                      <div>
                        <h3 className="font-black text-sm text-slate-900 dark:text-slate-100">{item.name}</h3>
                        {item.description && (
                          <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mt-0.5">{item.description}</p>
                        )}
                        <div className="mt-2 flex items-center justify-between">
                          <span className="text-base font-black text-[#D6001C] font-mono">
                            ₦{Number(item.price || item.base_price || 0).toLocaleString()}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Action Controls */}
                    <div className="pt-3 mt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                      <button
                        onClick={() => handleToggleItemAvailability(item)}
                        className={`flex-1 py-2 px-3 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                          item.available
                            ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-900/60 border border-rose-200 dark:border-rose-900/50'
                            : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 border border-emerald-200 dark:border-emerald-900/50'
                        }`}
                      >
                        {item.available ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        <span>{item.available ? 'Mark Sold Out' : 'Mark Available'}</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        )}

        {/* TAB 2: INCOMING ORDERS */}
        {activeTab === 'orders' && (
          <motion.div
            key="orders-tab"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="space-y-4"
          >
            <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-rose-100 dark:border-slate-800 shadow-xs flex items-center justify-between">
              <div>
                <h2 className="text-lg font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <ShoppingBag className="w-5 h-5 text-[#D6001C]" />
                  <span>Active Kitchen Orders Queue</span>
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">Live order flow synchronized with student apps and campus riders.</p>
              </div>
              <span className="bg-rose-50 dark:bg-rose-950/60 text-[#D6001C] dark:text-rose-400 font-black text-xs px-3 py-1 rounded-full border border-rose-100 dark:border-rose-900/50">
                {liveOrders.length} Orders
              </span>
            </div>

            {liveOrders.length === 0 ? (
              <div className="bg-white dark:bg-slate-900 p-12 rounded-3xl border border-rose-100 dark:border-slate-800 text-center space-y-2">
                <Bell className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto" />
                <h3 className="font-extrabold text-slate-700 dark:text-slate-300 text-sm">No active incoming orders right now</h3>
                <p className="text-xs text-slate-400 dark:text-slate-500">When customers place meal orders for your stand, they will appear here in realtime.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {liveOrders.map((ord) => (
                  <div key={ord.id} className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
                    <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 font-mono">ORDER #{ord.id.slice(-6)}</span>
                        <h4 className="font-extrabold text-sm text-slate-900 dark:text-slate-100">{ord.customer_name || ord.user_name || 'MTU Student'}</h4>
                        {ord.customer_phone && (
                          <p className="text-[11px] text-slate-500 dark:text-slate-400">{ord.customer_phone}</p>
                        )}
                      </div>
                      <span className={`text-[10px] font-black px-2.5 py-1 rounded-full uppercase ${
                        ord.status === 'pending' || ord.status === 'payment_confirmed'
                          ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300'
                          : ord.status === 'preparing'
                          ? 'bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300'
                          : ord.status === 'ready' || ord.status === 'ready_for_pickup'
                          ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-300'
                      }`}>
                        {ord.status.replace(/_/g, ' ')}
                      </span>
                    </div>

                    {/* Delivery Destination Snapshot */}
                    <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-100 dark:border-slate-700 text-xs">
                      <span className="font-bold text-slate-500 dark:text-slate-400 block text-[10px] uppercase">Destination:</span>
                      <p className="font-bold text-slate-800 dark:text-slate-200">{ord.delivery_address}</p>
                      {ord.delivery_room && <p className="text-emerald-700 dark:text-emerald-400 font-bold">Room: {ord.delivery_room}</p>}
                    </div>

                    <div className="space-y-1 text-xs text-slate-700 dark:text-slate-300">
                      {ord.items?.map((it, idx) => (
                        <div key={idx} className="flex justify-between">
                          <span>{it.quantity}x {it.name}</span>
                          <span className="font-mono font-bold">₦{((Number(it.price) || 0) * it.quantity).toLocaleString()}</span>
                        </div>
                      ))}
                    </div>

                    <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
                      <span className="font-bold text-slate-500 dark:text-slate-400">Payment: {ord.payment_status?.toUpperCase() || 'PAID'}</span>
                      <span className="font-black text-[#D6001C] font-mono text-sm">₦{Number(ord.total_price || ord.total || 0).toLocaleString()}</span>
                    </div>

                    {/* Prominent Pickup PIN Box for Kitchen -> Rider Handover */}
                    {(ord.status === 'ready' || ord.status === 'ready_for_pickup') && (
                      <div className="p-3 rounded-2xl bg-emerald-600 text-white text-center shadow-md">
                        <span className="text-[10px] uppercase font-bold tracking-wider opacity-90 block">
                          Rider Pickup Verification Code
                        </span>
                        <span className="text-2xl font-black tracking-widest block my-0.5">
                          {ord.pickup_code || '3914'}
                        </span>
                        <span className="text-[10px] opacity-80 block">
                          Rider must enter this code to collect meal
                        </span>
                      </div>
                    )}

                    {/* Status Advance Buttons */}
                    <div className="pt-2 flex flex-col gap-1.5">
                      {(ord.status === 'pending' || ord.status === 'payment_confirmed') && (
                        <div className="space-y-1.5">
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleUpdateOrderStatus(ord.id, 'vendor_accepted')}
                              className="flex-1 bg-slate-900 dark:bg-slate-800 hover:bg-black dark:hover:bg-slate-700 text-white font-extrabold py-2 rounded-xl text-xs cursor-pointer"
                            >
                              Accept Order
                            </button>
                            <button
                              onClick={() => handleUpdateOrderStatus(ord.id, 'preparing')}
                              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-extrabold py-2 rounded-xl text-xs cursor-pointer"
                            >
                              Start Cooking
                            </button>
                          </div>
                          <button
                            onClick={() => {
                              const reason = window.prompt('Reason for rejecting order (e.g., ingredients out of stock):', 'Items currently unavailable at kitchen stand');
                              if (reason) {
                                handleUpdateOrderStatus(ord.id, 'cancelled', reason);
                              }
                            }}
                            className="w-full py-1.5 text-center text-[11px] font-bold text-rose-600 dark:text-rose-400 hover:text-rose-700 dark:hover:text-rose-300 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/60 rounded-xl transition-colors cursor-pointer border border-rose-200 dark:border-rose-900/50"
                          >
                            Decline / Out of Stock (Auto-Refund Customer)
                          </button>
                        </div>
                      )}
                      {ord.status === 'vendor_accepted' && (
                        <button
                          onClick={() => handleUpdateOrderStatus(ord.id, 'preparing')}
                          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-extrabold py-2.5 rounded-xl text-xs cursor-pointer"
                        >
                          Start Preparing Food
                        </button>
                      )}
                      {ord.status === 'preparing' && (
                        <button
                          onClick={() => handleUpdateOrderStatus(ord.id, 'ready_for_pickup')}
                          className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black py-2.5 rounded-xl text-xs cursor-pointer shadow-md shadow-emerald-600/30"
                        >
                          Ready for Rider Pickup (Generate PIN)
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        )}

        {/* TAB 3: STAND IDENTITY & SLOGAN */}
        {activeTab === 'profile' && (
          <motion.div
            key="profile-tab"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="bg-white dark:bg-slate-900 p-6 sm:p-8 rounded-3xl border border-rose-100 dark:border-slate-800 shadow-xs max-w-3xl space-y-6"
          >
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
              <div>
                <h2 className="text-lg font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <Store className="w-5 h-5 text-[#D6001C]" />
                  <span>Stand Identity, Cover Photo & Slogan</span>
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Customize how your food stand appears to campus students across the platform.
                </p>
              </div>
            </div>

            <form onSubmit={handleSaveProfile} className="space-y-4">
              
              {/* Slogan Field */}
              <div>
                <label className="block text-xs font-extrabold text-slate-700 dark:text-slate-300 mb-1">
                  Stand Slogan / Motto
                </label>
                <input
                  type="text"
                  value={slogan}
                  onChange={(e) => setSlogan(e.target.value)}
                  placeholder="e.g. Best Spicy Jollof & Asun in MTU"
                  className="w-full p-3 rounded-2xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-xs font-semibold focus:ring-2 focus:ring-[#D6001C] outline-none"
                />
                <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">Displayed directly under your stand name on the customer home page.</p>
              </div>

              {/* Click to Upload Cover & Logo */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <ImageUploadInput
                  label="Stand Cover Photo (Click to Upload)"
                  value={coverUrl}
                  onChange={(url) => setCoverUrl(url)}
                  presetCategory="vendor"
                  aspectRatio="landscape"
                  placeholder="Upload kitchen cover banner"
                />
                <ImageUploadInput
                  label="Logo / Badge (Click to Upload)"
                  value={logoUrl}
                  onChange={(url) => setLogoUrl(url)}
                  presetCategory="logo"
                  aspectRatio="square"
                  placeholder="Upload square stand logo"
                />
              </div>

              {/* Operating Hours & Prep Time */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-extrabold text-slate-700 dark:text-slate-300 mb-1">
                    Opening Time
                  </label>
                  <input
                    type="time"
                    value={openingTime}
                    onChange={(e) => setOpeningTime(e.target.value)}
                    className="w-full p-2.5 rounded-2xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-xs font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-extrabold text-slate-700 dark:text-slate-300 mb-1">
                    Closing Time
                  </label>
                  <input
                    type="time"
                    value={closingTime}
                    onChange={(e) => setClosingTime(e.target.value)}
                    className="w-full p-2.5 rounded-2xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-xs font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-extrabold text-slate-700 dark:text-slate-300 mb-1">
                    Prep & Delivery Time
                  </label>
                  <input
                    type="text"
                    value={prepTime}
                    onChange={(e) => setPrepTime(e.target.value)}
                    placeholder="15-25 min"
                    className="w-full p-2.5 rounded-2xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-xs font-bold"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full bg-[#D6001C] hover:bg-red-700 text-white font-extrabold py-3.5 rounded-2xl text-xs uppercase tracking-wider shadow-lg shadow-red-500/20 cursor-pointer"
              >
                Save Stand Profile & Slogan
              </button>

            </form>
          </motion.div>
        )}

        {/* TAB 4: WORKERS & STAFF */}
        {activeTab === 'workers' && (
          <motion.div
            key="workers-tab"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="space-y-6"
          >
            <div className="flex items-center justify-between bg-white dark:bg-slate-900 p-5 rounded-3xl border border-rose-100 dark:border-slate-800 shadow-xs">
              <div>
                <h2 className="text-lg font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <Users className="w-5 h-5 text-[#D6001C]" />
                  <span>Kitchen Staff & Worker Roster</span>
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Manage chefs, kitchen hands, and cashiers assigned to this stand.
                </p>
              </div>

              <button
                onClick={() => setShowAddWorker(true)}
                className="bg-[#D6001C] hover:bg-red-700 text-white font-extrabold px-4 py-2.5 rounded-2xl text-xs flex items-center gap-1.5 shadow-md shadow-red-500/20 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Add Staff Member</span>
              </button>
            </div>

            {/* Workers Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {workers.map((w) => (
                <div key={w.id} className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-rose-50 dark:bg-rose-950/60 text-[#D6001C] dark:text-rose-400 flex items-center justify-center font-black text-sm shrink-0 border border-rose-100 dark:border-rose-900/50">
                      <ChefHat className="w-6 h-6" />
                    </div>
                    <div>
                      <h4 className="font-extrabold text-sm text-slate-900 dark:text-slate-100">{w.name}</h4>
                      <span className="text-[11px] font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/60 px-2 py-0.5 rounded-md inline-block mt-0.5">
                        {w.role}
                      </span>
                      {w.phone && (
                        <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1 flex items-center gap-1">
                          <Phone className="w-3 h-3 text-slate-400 dark:text-slate-500" /> {w.phone}
                        </p>
                      )}
                    </div>
                  </div>

                  <button
                    onClick={() => handleRemoveWorker(w.id)}
                    className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition-colors cursor-pointer"
                    title="Remove worker"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </motion.div>
        )}

      </AnimatePresence>

      {/* MODAL: ADD FOOD ITEM */}
      {showAddDish && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl border border-slate-100 dark:border-slate-800 space-y-4"
          >
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="font-black text-base text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <UtensilsCrossed className="w-5 h-5 text-[#D6001C]" />
                <span>Add Dish to Stand</span>
              </h3>
              <button
                onClick={() => setShowAddDish(false)}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 text-xs font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateDish} className="space-y-3">
              <div>
                <label className="block text-xs font-extrabold text-slate-700 dark:text-slate-300 mb-1">Dish Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Special Jollof Rice + Turkey"
                  value={dishName}
                  onChange={(e) => setDishName(e.target.value)}
                  className="w-full p-2.5 rounded-2xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-xs font-semibold"
                />
              </div>

              <div>
                <label className="block text-xs font-extrabold text-slate-700 dark:text-slate-300 mb-1">Category</label>
                <select
                  value={dishCategory}
                  onChange={(e) => setDishCategory(e.target.value)}
                  className="w-full p-2.5 rounded-2xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-xs font-semibold"
                >
                  <option value="Rice & Grains">Rice & Grains</option>
                  <option value="Swallow & Soups">Swallow & Soups</option>
                  <option value="Pasta & Noodles">Pasta & Noodles</option>
                  <option value="Proteins & Grills">Proteins & Grills</option>
                  <option value="Fast Food & Snacks">Fast Food & Snacks</option>
                  <option value="Drinks & Beverages">Drinks & Beverages</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-extrabold text-slate-700 dark:text-slate-300 mb-1">Price (₦) *</label>
                <input
                  type="number"
                  required
                  min="50"
                  placeholder="1800"
                  value={dishPrice}
                  onChange={(e) => setDishPrice(e.target.value)}
                  className="w-full p-2.5 rounded-2xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-xs font-mono font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-extrabold text-slate-700 dark:text-slate-300 mb-1">Description</label>
                <input
                  type="text"
                  placeholder="Served piping hot with fried plantains"
                  value={dishDesc}
                  onChange={(e) => setDishDesc(e.target.value)}
                  className="w-full p-2.5 rounded-2xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-xs"
                />
              </div>

              <div>
                <ImageUploadInput
                  label="Dish Photo (Click to Upload)"
                  value={dishImage}
                  onChange={(url) => setDishImage(url)}
                  presetCategory="dish"
                  aspectRatio="landscape"
                  placeholder="Upload dish photo"
                />
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddDish(false)}
                  className="w-1/2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 font-bold py-2.5 rounded-2xl text-xs cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="w-1/2 bg-[#D6001C] hover:bg-red-700 text-white font-extrabold py-2.5 rounded-2xl text-xs shadow-md cursor-pointer"
                >
                  Save Dish
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* MODAL: ADD WORKER */}
      {showAddWorker && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white dark:bg-slate-900 rounded-3xl p-6 max-w-sm w-full shadow-2xl border border-slate-100 dark:border-slate-800 space-y-4"
          >
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
              <h3 className="font-black text-sm text-slate-900 dark:text-slate-100">Add Staff Member</h3>
              <button onClick={() => setShowAddWorker(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xs font-bold cursor-pointer">✕</button>
            </div>

            <form onSubmit={handleAddWorker} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. John Doe"
                  value={newWorkerName}
                  onChange={(e) => setNewWorkerName(e.target.value)}
                  className="w-full p-2.5 rounded-2xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Role</label>
                <select
                  value={newWorkerRole}
                  onChange={(e) => setNewWorkerRole(e.target.value)}
                  className="w-full p-2.5 rounded-2xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-xs font-semibold"
                >
                  <option value="Head Chef">Head Chef</option>
                  <option value="Cook / Griller">Cook / Griller</option>
                  <option value="Kitchen Assistant">Kitchen Assistant</option>
                  <option value="Cashier & Dispatch">Cashier & Dispatch</option>
                  <option value="Stand Supervisor">Stand Supervisor</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Phone Number</label>
                <input
                  type="tel"
                  placeholder="+234 800 000 0000"
                  value={newWorkerPhone}
                  onChange={(e) => setNewWorkerPhone(e.target.value)}
                  className="w-full p-2.5 rounded-2xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-xs"
                />
              </div>

              <button
                type="submit"
                className="w-full bg-[#D6001C] hover:bg-red-700 text-white font-extrabold py-2.5 rounded-2xl text-xs shadow-md mt-2 cursor-pointer"
              >
                Add Staff Member
              </button>
            </form>
          </motion.div>
        </div>
      )}

    </div>
  );
};

import React, { useState } from 'react';
import { Plus, Edit2, Trash2, ShieldCheck, Store, Sparkles, AlertCircle, MapPin } from 'lucide-react';
import { doc, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { University, Campus, FoodZone, Vendor, VendorType, KitchenDetails } from '../../types';
import { triggerHaptic } from '../../utils/haptics';
import { toast } from 'sonner';
import { useMarketplaceStore } from '../../stores/useMarketplaceStore';
import { ImageUploadInput } from '../common/ImageUploadInput';
import { initializeKitchenProfile } from '../../services/kitchenService';

interface VendorManagerProps {
  universities: University[];
  campuses: Campus[];
  foodZones: FoodZone[];
  vendors: Vendor[];
}

const vendorTypeOptions: { value: VendorType; label: string }[] = [
  { value: 'cafeteria', label: 'Cafeteria' },
  { value: 'buka', label: 'Buka / Local Joint' },
  { value: 'restaurant', label: 'Restaurant' },
  { value: 'fast_food', label: 'Fast Food' },
  { value: 'pizza', label: 'Pizza & Shawarma' },
  { value: 'shawarma', label: 'Shawarma Stand' },
  { value: 'coffee_shop', label: 'Coffee Shop & Cafe' },
  { value: 'bakery', label: 'Bakery & Pastries' },
  { value: 'snacks', label: 'Snacks & Small Chops' },
  { value: 'drinks', label: 'Drinks & Smoothies' },
  { value: 'food_stall', label: 'Food Stall' },
  { value: 'food_court', label: 'Food Court Stand' },
  { value: 'hostel_vendor', label: 'Hostel Food Seller' },
  { value: 'other', label: 'Other Vendor' }
];

const NIGERIAN_VENDOR_PRESETS = [
  {
    name: 'Mama Blessing Kitchen',
    slogan: 'Fresh hot campus jollof & local soups made daily',
    vendor_type: 'cafeteria' as VendorType,
    description: 'Specializing in firewood smokey jollof rice, assorted goat meat, and fresh pounded yam.',
    logo_url: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&q=80&w=200',
    cover_image_url: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&q=80&w=800'
  },
  {
    name: '2001 Cafeteria',
    slogan: 'Legendary campus student meals since 2001',
    vendor_type: 'cafeteria' as VendorType,
    description: 'Full-service campus cafeteria serving hearty rice dishes, beans, fried chicken, and soups.',
    logo_url: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&q=80&w=200',
    cover_image_url: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&q=80&w=800'
  },
  {
    name: 'Mavise Buka Joint',
    slogan: 'Hot amala, abula, and traditional Nigerian delicacies',
    vendor_type: 'buka' as VendorType,
    description: 'The number one spot for authentic black amala, gbegiri, ewedu, and cow leg.',
    logo_url: 'https://images.unsplash.com/photo-1604329760661-e71dc83f8f26?auto=format&fit=crop&q=80&w=200',
    cover_image_url: 'https://images.unsplash.com/photo-1604329760661-e71dc83f8f26?auto=format&fit=crop&q=80&w=800'
  },
  {
    name: 'Pastor T Shawarma & Grills',
    slogan: 'Loaded double sausage beef shawarma & BBQ wings',
    vendor_type: 'shawarma' as VendorType,
    description: 'Crispy, juicy shawarma and sizzling spicy peppered grills for late-night students.',
    logo_url: 'https://images.unsplash.com/photo-1561651823-34feb02250e4?auto=format&fit=crop&q=80&w=200',
    cover_image_url: 'https://images.unsplash.com/photo-1561651823-34feb02250e4?auto=format&fit=crop&q=80&w=800'
  },
  {
    name: 'Korede Spicy Spaghetti Hub',
    slogan: 'The iconic campus stir-fry peppered pasta',
    vendor_type: 'fast_food' as VendorType,
    description: 'Fast, hot, and spicy noodles & spaghetti packed with boiled eggs and shredded chicken.',
    logo_url: 'https://images.unsplash.com/photo-1551183053-bf91a1d81141?auto=format&fit=crop&q=80&w=200',
    cover_image_url: 'https://images.unsplash.com/photo-1551183053-bf91a1d81141?auto=format&fit=crop&q=80&w=800'
  },
  {
    name: 'Fresh Bakes & Smoothies',
    slogan: 'Fresh bakery treats, parfaits, and natural juices',
    vendor_type: 'bakery' as VendorType,
    description: 'Pastries, meat pies, yoghurts, parfaits, and refreshing drinks.',
    logo_url: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&q=80&w=200',
    cover_image_url: 'https://images.unsplash.com/photo-1553530666-ba11a7da3888?auto=format&fit=crop&q=80&w=800'
  }
];

export const VendorManager: React.FC<VendorManagerProps> = ({ universities, campuses, foodZones, vendors }) => {
  const store = useMarketplaceStore();
  
  const [selectedUniId, setSelectedUniId] = useState<string>(
    store.selectedUniversityId || universities[0]?.id || 'uni_mtu'
  );
  
  const availableCampuses = campuses.filter(c => c.university_id === selectedUniId);
  const [selectedCampusId, setSelectedCampusId] = useState<string>(
    availableCampuses[0]?.id || ''
  );
  
  const currentCampusId = selectedCampusId || (availableCampuses[0]?.id || '');
  const availableZones = foodZones.filter(z => z.campus_id === currentCampusId);
  const [selectedZoneIdFilter, setSelectedZoneIdFilter] = useState<string>('all');

  const [showModal, setShowModal] = useState(false);
  const [editingVendor, setEditingVendor] = useState<Vendor | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [form, setForm] = useState({
    name: '',
    slogan: '',
    food_zone_id: '',
    vendor_type: 'cafeteria' as VendorType,
    description: '',
    logo_url: '',
    cover_image_url: '',
    worker_ids_raw: 'chef_01, cashier_01',
    phone: '+234 800 000 0000',
    email: '',
    address: 'Campus Food Hub',
    opening_time: '07:30',
    closing_time: '21:00',
    delivery_available: true,
    pickup_available: true,
    is_open: true,
    is_verified: true,
    is_active: true
  });

  const filteredVendors = vendors.filter(v => {
    if (selectedUniId && v.university_id && v.university_id !== selectedUniId) return false;
    if (currentCampusId && v.campus_id && v.campus_id !== currentCampusId) return false;
    if (selectedZoneIdFilter !== 'all' && v.food_zone_id !== selectedZoneIdFilter) return false;
    return true;
  });

  const openNewModal = () => {
    setEditingVendor(null);
    setFormError(null);
    setForm({
      name: '',
      slogan: 'Fresh, delicious meals made daily on campus!',
      food_zone_id: availableZones[0]?.id || '',
      vendor_type: 'cafeteria',
      description: '',
      logo_url: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&q=80&w=200',
      cover_image_url: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&q=80&w=800',
      worker_ids_raw: 'chef_01, cashier_01',
      phone: '+234 800 000 0000',
      email: '',
      address: 'Campus Food Hub',
      opening_time: '07:30',
      closing_time: '21:00',
      delivery_available: true,
      pickup_available: true,
      is_open: true,
      is_verified: true,
      is_active: true
    });
    setShowModal(true);
  };

  const openEditModal = (v: Vendor) => {
    setEditingVendor(v);
    setFormError(null);
    const workerIds = v.kitchen_details?.worker_ids || v.worker_ids || (v.workers ? v.workers.map(w => w.id) : []);
    setForm({
      name: v.name,
      slogan: v.kitchen_details?.slogan || v.slogan || '',
      food_zone_id: v.food_zone_id || '',
      vendor_type: v.vendor_type || 'cafeteria',
      description: v.description || '',
      logo_url: v.logo_url || '',
      cover_image_url: v.kitchen_details?.cover_image_url || v.cover_image_url || '',
      worker_ids_raw: workerIds.length > 0 ? workerIds.join(', ') : 'chef_lead, cashier_01',
      phone: v.phone || '',
      email: v.email || '',
      address: v.address || 'Campus grounds',
      opening_time: v.opening_time || '07:30',
      closing_time: v.closing_time || '21:00',
      delivery_available: v.delivery_available ?? true,
      pickup_available: v.pickup_available ?? true,
      is_open: v.is_open ?? true,
      is_verified: v.is_verified ?? true,
      is_active: v.is_active ?? true
    });
    setShowModal(true);
  };

  const applyPreset = (preset: typeof NIGERIAN_VENDOR_PRESETS[0]) => {
    setForm(prev => ({
      ...prev,
      name: preset.name,
      slogan: preset.slogan,
      vendor_type: preset.vendor_type,
      description: preset.description,
      logo_url: preset.logo_url,
      cover_image_url: preset.cover_image_url
    }));
    toast.success(`Loaded preset for ${preset.name}`);
  };

  const handleSaveVendor = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    triggerHaptic(50);

    if (!form.name.trim()) {
      setFormError('Please enter a vendor or kitchen name.');
      return;
    }

    // Auto-resolve university
    let uniId = selectedUniId;
    if (!uniId && universities.length > 0) {
      uniId = universities[0].id;
    } else if (!uniId) {
      uniId = 'uni_mtu';
      const defaultUni: University = {
        id: 'uni_mtu',
        name: 'Mountain Top University',
        short_name: 'MTU',
        slug: 'mountain-top-university',
        state: 'Ogun',
        city: 'Prayer City',
        country: 'Nigeria',
        latitude: 6.783,
        longitude: 3.441,
        is_active: true
      };
      await setDoc(doc(db, 'universities', 'uni_mtu'), defaultUni, { merge: true });
      store.addUniversity(defaultUni);
    }

    // Auto-resolve campus
    let campusId = currentCampusId;
    if (!campusId) {
      campusId = `campus_${uniId.replace('uni_', '')}_main`;
      const defaultCampus: Campus = {
        id: campusId,
        university_id: uniId,
        name: 'Main Campus',
        slug: 'main-campus',
        address: 'Main University Gate',
        latitude: 6.783,
        longitude: 3.441,
        is_active: true
      };
      await setDoc(doc(db, 'campuses', campusId), defaultCampus, { merge: true });
      store.addCampus(defaultCampus);
      setSelectedCampusId(campusId);
    }

    // Auto-resolve food zone
    let zoneId = form.food_zone_id;
    if (!zoneId) {
      zoneId = `zone_${campusId.replace('campus_', '')}_central`;
      const defaultZone: FoodZone = {
        id: zoneId,
        campus_id: campusId,
        university_id: uniId,
        name: 'Central Food Hub',
        description: 'Main campus dining area',
        latitude: 6.783,
        longitude: 3.441,
        is_active: true
      };
      await setDoc(doc(db, 'food_zones', zoneId), defaultZone, { merge: true });
      store.addFoodZone(defaultZone);
    }

    setIsSubmitting(true);

    const id = editingVendor ? editingVendor.id : `vendor_${form.name.toLowerCase().replace(/[^a-z0-9]+/g, '_')}_${Date.now().toString().slice(-4)}`;
    const slug = form.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');

    const workerIds = form.worker_ids_raw
      .split(',')
      .map(w => w.trim())
      .filter(w => w.length > 0);

    const kitchenDetails: KitchenDetails = {
      slogan: form.slogan || 'Fresh campus food delivered hot & fast!',
      cover_image_url: form.cover_image_url || 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&q=80&w=800',
      worker_ids: workerIds.length > 0 ? workerIds : ['w_lead_chef', 'w_cashier_01'],
      banner_url: form.cover_image_url,
      bio: form.description,
      average_prep_time_minutes: 15,
      contact_phone: form.phone,
      operating_status: form.is_open ? 'open' : 'closed',
      updated_at: new Date().toISOString()
    };

    const payload: Vendor = {
      id,
      university_id: uniId,
      campus_id: campusId,
      food_zone_id: zoneId,
      name: form.name.trim(),
      slug,
      slogan: kitchenDetails.slogan,
      description: form.description,
      vendor_type: form.vendor_type,
      logo_url: form.logo_url || 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&q=80&w=200',
      cover_image_url: kitchenDetails.cover_image_url,
      kitchen_details: kitchenDetails,
      worker_ids: kitchenDetails.worker_ids,
      phone: form.phone,
      email: form.email,
      address: form.address,
      latitude: 6.783,
      longitude: 3.441,
      opening_time: form.opening_time,
      closing_time: form.closing_time,
      estimated_delivery_time: '15-25 min',
      delivery_fee: 300,
      minimum_order: 500,
      delivery_available: form.delivery_available,
      pickup_available: form.pickup_available,
      is_open: form.is_open,
      is_verified: form.is_verified,
      is_active: form.is_active,
      rating: editingVendor?.rating || 4.8,
      review_count: editingVendor?.review_count || 12,
      created_at: editingVendor?.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    try {
      // 1. Optimistic Store Update
      if (editingVendor) {
        store.updateVendor(id, payload);
      } else {
        store.addVendor(payload);
      }

      // 2. Write to Firestore collections
      await setDoc(doc(db, 'vendors', id), payload, { merge: true });
      await setDoc(doc(db, 'restaurants', id), {
        id,
        name: payload.name,
        slogan: payload.slogan,
        description: payload.description,
        logo_url: payload.logo_url,
        cover_image_url: payload.cover_image_url,
        rating: payload.rating,
        delivery_fee: 300,
        estimated_delivery_time: '15-25 min',
        minimum_order: 500,
        is_open: payload.is_open,
        created_at: payload.created_at
      }, { merge: true });

      // 3. Initialize kitchen_details collection record
      await initializeKitchenProfile(id, kitchenDetails);

      setShowModal(false);
      setIsSubmitting(false);
      toast.success(editingVendor ? `Updated ${payload.name}` : `Added ${payload.name} successfully!`);
    } catch (err) {
      console.error('Error saving vendor:', err);
      setIsSubmitting(false);
      setFormError('Failed to save to Firestore. Check connection.');
    }
  };

  const handleDeleteVendor = async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to delete "${name}"?`)) return;
    triggerHaptic([40, 20, 40]);
    try {
      store.deleteVendor(id);
      await deleteDoc(doc(db, 'vendors', id));
      await deleteDoc(doc(db, 'restaurants', id)).catch(() => {});
      await deleteDoc(doc(db, 'kitchen_details', id)).catch(() => {});
      toast.info(`Deleted "${name}"`);
    } catch (err) {
      console.error('Error deleting vendor:', err);
      toast.error('Failed to delete vendor.');
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header & Filters */}
      <div className="bg-white p-6 rounded-3xl border border-rose-100 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
              <Store className="w-5 h-5 text-[#D6001C]" />
              Campus Vendors & Kitchens
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Manage cafeterias, bukas, and food stalls with rich kitchen details, slogan, cover images, and staff.
            </p>
          </div>
          <button
            onClick={openNewModal}
            className="bg-[#D6001C] hover:bg-red-700 text-white font-extrabold px-5 py-3 rounded-2xl text-xs flex items-center gap-2 shadow-md shadow-red-500/20 cursor-pointer transition-transform hover:scale-102 active:scale-98"
          >
            <Plus className="w-4 h-4" />
            <span>Add New Vendor</span>
          </button>
        </div>

        {/* Filter Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 border-t border-slate-100 text-xs">
          <div>
            <label className="font-extrabold text-slate-700 block mb-1">University</label>
            <select
              value={selectedUniId}
              onChange={e => {
                const uid = e.target.value;
                setSelectedUniId(uid);
                const camps = campuses.filter(c => c.university_id === uid);
                setSelectedCampusId(camps[0]?.id || '');
              }}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 font-bold bg-white focus:ring-2 focus:ring-[#D6001C] outline-none"
            >
              {universities.length === 0 ? (
                <option value="uni_mtu">Mountain Top University (MTU)</option>
              ) : (
                universities.map(u => (
                  <option key={u.id} value={u.id}>{u.name} ({u.short_name})</option>
                ))
              )}
            </select>
          </div>

          <div>
            <label className="font-extrabold text-slate-700 block mb-1">Campus</label>
            <select
              value={currentCampusId}
              onChange={e => setSelectedCampusId(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 font-bold bg-white focus:ring-2 focus:ring-[#D6001C] outline-none"
            >
              {availableCampuses.length === 0 ? (
                <option value="campus_main">Main Campus</option>
              ) : (
                availableCampuses.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))
              )}
            </select>
          </div>

          <div>
            <label className="font-extrabold text-slate-700 block mb-1">Food Zone Filter</label>
            <select
              value={selectedZoneIdFilter}
              onChange={e => setSelectedZoneIdFilter(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 font-bold bg-white focus:ring-2 focus:ring-[#D6001C] outline-none"
            >
              <option value="all">All Food Zones ({availableZones.length})</option>
              {availableZones.map(z => (
                <option key={z.id} value={z.id}>{z.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Vendors Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredVendors.length === 0 ? (
          <div className="col-span-full py-12 px-4 text-center bg-white rounded-3xl border border-dashed border-slate-200 space-y-3">
            <Store className="w-10 h-10 text-slate-300 mx-auto" />
            <div className="text-sm font-bold text-slate-700">No vendors found in this campus selection</div>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              Click the button below to add your first kitchen stand, or load our quick preset templates.
            </p>
            <button
              onClick={openNewModal}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#D6001C] text-white text-xs font-bold rounded-xl shadow-xs hover:bg-red-700 transition-colors"
            >
              <Plus className="w-4 h-4" /> Add Campus Vendor
            </button>
          </div>
        ) : (
          filteredVendors.map((v) => {
            const zoneObj = foodZones.find(z => z.id === v.food_zone_id);
            return (
              <div key={v.id} className="bg-white rounded-3xl border border-rose-100 shadow-xs overflow-hidden flex flex-col justify-between group hover:shadow-md transition-shadow">
                {/* Cover Header */}
                <div className="relative h-28 w-full bg-neutral-900 overflow-hidden">
                  <img
                    src={v.kitchen_details?.cover_image_url || v.cover_image_url || 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&q=80&w=800'}
                    alt={v.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 opacity-90"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
                  
                  {/* Open Status Badge */}
                  <div className="absolute top-3 left-3">
                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${v.is_open ? 'bg-emerald-500 text-white shadow-xs' : 'bg-neutral-800 text-neutral-300'}`}>
                      {v.is_open ? '● Open' : '○ Closed'}
                    </span>
                  </div>

                  {/* Actions */}
                  <div className="absolute top-3 right-3 flex items-center gap-1 bg-black/40 backdrop-blur-xs p-1 rounded-xl">
                    <button
                      onClick={() => openEditModal(v)}
                      className="p-1.5 text-white hover:text-emerald-400 hover:bg-white/10 rounded-lg transition-colors"
                      title="Edit Vendor"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDeleteVendor(v.id, v.name)}
                      className="p-1.5 text-rose-300 hover:text-rose-400 hover:bg-white/10 rounded-lg transition-colors"
                      title="Delete Vendor"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Logo Overlay */}
                  <div className="absolute -bottom-3 left-4">
                    <img
                      src={v.logo_url || 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&q=80&w=200'}
                      alt={v.name}
                      className="w-12 h-12 rounded-2xl object-cover border-2 border-white shadow-md bg-white"
                    />
                  </div>
                </div>

                {/* Details Body */}
                <div className="p-4 pt-5 space-y-2.5 flex-1 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-1.5">
                      <h3 className="font-extrabold text-slate-900 text-sm line-clamp-1">{v.name}</h3>
                      {v.is_verified && (
                        <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" title="Verified Campus Vendor" />
                      )}
                    </div>
                    {v.slogan && (
                      <p className="text-[11px] font-medium text-amber-700 italic line-clamp-1 mt-0.5">
                        "{v.slogan}"
                      </p>
                    )}
                    <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mt-1">
                      {v.vendor_type?.replace('_', ' ')} • {zoneObj?.name || 'Central Food Zone'}
                    </span>
                  </div>

                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500 font-medium">
                    <span className="flex items-center gap-1 font-mono">
                      🕒 {v.opening_time || '07:30'} - {v.closing_time || '21:00'}
                    </span>
                    <span className="text-emerald-700 font-semibold">
                      ★ {v.rating?.toFixed(1) || '4.8'}
                    </span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Add / Edit Vendor Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-xl rounded-3xl p-6 shadow-2xl border border-rose-100 animate-in zoom-in-95 duration-150 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-black text-slate-900 text-lg flex items-center gap-2">
                <Store className="w-5 h-5 text-[#D6001C]" />
                {editingVendor ? 'Edit Kitchen Stand' : 'Add Campus Food Vendor'}
              </h3>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            {/* Nigerian Presets Bar */}
            {!editingVendor && (
              <div className="my-3 p-3 bg-amber-50 rounded-2xl border border-amber-200/60 space-y-1.5">
                <div className="text-[11px] font-bold text-amber-900 flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                  Quick-Fill Verified Nigerian Kitchen Presets:
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {NIGERIAN_VENDOR_PRESETS.map((p, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => applyPreset(p)}
                      className="px-2.5 py-1 bg-white hover:bg-amber-100 text-[11px] font-semibold text-amber-900 rounded-lg border border-amber-200 transition-colors cursor-pointer"
                    >
                      + {p.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {formError && (
              <div className="my-3 p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                {formError}
              </div>
            )}

            <form onSubmit={handleSaveVendor} className="space-y-4 mt-3 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Vendor / Kitchen Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Mama Blessing Kitchen, 2001 Cafeteria, Korede Spaghetti"
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-[#D6001C] outline-none font-bold text-sm"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Kitchen Slogan / Catchphrase</label>
                <input
                  type="text"
                  placeholder="e.g. Fresh hot meals served daily with spicy aroma"
                  value={form.slogan}
                  onChange={e => setForm({ ...form, slogan: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-[#D6001C] outline-none font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Vendor Type *</label>
                  <select
                    value={form.vendor_type}
                    onChange={e => setForm({ ...form, vendor_type: e.target.value as VendorType })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-[#D6001C] outline-none font-medium bg-white"
                  >
                    {vendorTypeOptions.map(o => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Food Zone *</label>
                  <select
                    value={form.food_zone_id}
                    onChange={e => setForm({ ...form, food_zone_id: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-[#D6001C] outline-none font-medium bg-white"
                  >
                    <option value="">{availableZones.length > 0 ? 'Select Food Zone' : 'Central Food Zone (Auto)'}</option>
                    {availableZones.map(z => (
                      <option key={z.id} value={z.id}>{z.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Click to Upload Image Components */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <ImageUploadInput
                  label="Vendor Logo (Click to Upload)"
                  value={form.logo_url}
                  onChange={(url) => setForm(f => ({ ...f, logo_url: url }))}
                  presetCategory="logo"
                  aspectRatio="square"
                  placeholder="Upload square vendor logo"
                />
                <ImageUploadInput
                  label="Cover Banner (Click to Upload)"
                  value={form.cover_image_url}
                  onChange={(url) => setForm(f => ({ ...f, cover_image_url: url }))}
                  presetCategory="vendor"
                  aspectRatio="landscape"
                  placeholder="Upload kitchen cover banner"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Kitchen Worker IDs (comma-separated)</label>
                <input
                  type="text"
                  placeholder="chef_emmanuel, blessing_cashier, dispatch_01"
                  value={form.worker_ids_raw}
                  onChange={e => setForm({ ...form, worker_ids_raw: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 focus:ring-2 focus:ring-[#D6001C] outline-none font-mono text-[11px]"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Description / Bio</label>
                <textarea
                  rows={2}
                  placeholder="Details about food specialities, student combos, and opening days..."
                  value={form.description}
                  onChange={e => setForm({ ...form, description: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 focus:ring-2 focus:ring-[#D6001C] outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Opening Time</label>
                  <input
                    type="time"
                    value={form.opening_time}
                    onChange={e => setForm({ ...form, opening_time: e.target.value })}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-300 focus:ring-2 focus:ring-[#D6001C] outline-none"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Closing Time</label>
                  <input
                    type="time"
                    value={form.closing_time}
                    onChange={e => setForm({ ...form, closing_time: e.target.value })}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-300 focus:ring-2 focus:ring-[#D6001C] outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-1">
                <label className="flex items-center gap-2 p-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.is_open}
                    onChange={e => setForm({ ...form, is_open: e.target.checked })}
                    className="w-4 h-4 text-[#D6001C] rounded-md focus:ring-rose-500"
                  />
                  <span className="font-bold text-slate-800 text-xs">Currently Open</span>
                </label>

                <label className="flex items-center gap-2 p-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.is_verified}
                    onChange={e => setForm({ ...form, is_verified: e.target.checked })}
                    className="w-4 h-4 text-emerald-600 rounded-md focus:ring-emerald-500"
                  />
                  <span className="font-bold text-slate-800 text-xs">Verified Kitchen</span>
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 font-bold hover:bg-slate-100 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-6 py-2.5 rounded-xl bg-[#D6001C] text-white font-extrabold hover:bg-red-700 cursor-pointer shadow-md shadow-red-500/20 disabled:opacity-50"
                >
                  {isSubmitting ? 'Saving...' : 'Save Vendor'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

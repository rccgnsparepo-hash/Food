import React, { useState } from 'react';
import { Plus, Edit2, Trash2, CheckCircle, ShieldCheck, Clock, MapPin, Store } from 'lucide-react';
import { doc, setDoc, deleteDoc, updateDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { University, Campus, FoodZone, Vendor, VendorType } from '../../types';
import { triggerHaptic } from '../../utils/haptics';

interface VendorManagerProps {
  universities: University[];
  campuses: Campus[];
  foodZones: FoodZone[];
  vendors: Vendor[];
}

const vendorTypeOptions: { value: VendorType; label: string }[] = [
  { value: 'cafeteria', label: 'Cafeteria' },
  { value: 'buka', label: 'Buka' },
  { value: 'restaurant', label: 'Restaurant' },
  { value: 'fast_food', label: 'Fast Food' },
  { value: 'pizza', label: 'Pizza Shop' },
  { value: 'shawarma', label: 'Shawarma Vendor' },
  { value: 'coffee_shop', label: 'Coffee Shop / Cafe' },
  { value: 'bakery', label: 'Bakery' },
  { value: 'snacks', label: 'Snack Vendor' },
  { value: 'drinks', label: 'Drinks Bar' },
  { value: 'food_stall', label: 'Food Stall' },
  { value: 'food_court', label: 'Food Court' },
  { value: 'hostel_vendor', label: 'Hostel Food Seller' },
  { value: 'other', label: 'Other Small Business' }
];

export const VendorManager: React.FC<VendorManagerProps> = ({ universities, campuses, foodZones, vendors }) => {
  const [selectedUniId, setSelectedUniId] = useState<string>(universities[0]?.id || '');
  const [selectedCampusId, setSelectedCampusId] = useState<string>(campuses[0]?.id || '');
  const [selectedZoneIdFilter, setSelectedZoneIdFilter] = useState<string>('all');
  const [showModal, setShowModal] = useState(false);
  const [editingVendor, setEditingVendor] = useState<Vendor | null>(null);

  const availableCampuses = campuses.filter(c => c.university_id === selectedUniId);
  const currentCampusId = selectedCampusId || (availableCampuses[0]?.id || '');
  const availableZones = foodZones.filter(z => z.campus_id === currentCampusId);

  const [form, setForm] = useState({
    name: '',
    food_zone_id: '',
    vendor_type: 'cafeteria' as VendorType,
    description: '',
    logo_url: '',
    cover_image_url: '',
    phone: '',
    email: '',
    address: '',
    opening_time: '08:00',
    closing_time: '20:00',
    delivery_available: true,
    pickup_available: true,
    is_open: true,
    is_verified: true,
    is_active: true
  });

  const filteredVendors = vendors.filter(v => {
    if (v.university_id !== selectedUniId) return false;
    if (currentCampusId && v.campus_id !== currentCampusId) return false;
    if (selectedZoneIdFilter !== 'all' && v.food_zone_id !== selectedZoneIdFilter) return false;
    return true;
  });

  const openNewModal = () => {
    setEditingVendor(null);
    setForm({
      name: '',
      food_zone_id: availableZones[0]?.id || '',
      vendor_type: 'cafeteria',
      description: '',
      logo_url: '',
      cover_image_url: '',
      phone: '',
      email: '',
      address: '',
      opening_time: '08:00',
      closing_time: '20:00',
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
    setForm({
      name: v.name,
      food_zone_id: v.food_zone_id || '',
      vendor_type: v.vendor_type || 'cafeteria',
      description: v.description || '',
      logo_url: v.logo_url || '',
      cover_image_url: v.cover_image_url || '',
      phone: v.phone || '',
      email: v.email || '',
      address: v.address || '',
      opening_time: v.opening_time || '08:00',
      closing_time: v.closing_time || '20:00',
      delivery_available: v.delivery_available ?? true,
      pickup_available: v.pickup_available ?? true,
      is_open: v.is_open ?? true,
      is_verified: v.is_verified ?? true,
      is_active: v.is_active ?? true
    });
    setShowModal(true);
  };

  const handleSaveVendor = async (e: React.FormEvent) => {
    e.preventDefault();
    triggerHaptic(50);
    if (!selectedUniId || !currentCampusId) return;

    const id = editingVendor ? editingVendor.id : `vendor_${Date.now()}`;
    const slug = form.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');

    const payload: Vendor = {
      id,
      university_id: selectedUniId,
      campus_id: currentCampusId,
      food_zone_id: form.food_zone_id,
      name: form.name,
      slug,
      description: form.description,
      vendor_type: form.vendor_type,
      logo_url: form.logo_url || 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&q=80&w=200',
      cover_image_url: form.cover_image_url || 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&q=80&w=800',
      phone: form.phone,
      email: form.email,
      address: form.address,
      latitude: 6.518,
      longitude: 3.389,
      opening_time: form.opening_time,
      closing_time: form.closing_time,
      delivery_available: form.delivery_available,
      pickup_available: form.pickup_available,
      is_open: form.is_open,
      is_verified: form.is_verified,
      is_active: form.is_active,
      rating: editingVendor?.rating || 4.5,
      review_count: editingVendor?.review_count || 10,
      created_at: editingVendor?.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    try {
      await setDoc(doc(db, 'vendors', id), payload);
      // Sync backward-compatible restaurants collection
      await setDoc(doc(db, 'restaurants', id), {
        id,
        name: payload.name,
        description: payload.description || '',
        logo_url: payload.logo_url,
        cover_image_url: payload.cover_image_url,
        rating: payload.rating,
        delivery_fee: 300,
        estimated_delivery_time: '15-25 min',
        minimum_order: 500,
        address: payload.address || 'Campus grounds',
        latitude: payload.latitude,
        longitude: payload.longitude,
        is_open: payload.is_open,
        created_at: payload.created_at
      });

      setShowModal(false);
    } catch (err) {
      console.error('Error saving vendor:', err);
    }
  };

  const handleDeleteVendor = async (id: string) => {
    if (!window.confirm('Delete this vendor record?')) return;
    triggerHaptic([40, 20, 40]);
    try {
      await deleteDoc(doc(db, 'vendors', id));
      await deleteDoc(doc(db, 'restaurants', id));
    } catch (err) {
      console.error('Error deleting vendor:', err);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      
      {/* Header & Filters */}
      <div className="bg-white p-6 rounded-3xl border border-rose-100 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-black text-slate-900">🏪 Campus Vendors Manager</h2>
            <p className="text-xs text-slate-500 mt-0.5">Manage cafeterias, bukas, food stalls, and shops across university zones.</p>
          </div>
          <button
            onClick={openNewModal}
            className="bg-[#D6001C] hover:bg-red-700 text-white font-extrabold px-5 py-3 rounded-2xl text-xs flex items-center gap-2 shadow-md shadow-red-500/20 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add Vendor</span>
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
              {universities.map(u => (
                <option key={u.id} value={u.id}>{u.name} ({u.short_name})</option>
              ))}
            </select>
          </div>

          <div>
            <label className="font-extrabold text-slate-700 block mb-1">Campus</label>
            <select
              value={currentCampusId}
              onChange={e => setSelectedCampusId(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 font-bold bg-white focus:ring-2 focus:ring-[#D6001C] outline-none"
            >
              {availableCampuses.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="font-extrabold text-slate-700 block mb-1">Food Zone Filter</label>
            <select
              value={selectedZoneIdFilter}
              onChange={e => setSelectedZoneIdFilter(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 font-bold bg-white focus:ring-2 focus:ring-[#D6001C] outline-none"
            >
              <option value="all">All Food Zones</option>
              {availableZones.map(z => (
                <option key={z.id} value={z.id}>{z.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Vendors Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredVendors.length === 0 ? (
          <div className="col-span-full py-12 text-center text-xs text-slate-400 bg-white rounded-3xl border border-dashed border-slate-200">
            No vendors found for this selection. Click "Add Vendor" to enter a food seller.
          </div>
        ) : (
          filteredVendors.map((v) => {
            const zoneObj = foodZones.find(z => z.id === v.food_zone_id);
            return (
              <div key={v.id} className="bg-white rounded-3xl p-5 border border-rose-100 shadow-xs space-y-3 relative overflow-hidden">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <img
                      src={v.logo_url || 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&q=80&w=200'}
                      alt={v.name}
                      className="w-12 h-12 rounded-2xl object-cover border border-slate-200 shadow-xs"
                    />
                    <div>
                      <div className="flex items-center gap-1.5">
                        <h3 className="font-extrabold text-slate-900 text-sm">{v.name}</h3>
                        {v.is_verified && (
                          <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" title="Verified Vendor" />
                        )}
                      </div>
                      <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mt-0.5">
                        {v.vendor_type.replace('_', ' ')} • {zoneObj?.name || 'Unassigned Zone'}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => openEditModal(v)}
                      className="p-1.5 text-slate-600 hover:bg-slate-100 rounded-xl"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteVendor(v.id)}
                      className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-xl"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <p className="text-xs text-slate-500 line-clamp-2">{v.description || 'Campus vendor'}</p>

                <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
                  <span className={`px-2 py-0.5 rounded-full font-bold uppercase ${v.is_open ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-500'}`}>
                    {v.is_open ? 'Open Now' : 'Closed'}
                  </span>
                  <span className="text-slate-500 font-mono">
                    {v.opening_time || '08:00'} - {v.closing_time || '20:00'}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Add / Edit Vendor Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-3xl p-6 shadow-2xl border border-rose-100 animate-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto">
            <h3 className="font-extrabold text-slate-900 text-lg border-b border-slate-100 pb-3">
              {editingVendor ? 'Edit Vendor' : 'Add Campus Food Vendor'}
            </h3>

            <form onSubmit={handleSaveVendor} className="space-y-4 mt-4 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Vendor Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 2001 Cafeteria, Iya Moria, Korede Spaghetti"
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-[#D6001C] outline-none font-bold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Vendor Type *</label>
                  <select
                    value={form.vendor_type}
                    onChange={e => setForm({ ...form, vendor_type: e.target.value as VendorType })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-[#D6001C] outline-none font-medium"
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
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-[#D6001C] outline-none font-medium"
                  >
                    <option value="">Select Zone</option>
                    {availableZones.map(z => (
                      <option key={z.id} value={z.id}>{z.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Description</label>
                <textarea
                  rows={2}
                  placeholder="Details about meals, specialty, or campus history..."
                  value={form.description}
                  onChange={e => setForm({ ...form, description: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-[#D6001C] outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Logo URL</label>
                  <input
                    type="url"
                    placeholder="https://..."
                    value={form.logo_url}
                    onChange={e => setForm({ ...form, logo_url: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-[#D6001C] outline-none"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Cover Image URL</label>
                  <input
                    type="url"
                    placeholder="https://..."
                    value={form.cover_image_url}
                    onChange={e => setForm({ ...form, cover_image_url: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-[#D6001C] outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Opening Time</label>
                  <input
                    type="time"
                    value={form.opening_time}
                    onChange={e => setForm({ ...form, opening_time: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-[#D6001C] outline-none"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Closing Time</label>
                  <input
                    type="time"
                    value={form.closing_time}
                    onChange={e => setForm({ ...form, closing_time: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-[#D6001C] outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="is_open_check"
                    checked={form.is_open}
                    onChange={e => setForm({ ...form, is_open: e.target.checked })}
                    className="w-4 h-4 text-[#D6001C] rounded-md focus:ring-rose-500"
                  />
                  <label htmlFor="is_open_check" className="font-bold text-slate-800">
                    Currently Open
                  </label>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="is_verified_check"
                    checked={form.is_verified}
                    onChange={e => setForm({ ...form, is_verified: e.target.checked })}
                    className="w-4 h-4 text-emerald-600 rounded-md focus:ring-emerald-500"
                  />
                  <label htmlFor="is_verified_check" className="font-bold text-slate-800">
                    Verified Vendor
                  </label>
                </div>
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
                  className="px-5 py-2.5 rounded-xl bg-[#D6001C] text-white font-extrabold hover:bg-red-700 cursor-pointer shadow-md shadow-red-500/20"
                >
                  Save Vendor
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

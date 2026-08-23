import React, { useState } from 'react';
import { Plus, Edit2, Trash2, ShieldCheck, Flame, DollarSign, Sparkles, AlertCircle, Utensils } from 'lucide-react';
import { doc, setDoc, deleteDoc, collection, addDoc } from "../../lib/embeddedDb";
import { db } from '../../lib/firebase';
import { Vendor, FoodCategory, MenuItem, VerificationStatus, ItemStatus, MenuItemVariant } from '../../types';
import { triggerHaptic } from '../../utils/haptics';
import { toast } from 'sonner';
import { useMarketplaceStore } from '../../stores/useMarketplaceStore';
import { ImageUploadInput } from '../common/ImageUploadInput';

interface MenuBuilderProps {
  vendors: Vendor[];
  categories: FoodCategory[];
  menuItems: MenuItem[];
}

const NIGERIAN_DISH_PRESETS = [
  {
    name: 'Smokey Jollof Rice with Fried Chicken',
    category_id: 'cat_rice',
    base_price: 1800,
    description: 'Rich firewood party jollof served with crispy fried chicken and sweet dodo.',
    image_url: 'https://images.unsplash.com/photo-1512058564366-18510be2db19?auto=format&fit=crop&q=80&w=800',
    preparation_time: '12-15 min',
    spicy_level: 2
  },
  {
    name: 'Hot Amala with Ewedu & Assorted Meat',
    category_id: 'cat_swallow',
    base_price: 2200,
    description: 'Steaming black amala with gbegiri, fresh ewedu, and tender cow leg / assorted beef.',
    image_url: 'https://images.unsplash.com/photo-1604329760661-e71dc83f8f26?auto=format&fit=crop&q=80&w=800',
    preparation_time: '10-15 min',
    spicy_level: 3
  },
  {
    name: 'Korede Spicy Stir-Fry Spaghetti',
    category_id: 'cat_pasta',
    base_price: 1500,
    description: 'Iconic campus spaghetti tossed in spicy habanero pepper base, boiled eggs & sausages.',
    image_url: 'https://images.unsplash.com/photo-1551183053-bf91a1d81141?auto=format&fit=crop&q=80&w=800',
    preparation_time: '10-12 min',
    spicy_level: 3
  },
  {
    name: 'Double Sausage Beef Shawarma',
    category_id: 'cat_fast_food',
    base_price: 2500,
    description: 'Large pita wrap with spicy minced beef, 2 jumbo sausages, cabbage and creamy dressing.',
    image_url: 'https://images.unsplash.com/photo-1561651823-34feb02250e4?auto=format&fit=crop&q=80&w=800',
    preparation_time: '8-10 min',
    spicy_level: 2
  },
  {
    name: 'Special Fried Rice & Peppered Turkey',
    category_id: 'cat_rice',
    base_price: 2800,
    description: 'Vegetable fried rice with sweet corn, liver bits, and seasoned spicy peppered turkey.',
    image_url: 'https://images.unsplash.com/photo-1512058564366-18510be2db19?auto=format&fit=crop&q=80&w=800',
    preparation_time: '12-15 min',
    spicy_level: 2
  },
  {
    name: 'Spicy Catfish Pepper Soup',
    category_id: 'cat_soups',
    base_price: 3000,
    description: 'Fresh aromatic campus catfish pepper soup infused with scent leaf and local spices.',
    image_url: 'https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&q=80&w=800',
    preparation_time: '15-20 min',
    spicy_level: 4
  }
];

export const MenuBuilder: React.FC<MenuBuilderProps> = ({ vendors, categories, menuItems }) => {
  const store = useMarketplaceStore();
  const [selectedVendorId, setSelectedVendorId] = useState<string>(vendors[0]?.id || '');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('all');
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // If selected vendor was deleted or is empty, use first available vendor
  const activeVendorId = vendors.some(v => v.id === selectedVendorId)
    ? selectedVendorId
    : (vendors[0]?.id || '');

  const [form, setForm] = useState({
    name: '',
    category_id: categories[0]?.id || 'cat_rice',
    description: '',
    image_url: '',
    base_price: '' as string | number,
    available: true,
    student_friendly: true,
    spicy_level: 1,
    preparation_time: '15-20 min',
    verification_status: 'verified' as VerificationStatus,
    status: 'Available' as ItemStatus,
  });

  const [variants, setVariants] = useState<{ id: string; name: string; price: string | number; available: boolean }[]>([]);

  const filteredItems = menuItems.filter(item => {
    if (activeVendorId && item.vendor_id !== activeVendorId && item.restaurant_id !== activeVendorId) return false;
    if (selectedCategoryId !== 'all' && item.category_id !== selectedCategoryId) return false;
    return true;
  });

  const openNewModal = () => {
    setEditingItem(null);
    setErrorMessage(null);
    setForm({
      name: '',
      category_id: categories[0]?.id || 'cat_rice',
      description: '',
      image_url: 'https://images.unsplash.com/photo-1512058564366-18510be2db19?auto=format&fit=crop&q=80&w=800',
      base_price: 1500,
      available: true,
      student_friendly: true,
      spicy_level: 1,
      preparation_time: '12-15 min',
      verification_status: 'verified',
      status: 'Available',
    });
    setVariants([]);
    setShowModal(true);
  };

  const openEditModal = (item: MenuItem) => {
    setEditingItem(item);
    setErrorMessage(null);
    setForm({
      name: item.name,
      category_id: item.category_id || categories[0]?.id || 'cat_rice',
      description: item.description || '',
      image_url: item.image_url || '',
      base_price: item.base_price !== null && item.base_price !== undefined ? item.base_price : (item.price || ''),
      available: item.available ?? true,
      student_friendly: item.student_friendly ?? true,
      spicy_level: item.spicy_level || 0,
      preparation_time: item.preparation_time || '15-20 min',
      verification_status: item.verification_status || 'verified',
      status: item.status || 'Available',
    });
    setVariants(
      item.variants
        ? item.variants.map(v => ({ id: v.id, name: v.name, price: v.price ?? '', available: v.available }))
        : []
    );
    setShowModal(true);
  };

  const applyPreset = (preset: typeof NIGERIAN_DISH_PRESETS[0]) => {
    setForm(prev => ({
      ...prev,
      name: preset.name,
      category_id: preset.category_id,
      base_price: preset.base_price,
      description: preset.description,
      image_url: preset.image_url,
      preparation_time: preset.preparation_time,
      spicy_level: preset.spicy_level
    }));
    toast.success(`Loaded preset: ${preset.name}`);
  };

  const addVariantRow = () => {
    setVariants([...variants, { id: `var_${Date.now()}_${variants.length}`, name: '', price: '', available: true }]);
  };

  const removeVariantRow = (index: number) => {
    setVariants(variants.filter((_, i) => i !== index));
  };

  const handleSaveDish = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    triggerHaptic(50);

    if (!form.name.trim()) {
      setErrorMessage('Dish name is required.');
      return;
    }

    if (!activeVendorId) {
      setErrorMessage('Please create or select a vendor first before adding dishes.');
      return;
    }

    setIsSubmitting(true);
    const id = editingItem ? editingItem.id : `dish_${Date.now()}`;
    const parsedBasePrice = form.base_price !== '' && form.base_price !== null ? Number(form.base_price) : 0;

    // Log price history if updated
    if (editingItem && editingItem.base_price !== parsedBasePrice) {
      addDoc(collection(db, 'menu_price_history'), {
        menu_item_id: id,
        old_price: editingItem.base_price,
        new_price: parsedBasePrice,
        changed_by: 'Admin User',
        changed_at: new Date().toISOString(),
        reason: 'Manual update in Menu Builder'
      }).catch(() => {});
    }

    const compiledVariants: MenuItemVariant[] = variants.map(v => ({
      id: v.id,
      menu_item_id: id,
      name: v.name,
      price: v.price !== '' ? Number(v.price) : null,
      available: v.available,
      created_at: new Date().toISOString()
    }));

    const payload: MenuItem = {
      id,
      vendor_id: activeVendorId,
      restaurant_id: activeVendorId,
      category_id: form.category_id,
      name: form.name.trim(),
      description: form.description,
      image_url: form.image_url || 'https://images.unsplash.com/photo-1512058564366-18510be2db19?auto=format&fit=crop&q=80&w=800',
      base_price: parsedBasePrice,
      price: parsedBasePrice,
      available: form.available,
      student_friendly: form.student_friendly,
      spicy_level: form.spicy_level,
      preparation_time: form.preparation_time,
      verification_status: form.verification_status,
      status: form.status,
      variants: compiledVariants,
      created_at: editingItem?.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    try {
      if (editingItem) {
        store.updateMenuItem(id, payload);
      } else {
        store.addMenuItem(payload);
      }

      await setDoc(doc(db, 'menu_items', id), payload, { merge: true });
      setShowModal(false);
      setIsSubmitting(false);
      toast.success(editingItem ? `Updated ${payload.name}` : `Added ${payload.name} to menu!`);
    } catch (err) {
      console.error('Error saving dish:', err);
      setIsSubmitting(false);
      setErrorMessage('Failed to save dish to database.');
    }
  };

  const handleDeleteDish = async (id: string, name: string) => {
    if (!window.confirm(`Delete "${name}" from menu?`)) return;
    triggerHaptic([40, 20, 40]);
    try {
      store.deleteMenuItem(id);
      await deleteDoc(doc(db, 'menu_items', id));
      toast.info(`Deleted "${name}"`);
    } catch (err) {
      console.error('Error deleting dish:', err);
      toast.error('Failed to delete dish.');
    }
  };

  const currentVendor = vendors.find(v => v.id === activeVendorId);

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header & Vendor Picker */}
      <div className="bg-white p-6 rounded-3xl border border-rose-100 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
              <Utensils className="w-5 h-5 text-[#D6001C]" />
              Campus Food Menu Builder
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Manage dishes, prices, spicy levels, student combos, and photo uploads per vendor.
            </p>
          </div>
          <button
            onClick={openNewModal}
            disabled={vendors.length === 0}
            className="bg-[#D6001C] hover:bg-red-700 disabled:opacity-50 text-white font-extrabold px-5 py-3 rounded-2xl text-xs flex items-center gap-2 shadow-md shadow-red-500/20 cursor-pointer transition-transform hover:scale-102 active:scale-98"
          >
            <Plus className="w-4 h-4" />
            <span>Add Menu Item</span>
          </button>
        </div>

        {/* Vendor Selector & Category Filter */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-slate-100 text-xs">
          <div>
            <label className="font-extrabold text-slate-700 block mb-1">Select Campus Vendor / Kitchen</label>
            {vendors.length === 0 ? (
              <div className="p-2.5 bg-amber-50 border border-amber-200 text-amber-800 text-xs rounded-xl font-medium">
                No vendors created yet. Please add a vendor in the Vendors tab or use Bulk Import.
              </div>
            ) : (
              <select
                value={activeVendorId}
                onChange={e => setSelectedVendorId(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 font-bold bg-white focus:ring-2 focus:ring-[#D6001C] outline-none"
              >
                {vendors.map(v => (
                  <option key={v.id} value={v.id}>
                    {v.name} ({v.vendor_type?.replace('_', ' ')})
                  </option>
                ))}
              </select>
            )}
          </div>

          <div>
            <label className="font-extrabold text-slate-700 block mb-1">Filter by Category</label>
            <select
              value={selectedCategoryId}
              onChange={e => setSelectedCategoryId(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 font-bold bg-white focus:ring-2 focus:ring-[#D6001C] outline-none"
            >
              <option value="all">All Categories ({categories.length})</option>
              {categories.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Dishes Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {vendors.length === 0 ? (
          <div className="col-span-full py-12 px-4 text-center bg-white rounded-3xl border border-dashed border-slate-200 space-y-3">
            <Utensils className="w-10 h-10 text-slate-300 mx-auto" />
            <div className="text-sm font-bold text-slate-700">No Kitchens Found</div>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              Please create a campus vendor or food stall first before creating food menu items.
            </p>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="col-span-full py-12 px-4 text-center bg-white rounded-3xl border border-dashed border-slate-200 space-y-3">
            <Utensils className="w-10 h-10 text-slate-300 mx-auto" />
            <div className="text-sm font-bold text-slate-700">No dishes on this menu yet</div>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              Click below to add student combos, rice bowls, soups, or snacks to "{currentVendor?.name}".
            </p>
            <button
              onClick={openNewModal}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#D6001C] text-white text-xs font-bold rounded-xl shadow-xs hover:bg-red-700 transition-colors"
            >
              <Plus className="w-4 h-4" /> Add First Dish
            </button>
          </div>
        ) : (
          filteredItems.map(dish => {
            const categoryObj = categories.find(c => c.id === dish.category_id);
            return (
              <div
                key={dish.id}
                className="bg-white rounded-3xl border border-rose-100 shadow-xs overflow-hidden flex flex-col justify-between group hover:shadow-md transition-shadow"
              >
                {/* Dish Photo */}
                <div className="relative h-36 w-full bg-neutral-900 overflow-hidden">
                  <img
                    src={dish.image_url || 'https://images.unsplash.com/photo-1512058564366-18510be2db19?auto=format&fit=crop&q=80&w=800'}
                    alt={dish.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 opacity-90"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

                  {/* Price Tag */}
                  <div className="absolute bottom-3 left-3 bg-white/95 backdrop-blur-xs px-2.5 py-1 rounded-xl shadow-xs">
                    <span className="text-xs font-black text-[#D6001C]">
                      ₦{(dish.base_price ?? dish.price ?? 0).toLocaleString()}
                    </span>
                  </div>

                  {/* Action Buttons */}
                  <div className="absolute top-3 right-3 flex items-center gap-1 bg-black/40 backdrop-blur-xs p-1 rounded-xl">
                    <button
                      onClick={() => openEditModal(dish)}
                      className="p-1.5 text-white hover:text-emerald-400 hover:bg-white/10 rounded-lg transition-colors"
                      title="Edit Dish"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDeleteDish(dish.id, dish.name)}
                      className="p-1.5 text-rose-300 hover:text-rose-400 hover:bg-white/10 rounded-lg transition-colors"
                      title="Delete Dish"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Badges */}
                  <div className="absolute top-3 left-3 flex gap-1">
                    {dish.student_friendly && (
                      <span className="bg-emerald-500 text-white text-[9px] font-black uppercase px-2 py-0.5 rounded-full shadow-xs">
                        Student Deal
                      </span>
                    )}
                    {dish.spicy_level && dish.spicy_level > 0 ? (
                      <span className="bg-amber-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full flex items-center gap-0.5 shadow-xs">
                        <Flame className="w-2.5 h-2.5" /> {dish.spicy_level}
                      </span>
                    ) : null}
                  </div>
                </div>

                {/* Body Content */}
                <div className="p-4 space-y-2 flex-1 flex flex-col justify-between">
                  <div>
                    <h3 className="font-black text-slate-900 text-sm line-clamp-1">{dish.name}</h3>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mt-0.5">
                      {categoryObj?.name || 'Main Course'} • {dish.preparation_time || '15 min'}
                    </span>
                    <p className="text-xs text-slate-500 line-clamp-2 mt-1.5">
                      {dish.description || 'Delicious freshly made campus meal.'}
                    </p>
                  </div>

                  {/* Variants and Status Footer */}
                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                      dish.available ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                    }`}>
                      {dish.available ? 'Available' : 'Sold Out'}
                    </span>
                    {dish.variants && dish.variants.length > 0 && (
                      <span className="text-slate-500 text-[10px] font-bold">
                        {dish.variants.length} Variant(s)
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Add / Edit Dish Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-xl rounded-3xl p-6 shadow-2xl border border-rose-100 animate-in zoom-in-95 duration-150 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-black text-slate-900 text-lg flex items-center gap-2">
                <Utensils className="w-5 h-5 text-[#D6001C]" />
                {editingItem ? 'Edit Dish Details' : 'Add New Food Item'}
              </h3>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            {/* Nigerian Dish Presets */}
            {!editingItem && (
              <div className="my-3 p-3 bg-amber-50 rounded-2xl border border-amber-200/60 space-y-1.5">
                <div className="text-[11px] font-bold text-amber-900 flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                  Quick-Fill Popular Campus Dishes:
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {NIGERIAN_DISH_PRESETS.map((p, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => applyPreset(p)}
                      className="px-2.5 py-1 bg-white hover:bg-amber-100 text-[11px] font-semibold text-amber-900 rounded-lg border border-amber-200 transition-colors cursor-pointer"
                    >
                      + {p.name.split(' with ')[0]}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {errorMessage && (
              <div className="my-3 p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                {errorMessage}
              </div>
            )}

            <form onSubmit={handleSaveDish} className="space-y-4 mt-3 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Dish Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Smokey Jollof Rice with Fried Turkey"
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-[#D6001C] outline-none font-bold text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Category *</label>
                  <select
                    value={form.category_id}
                    onChange={e => setForm({ ...form, category_id: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-[#D6001C] outline-none font-medium bg-white"
                  >
                    {categories.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Base Price (₦) *</label>
                  <input
                    type="number"
                    required
                    placeholder="e.g. 1800"
                    value={form.base_price}
                    onChange={e => setForm({ ...form, base_price: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-[#D6001C] outline-none font-black text-sm text-[#D6001C]"
                  />
                </div>
              </div>

              {/* Click to Upload Dish Photo */}
              <ImageUploadInput
                label="Dish Photo (Click to Upload or Drag & Drop)"
                value={form.image_url}
                onChange={(url) => setForm(f => ({ ...f, image_url: url }))}
                presetCategory="dish"
                aspectRatio="landscape"
                placeholder="Upload high-res photo of dish"
              />

              <div>
                <label className="font-bold text-slate-700 block mb-1">Description / Ingredients</label>
                <textarea
                  rows={2}
                  placeholder="e.g. Cooked with sweet pepper sauce, served with fried plantain and seasoned protein..."
                  value={form.description}
                  onChange={e => setForm({ ...form, description: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 focus:ring-2 focus:ring-[#D6001C] outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Prep Time</label>
                  <input
                    type="text"
                    placeholder="e.g. 10-15 min"
                    value={form.preparation_time}
                    onChange={e => setForm({ ...form, preparation_time: e.target.value })}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-300 focus:ring-2 focus:ring-[#D6001C] outline-none font-mono"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Spicy Heat Level (0 - 5)</label>
                  <input
                    type="number"
                    min={0}
                    max={5}
                    value={form.spicy_level}
                    onChange={e => setForm({ ...form, spicy_level: Number(e.target.value) })}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-300 focus:ring-2 focus:ring-[#D6001C] outline-none"
                  />
                </div>
              </div>

              {/* Portion / Protein Variants */}
              <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-slate-800 text-xs">Portion & Protein Variants</span>
                  <button
                    type="button"
                    onClick={addVariantRow}
                    className="text-[11px] font-bold text-emerald-700 hover:text-emerald-800 bg-white px-2.5 py-1 rounded-lg border border-slate-200 shadow-2xs"
                  >
                    + Add Portion / Protein
                  </button>
                </div>

                {variants.length === 0 ? (
                  <p className="text-[11px] text-slate-400 italic">No variants added. Single standard price will apply.</p>
                ) : (
                  variants.map((v, idx) => (
                    <div key={v.id} className="flex items-center gap-2">
                      <input
                        type="text"
                        placeholder="e.g. Jumbo Size / With Beef"
                        value={v.name}
                        onChange={e => {
                          const updated = [...variants];
                          updated[idx].name = e.target.value;
                          setVariants(updated);
                        }}
                        className="flex-1 px-3 py-1.5 rounded-lg border border-slate-300 bg-white font-medium text-xs"
                      />
                      <input
                        type="number"
                        placeholder="₦ Price"
                        value={v.price}
                        onChange={e => {
                          const updated = [...variants];
                          updated[idx].price = e.target.value;
                          setVariants(updated);
                        }}
                        className="w-24 px-3 py-1.5 rounded-lg border border-slate-300 bg-white font-bold text-xs text-[#D6001C]"
                      />
                      <button
                        type="button"
                        onClick={() => removeVariantRow(idx)}
                        className="p-1 text-rose-500 hover:bg-rose-50 rounded"
                      >
                        ✕
                      </button>
                    </div>
                  ))
                )}
              </div>

              <div className="grid grid-cols-2 gap-3 pt-1">
                <label className="flex items-center gap-2 p-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.available}
                    onChange={e => setForm({ ...form, available: e.target.checked })}
                    className="w-4 h-4 text-[#D6001C] rounded-md focus:ring-rose-500"
                  />
                  <span className="font-bold text-slate-800 text-xs">Available Now</span>
                </label>

                <label className="flex items-center gap-2 p-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.student_friendly}
                    onChange={e => setForm({ ...form, student_friendly: e.target.checked })}
                    className="w-4 h-4 text-emerald-600 rounded-md focus:ring-emerald-500"
                  />
                  <span className="font-bold text-slate-800 text-xs">Student Friendly Deal</span>
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
                  {isSubmitting ? 'Saving...' : 'Save Dish'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

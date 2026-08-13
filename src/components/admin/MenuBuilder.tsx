import React, { useState } from 'react';
import { Plus, Edit2, Trash2, Check, AlertTriangle, ShieldCheck, Flame, DollarSign } from 'lucide-react';
import { doc, setDoc, deleteDoc, collection, addDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { Vendor, FoodCategory, MenuItem, VerificationStatus, ItemStatus, MenuItemVariant } from '../../types';
import { triggerHaptic } from '../../utils/haptics';

interface MenuBuilderProps {
  vendors: Vendor[];
  categories: FoodCategory[];
  menuItems: MenuItem[];
}

export const MenuBuilder: React.FC<MenuBuilderProps> = ({ vendors, categories, menuItems }) => {
  const [selectedVendorId, setSelectedVendorId] = useState<string>(vendors[0]?.id || '');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('all');
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);

  const [form, setForm] = useState({
    name: '',
    category_id: categories[0]?.id || '',
    description: '',
    image_url: '',
    base_price: '' as string | number, // can be empty for NULL
    available: true,
    student_friendly: true,
    spicy_level: 0,
    preparation_time: '15-20 min',
    verification_status: 'pending' as VerificationStatus,
    status: 'Draft' as ItemStatus,
  });

  const [variants, setVariants] = useState<{ id: string; name: string; price: string | number; available: boolean }[]>([]);

  const filteredItems = menuItems.filter(item => {
    if (selectedVendorId && item.vendor_id !== selectedVendorId) return false;
    if (selectedCategoryId !== 'all' && item.category_id !== selectedCategoryId) return false;
    return true;
  });

  const openNewModal = () => {
    setEditingItem(null);
    setForm({
      name: '',
      category_id: categories[0]?.id || '',
      description: '',
      image_url: '',
      base_price: '',
      available: true,
      student_friendly: true,
      spicy_level: 0,
      preparation_time: '15-20 min',
      verification_status: 'pending',
      status: 'Draft',
    });
    setVariants([]);
    setShowModal(true);
  };

  const openEditModal = (item: MenuItem) => {
    setEditingItem(item);
    setForm({
      name: item.name,
      category_id: item.category_id,
      description: item.description || '',
      image_url: item.image_url || '',
      base_price: item.base_price !== null && item.base_price !== undefined ? item.base_price : '',
      available: item.available ?? true,
      student_friendly: item.student_friendly ?? true,
      spicy_level: item.spicy_level || 0,
      preparation_time: item.preparation_time || '15-20 min',
      verification_status: item.verification_status || 'pending',
      status: item.status || 'Draft',
    });
    setVariants(
      item.variants
        ? item.variants.map(v => ({ id: v.id, name: v.name, price: v.price ?? '', available: v.available }))
        : []
    );
    setShowModal(true);
  };

  const addVariantRow = () => {
    setVariants([...variants, { id: `var_${Date.now()}_${variants.length}`, name: '', price: '', available: true }]);
  };

  const removeVariantRow = (index: number) => {
    setVariants(variants.filter((_, i) => i !== index));
  };

  const handleSaveDish = async (e: React.FormEvent) => {
    e.preventDefault();
    triggerHaptic(50);
    if (!selectedVendorId) return;

    const id = editingItem ? editingItem.id : `dish_${Date.now()}`;
    const parsedBasePrice = form.base_price !== '' && form.base_price !== null ? Number(form.base_price) : null;

    // Check if price changed -> Log to menu_price_history
    if (editingItem && editingItem.base_price !== parsedBasePrice) {
      await addDoc(collection(db, 'menu_price_history'), {
        menu_item_id: id,
        old_price: editingItem.base_price,
        new_price: parsedBasePrice,
        changed_by: 'Admin User',
        changed_at: new Date().toISOString(),
        reason: 'Manual update in Menu Builder'
      });
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
      vendor_id: selectedVendorId,
      restaurant_id: selectedVendorId,
      category_id: form.category_id,
      name: form.name,
      description: form.description,
      image_url: form.image_url || null,
      base_price: parsedBasePrice,
      price: parsedBasePrice || 0,
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
      await setDoc(doc(db, 'menu_items', id), payload);
      setShowModal(false);
    } catch (err) {
      console.error('Error saving dish:', err);
    }
  };

  const handleDeleteDish = async (id: string) => {
    if (!window.confirm('Delete this dish?')) return;
    triggerHaptic([40, 20, 40]);
    try {
      await deleteDoc(doc(db, 'menu_items', id));
    } catch (err) {
      console.error('Error deleting dish:', err);
    }
  };

  const currentVendor = vendors.find(v => v.id === selectedVendorId);

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      
      {/* Header & Vendor/Category Filter */}
      <div className="bg-white p-6 rounded-3xl border border-rose-100 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-black text-slate-900">🍲 University Menu Builder</h2>
            <p className="text-xs text-slate-500 mt-0.5">Manage dishes, portion pricing variants, spicy levels, and verification status.</p>
          </div>
          <button
            onClick={openNewModal}
            disabled={!selectedVendorId}
            className="bg-[#D6001C] hover:bg-red-700 disabled:opacity-50 text-white font-extrabold px-5 py-3 rounded-2xl text-xs flex items-center gap-2 shadow-md shadow-red-500/20 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add Dish / Item</span>
          </button>
        </div>

        {/* Filter row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-slate-100 text-xs">
          <div>
            <label className="font-extrabold text-slate-700 block mb-1">Select Vendor *</label>
            <select
              value={selectedVendorId}
              onChange={e => setSelectedVendorId(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 font-bold bg-white focus:ring-2 focus:ring-[#D6001C] outline-none"
            >
              {vendors.map(v => (
                <option key={v.id} value={v.id}>{v.name} ({v.vendor_type})</option>
              ))}
            </select>
          </div>

          <div>
            <label className="font-extrabold text-slate-700 block mb-1">Filter Category</label>
            <select
              value={selectedCategoryId}
              onChange={e => setSelectedCategoryId(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 font-bold bg-white focus:ring-2 focus:ring-[#D6001C] outline-none"
            >
              <option value="all">All Food Categories</option>
              {categories.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Menu Items Table / Cards */}
      <div className="bg-white rounded-3xl border border-rose-100 shadow-xs overflow-hidden">
        <div className="px-6 py-4 bg-slate-50/80 border-b border-slate-100 flex items-center justify-between">
          <span className="font-extrabold text-xs text-slate-700">
            Dishes for {currentVendor?.name || 'Selected Vendor'} ({filteredItems.length})
          </span>
          <span className="text-[11px] text-slate-500 font-medium">
            Rule: If actual price unknown, base_price is set to NULL.
          </span>
        </div>

        {filteredItems.length === 0 ? (
          <div className="p-12 text-center text-xs text-slate-400">
            No menu items found. Click "Add Dish / Item" to create one for this vendor.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredItems.map(item => {
              const catObj = categories.find(c => c.id === item.category_id);
              return (
                <div key={item.id} className="p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 hover:bg-slate-50/60 transition-colors">
                  <div className="flex items-start gap-3.5">
                    {item.image_url ? (
                      <img
                        src={item.image_url}
                        alt={item.name}
                        className="w-14 h-14 rounded-2xl object-cover border border-slate-200 shrink-0"
                      />
                    ) : (
                      <div className="w-14 h-14 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center text-xs font-bold text-slate-400 shrink-0">
                        NO IMG
                      </div>
                    )}

                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-black text-slate-900 text-sm">{item.name}</h4>
                        <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md uppercase">
                          {catObj?.name || 'Category'}
                        </span>
                        
                        {/* Status badge */}
                        <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                          item.verification_status === 'verified' ? 'bg-emerald-100 text-emerald-800' :
                          item.verification_status === 'pending' ? 'bg-amber-100 text-amber-800' : 'bg-rose-100 text-rose-800'
                        }`}>
                          {item.verification_status?.toUpperCase()}
                        </span>

                        <span className="text-[10px] font-bold text-slate-600 bg-slate-200 px-2 py-0.5 rounded-md">
                          {item.status || 'Draft'}
                        </span>
                      </div>

                      <p className="text-xs text-slate-500 line-clamp-1">{item.description || 'No description provided'}</p>

                      <div className="flex items-center gap-3 text-xs pt-1">
                        <span className="font-extrabold text-[#D6001C]">
                          {item.base_price !== null && item.base_price !== undefined
                            ? `₦${Number(item.base_price).toLocaleString()}`
                            : 'Price Unknown (NULL)'}
                        </span>

                        {item.variants && item.variants.length > 0 && (
                          <span className="text-[11px] font-semibold text-slate-500 bg-rose-50 px-2 py-0.5 rounded-md">
                            {item.variants.length} Portions
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                    <button
                      onClick={() => openEditModal(item)}
                      className="px-3 py-1.5 rounded-xl border border-slate-200 text-slate-700 font-bold text-xs hover:bg-slate-100 flex items-center gap-1 cursor-pointer"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                      <span>Edit</span>
                    </button>
                    <button
                      onClick={() => handleDeleteDish(item.id)}
                      className="p-2 text-rose-600 hover:bg-rose-50 rounded-xl"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Dish Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-3xl p-6 shadow-2xl border border-rose-100 animate-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto">
            <h3 className="font-extrabold text-slate-900 text-lg border-b border-slate-100 pb-3">
              {editingItem ? 'Edit Dish' : 'Add Dish / Menu Item'}
            </h3>

            <form onSubmit={handleSaveDish} className="space-y-4 mt-4 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Dish Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Amala, Korede Spaghetti, Bread and Beans"
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-[#D6001C] outline-none font-bold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Category *</label>
                  <select
                    value={form.category_id}
                    onChange={e => setForm({ ...form, category_id: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-[#D6001C] outline-none font-medium"
                  >
                    {categories.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    Base Price (₦) <span className="font-normal text-slate-400">(Leave blank for NULL)</span>
                  </label>
                  <input
                    type="number"
                    placeholder="e.g. 1200 or blank if unknown"
                    value={form.base_price}
                    onChange={e => setForm({ ...form, base_price: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-[#D6001C] outline-none font-bold text-[#D6001C]"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Description</label>
                <textarea
                  rows={2}
                  placeholder="Ingredients, taste profile, or portion notes..."
                  value={form.description}
                  onChange={e => setForm({ ...form, description: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-[#D6001C] outline-none"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Image URL</label>
                <input
                  type="url"
                  placeholder="https://..."
                  value={form.image_url}
                  onChange={e => setForm({ ...form, image_url: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-[#D6001C] outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Verification Status *</label>
                  <select
                    value={form.verification_status}
                    onChange={e => setForm({ ...form, verification_status: e.target.value as VerificationStatus })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 font-extrabold focus:ring-2 focus:ring-[#D6001C] outline-none"
                  >
                    <option value="pending">Pending Verification</option>
                    <option value="verified">Verified (Public)</option>
                    <option value="rejected">Rejected</option>
                    <option value="needs_update">Needs Price Update</option>
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Item Status *</label>
                  <select
                    value={form.status}
                    onChange={e => setForm({ ...form, status: e.target.value as ItemStatus })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 font-extrabold focus:ring-2 focus:ring-[#D6001C] outline-none"
                  >
                    <option value="Draft">Draft</option>
                    <option value="Published">Published</option>
                    <option value="Sold Out">Sold Out</option>
                    <option value="Temporarily Unavailable">Temporarily Unavailable</option>
                    <option value="Archived">Archived</option>
                  </select>
                </div>
              </div>

              {/* Portion Variants Builder */}
              <div className="pt-2 border-t border-slate-100">
                <div className="flex items-center justify-between mb-2">
                  <label className="font-bold text-slate-800 text-xs">Portion Variants & Pricing</label>
                  <button
                    type="button"
                    onClick={addVariantRow}
                    className="text-[#D6001C] hover:underline font-extrabold text-[11px] flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Portion</span>
                  </button>
                </div>

                {variants.length === 0 ? (
                  <p className="text-[11px] text-slate-400 italic">No portion variants added (uses Base Price).</p>
                ) : (
                  <div className="space-y-2">
                    {variants.map((v, idx) => (
                      <div key={v.id} className="flex items-center gap-2 bg-slate-50 p-2 rounded-xl border border-slate-200">
                        <input
                          type="text"
                          placeholder="Portion Name (e.g. Regular, Half Plate, Full Plate)"
                          value={v.name}
                          onChange={e => {
                            const newV = [...variants];
                            newV[idx].name = e.target.value;
                            setVariants(newV);
                          }}
                          className="flex-1 px-2.5 py-1.5 rounded-lg border border-slate-300 font-medium"
                        />
                        <input
                          type="number"
                          placeholder="Price ₦"
                          value={v.price}
                          onChange={e => {
                            const newV = [...variants];
                            newV[idx].price = e.target.value;
                            setVariants(newV);
                          }}
                          className="w-24 px-2.5 py-1.5 rounded-lg border border-slate-300 font-bold text-[#D6001C]"
                        />
                        <button
                          type="button"
                          onClick={() => removeVariantRow(idx)}
                          className="p-1 text-rose-500 hover:bg-rose-100 rounded-lg"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
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
                  Save Dish
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

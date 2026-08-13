import React, { useState } from 'react';
import { Save, RefreshCw, Search, History, Check, AlertCircle } from 'lucide-react';
import { doc, updateDoc, collection, addDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { Vendor, MenuItem, FoodCategory, VerificationStatus, ItemStatus } from '../../types';
import { triggerHaptic } from '../../utils/haptics';

interface ExcelAdminTableProps {
  vendors: Vendor[];
  categories: FoodCategory[];
  menuItems: MenuItem[];
}

export const ExcelAdminTable: React.FC<ExcelAdminTableProps> = ({ vendors, categories, menuItems }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterVendorId, setFilterVendorId] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [pendingChanges, setPendingChanges] = useState<Record<string, Partial<MenuItem>>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState('');

  const filteredItems = menuItems.filter(item => {
    if (filterVendorId !== 'all' && item.vendor_id !== filterVendorId) return false;
    if (filterStatus !== 'all' && item.verification_status !== filterStatus) return false;
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      return (
        item.name.toLowerCase().includes(q) ||
        (item.description && item.description.toLowerCase().includes(q))
      );
    }
    return true;
  });

  const handleCellEdit = (itemId: string, field: keyof MenuItem, value: any) => {
    setPendingChanges(prev => ({
      ...prev,
      [itemId]: {
        ...prev[itemId],
        [field]: value
      }
    }));
  };

  const saveAllChanges = async () => {
    const itemIds = Object.keys(pendingChanges);
    if (itemIds.length === 0) return;

    setIsSaving(true);
    triggerHaptic(50);

    try {
      for (const id of itemIds) {
        const changes = pendingChanges[id];
        const originalItem = menuItems.find(m => m.id === id);

        if (!originalItem) continue;

        // If price changed, log history
        if ('base_price' in changes && changes.base_price !== originalItem.base_price) {
          const newP = changes.base_price !== null && changes.base_price !== undefined ? Number(changes.base_price) : null;
          await addDoc(collection(db, 'menu_price_history'), {
            menu_item_id: id,
            old_price: originalItem.base_price,
            new_price: newP,
            changed_by: 'Admin Excel Editor',
            changed_at: new Date().toISOString(),
            reason: 'Inline spreadsheet cell edit'
          });

          changes.price = newP || 0;
        }

        changes.updated_at = new Date().toISOString();
        await updateDoc(doc(db, 'menu_items', id), changes as any);
      }

      setPendingChanges({});
      setSaveSuccessMsg(`Successfully saved ${itemIds.length} item updates!`);
      triggerHaptic([30, 30, 50]);
      setTimeout(() => setSaveSuccessMsg(''), 4000);
    } catch (err) {
      console.error('Error saving spreadsheet changes:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const countPending = Object.keys(pendingChanges).length;

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      
      {/* Top Header & Toolbar */}
      <div className="bg-white p-6 rounded-3xl border border-rose-100 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-black text-slate-900">📊 Excel-like Spreadsheet Data Editor</h2>
            <p className="text-xs text-slate-500 mt-0.5">Edit prices, availability, and verification status directly in cells with auto-logged price history.</p>
          </div>

          <button
            onClick={saveAllChanges}
            disabled={countPending === 0 || isSaving}
            className="bg-[#D6001C] hover:bg-red-700 disabled:opacity-40 text-white font-extrabold px-6 py-3 rounded-2xl text-xs flex items-center gap-2 shadow-md shadow-red-500/20 cursor-pointer"
          >
            <Save className="w-4 h-4" />
            <span>{isSaving ? 'Saving...' : `Save ${countPending} Pending Cell Edits`}</span>
          </button>
        </div>

        {saveSuccessMsg && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-extrabold text-emerald-800 flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-600" />
            <span>{saveSuccessMsg}</span>
          </div>
        )}

        {/* Filter Controls */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 border-t border-slate-100 text-xs">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              placeholder="Search dish name..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3.5 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-[#D6001C] outline-none"
            />
          </div>

          <div>
            <select
              value={filterVendorId}
              onChange={e => setFilterVendorId(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 font-bold bg-white focus:ring-2 focus:ring-[#D6001C] outline-none"
            >
              <option value="all">All Vendors</option>
              {vendors.map(v => (
                <option key={v.id} value={v.id}>{v.name}</option>
              ))}
            </select>
          </div>

          <div>
            <select
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 font-bold bg-white focus:ring-2 focus:ring-[#D6001C] outline-none"
            >
              <option value="all">All Verification Statuses</option>
              <option value="pending">Pending</option>
              <option value="verified">Verified</option>
              <option value="rejected">Rejected</option>
              <option value="needs_update">Needs Update</option>
            </select>
          </div>
        </div>
      </div>

      {/* Spreadsheet Grid */}
      <div className="bg-white rounded-3xl border border-rose-100 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-900 text-white font-extrabold text-[11px] uppercase tracking-wider">
              <tr>
                <th className="p-3 border-r border-slate-800">Dish Name</th>
                <th className="p-3 border-r border-slate-800">Vendor</th>
                <th className="p-3 border-r border-slate-800">Category</th>
                <th className="p-3 border-r border-slate-800 text-center">Base Price (₦)</th>
                <th className="p-3 border-r border-slate-800 text-center">Available</th>
                <th className="p-3 border-r border-slate-800">Verification Status</th>
                <th className="p-3">Item Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredItems.map(item => {
                const changes = pendingChanges[item.id] || {};
                const currentName = changes.name !== undefined ? changes.name : item.name;
                const currentPrice = changes.base_price !== undefined ? changes.base_price : (item.base_price ?? '');
                const currentAvail = changes.available !== undefined ? changes.available : item.available;
                const currentVer = changes.verification_status !== undefined ? changes.verification_status : item.verification_status;
                const currentStatus = changes.status !== undefined ? changes.status : item.status;

                const vendorObj = vendors.find(v => v.id === item.vendor_id);
                const catObj = categories.find(c => c.id === item.category_id);
                const isEdited = Object.keys(changes).length > 0;

                return (
                  <tr key={item.id} className={isEdited ? 'bg-amber-50/70 font-semibold' : 'hover:bg-slate-50'}>
                    
                    {/* Dish Name */}
                    <td className="p-2 border-r border-slate-200">
                      <input
                        type="text"
                        value={currentName}
                        onChange={e => handleCellEdit(item.id, 'name', e.target.value)}
                        className="w-full px-2 py-1.5 rounded-lg border border-transparent hover:border-slate-300 focus:border-[#D6001C] bg-transparent outline-none font-extrabold text-slate-900"
                      />
                    </td>

                    {/* Vendor */}
                    <td className="p-2 border-r border-slate-200 text-slate-600 font-medium">
                      {vendorObj?.name || 'Unknown'}
                    </td>

                    {/* Category */}
                    <td className="p-2 border-r border-slate-200 text-slate-600 font-medium">
                      {catObj?.name || 'Unassigned'}
                    </td>

                    {/* Base Price */}
                    <td className="p-2 border-r border-slate-200 text-center">
                      <input
                        type="number"
                        placeholder="NULL"
                        value={currentPrice}
                        onChange={e => handleCellEdit(item.id, 'base_price', e.target.value === '' ? null : Number(e.target.value))}
                        className="w-28 text-center px-2 py-1.5 rounded-lg border border-slate-200 focus:border-[#D6001C] font-extrabold text-[#D6001C] outline-none"
                      />
                    </td>

                    {/* Available */}
                    <td className="p-2 border-r border-slate-200 text-center">
                      <input
                        type="checkbox"
                        checked={currentAvail}
                        onChange={e => handleCellEdit(item.id, 'available', e.target.checked)}
                        className="w-4 h-4 text-[#D6001C] rounded-md focus:ring-rose-500 cursor-pointer"
                      />
                    </td>

                    {/* Verification Status */}
                    <td className="p-2 border-r border-slate-200">
                      <select
                        value={currentVer}
                        onChange={e => handleCellEdit(item.id, 'verification_status', e.target.value as VerificationStatus)}
                        className="w-full px-2 py-1 rounded-lg border border-slate-200 font-extrabold text-[11px] bg-white outline-none"
                      >
                        <option value="pending">Pending</option>
                        <option value="verified">Verified</option>
                        <option value="rejected">Rejected</option>
                        <option value="needs_update">Needs Update</option>
                      </select>
                    </td>

                    {/* Item Status */}
                    <td className="p-2">
                      <select
                        value={currentStatus}
                        onChange={e => handleCellEdit(item.id, 'status', e.target.value as ItemStatus)}
                        className="w-full px-2 py-1 rounded-lg border border-slate-200 font-extrabold text-[11px] bg-white outline-none"
                      >
                        <option value="Draft">Draft</option>
                        <option value="Published">Published</option>
                        <option value="Sold Out">Sold Out</option>
                        <option value="Temporarily Unavailable">Unavailable</option>
                        <option value="Archived">Archived</option>
                      </select>
                    </td>

                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};

import React, { useState } from 'react';
import { ShieldCheck, XCircle, CheckCircle2, AlertTriangle, Store, Utensils } from 'lucide-react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { Vendor, MenuItem } from '../../types';
import { triggerHaptic } from '../../utils/haptics';

interface VerificationManagerProps {
  vendors: Vendor[];
  menuItems: MenuItem[];
}

export const VerificationManager: React.FC<VerificationManagerProps> = ({ vendors, menuItems }) => {
  const [activeTab, setActiveTab] = useState<'items' | 'vendors'>('items');

  const pendingItems = menuItems.filter(m => m.verification_status === 'pending' || m.verification_status === 'needs_update');
  const pendingVendors = vendors.filter(v => !v.is_verified);

  const handleVerifyItem = async (itemId: string, status: 'verified' | 'rejected') => {
    triggerHaptic(50);
    try {
      await updateDoc(doc(db, 'menu_items', itemId), {
        verification_status: status,
        status: status === 'verified' ? 'Published' : 'Draft',
        updated_at: new Date().toISOString()
      });
    } catch (err) {
      console.error('Error verifying menu item:', err);
    }
  };

  const handleVerifyVendor = async (vendorId: string, isVerified: boolean) => {
    triggerHaptic(50);
    try {
      await updateDoc(doc(db, 'vendors', vendorId), {
        is_verified: isVerified,
        updated_at: new Date().toISOString()
      });
    } catch (err) {
      console.error('Error verifying vendor:', err);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      
      {/* Header */}
      <div className="bg-white p-6 rounded-3xl border border-rose-100 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-900">🛡️ Data Verification System</h2>
          <p className="text-xs text-slate-500 mt-0.5">Audit pending discovery records & price updates before making them public.</p>
        </div>

        {/* Tab switch */}
        <div className="flex bg-slate-100 p-1 rounded-2xl text-xs font-bold">
          <button
            onClick={() => setActiveTab('items')}
            className={`px-4 py-2 rounded-xl transition-all cursor-pointer ${
              activeTab === 'items' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
            }`}
          >
            Pending Dishes ({pendingItems.length})
          </button>
          <button
            onClick={() => setActiveTab('vendors')}
            className={`px-4 py-2 rounded-xl transition-all cursor-pointer ${
              activeTab === 'vendors' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
            }`}
          >
            Unverified Vendors ({pendingVendors.length})
          </button>
        </div>
      </div>

      {/* Tab Content: Dishes */}
      {activeTab === 'items' && (
        <div className="bg-white rounded-3xl border border-rose-100 shadow-xs overflow-hidden">
          {pendingItems.length === 0 ? (
            <div className="p-12 text-center text-xs text-slate-400">
              🎉 No pending dish verification requests! All menu items are verified or reviewed.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {pendingItems.map(item => {
                const vendorObj = vendors.find(v => v.id === item.vendor_id);
                return (
                  <div key={item.id} className="p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 hover:bg-slate-50/80 transition-colors">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Utensils className="w-4 h-4 text-[#D6001C]" />
                        <h3 className="font-extrabold text-slate-900 text-sm">{item.name}</h3>
                        <span className="text-[10px] font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full uppercase">
                          {item.verification_status}
                        </span>
                      </div>

                      <p className="text-xs text-slate-500">{item.description || 'No description provided'}</p>

                      <div className="flex items-center gap-3 text-xs pt-1">
                        <span className="font-bold text-slate-700">Vendor: {vendorObj?.name || 'Unknown'}</span>
                        <span className="font-mono font-extrabold text-[#D6001C]">
                          {item.base_price !== null ? `₦${item.base_price.toLocaleString()}` : 'Price Unknown (NULL)'}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => handleVerifyItem(item.id, 'rejected')}
                        className="px-4 py-2 rounded-xl border border-rose-200 text-rose-600 font-extrabold text-xs hover:bg-rose-50 flex items-center gap-1 cursor-pointer"
                      >
                        <XCircle className="w-4 h-4" />
                        <span>Reject</span>
                      </button>
                      <button
                        onClick={() => handleVerifyItem(item.id, 'verified')}
                        className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs flex items-center gap-1 shadow-xs cursor-pointer"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Verify & Publish</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Tab Content: Vendors */}
      {activeTab === 'vendors' && (
        <div className="bg-white rounded-3xl border border-rose-100 shadow-xs overflow-hidden">
          {pendingVendors.length === 0 ? (
            <div className="p-12 text-center text-xs text-slate-400">
              🎉 All vendors are verified!
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {pendingVendors.map(vendor => (
                <div key={vendor.id} className="p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 hover:bg-slate-50/80 transition-colors">
                  <div className="flex items-center gap-3">
                    <Store className="w-8 h-8 text-slate-400 p-1.5 bg-slate-100 rounded-xl" />
                    <div>
                      <h3 className="font-extrabold text-slate-900 text-sm">{vendor.name}</h3>
                      <p className="text-xs text-slate-500 mt-0.5">{vendor.description || 'Discovered food spot'}</p>
                      <span className="text-[10px] font-bold text-slate-500 uppercase mt-1 inline-block">
                        {vendor.vendor_type}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => handleVerifyVendor(vendor.id, true)}
                      className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs flex items-center gap-1 shadow-xs cursor-pointer"
                    >
                      <ShieldCheck className="w-4 h-4" />
                      <span>Approve & Verify</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

    </div>
  );
};

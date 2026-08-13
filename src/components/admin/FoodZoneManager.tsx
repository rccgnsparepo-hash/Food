import React, { useState } from 'react';
import { Plus, Edit2, Trash2, MapPin, Building, Landmark } from 'lucide-react';
import { doc, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { University, Campus, FoodZone } from '../../types';
import { triggerHaptic } from '../../utils/haptics';

interface FoodZoneManagerProps {
  universities: University[];
  campuses: Campus[];
  foodZones: FoodZone[];
}

export const FoodZoneManager: React.FC<FoodZoneManagerProps> = ({ universities, campuses, foodZones }) => {
  const [selectedUniId, setSelectedUniId] = useState<string>(universities[0]?.id || '');
  const [selectedCampusId, setSelectedCampusId] = useState<string>(campuses[0]?.id || '');
  const [showModal, setShowModal] = useState(false);
  const [editingZone, setEditingZone] = useState<FoodZone | null>(null);

  const [form, setForm] = useState({
    name: '',
    description: '',
    landmark: '',
    latitude: 6.518,
    longitude: 3.389,
    is_active: true
  });

  const availableCampuses = campuses.filter(c => c.university_id === selectedUniId);
  const currentCampusId = selectedCampusId || (availableCampuses[0]?.id || '');

  const filteredZones = foodZones.filter(z => z.campus_id === currentCampusId);

  const openNewModal = () => {
    setEditingZone(null);
    setForm({
      name: '',
      description: '',
      landmark: '',
      latitude: 6.518,
      longitude: 3.389,
      is_active: true
    });
    setShowModal(true);
  };

  const openEditModal = (z: FoodZone) => {
    setEditingZone(z);
    setForm({
      name: z.name,
      description: z.description || '',
      landmark: z.landmark || '',
      latitude: z.latitude || 6.518,
      longitude: z.longitude || 3.389,
      is_active: z.is_active
    });
    setShowModal(true);
  };

  const handleSaveZone = async (e: React.FormEvent) => {
    e.preventDefault();
    triggerHaptic(50);
    if (!currentCampusId) return;

    const id = editingZone ? editingZone.id : `zone_${Date.now()}`;

    const payload: FoodZone = {
      id,
      campus_id: currentCampusId,
      university_id: selectedUniId,
      name: form.name,
      description: form.description,
      landmark: form.landmark,
      latitude: Number(form.latitude),
      longitude: Number(form.longitude),
      is_active: form.is_active,
      created_at: editingZone?.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    try {
      await setDoc(doc(db, 'food_zones', id), payload);
      setShowModal(false);
    } catch (err) {
      console.error('Error saving food zone:', err);
    }
  };

  const handleDeleteZone = async (id: string) => {
    if (!window.confirm('Delete this food zone? Vendors assigned to this zone will need reassignment.')) return;
    triggerHaptic([40, 20, 40]);
    try {
      await deleteDoc(doc(db, 'food_zones', id));
    } catch (err) {
      console.error('Error deleting zone:', err);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      
      {/* Header & Campus Filters */}
      <div className="bg-white p-6 rounded-3xl border border-rose-100 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-black text-slate-900">📍 Campus Food Zones Manager</h2>
            <p className="text-xs text-slate-500 mt-0.5">Define food hubs & student quarters (e.g. New Hall Complex, Jaja Hall Area, Amphitheatre, CITS Area).</p>
          </div>
          <button
            onClick={openNewModal}
            disabled={!currentCampusId}
            className="bg-[#D6001C] hover:bg-red-700 disabled:opacity-50 text-white font-extrabold px-5 py-3 rounded-2xl text-xs flex items-center gap-2 shadow-md shadow-red-500/20 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add Food Zone</span>
          </button>
        </div>

        {/* Filter Selectors */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-slate-100 text-xs">
          <div>
            <label className="font-extrabold text-slate-700 block mb-1">Select University</label>
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
            <label className="font-extrabold text-slate-700 block mb-1">Select Campus</label>
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
        </div>
      </div>

      {/* Food Zones Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredZones.length === 0 ? (
          <div className="col-span-full py-12 text-center text-xs text-slate-400 bg-white rounded-3xl border border-dashed border-slate-200">
            No food zones found for this campus. Click "Add Food Zone" to create one.
          </div>
        ) : (
          filteredZones.map(z => (
            <div key={z.id} className="bg-white p-5 rounded-3xl border border-rose-100 shadow-xs space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="text-[10px] font-mono font-bold text-[#D6001C] uppercase bg-rose-50 px-2.5 py-0.5 rounded-full inline-block">
                    Zone #{z.id.slice(0, 8)}
                  </span>
                  <h3 className="font-black text-slate-900 text-base mt-1">{z.name}</h3>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => openEditModal(z)}
                    className="p-1.5 text-slate-600 hover:bg-slate-100 rounded-xl"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDeleteZone(z.id)}
                    className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-xl"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <p className="text-xs text-slate-500 font-normal">{z.description || 'Campus food hub'}</p>

              {z.landmark && (
                <div className="flex items-center gap-1.5 text-xs text-slate-700 bg-slate-50 p-2.5 rounded-xl border border-slate-100 font-medium">
                  <Landmark className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>Landmark: {z.landmark}</span>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Add / Edit Food Zone Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-3xl p-6 shadow-2xl border border-rose-100 animate-in zoom-in-95 duration-150">
            <h3 className="font-extrabold text-slate-900 text-lg border-b border-slate-100 pb-3">
              {editingZone ? 'Edit Food Zone' : 'Add Food Zone'}
            </h3>

            <form onSubmit={handleSaveZone} className="space-y-4 mt-4 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Zone Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. New Hall Complex, Jaja Hall Area, CITS Area"
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-[#D6001C] outline-none font-bold"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Landmark</label>
                <input
                  type="text"
                  placeholder="e.g. Opposite King Jaja Male Hostel"
                  value={form.landmark}
                  onChange={e => setForm({ ...form, landmark: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-[#D6001C] outline-none"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Description</label>
                <textarea
                  rows={2}
                  placeholder="Description of food spots in this area..."
                  value={form.description}
                  onChange={e => setForm({ ...form, description: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-[#D6001C] outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Latitude</label>
                  <input
                    type="number"
                    step="any"
                    value={form.latitude}
                    onChange={e => setForm({ ...form, latitude: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-[#D6001C] outline-none"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Longitude</label>
                  <input
                    type="number"
                    step="any"
                    value={form.longitude}
                    onChange={e => setForm({ ...form, longitude: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-[#D6001C] outline-none"
                  />
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
                  Save Food Zone
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

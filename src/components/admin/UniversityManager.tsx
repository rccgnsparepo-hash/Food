import React, { useState } from 'react';
import { Plus, Edit2, Trash2, CheckCircle, XCircle, MapPin, Building, Globe, Check } from 'lucide-react';
import { doc, setDoc, deleteDoc, updateDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { University, Campus } from '../../types';
import { triggerHaptic } from '../../utils/haptics';

interface UniversityManagerProps {
  universities: University[];
  campuses: Campus[];
}

export const UniversityManager: React.FC<UniversityManagerProps> = ({ universities, campuses }) => {
  const [selectedUniId, setSelectedUniId] = useState<string>(universities[0]?.id || '');
  const [showUniModal, setShowUniModal] = useState(false);
  const [showCampusModal, setShowCampusModal] = useState(false);
  const [editingUni, setEditingUni] = useState<University | null>(null);
  const [editingCampus, setEditingCampus] = useState<Campus | null>(null);

  // Form states
  const [uniForm, setUniForm] = useState({
    name: '',
    short_name: '',
    state: 'Lagos',
    city: 'Lagos',
    country: 'Nigeria',
    description: '',
    logo_url: '',
    cover_image_url: '',
    latitude: 6.518,
    longitude: 3.389,
    is_active: true
  });

  const [campusForm, setCampusForm] = useState({
    name: '',
    description: '',
    address: '',
    latitude: 6.518,
    longitude: 3.389,
    is_active: true
  });

  const openNewUniModal = () => {
    setEditingUni(null);
    setUniForm({
      name: '',
      short_name: '',
      state: 'Lagos',
      city: 'Lagos',
      country: 'Nigeria',
      description: '',
      logo_url: '',
      cover_image_url: '',
      latitude: 6.518,
      longitude: 3.389,
      is_active: true
    });
    setShowUniModal(true);
  };

  const openEditUniModal = (uni: University) => {
    setEditingUni(uni);
    setUniForm({
      name: uni.name,
      short_name: uni.short_name,
      state: uni.state || 'Lagos',
      city: uni.city || 'Lagos',
      country: uni.country || 'Nigeria',
      description: uni.description || '',
      logo_url: uni.logo_url || '',
      cover_image_url: uni.cover_image_url || '',
      latitude: uni.latitude || 6.518,
      longitude: uni.longitude || 3.389,
      is_active: uni.is_active
    });
    setShowUniModal(true);
  };

  const handleSaveUni = async (e: React.FormEvent) => {
    e.preventDefault();
    triggerHaptic(50);
    const id = editingUni ? editingUni.id : `uni_${Date.now()}`;
    const slug = uniForm.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');

    const payload: University = {
      id,
      name: uniForm.name,
      short_name: uniForm.short_name,
      slug,
      state: uniForm.state,
      city: uniForm.city,
      country: uniForm.country,
      description: uniForm.description,
      logo_url: uniForm.logo_url || 'https://images.unsplash.com/photo-1541339907198-e08756dedf3f?auto=format&fit=crop&q=80&w=200',
      cover_image_url: uniForm.cover_image_url || 'https://images.unsplash.com/photo-1523050854058-8df90110c9f1?auto=format&fit=crop&q=80&w=1200',
      latitude: Number(uniForm.latitude),
      longitude: Number(uniForm.longitude),
      is_active: uniForm.is_active,
      created_at: editingUni?.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    try {
      await setDoc(doc(db, 'universities', id), payload);
      setShowUniModal(false);
      setSelectedUniId(id);
    } catch (err) {
      console.error('Error saving university:', err);
    }
  };

  const handleToggleUniActive = async (uni: University) => {
    triggerHaptic(30);
    try {
      await updateDoc(doc(db, 'universities', uni.id), {
        is_active: !uni.is_active,
        updated_at: new Date().toISOString()
      });
    } catch (err) {
      console.error('Error toggling university active:', err);
    }
  };

  const handleDeleteUni = async (id: string) => {
    if (!window.confirm('Delete this university and all attached records?')) return;
    triggerHaptic([40, 20, 40]);
    try {
      await deleteDoc(doc(db, 'universities', id));
    } catch (err) {
      console.error('Error deleting university:', err);
    }
  };

  // Campus handlers
  const openNewCampusModal = () => {
    setEditingCampus(null);
    setCampusForm({
      name: '',
      description: '',
      address: '',
      latitude: 6.518,
      longitude: 3.389,
      is_active: true
    });
    setShowCampusModal(true);
  };

  const openEditCampusModal = (camp: Campus) => {
    setEditingCampus(camp);
    setCampusForm({
      name: camp.name,
      description: camp.description || '',
      address: camp.address || '',
      latitude: camp.latitude || 6.518,
      longitude: camp.longitude || 3.389,
      is_active: camp.is_active
    });
    setShowCampusModal(true);
  };

  const handleSaveCampus = async (e: React.FormEvent) => {
    e.preventDefault();
    triggerHaptic(50);
    if (!selectedUniId) return;

    const id = editingCampus ? editingCampus.id : `campus_${Date.now()}`;
    const slug = campusForm.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');

    const payload: Campus = {
      id,
      university_id: selectedUniId,
      name: campusForm.name,
      slug,
      description: campusForm.description,
      address: campusForm.address,
      latitude: Number(campusForm.latitude),
      longitude: Number(campusForm.longitude),
      is_active: campusForm.is_active,
      created_at: editingCampus?.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    try {
      await setDoc(doc(db, 'campuses', id), payload);
      setShowCampusModal(false);
    } catch (err) {
      console.error('Error saving campus:', err);
    }
  };

  const handleDeleteCampus = async (id: string) => {
    if (!window.confirm('Delete this campus?')) return;
    triggerHaptic([40, 20, 40]);
    try {
      await deleteDoc(doc(db, 'campuses', id));
    } catch (err) {
      console.error('Error deleting campus:', err);
    }
  };

  const filteredCampuses = campuses.filter(c => c.university_id === selectedUniId);

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      
      {/* Top Header & Actions */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-rose-100 shadow-xs">
        <div>
          <h2 className="text-xl font-black text-slate-900">🇳🇬 Nigerian Universities Manager</h2>
          <p className="text-xs text-slate-500 mt-0.5">Configure universities & campuses dynamically without hardcoded limits.</p>
        </div>
        <button
          onClick={openNewUniModal}
          className="bg-[#D6001C] hover:bg-red-700 text-white font-extrabold px-5 py-3 rounded-2xl text-xs flex items-center gap-2 shadow-md shadow-red-500/20 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Add University</span>
        </button>
      </div>

      {/* Universities Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {universities.map((uni) => {
          const isSelected = uni.id === selectedUniId;
          const campusCount = campuses.filter(c => c.university_id === uni.id).length;
          return (
            <div
              key={uni.id}
              onClick={() => setSelectedUniId(uni.id)}
              className={`p-5 rounded-3xl border transition-all cursor-pointer relative overflow-hidden ${
                isSelected
                  ? 'bg-rose-50/80 border-[#D6001C] shadow-md ring-2 ring-rose-200'
                  : 'bg-white border-slate-200 hover:border-rose-200 shadow-xs'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <img
                    src={uni.logo_url || 'https://images.unsplash.com/photo-1541339907198-e08756dedf3f?auto=format&fit=crop&q=80&w=100'}
                    alt={uni.name}
                    className="w-12 h-12 rounded-2xl object-cover border border-rose-100 bg-white shadow-xs"
                  />
                  <div>
                    <h3 className="font-extrabold text-slate-900 text-sm leading-tight">{uni.name}</h3>
                    <span className="text-[10px] font-mono font-bold text-[#D6001C] uppercase bg-rose-100/60 px-2 py-0.5 rounded-full inline-block mt-1">
                      {uni.short_name}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                  <button
                    onClick={() => handleToggleUniActive(uni)}
                    className={`p-1.5 rounded-xl text-xs ${uni.is_active ? 'text-emerald-600 hover:bg-emerald-50' : 'text-slate-400 hover:bg-slate-100'}`}
                    title={uni.is_active ? 'Active' : 'Inactive'}
                  >
                    {uni.is_active ? <CheckCircle className="w-4 h-4 text-emerald-500" /> : <XCircle className="w-4 h-4 text-slate-400" />}
                  </button>
                  <button
                    onClick={() => openEditUniModal(uni)}
                    className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-xl"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDeleteUni(uni.id)}
                    className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-xl"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <p className="text-xs text-slate-500 line-clamp-2 mt-3 font-normal">
                {uni.description || `${uni.name} located in ${uni.city}, ${uni.state}.`}
              </p>

              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] font-semibold text-slate-600">
                <span className="flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-rose-500" />
                  {uni.city}, {uni.state}
                </span>
                <span className="bg-slate-100 px-2.5 py-1 rounded-xl text-slate-700 font-bold">
                  {campusCount} {campusCount === 1 ? 'Campus' : 'Campuses'}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Selected University Campuses Section */}
      {selectedUniId && (
        <div className="bg-white rounded-3xl p-6 border border-rose-100 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div>
              <h3 className="font-extrabold text-base text-slate-900">
                Campuses for {universities.find(u => u.id === selectedUniId)?.name}
              </h3>
              <p className="text-xs text-slate-500">A university can have multiple campuses (e.g. Akoka Main Campus, Idi-Araba, College of Medicine).</p>
            </div>
            <button
              onClick={openNewCampusModal}
              className="bg-slate-900 hover:bg-slate-800 text-white font-extrabold px-4 py-2.5 rounded-2xl text-xs flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <Plus className="w-4 h-4" />
              <span>Add Campus</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {filteredCampuses.length === 0 ? (
              <div className="col-span-2 py-8 text-center text-xs text-slate-400 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                No campuses configured yet. Click "Add Campus" to define a campus.
              </div>
            ) : (
              filteredCampuses.map((camp) => (
                <div key={camp.id} className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-extrabold text-slate-900 text-sm">{camp.name}</h4>
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${camp.is_active ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'}`}>
                        {camp.is_active ? 'ACTIVE' : 'INACTIVE'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">{camp.address || 'Campus grounds'}</p>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => openEditCampusModal(camp)}
                      className="p-1.5 text-slate-600 hover:bg-white rounded-lg border border-slate-200"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDeleteCampus(camp.id)}
                      className="p-1.5 text-rose-600 hover:bg-rose-100 rounded-lg border border-rose-200"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* University Modal */}
      {showUniModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-3xl p-6 shadow-2xl border border-rose-100 animate-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto">
            <h3 className="font-extrabold text-slate-900 text-lg border-b border-slate-100 pb-3">
              {editingUni ? 'Edit University' : 'Add New Nigerian University'}
            </h3>

            <form onSubmit={handleSaveUni} className="space-y-4 mt-4 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">University Full Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. University of Lagos"
                  value={uniForm.name}
                  onChange={e => setUniForm({ ...uniForm, name: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-[#D6001C] outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Short Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. UNILAG"
                    value={uniForm.short_name}
                    onChange={e => setUniForm({ ...uniForm, short_name: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-[#D6001C] outline-none font-bold"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">State *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Lagos"
                    value={uniForm.state}
                    onChange={e => setUniForm({ ...uniForm, state: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-[#D6001C] outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">City *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Lagos"
                    value={uniForm.city}
                    onChange={e => setUniForm({ ...uniForm, city: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-[#D6001C] outline-none"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Country</label>
                  <input
                    type="text"
                    readOnly
                    value="Nigeria"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-100 text-slate-500 font-medium"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Description</label>
                <textarea
                  rows={2}
                  placeholder="Overview of the university campus..."
                  value={uniForm.description}
                  onChange={e => setUniForm({ ...uniForm, description: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-[#D6001C] outline-none"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Logo URL</label>
                <input
                  type="url"
                  placeholder="https://..."
                  value={uniForm.logo_url}
                  onChange={e => setUniForm({ ...uniForm, logo_url: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-[#D6001C] outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Latitude</label>
                  <input
                    type="number"
                    step="any"
                    value={uniForm.latitude}
                    onChange={e => setUniForm({ ...uniForm, latitude: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-[#D6001C] outline-none"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Longitude</label>
                  <input
                    type="number"
                    step="any"
                    value={uniForm.longitude}
                    onChange={e => setUniForm({ ...uniForm, longitude: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-[#D6001C] outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="active_check"
                  checked={uniForm.is_active}
                  onChange={e => setUniForm({ ...uniForm, is_active: e.target.checked })}
                  className="w-4 h-4 text-[#D6001C] rounded-md focus:ring-rose-500"
                />
                <label htmlFor="active_check" className="font-bold text-slate-800">
                  Active (Visible on food marketplace)
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowUniModal(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 font-bold hover:bg-slate-100 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-[#D6001C] text-white font-extrabold hover:bg-red-700 cursor-pointer shadow-md shadow-red-500/20"
                >
                  Save University
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Campus Modal */}
      {showCampusModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-3xl p-6 shadow-2xl border border-rose-100 animate-in zoom-in-95 duration-150">
            <h3 className="font-extrabold text-slate-900 text-lg border-b border-slate-100 pb-3">
              {editingCampus ? 'Edit Campus' : 'Add Campus'}
            </h3>

            <form onSubmit={handleSaveCampus} className="space-y-4 mt-4 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Campus Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Akoka Main Campus"
                  value={campusForm.name}
                  onChange={e => setCampusForm({ ...campusForm, name: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-[#D6001C] outline-none font-bold"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Address</label>
                <input
                  type="text"
                  placeholder="e.g. Akoka Road, Yaba, Lagos"
                  value={campusForm.address}
                  onChange={e => setCampusForm({ ...campusForm, address: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-[#D6001C] outline-none"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Description</label>
                <textarea
                  rows={2}
                  placeholder="Campus details..."
                  value={campusForm.description}
                  onChange={e => setCampusForm({ ...campusForm, description: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-[#D6001C] outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowCampusModal(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 font-bold hover:bg-slate-100 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-slate-900 text-white font-extrabold hover:bg-slate-800 cursor-pointer"
                >
                  Save Campus
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

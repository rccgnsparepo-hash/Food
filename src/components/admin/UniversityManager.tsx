import React, { useState } from 'react';
import { Plus, Edit2, Trash2, CheckCircle, XCircle, MapPin, Building, Globe, Check, Sparkles, Loader2, AlertCircle } from 'lucide-react';
import { doc, setDoc, deleteDoc, updateDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { University, Campus } from '../../types';
import { triggerHaptic } from '../../utils/haptics';
import { useMarketplaceStore } from '../../stores/useMarketplaceStore';
import { toast } from 'sonner';

interface UniversityManagerProps {
  universities: University[];
  campuses: Campus[];
}

interface NigerianUniPreset {
  name: string;
  short_name: string;
  state: string;
  city: string;
  description: string;
  logo_url: string;
  cover_image_url: string;
  latitude: number;
  longitude: number;
  defaultCampusName: string;
}

const POPULAR_NIGERIAN_UNIVERSITIES: NigerianUniPreset[] = [
  {
    name: 'University of Lagos',
    short_name: 'UNILAG',
    state: 'Lagos',
    city: 'Yaba / Akoka',
    description: 'Premier federal university of first choice and the nation pride, located in Akoka, Yaba, Lagos.',
    logo_url: 'https://images.unsplash.com/photo-1541339907198-e08756dedf3f?auto=format&fit=crop&q=80&w=200',
    cover_image_url: 'https://images.unsplash.com/photo-1523050854058-8df90110c9f1?auto=format&fit=crop&q=80&w=1200',
    latitude: 6.5181,
    longitude: 3.3896,
    defaultCampusName: 'Akoka Main Campus'
  },
  {
    name: 'University of Ibadan',
    short_name: 'UI',
    state: 'Oyo',
    city: 'Ibadan',
    description: 'The first university established in Nigeria (1948), located along Oyo Road, Ibadan.',
    logo_url: 'https://images.unsplash.com/photo-1562774053-701939374585?auto=format&fit=crop&q=80&w=200',
    cover_image_url: 'https://images.unsplash.com/photo-1541339907198-e08756dedf3f?auto=format&fit=crop&q=80&w=1200',
    latitude: 7.4443,
    longitude: 3.8996,
    defaultCampusName: 'UI Main Campus'
  },
  {
    name: 'Obafemi Awolowo University',
    short_name: 'OAU',
    state: 'Osun',
    city: 'Ile-Ife',
    description: 'Great Ife, renowned federal university located in the historic city of Ile-Ife, Osun State.',
    logo_url: 'https://images.unsplash.com/photo-1523050854058-8df90110c9f1?auto=format&fit=crop&q=80&w=200',
    cover_image_url: 'https://images.unsplash.com/photo-1509062522246-3755977927d7?auto=format&fit=crop&q=80&w=1200',
    latitude: 7.5186,
    longitude: 4.5262,
    defaultCampusName: 'Main Campus Ile-Ife'
  },
  {
    name: 'Covenant University',
    short_name: 'CU',
    state: 'Ogun',
    city: 'Ota',
    description: 'Leading private Christian university located in Canaanland, Ota, Ogun State.',
    logo_url: 'https://images.unsplash.com/photo-1541339907198-e08756dedf3f?auto=format&fit=crop&q=80&w=200',
    cover_image_url: 'https://images.unsplash.com/photo-1562774053-701939374585?auto=format&fit=crop&q=80&w=1200',
    latitude: 6.6718,
    longitude: 3.1581,
    defaultCampusName: 'Canaanland Main Campus'
  },
  {
    name: 'Federal University of Technology, Akure',
    short_name: 'FUTA',
    state: 'Ondo',
    city: 'Akure',
    description: 'Top-tier federal university of technology located in Akure, Ondo State.',
    logo_url: 'https://images.unsplash.com/photo-1562774053-701939374585?auto=format&fit=crop&q=80&w=200',
    cover_image_url: 'https://images.unsplash.com/photo-1523050854058-8df90110c9f1?auto=format&fit=crop&q=80&w=1200',
    latitude: 7.3034,
    longitude: 5.1389,
    defaultCampusName: 'Obanla Main Campus'
  },
  {
    name: 'Lagos State University',
    short_name: 'LASU',
    state: 'Lagos',
    city: 'Ojo',
    description: 'Premier state university in Lagos State situated along the Lagos-Badagry Expressway.',
    logo_url: 'https://images.unsplash.com/photo-1541339907198-e08756dedf3f?auto=format&fit=crop&q=80&w=200',
    cover_image_url: 'https://images.unsplash.com/photo-1523050854058-8df90110c9f1?auto=format&fit=crop&q=80&w=1200',
    latitude: 6.4678,
    longitude: 3.1978,
    defaultCampusName: 'Ojo Main Campus'
  },
  {
    name: 'University of Benin',
    short_name: 'UNIBEN',
    state: 'Edo',
    city: 'Benin City',
    description: 'Premier federal university located in Ugbowo, Benin City, Edo State.',
    logo_url: 'https://images.unsplash.com/photo-1541339907198-e08756dedf3f?auto=format&fit=crop&q=80&w=200',
    cover_image_url: 'https://images.unsplash.com/photo-1523050854058-8df90110c9f1?auto=format&fit=crop&q=80&w=1200',
    latitude: 6.4019,
    longitude: 5.6173,
    defaultCampusName: 'Ugbowo Main Campus'
  },
  {
    name: 'Babcock University',
    short_name: 'BU',
    state: 'Ogun',
    city: 'Ilishan-Remo',
    description: 'Premier private university situated in Ilishan-Remo, Ogun State.',
    logo_url: 'https://images.unsplash.com/photo-1541339907198-e08756dedf3f?auto=format&fit=crop&q=80&w=200',
    cover_image_url: 'https://images.unsplash.com/photo-1523050854058-8df90110c9f1?auto=format&fit=crop&q=80&w=1200',
    latitude: 6.8924,
    longitude: 3.7198,
    defaultCampusName: 'Ilishan-Remo Campus'
  }
];

export const UniversityManager: React.FC<UniversityManagerProps> = ({ universities, campuses }) => {
  const store = useMarketplaceStore();
  const [selectedUniId, setSelectedUniId] = useState<string>(universities[0]?.id || store.selectedUniversityId || '');
  const [showUniModal, setShowUniModal] = useState(false);
  const [showCampusModal, setShowCampusModal] = useState(false);
  const [editingUni, setEditingUni] = useState<University | null>(null);
  const [editingCampus, setEditingCampus] = useState<Campus | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Form states
  const [uniForm, setUniForm] = useState({
    name: '',
    short_name: '',
    state: 'Lagos',
    city: 'Lagos',
    country: 'Nigeria',
    description: '',
    defaultCampusName: 'Main Campus',
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
    setFormError(null);
    setUniForm({
      name: '',
      short_name: '',
      state: 'Lagos',
      city: 'Lagos',
      country: 'Nigeria',
      description: '',
      defaultCampusName: 'Main Campus',
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
    setFormError(null);
    setUniForm({
      name: uni.name,
      short_name: uni.short_name,
      state: uni.state || 'Lagos',
      city: uni.city || 'Lagos',
      country: uni.country || 'Nigeria',
      description: uni.description || '',
      defaultCampusName: 'Main Campus',
      logo_url: uni.logo_url || '',
      cover_image_url: uni.cover_image_url || '',
      latitude: uni.latitude || 6.518,
      longitude: uni.longitude || 3.389,
      is_active: uni.is_active
    });
    setShowUniModal(true);
  };

  const handleApplyPreset = (preset: NigerianUniPreset) => {
    triggerHaptic(30);
    setUniForm({
      name: preset.name,
      short_name: preset.short_name,
      state: preset.state,
      city: preset.city,
      country: 'Nigeria',
      description: preset.description,
      defaultCampusName: preset.defaultCampusName,
      logo_url: preset.logo_url,
      cover_image_url: preset.cover_image_url,
      latitude: preset.latitude,
      longitude: preset.longitude,
      is_active: true
    });
    setFormError(null);
    toast.info(`Filled preset details for ${preset.short_name}`);
  };

  const handleSaveUni = async (e: React.FormEvent) => {
    e.preventDefault();
    triggerHaptic(50);
    setFormError(null);

    const name = uniForm.name.trim();
    const short_name = uniForm.short_name.trim().toUpperCase();

    if (!name) {
      setFormError('University Full Name is required.');
      return;
    }
    if (!short_name) {
      setFormError('Short name / Abbreviation is required (e.g. UNILAG, UI).');
      return;
    }

    setIsSaving(true);

    const rawSlug = short_name.toLowerCase().replace(/[^a-z0-9]+/g, '');
    const id = editingUni ? editingUni.id : `uni_${rawSlug || Date.now()}`;
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-');

    const lat = typeof uniForm.latitude === 'number' ? uniForm.latitude : parseFloat(String(uniForm.latitude)) || 6.518;
    const lng = typeof uniForm.longitude === 'number' ? uniForm.longitude : parseFloat(String(uniForm.longitude)) || 3.389;

    const payload: University = {
      id,
      name,
      short_name,
      slug,
      state: uniForm.state.trim() || 'Lagos',
      city: uniForm.city.trim() || 'Lagos',
      country: 'Nigeria',
      description: uniForm.description.trim() || `${name} located in ${uniForm.city}, ${uniForm.state}, Nigeria.`,
      logo_url: uniForm.logo_url.trim() || 'https://images.unsplash.com/photo-1541339907198-e08756dedf3f?auto=format&fit=crop&q=80&w=200',
      cover_image_url: uniForm.cover_image_url.trim() || 'https://images.unsplash.com/photo-1523050854058-8df90110c9f1?auto=format&fit=crop&q=80&w=1200',
      latitude: lat,
      longitude: lng,
      is_active: uniForm.is_active,
      created_at: editingUni?.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    // Default primary campus for new universities
    const defaultCampusId = `campus_${id}_main`;
    const defaultCampusName = uniForm.defaultCampusName.trim() || `${short_name} Main Campus`;
    const defaultCampus: Campus = {
      id: defaultCampusId,
      university_id: id,
      name: defaultCampusName,
      slug: `${rawSlug}-main-campus`,
      description: `Primary main campus grounds for ${name}.`,
      address: `${uniForm.city}, ${uniForm.state}, Nigeria`,
      latitude: lat,
      longitude: lng,
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    try {
      // Optimistic update to UI state immediately
      store.addUniversity(payload);
      if (!editingUni) {
        store.addCampus(defaultCampus);
      }
      store.setSelectedUniversityId(id);
      setSelectedUniId(id);

      // Persist University to Firestore
      await setDoc(doc(db, 'universities', id), payload);

      // Persist default Campus if creating fresh
      if (!editingUni) {
        await setDoc(doc(db, 'campuses', defaultCampusId), defaultCampus);
      }

      toast.success(`🇳🇬 ${name} (${short_name}) saved successfully!`);
      setShowUniModal(false);
    } catch (err: any) {
      console.error('Error saving university to Firestore:', err);
      // Still keep in state for resilience
      toast.error(`Saved locally (Offline/Network: ${err?.message || 'Check connection'})`);
      setShowUniModal(false);
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleUniActive = async (uni: University) => {
    triggerHaptic(30);
    const newStatus = !uni.is_active;
    store.updateUniversity(uni.id, { is_active: newStatus });
    try {
      await updateDoc(doc(db, 'universities', uni.id), {
        is_active: newStatus,
        updated_at: new Date().toISOString()
      });
      toast.success(`${uni.short_name} is now ${newStatus ? 'Active' : 'Hidden'}`);
    } catch (err) {
      console.error('Error toggling university active:', err);
    }
  };

  const handleDeleteUni = async (id: string, name: string) => {
    if (!window.confirm(`Delete "${name}" and all attached campuses?`)) return;
    triggerHaptic([40, 20, 40]);
    store.deleteUniversity(id);
    try {
      await deleteDoc(doc(db, 'universities', id));
      toast.success(`Removed ${name}`);
    } catch (err) {
      console.error('Error deleting university:', err);
    }
  };

  // Campus handlers
  const openNewCampusModal = () => {
    setEditingCampus(null);
    setFormError(null);
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
    setFormError(null);
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
    if (!selectedUniId) {
      toast.error('Please select a university first.');
      return;
    }

    const name = campusForm.name.trim();
    if (!name) {
      setFormError('Campus Name is required.');
      return;
    }

    setIsSaving(true);
    const id = editingCampus ? editingCampus.id : `campus_${Date.now()}`;
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const lat = typeof campusForm.latitude === 'number' ? campusForm.latitude : parseFloat(String(campusForm.latitude)) || 6.518;
    const lng = typeof campusForm.longitude === 'number' ? campusForm.longitude : parseFloat(String(campusForm.longitude)) || 3.389;

    const payload: Campus = {
      id,
      university_id: selectedUniId,
      name,
      slug,
      description: campusForm.description.trim(),
      address: campusForm.address.trim(),
      latitude: lat,
      longitude: lng,
      is_active: campusForm.is_active,
      created_at: editingCampus?.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    try {
      store.addCampus(payload);
      await setDoc(doc(db, 'campuses', id), payload);
      toast.success(`Campus "${name}" saved!`);
      setShowCampusModal(false);
    } catch (err) {
      console.error('Error saving campus:', err);
      toast.error('Saved locally');
      setShowCampusModal(false);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteCampus = async (id: string, name: string) => {
    if (!window.confirm(`Delete campus "${name}"?`)) return;
    triggerHaptic([40, 20, 40]);
    store.deleteCampus(id);
    try {
      await deleteDoc(doc(db, 'campuses', id));
      toast.success(`Campus "${name}" deleted.`);
    } catch (err) {
      console.error('Error deleting campus:', err);
    }
  };

  const filteredCampuses = campuses.filter(c => c.university_id === selectedUniId);
  const activeSelectedUni = universities.find(u => u.id === selectedUniId) || universities[0];

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      
      {/* Top Header & Actions */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-rose-100 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-black text-slate-900">🇳🇬 Nigerian Universities & Campus Manager</h2>
            <span className="bg-rose-100 text-[#D6001C] text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider">
              {universities.length} Registered
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Dynamically add, configure, and manage university campuses, GPS coordinates, and localized food zones.
          </p>
        </div>
        <button
          onClick={openNewUniModal}
          className="bg-[#D6001C] hover:bg-red-700 text-white font-extrabold px-5 py-3 rounded-2xl text-xs flex items-center gap-2 shadow-md shadow-red-500/20 cursor-pointer transition-all hover:scale-[1.02]"
        >
          <Plus className="w-4 h-4 stroke-[3]" />
          <span>Add New University</span>
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
              onClick={() => {
                triggerHaptic(20);
                setSelectedUniId(uni.id);
                store.setSelectedUniversityId(uni.id);
              }}
              className={`p-5 rounded-3xl border transition-all cursor-pointer relative overflow-hidden ${
                isSelected
                  ? 'bg-rose-50/90 border-[#D6001C] shadow-md ring-2 ring-rose-300'
                  : 'bg-white border-slate-200 hover:border-rose-300 hover:shadow-xs'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <img
                    src={uni.logo_url || 'https://images.unsplash.com/photo-1541339907198-e08756dedf3f?auto=format&fit=crop&q=80&w=100'}
                    alt={uni.name}
                    className="w-12 h-12 rounded-2xl object-cover border border-rose-100 bg-white shadow-xs"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1541339907198-e08756dedf3f?auto=format&fit=crop&q=80&w=100';
                    }}
                  />
                  <div>
                    <h3 className="font-extrabold text-slate-900 text-sm leading-tight line-clamp-1">{uni.name}</h3>
                    <div className="flex items-center gap-1.5 mt-1">
                      <span className="text-[10px] font-mono font-black text-[#D6001C] uppercase bg-rose-100/80 px-2 py-0.5 rounded-md inline-block">
                        {uni.short_name}
                      </span>
                      {isSelected && (
                        <span className="bg-[#D6001C] text-white text-[9px] font-bold px-1.5 py-0.2 rounded-full">
                          SELECTED
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                  <button
                    onClick={() => handleToggleUniActive(uni)}
                    className={`p-1.5 rounded-xl text-xs transition-colors ${uni.is_active ? 'text-emerald-600 hover:bg-emerald-50' : 'text-slate-400 hover:bg-slate-100'}`}
                    title={uni.is_active ? 'Active' : 'Inactive'}
                  >
                    {uni.is_active ? <CheckCircle className="w-4 h-4 text-emerald-500" /> : <XCircle className="w-4 h-4 text-slate-400" />}
                  </button>
                  <button
                    onClick={() => openEditUniModal(uni)}
                    className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors"
                    title="Edit University"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDeleteUni(uni.id, uni.name)}
                    className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-xl transition-colors"
                    title="Delete University"
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
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-base text-slate-900">
                  Campuses for {activeSelectedUni?.name || selectedUniId}
                </h3>
                <span className="bg-slate-100 text-slate-700 font-mono text-[10px] font-bold px-2 py-0.5 rounded-md">
                  {activeSelectedUni?.short_name}
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Define the specific campuses for this university (e.g. Main Campus, College of Medicine, Law Campus).
              </p>
            </div>
            <button
              onClick={openNewCampusModal}
              className="bg-slate-900 hover:bg-slate-800 text-white font-extrabold px-4 py-2.5 rounded-2xl text-xs flex items-center gap-1.5 cursor-pointer shadow-xs self-start sm:self-auto"
            >
              <Plus className="w-4 h-4" />
              <span>Add Campus</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {filteredCampuses.length === 0 ? (
              <div className="col-span-2 py-8 text-center text-xs text-slate-400 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                No campuses configured yet. Click "Add Campus" to define a campus grounds.
              </div>
            ) : (
              filteredCampuses.map((camp) => (
                <div key={camp.id} className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between hover:border-slate-300 transition-colors">
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-extrabold text-slate-900 text-sm">{camp.name}</h4>
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${camp.is_active ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'}`}>
                        {camp.is_active ? 'ACTIVE' : 'INACTIVE'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">{camp.address || 'Campus grounds'}</p>
                    <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                      GPS: {camp.latitude?.toFixed(4)}, {camp.longitude?.toFixed(4)}
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => openEditCampusModal(camp)}
                      className="p-1.5 text-slate-600 hover:bg-white rounded-lg border border-slate-200 transition-colors"
                      title="Edit Campus"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDeleteCampus(camp.id, camp.name)}
                      className="p-1.5 text-rose-600 hover:bg-rose-100 rounded-lg border border-rose-200 transition-colors"
                      title="Delete Campus"
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
          <div className="bg-white w-full max-w-xl rounded-3xl p-6 shadow-2xl border border-rose-100 animate-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto">
            
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-extrabold text-slate-900 text-lg">
                {editingUni ? 'Edit University' : 'Add New Nigerian University'}
              </h3>
              <span className="text-[11px] font-bold text-slate-500 bg-rose-50 text-[#D6001C] px-2.5 py-1 rounded-full">
                🇳🇬 Real-time Sync
              </span>
            </div>

            {/* Error Message Alert */}
            {formError && (
              <div className="mt-3 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2 font-bold">
                <AlertCircle className="w-4 h-4 text-[#D6001C] shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            {/* Preset Quick-Filler (Only when creating new) */}
            {!editingUni && (
              <div className="mt-4 p-3 bg-slate-50 rounded-2xl border border-slate-200">
                <div className="flex items-center gap-1.5 text-xs font-black text-slate-700 mb-2">
                  <Sparkles className="w-3.5 h-3.5 text-[#D6001C]" />
                  <span>Quick-Fill from Popular Accredited Universities:</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {POPULAR_NIGERIAN_UNIVERSITIES.map((preset) => (
                    <button
                      key={preset.short_name}
                      type="button"
                      onClick={() => handleApplyPreset(preset)}
                      className="px-2.5 py-1 rounded-lg bg-white hover:bg-rose-50 border border-slate-200 hover:border-rose-300 text-[11px] font-extrabold text-slate-800 transition-colors cursor-pointer shadow-2xs"
                    >
                      + {preset.short_name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <form onSubmit={handleSaveUni} className="space-y-4 mt-4 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">University Full Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. University of Lagos"
                  value={uniForm.name}
                  onChange={e => {
                    setUniForm({ ...uniForm, name: e.target.value });
                    if (formError) setFormError(null);
                  }}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-[#D6001C] outline-none font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Short Name / Abbreviation *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. UNILAG"
                    value={uniForm.short_name}
                    onChange={e => {
                      setUniForm({ ...uniForm, short_name: e.target.value });
                      if (formError) setFormError(null);
                    }}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-[#D6001C] outline-none font-bold uppercase"
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
                  <label className="font-bold text-slate-700 block mb-1">City / Town *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Yaba / Akoka"
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

              {!editingUni && (
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Primary Campus Name (Auto-created)</label>
                  <input
                    type="text"
                    placeholder="e.g. Akoka Main Campus"
                    value={uniForm.defaultCampusName}
                    onChange={e => setUniForm({ ...uniForm, defaultCampusName: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-[#D6001C] outline-none font-semibold text-slate-800"
                  />
                  <span className="text-[10px] text-slate-400 mt-0.5 block">
                    Automatically initializes this primary campus for instant food zone and vendor mapping.
                  </span>
                </div>
              )}

              <div>
                <label className="font-bold text-slate-700 block mb-1">Description / Motto</label>
                <textarea
                  rows={2}
                  placeholder="Overview of the university campus and student community..."
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
                  <label className="font-bold text-slate-700 block mb-1">Latitude (GPS)</label>
                  <input
                    type="number"
                    step="any"
                    value={uniForm.latitude}
                    onChange={e => setUniForm({ ...uniForm, latitude: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-[#D6001C] outline-none font-mono"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Longitude (GPS)</label>
                  <input
                    type="number"
                    step="any"
                    value={uniForm.longitude}
                    onChange={e => setUniForm({ ...uniForm, longitude: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-[#D6001C] outline-none font-mono"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="active_check"
                  checked={uniForm.is_active}
                  onChange={e => setUniForm({ ...uniForm, is_active: e.target.checked })}
                  className="w-4 h-4 text-[#D6001C] rounded-md focus:ring-rose-500 cursor-pointer"
                />
                <label htmlFor="active_check" className="font-bold text-slate-800 cursor-pointer">
                  Active (Visible in student university switcher & marketplace)
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={() => setShowUniModal(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 font-bold hover:bg-slate-100 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-6 py-2.5 rounded-xl bg-[#D6001C] text-white font-extrabold hover:bg-red-700 cursor-pointer shadow-md shadow-red-500/20 flex items-center gap-2 disabled:opacity-50"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <span>{editingUni ? 'Save Changes' : 'Create University'}</span>
                  )}
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

            {formError && (
              <div className="mt-3 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2 font-bold">
                <AlertCircle className="w-4 h-4 text-[#D6001C] shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleSaveCampus} className="space-y-4 mt-4 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Campus Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Akoka Main Campus"
                  value={campusForm.name}
                  onChange={e => {
                    setCampusForm({ ...campusForm, name: e.target.value });
                    if (formError) setFormError(null);
                  }}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-[#D6001C] outline-none font-bold"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Address / Landmark</label>
                <input
                  type="text"
                  placeholder="e.g. University Road, Akoka, Yaba"
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
                  disabled={isSaving}
                  onClick={() => setShowCampusModal(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 font-bold hover:bg-slate-100 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2.5 rounded-xl bg-slate-900 text-white font-extrabold hover:bg-slate-800 cursor-pointer flex items-center gap-2 disabled:opacity-50"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <span>Save Campus</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};


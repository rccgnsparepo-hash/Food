import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  MapPin,
  Plus,
  Trash2,
  Edit2,
  Building,
  Navigation,
  DollarSign,
  Shield,
  Layers,
  Save,
  CheckCircle2,
  AlertCircle,
  Search,
  Compass,
  Clock,
  RotateCcw,
  Sparkles
} from 'lucide-react';
import { CampusLocation, DeliveryZone, CampusLocationType, CampusBoundary } from '../../types';
import {
  DEFAULT_MTU_CAMPUS_LOCATIONS,
  DEFAULT_MTU_DELIVERY_ZONES,
  DEFAULT_MTU_BOUNDARY,
  subscribeToCampusLocations,
  subscribeToDeliveryZones,
  saveCampusLocation,
  deleteCampusLocation,
  saveDeliveryZone,
  deleteDeliveryZone,
  seedCampusLocationsIfEmpty
} from '../../services/campusLocationService';
import { calculateDeliveryFee } from '../../services/deliveryFeeService';
import { CampusDeliveryMap } from '../ui/CampusDeliveryMap';
import { triggerHaptic } from '../../utils/haptics';
import { toast } from 'sonner';

export const CampusMapManager: React.FC = () => {
  const [locations, setLocations] = useState<CampusLocation[]>(DEFAULT_MTU_CAMPUS_LOCATIONS);
  const [zones, setZones] = useState<DeliveryZone[]>(DEFAULT_MTU_DELIVERY_ZONES);
  const [boundary, setBoundary] = useState<CampusBoundary>(DEFAULT_MTU_BOUNDARY);
  const [activeTab, setActiveTab] = useState<'locations' | 'zones' | 'boundary' | 'tester'>('locations');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<string>('all');

  // Selected Location for Map focus / Editing
  const [selectedLocation, setSelectedLocation] = useState<CampusLocation | null>(null);
  const [editingLocation, setEditingLocation] = useState<Partial<CampusLocation> | null>(null);

  // Editing Zone
  const [editingZone, setEditingZone] = useState<Partial<DeliveryZone> | null>(null);

  // Fee Tester Coordinates State
  const [testCustomerLat, setTestCustomerLat] = useState(6.7638);
  const [testCustomerLng, setTestCustomerLng] = useState(3.3782);
  const [testVendorLat, setTestVendorLat] = useState(6.7628);
  const [testVendorLng, setTestVendorLng] = useState(3.3768);

  useEffect(() => {
    seedCampusLocationsIfEmpty();
    const unsubLocs = subscribeToCampusLocations('campus_mtu_main', (data) => {
      if (data && data.length > 0) setLocations(data);
    });
    const unsubZones = subscribeToDeliveryZones('campus_mtu_main', (data) => {
      if (data && data.length > 0) setZones(data);
    });

    return () => {
      unsubLocs();
      unsubZones();
    };
  }, []);

  // Filter locations
  const filteredLocations = locations.filter((loc) => {
    const matchesSearch =
      loc.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (loc.building_code && loc.building_code.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (loc.landmark && loc.landmark.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesType = selectedTypeFilter === 'all' || loc.type === selectedTypeFilter;
    return matchesSearch && matchesType;
  });

  // Handle Save Location
  const handleSaveLocation = async () => {
    if (!editingLocation?.name || !editingLocation.latitude || !editingLocation.longitude) {
      toast.error('Location name, latitude, and longitude are required.');
      return;
    }

    triggerHaptic(40);
    const res = await saveCampusLocation({
      id: editingLocation.id,
      name: editingLocation.name,
      type: editingLocation.type || 'hostel',
      latitude: Number(editingLocation.latitude),
      longitude: Number(editingLocation.longitude),
      building_code: editingLocation.building_code || '',
      landmark: editingLocation.landmark || '',
      description: editingLocation.description || '',
      delivery_zone_id: editingLocation.delivery_zone_id || 'zone_mtu_central',
      zone_name: editingLocation.zone_name || 'Zone A',
      popular_for_delivery: editingLocation.popular_for_delivery ?? true,
      searchable: editingLocation.searchable ?? true,
      active: editingLocation.active ?? true
    });

    if (res.success) {
      toast.success(`Saved campus location: ${editingLocation.name}`);
      setEditingLocation(null);
    } else {
      toast.error(res.error || 'Failed to save location.');
    }
  };

  // Handle Delete Location
  const handleDeleteLocation = async (id: string, name: string) => {
    triggerHaptic(40);
    const res = await deleteCampusLocation(id);
    if (res.success) {
      toast.success(`Deleted location: ${name}`);
      if (selectedLocation?.id === id) setSelectedLocation(null);
    } else {
      toast.error('Failed to delete location.');
    }
  };

  // Handle Save Zone
  const handleSaveZone = async () => {
    if (!editingZone?.name || editingZone.base_fee === undefined) {
      toast.error('Zone name and base fee are required.');
      return;
    }

    triggerHaptic(40);
    const res = await saveDeliveryZone({
      id: editingZone.id,
      name: editingZone.name,
      code: editingZone.code || 'ZONE_CUSTOM',
      description: editingZone.description || '',
      color: editingZone.color || '#10B981',
      base_fee: Number(editingZone.base_fee) || 300,
      per_km_fee: Number(editingZone.per_km_fee) || 100,
      estimated_delivery_time: editingZone.estimated_delivery_time || '10-15 min',
      estimated_minutes: Number(editingZone.estimated_minutes) || 12,
      center_lat: Number(editingZone.center_lat) || 6.7628,
      center_lng: Number(editingZone.center_lng) || 3.3768,
      radius_meters: Number(editingZone.radius_meters) || 500
    });

    if (res.success) {
      toast.success(`Saved delivery zone: ${editingZone.name}`);
      setEditingZone(null);
    } else {
      toast.error('Failed to save delivery zone.');
    }
  };

  // Test Fee Calculation
  const testFeeBreakdown = calculateDeliveryFee({
    customerLat: testCustomerLat,
    customerLng: testCustomerLng,
    vendorLat: testVendorLat,
    vendorLng: testVendorLng,
    zones
  });

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-slate-900 text-white rounded-3xl p-6 shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 bg-emerald-500/20 text-emerald-400 rounded-xl">
              <Compass className="w-6 h-6" />
            </span>
            <div>
              <h1 className="text-xl font-black">Campus GPS Map & Delivery Zones</h1>
              <p className="text-xs text-slate-400">
                Manage Mountain Top University locations database, geofences & pricing zones
              </p>
            </div>
          </div>
        </div>

        {/* Quick Nav Tabs */}
        <div className="flex bg-slate-800 p-1 rounded-2xl gap-1">
          {[
            { id: 'locations', label: `Locations (${locations.length})`, icon: Building },
            { id: 'zones', label: `Pricing Zones (${zones.length})`, icon: Layers },
            { id: 'boundary', label: 'Geofence Boundary', icon: Shield },
            { id: 'tester', label: 'Fee Simulator', icon: DollarSign }
          ].map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  triggerHaptic(20);
                  setActiveTab(tab.id as any);
                }}
                className={`px-3 py-2 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer ${
                  activeTab === tab.id
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Grid: Left Map + Right Editor */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Map Column (7 cols) */}
        <div className="lg:col-span-7 space-y-3">
          <div className="bg-white rounded-3xl p-4 shadow-xs border border-slate-200">
            <div className="flex items-center justify-between mb-3 px-1">
              <div>
                <h2 className="text-sm font-black text-slate-900">Campus Live Map Visualizer</h2>
                <p className="text-xs text-slate-500">
                  Click any marker or map spot to inspect coordinates and zone coverage
                </p>
              </div>
              <span className="text-[11px] font-bold px-2.5 py-1 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200">
                Mountain Top University
              </span>
            </div>

            <CampusDeliveryMap
              latitude={selectedLocation?.latitude || 6.7628}
              longitude={selectedLocation?.longitude || 3.3768}
              restaurantLat={6.7628}
              restaurantLng={3.3768}
              height="450px"
              showLandmarks={true}
              showGeofence={true}
              onCampusLocationPick={(loc) => {
                setSelectedLocation(loc);
              }}
              onLocationSelect={(lat, lng, info) => {
                if (activeTab === 'tester') {
                  setTestCustomerLat(lat);
                  setTestCustomerLng(lng);
                } else if (editingLocation) {
                  setEditingLocation((prev) => ({
                    ...prev,
                    latitude: Number(lat.toFixed(6)),
                    longitude: Number(lng.toFixed(6))
                  }));
                }
              }}
            />
          </div>

          {/* Active Selection Details Card */}
          {selectedLocation && (
            <div className="bg-white rounded-3xl p-4 shadow-xs border border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-emerald-100 text-emerald-800 rounded-2xl font-black">
                  <Building className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900">{selectedLocation.name}</h3>
                  <p className="text-xs text-slate-500">
                    {selectedLocation.building_code || selectedLocation.type.toUpperCase()} • GPS:{' '}
                    {selectedLocation.latitude.toFixed(4)}, {selectedLocation.longitude.toFixed(4)}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setEditingLocation(selectedLocation);
                    setActiveTab('locations');
                  }}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  <span>Edit</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Right Editor Column (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          {/* TAB 1: CAMPUS LOCATIONS DATABASE */}
          {activeTab === 'locations' && (
            <div className="bg-white rounded-3xl p-5 shadow-xs border border-slate-200 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                  <h2 className="text-sm font-black text-slate-900">Campus Locations Database</h2>
                  <p className="text-xs text-slate-500">Hostels, Faculties, Lecture halls & Gates</p>
                </div>
                <button
                  onClick={() => {
                    triggerHaptic(20);
                    setEditingLocation({
                      name: '',
                      type: 'hostel',
                      latitude: 6.7638,
                      longitude: 3.3782,
                      building_code: '',
                      landmark: '',
                      delivery_zone_id: 'zone_mtu_hostels',
                      zone_name: 'Zone B — Hostels',
                      popular_for_delivery: true,
                      searchable: true,
                      active: true
                    });
                  }}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Location</span>
                </button>
              </div>

              {/* Editing Modal / Form */}
              {editingLocation && (
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                    <span className="text-xs font-black text-slate-900">
                      {editingLocation.id ? 'Edit Campus Location' : 'New Campus Location'}
                    </span>
                    <button
                      onClick={() => setEditingLocation(null)}
                      className="text-xs text-slate-400 hover:text-slate-600 font-bold"
                    >
                      ✕ Cancel
                    </button>
                  </div>

                  <div className="space-y-2">
                    <div>
                      <label className="text-[11px] font-bold text-slate-700 block mb-1">Building / Location Name</label>
                      <input
                        type="text"
                        value={editingLocation.name || ''}
                        onChange={(e) => setEditingLocation({ ...editingLocation, name: e.target.value })}
                        placeholder="e.g. Daniel Hall (Male Hostel)"
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-900 outline-none focus:ring-2 focus:ring-emerald-600"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[11px] font-bold text-slate-700 block mb-1">Type</label>
                        <select
                          value={editingLocation.type || 'hostel'}
                          onChange={(e) =>
                            setEditingLocation({ ...editingLocation, type: e.target.value as CampusLocationType })
                          }
                          className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-900 outline-none"
                        >
                          <option value="hostel">Hostel / Hall</option>
                          <option value="faculty">Faculty Complex</option>
                          <option value="department">Department</option>
                          <option value="lecture_hall">Lecture Hall / MPH</option>
                          <option value="cafeteria">Cafeteria / Food Court</option>
                          <option value="vendor">Vendor Spot</option>
                          <option value="gate">Campus Gate</option>
                          <option value="library">Library</option>
                          <option value="medical">Medical Centre</option>
                          <option value="sports">Sports Arena</option>
                          <option value="admin">Admin / Senate</option>
                          <option value="landmark">Landmark / Plaza</option>
                        </select>
                      </div>

                      <div>
                        <label className="text-[11px] font-bold text-slate-700 block mb-1">Building Code</label>
                        <input
                          type="text"
                          value={editingLocation.building_code || ''}
                          onChange={(e) => setEditingLocation({ ...editingLocation, building_code: e.target.value })}
                          placeholder="e.g. DH-M"
                          className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-900 outline-none"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[11px] font-bold text-slate-700 block mb-1">Latitude</label>
                        <input
                          type="number"
                          step="0.0001"
                          value={editingLocation.latitude || ''}
                          onChange={(e) => setEditingLocation({ ...editingLocation, latitude: Number(e.target.value) })}
                          className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-900 outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-bold text-slate-700 block mb-1">Longitude</label>
                        <input
                          type="number"
                          step="0.0001"
                          value={editingLocation.longitude || ''}
                          onChange={(e) => setEditingLocation({ ...editingLocation, longitude: Number(e.target.value) })}
                          className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-900 outline-none"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-slate-700 block mb-1">Landmark / Meeting Point</label>
                      <input
                        type="text"
                        value={editingLocation.landmark || ''}
                        onChange={(e) => setEditingLocation({ ...editingLocation, landmark: e.target.value })}
                        placeholder="e.g. Opposite East Basketball Court"
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-900 outline-none"
                      />
                    </div>

                    <button
                      onClick={handleSaveLocation}
                      className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black flex items-center justify-center gap-1.5 cursor-pointer shadow-md"
                    >
                      <Save className="w-4 h-4" />
                      <span>Save Location to Database</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Search & Filter */}
              <div className="flex gap-2">
                <div className="flex-1 relative">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search campus locations..."
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-8 pr-3 py-2 text-xs font-medium text-slate-800 outline-none focus:ring-2 focus:ring-emerald-600"
                  />
                </div>
                <select
                  value={selectedTypeFilter}
                  onChange={(e) => setSelectedTypeFilter(e.target.value)}
                  className="bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 text-xs font-semibold text-slate-700 outline-none"
                >
                  <option value="all">All Types</option>
                  <option value="hostel">Hostels</option>
                  <option value="faculty">Faculties</option>
                  <option value="cafeteria">Cafeterias</option>
                  <option value="gate">Gates</option>
                </select>
              </div>

              {/* Locations List */}
              <div className="divide-y divide-slate-100 max-h-96 overflow-y-auto pr-1">
                {filteredLocations.map((loc) => (
                  <div
                    key={loc.id}
                    onClick={() => setSelectedLocation(loc)}
                    className={`py-2.5 px-2 rounded-xl transition-colors cursor-pointer flex items-center justify-between ${
                      selectedLocation?.id === loc.id ? 'bg-emerald-50' : 'hover:bg-slate-50'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-slate-900 truncate">{loc.name}</p>
                      <p className="text-[11px] text-slate-500 truncate">
                        {loc.building_code ? `[${loc.building_code}] ` : ''}
                        {loc.landmark || loc.description}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0 ml-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingLocation(loc);
                        }}
                        className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-200"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteLocation(loc.id, loc.name);
                        }}
                        className="p-1.5 text-rose-400 hover:text-rose-600 rounded-lg hover:bg-rose-50"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 2: PRICING ZONES */}
          {activeTab === 'zones' && (
            <div className="bg-white rounded-3xl p-5 shadow-xs border border-slate-200 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                  <h2 className="text-sm font-black text-slate-900">Campus Delivery Zones</h2>
                  <p className="text-xs text-slate-500">Configure base fees, per-km rates & radius</p>
                </div>
                <button
                  onClick={() => {
                    setEditingZone({
                      name: 'Zone New',
                      code: 'ZONE_CUSTOM',
                      base_fee: 300,
                      per_km_fee: 100,
                      estimated_delivery_time: '10-15 min',
                      estimated_minutes: 12,
                      center_lat: 6.7628,
                      center_lng: 3.3768,
                      radius_meters: 600,
                      color: '#10B981'
                    });
                  }}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>New Zone</span>
                </button>
              </div>

              {/* Editing Zone Form */}
              {editingZone && (
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                    <span className="text-xs font-black text-slate-900">Configure Zone</span>
                    <button onClick={() => setEditingZone(null)} className="text-xs text-slate-400 font-bold">
                      ✕ Cancel
                    </button>
                  </div>

                  <div className="space-y-2">
                    <div>
                      <label className="text-[11px] font-bold text-slate-700 block mb-1">Zone Name</label>
                      <input
                        type="text"
                        value={editingZone.name || ''}
                        onChange={(e) => setEditingZone({ ...editingZone, name: e.target.value })}
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold outline-none"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[11px] font-bold text-slate-700 block mb-1">Base Fee (₦)</label>
                        <input
                          type="number"
                          value={editingZone.base_fee || 0}
                          onChange={(e) => setEditingZone({ ...editingZone, base_fee: Number(e.target.value) })}
                          className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-bold text-slate-700 block mb-1">Per Km Fee (₦)</label>
                        <input
                          type="number"
                          value={editingZone.per_km_fee || 0}
                          onChange={(e) => setEditingZone({ ...editingZone, per_km_fee: Number(e.target.value) })}
                          className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold outline-none"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[11px] font-bold text-slate-700 block mb-1">Radius (meters)</label>
                        <input
                          type="number"
                          value={editingZone.radius_meters || 500}
                          onChange={(e) => setEditingZone({ ...editingZone, radius_meters: Number(e.target.value) })}
                          className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-bold text-slate-700 block mb-1">ETA Text</label>
                        <input
                          type="text"
                          value={editingZone.estimated_delivery_time || '10-15 min'}
                          onChange={(e) => setEditingZone({ ...editingZone, estimated_delivery_time: e.target.value })}
                          className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold outline-none"
                        />
                      </div>
                    </div>

                    <button
                      onClick={handleSaveZone}
                      className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black flex items-center justify-center gap-1.5 shadow-md cursor-pointer"
                    >
                      <Save className="w-4 h-4" />
                      <span>Save Pricing Zone</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Zones Cards */}
              <div className="space-y-2.5">
                {zones.map((z) => (
                  <div
                    key={z.id}
                    className="p-3.5 rounded-2xl border border-slate-200 bg-white hover:border-slate-300 transition-all flex items-center justify-between"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full" style={{ backgroundColor: z.color }} />
                        <h4 className="text-xs font-black text-slate-900">{z.name}</h4>
                      </div>
                      <p className="text-[11px] text-slate-500 font-medium">
                        Base: ₦{z.base_fee} • +₦{z.per_km_fee}/km • Radius: {z.radius_meters}m • ETA: {z.estimated_delivery_time}
                      </p>
                    </div>
                    <button
                      onClick={() => setEditingZone(z)}
                      className="p-2 bg-slate-100 hover:bg-slate-200 rounded-xl text-slate-700 cursor-pointer"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 3: CAMPUS GEOFENCE BOUNDARY */}
          {activeTab === 'boundary' && (
            <div className="bg-white rounded-3xl p-5 shadow-xs border border-slate-200 space-y-4">
              <div className="border-b border-slate-100 pb-3">
                <h2 className="text-sm font-black text-slate-900">Campus Geofence Boundary</h2>
                <p className="text-xs text-slate-500">Operational boundary for order validity</p>
              </div>

              <div className="space-y-3">
                <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 space-y-1">
                  <p className="font-extrabold flex items-center gap-1.5">
                    <Shield className="w-4 h-4 text-emerald-700" />
                    Strict Geofencing Active
                  </p>
                  <p className="text-[11px] text-emerald-700 font-medium">
                    Deliveries outside the {boundary.radius_meters}m radius will trigger out-of-boundary warnings to students and riders.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-bold text-slate-700 block mb-1">Center Lat</label>
                    <input
                      type="number"
                      step="0.0001"
                      value={boundary.center_latitude}
                      onChange={(e) => setBoundary({ ...boundary, center_latitude: Number(e.target.value) })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-slate-700 block mb-1">Center Lng</label>
                    <input
                      type="number"
                      step="0.0001"
                      value={boundary.center_longitude}
                      onChange={(e) => setBoundary({ ...boundary, center_longitude: Number(e.target.value) })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-900"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">Operational Radius (Meters)</label>
                  <input
                    type="number"
                    value={boundary.radius_meters}
                    onChange={(e) => setBoundary({ ...boundary, radius_meters: Number(e.target.value) })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-900"
                  />
                </div>

                <button
                  onClick={() => {
                    toast.success('Updated Campus Geofence Boundary parameters');
                  }}
                  className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black flex items-center justify-center gap-1.5 shadow-md cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  <span>Update Geofence</span>
                </button>
              </div>
            </div>
          )}

          {/* TAB 4: LIVE DELIVERY FEE TESTER */}
          {activeTab === 'tester' && (
            <div className="bg-white rounded-3xl p-5 shadow-xs border border-slate-200 space-y-4">
              <div className="border-b border-slate-100 pb-3">
                <h2 className="text-sm font-black text-slate-900">Authoritative Delivery Fee Simulator</h2>
                <p className="text-xs text-slate-500">
                  Calculates real pricing using zone rules and campus coordinates
                </p>
              </div>

              <div className="space-y-3">
                <div className="p-4 rounded-2xl bg-linear-to-r from-emerald-600 to-teal-700 text-white space-y-2 shadow-lg">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase font-bold text-emerald-200">
                      Calculated Total Fee
                    </span>
                    <span className="text-xs font-bold bg-white/20 px-2 py-0.5 rounded-md">
                      {testFeeBreakdown.zoneCode}
                    </span>
                  </div>
                  <div className="flex items-baseline justify-between">
                    <span className="text-2xl font-black">₦{testFeeBreakdown.totalDeliveryFee}</span>
                    <span className="text-xs font-bold text-emerald-100">
                      ETA: {testFeeBreakdown.estimatedDeliveryTime}
                    </span>
                  </div>
                </div>

                {/* Calculation Breakdown */}
                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-2 text-xs">
                  <div className="flex justify-between text-slate-600">
                    <span>Base Fee ({testFeeBreakdown.zoneName})</span>
                    <span className="font-bold text-slate-900">₦{testFeeBreakdown.baseFee}</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Distance Fee ({testFeeBreakdown.distanceKm} km @ ₦{testFeeBreakdown.zone.per_km_fee}/km)</span>
                    <span className="font-bold text-slate-900">₦{testFeeBreakdown.distanceFee}</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Door/Room Delivery Option Add-on</span>
                    <span className="font-bold text-slate-900">+₦{testFeeBreakdown.optionAddon}</span>
                  </div>
                  <div className="border-t border-slate-200 pt-2 flex justify-between font-black text-slate-900 text-sm">
                    <span>Total Authoritative Delivery Charge</span>
                    <span className="text-emerald-700">₦{testFeeBreakdown.totalDeliveryFee}</span>
                  </div>
                </div>

                <p className="text-[11px] text-slate-500 italic text-center">
                  💡 Tap anywhere on the map on the left to set test customer drop-off coordinates.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

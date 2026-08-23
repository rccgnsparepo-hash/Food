import { db } from '../lib/firebase';
import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  onSnapshot
} from "../lib/embeddedDb";
import { CampusLocation, DeliveryZone, CampusBoundary, CampusLocationType } from '../types';

/**
 * DEFAULT CAMPUS BOUNDARY (Mountain Top University, Prayer City, Ogun State)
 * Centered around 6.7628 N, 3.3768 E with ~2.5km operational radius
 */
export const DEFAULT_MTU_BOUNDARY: CampusBoundary = {
  campus_id: 'campus_mtu_main',
  campus_name: 'Mountain Top University (Main Campus)',
  center_latitude: 6.7628,
  center_longitude: 3.3768,
  radius_meters: 2200,
  polygon_coordinates: [
    [6.7720, 3.3680],
    [6.7725, 3.3850],
    [6.7530, 3.3860],
    [6.7520, 3.3670],
    [6.7720, 3.3680]
  ],
  is_strict: true
};

/**
 * DEFAULT DELIVERY ZONES FOR MTU
 */
export const DEFAULT_MTU_DELIVERY_ZONES: DeliveryZone[] = [
  {
    id: 'zone_mtu_central',
    zone_id: 'ZONE_A',
    campus_id: 'campus_mtu_main',
    university_id: 'uni_mtu',
    name: 'Zone A — Central Campus & Food Court',
    code: 'ZONE_A',
    description: 'Central Food Court, Senate Walkway, Central Canteen & Arcade',
    color: '#10B981', // Emerald
    base_fee: 250,
    per_km_fee: 100,
    estimated_delivery_time: '5-10 min',
    estimated_minutes: 8,
    center_lat: 6.7628,
    center_lng: 3.3768,
    radius_meters: 350,
    active: true,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z'
  },
  {
    id: 'zone_mtu_hostels',
    zone_id: 'ZONE_B',
    campus_id: 'campus_mtu_main',
    university_id: 'uni_mtu',
    name: 'Zone B — Male & Female Student Hostels',
    code: 'ZONE_B',
    description: 'Daniel Hall, Esther Hall, Deborah Hall, Joseph Hall & Residential Wings',
    color: '#3B82F6', // Blue
    base_fee: 350,
    per_km_fee: 120,
    estimated_delivery_time: '10-15 min',
    estimated_minutes: 12,
    center_lat: 6.7635,
    center_lng: 3.3780,
    radius_meters: 650,
    active: true,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z'
  },
  {
    id: 'zone_mtu_academic',
    zone_id: 'ZONE_C',
    campus_id: 'campus_mtu_main',
    university_id: 'uni_mtu',
    name: 'Zone C — Academic & Faculty Complex',
    code: 'ZONE_C',
    description: 'CBAS Science Complex, CHMS Arts Complex, CBT Hub & Lecture Theatres',
    color: '#8B5CF6', // Purple
    base_fee: 300,
    per_km_fee: 110,
    estimated_delivery_time: '8-12 min',
    estimated_minutes: 10,
    center_lat: 6.7618,
    center_lng: 3.3752,
    radius_meters: 500,
    active: true,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z'
  },
  {
    id: 'zone_mtu_outer',
    zone_id: 'ZONE_D',
    campus_id: 'campus_mtu_main',
    university_id: 'uni_mtu',
    name: 'Zone D — Sports Pavilion, Clinic & Main Gates',
    code: 'ZONE_D',
    description: 'Sports Arena, University Medical Centre, Security Gates & Parking',
    color: '#F59E0B', // Amber
    base_fee: 400,
    per_km_fee: 150,
    estimated_delivery_time: '12-18 min',
    estimated_minutes: 15,
    center_lat: 6.7640,
    center_lng: 3.3745,
    radius_meters: 900,
    active: true,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z'
  }
];

/**
 * DEFAULT CAMPUS LOCATIONS FOR MTU
 */
export const DEFAULT_MTU_CAMPUS_LOCATIONS: CampusLocation[] = [
  // --- STUDENT HOSTELS & RESIDENTIAL HALLS ---
  {
    id: 'loc_daniel_hall',
    campus_id: 'campus_mtu_main',
    university_id: 'uni_mtu',
    name: 'Daniel Hall (Male Hostel)',
    type: 'hostel',
    latitude: 6.7638,
    longitude: 3.3782,
    description: 'Premier Male Student Residence. Block A & B, Porters Lodge ground floor.',
    landmark: 'Opposite East Basketball Court',
    building_code: 'DH-M',
    delivery_zone_id: 'zone_mtu_hostels',
    zone_name: 'Zone B — Hostels',
    popular_for_delivery: true,
    searchable: true,
    active: true
  },
  {
    id: 'loc_esther_hall',
    campus_id: 'campus_mtu_main',
    university_id: 'uni_mtu',
    name: 'Esther Hall (Female Hostel)',
    type: 'hostel',
    latitude: 6.7645,
    longitude: 3.3778,
    description: 'Female Undergraduate Residence. Porters Entrance & Delivery Common Room.',
    landmark: 'Beside Chapel Walkway Garden',
    building_code: 'EH-F',
    delivery_zone_id: 'zone_mtu_hostels',
    zone_name: 'Zone B — Hostels',
    popular_for_delivery: true,
    searchable: true,
    active: true
  },
  {
    id: 'loc_deborah_hall',
    campus_id: 'campus_mtu_main',
    university_id: 'uni_mtu',
    name: 'Deborah Hall (Female Hostel)',
    type: 'hostel',
    latitude: 6.7650,
    longitude: 3.3786,
    description: 'Female Hall of Residence Block C & D. Security desk foyer.',
    landmark: 'Behind Esther Hall Garden',
    building_code: 'DH-F',
    delivery_zone_id: 'zone_mtu_hostels',
    zone_name: 'Zone B — Hostels',
    popular_for_delivery: true,
    searchable: true,
    active: true
  },
  {
    id: 'loc_joseph_hall',
    campus_id: 'campus_mtu_main',
    university_id: 'uni_mtu',
    name: 'Joseph Hall (Male Hostel)',
    type: 'hostel',
    latitude: 6.7632,
    longitude: 3.3790,
    description: 'Male Student Hall Block 1 & 2. Main gate delivery reception.',
    landmark: 'Near Tennis Court Pavilion',
    building_code: 'JH-M',
    delivery_zone_id: 'zone_mtu_hostels',
    zone_name: 'Zone B — Hostels',
    popular_for_delivery: true,
    searchable: true,
    active: true
  },
  {
    id: 'loc_samuel_hall',
    campus_id: 'campus_mtu_main',
    university_id: 'uni_mtu',
    name: 'Samuel Hall (Male Hostel)',
    type: 'hostel',
    latitude: 6.7641,
    longitude: 3.3795,
    description: 'Senior Male Residence Hall. Ground floor entrance.',
    landmark: 'East Wing Residential Perimeter',
    building_code: 'SH-M',
    delivery_zone_id: 'zone_mtu_hostels',
    zone_name: 'Zone B — Hostels',
    popular_for_delivery: true,
    searchable: true,
    active: true
  },

  // --- ACADEMIC FACULTIES & LECTURE COMPLEXES ---
  {
    id: 'loc_cbas_complex',
    campus_id: 'campus_mtu_main',
    university_id: 'uni_mtu',
    name: 'CBAS Complex (College of Basic & Applied Sciences)',
    type: 'faculty',
    latitude: 6.7618,
    longitude: 3.3752,
    description: 'Computer Science, Biochemistry, Microbiology, Physics & Chemistry Labs & Lecture Theatres.',
    landmark: 'Opposite Central Fountain',
    building_code: 'CBAS-01',
    delivery_zone_id: 'zone_mtu_academic',
    zone_name: 'Zone C — Academic',
    popular_for_delivery: true,
    searchable: true,
    active: true
  },
  {
    id: 'loc_chms_complex',
    campus_id: 'campus_mtu_main',
    university_id: 'uni_mtu',
    name: 'CHMS Complex (Humanities, Management & Social Sciences)',
    type: 'faculty',
    latitude: 6.7612,
    longitude: 3.3760,
    description: 'Accounting, Business Admin, Mass Communication & Economics Lecture Hall Foyer.',
    landmark: 'Beside University Senate Walkway',
    building_code: 'CHMS-02',
    delivery_zone_id: 'zone_mtu_academic',
    zone_name: 'Zone C — Academic',
    popular_for_delivery: true,
    searchable: true,
    active: true
  },
  {
    id: 'loc_multipurpose_hall',
    campus_id: 'campus_mtu_main',
    university_id: 'uni_mtu',
    name: 'University Multipurpose Hall (MPH)',
    type: 'lecture_hall',
    latitude: 6.7622,
    longitude: 3.3762,
    description: '2,500-seater Auditorium, Matriculation Hall & Examination Centre.',
    landmark: 'Central Campus Plaza',
    building_code: 'MPH-MAIN',
    delivery_zone_id: 'zone_mtu_academic',
    zone_name: 'Zone C — Academic',
    popular_for_delivery: true,
    searchable: true,
    active: true
  },
  {
    id: 'loc_central_library',
    campus_id: 'campus_mtu_main',
    university_id: 'uni_mtu',
    name: 'University Central Library & E-Learning Wing',
    type: 'library',
    latitude: 6.7627,
    longitude: 3.3769,
    description: 'Quiet Study Halls, Digital Resource Centre & Library Quadrangle Walkway.',
    landmark: 'Beside Chill Spot Drink Stand',
    building_code: 'LIB-CENTRAL',
    delivery_zone_id: 'zone_mtu_central',
    zone_name: 'Zone A — Central',
    popular_for_delivery: true,
    searchable: true,
    active: true
  },
  {
    id: 'loc_ict_cbt_hub',
    campus_id: 'campus_mtu_main',
    university_id: 'uni_mtu',
    name: 'ICT Centre & CBT Exam Hub',
    type: 'department',
    latitude: 6.7615,
    longitude: 3.3748,
    description: 'High-speed Computer Testing Hall & Campus IT Support Foyer.',
    landmark: 'Near CBAS Science Building',
    building_code: 'ICT-CBT',
    delivery_zone_id: 'zone_mtu_academic',
    zone_name: 'Zone C — Academic',
    popular_for_delivery: true,
    searchable: true,
    active: true
  },

  // --- CAFETERIAS & FOOD HUBS ---
  {
    id: 'loc_central_canteen',
    campus_id: 'campus_mtu_main',
    university_id: 'uni_mtu',
    name: 'MTU Students Central Canteen',
    type: 'cafeteria',
    latitude: 6.7628,
    longitude: 3.3768,
    description: 'Main Campus Food Court featuring multiple local and continental kitchen stands.',
    landmark: 'Central Student Arcade',
    building_code: 'CANTEEN-01',
    delivery_zone_id: 'zone_mtu_central',
    zone_name: 'Zone A — Central',
    popular_for_delivery: true,
    searchable: true,
    active: true
  },
  {
    id: 'loc_east_food_arcade',
    campus_id: 'campus_mtu_main',
    university_id: 'uni_mtu',
    name: 'East Hall Food Arcade & Mama Tee Stand',
    type: 'vendor',
    latitude: 6.7630,
    longitude: 3.3770,
    description: 'Fresh Buka meals, Amala spot, and grab-and-go snack stands.',
    landmark: 'Beside Daniel Hall Walkway',
    building_code: 'EAST-FOOD',
    delivery_zone_id: 'zone_mtu_central',
    zone_name: 'Zone A — Central',
    popular_for_delivery: true,
    searchable: true,
    active: true
  },
  {
    id: 'loc_sports_pavilion_eats',
    campus_id: 'campus_mtu_main',
    university_id: 'uni_mtu',
    name: 'Sports Pavilion & Suya Spot',
    type: 'vendor',
    latitude: 6.7632,
    longitude: 3.3760,
    description: 'Evening Grills, Peppered Wings, Shawarma & Soft Drinks.',
    landmark: 'University Football Arena Pavilion',
    building_code: 'SP-GRILL',
    delivery_zone_id: 'zone_mtu_outer',
    zone_name: 'Zone D — Outer',
    popular_for_delivery: true,
    searchable: true,
    active: true
  },

  // --- GATES, SECURITY & HEALTH ---
  {
    id: 'loc_main_gate',
    campus_id: 'campus_mtu_main',
    university_id: 'uni_mtu',
    name: 'Main Campus Gate (Lagos-Ibadan Expressway Entrance)',
    type: 'gate',
    latitude: 6.7605,
    longitude: 3.3735,
    description: 'Primary security checkpoint, visitor verification and courier ingress.',
    landmark: 'Highway Arch Gateway',
    building_code: 'GATE-01',
    delivery_zone_id: 'zone_mtu_outer',
    zone_name: 'Zone D — Outer',
    popular_for_delivery: true,
    searchable: true,
    active: true
  },
  {
    id: 'loc_prayer_city_gate',
    campus_id: 'campus_mtu_main',
    university_id: 'uni_mtu',
    name: 'Prayer City East Gate & Shuttle Park',
    type: 'gate',
    latitude: 6.7655,
    longitude: 3.3800,
    description: 'Pedestrian and campus bus drop-off gate connecting to Prayer City.',
    landmark: 'East Security Checkpoint',
    building_code: 'GATE-02',
    delivery_zone_id: 'zone_mtu_outer',
    zone_name: 'Zone D — Outer',
    popular_for_delivery: true,
    searchable: true,
    active: true
  },
  {
    id: 'loc_medical_centre',
    campus_id: 'campus_mtu_main',
    university_id: 'uni_mtu',
    name: 'University Health Services (Medical Centre)',
    type: 'medical',
    latitude: 6.7636,
    longitude: 3.3740,
    description: 'Campus Clinic, Pharmacy Reception and Emergency Response Foyer.',
    landmark: 'Near Staff Quarters Road',
    building_code: 'CLINIC-01',
    delivery_zone_id: 'zone_mtu_outer',
    zone_name: 'Zone D — Outer',
    popular_for_delivery: true,
    searchable: true,
    active: true
  },
  {
    id: 'loc_senate_building',
    campus_id: 'campus_mtu_main',
    university_id: 'uni_mtu',
    name: 'University Senate Building & VC Complex',
    type: 'admin',
    latitude: 6.7620,
    longitude: 3.3765,
    description: 'Principal Administrative Officers, Bursary, Academic Affairs & Registry Foyer.',
    landmark: 'Ceremonial Flag Plaza',
    building_code: 'SENATE-01',
    delivery_zone_id: 'zone_mtu_central',
    zone_name: 'Zone A — Central',
    popular_for_delivery: true,
    searchable: true,
    active: true
  },
  {
    id: 'loc_sports_complex',
    campus_id: 'campus_mtu_main',
    university_id: 'uni_mtu',
    name: 'University Sports Complex & Stadium Arena',
    type: 'sports',
    latitude: 6.7640,
    longitude: 3.3750,
    description: 'Football Field, Tartan Running Track, Basketball & Volleyball Courts.',
    landmark: 'North Sports Grounds',
    building_code: 'SPORTS-01',
    delivery_zone_id: 'zone_mtu_outer',
    zone_name: 'Zone D — Outer',
    popular_for_delivery: true,
    searchable: true,
    active: true
  }
];

/**
 * Calculates Haversine distance between two coordinates in Kilometers
 */
export function calculateDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Checks if a coordinate is within a campus boundary
 */
export function isWithinCampusBoundary(
  lat: number,
  lng: number,
  boundary: CampusBoundary = DEFAULT_MTU_BOUNDARY
): { isInside: boolean; distanceToCenterMeters: number } {
  const distKm = calculateDistanceKm(lat, lng, boundary.center_latitude, boundary.center_longitude);
  const distMeters = distKm * 1000;
  return {
    isInside: distMeters <= boundary.radius_meters,
    distanceToCenterMeters: Math.round(distMeters)
  };
}

/**
 * Finds the nearest known campus location
 */
export function findNearestCampusLocation(
  lat: number,
  lng: number,
  locations: CampusLocation[] = DEFAULT_MTU_CAMPUS_LOCATIONS
): { location: CampusLocation | null; distanceMeters: number } {
  if (!locations || locations.length === 0) return { location: null, distanceMeters: 0 };

  let nearest: CampusLocation | null = null;
  let minDistanceKm = Infinity;

  for (const loc of locations) {
    if (!loc.active) continue;
    const dist = calculateDistanceKm(lat, lng, loc.latitude, loc.longitude);
    if (dist < minDistanceKm) {
      minDistanceKm = dist;
      nearest = loc;
    }
  }

  return {
    location: nearest,
    distanceMeters: Math.round(minDistanceKm * 1000)
  };
}

/**
 * Detects the matching delivery zone for a coordinate
 */
export function detectDeliveryZone(
  lat: number,
  lng: number,
  zones: DeliveryZone[] = DEFAULT_MTU_DELIVERY_ZONES
): DeliveryZone {
  if (!zones || zones.length === 0) return DEFAULT_MTU_DELIVERY_ZONES[0];

  let bestZone = zones[0];
  let minDistanceKm = Infinity;

  for (const zone of zones) {
    if (!zone.active) continue;
    const dist = calculateDistanceKm(lat, lng, zone.center_lat, zone.center_lng);
    const radiusKm = zone.radius_meters / 1000;

    // Direct containment in zone circle
    if (dist <= radiusKm) {
      return zone;
    }

    if (dist < minDistanceKm) {
      minDistanceKm = dist;
      bestZone = zone;
    }
  }

  return bestZone;
}

/**
 * Initializes and syncs campus locations and delivery zones with Firestore
 */
export async function seedCampusLocationsIfEmpty(): Promise<void> {
  try {
    const locsSnap = await getDocs(collection(db, 'campus_locations'));
    if (locsSnap.empty) {
      console.log('Seeding initial MTU campus locations into Firestore...');
      const now = new Date().toISOString();
      for (const loc of DEFAULT_MTU_CAMPUS_LOCATIONS) {
        await setDoc(doc(db, 'campus_locations', loc.id), {
          ...loc,
          created_at: now,
          updated_at: now
        });
      }
    }

    const zonesSnap = await getDocs(collection(db, 'delivery_zones'));
    if (zonesSnap.empty) {
      console.log('Seeding initial MTU delivery zones into Firestore...');
      const now = new Date().toISOString();
      for (const zone of DEFAULT_MTU_DELIVERY_ZONES) {
        await setDoc(doc(db, 'delivery_zones', zone.id), {
          ...zone,
          created_at: now,
          updated_at: now
        });
      }
    }
  } catch (err) {
    console.warn('Campus locations seed fallback to local memory:', err);
  }
}

/**
 * Subscribes to real-time campus locations
 */
export function subscribeToCampusLocations(
  campusId: string,
  callback: (locations: CampusLocation[]) => void
): () => void {
  try {
    const q = query(collection(db, 'campus_locations'));
    return onSnapshot(
      q,
      (snapshot) => {
        if (!snapshot.empty) {
          const locs = snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as CampusLocation));
          callback(locs.filter((l) => !campusId || l.campus_id === campusId));
        } else {
          callback(DEFAULT_MTU_CAMPUS_LOCATIONS);
        }
      },
      (err) => {
        console.warn('Offline campus_locations subscription:', err);
        callback(DEFAULT_MTU_CAMPUS_LOCATIONS);
      }
    );
  } catch (e) {
    callback(DEFAULT_MTU_CAMPUS_LOCATIONS);
    return () => {};
  }
}

/**
 * Subscribes to real-time delivery zones
 */
export function subscribeToDeliveryZones(
  campusId: string,
  callback: (zones: DeliveryZone[]) => void
): () => void {
  try {
    const q = query(collection(db, 'delivery_zones'));
    return onSnapshot(
      q,
      (snapshot) => {
        if (!snapshot.empty) {
          const zones = snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as DeliveryZone));
          callback(zones.filter((z) => !campusId || z.campus_id === campusId));
        } else {
          callback(DEFAULT_MTU_DELIVERY_ZONES);
        }
      },
      (err) => {
        console.warn('Offline delivery_zones subscription:', err);
        callback(DEFAULT_MTU_DELIVERY_ZONES);
      }
    );
  } catch (e) {
    callback(DEFAULT_MTU_DELIVERY_ZONES);
    return () => {};
  }
}

/**
 * Admin CRUD operations for Campus Locations
 */
export async function saveCampusLocation(
  location: Partial<CampusLocation> & { name: string; latitude: number; longitude: number; type: CampusLocationType }
): Promise<{ success: boolean; id?: string; error?: string }> {
  try {
    const id = location.id || `loc_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const now = new Date().toISOString();
    const docData: CampusLocation = {
      id,
      campus_id: location.campus_id || 'campus_mtu_main',
      university_id: location.university_id || 'uni_mtu',
      name: location.name,
      type: location.type,
      latitude: location.latitude,
      longitude: location.longitude,
      description: location.description || '',
      landmark: location.landmark || '',
      building_code: location.building_code || '',
      delivery_zone_id: location.delivery_zone_id || 'zone_mtu_central',
      zone_name: location.zone_name || 'Zone A',
      popular_for_delivery: location.popular_for_delivery ?? true,
      searchable: location.searchable ?? true,
      active: location.active ?? true,
      created_at: location.created_at || now,
      updated_at: now
    };

    await setDoc(doc(db, 'campus_locations', id), docData);
    return { success: true, id };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to save campus location' };
  }
}

export async function deleteCampusLocation(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    await deleteDoc(doc(db, 'campus_locations', id));
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to delete campus location' };
  }
}

/**
 * Admin CRUD for Delivery Zones
 */
export async function saveDeliveryZone(
  zone: Partial<DeliveryZone> & { name: string; base_fee: number; per_km_fee: number; center_lat: number; center_lng: number }
): Promise<{ success: boolean; id?: string; error?: string }> {
  try {
    const id = zone.id || `zone_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const now = new Date().toISOString();
    const docData: DeliveryZone = {
      id,
      zone_id: zone.zone_id || zone.code || 'ZONE_CUSTOM',
      campus_id: zone.campus_id || 'campus_mtu_main',
      university_id: zone.university_id || 'uni_mtu',
      name: zone.name,
      code: zone.code || 'ZONE_CUSTOM',
      description: zone.description || '',
      color: zone.color || '#10B981',
      base_fee: Number(zone.base_fee) || 300,
      per_km_fee: Number(zone.per_km_fee) || 100,
      estimated_delivery_time: zone.estimated_delivery_time || '10-15 min',
      estimated_minutes: Number(zone.estimated_minutes) || 12,
      center_lat: Number(zone.center_lat),
      center_lng: Number(zone.center_lng),
      radius_meters: Number(zone.radius_meters) || 500,
      active: zone.active ?? true,
      created_at: zone.created_at || now,
      updated_at: now
    };

    await setDoc(doc(db, 'delivery_zones', id), docData);
    return { success: true, id };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to save delivery zone' };
  }
}

export async function deleteDeliveryZone(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    await deleteDoc(doc(db, 'delivery_zones', id));
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to delete delivery zone' };
  }
}

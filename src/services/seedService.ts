import { doc, getDoc, setDoc, deleteDoc, collection, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { University, Campus, FoodZone, Vendor, FoodCategory, MenuItem } from '../types';

export const FALLBACK_MTU_UNIVERSITY: University & { address?: string } = {
  id: 'uni_mtu',
  name: 'Mountain Top University',
  short_name: 'MTU',
  slug: 'mountain-top-university',
  state: 'Ogun',
  city: 'Ibafo / Prayer City',
  country: 'Nigeria',
  description: 'Mountain Top University is a private university located at Prayer City along the Lagos-Ibadan Expressway in Ogun State, Nigeria.',
  address: 'Kilometre 12, Lagos-Ibadan Expressway, Prayer City, Ogun State, Nigeria',
  logo_url: 'https://images.unsplash.com/photo-1541339907198-e08756dedf3f?auto=format&fit=crop&q=80&w=200',
  cover_image_url: 'https://images.unsplash.com/photo-1523050854058-8df90110c9f1?auto=format&fit=crop&q=80&w=1200',
  latitude: 6.7628,
  longitude: 3.3768,
  is_active: true,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

export const FALLBACK_MTU_CAMPUS: Campus = {
  id: 'campus_mtu_main',
  university_id: 'uni_mtu',
  name: 'Main Campus',
  slug: 'main-campus',
  description: 'Mountain Top University main campus at Prayer City, Ogun State.',
  address: 'Kilometre 12, Lagos-Ibadan Expressway, Prayer City, Ogun State, Nigeria',
  latitude: 6.7628,
  longitude: 3.3768,
  is_active: true,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

export const FALLBACK_MTU_CANTEEN: Vendor & {
  menu_status?: string;
  price_status?: string;
  verification_status?: string;
  image_source_type?: string;
  license?: string;
  source_credit?: string;
} = {
  id: 'vendor_mtu_canteen',
  university_id: 'uni_mtu',
  campus_id: 'campus_mtu_main',
  food_zone_id: '',
  name: 'MTU Students Canteen',
  slug: 'mtu-students-canteen',
  description: 'Students\' canteen at Mountain Top University.',
  vendor_type: 'cafeteria',
  logo_url: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&q=80&w=200',
  cover_image_url: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&q=80&w=800',
  address: 'Kilometre 12, Lagos-Ibadan Expressway, Prayer City, Ogun State, Nigeria',
  latitude: 6.7628,
  longitude: 3.3768,
  delivery_available: true,
  pickup_available: true,
  is_open: true,
  is_verified: true,
  is_active: true,
  opening_time: '07:00',
  closing_time: '20:00',
  review_count: 0,
  verification_status: 'verified_vendor_pending_menu',
  menu_status: 'awaiting_admin_menu',
  price_status: 'awaiting_admin_prices',
  image_source_type: 'external_reference',
  license: 'CC BY-SA 4.0',
  source_credit: 'Haykinz001 / Wikimedia Commons',
  created_at: new Date().toISOString(),
};

export const FALLBACK_MTU_CATEGORIES: FoodCategory[] = [
  { id: 'cat_breakfast', name: 'Breakfast', slug: 'breakfast', description: 'Breakfast foods available at MTU food facilities.', is_active: true, image_url: 'https://images.unsplash.com/photo-1533089860892-a7c6f0a88666?auto=format&fit=crop&q=80&w=300' },
  { id: 'cat_rice', name: 'Rice', slug: 'rice', description: 'Rice dishes', is_active: true, image_url: 'https://images.unsplash.com/photo-1512058564366-18510be2db19?auto=format&fit=crop&q=80&w=300' },
  { id: 'cat_pasta', name: 'Pasta', slug: 'pasta', description: 'Pasta meals', is_active: true, image_url: 'https://images.unsplash.com/photo-1551183053-bf91a1d81141?auto=format&fit=crop&q=80&w=300' },
  { id: 'cat_noodles', name: 'Noodles', slug: 'noodles', description: 'Noodle dishes', is_active: true, image_url: 'https://images.unsplash.com/photo-1612927601601-6638404737ce?auto=format&fit=crop&q=80&w=300' },
  { id: 'cat_beans', name: 'Beans', slug: 'beans', description: 'Beans meals', is_active: true, image_url: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&q=80&w=300' },
  { id: 'cat_yam', name: 'Yam', slug: 'yam', description: 'Boiled and fried yam options', is_active: true, image_url: 'https://images.unsplash.com/photo-1599490659213-e2b9527bd087?auto=format&fit=crop&q=80&w=300' },
  { id: 'cat_plantain', name: 'Plantain', slug: 'plantain', description: 'Fried and boiled plantains', is_active: true, image_url: 'https://images.unsplash.com/photo-1541592106381-b31e9677c0e5?auto=format&fit=crop&q=80&w=300' },
  { id: 'cat_swallow', name: 'Swallow', slug: 'swallow', description: 'Traditional swallows', is_active: true, image_url: 'https://images.unsplash.com/photo-1604329760661-e71dc83f8f26?auto=format&fit=crop&q=80&w=300' },
  { id: 'cat_soups', name: 'Soups', slug: 'soups', description: 'Authentic Nigerian soups', is_active: true, image_url: 'https://images.unsplash.com/photo-1547592166-23ac45744acd?auto=format&fit=crop&q=80&w=300' },
  { id: 'cat_chicken', name: 'Chicken', slug: 'chicken', description: 'Grilled and fried chicken options', is_active: true, image_url: 'https://images.unsplash.com/photo-1598515214211-89d3c73ae83b?auto=format&fit=crop&q=80&w=300' },
  { id: 'cat_beef', name: 'Beef', slug: 'beef', description: 'Beef options', is_active: true, image_url: 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&q=80&w=300' },
  { id: 'cat_fish', name: 'Fish', slug: 'fish', description: 'Fresh and fried fish options', is_active: true, image_url: 'https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?auto=format&fit=crop&q=80&w=300' },
  { id: 'cat_egg', name: 'Egg', slug: 'egg', description: 'Boiled and fried eggs', is_active: true, image_url: 'https://images.unsplash.com/photo-1525351484163-7529414344d8?auto=format&fit=crop&q=80&w=300' },
  { id: 'cat_snacks', name: 'Snacks', slug: 'snacks', description: 'Pastries and light snacks', is_active: true, image_url: 'https://images.unsplash.com/photo-1599490659213-e2b9527bd087?auto=format&fit=crop&q=80&w=300' },
  { id: 'cat_fast_food', name: 'Fast Food', slug: 'fast-food', description: 'Quick bites and fast food', is_active: true, image_url: 'https://images.unsplash.com/photo-1561758033-d89a9ad46330?auto=format&fit=crop&q=80&w=300' },
  { id: 'cat_drinks', name: 'Drinks', slug: 'drinks', description: 'Beverages and refreshments', is_active: true, image_url: 'https://images.unsplash.com/photo-1551024709-8f23befc6f87?auto=format&fit=crop&q=80&w=300' },
  { id: 'cat_fruits', name: 'Fruits', slug: 'fruits', description: 'Fresh fruit options', is_active: true, image_url: 'https://images.unsplash.com/photo-1619566636858-adf3ef46400b?auto=format&fit=crop&q=80&w=300' },
  { id: 'cat_desserts', name: 'Desserts', slug: 'desserts', description: 'Sweet treats and desserts', is_active: true, image_url: 'https://images.unsplash.com/photo-1551024601-bec78aea704b?auto=format&fit=crop&q=80&w=300' },
  { id: 'cat_coffee', name: 'Coffee', slug: 'coffee', description: 'Brewed coffee options', is_active: true, image_url: 'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?auto=format&fit=crop&q=80&w=300' },
  { id: 'cat_tea', name: 'Tea', slug: 'tea', description: 'Hot and cold tea drinks', is_active: true, image_url: 'https://images.unsplash.com/photo-1576092768241-dec231879fc3?auto=format&fit=crop&q=80&w=300' },
];

async function withTimeout<T>(promise: Promise<T>, ms = 3500): Promise<T> {
  let timer: any;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error('Firestore operation timeout')), ms);
  });
  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    clearTimeout(timer);
  }
}

export async function initializeDatabaseSeed() {
  try {
    // 1. Check if MTU seed already exists (with 3.5s timeout for offline resilience)
    const mtuDoc = await withTimeout(getDoc(doc(db, 'universities', 'uni_mtu')));
    
    // Purge UNILAG if still present in Firestore
    try {
      const unilagDoc = await withTimeout(getDoc(doc(db, 'universities', 'uni_unilag')), 1500);
      if (unilagDoc.exists()) {
        console.log('Purging legacy UNILAG seed data from Firestore...');
        await deleteDoc(doc(db, 'universities', 'uni_unilag')).catch(() => {});
        await deleteDoc(doc(db, 'campuses', 'campus_akoka')).catch(() => {});
        
        const unilagZones = ['zone_new_hall', 'zone_jaja', 'zone_amphi', 'zone_cits'];
        for (const z of unilagZones) {
          await deleteDoc(doc(db, 'food_zones', z)).catch(() => {});
        }

        const unilagVendors = [
          'vendor_2001_cafeteria', 'vendor_mavise', 'vendor_iya_moria', 'vendor_korede',
          'vendor_salado', 'vendor_ays_pizza', 'vendor_tek_kitchen', 'vendor_cafe_one',
          'vendor_seun_yam', 'vendor_ewa_cits', 'vendor_icecream_jaja', 'vendor_milky_popcorn',
          'vendor_shop_10', 'vendor_ewa_palace'
        ];
        for (const v of unilagVendors) {
          await deleteDoc(doc(db, 'vendors', v)).catch(() => {});
          await deleteDoc(doc(db, 'restaurants', v)).catch(() => {});
        }

        const unilagDishes = [
          'dish_mavise_amala', 'dish_mavise_pounded_yam', 'dish_iya_amala', 'dish_iya_indomie',
          'dish_korede_spag', 'dish_korede_suya_rice', 'dish_korede_fried_rice', 'dish_korede_jollof',
          'dish_korede_yam_chips', 'dish_korede_potato_chips', 'dish_korede_white_rice', 'dish_tek_bread_beans'
        ];
        for (const d of unilagDishes) {
          await deleteDoc(doc(db, 'menu_items', d)).catch(() => {});
        }
      }
    } catch {
      // Ignore UNILAG purge check if offline or timed out
    }

    if (mtuDoc.exists()) {
      console.log('Mountain Top University (MTU) seed data already present in Firestore.');
      return;
    }

    console.log('Initializing Mountain Top University (MTU) seed data in Firestore...');

    // 2. University: Mountain Top University
    await setDoc(doc(db, 'universities', FALLBACK_MTU_UNIVERSITY.id), FALLBACK_MTU_UNIVERSITY);

    // 3. Campus: Main Campus
    await setDoc(doc(db, 'campuses', FALLBACK_MTU_CAMPUS.id), FALLBACK_MTU_CAMPUS);

    // 4. Primary Food Facility: MTU Students Canteen
    await setDoc(doc(db, 'vendors', FALLBACK_MTU_CANTEEN.id), FALLBACK_MTU_CANTEEN);
    await setDoc(doc(db, 'restaurants', FALLBACK_MTU_CANTEEN.id), {
      id: FALLBACK_MTU_CANTEEN.id,
      name: FALLBACK_MTU_CANTEEN.name,
      description: FALLBACK_MTU_CANTEEN.description || '',
      logo_url: FALLBACK_MTU_CANTEEN.logo_url,
      cover_image_url: FALLBACK_MTU_CANTEEN.cover_image_url,
      review_count: 0,
      delivery_fee: 200,
      estimated_delivery_time: '10-20 min',
      minimum_order: 500,
      address: FALLBACK_MTU_CANTEEN.address,
      latitude: FALLBACK_MTU_CANTEEN.latitude,
      longitude: FALLBACK_MTU_CANTEEN.longitude,
      is_open: true,
      created_at: FALLBACK_MTU_CANTEEN.created_at
    });

    // 5. Food Categories for MTU
    for (const c of FALLBACK_MTU_CATEGORIES) {
      await setDoc(doc(db, 'food_categories', c.id), c);
      await setDoc(doc(db, 'categories', c.id), c);
    }

    console.log('Mountain Top University (MTU) baseline seed data successfully initialized.');
  } catch (error: any) {
    console.info('Firestore offline or connecting: using MTU offline local fallback data.');
  }
}



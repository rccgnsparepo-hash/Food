import { create } from 'zustand';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { University, Campus, FoodZone, Vendor, FoodCategory, MenuItem, FoodReview } from '../types';
import {
  initializeDatabaseSeed,
  FALLBACK_MTU_UNIVERSITY,
  FALLBACK_MTU_CAMPUS,
  FALLBACK_MTU_CANTEEN,
  FALLBACK_MTU_CATEGORIES,
} from '../services/seedService';

interface MarketplaceState {
  universities: University[];
  campuses: Campus[];
  foodZones: FoodZone[];
  vendors: Vendor[];
  categories: FoodCategory[];
  menuItems: MenuItem[];
  reviews: FoodReview[];

  selectedUniversityId: string;
  selectedCampusId: string;
  selectedZoneId: string; // 'all' or zone_id
  searchQuery: string;
  selectedCategoryId: string; // 'all' or category_id
  activeFilter: 'all' | 'open_now' | 'cheap_eats' | 'popular' | 'top_rated' | 'student_friendly' | 'fast_delivery' | 'unverified_pending';
  maxDistanceKm: number; // e.g. 0.5, 1, 2, 5, 0 (0 means all)

  isLoading: boolean;
  isInitialized: boolean;

  // Actions
  initMarketplace: () => Promise<void>;
  setSelectedUniversityId: (id: string) => void;
  setSelectedCampusId: (id: string) => void;
  setSelectedZoneId: (id: string) => void;
  setSearchQuery: (query: string) => void;
  setSelectedCategoryId: (id: string) => void;
  setActiveFilter: (filter: MarketplaceState['activeFilter']) => void;
  setMaxDistanceKm: (km: number) => void;
}

export const useMarketplaceStore = create<MarketplaceState>((set, get) => ({
  universities: [],
  campuses: [],
  foodZones: [],
  vendors: [],
  categories: [],
  menuItems: [],
  reviews: [],

  selectedUniversityId: 'uni_mtu',
  selectedCampusId: 'campus_mtu_main',
  selectedZoneId: 'all',
  searchQuery: '',
  selectedCategoryId: 'all',
  activeFilter: 'all',
  maxDistanceKm: 0,

  isLoading: true,
  isInitialized: false,

  initMarketplace: async () => {
    if (get().isInitialized) return;

    // Initialize seed with non-blocking resilience
    try {
      await initializeDatabaseSeed();
    } catch (e) {
      console.warn('Seed initialization deferred:', e);
    }

    // Set immediate default local fallback state so UI is never blank or blocked
    set({
      universities: [FALLBACK_MTU_UNIVERSITY],
      campuses: [FALLBACK_MTU_CAMPUS],
      vendors: [FALLBACK_MTU_CANTEEN],
      categories: FALLBACK_MTU_CATEGORIES,
      isLoading: false,
    });

    // 1. Subscribe to Universities
    onSnapshot(collection(db, 'universities'), (snapshot) => {
      const unis = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as University));
      if (unis.length > 0) set({ universities: unis });
    }, (err) => console.warn('Offline listening to universities:', err));

    // 2. Subscribe to Campuses
    onSnapshot(collection(db, 'campuses'), (snapshot) => {
      const camps = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Campus));
      if (camps.length > 0) set({ campuses: camps });
    }, (err) => console.warn('Offline listening to campuses:', err));

    // 3. Subscribe to Food Zones
    onSnapshot(collection(db, 'food_zones'), (snapshot) => {
      const zones = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as FoodZone));
      set({ foodZones: zones });
    }, (err) => console.warn('Offline listening to food_zones:', err));

    // 4. Subscribe to Vendors
    onSnapshot(collection(db, 'vendors'), (snapshot) => {
      const vends = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Vendor));
      if (vends.length > 0) set({ vendors: vends, isLoading: false });
      else set({ isLoading: false });
    }, (err) => {
      console.warn('Offline listening to vendors:', err);
      set({ isLoading: false });
    });

    // 5. Subscribe to Food Categories
    onSnapshot(collection(db, 'food_categories'), (snapshot) => {
      const cats = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as FoodCategory));
      if (cats.length > 0) set({ categories: cats });
    }, (err) => console.warn('Offline listening to food_categories:', err));

    // 6. Subscribe to Menu Items
    onSnapshot(collection(db, 'menu_items'), (snapshot) => {
      const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as MenuItem));
      set({ menuItems: items });
    }, (err) => console.warn('Offline listening to menu_items:', err));

    // 7. Subscribe to Reviews
    onSnapshot(collection(db, 'food_reviews'), (snapshot) => {
      const revs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as FoodReview));
      set({ reviews: revs });
    }, (err) => console.warn('Offline listening to food_reviews:', err));

    set({ isInitialized: true });
  },

  setSelectedUniversityId: (id: string) => {
    // Auto reset campus to the first campus of this university if available
    const camps = get().campuses.filter(c => c.university_id === id);
    const defaultCampusId = camps.length > 0 ? camps[0].id : '';
    set({ selectedUniversityId: id, selectedCampusId: defaultCampusId, selectedZoneId: 'all' });
  },

  setSelectedCampusId: (id: string) => {
    set({ selectedCampusId: id, selectedZoneId: 'all' });
  },

  setSelectedZoneId: (id: string) => {
    set({ selectedZoneId: id });
  },

  setSearchQuery: (query: string) => {
    set({ searchQuery: query });
  },

  setSelectedCategoryId: (id: string) => {
    set({ selectedCategoryId: id });
  },

  setActiveFilter: (filter) => {
    set({ activeFilter: filter });
  },

  setMaxDistanceKm: (km) => {
    set({ maxDistanceKm: km });
  }
}));

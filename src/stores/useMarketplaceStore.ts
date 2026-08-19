import { create } from 'zustand';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { University, Campus, FoodZone, Vendor, FoodCategory, MenuItem, FoodReview } from '../types';
import {
  initializeDatabaseSeed,
  FALLBACK_MTU_UNIVERSITY,
  FALLBACK_MTU_CAMPUS,
  FALLBACK_MTU_VENDORS,
  FALLBACK_MTU_CATEGORIES,
  FALLBACK_MTU_MENU_ITEMS,
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

  // Optimistic mutations
  addUniversity: (uni: University) => void;
  updateUniversity: (id: string, updates: Partial<University>) => void;
  deleteUniversity: (id: string) => void;
  addCampus: (campus: Campus) => void;
  deleteCampus: (id: string) => void;
  addFoodZone: (zone: FoodZone) => void;
  updateFoodZone: (id: string, updates: Partial<FoodZone>) => void;
  deleteFoodZone: (id: string) => void;
  addVendor: (vendor: Vendor) => void;
  updateVendor: (id: string, updates: Partial<Vendor>) => void;
  deleteVendor: (id: string) => void;
  addMenuItem: (item: MenuItem) => void;
  updateMenuItem: (id: string, updates: Partial<MenuItem>) => void;
  deleteMenuItem: (id: string) => void;
  bulkAddRecords: (records: {
    universities?: University[];
    campuses?: Campus[];
    foodZones?: FoodZone[];
    vendors?: Vendor[];
    menuItems?: MenuItem[];
  }) => void;
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
      vendors: FALLBACK_MTU_VENDORS,
      categories: FALLBACK_MTU_CATEGORIES,
      menuItems: FALLBACK_MTU_MENU_ITEMS,
      isLoading: false,
    });

    // 1. Subscribe to Universities
    onSnapshot(collection(db, 'universities'), (snapshot) => {
      const unis = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as University));
      if (unis.length > 0) {
        set({ universities: unis });
      }
    }, (err) => console.warn('Offline listening to universities:', err));

    // 2. Subscribe to Campuses
    onSnapshot(collection(db, 'campuses'), (snapshot) => {
      const camps = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Campus));
      if (camps.length > 0) {
        set({ campuses: camps });
      }
    }, (err) => console.warn('Offline listening to campuses:', err));

    // 3. Subscribe to Food Zones
    onSnapshot(collection(db, 'food_zones'), (snapshot) => {
      const zones = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as FoodZone));
      set({ foodZones: zones });
    }, (err) => console.warn('Offline listening to food_zones:', err));

    // 4. Subscribe to Vendors
    onSnapshot(collection(db, 'vendors'), (snapshot) => {
      const vends = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Vendor));
      if (vends.length > 0) {
        // Merge with fallback vendors if any are missing
        const existingIds = new Set(vends.map(v => v.id));
        const combined = [...vends];
        for (const fb of FALLBACK_MTU_VENDORS) {
          if (!existingIds.has(fb.id)) {
            combined.push(fb);
          }
        }
        set({ vendors: combined, isLoading: false });
      } else {
        set({ vendors: FALLBACK_MTU_VENDORS, isLoading: false });
      }
    }, (err) => {
      console.warn('Offline listening to vendors:', err);
      set({ isLoading: false });
    });

    // 5. Subscribe to Food Categories
    onSnapshot(collection(db, 'food_categories'), (snapshot) => {
      const cats = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as FoodCategory));
      if (cats.length > 0) {
        set({ categories: cats });
      } else {
        set({ categories: FALLBACK_MTU_CATEGORIES });
      }
    }, (err) => console.warn('Offline listening to food_categories:', err));

    // 6. Subscribe to Menu Items
    onSnapshot(collection(db, 'menu_items'), (snapshot) => {
      const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as MenuItem));
      if (items.length > 0) {
        // Merge with fallback items so seeded items remain available
        const existingIds = new Set(items.map(i => i.id));
        const combined = [...items];
        for (const fb of FALLBACK_MTU_MENU_ITEMS) {
          if (!existingIds.has(fb.id)) {
            combined.push(fb);
          }
        }
        set({ menuItems: combined });
      } else {
        set({ menuItems: FALLBACK_MTU_MENU_ITEMS });
      }
    }, (err) => console.warn('Offline listening to menu_items:', err));

    // 7. Subscribe to Reviews
    onSnapshot(collection(db, 'food_reviews'), (snapshot) => {
      const revs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as FoodReview));
      set({ reviews: revs });
    }, (err) => console.warn('Offline listening to food_reviews:', err));

    set({ isInitialized: true });
  },

  addUniversity: (uni: University) => {
    set(state => {
      const existingIdx = state.universities.findIndex(u => u.id === uni.id);
      const newUnis = existingIdx >= 0
        ? state.universities.map(u => u.id === uni.id ? uni : u)
        : [...state.universities, uni];
      return { universities: newUnis, selectedUniversityId: uni.id };
    });
  },

  updateUniversity: (id: string, updates: Partial<University>) => {
    set(state => ({
      universities: state.universities.map(u => u.id === id ? { ...u, ...updates } : u)
    }));
  },

  deleteUniversity: (id: string) => {
    set(state => {
      const newUnis = state.universities.filter(u => u.id !== id);
      const nextSelected = state.selectedUniversityId === id
        ? (newUnis[0]?.id || '')
        : state.selectedUniversityId;
      return {
        universities: newUnis,
        selectedUniversityId: nextSelected,
        campuses: state.campuses.filter(c => c.university_id !== id)
      };
    });
  },

  addCampus: (campus: Campus) => {
    set(state => {
      const existingIdx = state.campuses.findIndex(c => c.id === campus.id);
      const newCampuses = existingIdx >= 0
        ? state.campuses.map(c => c.id === campus.id ? campus : c)
        : [...state.campuses, campus];
      return {
        campuses: newCampuses,
        selectedCampusId: campus.id
      };
    });
  },

  deleteCampus: (id: string) => {
    set(state => ({
      campuses: state.campuses.filter(c => c.id !== id)
    }));
  },

  addFoodZone: (zone: FoodZone) => {
    set(state => {
      const idx = state.foodZones.findIndex(z => z.id === zone.id);
      const newZones = idx >= 0
        ? state.foodZones.map(z => z.id === zone.id ? zone : z)
        : [...state.foodZones, zone];
      return { foodZones: newZones };
    });
  },

  updateFoodZone: (id: string, updates: Partial<FoodZone>) => {
    set(state => ({
      foodZones: state.foodZones.map(z => z.id === id ? { ...z, ...updates } : z)
    }));
  },

  deleteFoodZone: (id: string) => {
    set(state => ({
      foodZones: state.foodZones.filter(z => z.id !== id)
    }));
  },

  addVendor: (vendor: Vendor) => {
    set(state => {
      const idx = state.vendors.findIndex(v => v.id === vendor.id);
      const newVendors = idx >= 0
        ? state.vendors.map(v => v.id === vendor.id ? vendor : v)
        : [...state.vendors, vendor];
      return { vendors: newVendors };
    });
  },

  updateVendor: (id: string, updates: Partial<Vendor>) => {
    set(state => ({
      vendors: state.vendors.map(v => v.id === id ? { ...v, ...updates } : v)
    }));
  },

  deleteVendor: (id: string) => {
    set(state => ({
      vendors: state.vendors.filter(v => v.id !== id),
      menuItems: state.menuItems.filter(m => m.vendor_id !== id && m.restaurant_id !== id)
    }));
  },

  addMenuItem: (item: MenuItem) => {
    set(state => {
      const idx = state.menuItems.findIndex(m => m.id === item.id);
      const newItems = idx >= 0
        ? state.menuItems.map(m => m.id === item.id ? item : m)
        : [...state.menuItems, item];
      return { menuItems: newItems };
    });
  },

  updateMenuItem: (id: string, updates: Partial<MenuItem>) => {
    set(state => ({
      menuItems: state.menuItems.map(m => m.id === id ? { ...m, ...updates } : m)
    }));
  },

  deleteMenuItem: (id: string) => {
    set(state => ({
      menuItems: state.menuItems.filter(m => m.id !== id)
    }));
  },

  bulkAddRecords: (records) => {
    set(state => {
      let universities = [...state.universities];
      let campuses = [...state.campuses];
      let foodZones = [...state.foodZones];
      let vendors = [...state.vendors];
      let menuItems = [...state.menuItems];

      if (records.universities) {
        for (const u of records.universities) {
          const idx = universities.findIndex(x => x.id === u.id);
          if (idx >= 0) universities[idx] = u;
          else universities.push(u);
        }
      }
      if (records.campuses) {
        for (const c of records.campuses) {
          const idx = campuses.findIndex(x => x.id === c.id);
          if (idx >= 0) campuses[idx] = c;
          else campuses.push(c);
        }
      }
      if (records.foodZones) {
        for (const z of records.foodZones) {
          const idx = foodZones.findIndex(x => x.id === z.id);
          if (idx >= 0) foodZones[idx] = z;
          else foodZones.push(z);
        }
      }
      if (records.vendors) {
        for (const v of records.vendors) {
          const idx = vendors.findIndex(x => x.id === v.id);
          if (idx >= 0) vendors[idx] = v;
          else vendors.push(v);
        }
      }
      if (records.menuItems) {
        for (const m of records.menuItems) {
          const idx = menuItems.findIndex(x => x.id === m.id);
          if (idx >= 0) menuItems[idx] = m;
          else menuItems.push(m);
        }
      }

      return {
        universities,
        campuses,
        foodZones,
        vendors,
        menuItems
      };
    });
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

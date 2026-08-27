import { create } from 'zustand';
import { collection, onSnapshot, doc, setDoc, updateDoc, deleteDoc, cleanFirestoreData } from "../lib/embeddedDb";
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
  selectedZoneId: string;
  searchQuery: string;
  selectedCategoryId: string;
  activeFilter: 'all' | 'open_now' | 'cheap_eats' | 'popular' | 'top_rated' | 'student_friendly' | 'fast_delivery' | 'unverified_pending';
  maxDistanceKm: number;

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

  // Direct Firestore Mutations
  addUniversity: (uni: University) => Promise<void>;
  updateUniversity: (id: string, updates: Partial<University>) => Promise<void>;
  deleteUniversity: (id: string) => Promise<void>;
  addCampus: (campus: Campus) => Promise<void>;
  deleteCampus: (id: string) => Promise<void>;
  addFoodZone: (zone: FoodZone) => Promise<void>;
  updateFoodZone: (id: string, updates: Partial<FoodZone>) => Promise<void>;
  deleteFoodZone: (id: string) => Promise<void>;
  addVendor: (vendor: Vendor) => Promise<void>;
  updateVendor: (id: string, updates: Partial<Vendor>) => Promise<void>;
  deleteVendor: (id: string) => Promise<void>;
  addMenuItem: (item: MenuItem) => Promise<void>;
  updateMenuItem: (id: string, updates: Partial<MenuItem>) => Promise<void>;
  deleteMenuItem: (id: string) => Promise<void>;
  bulkAddRecords: (records: {
    universities?: University[];
    campuses?: Campus[];
    foodZones?: FoodZone[];
    vendors?: Vendor[];
    menuItems?: MenuItem[];
  }) => Promise<void>;
}

export const useMarketplaceStore = create<MarketplaceState>((set, get) => ({
  universities: [FALLBACK_MTU_UNIVERSITY],
  campuses: [FALLBACK_MTU_CAMPUS],
  foodZones: [],
  vendors: FALLBACK_MTU_VENDORS,
  categories: FALLBACK_MTU_CATEGORIES,
  menuItems: FALLBACK_MTU_MENU_ITEMS,
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

    try {
      initializeDatabaseSeed().catch((e) => {
        console.warn('[Seed initialization notice]:', e);
      });
    } catch (e) {
      console.warn('Seed initialization deferred:', e);
    }

    // 1. Subscribe to Universities in central Firestore
    onSnapshot(collection(db, 'universities'), (snapshot) => {
      const unis = snapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() } as University));
      if (unis.length > 0) {
        set({ universities: unis });
      }
    }, (err) => console.warn('[Firestore universities listener notice]:', err));

    // 2. Subscribe to Campuses in central Firestore
    onSnapshot(collection(db, 'campuses'), (snapshot) => {
      const camps = snapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() } as Campus));
      if (camps.length > 0) {
        set({ campuses: camps });
      }
    }, (err) => console.warn('[Firestore campuses listener notice]:', err));

    // 3. Subscribe to Food Zones in central Firestore
    onSnapshot(collection(db, 'food_zones'), (snapshot) => {
      const zones = snapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() } as FoodZone));
      set({ foodZones: zones });
    }, (err) => console.warn('[Firestore food_zones listener notice]:', err));

    // 4. Subscribe to Vendors in central Firestore
    onSnapshot(collection(db, 'vendors'), (snapshot) => {
      const vends = snapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() } as Vendor));
      if (vends.length > 0) {
        set({ vendors: vends, isLoading: false });
      } else {
        set({ vendors: FALLBACK_MTU_VENDORS, isLoading: false });
      }
    }, (err) => {
      console.warn('[Firestore vendors listener notice]:', err);
      set({ isLoading: false });
    });

    // 5. Subscribe to Food Categories in central Firestore
    onSnapshot(collection(db, 'food_categories'), (snapshot) => {
      const cats = snapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() } as FoodCategory));
      if (cats.length > 0) {
        set({ categories: cats });
      } else {
        set({ categories: FALLBACK_MTU_CATEGORIES });
      }
    }, (err) => console.warn('[Firestore food_categories listener notice]:', err));

    // 6. Subscribe to Menu Items in central Firestore
    onSnapshot(collection(db, 'menu_items'), (snapshot) => {
      const items = snapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() } as MenuItem));
      if (items.length > 0) {
        set({ menuItems: items });
      } else {
        set({ menuItems: FALLBACK_MTU_MENU_ITEMS });
      }
    }, (err) => console.warn('[Firestore menu_items listener notice]:', err));

    // 7. Subscribe to Reviews in central Firestore
    onSnapshot(collection(db, 'food_reviews'), (snapshot) => {
      const revs = snapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() } as FoodReview));
      set({ reviews: revs });
    }, (err) => console.warn('[Firestore food_reviews listener notice]:', err));

    set({ isInitialized: true, isLoading: false });
  },

  addUniversity: async (uni: University) => {
    set(state => {
      const existingIdx = state.universities.findIndex(u => u.id === uni.id);
      const newUnis = existingIdx >= 0
        ? state.universities.map(u => u.id === uni.id ? uni : u)
        : [...state.universities, uni];
      return { universities: newUnis, selectedUniversityId: uni.id };
    });
    try {
      await setDoc(doc(db, 'universities', uni.id), cleanFirestoreData(uni));
    } catch (e) {
      console.warn('[Firestore addUniversity notice]:', e);
    }
  },

  updateUniversity: async (id: string, updates: Partial<University>) => {
    set(state => ({
      universities: state.universities.map(u => u.id === id ? { ...u, ...updates } : u)
    }));
    try {
      await updateDoc(doc(db, 'universities', id), cleanFirestoreData(updates));
    } catch (e) {
      console.warn('[Firestore updateUniversity notice]:', e);
    }
  },

  deleteUniversity: async (id: string) => {
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
    try {
      await deleteDoc(doc(db, 'universities', id));
    } catch (e) {
      console.warn('[Firestore deleteUniversity notice]:', e);
    }
  },

  addCampus: async (campus: Campus) => {
    set(state => {
      const existingIdx = state.campuses.findIndex(c => c.id === campus.id);
      const newCampuses = existingIdx >= 0
        ? state.campuses.map(c => c.id === campus.id ? campus : c)
        : [...state.campuses, campus];
      return { campuses: newCampuses, selectedCampusId: campus.id };
    });
    try {
      await setDoc(doc(db, 'campuses', campus.id), cleanFirestoreData(campus));
    } catch (e) {
      console.warn('[Firestore addCampus notice]:', e);
    }
  },

  deleteCampus: async (id: string) => {
    set(state => ({
      campuses: state.campuses.filter(c => c.id !== id)
    }));
    try {
      await deleteDoc(doc(db, 'campuses', id));
    } catch (e) {
      console.warn('[Firestore deleteCampus notice]:', e);
    }
  },

  addFoodZone: async (zone: FoodZone) => {
    set(state => {
      const idx = state.foodZones.findIndex(z => z.id === zone.id);
      const newZones = idx >= 0
        ? state.foodZones.map(z => z.id === zone.id ? zone : z)
        : [...state.foodZones, zone];
      return { foodZones: newZones };
    });
    try {
      await setDoc(doc(db, 'food_zones', zone.id), cleanFirestoreData(zone));
    } catch (e) {
      console.warn('[Firestore addFoodZone notice]:', e);
    }
  },

  updateFoodZone: async (id: string, updates: Partial<FoodZone>) => {
    set(state => ({
      foodZones: state.foodZones.map(z => z.id === id ? { ...z, ...updates } : z)
    }));
    try {
      await updateDoc(doc(db, 'food_zones', id), cleanFirestoreData(updates));
    } catch (e) {
      console.warn('[Firestore updateFoodZone notice]:', e);
    }
  },

  deleteFoodZone: async (id: string) => {
    set(state => ({
      foodZones: state.foodZones.filter(z => z.id !== id)
    }));
    try {
      await deleteDoc(doc(db, 'food_zones', id));
    } catch (e) {
      console.warn('[Firestore deleteFoodZone notice]:', e);
    }
  },

  addVendor: async (vendor: Vendor) => {
    set(state => {
      const idx = state.vendors.findIndex(v => v.id === vendor.id);
      const newVendors = idx >= 0
        ? state.vendors.map(v => v.id === vendor.id ? vendor : v)
        : [...state.vendors, vendor];
      return { vendors: newVendors };
    });
    try {
      await setDoc(doc(db, 'vendors', vendor.id), cleanFirestoreData(vendor));
    } catch (e) {
      console.warn('[Firestore addVendor notice]:', e);
    }
  },

  updateVendor: async (id: string, updates: Partial<Vendor>) => {
    set(state => ({
      vendors: state.vendors.map(v => v.id === id ? { ...v, ...updates } : v)
    }));
    try {
      await updateDoc(doc(db, 'vendors', id), cleanFirestoreData(updates));
    } catch (e) {
      console.warn('[Firestore updateVendor notice]:', e);
    }
  },

  deleteVendor: async (id: string) => {
    set(state => ({
      vendors: state.vendors.filter(v => v.id !== id),
      menuItems: state.menuItems.filter(m => m.vendor_id !== id && m.restaurant_id !== id)
    }));
    try {
      await deleteDoc(doc(db, 'vendors', id));
    } catch (e) {
      console.warn('[Firestore deleteVendor notice]:', e);
    }
  },

  addMenuItem: async (item: MenuItem) => {
    set(state => {
      const idx = state.menuItems.findIndex(m => m.id === item.id);
      const newItems = idx >= 0
        ? state.menuItems.map(m => m.id === item.id ? item : m)
        : [...state.menuItems, item];
      return { menuItems: newItems };
    });
    try {
      await setDoc(doc(db, 'menu_items', item.id), cleanFirestoreData(item));
    } catch (e) {
      console.warn('[Firestore addMenuItem notice]:', e);
    }
  },

  updateMenuItem: async (id: string, updates: Partial<MenuItem>) => {
    set(state => ({
      menuItems: state.menuItems.map(m => m.id === id ? { ...m, ...updates } : m)
    }));
    try {
      await updateDoc(doc(db, 'menu_items', id), cleanFirestoreData(updates));
    } catch (e) {
      console.warn('[Firestore updateMenuItem notice]:', e);
    }
  },

  deleteMenuItem: async (id: string) => {
    set(state => ({
      menuItems: state.menuItems.filter(m => m.id !== id)
    }));
    try {
      await deleteDoc(doc(db, 'menu_items', id));
    } catch (e) {
      console.warn('[Firestore deleteMenuItem notice]:', e);
    }
  },

  bulkAddRecords: async (records) => {
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

    try {
      const promises: Promise<any>[] = [];
      if (records.universities) {
        for (const u of records.universities) {
          promises.push(setDoc(doc(db, 'universities', u.id), cleanFirestoreData(u)));
        }
      }
      if (records.campuses) {
        for (const c of records.campuses) {
          promises.push(setDoc(doc(db, 'campuses', c.id), cleanFirestoreData(c)));
        }
      }
      if (records.foodZones) {
        for (const z of records.foodZones) {
          promises.push(setDoc(doc(db, 'food_zones', z.id), cleanFirestoreData(z)));
        }
      }
      if (records.vendors) {
        for (const v of records.vendors) {
          promises.push(setDoc(doc(db, 'vendors', v.id), cleanFirestoreData(v)));
        }
      }
      if (records.menuItems) {
        for (const m of records.menuItems) {
          promises.push(setDoc(doc(db, 'menu_items', m.id), cleanFirestoreData(m)));
        }
      }
      await Promise.all(promises);
    } catch (e) {
      console.warn('[Firestore bulkAddRecords notice]:', e);
    }
  },

  setSelectedUniversityId: (id: string) => {
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

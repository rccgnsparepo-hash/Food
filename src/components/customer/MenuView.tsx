import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Search,
  Store,
  Clock,
  Star,
  Sparkles,
  ChevronRight,
  UtensilsCrossed,
  Layers,
  Filter,
} from 'lucide-react';
import { useMarketplaceStore } from '../../stores/useMarketplaceStore';
import { FoodCard } from './FoodCard';
import { MenuItem, Vendor } from '../../types';
import { pageVariants, staggerContainer, staggerItem } from '../../utils/motion';
import { triggerHaptic } from '../../utils/haptics';

interface MenuViewProps {
  onSelectFood: (item: MenuItem) => void;
  onSelectRestaurant?: (restaurant: Vendor) => void;
  initialVendorId?: string;
}

export const MenuView: React.FC<MenuViewProps> = ({
  onSelectFood,
  onSelectRestaurant,
  initialVendorId,
}) => {
  const {
    vendors,
    categories,
    menuItems,
    selectedCategoryId,
    setSelectedCategoryId,
    searchQuery,
    setSearchQuery,
    activeFilter,
    setActiveFilter,
    isLoading,
  } = useMarketplaceStore();

  const [selectedVendorFilter, setSelectedVendorFilter] = useState<string>(
    initialVendorId || 'all'
  );

  React.useEffect(() => {
    if (initialVendorId) {
      setSelectedVendorFilter(initialVendorId);
    }
  }, [initialVendorId]);

  // Combine all vendors from marketplace store and any found in menu items
  const allKnownVendors: Vendor[] = React.useMemo(() => {
    const map = new Map<string, Vendor>();
    vendors.forEach((v) => map.set(v.id, v));

    menuItems.forEach((item) => {
      const vId = item.vendor_id || item.restaurant_id;
      if (vId && !map.has(vId)) {
        map.set(vId, {
          id: vId,
          name: vId.startsWith('vendor_') ? vId.replace('vendor_', '').replace(/_/g, ' ').toUpperCase() : 'Campus Kitchen Stand',
          description: 'Verified campus kitchen provider',
          is_open: true,
          is_active: true,
          is_verified: true,
          rating: 4.8,
          opening_time: '07:30',
          closing_time: '21:00',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });
      }
    });

    return Array.from(map.values());
  }, [vendors, menuItems]);

  // Filtered menu items
  const filteredFood = menuItems.filter((item) => {
    // Vendor filter
    if (selectedVendorFilter !== 'all') {
      const matchVendor =
        item.vendor_id === selectedVendorFilter ||
        item.restaurant_id === selectedVendorFilter;
      if (!matchVendor) return false;
    }

    // Category filter
    if (selectedCategoryId !== 'all') {
      const itemCat = (item.category_id || '').toLowerCase();
      const selCat = selectedCategoryId.toLowerCase();
      const matchCategory =
        itemCat === selCat ||
        itemCat.replace(/^cat_/, '') === selCat.replace(/^cat_/, '');
      if (!matchCategory) return false;
    }

    // Quick filters
    if (
      activeFilter === 'cheap_eats' &&
      (item.base_price === null || item.base_price > 1200)
    ) {
      return false;
    }
    if (activeFilter === 'student_friendly' && !item.student_friendly) {
      return false;
    }

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = item.name.toLowerCase().includes(q);
      const matchDesc = item.description?.toLowerCase().includes(q);
      const matchVendor = allKnownVendors
        .find((v) => v.id === item.vendor_id || v.id === item.restaurant_id)
        ?.name.toLowerCase()
        .includes(q);
      return matchName || matchDesc || matchVendor;
    }

    return true;
  });

  // Group filtered food items by vendor / stand
  const vendorsWithDishes = allKnownVendors
    .filter((v) => {
      if (selectedVendorFilter !== 'all' && v.id !== selectedVendorFilter) {
        return false;
      }
      return true;
    })
    .map((vendor) => {
      const dishes = filteredFood.filter(
        (item) => item.vendor_id === vendor.id || item.restaurant_id === vendor.id
      );
      return {
        vendor,
        dishes,
      };
    })
    .filter((group) => group.dishes.length > 0 || (selectedVendorFilter !== 'all' && selectedVendorFilter === group.vendor.id));

  const activeVendorObj = allKnownVendors.find((v) => v.id === selectedVendorFilter);

  return (
    <motion.div
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      className="space-y-8 pb-24 max-w-7xl mx-auto"
    >
      {/* Header Banner */}
      <div className="bg-gradient-to-br from-slate-950 via-slate-900 to-rose-950 text-white rounded-3xl p-6 sm:p-8 relative overflow-hidden shadow-xl border border-rose-900/30">
        <div className="absolute top-0 right-0 w-96 h-96 bg-[#D6001C]/15 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 max-w-2xl space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md text-[11px] font-extrabold text-rose-300 border border-white/10 uppercase tracking-wider">
            <UtensilsCrossed className="w-3.5 h-3.5 text-[#D6001C]" />
            <span>Campus Food Directory</span>
          </div>
          <h1 className="text-2xl sm:text-4xl font-black tracking-tight text-white">
            Explore All Campus Meals & Kitchens
          </h1>
          <p className="text-xs sm:text-sm text-slate-300 font-medium leading-relaxed">
            Browse authentic Nigerian breakfasts, lunches, pastries, and grills freshly prepared
            across Mountain Top University food stands and cafeterias.
          </p>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <input
              type="text"
              id="menu-search-input"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search dishes (e.g. Jollof Rice, Amala, Shawarma, Zobo)..."
              className="w-full bg-white dark:bg-slate-900 border border-rose-100 dark:border-slate-800 rounded-2xl py-3.5 pl-11 pr-4 text-sm font-bold text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 shadow-xs focus:ring-2 focus:ring-[#D6001C] outline-none transition-all"
            />
            <Search className="w-5 h-5 text-slate-400 absolute left-4 top-3.5" />
          </div>

          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => {
              triggerHaptic(20);
              setSelectedCategoryId('all');
              setSelectedVendorFilter('all');
              setActiveFilter('all');
              setSearchQuery('');
            }}
            className="px-4 py-3.5 bg-slate-100 dark:bg-slate-800 hover:bg-rose-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 hover:text-[#D6001C] dark:hover:text-rose-400 rounded-2xl text-xs font-bold transition-colors cursor-pointer shrink-0 border border-slate-200 dark:border-slate-700"
          >
            Reset
          </motion.button>
        </div>

        {/* Quick Filter Badges */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar text-xs font-extrabold pb-1">
          {[
            { id: 'all', label: 'All Meals' },
            { id: 'cheap_eats', label: '🇳🇬 Under ₦1,200 (Student Deal)' },
            { id: 'student_friendly', label: '⚡ Quick Student Bites' },
          ].map((f) => (
            <motion.button
              key={f.id}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.96 }}
              onClick={() => {
                triggerHaptic(20);
                setActiveFilter(f.id as any);
              }}
              className={`px-4 py-2 rounded-xl transition-all cursor-pointer border shrink-0 ${
                activeFilter === f.id
                  ? 'bg-[#D6001C] text-white border-[#D6001C] shadow-xs'
                  : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800'
              }`}
            >
              {f.label}
            </motion.button>
          ))}
        </div>

        {/* Stand / Kitchen Selector Tabs with Animated Active Indicator */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
              <Store className="w-3.5 h-3.5 text-[#D6001C]" />
              Select Kitchen Stand:
            </span>
            {selectedVendorFilter !== 'all' && (
              <button
                onClick={() => {
                  triggerHaptic(20);
                  setSelectedVendorFilter('all');
                }}
                className="text-[11px] font-bold text-[#D6001C] dark:text-rose-400 hover:underline cursor-pointer"
              >
                Show All Stands
              </button>
            )}
          </div>
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-2">
            <button
              onClick={() => {
                triggerHaptic(30);
                setSelectedVendorFilter('all');
              }}
              className={`relative px-4 py-2 rounded-xl text-xs font-bold shrink-0 transition-all cursor-pointer ${
                selectedVendorFilter === 'all'
                  ? 'bg-slate-900 dark:bg-emerald-700 text-white shadow-sm'
                  : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800'
              }`}
            >
              All Kitchens ({allKnownVendors.length})
            </button>
            {allKnownVendors.map((vend) => {
              const isSelected = selectedVendorFilter === vend.id;
              const dishCount = menuItems.filter((i) => i.vendor_id === vend.id || i.restaurant_id === vend.id).length;
              return (
                <button
                  key={vend.id}
                  onClick={() => {
                    triggerHaptic(30);
                    setSelectedVendorFilter(vend.id);
                  }}
                  className={`relative px-4 py-2 rounded-xl text-xs font-bold shrink-0 transition-all cursor-pointer flex items-center gap-1.5 ${
                    isSelected
                      ? 'bg-slate-900 dark:bg-emerald-700 text-white shadow-sm'
                      : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                >
                  <span>{vend.name}</span>
                  <span className={`text-[10px] ${isSelected ? 'text-rose-300' : 'opacity-75'}`}>
                    ({dishCount})
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Food Categories Scrollable Pills */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.96 }}
            onClick={() => {
              triggerHaptic(20);
              setSelectedCategoryId('all');
            }}
            className={`px-4 py-2 rounded-full font-bold text-xs tracking-wide shrink-0 transition-colors cursor-pointer ${
              selectedCategoryId === 'all'
                ? 'bg-rose-100 dark:bg-rose-950/60 text-[#D6001C] dark:text-rose-400 border border-rose-300 dark:border-rose-800 font-black'
                : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-rose-50 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800'
            }`}
          >
            All Categories
          </motion.button>
          {categories.map((cat) => {
            const isSelected = selectedCategoryId === cat.id;
            return (
              <motion.button
                key={cat.id}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.96 }}
                onClick={() => {
                  triggerHaptic(20);
                  setSelectedCategoryId(cat.id);
                }}
                className={`px-4 py-2 rounded-full font-bold text-xs tracking-wide shrink-0 transition-colors cursor-pointer ${
                  isSelected
                    ? 'bg-rose-100 dark:bg-rose-950/60 text-[#D6001C] dark:text-rose-400 border border-rose-300 dark:border-rose-800 font-black'
                    : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-rose-50 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800'
                }`}
              >
                {cat.name}
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* Main Content: Meals Grouped Per Stand with Staggered Entrance Animation */}
      {isLoading ? (
        <div className="space-y-10 animate-pulse">
          {[1, 2].map((i) => (
            <div key={i} className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl p-5 sm:p-7 space-y-5 shadow-2xs">
              {/* Stand Header Skeleton */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-3.5">
                  <div className="w-14 h-14 rounded-2xl bg-slate-200/80 dark:bg-slate-800 shrink-0" />
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="w-40 h-5 bg-slate-200/80 dark:bg-slate-800 rounded" />
                      <div className="w-14 h-4 bg-slate-200/80 dark:bg-slate-800 rounded-full" />
                    </div>
                    <div className="w-56 h-3 bg-slate-200/60 dark:bg-slate-800/60 rounded" />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-20 h-7 bg-slate-200/80 dark:bg-slate-800 rounded-xl" />
                  <div className="w-28 h-7 bg-slate-200/80 dark:bg-slate-800 rounded-xl" />
                </div>
              </div>

              {/* Grid of Dishes Skeleton */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                {[1, 2, 3, 4].map((j) => (
                  <div key={j} className="bg-slate-50/80 dark:bg-slate-800/80 rounded-3xl p-3 border border-slate-100/90 dark:border-slate-700/80 space-y-3">
                    <div className="aspect-square bg-slate-200/80 dark:bg-slate-700 rounded-2xl w-full" />
                    <div className="space-y-1.5">
                      <div className="w-3/4 h-4 bg-slate-200/80 dark:bg-slate-700 rounded" />
                      <div className="w-1/2 h-3 bg-slate-200/60 dark:bg-slate-700/60 rounded" />
                    </div>
                    <div className="flex items-center justify-between pt-1">
                      <div className="w-16 h-5 bg-slate-200/80 dark:bg-slate-700 rounded-full" />
                      <div className="w-7 h-7 bg-slate-200/80 dark:bg-slate-700 rounded-full" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : vendorsWithDishes.length > 0 ? (
        <AnimatePresence mode="wait">
          <motion.div
            key={`menu-container-${selectedVendorFilter}-${selectedCategoryId}-${activeFilter}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="space-y-10"
          >
            {vendorsWithDishes.map(({ vendor, dishes }) => (
              <motion.section
                key={vendor.id}
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, ease: 'easeOut' }}
                className="bg-slate-50/70 dark:bg-slate-900/60 border border-rose-100/80 dark:border-slate-800 rounded-3xl p-5 sm:p-7 space-y-5 shadow-2xs"
              >
                {/* Stand / Kitchen Header Card */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-rose-100/70 dark:border-slate-800">
                  <div className="flex items-center gap-3.5">
                    <div className="w-12 h-12 rounded-2xl overflow-hidden bg-rose-100 dark:bg-slate-800 shrink-0 border border-rose-200 dark:border-slate-700 shadow-2xs">
                      <img
                        src={vendor.logo_url || vendor.cover_image_url || 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=100'}
                        alt={vendor.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="text-lg sm:text-xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
                          {vendor.name}
                        </h2>
                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-md uppercase ${
                          vendor.is_open ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-400' : 'bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-400'
                        }`}>
                          {vendor.is_open ? 'Open' : 'Closed'}
                        </span>
                      </div>
                      {vendor.slogan ? (
                        <p className="text-xs text-[#D6001C] dark:text-rose-400 font-semibold italic mt-0.5">
                          "{vendor.slogan}"
                        </p>
                      ) : (
                        <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                          {vendor.description || 'Authentic campus dishes'}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-3 text-xs text-slate-600 dark:text-slate-300">
                    <div className="flex items-center gap-1 bg-white dark:bg-slate-800 px-3 py-1.5 rounded-xl border border-rose-100 dark:border-slate-700 font-bold shadow-2xs">
                      <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                      <span>{vendor.rating ? vendor.rating.toFixed(1) : '4.8'}</span>
                    </div>
                    <div className="flex items-center gap-1 bg-white dark:bg-slate-800 px-3 py-1.5 rounded-xl border border-rose-100 dark:border-slate-700 font-bold shadow-2xs">
                      <Clock className="w-3.5 h-3.5 text-[#D6001C]" />
                      <span>{vendor.opening_time || '07:30'} - {vendor.closing_time || '21:00'}</span>
                    </div>
                  </div>
                </div>

                {/* Staggered Grid of Dishes for this Kitchen Stand with Fade-in and Scale-up effect */}
                {dishes.length > 0 ? (
                  <motion.div
                    variants={staggerContainer}
                    initial="hidden"
                    animate="show"
                    className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4"
                  >
                    {dishes.map((dish, index) => (
                      <motion.div
                        key={dish.id}
                        variants={staggerItem}
                        initial={{ opacity: 0, y: 16, scale: 0.93 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        transition={{
                          type: 'spring',
                          stiffness: 350,
                          damping: 24,
                          delay: index * 0.04,
                        }}
                      >
                        <FoodCard item={dish} onSelect={onSelectFood} />
                      </motion.div>
                    ))}
                  </motion.div>
                ) : (
                  <div className="text-center py-6 text-xs text-slate-400 dark:text-slate-500">
                    No matching dishes found in this stand for current filters.
                  </div>
                )}
              </motion.section>
            ))}
          </motion.div>
        </AnimatePresence>
      ) : (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white dark:bg-slate-900 rounded-3xl p-10 text-center border border-rose-100 dark:border-slate-800 shadow-xs space-y-3"
        >
          <Sparkles className="w-12 h-12 text-rose-300 dark:text-rose-500 mx-auto" />
          <h3 className="text-base font-black text-slate-900 dark:text-slate-100">No Meals Found</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
            We couldn't find any dishes matching your search query or filter combination.
          </p>
          <button
            onClick={() => {
              triggerHaptic(20);
              setSelectedCategoryId('all');
              setSelectedVendorFilter('all');
              setActiveFilter('all');
              setSearchQuery('');
            }}
            className="px-5 py-2.5 bg-[#D6001C] text-white rounded-full text-xs font-bold hover:bg-red-700 transition-colors cursor-pointer shadow-md shadow-red-500/20"
          >
            Clear All Filters
          </button>
        </motion.div>
      )}
    </motion.div>
  );
};

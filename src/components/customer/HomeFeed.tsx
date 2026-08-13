import React, { useEffect } from 'react';
import { motion } from 'motion/react';
import { Search, SlidersHorizontal, Sparkles, Star, Clock, ChevronRight, Store } from 'lucide-react';
import { useMarketplaceStore } from '../../stores/useMarketplaceStore';
import { UniversitySelector } from '../UniversitySelector';
import { FoodZoneSelector } from '../FoodZoneSelector';
import { FoodCard } from './FoodCard';
import { FoodCardSkeleton, Skeleton } from '../ui/Skeleton';
import { LazyImage } from '../ui/LazyImage';
import { MenuItem, Vendor } from '../../types';
import { pageVariants, staggerContainer, staggerItem } from '../../utils/motion';

interface HomeFeedProps {
  onSelectFood: (item: MenuItem) => void;
  onSelectRestaurant: (restaurant: Vendor) => void;
}

export const HomeFeed: React.FC<HomeFeedProps> = ({ onSelectFood, onSelectRestaurant }) => {
  const {
    vendors,
    categories,
    menuItems,
    foodZones,
    isLoading,
    initMarketplace,
    selectedUniversityId,
    selectedCampusId,
    selectedZoneId,
    selectedCategoryId,
    searchQuery,
    activeFilter,
    setSelectedCategoryId,
    setSearchQuery,
    setActiveFilter
  } = useMarketplaceStore();

  useEffect(() => {
    initMarketplace();
  }, [initMarketplace]);

  // Filter vendors
  const filteredVendors = vendors.filter(v => {
    if (v.university_id !== selectedUniversityId) return false;
    if (selectedCampusId && v.campus_id !== selectedCampusId) return false;
    if (selectedZoneId !== 'all' && v.food_zone_id !== selectedZoneId) return false;
    if (activeFilter === 'open_now' && !v.is_open) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        v.name.toLowerCase().includes(q) ||
        (v.description && v.description.toLowerCase().includes(q))
      );
    }
    return true;
  });

  // Filter menu items
  const filteredFood = menuItems.filter(item => {
    const vendor = vendors.find(v => v.id === item.vendor_id);
    if (!vendor || vendor.university_id !== selectedUniversityId) return false;
    if (selectedCampusId && vendor.campus_id !== selectedCampusId) return false;
    if (selectedZoneId !== 'all' && vendor.food_zone_id !== selectedZoneId) return false;

    if (selectedCategoryId !== 'all' && item.category_id !== selectedCategoryId) return false;

    if (activeFilter === 'cheap_eats' && (item.base_price === null || item.base_price > 1000)) return false;
    if (activeFilter === 'student_friendly' && !item.student_friendly) return false;

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        item.name.toLowerCase().includes(q) ||
        (item.description && item.description.toLowerCase().includes(q))
      );
    }

    return true;
  });

  return (
    <motion.div
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      className="space-y-6 pb-24"
    >
      
      {/* Top University & Campus Selector Bar */}
      <UniversitySelector />

      {/* Food Zone Pills */}
      <FoodZoneSelector />

      {/* Search Bar & Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search MTU dishes, canteens, vendors..."
            className="w-full bg-white border border-rose-100 rounded-full py-3.5 pl-11 pr-4 text-sm font-bold text-slate-800 placeholder-slate-400 shadow-xs focus:ring-2 focus:ring-[#D6001C] outline-none transition-all"
          />
          <Search className="w-5 h-5 text-slate-400 absolute left-4 top-3.5" />
        </div>

        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.92 }}
          className="w-12 h-12 bg-[#D6001C] text-white rounded-full flex items-center justify-center shadow-md shadow-red-500/30 hover:bg-red-700 transition-colors cursor-pointer shrink-0"
        >
          <SlidersHorizontal className="w-5 h-5" />
        </motion.button>
      </div>

      {/* Quick Filter Tags */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar text-xs font-extrabold pb-1">
        {[
          { id: 'all', label: 'All Deals' },
          { id: 'cheap_eats', label: '🇳🇬 Cheap Eats (Under ₦1,000)' },
          { id: 'open_now', label: '🟢 Open Now' },
        ].map((f) => (
          <motion.button
            key={f.id}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setActiveFilter(f.id as any)}
            className={`px-3.5 py-2 rounded-2xl transition-all cursor-pointer border ${
              activeFilter === f.id
                ? 'bg-slate-900 text-white border-slate-900 shadow-2xs'
                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
            }`}
          >
            {f.label}
          </motion.button>
        ))}
      </div>

      {/* Scrollable Category Pills */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-black text-slate-900 tracking-tight">Food Categories</h2>
        </div>

        {isLoading ? (
          <div className="flex items-center gap-2.5 overflow-x-auto no-scrollbar pb-2 pt-1">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Skeleton key={i} className="h-10 w-28 rounded-full shrink-0" />
            ))}
          </div>
        ) : (
          <div className="flex items-center gap-2.5 overflow-x-auto no-scrollbar pb-2 pt-1">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setSelectedCategoryId('all')}
              className={`px-5 py-2.5 rounded-full font-bold text-xs tracking-wide shrink-0 transition-colors cursor-pointer ${
                selectedCategoryId === 'all'
                  ? 'bg-[#D6001C] text-white shadow-md shadow-red-500/20'
                  : 'bg-white text-slate-700 hover:bg-rose-50 border border-rose-100/80 shadow-2xs'
              }`}
            >
              All Food
            </motion.button>
            {categories.map((cat) => {
              const isSelected = selectedCategoryId === cat.id;
              return (
                <motion.button
                  key={cat.id}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setSelectedCategoryId(cat.id)}
                  className={`px-5 py-2.5 rounded-full font-bold text-xs tracking-wide shrink-0 transition-colors cursor-pointer ${
                    isSelected
                      ? 'bg-[#D6001C] text-white shadow-md shadow-red-500/20'
                      : 'bg-white text-slate-700 hover:bg-rose-50 border border-rose-100/80 shadow-2xs'
                  }`}
                >
                  {cat.name}
                </motion.button>
              );
            })}
          </div>
        )}
      </div>

      {/* Popular Food Grid Section */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-black text-slate-900 tracking-tight">
            Campus Food & Dishes
          </h2>
          <button
            onClick={() => {
              setSelectedCategoryId('all');
              setActiveFilter('all');
              setSearchQuery('');
            }}
            className="text-xs font-bold text-[#D6001C] hover:underline cursor-pointer"
          >
            Reset Filters
          </button>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
              <FoodCardSkeleton key={i} />
            ))}
          </div>
        ) : filteredFood.length > 0 ? (
          <motion.div
            variants={staggerContainer}
            initial="hidden"
            animate="show"
            className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4"
          >
            {filteredFood.map((food) => (
              <motion.div key={food.id} variants={staggerItem}>
                <FoodCard item={food} onSelect={onSelectFood} />
              </motion.div>
            ))}
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-3xl p-8 text-center border border-rose-100 shadow-xs space-y-2"
          >
            <Sparkles className="w-10 h-10 text-rose-300 mx-auto mb-2" />
            <p className="text-sm font-bold text-slate-800">No verified meals available yet.</p>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Awaiting menu entry from MTU Students Canteen & campus vendors. You can add items using the Admin Dashboard.
            </p>
          </motion.div>
        )}
      </div>

      {/* Campus Vendors Section */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-black text-slate-900 tracking-tight">
            Campus Vendors & Cafeterias ({filteredVendors.length})
          </h2>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="bg-white rounded-3xl overflow-hidden border border-rose-100 shadow-xs space-y-2"
              >
                <Skeleton className="h-36 rounded-none w-full" />
                <div className="p-4 flex items-center justify-between">
                  <div className="space-y-2 flex-1 pr-2">
                    <Skeleton className="h-4 rounded-md w-2/3" />
                    <Skeleton className="h-3 rounded-md w-1/2" />
                  </div>
                  <Skeleton className="w-8 h-8 rounded-full" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <motion.div
            variants={staggerContainer}
            initial="hidden"
            animate="show"
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
          >
            {filteredVendors.map((vendor) => {
              const zoneObj = foodZones.find(z => z.id === vendor.food_zone_id);
              return (
                <motion.div
                  key={vendor.id}
                  variants={staggerItem}
                  whileHover={{ y: -4, scale: 1.015 }}
                  whileTap={{ scale: 0.985 }}
                  onClick={() => onSelectRestaurant(vendor)}
                  className="bg-white rounded-3xl overflow-hidden border border-rose-100/70 shadow-xs hover:shadow-xl hover:shadow-rose-950/5 transition-shadow cursor-pointer group"
                >
                  <div className="relative h-40">
                    <LazyImage
                      src={vendor.cover_image_url || 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&q=80&w=800'}
                      alt={vendor.name}
                      containerClassName="w-full h-full"
                      className="w-full h-full object-cover group-hover:scale-108 transition-transform duration-500 ease-out"
                    />
                    <div className="absolute top-3 right-3 bg-white/90 backdrop-blur-md px-2.5 py-1 rounded-full text-xs font-bold text-slate-900 flex items-center gap-1 shadow-xs z-10">
                      <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                      <span>{vendor.rating ? vendor.rating.toFixed(1) : 'New'}</span>
                    </div>
                  </div>

                  <div className="p-5 flex items-center justify-between">
                    <div>
                      <h3 className="font-extrabold text-slate-900 text-base group-hover:text-[#D6001C] transition-colors">{vendor.name}</h3>
                      <p className="text-[11px] text-slate-500 font-semibold uppercase mt-0.5">
                        {vendor.vendor_type.replace('_', ' ')} • {zoneObj?.name || 'Campus Zone'}
                      </p>
                      <div className="flex items-center gap-3 text-xs text-slate-500 mt-2 font-medium">
                        <span className="flex items-center gap-1 text-slate-600 font-bold">
                          <Clock className="w-3.5 h-3.5 text-[#D6001C]" />
                          {vendor.opening_time || '08:00'} - {vendor.closing_time || '20:00'}
                        </span>
                      </div>
                    </div>

                    <div className="w-9 h-9 rounded-full bg-rose-50 text-[#D6001C] flex items-center justify-center group-hover:bg-[#D6001C] group-hover:text-white transition-colors shadow-2xs">
                      <ChevronRight className="w-4 h-4" />
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        )}
      </div>

    </motion.div>
  );
};


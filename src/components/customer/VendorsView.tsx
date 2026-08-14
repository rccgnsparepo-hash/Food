import React from 'react';
import { motion } from 'motion/react';
import { Store, Star, Clock, MapPin, ChevronRight, Phone, Sparkles } from 'lucide-react';
import { useMarketplaceStore } from '../../stores/useMarketplaceStore';
import { Vendor } from '../../types';
import { pageVariants, staggerContainer, staggerItem } from '../../utils/motion';
import { LazyImage } from '../ui/LazyImage';

interface VendorsViewProps {
  onSelectRestaurant: (vendor: Vendor) => void;
  onExploreMenuForVendor?: (vendorId: string) => void;
}

export const VendorsView: React.FC<VendorsViewProps> = ({
  onSelectRestaurant,
  onExploreMenuForVendor,
}) => {
  const { vendors, menuItems, foodZones, isLoading } = useMarketplaceStore();

  return (
    <motion.div
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      className="space-y-8 pb-24 max-w-7xl mx-auto"
    >
      {/* Header Banner */}
      <div className="bg-gradient-to-br from-slate-900 via-rose-950 to-slate-900 text-white rounded-3xl p-6 sm:p-8 relative overflow-hidden shadow-xl border border-rose-900/40">
        <div className="relative z-10 max-w-2xl space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md text-[11px] font-extrabold text-rose-300 border border-white/10 uppercase tracking-wider">
            <Store className="w-3.5 h-3.5 text-[#D6001C]" />
            <span>Campus Food Facilities</span>
          </div>
          <h1 className="text-2xl sm:text-4xl font-black tracking-tight text-white">
            MTU Kitchens, Bukas & Cafeterias
          </h1>
          <p className="text-xs sm:text-sm text-slate-300 font-medium leading-relaxed">
            Discover verified food vendors operating across Mountain Top University campus. Order
            direct for quick pickup or hostel delivery.
          </p>
        </div>
      </div>

      {/* Vendors Grid with Staggered Entrance */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-64 bg-slate-100 rounded-3xl animate-pulse" />
          ))}
        </div>
      ) : (
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          animate="show"
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
        >
          {vendors.map((vendor) => {
            const vendorDishes = menuItems.filter((m) => m.vendor_id === vendor.id);
            const zone = foodZones.find((z) => z.id === vendor.food_zone_id);

            return (
              <motion.div
                key={vendor.id}
                variants={staggerItem}
                initial={{ opacity: 0, y: 16, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                whileHover={{ y: -4, scale: 1.015 }}
                whileTap={{ scale: 0.985 }}
                className="bg-white rounded-3xl overflow-hidden border border-rose-100 shadow-xs hover:shadow-xl hover:shadow-rose-950/5 transition-all flex flex-col justify-between group"
              >
                <div>
                  {/* Cover Image */}
                  <div className="relative h-44 w-full bg-slate-100 overflow-hidden">
                    <LazyImage
                      src={
                        vendor.cover_image_url ||
                        'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=600'
                      }
                      alt={vendor.name}
                      containerClassName="w-full h-full"
                      className="w-full h-full object-cover group-hover:scale-106 transition-transform duration-500"
                    />
                    <div className="absolute top-3 right-3 bg-white/95 backdrop-blur-md px-3 py-1 rounded-full text-xs font-bold text-slate-900 flex items-center gap-1 shadow-sm">
                      <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                      <span>{vendor.rating ? vendor.rating.toFixed(1) : '4.8'}</span>
                    </div>

                    <div className="absolute bottom-3 left-3 bg-slate-950/80 backdrop-blur-md text-white px-3 py-1 rounded-full text-[11px] font-bold">
                      {vendorDishes.length} Verified Dishes
                    </div>
                  </div>

                  {/* Vendor Details */}
                  <div className="p-5 space-y-3">
                    <div>
                      <h3 className="font-extrabold text-slate-900 text-lg group-hover:text-[#D6001C] transition-colors">
                        {vendor.name}
                      </h3>
                      <p className="text-xs text-slate-500 font-medium line-clamp-2 mt-1 leading-relaxed">
                        {vendor.description || 'Authentic Nigerian food stand at Mountain Top University.'}
                      </p>
                    </div>

                    <div className="pt-2 border-t border-rose-50 flex items-center justify-between text-xs text-slate-600 font-semibold">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-[#D6001C]" />
                        {vendor.opening_time || '07:30'} - {vendor.closing_time || '21:00'}
                      </span>
                      <span className="flex items-center gap-1 text-slate-500">
                        <MapPin className="w-3.5 h-3.5 text-[#D6001C]" />
                        {vendor.address ? vendor.address.split(',')[0] : 'Campus Hall'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Action Row */}
                <div className="p-5 pt-0">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => {
                      if (onExploreMenuForVendor) {
                        onExploreMenuForVendor(vendor.id);
                      } else {
                        onSelectRestaurant(vendor);
                      }
                    }}
                    className="w-full bg-[#D6001C] hover:bg-red-700 text-white font-extrabold py-3 rounded-2xl text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-md shadow-red-500/20"
                  >
                    <span>View Kitchen Menu</span>
                    <ChevronRight className="w-4 h-4" />
                  </motion.button>
                </div>
              </motion.div>
            );
          })}
        </motion.div>
      )}
    </motion.div>
  );
};

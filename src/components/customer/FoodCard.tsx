import React from 'react';
import { motion } from 'motion/react';
import { Heart, Plus, Check, Clock, Star, Ban } from 'lucide-react';
import { MenuItem } from '../../types';
import { useFavoriteStore } from '../../stores/useFavoriteStore';
import { useAuthStore } from '../../stores/useAuthStore';
import { useCartStore } from '../../stores/useCartStore';
import { useMarketplaceStore } from '../../stores/useMarketplaceStore';
import { getItemAvailability } from '../../utils/availability';
import { LazyImage } from '../ui/LazyImage';
import { triggerHaptic } from '../../utils/haptics';

interface FoodCardProps {
  item: MenuItem;
  onSelect: (item: MenuItem) => void;
}

export const FoodCard: React.FC<FoodCardProps> = ({ item, onSelect }) => {
  const { user } = useAuthStore();
  const { isFavorite, toggleFavorite } = useFavoriteStore();
  const { addItem, getItemQuantity } = useCartStore();
  const { vendors } = useMarketplaceStore();

  const vendorId = item.vendor_id || item.restaurant_id;
  const vendor = vendorId ? vendors.find((v) => v.id === vendorId) : undefined;
  const availability = getItemAvailability(item, vendor);

  const favorite = isFavorite(item.id);
  const cartQty = getItemQuantity(item.id);

  const handleFavoriteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    triggerHaptic(30);
    if (user?.uid) {
      toggleFavorite(user.uid, item.id, 'menu_item');
    }
  };

  const handleAddToCart = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!availability.isAvailable) {
      triggerHaptic(100);
      return;
    }
    triggerHaptic(50);
    addItem(item, vendor);
  };

  const rawPrice = item.base_price ?? item.price ?? 0;
  const displayPrice = rawPrice > 0 ? `₦${Number(rawPrice).toLocaleString()}` : 'Free';

  return (
    <motion.div
      whileHover={availability.isAvailable ? { y: -4, scale: 1.015 } : undefined}
      whileTap={availability.isAvailable ? { scale: 0.97 } : undefined}
      onClick={() => onSelect(item)}
      className={`bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl p-3 sm:p-4 shadow-2xs hover:shadow-lg transition-all cursor-pointer flex flex-col justify-between relative group select-none overflow-hidden border ${
        availability.isAvailable
          ? 'border-emerald-100/80 dark:border-slate-800 hover:shadow-emerald-950/5 dark:hover:border-slate-700'
          : 'border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/60 opacity-85'
      }`}
    >
      {/* Top badges & Favorite heart */}
      <div className="flex items-center justify-between z-10 mb-1.5">
        {!availability.isAvailable ? (
          <span className="text-[9px] sm:text-[10px] font-black text-white bg-rose-600 px-2 py-0.5 rounded-full uppercase tracking-wider shadow-xs flex items-center gap-1">
            <Ban className="w-2.5 h-2.5" />
            <span>{availability.badgeLabel}</span>
          </span>
        ) : (
          <span className="text-[9px] sm:text-[10px] font-bold text-slate-600 dark:text-slate-300 bg-emerald-50 dark:bg-slate-800 px-2 py-0.5 rounded-full flex items-center gap-1 border border-emerald-100 dark:border-slate-700">
            <Clock className="w-2.5 h-2.5 text-[#FF7A00]" />
            <span>15-20m</span>
          </span>
        )}

        <motion.button
          whileHover={{ scale: 1.15 }}
          whileTap={{ scale: 0.85 }}
          onClick={handleFavoriteClick}
          className="p-1.5 rounded-full bg-slate-50 dark:bg-slate-800 hover:bg-emerald-50 dark:hover:bg-slate-700 transition-colors text-slate-400 dark:text-slate-500 hover:text-emerald-700 dark:hover:text-emerald-400 shadow-2xs cursor-pointer ml-auto"
        >
          <Heart
            className={`w-3.5 h-3.5 sm:w-4 sm:h-4 transition-colors ${
              favorite ? 'fill-[#FF7A00] text-[#FF7A00]' : 'text-slate-400 dark:text-slate-500'
            }`}
          />
        </motion.button>
      </div>

      {/* Food Photo Container */}
      <div className="relative my-1 w-full aspect-4/3 overflow-hidden rounded-xl sm:rounded-2xl bg-emerald-50/40 dark:bg-slate-800/60">
        <LazyImage
          src={item.image_url || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&q=80&w=300'}
          alt={item.name}
          containerClassName="w-full h-full"
          className={`w-full h-full object-cover object-center transition-transform duration-500 ease-out ${
            availability.isAvailable
              ? 'group-hover:scale-108'
              : 'grayscale-40 opacity-75'
          }`}
        />
        {item.rating && (
          <div className="absolute bottom-1.5 left-1.5 bg-black/60 backdrop-blur-xs text-white text-[9px] sm:text-[10px] font-bold px-1.5 py-0.5 rounded-md flex items-center gap-0.5">
            <Star className="w-2.5 h-2.5 fill-amber-400 text-amber-400" />
            <span>{item.rating.toFixed(1)}</span>
          </div>
        )}
      </div>

      {/* Details */}
      <div className="mt-2 space-y-0.5">
        <h3 className="font-black text-slate-900 dark:text-slate-100 text-xs sm:text-sm tracking-tight truncate group-hover:text-[#0D472B] dark:group-hover:text-emerald-400 transition-colors">
          {item.name}
        </h3>
        <p className="text-[10px] sm:text-xs text-slate-400 dark:text-slate-400 font-medium truncate">
          {vendor?.name || item.description || item.category || 'MTU Fresh Special'}
        </p>
      </div>

      {/* Price & Add to Bag */}
      <div className="mt-2.5 flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
        <span className="text-xs sm:text-sm font-black text-slate-900 dark:text-slate-100">
          {displayPrice}
        </span>

        {!availability.isAvailable ? (
          <span className="text-[10px] font-black text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 border border-rose-200/80 dark:border-rose-900 px-2.5 py-1 rounded-xl cursor-not-allowed uppercase tracking-wider select-none">
            {availability.badgeLabel}
          </span>
        ) : (
          <motion.button
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.88 }}
            onClick={handleAddToCart}
            className={`h-7 sm:h-8 px-2.5 sm:px-3 rounded-xl sm:rounded-2xl flex items-center gap-1 transition-all cursor-pointer shadow-xs ${
              cartQty > 0
                ? 'bg-[#0D472B] text-white font-black text-xs'
                : 'bg-[#FF7A00] hover:bg-[#E65100] text-white shadow-orange-500/20 text-xs font-extrabold'
            }`}
          >
            {cartQty > 0 ? (
              <>
                <Check className="w-3 h-3 stroke-[3]" />
                <span>{cartQty}</span>
              </>
            ) : (
              <>
                <Plus className="w-3 h-3 sm:w-3.5 sm:h-3.5 stroke-[3]" />
                <span className="hidden sm:inline">Add</span>
              </>
            )}
          </motion.button>
        )}
      </div>
    </motion.div>
  );
};


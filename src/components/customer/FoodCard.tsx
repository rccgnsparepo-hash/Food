import React from 'react';
import { motion } from 'motion/react';
import { Heart, Plus, ShieldAlert, Check } from 'lucide-react';
import { MenuItem } from '../../types';
import { useFavoriteStore } from '../../stores/useFavoriteStore';
import { useAuthStore } from '../../stores/useAuthStore';
import { useCartStore } from '../../stores/useCartStore';
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
    triggerHaptic(50);
    addItem(item);
  };

  const displayPrice =
    item.base_price !== null && item.base_price !== undefined
      ? `₦${Number(item.base_price).toLocaleString()}`
      : item.price && item.price > 0
      ? `₦${Number(item.price).toLocaleString()}`
      : null;

  return (
    <motion.div
      whileHover={{ y: -5, scale: 1.018, transition: { type: 'spring', stiffness: 380, damping: 25 } }}
      whileTap={{ scale: 0.982, transition: { type: 'spring', stiffness: 450, damping: 28 } }}
      onClick={() => onSelect(item)}
      className="bg-white rounded-3xl p-5 shadow-xs hover:shadow-xl hover:shadow-rose-950/5 border border-rose-100/70 transition-shadow cursor-pointer flex flex-col justify-between relative group select-none overflow-hidden"
    >
      {/* Subtle card top glow on hover */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-[#D6001C]/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

      {/* Top Action Row: Heart & Verification badge */}
      <div className="flex items-center justify-between z-10 mb-2">
        {item.verification_status === 'pending' ? (
          <span className="text-[10px] font-bold text-amber-800 bg-amber-100/80 px-2.5 py-1 rounded-full flex items-center gap-1 shadow-2xs">
            <ShieldAlert className="w-3 h-3 text-amber-600" />
            Unverified
          </span>
        ) : (
          <span />
        )}

        <motion.button
          whileHover={{ scale: 1.15 }}
          whileTap={{ scale: 0.85 }}
          onClick={handleFavoriteClick}
          className="p-2 rounded-full bg-rose-50/90 hover:bg-rose-100/80 transition-colors text-rose-600 shadow-2xs cursor-pointer ml-auto"
        >
          <motion.div
            animate={favorite ? { scale: [1, 1.35, 1] } : { scale: 1 }}
            transition={{ duration: 0.25 }}
          >
            <Heart
              className={`w-4 h-4 transition-colors ${
                favorite ? 'fill-[#D6001C] text-[#D6001C]' : 'text-slate-400'
              }`}
            />
          </motion.div>
        </motion.button>
      </div>

      {/* Prominent Large Food Photography Image with Lazy Loading */}
      <div className="my-1 flex items-center justify-center overflow-hidden rounded-2xl bg-rose-50/50">
        <LazyImage
          src={item.image_url || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&q=80&w=300'}
          alt={item.name}
          containerClassName="w-full h-40"
          className="w-full h-full object-cover object-center group-hover:scale-108 transition-transform duration-500 ease-out"
        />
      </div>

      {/* Food Details */}
      <div className="mt-3 space-y-1">
        <h3 className="font-extrabold text-slate-900 text-sm tracking-tight truncate group-hover:text-[#D6001C] transition-colors">
          {item.name}
        </h3>
        <p className="text-xs text-slate-400 font-medium capitalize truncate">
          {item.description ? item.description : 'MTU campus meal'}
        </p>
      </div>

      {/* Price & Add to Cart Button Row */}
      <div className="mt-4 flex items-center justify-between pt-2 border-t border-rose-50">
        <div>
          <span className="text-[10px] font-bold text-slate-400 block -mb-0.5">Price</span>
          {displayPrice ? (
            <span className="text-base font-black text-slate-900">{displayPrice}</span>
          ) : (
            <span className="text-[11px] font-extrabold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-md">
              Price Unknown
            </span>
          )}
        </div>

        <motion.button
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.88 }}
          onClick={handleAddToCart}
          className={`h-9 px-3 rounded-2xl flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs ${
            cartQty > 0
              ? 'bg-emerald-600 text-white'
              : 'bg-[#D6001C] hover:bg-red-700 text-white shadow-red-500/20'
          }`}
        >
          {cartQty > 0 ? (
            <>
              <Check className="w-3.5 h-3.5 stroke-[3]" />
              <span className="text-xs font-black">{cartQty}</span>
            </>
          ) : (
            <>
              <Plus className="w-4 h-4 stroke-[3]" />
              <span className="text-xs font-bold hidden sm:inline">Add</span>
            </>
          )}
        </motion.button>
      </div>
    </motion.div>
  );
};


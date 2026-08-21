import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Heart } from 'lucide-react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { MenuItem } from '../../types';
import { useAuthStore } from '../../stores/useAuthStore';
import { useFavoriteStore } from '../../stores/useFavoriteStore';
import { useMarketplaceStore } from '../../stores/useMarketplaceStore';
import { FoodCard } from './FoodCard';
import { staggerContainer, staggerItem } from '../../utils/motion';

interface FavoritesViewProps {
  onSelectFood: (item: MenuItem) => void;
}

export const FavoritesView: React.FC<FavoritesViewProps> = ({ onSelectFood }) => {
  const { user } = useAuthStore();
  const favorites = useFavoriteStore((state) => state.favorites);
  const fetchFavorites = useFavoriteStore((state) => state.fetchFavorites);
  const { menuItems } = useMarketplaceStore();
  const [favoriteItems, setFavoriteItems] = useState<MenuItem[]>([]);

  useEffect(() => {
    if (user?.uid) {
      fetchFavorites(user.uid);
    }
  }, [user?.uid, fetchFavorites]);

  useEffect(() => {
    const list = menuItems.filter((item) => favorites.has(item.id));
    setFavoriteItems(list);
  }, [favorites, menuItems]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.3 }}
      className="space-y-6 pb-24 max-w-7xl mx-auto"
    >
      <div className="flex items-center justify-between bg-white rounded-3xl p-6 border border-rose-100 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-rose-50 text-[#D6001C] rounded-2xl">
            <Heart className="w-6 h-6 fill-[#D6001C]" />
          </div>
          <div>
            <h1 className="text-xl font-black text-slate-900">Your Favorites</h1>
            <p className="text-xs text-slate-400">Your saved dishes for instant re-ordering</p>
          </div>
        </div>
      </div>

      {favoriteItems.length > 0 ? (
        <motion.div
          variants={staggerContainer}
          initial="initial"
          animate="animate"
          className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4"
        >
          {favoriteItems.map((item) => (
            <motion.div key={item.id} variants={staggerItem}>
              <FoodCard item={item} onSelect={onSelectFood} />
            </motion.div>
          ))}
        </motion.div>
      ) : (
        <div className="bg-white rounded-3xl p-12 text-center border border-rose-100 max-w-md mx-auto space-y-3">
          <Heart className="w-12 h-12 text-slate-300 mx-auto" />
          <h3 className="font-bold text-slate-800 text-base">No Favorites Saved Yet</h3>
          <p className="text-xs text-slate-400">
            Tap the heart icon on any hamburger, pizza or sandwich to save it here!
          </p>
        </div>
      )}
    </motion.div>
  );
};


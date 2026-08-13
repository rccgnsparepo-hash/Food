import { create } from 'zustand';
import { db } from '../lib/firebase';
import { doc, setDoc, deleteDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { toast } from 'sonner';

interface FavoriteState {
  favorites: Set<string>;
  isLoading: boolean;
  fetchFavorites: (userId: string) => Promise<void>;
  toggleFavorite: (userId: string, itemId: string, itemType: 'menu_item' | 'restaurant') => Promise<void>;
  isFavorite: (itemId: string) => boolean;
}

export const useFavoriteStore = create<FavoriteState>((set, get) => ({
  favorites: new Set<string>(),
  isLoading: false,

  fetchFavorites: async (userId: string) => {
    if (!userId) return;
    set({ isLoading: true });
    try {
      const q = query(collection(db, 'favorites'), where('user_id', '==', userId));
      const snap = await getDocs(q);
      const favSet = new Set<string>();
      snap.forEach((doc) => {
        const data = doc.data();
        if (data.item_id) favSet.add(data.item_id);
      });
      set({ favorites: favSet, isLoading: false });
    } catch (err) {
      console.error('Error fetching favorites:', err);
      set({ isLoading: false });
    }
  },

  toggleFavorite: async (userId: string, itemId: string, itemType: 'menu_item' | 'restaurant') => {
    if (!userId) return;
    const favId = `${userId}_${itemId}`;
    const favRef = doc(db, 'favorites', favId);
    const current = new Set(get().favorites);

    if (current.has(itemId)) {
      current.delete(itemId);
      set({ favorites: new Set(current) });
      toast.info('Removed from favorites');
      try {
        await deleteDoc(favRef);
      } catch (e) {
        console.error('Failed to remove favorite:', e);
      }
    } else {
      current.add(itemId);
      set({ favorites: new Set(current) });
      toast.success('Added to favorites ❤️');
      try {
        await setDoc(favRef, {
          id: favId,
          user_id: userId,
          item_id: itemId,
          item_type: itemType,
          created_at: new Date().toISOString()
        });
      } catch (e) {
        console.error('Failed to add favorite:', e);
      }
    }
  },

  isFavorite: (itemId: string) => {
    return get().favorites.has(itemId);
  }
}));

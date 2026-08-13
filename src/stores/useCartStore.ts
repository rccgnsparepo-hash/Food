import { create } from 'zustand';
import { CartItem, MenuItem, Restaurant } from '../types';
import { toast } from 'sonner';

interface CartState {
  items: CartItem[];
  restaurantId: string | null;
  restaurantName: string | null;
  deliveryFee: number;
  isOpen: boolean;

  setCartOpen: (isOpen: boolean) => void;
  addItem: (item: MenuItem, restaurant?: Restaurant, quantity?: number, options?: Record<string, string>) => void;
  removeItem: (itemId: string) => void;
  updateQuantity: (itemId: string, quantity: number) => void;
  clearCart: () => void;
  getSubtotal: () => number;
  getServiceFee: () => number;
  getDeliveryFee: () => number;
  getTotal: () => number;
  getItemQuantity: (itemId: string) => number;
}

export const useCartStore = create<CartState>((set, get) => ({
  items: [],
  restaurantId: null,
  restaurantName: null,
  deliveryFee: 350,
  isOpen: false,

  setCartOpen: (isOpen: boolean) => set({ isOpen }),

  addItem: (menuItem, restaurant, quantity = 1, options) => {
    const state = get();

    // Check if adding from different restaurant
    if (state.restaurantId && menuItem.restaurant_id !== state.restaurantId && state.items.length > 0) {
      if (!confirm(`Your cart currently contains items from another restaurant. Clear cart and add items from ${restaurant?.name || 'this restaurant'}?`)) {
        return;
      }
      set({ items: [], restaurantId: null, restaurantName: null });
    }

    const restId = menuItem.vendor_id || menuItem.restaurant_id || 'rest_ronalds';
    const restName = restaurant?.name || state.restaurantName || "Ronald's Food House";
    const fee = restaurant?.delivery_fee || state.deliveryFee || 350;

    const existingIndex = state.items.findIndex((i) => i.menuItem.id === menuItem.id);

    let updatedItems: CartItem[] = [];
    if (existingIndex >= 0) {
      updatedItems = [...state.items];
      updatedItems[existingIndex].quantity += quantity;
      if (options) {
        updatedItems[existingIndex].selectedOptions = options;
      }
    } else {
      updatedItems = [
        ...state.items,
        {
          menuItem,
          quantity,
          selectedOptions: options
        }
      ];
    }

    set({
      items: updatedItems,
      restaurantId: restId,
      restaurantName: restName,
      deliveryFee: fee
    });
    toast.success(`Added ${menuItem.name} to cart`);
  },

  removeItem: (itemId: string) => {
    const item = get().items.find((i) => i.menuItem.id === itemId);
    const updated = get().items.filter((i) => i.menuItem.id !== itemId);
    set({
      items: updated,
      restaurantId: updated.length === 0 ? null : get().restaurantId,
      restaurantName: updated.length === 0 ? null : get().restaurantName
    });
    if (item) {
      toast.info(`Removed ${item.menuItem.name} from cart`);
    }
  },

  updateQuantity: (itemId: string, quantity: number) => {
    if (quantity <= 0) {
      get().removeItem(itemId);
      return;
    }
    const updated = get().items.map((i) => {
      if (i.menuItem.id === itemId) {
        return { ...i, quantity };
      }
      return i;
    });
    set({ items: updated });
  },

  clearCart: () => set({ items: [], restaurantId: null, restaurantName: null }),

  getSubtotal: () => {
    return get().items.reduce((sum, item) => {
      const p = item.menuItem.base_price ?? item.menuItem.price ?? 0;
      return sum + p * item.quantity;
    }, 0);
  },

  getServiceFee: () => {
    const subtotal = get().getSubtotal();
    return subtotal > 0 ? Math.round(subtotal * 0.05) : 0; // 5% service charge
  },

  getDeliveryFee: () => {
    return get().items.length > 0 ? get().deliveryFee : 0;
  },

  getTotal: () => {
    const subtotal = get().getSubtotal();
    if (subtotal === 0) return 0;
    return subtotal + get().getDeliveryFee() + get().getServiceFee();
  },

  getItemQuantity: (itemId: string) => {
    const item = get().items.find((i) => i.menuItem.id === itemId);
    return item ? item.quantity : 0;
  }
}));

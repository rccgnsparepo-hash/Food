import { create } from 'zustand';
import { CartItem, MenuItem, Restaurant } from '../types';
import { toast } from 'sonner';
import { getItemAvailability } from '../utils/availability';
import { useMarketplaceStore } from './useMarketplaceStore';

interface CartState {
  items: CartItem[];
  restaurantId: string | null;
  restaurantName: string | null;
  deliveryFee: number;
  isOpen: boolean;

  setCartOpen: (isOpen: boolean) => void;
  addItem: (item: MenuItem, restaurant?: Restaurant, quantity?: number, options?: Record<string, string>) => boolean;
  removeItem: (itemId: string) => void;
  updateQuantity: (itemId: string, quantity: number) => void;
  clearCart: () => void;
  removeUnavailableItems: () => number;
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

    // 1. Authoritative Vendor Lookup
    const vendors = useMarketplaceStore.getState().vendors;
    const vendorId = menuItem.vendor_id || menuItem.restaurant_id || restaurant?.id;
    const resolvedVendor = vendorId
      ? vendors.find((v) => v.id === vendorId) || restaurant
      : restaurant;

    // 2. Strict Availability & Sold-Out Check (VOID if unavailable or sold out)
    const availability = getItemAvailability(menuItem, resolvedVendor);
    if (!availability.isAvailable) {
      toast.error(`Cannot add: ${availability.reasonText}`);
      return false;
    }

    const incomingVendorId =
      vendorId ||
      'vendor_mtu_canteen';

    const incomingVendorName =
      resolvedVendor?.name ||
      restaurant?.name ||
      state.restaurantName ||
      (incomingVendorId === 'vendor_mtu_canteen' ? 'MTU Student Central Canteen' : 'Campus Food Stand');

    const fee = resolvedVendor?.delivery_fee || restaurant?.delivery_fee || state.deliveryFee || 350;

    const existingIndex = state.items.findIndex((i) => i.menuItem.id === menuItem.id);

    let updatedItems: CartItem[] = [];
    if (existingIndex >= 0) {
      updatedItems = [...state.items];
      updatedItems[existingIndex].quantity += quantity;
      if (options) {
        updatedItems[existingIndex].selectedOptions = {
          ...(updatedItems[existingIndex].selectedOptions || {}),
          ...options,
        };
      }
    } else {
      updatedItems = [
        ...state.items,
        {
          menuItem,
          quantity,
          selectedOptions: options,
        },
      ];
    }

    set({
      items: updatedItems,
      restaurantId: incomingVendorId,
      restaurantName: incomingVendorName,
      deliveryFee: fee,
    });
    toast.success(`Added ${menuItem.name} to cart`);
    return true;
  },

  removeItem: (itemId: string) => {
    const item = get().items.find((i) => i.menuItem.id === itemId);
    const updated = get().items.filter((i) => i.menuItem.id !== itemId);
    set({
      items: updated,
      restaurantId: updated.length === 0 ? null : get().restaurantId,
      restaurantName: updated.length === 0 ? null : get().restaurantName,
    });
    if (item) {
      toast.info(`Removed ${item.menuItem.name} from cart`);
    }
  },

  removeUnavailableItems: () => {
    const vendors = useMarketplaceStore.getState().vendors;
    const vendorMap = new Map<string, any>();
    vendors.forEach((v) => vendorMap.set(v.id, v));

    const currentItems = get().items;
    const validItems = currentItems.filter((item) => {
      const vId = item.menuItem.vendor_id || item.menuItem.restaurant_id;
      const vend = vId ? vendorMap.get(vId) : undefined;
      const status = getItemAvailability(item.menuItem, vend);
      return status.isAvailable;
    });

    const removedCount = currentItems.length - validItems.length;
    if (removedCount > 0) {
      set({
        items: validItems,
        restaurantId: validItems.length === 0 ? null : get().restaurantId,
        restaurantName: validItems.length === 0 ? null : get().restaurantName,
      });
      toast.info(`Removed ${removedCount} unavailable item(s) from cart`);
    }
    return removedCount;
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
  },
}));


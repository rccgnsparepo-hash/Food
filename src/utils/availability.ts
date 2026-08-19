import { MenuItem, Vendor, CartItem } from '../types';

export interface AvailabilityStatus {
  isAvailable: boolean;
  isItemSoldOut: boolean;
  isVendorClosed: boolean;
  isVendorInactive: boolean;
  badgeLabel: string;
  reasonText: string;
}

/**
 * Authoritative availability evaluator for BUKKIT food items and vendor kitchens.
 * Enforces strict business rule: If a vendor is closed/unavailable, or an item is sold out/unavailable,
 * adding to cart and checking out is strictly VOID.
 */
export function getItemAvailability(
  item: MenuItem | null | undefined,
  vendor?: Vendor | null
): AvailabilityStatus {
  if (!item) {
    return {
      isAvailable: false,
      isItemSoldOut: true,
      isVendorClosed: false,
      isVendorInactive: false,
      badgeLabel: 'Unavailable',
      reasonText: 'Item information not found.',
    };
  }

  // 1. Check Item specific availability flags
  const isItemUnavailable =
    item.available === false ||
    (item as any).is_available === false ||
    item.status === 'Sold Out' ||
    (item as any).is_sold_out === true ||
    item.status === 'Temporarily Unavailable' ||
    item.status === 'Draft' ||
    item.status === 'Archived';

  if (isItemUnavailable) {
    const isSoldOut = item.status === 'Sold Out' || (item as any).is_sold_out === true || item.available === false;
    return {
      isAvailable: false,
      isItemSoldOut: true,
      isVendorClosed: false,
      isVendorInactive: false,
      badgeLabel: isSoldOut ? 'Sold Out' : 'Unavailable',
      reasonText: isSoldOut
        ? `${item.name} is currently sold out.`
        : `${item.name} is temporarily unavailable.`,
    };
  }

  // 2. Check Vendor / Kitchen operational status if vendor is provided
  if (vendor) {
    if (vendor.is_active === false) {
      return {
        isAvailable: false,
        isItemSoldOut: false,
        isVendorClosed: true,
        isVendorInactive: true,
        badgeLabel: 'Kitchen Inactive',
        reasonText: `${vendor.name} is currently inactive and not taking orders.`,
      };
    }

    const isOperatingClosed =
      vendor.is_open === false ||
      vendor.kitchen_details?.operating_status === 'closed';

    if (isOperatingClosed) {
      return {
        isAvailable: false,
        isItemSoldOut: false,
        isVendorClosed: true,
        isVendorInactive: false,
        badgeLabel: 'Kitchen Closed',
        reasonText: `${vendor.name} is currently closed.`,
      };
    }
  }

  return {
    isAvailable: true,
    isItemSoldOut: false,
    isVendorClosed: false,
    isVendorInactive: false,
    badgeLabel: 'Available',
    reasonText: '',
  };
}

/**
 * Validates a list of cart items against known vendors and items in the marketplace.
 */
export function validateCartItems(
  cartItems: CartItem[],
  vendors: Vendor[],
  menuItems: MenuItem[]
): {
  isValid: boolean;
  invalidItems: { cartItem: CartItem; reason: string; label: string }[];
} {
  const vendorMap = new Map<string, Vendor>();
  vendors.forEach((v) => vendorMap.set(v.id, v));

  const itemMap = new Map<string, MenuItem>();
  menuItems.forEach((m) => itemMap.set(m.id, m));

  const invalidItems: { cartItem: CartItem; reason: string; label: string }[] = [];

  for (const cItem of cartItems) {
    // Lookup fresh menu item & vendor from authoritative state
    const latestItem = itemMap.get(cItem.menuItem.id) || cItem.menuItem;
    const vendorId = latestItem.vendor_id || latestItem.restaurant_id;
    const vendor = vendorId ? vendorMap.get(vendorId) : undefined;

    const status = getItemAvailability(latestItem, vendor);
    if (!status.isAvailable) {
      invalidItems.push({
        cartItem: cItem,
        reason: status.reasonText,
        label: status.badgeLabel,
      });
    }
  }

  return {
    isValid: invalidItems.length === 0,
    invalidItems,
  };
}

export type UserRole = 'customer' | 'rider' | 'admin';

export interface UserProfile {
  uid: string;
  name: string;
  email: string;
  phone: string;
  role: UserRole;
  avatar_url: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  is_online?: boolean;
  university_id?: string;
  campus_id?: string;
  preferred_zone_id?: string;
  created_at?: string;
}

// Hierarchy Types
export interface University {
  id: string;
  name: string;
  short_name: string;
  slug: string;
  description?: string;
  logo_url?: string;
  cover_image_url?: string;
  state: string;
  city: string;
  country: string;
  latitude: number;
  longitude: number;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface Campus {
  id: string;
  university_id: string;
  name: string;
  slug: string;
  description?: string;
  address?: string;
  latitude: number;
  longitude: number;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface FoodZone {
  id: string;
  campus_id: string;
  university_id?: string;
  name: string;
  description?: string;
  landmark?: string;
  latitude: number;
  longitude: number;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export type VendorType =
  | 'cafeteria'
  | 'buka'
  | 'restaurant'
  | 'fast_food'
  | 'pizza'
  | 'shawarma'
  | 'coffee_shop'
  | 'bakery'
  | 'snacks'
  | 'drinks'
  | 'food_stall'
  | 'food_court'
  | 'hostel_vendor'
  | 'other';

export interface Vendor {
  id: string;
  university_id?: string;
  campus_id?: string;
  food_zone_id?: string;
  name: string;
  slug?: string;
  description?: string;
  vendor_type?: VendorType;
  logo_url?: string;
  cover_image_url?: string;
  phone?: string;
  email?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  rating?: number;
  review_count?: number;
  category_ids?: string[];
  delivery_fee?: number;
  estimated_delivery_time?: string;
  minimum_order?: number;
  delivery_available?: boolean;
  pickup_available?: boolean;
  is_open: boolean;
  is_verified?: boolean;
  is_active?: boolean;
  opening_time?: string;
  closing_time?: string;
  created_at?: string;
  updated_at?: string;
}

// Backward compatibility alias for Restaurant -> Vendor
export type Restaurant = Vendor;

export interface FoodCategory {
  id: string;
  name: string;
  slug?: string;
  description?: string;
  image_url?: string;
  icon?: string;
  icon_name?: string;
  is_active?: boolean;
  created_at?: string;
  updated_at?: string;
}

export type Category = FoodCategory;

export type VerificationStatus = 'pending' | 'verified' | 'rejected' | 'needs_update';
export type ItemStatus = 'Draft' | 'Published' | 'Sold Out' | 'Temporarily Unavailable' | 'Archived';

export interface MenuItemVariant {
  id: string;
  menu_item_id: string;
  name: string; // e.g. Small, Regular, Large
  description?: string;
  price: number | null;
  available: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface MenuItem {
  id: string;
  vendor_id?: string;
  restaurant_id?: string; // alias for vendor_id
  category_id: string;
  name: string;
  slug?: string;
  description?: string;
  image_url?: string | null;
  base_price?: number | null; // NULL if unknown
  price?: number; // legacy fall-back computed field
  available: boolean;
  featured?: boolean;
  popular?: boolean;
  is_popular?: boolean;
  student_friendly?: boolean;
  spicy_level?: number; // 0 to 3
  preparation_time?: string;
  ingredients?: string[];
  allergens?: string[];
  portion_description?: string;
  calories?: number;
  rating?: number;
  review_count?: number;
  verification_status?: VerificationStatus;
  status?: ItemStatus;
  variants?: MenuItemVariant[];
  options?: MenuItemOption[];
  created_at?: string;
  updated_at?: string;
}

export interface MenuPriceHistory {
  id: string;
  menu_item_id: string;
  variant_id?: string | null;
  old_price: number | null;
  new_price: number | null;
  changed_by: string;
  changed_at: string;
  reason?: string;
}

export interface MenuAvailability {
  id: string;
  menu_item_id: string;
  day_of_week: 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday' | 'Sunday';
  start_time: string;
  end_time: string;
  is_available: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface FoodReview {
  id: string;
  user_id: string;
  user_name?: string;
  user_avatar?: string;
  vendor_id: string;
  menu_item_id?: string;
  order_id?: string;
  taste_rating: number;
  portion_rating: number;
  value_rating: number;
  service_rating: number;
  cleanliness_rating: number;
  overall_rating: number;
  comment: string;
  would_buy_again: boolean;
  created_at: string;
  updated_at?: string;
}

export interface MenuItemOption {
  name: string;
  choices: {
    name: string;
    price: number;
  }[];
}

export interface CartItem {
  menuItem: MenuItem;
  quantity: number;
  selectedVariant?: MenuItemVariant;
  selectedOptions?: Record<string, string>;
  notes?: string;
}

export type OrderStatus =
  | 'pending'
  | 'accepted'
  | 'preparing'
  | 'ready'
  | 'picked_up'
  | 'on_the_way'
  | 'delivered'
  | 'cancelled';

export type PaymentStatus = 'pending' | 'paid' | 'failed';

export interface OrderItem {
  menu_item_id: string;
  name: string;
  price: number;
  quantity: number;
  variant_name?: string;
  selectedOptions?: Record<string, string>;
  notes?: string;
}

export interface Order {
  id: string;
  user_id: string;
  user_name?: string;
  user_phone?: string;
  rider_id?: string | null;
  rider_name?: string | null;
  university_id?: string;
  campus_id?: string;
  food_zone_id?: string;
  vendor_id: string;
  restaurant_id?: string; // alias
  vendor_name?: string;
  restaurant_name: string;
  items: OrderItem[];
  status: OrderStatus;
  payment_status: PaymentStatus;
  payment_reference: string;
  subtotal: number;
  delivery_fee: number;
  service_fee: number;
  total_price: number;
  delivery_address: string;
  latitude: number;
  longitude: number;
  created_at: string;
  updated_at: string;
}

export interface ChatMessage {
  id: string;
  order_id: string;
  sender_id: string;
  sender_name: string;
  sender_role: UserRole;
  receiver_id: string;
  message: string;
  created_at: string;
  read_at?: string | null;
}

export interface RiderLocation {
  id: string;
  rider_id: string;
  order_id: string;
  latitude: number;
  longitude: number;
  updated_at: string;
}

export interface Promotion {
  id: string;
  title: string;
  subtitle: string;
  image_url: string;
  discount_percentage: number;
  code: string;
  active: boolean;
}

export interface Favorite {
  id: string;
  user_id: string;
  menu_item_id?: string;
  item_id?: string;
  created_at: string;
}

export interface VendorFavorite {
  id: string;
  user_id: string;
  vendor_id: string;
  created_at: string;
}


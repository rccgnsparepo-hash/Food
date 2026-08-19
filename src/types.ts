// Centralized BUKKIT Type Definitions and RBAC Model

export type UserRole =
  | 'customer'
  | 'rider'
  | 'kitchen'
  | 'kitchen_manager'
  | 'kitchen_staff'
  | 'admin'
  | 'super_admin';

export type UserStatus = 'active' | 'suspended' | 'pending_verification';

export type Permission =
  | 'orders.read'
  | 'orders.create'
  | 'orders.accept'
  | 'orders.reject'
  | 'orders.prepare'
  | 'orders.ready'
  | 'orders.assign_rider'
  | 'orders.pickup'
  | 'orders.deliver'
  | 'orders.cancel'
  | 'users.manage'
  | 'vendors.manage'
  | 'riders.manage'
  | 'payments.view'
  | 'analytics.view';

// Centralized User Identity Model
export interface UserIdentity {
  id: string; // matches uid
  uid: string;
  email: string;
  phone: string;
  first_name: string;
  last_name: string;
  name: string;
  avatar_url: string;
  status: UserStatus;
  email_verified: boolean;
  phone_verified: boolean;
  created_at: string;
  updated_at: string;
  last_login_at: string;
  role?: UserRole;
  roles: UserRole[];
  active_role: UserRole;
  permissions: Permission[];
  wallet_balance?: number;
}

// Sub-Profiles
export interface CustomerProfile {
  user_id: string;
  default_address?: string;
  university_id?: string;
  campus_id?: string;
  preferred_zone_id?: string;
  hostel_or_room?: string;
  loyalty_points: number;
  favorite_vendor_ids: string[];
  created_at: string;
  updated_at: string;
}

export type RiderAvailabilityStatus =
  | 'offline'
  | 'online'
  | 'available'
  | 'assigned'
  | 'picking_up'
  | 'delivering'
  | 'temporarily_unavailable';

export interface RiderProfile {
  rider_id: string;
  user_id: string;
  full_name: string;
  phone: string;
  profile_photo?: string;
  vehicle_type: 'bicycle' | 'motorcycle' | 'walking' | 'scooter' | 'electric_bike';
  vehicle_number?: string;
  plate_number?: string;
  matric_or_id_number?: string;
  availability_status: RiderAvailabilityStatus;
  is_online: boolean;
  is_verified: boolean;
  current_location?: {
    latitude: number;
    longitude: number;
    accuracy?: number;
    timestamp: string;
  };
  current_order_id?: string | null;
  active_order_id?: string | null;
  current_latitude?: number;
  current_longitude?: number;
  rating: number;
  completed_deliveries: number;
  earnings_balance: number;
  university_id?: string;
  campus_id?: string;
  created_at: string;
  updated_at: string;
}

export interface KitchenStaffProfile {
  user_id: string;
  vendor_id: string;
  vendor_name?: string;
  role: 'kitchen_manager' | 'kitchen_staff' | 'kitchen';
  permissions: Permission[];
  shift_status: 'on_duty' | 'off_duty';
  created_at: string;
  updated_at: string;
}

export interface AdminProfile {
  user_id: string;
  department: string;
  is_super_admin: boolean;
  permissions: Permission[];
  created_at: string;
  updated_at: string;
}

// Backward-compatible UserProfile type
export interface UserProfile extends UserIdentity {
  address?: string;
  latitude?: number;
  longitude?: number;
  is_online?: boolean;
  university_id?: string;
  campus_id?: string;
  preferred_zone_id?: string;
  customer_profile?: CustomerProfile;
  rider_profile?: RiderProfile;
  kitchen_profile?: KitchenStaffProfile;
  admin_profile?: AdminProfile;
}

// --- BUKKIT LEDGER-BASED WALLET ARCHITECTURE ---

export type WalletStatus = 'active' | 'suspended' | 'frozen';

export interface BukkitWallet {
  wallet_id: string;
  user_id: string;
  available_balance: number;
  pending_balance: number;
  currency: string; // 'NGN'
  status: WalletStatus;
  created_at: string;
  updated_at: string;
}

export type WalletTransactionType =
  | 'deposit'
  | 'order_payment'
  | 'refund'
  | 'promotional_credit'
  | 'withdrawal'
  | 'adjustment'
  | 'reversal';

export type WalletTransactionStatus = 'pending' | 'completed' | 'failed' | 'reversed';

export interface WalletTransaction {
  id: string; // matches transaction_id
  transaction_id: string;
  wallet_id: string;
  user_id: string;
  order_id?: string;
  type: WalletTransactionType;
  amount: number;
  balance_before: number;
  balance_after: number;
  status: WalletTransactionStatus;
  reference: string;
  description: string;
  idempotency_key?: string;
  metadata?: Record<string, any>;
  created_at: string;
}

// --- RIDER EARNINGS LEDGER ARCHITECTURE ---

export type RiderEarningStatus = 'pending' | 'available' | 'paid_out' | 'cancelled';

export interface DeliveryEarning {
  delivery_earning_id: string;
  rider_id: string;
  order_id: string;
  delivery_fee: number;
  rider_earning: number;
  platform_commission: number;
  status: RiderEarningStatus;
  created_at: string;
}

export interface RiderEarningsSummary {
  rider_id: string;
  available_earnings: number;
  pending_earnings: number;
  today_earnings: number;
  weekly_earnings: number;
  total_earnings: number;
  completed_deliveries: number;
  withdrawable_amount: number;
  history: DeliveryEarning[];
}

// --- AUDIT SYSTEM ARCHITECTURE ---

export interface AuditLogEntry {
  id: string;
  actor_id: string;
  actor_name: string;
  actor_role: UserRole;
  action: string;
  order_id?: string;
  transaction_id?: string;
  previous_state?: string;
  new_state?: string;
  metadata?: Record<string, any>;
  timestamp: string;
}

// --- MASTER ORDER DELIVERY DETAILS ---

export type PreferredDeliveryOption =
  | 'room_delivery'
  | 'hostel_gate_dropoff'
  | 'department_foyer'
  | 'campus_cafeteria_pickup'
  | 'direct_handover';

export interface CustomerDeliveryInfo {
  campus: string;
  building: string;
  hostel_hall: string;
  room_number?: string;
  exact_location: string;
  delivery_instructions: string;
  preferred_option: PreferredDeliveryOption;
  contactless: boolean;
}

// --- MASTER ORDER STATUS STATE MACHINE ---

export type OrderStatus =
  | 'pending'
  | 'payment_confirmed'
  | 'vendor_accepted'
  | 'preparing'
  | 'ready_for_pickup'
  | 'rider_assigned'
  | 'rider_arrived_vendor'
  | 'picked_up'
  | 'out_for_delivery'
  | 'arrived_at_delivery'
  | 'delivered'
  | 'cancelled'
  | 'failed_delivery'
  | 'refunded'
  | 'awaiting_rider'
  | 'rider_reassignment';

export type PaymentStatus =
  | 'pending'
  | 'paid'
  | 'failed'
  | 'refunded'
  | 'partially_refunded';

export type DeliveryStatus =
  | 'pending'
  | 'ready_for_pickup'
  | 'rider_assigned'
  | 'rider_arrived_vendor'
  | 'picked_up'
  | 'out_for_delivery'
  | 'arrived_at_delivery'
  | 'delivered'
  | 'failed_delivery'
  | 'cancelled';

export interface OrderItem {
  menu_item_id: string;
  name: string;
  price: number;
  quantity: number;
  variant_name?: string;
  selectedOptions?: Record<string, string>;
  notes?: string;
}

export interface OrderStatusHistoryItem {
  status: OrderStatus;
  timestamp: string;
  actor_id?: string;
  actor_role?: UserRole;
  actor_name?: string;
  notes?: string;
}

// --- THE MASTER AUTHORITATIVE ORDER ---

export interface Order {
  // Master Identifiers
  id: string; // order_id
  order_id: string;
  customer_id: string;
  user_id: string; // backward compat
  vendor_id: string;
  restaurant_id?: string;
  rider_id?: string | null;
  delivery_id: string;
  payment_id: string;
  wallet_transaction_id?: string | null;
  receipt_id: string;

  // Actors Snapshots
  customer_name: string;
  user_name?: string;
  customer_phone: string;
  user_phone?: string;
  customer_email?: string;
  vendor_name: string;
  restaurant_name?: string;
  vendor_phone?: string;
  vendor_address?: string;
  rider_name?: string | null;
  rider_phone?: string | null;
  rider_vehicle?: string | null;
  rider_avatar_url?: string | null;

  // Master State Machine
  status: OrderStatus; // order_status
  order_status: OrderStatus;
  payment_status: PaymentStatus;
  delivery_status: DeliveryStatus;

  // Financial Breakdown
  items: OrderItem[];
  subtotal: number;
  delivery_fee: number;
  service_fee: number;
  discount: number;
  wallet_amount_used: number;
  other_payment_amount: number;
  total_price: number; // final total
  payment_method: 'wallet' | 'paystack' | 'split_wallet_paystack' | 'delivery';
  payment_reference: string;

  // Customer & Delivery Information
  delivery_info: CustomerDeliveryInfo;
  delivery_address: string;
  delivery_room?: string;
  notes?: string;

  // Security & Verification Codes
  pickup_code: string; // 4-digit PIN shown by vendor, verified by rider
  delivery_code: string; // 4-digit PIN shown by customer, verified by rider
  pickup_verified_at?: string;
  delivery_verified_at?: string;
  delivery_verification_method?: 'pin' | 'qr_scan' | 'customer_confirm';

  // Geographic Coordinates & Live Tracking
  latitude: number;
  longitude: number;
  rider_current_latitude?: number;
  rider_current_longitude?: number;

  // Timestamps
  created_at: string;
  payment_confirmed_at?: string;
  vendor_accepted_at?: string;
  preparing_at?: string;
  ready_at?: string;
  rider_assigned_at?: string;
  rider_arrived_vendor_at?: string;
  picked_up_at?: string;
  out_for_delivery_at?: string;
  arrived_at_delivery_at?: string;
  delivered_at?: string;
  cancelled_at?: string;
  updated_at: string;

  // Delivery ETA Projections
  estimated_preparation_minutes?: number;
  estimated_ready_at?: string;
  estimated_pickup_at?: string;
  estimated_delivery_at?: string;
  cancellation_reason?: string;

  // History & Audit
  status_history?: OrderStatusHistoryItem[];
  university_id?: string;
  campus_id?: string;
  food_zone_id?: string;
}

export interface VendorWorker {
  id: string;
  name: string;
  role: string;
  phone?: string;
  avatar_url?: string;
  is_active?: boolean;
}

// Campus Hierarchy Types
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

export interface KitchenDetails {
  slogan: string;
  cover_image_url: string;
  worker_ids: string[];
  banner_url?: string;
  bio?: string;
  specialties?: string[];
  average_prep_time_minutes?: number;
  contact_phone?: string;
  instagram_handle?: string;
  operating_status?: 'open' | 'busy' | 'closed';
  updated_at?: string;
}

export interface Vendor {
  id: string;
  university_id?: string;
  campus_id?: string;
  food_zone_id?: string;
  name: string;
  slug?: string;
  description?: string;
  slogan?: string;
  vendor_type?: VendorType;
  logo_url?: string;
  cover_image_url?: string;
  kitchen_details?: KitchenDetails;
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
  workers?: VendorWorker[];
  worker_ids?: string[];
  owner_uid?: string;
  created_at?: string;
  updated_at?: string;
}

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
  name: string;
  description?: string;
  price: number | null;
  available: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface MenuItemOption {
  name: string;
  choices: {
    name: string;
    price: number;
  }[];
}

export interface MenuItem {
  id: string;
  vendor_id?: string;
  restaurant_id?: string;
  category_id: string;
  name: string;
  slug?: string;
  description?: string;
  image_url?: string | null;
  base_price?: number | null;
  price?: number;
  available: boolean;
  featured?: boolean;
  popular?: boolean;
  is_popular?: boolean;
  student_friendly?: boolean;
  spicy_level?: number;
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

export interface CartItem {
  menuItem: MenuItem;
  quantity: number;
  selectedVariant?: MenuItemVariant;
  selectedOptions?: Record<string, string>;
  notes?: string;
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
  order_id?: string;
  latitude: number;
  longitude: number;
  updated_at: string;
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

// BUKKIT Official Receipt Types
export interface ReceiptItem {
  product_id: string;
  product_name_snapshot: string;
  quantity: number;
  unit_price_snapshot: number;
  line_total: number;
  variant_name?: string;
  selected_options?: Record<string, string>;
  notes?: string;
}

export interface ReceiptFinancials {
  subtotal: number;
  delivery_fee: number;
  service_fee: number;
  tax: number;
  discount: number;
  calculated_total: number;
  stored_total: number;
  amount_paid: number;
  amount_due: number;
  amount_refunded: number;
  outstanding_balance: number;
  is_verified_match: boolean;
  mismatch_reason?: string;
}

export interface ReceiptCustomerInfo {
  name: string;
  phone: string;
  email?: string;
  student_id?: string;
  delivery_location: string;
  specific_location?: string;
  delivery_instructions?: string;
}

export interface ReceiptVendorInfo {
  vendor_id: string;
  vendor_name: string;
  vendor_location: string;
  vendor_phone?: string;
}

export interface ReceiptDeliveryInfo {
  method: string;
  delivery_fee: number;
  delivery_location: string;
  estimated_delivery_time?: string;
  rider_name?: string;
  rider_phone?: string;
  delivery_tracking_status: string;
  delivered_timestamp?: string;
}

export interface ReceiptPaymentInfo {
  status: PaymentStatus | 'partially_refunded';
  method: string;
  transaction_reference: string;
  paid_at?: string;
  amount: number;
}

export interface OrderReceipt {
  receipt_id: string;
  order_id: string;
  created_at: string;
  order_status: OrderStatus;
  payment_status: PaymentStatus | 'partially_refunded';
  customer: ReceiptCustomerInfo;
  vendor: ReceiptVendorInfo;
  items: ReceiptItem[];
  financials: ReceiptFinancials;
  payment: ReceiptPaymentInfo;
  delivery: ReceiptDeliveryInfo;
  timeline: {
    stage: string;
    title: string;
    status: 'completed' | 'current' | 'pending';
    timestamp?: string;
  }[];
  verification_url: string;
  qr_code_data_url?: string;
}

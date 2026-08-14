import { relations } from 'drizzle-orm';
import { integer, pgTable, serial, text, timestamp, boolean, doublePrecision } from 'drizzle-orm/pg-core';

// Users table (maps Firebase Auth UID and campus profiles)
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(),
  email: text('email').notNull(),
  name: text('name').notNull(),
  phone: text('phone').default(''),
  role: text('role').notNull().default('customer'), // 'customer' | 'rider' | 'vendor' | 'admin'
  universityId: text('university_id').default('uni_mtu'),
  campusId: text('campus_id').default('campus_mtu_main'),
  avatarUrl: text('avatar_url'),
  isVerified: boolean('is_verified').default(true),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Vendors / Food Kitchens & Campus Stores
export const vendors = pgTable('vendors', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  category: text('category').notNull().default('food'),
  rating: doublePrecision('rating').default(4.8),
  deliveryTime: text('delivery_time').default('15-25 min'),
  isOpen: boolean('is_open').default(true),
  imageUrl: text('image_url'),
  campusId: text('campus_id').default('campus_mtu_main'),
  createdAt: timestamp('created_at').defaultNow(),
});

// Menu Items / Products
export const menuItems = pgTable('menu_items', {
  id: text('id').primaryKey(),
  vendorId: text('vendor_id').references(() => vendors.id),
  name: text('name').notNull(),
  description: text('description'),
  price: doublePrecision('price').notNull(),
  category: text('category').notNull(),
  imageUrl: text('image_url'),
  isAvailable: boolean('is_available').default(true),
  createdAt: timestamp('created_at').defaultNow(),
});

// Orders
export const orders = pgTable('orders', {
  id: text('id').primaryKey(),
  userId: text('user_id').references(() => users.uid),
  riderId: text('rider_id'),
  vendorId: text('vendor_id').references(() => vendors.id),
  status: text('status').notNull().default('pending'), // 'pending' | 'accepted' | 'preparing' | 'ready' | 'picked_up' | 'arriving' | 'delivered' | 'cancelled'
  totalAmount: doublePrecision('total_amount').notNull(),
  deliveryFee: doublePrecision('delivery_fee').notNull().default(300),
  itemsJson: text('items_json').notNull(), // JSON string of items
  deliveryLocation: text('delivery_location').notNull(),
  deliveryRoom: text('delivery_room'),
  customerPhone: text('customer_phone'),
  notes: text('notes'),
  pickupCode: text('pickup_code'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Define relations
export const usersRelations = relations(users, ({ many }) => ({
  orders: many(orders),
}));

export const vendorsRelations = relations(vendors, ({ many }) => ({
  items: many(menuItems),
  orders: many(orders),
}));

export const menuItemsRelations = relations(menuItems, ({ one }) => ({
  vendor: one(vendors, {
    fields: [menuItems.vendorId],
    references: [vendors.id],
  }),
}));

export const ordersRelations = relations(orders, ({ one }) => ({
  user: one(users, {
    fields: [orders.userId],
    references: [users.uid],
  }),
  vendor: one(vendors, {
    fields: [orders.vendorId],
    references: [vendors.id],
  }),
}));

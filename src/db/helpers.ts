import { db } from '../db/index.ts';
import { users, vendors, menuItems, orders } from '../db/schema.ts';
import { eq, desc } from 'drizzle-orm';

// Helper: Check if user exists by email or uid
export async function checkUserExists(filter: { email?: string; uid?: string }) {
  try {
    if (filter.uid) {
      const res = await db.select().from(users).where(eq(users.uid, filter.uid)).limit(1);
      if (res.length > 0) return { exists: true, user: res[0] };
    }
    if (filter.email) {
      const normalized = filter.email.trim().toLowerCase();
      const res = await db.select().from(users).where(eq(users.email, normalized)).limit(1);
      if (res.length > 0) return { exists: true, user: res[0] };
    }
    return { exists: false, user: null };
  } catch (error) {
    console.error('Error checking user in Cloud SQL:', error);
    return { exists: false, user: null };
  }
}

// Helper: Upsert or get user
export async function getOrCreateUser(userData: {
  uid: string;
  email: string;
  name: string;
  phone?: string;
  role?: string;
  universityId?: string;
  campusId?: string;
  avatarUrl?: string;
}) {
  try {
    const existing = await db.select().from(users).where(eq(users.uid, userData.uid));
    if (existing.length > 0) {
      const updated = await db
        .update(users)
        .set({
          name: userData.name || existing[0].name,
          phone: userData.phone || existing[0].phone,
          role: userData.role || existing[0].role,
          updatedAt: new Date(),
        })
        .where(eq(users.uid, userData.uid))
        .returning();
      return updated[0];
    }

    const inserted = await db
      .insert(users)
      .values({
        uid: userData.uid,
        email: userData.email,
        name: userData.name,
        phone: userData.phone || '',
        role: userData.role || 'customer',
        universityId: userData.universityId || 'uni_mtu',
        campusId: userData.campusId || 'campus_mtu_main',
        avatarUrl: userData.avatarUrl,
        isVerified: true,
      })
      .returning();

    return inserted[0];
  } catch (error) {
    console.error('Error syncing user to Cloud SQL:', error);
    throw new Error('Database user synchronization failed', { cause: error });
  }
}

// Helper: Fetch all vendors
export async function getVendorsList() {
  try {
    return await db.select().from(vendors);
  } catch (error) {
    console.error('Error retrieving vendors from SQL:', error);
    return [];
  }
}

// Helper: Create order
export async function createSqlOrder(orderData: {
  id: string;
  userId: string;
  vendorId: string;
  riderId?: string;
  status: string;
  totalAmount: number;
  deliveryFee: number;
  itemsJson: string;
  deliveryLocation: string;
  deliveryRoom?: string;
  customerPhone?: string;
  notes?: string;
  pickupCode?: string;
  vendorName?: string;
  customerName?: string;
  customerEmail?: string;
}) {
  try {
    // 1. Ensure user exists in users table to prevent FK violation
    if (orderData.userId) {
      try {
        const userExists = await db.select().from(users).where(eq(users.uid, orderData.userId)).limit(1);
        if (userExists.length === 0) {
          await db.insert(users).values({
            uid: orderData.userId,
            email: orderData.customerEmail || `${orderData.userId}@mtu.edu.ng`,
            name: orderData.customerName || 'MTU Customer',
            phone: orderData.customerPhone || '',
            role: 'customer',
            universityId: 'uni_mtu',
            campusId: 'campus_mtu_main',
            isVerified: true,
          });
        }
      } catch (userErr) {
        console.warn('Notice ensuring user in Cloud SQL:', userErr);
      }
    }

    // 2. Ensure vendor exists in vendors table to prevent FK violation
    if (orderData.vendorId) {
      try {
        const vendorExists = await db.select().from(vendors).where(eq(vendors.id, orderData.vendorId)).limit(1);
        if (vendorExists.length === 0) {
          await db.insert(vendors).values({
            id: orderData.vendorId,
            name: orderData.vendorName || 'MTU Campus Food Vendor',
            category: 'food',
            campusId: 'campus_mtu_main',
            isOpen: true,
          });
        }
      } catch (vendorErr) {
        console.warn('Notice ensuring vendor in Cloud SQL:', vendorErr);
      }
    }

    const insertPayload = {
      id: orderData.id,
      userId: orderData.userId,
      vendorId: orderData.vendorId,
      riderId: orderData.riderId,
      status: orderData.status || 'pending',
      totalAmount: Number(orderData.totalAmount) || 0,
      deliveryFee: Number(orderData.deliveryFee) || 0,
      itemsJson: orderData.itemsJson || '[]',
      deliveryLocation: orderData.deliveryLocation || 'MTU Campus',
      deliveryRoom: orderData.deliveryRoom,
      customerPhone: orderData.customerPhone,
      notes: orderData.notes,
      pickupCode: orderData.pickupCode,
    };

    const inserted = await db.insert(orders).values(insertPayload).returning();
    return inserted[0];
  } catch (error) {
    console.error('Error saving order to Cloud SQL:', error);
    // Return gracefully so the HTTP endpoint and client never crash
    return {
      id: orderData.id,
      userId: orderData.userId,
      vendorId: orderData.vendorId,
      status: orderData.status || 'pending',
      totalAmount: orderData.totalAmount,
      deliveryFee: orderData.deliveryFee,
      itemsJson: orderData.itemsJson,
      deliveryLocation: orderData.deliveryLocation,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }
}

// Helper: Get user orders
export async function getUserOrders(uid: string) {
  try {
    return await db.select().from(orders).where(eq(orders.userId, uid)).orderBy(desc(orders.createdAt));
  } catch (error) {
    console.error('Error fetching user orders:', error);
    return [];
  }
}

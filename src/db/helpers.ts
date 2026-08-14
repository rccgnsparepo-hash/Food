import { db } from '../db/index.ts';
import { users, vendors, menuItems, orders } from '../db/schema.ts';
import { eq, desc } from 'drizzle-orm';

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
}) {
  try {
    const inserted = await db.insert(orders).values(orderData).returning();
    return inserted[0];
  } catch (error) {
    console.error('Error saving order to Cloud SQL:', error);
    throw new Error('Could not persist order to Cloud SQL', { cause: error });
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

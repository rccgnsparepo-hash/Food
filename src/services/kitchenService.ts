import { doc, getDoc, setDoc, updateDoc, collection, getDocs } from "../lib/embeddedDb";
import { db } from '../lib/firebase';
import { KitchenDetails, Vendor, VendorWorker } from '../types';

export const DEFAULT_KITCHEN_COVERS = [
  'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&q=80&w=800',
  'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&q=80&w=800',
  'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&q=80&w=800',
  'https://images.unsplash.com/photo-1512058564366-18510be2db19?auto=format&fit=crop&q=80&w=800',
  'https://images.unsplash.com/photo-1543353071-873f17a7a088?auto=format&fit=crop&q=80&w=800'
];

/**
 * Initializes a new kitchen profile with complete kitchen_details data structure
 * (slogan, cover_image_url, worker_ids, and default staff).
 */
export async function initializeKitchenProfile(
  vendorId: string,
  customDetails?: Partial<KitchenDetails>
): Promise<KitchenDetails> {
  const defaultWorkers: VendorWorker[] = [
    {
      id: `w_lead_${vendorId.replace(/[^a-z0-9]/gi, '_')}`,
      name: 'Chef in Charge',
      role: 'Head Chef & Kitchen Lead',
      phone: '+234 802 000 1122',
      is_active: true
    },
    {
      id: `w_dispatch_${vendorId.replace(/[^a-z0-9]/gi, '_')}`,
      name: 'Dispatch Coordinator',
      role: 'Packaging & Handover',
      phone: '+234 813 000 3344',
      is_active: true
    }
  ];

  const workerIds = customDetails?.worker_ids && customDetails.worker_ids.length > 0
    ? customDetails.worker_ids
    : defaultWorkers.map(w => w.id);

  const initialDetails: KitchenDetails = {
    slogan: customDetails?.slogan || 'Fresh, hearty campus meals prepared hot every single day!',
    cover_image_url: customDetails?.cover_image_url || DEFAULT_KITCHEN_COVERS[0],
    worker_ids: workerIds,
    banner_url: customDetails?.banner_url || customDetails?.cover_image_url || DEFAULT_KITCHEN_COVERS[0],
    bio: customDetails?.bio || 'Campus-approved verified kitchen providing hygienic, delicious student meals and rapid delivery.',
    specialties: customDetails?.specialties || ['Nigerian Soups', 'Smokey Jollof Rice', 'Quick Grills', 'Stir Fry'],
    average_prep_time_minutes: customDetails?.average_prep_time_minutes || 15,
    contact_phone: customDetails?.contact_phone || '+234 800 123 4567',
    operating_status: customDetails?.operating_status || 'open',
    updated_at: new Date().toISOString()
  };

  try {
    // 1. Write to kitchen_details standalone collection
    await setDoc(doc(db, 'kitchen_details', vendorId), initialDetails, { merge: true });

    // 2. Synchronize to vendors document
    const vendorRef = doc(db, 'vendors', vendorId);
    const vendorSnap = await getDoc(vendorRef);

    if (vendorSnap.exists()) {
      await updateDoc(vendorRef, {
        kitchen_details: initialDetails,
        slogan: initialDetails.slogan,
        cover_image_url: initialDetails.cover_image_url,
        worker_ids: initialDetails.worker_ids,
        workers: vendorSnap.data()?.workers || defaultWorkers,
        updated_at: new Date().toISOString()
      });
    }

    console.log(`Kitchen profile initialized for ${vendorId}:`, initialDetails);
    return initialDetails;
  } catch (error) {
    console.error(`Failed to initialize kitchen profile for ${vendorId}:`, error);
    return initialDetails;
  }
}

/**
 * Fetch kitchen details for a specific vendor
 */
export async function getKitchenDetails(vendorId: string): Promise<KitchenDetails | null> {
  try {
    const docSnap = await getDoc(doc(db, 'kitchen_details', vendorId));
    if (docSnap.exists()) {
      return docSnap.data() as KitchenDetails;
    }
    
    // Fallback: check vendor doc directly
    const vendorSnap = await getDoc(doc(db, 'vendors', vendorId));
    if (vendorSnap.exists()) {
      const data = vendorSnap.data() as Vendor;
      if (data.kitchen_details) return data.kitchen_details;
      if (data.slogan || data.cover_image_url) {
        return {
          slogan: data.slogan || 'Fresh campus food delivered hot!',
          cover_image_url: data.cover_image_url || DEFAULT_KITCHEN_COVERS[0],
          worker_ids: data.worker_ids || (data.workers ? data.workers.map(w => w.id) : [])
        };
      }
    }
    return null;
  } catch (err) {
    console.warn(`Could not load kitchen details for ${vendorId}:`, err);
    return null;
  }
}

/**
 * Update kitchen details in both kitchen_details collection and vendor doc
 */
export async function updateKitchenDetails(
  vendorId: string,
  updates: Partial<KitchenDetails>
): Promise<void> {
  const payload = {
    ...updates,
    updated_at: new Date().toISOString()
  };

  try {
    await setDoc(doc(db, 'kitchen_details', vendorId), payload, { merge: true });
    
    // Sync to vendor doc
    const vendorUpdates: Record<string, unknown> = {
      kitchen_details: payload,
      updated_at: new Date().toISOString()
    };
    if (updates.slogan) vendorUpdates.slogan = updates.slogan;
    if (updates.cover_image_url) vendorUpdates.cover_image_url = updates.cover_image_url;
    if (updates.worker_ids) vendorUpdates.worker_ids = updates.worker_ids;

    await updateDoc(doc(db, 'vendors', vendorId), vendorUpdates).catch(() => {});
  } catch (err) {
    console.error(`Error updating kitchen details for ${vendorId}:`, err);
    throw err;
  }
}

/**
 * Sync script to audit and initialize missing kitchen profiles for all existing vendors
 */
export async function syncAllKitchenProfiles(): Promise<number> {
  try {
    const vendorsSnap = await getDocs(collection(db, 'vendors'));
    let initializedCount = 0;

    for (const vDoc of vendorsSnap.docs) {
      const v = vDoc.data() as Vendor;
      if (!v.kitchen_details || !v.kitchen_details.slogan || !v.kitchen_details.cover_image_url) {
        await initializeKitchenProfile(v.id, {
          slogan: v.slogan || 'Delicious, nutritious student meals prepared daily!',
          cover_image_url: v.cover_image_url || DEFAULT_KITCHEN_COVERS[initializedCount % DEFAULT_KITCHEN_COVERS.length],
          worker_ids: v.worker_ids || (v.workers ? v.workers.map(w => w.id) : [])
        });
        initializedCount++;
      }
    }
    return initializedCount;
  } catch (err) {
    console.warn('Sync all kitchen profiles notice:', err);
    return 0;
  }
}

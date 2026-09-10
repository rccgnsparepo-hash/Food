import { collection, doc, getDoc, getDocs, query, where, setDoc } from '../lib/embeddedDb';
import { db } from '../lib/firebase';
import { Voucher, VoucherValidationResult } from '../types';

export const DEFAULT_ACTIVE_VOUCHERS: Voucher[] = [
  {
    id: 'MTUFIRST10',
    code: 'MTUFIRST10',
    title: '10% Off Campus Meal',
    description: '10% discount on campus meals (up to ₦1,000 off)',
    discount_type: 'percentage',
    discount_value: 10,
    min_order_amount: 1000,
    max_discount_amount: 1000,
    is_active: true,
    expiry_date: '2026-12-31T23:59:59Z',
    created_at: '2026-01-01T00:00:00Z',
  },
  {
    id: 'NIGHTBITE',
    code: 'NIGHTBITE',
    title: '₦300 Off Late Night Grills',
    description: '₦300 off dinner orders over ₦2,000',
    discount_type: 'fixed',
    discount_value: 300,
    min_order_amount: 2000,
    is_active: true,
    expiry_date: '2026-12-31T23:59:59Z',
    created_at: '2026-01-01T00:00:00Z',
  },
  {
    id: 'FREEDELIVERY',
    code: 'FREEDELIVERY',
    title: 'Free Campus Delivery',
    description: '100% off campus hostel or hall delivery fee on orders over ₦1,200',
    discount_type: 'free_delivery',
    discount_value: 350,
    min_order_amount: 1200,
    is_active: true,
    expiry_date: '2026-12-31T23:59:59Z',
    created_at: '2026-01-01T00:00:00Z',
  },
  {
    id: 'CAMPUS500',
    code: 'CAMPUS500',
    title: '₦500 Student Feast Saver',
    description: 'Flat ₦500 off group or combo meal orders over ₦3,500',
    discount_type: 'fixed',
    discount_value: 500,
    min_order_amount: 3500,
    is_active: true,
    expiry_date: '2026-12-31T23:59:59Z',
    created_at: '2026-01-01T00:00:00Z',
  },
  {
    id: 'BUKKIT20',
    code: 'BUKKIT20',
    title: '20% Mega Promo',
    description: '20% discount up to ₦1,500 on orders over ₦2,500',
    discount_type: 'percentage',
    discount_value: 20,
    min_order_amount: 2500,
    max_discount_amount: 1500,
    is_active: true,
    expiry_date: '2026-12-31T23:59:59Z',
    created_at: '2026-01-01T00:00:00Z',
  },
];

/**
 * Ensures initial active vouchers exist in Firestore
 */
export async function seedVouchersToFirestore(): Promise<void> {
  try {
    for (const voucher of DEFAULT_ACTIVE_VOUCHERS) {
      const voucherRef = doc(db, 'vouchers', voucher.id);
      await setDoc(voucherRef, voucher, { merge: true });
    }
  } catch (err) {
    console.warn('[VoucherService] Failed to seed default vouchers:', err);
  }
}

/**
 * Fetches all active vouchers from Firestore collection 'vouchers'
 */
export async function fetchActiveVouchersFromFirestore(): Promise<Voucher[]> {
  try {
    const vouchersRef = collection(db, 'vouchers');
    const q = query(vouchersRef, where('is_active', '==', true));
    const snapshot = await getDocs(q);

    if (!snapshot.empty) {
      const list: Voucher[] = [];
      snapshot.forEach((docSnap) => {
        list.push({ id: docSnap.id, ...(docSnap.data() as any) });
      });
      return list;
    }

    // If Firestore collection is empty, seed defaults and return them
    seedVouchersToFirestore().catch(() => {});
    return DEFAULT_ACTIVE_VOUCHERS;
  } catch (err) {
    console.warn('[VoucherService] Error fetching vouchers from Firestore, using fallback:', err);
    return DEFAULT_ACTIVE_VOUCHERS;
  }
}

export interface PromoValidationContext {
  subtotal: number;
  deliveryFee: number;
  vendorId?: string | null;
}

/**
 * Authoritatively validates a promo code against the Firestore 'vouchers' collection
 */
export async function validatePromoCode(
  rawCode: string,
  context: PromoValidationContext
): Promise<VoucherValidationResult> {
  const code = (rawCode || '').trim().toUpperCase();

  if (!code) {
    return {
      isValid: false,
      discountAmount: 0,
      error: 'Please enter a promo code.',
    };
  }

  try {
    let voucher: Voucher | null = null;

    // 1. First attempt direct document lookup by normalized code ID in Firestore
    const directDocRef = doc(db, 'vouchers', code);
    const directSnap = await getDoc(directDocRef).catch(() => null);

    if (directSnap && directSnap.exists()) {
      voucher = { id: directSnap.id, ...(directSnap.data() as any) };
    } else {
      // 2. Query collection where code == normalizedCode
      const vouchersRef = collection(db, 'vouchers');
      const q = query(vouchersRef, where('code', '==', code));
      const qSnap = await getDocs(q).catch(() => null);

      if (qSnap && !qSnap.empty) {
        const found = qSnap.docs[0];
        voucher = { id: found.id, ...(found.data() as any) };
      }
    }

    // 3. Fallback to default vouchers if not found in Firestore or during offline / cold cache
    if (!voucher) {
      const fallback = DEFAULT_ACTIVE_VOUCHERS.find((v) => v.code === code);
      if (fallback) {
        voucher = fallback;
        // Optionally persist fallback to Firestore in background
        setDoc(doc(db, 'vouchers', fallback.id), fallback, { merge: true }).catch(() => {});
      }
    }

    if (!voucher) {
      return {
        isValid: false,
        discountAmount: 0,
        error: `Promo code "${code}" is invalid or does not exist.`,
      };
    }

    // 4. Validate Active Status
    if (!voucher.is_active) {
      return {
        isValid: false,
        discountAmount: 0,
        error: `Promo code "${code}" is no longer active.`,
      };
    }

    // 5. Validate Expiry Date
    if (voucher.expiry_date) {
      const expiryTime = new Date(voucher.expiry_date).getTime();
      if (!isNaN(expiryTime) && expiryTime < Date.now()) {
        return {
          isValid: false,
          discountAmount: 0,
          error: `Promo code "${code}" expired on ${new Date(voucher.expiry_date).toLocaleDateString()}.`,
        };
      }
    }

    // 6. Validate Start Date
    if (voucher.start_date) {
      const startTime = new Date(voucher.start_date).getTime();
      if (!isNaN(startTime) && startTime > Date.now()) {
        return {
          isValid: false,
          discountAmount: 0,
          error: `Promo code "${code}" is not yet active.`,
        };
      }
    }

    // 7. Validate Minimum Order Subtotal
    if (voucher.min_order_amount && voucher.min_order_amount > 0) {
      if (context.subtotal < voucher.min_order_amount) {
        const shortfall = voucher.min_order_amount - context.subtotal;
        return {
          isValid: false,
          discountAmount: 0,
          error: `Minimum meal subtotal of ₦${voucher.min_order_amount.toLocaleString()} required (add ₦${shortfall.toLocaleString()} more to qualify).`,
        };
      }
    }

    // 8. Validate Applicable Vendor IDs (if restricted)
    if (
      voucher.applicable_vendor_ids &&
      voucher.applicable_vendor_ids.length > 0 &&
      context.vendorId
    ) {
      if (!voucher.applicable_vendor_ids.includes(context.vendorId)) {
        return {
          isValid: false,
          discountAmount: 0,
          error: `This promo code is only valid at selected campus vendors.`,
        };
      }
    }

    // 9. Calculate Discount Amount
    let discountAmount = 0;

    if (voucher.discount_type === 'percentage') {
      const rawPct = (context.subtotal * (voucher.discount_value || 0)) / 100;
      if (voucher.max_discount_amount && voucher.max_discount_amount > 0) {
        discountAmount = Math.min(rawPct, voucher.max_discount_amount);
      } else {
        discountAmount = rawPct;
      }
    } else if (voucher.discount_type === 'fixed') {
      discountAmount = Math.min(voucher.discount_value || 0, context.subtotal);
    } else if (voucher.discount_type === 'free_delivery') {
      discountAmount = context.deliveryFee || 350;
    }

    discountAmount = Math.round(Math.max(0, discountAmount));

    return {
      isValid: true,
      voucher,
      discountAmount,
    };
  } catch (err: any) {
    console.error('[VoucherService] Unexpected error validating promo code:', err);
    return {
      isValid: false,
      discountAmount: 0,
      error: 'Network error verifying promo code. Please try again.',
    };
  }
}

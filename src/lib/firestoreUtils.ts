export type PlainObject = Record<string, any>;

/**
 * Remove properties with value `undefined` from an object.
 * Keeps properties with null, false, empty-string, 0 values.
 */
export function withoutUndefined<T extends PlainObject>(obj: T): Partial<T> {
  const out: Partial<T> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) {
      out[k as keyof T] = v;
    }
  }
  return out;
}

/**
 * Returns true if vendorId looks like a valid vendor id string.
 * Adjust validation as needed for your vendor id format.
 */
export function isValidVendorId(vendorId: unknown): vendorId is string {
  return typeof vendorId === 'string' && vendorId.trim().length > 0;
}

/**
 * Build a users document payload safely:
 * - accepts a partial user object
 * - conditionally includes vendor_id only when valid
 * - removes undefined fields
 */
export function buildUserPayload(input: PlainObject): PlainObject {
  const payload: PlainObject = { ...input };

  // Conditionally include vendor_id only when valid
  if (!isValidVendorId(payload.vendor_id)) {
    delete payload.vendor_id;
  }

  // Remove any undefined fields from the payload
  return withoutUndefined(payload);
}

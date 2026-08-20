import { DeliveryZone, PreferredDeliveryOption } from '../types';
import {
  DEFAULT_MTU_DELIVERY_ZONES,
  detectDeliveryZone,
  calculateDistanceKm
} from './campusLocationService';
import { getEstimatedCampusRoute } from './routingService';

export interface DeliveryFeeCalculationInput {
  customerLat: number;
  customerLng: number;
  vendorLat?: number;
  vendorLng?: number;
  campusId?: string;
  preferredOption?: PreferredDeliveryOption;
  zones?: DeliveryZone[];
}

export interface DeliveryFeeBreakdown {
  baseFee: number;
  distanceKm: number;
  distanceFee: number;
  optionAddon: number;
  totalDeliveryFee: number;
  zone: DeliveryZone;
  zoneName: string;
  zoneCode: string;
  estimatedDeliveryTime: string;
  estimatedMinutes: number;
}

/**
 * Authoritatively calculates delivery fee and estimated delivery duration
 * based on customer GPS, vendor location, and zone parameters.
 */
export function calculateDeliveryFee(
  input: DeliveryFeeCalculationInput
): DeliveryFeeBreakdown {
  const {
    customerLat,
    customerLng,
    vendorLat = 6.7628,
    vendorLng = 3.3768,
    preferredOption = 'room_delivery',
    zones = DEFAULT_MTU_DELIVERY_ZONES
  } = input;

  // 1. Detect active delivery zone for the customer's drop-off coordinates
  const zone = detectDeliveryZone(customerLat, customerLng, zones);

  // 2. Calculate distance between vendor kitchen and customer drop-off
  const directDist = calculateDistanceKm(vendorLat, vendorLng, customerLat, customerLng);
  const routeDistKm = Number((directDist * 1.25).toFixed(2)); // realistic campus path distance

  // 3. Base fee from detected zone
  const baseFee = zone.base_fee || 300;

  // 4. Per km distance surcharge
  const perKmRate = zone.per_km_fee || 100;
  const distanceFee = Math.max(0, Math.round(routeDistKm * perKmRate));

  // 5. Preferred option modifier
  let optionAddon = 0;
  if (preferredOption === 'room_delivery') {
    optionAddon = 50; // Extra climb/hallway delivery handling
  } else if (preferredOption === 'hostel_gate_dropoff') {
    optionAddon = 0;
  } else if (preferredOption === 'department_foyer') {
    optionAddon = 30;
  }

  // 6. Total delivery fee (rounded to clean multiple of 10 NGN)
  const rawTotal = baseFee + distanceFee + optionAddon;
  const totalDeliveryFee = Math.ceil(rawTotal / 10) * 10;

  // 7. Estimated Delivery Time
  const routeEst = getEstimatedCampusRoute(
    { lat: vendorLat, lng: vendorLng },
    { lat: customerLat, lng: customerLng }
  );

  const estimatedMinutes = Math.max(zone.estimated_minutes || 10, routeEst.durationMinutes + 5); // + prep travel allowance
  const estimatedDeliveryTime = `${estimatedMinutes - 3}-${estimatedMinutes + 3} min`;

  return {
    baseFee,
    distanceKm: routeDistKm,
    distanceFee,
    optionAddon,
    totalDeliveryFee,
    zone,
    zoneName: zone.name,
    zoneCode: zone.code,
    estimatedDeliveryTime,
    estimatedMinutes
  };
}

import { RouteResult } from '../types';
import { calculateDistanceKm } from './campusLocationService';

// Routing endpoint - configurable via Vite environment variable or defaults to public OpenStreetMap OSRM
const metaEnv = typeof import.meta !== 'undefined' ? (import.meta as any).env : undefined;
const DEFAULT_OSRM_ROUTING_API =
  metaEnv?.VITE_ROUTING_API_URL ||
  'https://router.project-osrm.org/route/v1';

// Average campus courier delivery speeds (km/h)
const COURIER_BIKE_SPEED_KMH = 18; // ~3.3 minutes per km
const WALKING_SPEED_KMH = 4.8; // ~12.5 minutes per km

export interface RouteOptions {
  mode?: 'foot' | 'bicycle' | 'driving';
  timeoutMs?: number;
  campusId?: string;
  useFallbackIfSlow?: boolean;
}

/**
 * Generates intermediate walkway coordinates for realistic campus path display
 * when network routing is offline or unmapped in OSM.
 */
function generateCampusWalkwayCoordinates(
  origin: { lat: number; lng: number },
  dest: { lat: number; lng: number }
): [number, number][] {
  const points: [number, number][] = [[origin.lat, origin.lng]];

  // Generate 3-5 gentle zigzag waypoints following campus walkways
  const steps = 4;
  const dLat = dest.lat - origin.lat;
  const dLng = dest.lng - origin.lng;

  for (let i = 1; i < steps; i++) {
    const fraction = i / steps;
    // Introduce slight perpendicular offset for natural campus pathway curve
    const perpOffsetLat = (dLng * 0.15) * Math.sin(fraction * Math.PI);
    const perpOffsetLng = (-dLat * 0.15) * Math.sin(fraction * Math.PI);

    const lat = origin.lat + dLat * fraction + perpOffsetLat;
    const lng = origin.lng + dLng * fraction + perpOffsetLng;
    points.push([lat, lng]);
  }

  points.push([dest.lat, dest.lng]);
  return points;
}

/**
 * Formats distance nicely (e.g. "450 m" or "1.2 km")
 */
export function formatDistance(distanceKm: number): string {
  if (distanceKm < 1) {
    const meters = Math.round(distanceKm * 1000);
    return `${meters} m`;
  }
  return `${distanceKm.toFixed(1)} km`;
}

/**
 * Formats duration nicely (e.g. "4 min" or "15 min")
 */
export function formatDuration(durationMinutes: number): string {
  const rounded = Math.max(1, Math.round(durationMinutes));
  return `≈ ${rounded} min`;
}

/**
 * Fallback route generator using Haversine calculation + campus walkway curvature
 */
export function getEstimatedCampusRoute(
  origin: { lat: number; lng: number },
  dest: { lat: number; lng: number },
  mode: 'bicycle' | 'foot' | 'driving' = 'bicycle'
): RouteResult {
  const directDistKm = calculateDistanceKm(origin.lat, origin.lng, dest.lat, dest.lng);
  // Add 20% path factor for realistic campus road/path winding
  const campusPathDistKm = Number((directDistKm * 1.22).toFixed(2));
  const distanceMeters = Math.round(campusPathDistKm * 1000);

  const speedKmh = mode === 'foot' ? WALKING_SPEED_KMH : COURIER_BIKE_SPEED_KMH;
  const rawDurationMinutes = (campusPathDistKm / speedKmh) * 60;
  // Add 1.5 minutes for building entry/exit and gate transition
  const durationMinutes = Math.max(2, Math.round(rawDurationMinutes + 1.5));

  const coordinates = generateCampusWalkwayCoordinates(origin, dest);

  return {
    coordinates,
    distanceKm: campusPathDistKm,
    distanceMeters,
    durationMinutes,
    formattedDistance: formatDistance(campusPathDistKm),
    formattedDuration: formatDuration(durationMinutes),
    provider: 'campus_walkway',
    isEstimated: true,
    summary: 'Estimated campus walkway distance'
  };
}

/**
 * Primary Routing Service abstraction:
 * Queries free OpenStreetMap-compatible OSRM routing with seamless fallback.
 */
export async function getRoute(
  origin: { lat: number; lng: number },
  dest: { lat: number; lng: number },
  options: RouteOptions = {}
): Promise<RouteResult> {
  const mode = options.mode || 'bicycle';
  const timeoutMs = options.timeoutMs || 2500;

  // Validate coordinates
  if (
    typeof origin.lat !== 'number' ||
    typeof origin.lng !== 'number' ||
    typeof dest.lat !== 'number' ||
    typeof dest.lng !== 'number' ||
    isNaN(origin.lat) ||
    isNaN(dest.lat)
  ) {
    return getEstimatedCampusRoute({ lat: 6.7628, lng: 3.3768 }, { lat: 6.7638, lng: 3.3782 });
  }

  // Same location
  if (
    Math.abs(origin.lat - dest.lat) < 0.00005 &&
    Math.abs(origin.lng - dest.lng) < 0.00005
  ) {
    return {
      coordinates: [[origin.lat, origin.lng], [dest.lat, dest.lng]],
      distanceKm: 0.05,
      distanceMeters: 50,
      durationMinutes: 1,
      formattedDistance: '50 m',
      formattedDuration: '≈ 1 min',
      provider: 'straight_line_estimate',
      isEstimated: true,
      summary: 'At delivery location'
    };
  }

  try {
    const osrmProfile = mode === 'foot' ? 'foot' : 'driving';
    // OSRM expects coordinates as: {longitude},{latitude};{longitude},{latitude}
    const url = `${DEFAULT_OSRM_ROUTING_API}/${osrmProfile}/${origin.lng},${origin.lat};${dest.lng},${dest.lat}?overview=full&geometries=geojson&steps=false`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`OSRM HTTP error: ${response.status}`);
    }

    const data = await response.json();

    if (data && data.code === 'Ok' && data.routes && data.routes.length > 0) {
      const primaryRoute = data.routes[0];
      const distMeters = Math.round(primaryRoute.distance || 0);
      const distKm = Number((distMeters / 1000).toFixed(2));
      const durSec = primaryRoute.duration || 0;
      const durMin = Math.max(1, Math.round(durSec / 60));

      // GeoJSON coordinates come in [lng, lat], convert to Leaflet [lat, lng]
      const rawCoords: [number, number][] = primaryRoute.geometry?.coordinates || [];
      const leafletCoords: [number, number][] = rawCoords.map(([lng, lat]) => [lat, lng]);

      if (leafletCoords.length > 0) {
        return {
          coordinates: leafletCoords,
          distanceKm: distKm,
          distanceMeters: distMeters,
          durationMinutes: durMin,
          formattedDistance: formatDistance(distKm),
          formattedDuration: formatDuration(durMin),
          provider: 'osrm',
          isEstimated: false,
          summary: 'Live OpenStreetMap Campus Route'
        };
      }
    }

    // If OSRM returns no route geometry, fallback
    return getEstimatedCampusRoute(origin, dest, mode);
  } catch (err: any) {
    // Graceful, non-blocking fallback to campus walkway calculations
    return getEstimatedCampusRoute(origin, dest, mode);
  }
}

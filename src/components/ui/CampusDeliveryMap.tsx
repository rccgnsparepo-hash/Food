import React, { useEffect, useRef, useState, useCallback } from 'react';
import L from 'leaflet';
import {
  CampusLocation,
  DeliveryZone,
  GPSLocationState,
  RouteResult,
  OrderStatus
} from '../../types';
import {
  DEFAULT_MTU_CAMPUS_LOCATIONS,
  DEFAULT_MTU_DELIVERY_ZONES,
  DEFAULT_MTU_BOUNDARY,
  isWithinCampusBoundary,
  findNearestCampusLocation,
  detectDeliveryZone
} from '../../services/campusLocationService';
import { getRoute, formatDistance, formatDuration } from '../../services/routingService';
import {
  Navigation,
  Crosshair,
  Maximize2,
  Minimize2,
  AlertTriangle,
  RotateCcw,
  Search,
  Building,
  Check,
  Compass,
  Bike,
  Layers,
  MapPin,
  ExternalLink,
  ChevronDown
} from 'lucide-react';
import { triggerHaptic } from '../../utils/haptics';
import { toast } from 'sonner';

// Custom Marker HTML Generators
function createPinIcon(emoji: string, bgColor: string, size = 34, isPulsing = false) {
  return L.divIcon({
    className: 'bukkit-custom-pin',
    html: `
      <div style="
        position: relative;
        width: ${size}px;
        height: ${size}px;
        display: flex;
        align-items: center;
        justify-content: center;
      ">
        ${
          isPulsing
            ? `<div style="
                position: absolute;
                inset: -6px;
                background-color: ${bgColor};
                opacity: 0.35;
                border-radius: 50%;
                animation: ping 1.8s cubic-bezier(0, 0, 0.2, 1) infinite;
              "></div>`
            : ''
        }
        <div style="
          width: ${size}px;
          height: ${size}px;
          background-color: ${bgColor};
          border: 2.5px solid #ffffff;
          border-radius: 50%;
          box-shadow: 0 4px 12px rgba(0,0,0,0.3);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: ${Math.round(size * 0.48)}px;
          color: white;
          cursor: pointer;
          transition: transform 0.2s ease;
        ">
          ${emoji}
        </div>
      </div>
    `,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2]
  });
}

function createRiderIcon(heading = 0, isDelivering = false) {
  const bgColor = isDelivering ? '#10B981' : '#F59E0B'; // Emerald for out for delivery, Amber for going to vendor
  return L.divIcon({
    className: 'bukkit-rider-pin',
    html: `
      <div style="
        position: relative;
        width: 38px;
        height: 38px;
        display: flex;
        align-items: center;
        justify-content: center;
      ">
        <div style="
          position: absolute;
          inset: -6px;
          background-color: ${bgColor};
          opacity: 0.35;
          border-radius: 50%;
          animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;
        "></div>
        <div style="
          width: 38px;
          height: 38px;
          background-color: ${bgColor};
          border: 3px solid #ffffff;
          border-radius: 50%;
          box-shadow: 0 6px 16px rgba(0,0,0,0.35);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 18px;
          color: white;
        ">
          🚴
        </div>
      </div>
    `,
    iconSize: [38, 38],
    iconAnchor: [19, 19],
    popupAnchor: [0, -19]
  });
}

export interface CampusDeliveryMapProps {
  // Coordinates
  latitude: number;
  longitude: number;
  riderLat?: number;
  riderLng?: number;
  restaurantLat?: number;
  restaurantLng?: number;
  vendorName?: string;
  customerName?: string;
  orderStatus?: OrderStatus;

  // Mode & Actions
  isTrackingMode?: boolean;
  isDraggable?: boolean;
  showLandmarks?: boolean;
  showGeofence?: boolean;
  height?: string;
  className?: string;

  // Callbacks
  onLocationSelect?: (
    lat: number,
    lng: number,
    addressInfo: {
      address: string;
      nearestLocation?: CampusLocation | null;
      detectedZone?: DeliveryZone | null;
      isInsideCampus: boolean;
      accuracy?: number | null;
    }
  ) => void;
  onCampusLocationPick?: (loc: CampusLocation) => void;
}

export const CampusDeliveryMap: React.FC<CampusDeliveryMapProps> = ({
  latitude,
  longitude,
  riderLat,
  riderLng,
  restaurantLat,
  restaurantLng,
  vendorName = 'Kitchen Stand',
  customerName = 'Your Drop-off',
  orderStatus,
  isTrackingMode = false,
  isDraggable = true,
  showLandmarks = true,
  showGeofence = true,
  height = '320px',
  className = '',
  onLocationSelect,
  onCampusLocationPick
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);

  // Markers
  const customerMarkerRef = useRef<L.Marker | null>(null);
  const riderMarkerRef = useRef<L.Marker | null>(null);
  const vendorMarkerRef = useRef<L.Marker | null>(null);
  const accuracyCircleRef = useRef<L.Circle | null>(null);
  const geofenceCircleRef = useRef<L.Circle | null>(null);
  const landmarkMarkersRef = useRef<L.Marker[]>([]);
  const routePolylineRef = useRef<L.Polyline | null>(null);
  const prevRiderPosRef = useRef<{ lat: number; lng: number } | null>(null);
  const animFrameRef = useRef<number | null>(null);

  // State
  const [gpsState, setGpsState] = useState<GPSLocationState>({
    latitude: null,
    longitude: null,
    accuracy: null,
    timestamp: null,
    status: 'idle',
    isInsideCampus: true
  });
  const [activeRoute, setActiveRoute] = useState<RouteResult | null>(null);
  const [isFollowingRider, setIsFollowingRider] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const [showLandmarksLayer, setShowLandmarksLayer] = useState(showLandmarks);
  const [activeZone, setActiveZone] = useState<DeliveryZone | null>(null);
  const [isInsideCampus, setIsInsideCampus] = useState(true);

  // Ensure default Leaflet icons are fixed
  useEffect(() => {
    delete (L.Icon.Default.prototype as any)._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
      iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
      shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png'
    });
  }, []);

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        zoomControl: false,
        attributionControl: false
      }).setView([latitude, longitude], 16);

      // OpenStreetMap Tile Layer (Free & open-source)
      const metaEnv = typeof import.meta !== 'undefined' ? (import.meta as any).env : undefined;
      const tileUrl =
        metaEnv?.VITE_MAP_TILE_URL ||
        'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';

      L.tileLayer(tileUrl, {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap contributors • BUKKIT Campus Map'
      }).addTo(map);

      // Compact attribution in bottom right
      L.control.attribution({ position: 'bottomright', prefix: 'BUKKIT Map' }).addTo(map);

      // Handle user manual interaction to disable auto-following temporarily
      map.on('dragstart', () => {
        if (isTrackingMode) {
          setIsFollowingRider(false);
        }
      });

      mapInstanceRef.current = map;
    }

    const map = mapInstanceRef.current;

    // Handle Resize
    const resizeObserver = new ResizeObserver(() => {
      map.invalidateSize();
    });
    resizeObserver.observe(mapContainerRef.current);

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  // Update Geofence Circle
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (showGeofence) {
      if (!geofenceCircleRef.current) {
        geofenceCircleRef.current = L.circle(
          [DEFAULT_MTU_BOUNDARY.center_latitude, DEFAULT_MTU_BOUNDARY.center_longitude],
          {
            radius: DEFAULT_MTU_BOUNDARY.radius_meters,
            color: '#10B981',
            fillColor: '#10B981',
            fillOpacity: 0.04,
            weight: 1.5,
            dashArray: '4, 6'
          }
        ).addTo(map);
      }
    } else if (geofenceCircleRef.current) {
      geofenceCircleRef.current.remove();
      geofenceCircleRef.current = null;
    }
  }, [showGeofence]);

  // Update Campus Landmark Markers
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // Clear old landmarks
    landmarkMarkersRef.current.forEach((m) => m.remove());
    landmarkMarkersRef.current = [];

    if (showLandmarksLayer && !isTrackingMode) {
      DEFAULT_MTU_CAMPUS_LOCATIONS.forEach((loc) => {
        let iconEmoji = '🏢';
        let iconColor = '#3B82F6';

        if (loc.type === 'cafeteria' || loc.type === 'vendor') {
          iconEmoji = '🍽️';
          iconColor = '#F59E0B';
        } else if (loc.type === 'faculty' || loc.type === 'department' || loc.type === 'lecture_hall') {
          iconEmoji = '🎓';
          iconColor = '#8B5CF6';
        } else if (loc.type === 'gate' || loc.type === 'security') {
          iconEmoji = '⛩️';
          iconColor = '#64748B';
        } else if (loc.type === 'library') {
          iconEmoji = '📚';
          iconColor = '#0EA5E9';
        } else if (loc.type === 'medical') {
          iconEmoji = '🏥';
          iconColor = '#EF4444';
        } else if (loc.type === 'sports') {
          iconEmoji = '⚽';
          iconColor = '#10B981';
        }

        const icon = createPinIcon(iconEmoji, iconColor, 26);
        const marker = L.marker([loc.latitude, loc.longitude], { icon })
          .bindPopup(`
            <div style="font-family: system-ui, sans-serif; min-width: 150px;">
              <strong style="font-size: 13px; color: #0F172A; display: block;">${loc.name}</strong>
              <span style="font-size: 11px; color: #64748B; display: block; margin-top: 2px;">${loc.description || loc.landmark || ''}</span>
              <span style="display: inline-block; background: #ECFDF5; color: #065F46; font-size: 10px; font-weight: 700; padding: 2px 6px; border-radius: 6px; margin-top: 6px;">${loc.zone_name || 'Campus Zone'}</span>
            </div>
          `)
          .addTo(map);

        marker.on('click', () => {
          triggerHaptic(30);
          if (onCampusLocationPick) {
            onCampusLocationPick(loc);
          }
          if (onLocationSelect && !isTrackingMode) {
            const boundaryCheck = isWithinCampusBoundary(loc.latitude, loc.longitude);
            const zone = detectDeliveryZone(loc.latitude, loc.longitude);
            onLocationSelect(loc.latitude, loc.longitude, {
              address: `${loc.name} • ${loc.landmark || 'Campus Ground'}`,
              nearestLocation: loc,
              detectedZone: zone,
              isInsideCampus: boundaryCheck.isInside
            });
          }
        });

        landmarkMarkersRef.current.push(marker);
      });
    }
  }, [showLandmarksLayer, isTrackingMode, onCampusLocationPick, onLocationSelect]);

  // Update Customer Marker & Geofence Check
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // Check geofence
    const check = isWithinCampusBoundary(latitude, longitude);
    setIsInsideCampus(check.isInside);
    const zone = detectDeliveryZone(latitude, longitude);
    setActiveZone(zone);

    const customerIcon = createPinIcon('🏠', '#0284C7', 32, false);

    if (!customerMarkerRef.current) {
      const marker = L.marker([latitude, longitude], {
        icon: customerIcon,
        draggable: isDraggable && !isTrackingMode
      }).addTo(map);

      marker.bindPopup(`
        <div style="font-family: system-ui, sans-serif; font-size: 12px;">
          <strong style="color: #0284C7;">${customerName}</strong>
          <p style="margin: 2px 0 0 0; color: #475569;">Delivery Drop-off Location</p>
        </div>
      `);

      if (isDraggable && !isTrackingMode) {
        marker.on('dragend', (e) => {
          const latlng = e.target.getLatLng();
          handleLocationUpdate(latlng.lat, latlng.lng);
        });

        map.on('click', (e) => {
          if (!isTrackingMode) {
            triggerHaptic(25);
            marker.setLatLng(e.latlng);
            handleLocationUpdate(e.latlng.lat, e.latlng.lng);
          }
        });
      }

      customerMarkerRef.current = marker;
    } else {
      customerMarkerRef.current.setLatLng([latitude, longitude]);
    }
  }, [latitude, longitude, isDraggable, isTrackingMode, customerName]);

  // Helper to process location updates
  const handleLocationUpdate = (lat: number, lng: number, accuracy: number | null = null) => {
    const boundary = isWithinCampusBoundary(lat, lng);
    const nearest = findNearestCampusLocation(lat, lng);
    const zone = detectDeliveryZone(lat, lng);

    setIsInsideCampus(boundary.isInside);
    setActiveZone(zone);

    if (onLocationSelect) {
      const addr = nearest.location
        ? `${nearest.location.name} (near ${nearest.location.landmark || 'Campus'})`
        : `Campus Spot (${lat.toFixed(4)}, ${lng.toFixed(4)})`;

      onLocationSelect(lat, lng, {
        address: addr,
        nearestLocation: nearest.location,
        detectedZone: zone,
        isInsideCampus: boundary.isInside,
        accuracy
      });
    }
  };

  // Update Vendor Marker
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (restaurantLat && restaurantLng) {
      const restIcon = createPinIcon('🍔', '#1E293B', 34, false);
      if (!vendorMarkerRef.current) {
        vendorMarkerRef.current = L.marker([restaurantLat, restaurantLng], { icon: restIcon })
          .bindPopup(`
            <div style="font-family: system-ui, sans-serif; font-size: 12px;">
              <strong style="color: #0F172A; font-size: 13px;">${vendorName}</strong>
              <p style="margin: 2px 0 0 0; color: #64748B;">Kitchen Pickup Point</p>
            </div>
          `)
          .addTo(map);
      } else {
        vendorMarkerRef.current.setLatLng([restaurantLat, restaurantLng]);
      }
    } else if (vendorMarkerRef.current) {
      vendorMarkerRef.current.remove();
      vendorMarkerRef.current = null;
    }
  }, [restaurantLat, restaurantLng, vendorName]);

  // Smooth Rider Marker Movement Animation & Interpolation
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (riderLat && riderLng) {
      const isOutForDelivery = ['picked_up', 'out_for_delivery', 'arrived_at_delivery', 'on_the_way'].includes(
        orderStatus || ''
      );

      const targetPos: [number, number] = [riderLat, riderLng];

      if (!riderMarkerRef.current) {
        const riderIcon = createRiderIcon(0, isOutForDelivery);
        riderMarkerRef.current = L.marker(targetPos, { icon: riderIcon })
          .bindPopup(`
            <div style="font-family: system-ui, sans-serif; font-size: 12px;">
              <strong style="color: #10B981;">🚴 BUKKIT Courier</strong>
              <p style="margin: 2px 0 0 0; color: #475569;">${
                isOutForDelivery ? 'Heading to your room' : 'Collecting meal at kitchen'
              }</p>
            </div>
          `)
          .addTo(map);
        prevRiderPosRef.current = { lat: riderLat, lng: riderLng };
      } else {
        // Smoothly interpolate from previous GPS position to target GPS position over 1.2s
        const prev = prevRiderPosRef.current || { lat: riderLat, lng: riderLng };
        const startTime = performance.now();
        const durationMs = 1200;

        if (animFrameRef.current) {
          cancelAnimationFrame(animFrameRef.current);
        }

        const animateGlide = (now: number) => {
          const elapsed = now - startTime;
          const progress = Math.min(1, elapsed / durationMs);
          // Ease-out cubic
          const ease = 1 - Math.pow(1 - progress, 3);

          const curLat = prev.lat + (riderLat - prev.lat) * ease;
          const curLng = prev.lng + (riderLng - prev.lng) * ease;

          riderMarkerRef.current?.setLatLng([curLat, curLng]);

          if (progress < 1) {
            animFrameRef.current = requestAnimationFrame(animateGlide);
          } else {
            prevRiderPosRef.current = { lat: riderLat, lng: riderLng };
          }
        };

        animFrameRef.current = requestAnimationFrame(animateGlide);
      }

      // Auto-follow Rider if enabled
      if (isFollowingRider && isTrackingMode) {
        map.panTo(targetPos, { animate: true, duration: 0.8 });
      }
    } else if (riderMarkerRef.current) {
      riderMarkerRef.current.remove();
      riderMarkerRef.current = null;
    }

    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [riderLat, riderLng, orderStatus, isFollowingRider, isTrackingMode]);

  // Real-Time Route Calculation & Display
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    let isMounted = true;

    async function updateActiveRoute() {
      // Determine origin and destination based on order lifecycle
      const isOutForDelivery = ['picked_up', 'out_for_delivery', 'arrived_at_delivery', 'on_the_way'].includes(
        orderStatus || ''
      );

      let origin: { lat: number; lng: number } | null = null;
      let destination: { lat: number; lng: number } | null = null;
      let routeColor = '#10B981'; // Emerald for delivery to customer

      if (riderLat && riderLng) {
        origin = { lat: riderLat, lng: riderLng };

        if (!isOutForDelivery && restaurantLat && restaurantLng) {
          // Rider -> Vendor
          destination = { lat: restaurantLat, lng: restaurantLng };
          routeColor = '#F59E0B'; // Amber
        } else {
          // Rider -> Customer
          destination = { lat: latitude, lng: longitude };
          routeColor = '#10B981';
        }
      } else if (restaurantLat && restaurantLng && !isTrackingMode) {
        // Vendor -> Customer preview
        origin = { lat: restaurantLat, lng: restaurantLng };
        destination = { lat: latitude, lng: longitude };
        routeColor = '#3B82F6';
      }

      if (origin && destination) {
        try {
          const route = await getRoute(origin, destination, { mode: 'bicycle' });
          if (!isMounted) return;

          setActiveRoute(route);

          // Render polyline
          if (routePolylineRef.current) {
            routePolylineRef.current.remove();
          }

          routePolylineRef.current = L.polyline(route.coordinates, {
            color: routeColor,
            weight: 4.5,
            opacity: 0.85,
            dashArray: route.isEstimated ? '6, 8' : undefined,
            lineJoin: 'round'
          }).addTo(map);

          // Fit bounds to fit all active points smoothly
          const pointsToFit: L.LatLngExpression[] = [
            [origin.lat, origin.lng],
            [destination.lat, destination.lng]
          ];
          if (restaurantLat && restaurantLng) {
            pointsToFit.push([restaurantLat, restaurantLng]);
          }

          if (!isFollowingRider || !isTrackingMode) {
            map.fitBounds(L.latLngBounds(pointsToFit), { padding: [45, 45], maxZoom: 17 });
          }
        } catch (e) {
          console.warn('Route update warning:', e);
        }
      } else {
        if (routePolylineRef.current) {
          routePolylineRef.current.remove();
          routePolylineRef.current = null;
        }
        setActiveRoute(null);
      }
    }

    updateActiveRoute();

    return () => {
      isMounted = false;
    };
  }, [latitude, longitude, riderLat, riderLng, restaurantLat, restaurantLng, orderStatus, isTrackingMode, isFollowingRider]);

  // Browser Geolocation "Use My Location" Handler
  const handleUseMyLocation = useCallback(() => {
    triggerHaptic(50);

    if (!('geolocation' in navigator)) {
      setGpsState((prev) => ({
        ...prev,
        status: 'unavailable',
        errorMessage: 'Geolocation is not supported on this browser.'
      }));
      toast.error("Browser location not supported. Please drop your pin manually.");
      return;
    }

    setGpsState((prev) => ({ ...prev, status: 'locating', errorMessage: null }));
    toast.info('Acquiring precise GPS location on campus...');

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        const accuracy = Math.round(pos.coords.accuracy);
        const heading = pos.coords.heading;
        const speed = pos.coords.speed;
        const timestamp = pos.timestamp;

        const isLowAccuracy = accuracy > 35;
        const boundary = isWithinCampusBoundary(lat, lng);
        const nearest = findNearestCampusLocation(lat, lng);
        const zone = detectDeliveryZone(lat, lng);

        setGpsState({
          latitude: lat,
          longitude: lng,
          accuracy,
          heading,
          speed,
          timestamp,
          status: isLowAccuracy ? 'low_accuracy' : 'success',
          isInsideCampus: boundary.isInside,
          nearestLocation: nearest.location,
          detectedZone: zone
        });

        // Update Map Center and Marker
        const map = mapInstanceRef.current;
        if (map) {
          map.setView([lat, lng], 17);

          // Render Accuracy Circle
          if (accuracyCircleRef.current) {
            accuracyCircleRef.current.remove();
          }
          accuracyCircleRef.current = L.circle([lat, lng], {
            radius: accuracy,
            color: isLowAccuracy ? '#F59E0B' : '#0284C7',
            fillColor: isLowAccuracy ? '#F59E0B' : '#0284C7',
            fillOpacity: 0.15,
            weight: 1.5
          }).addTo(map);
        }

        if (customerMarkerRef.current) {
          customerMarkerRef.current.setLatLng([lat, lng]);
        }

        handleLocationUpdate(lat, lng, accuracy);

        if (!boundary.isInside) {
          toast.warning(
            'GPS coordinates appear outside MTU campus boundary. You can drag the pin to your hostel/faculty.',
            { duration: 5000 }
          );
        } else if (isLowAccuracy) {
          toast.warning(`GPS Accuracy ±${accuracy}m is low. Drag pin to your exact building entrance.`, {
            duration: 4000
          });
        } else {
          toast.success(`✓ Live Campus GPS fixed! (Accuracy: ±${accuracy}m)`);
        }
      },
      (err) => {
        let errMsg = 'Failed to acquire location.';
        let status: GPSLocationState['status'] = 'unavailable';

        if (err.code === err.PERMISSION_DENIED) {
          errMsg = "Location permission denied. You can still drop your delivery pin manually.";
          status = 'denied';
        } else if (err.code === err.TIMEOUT) {
          errMsg = 'GPS request timed out. Retrying or drop pin manually.';
          status = 'timeout';
        }

        setGpsState((prev) => ({
          ...prev,
          status,
          errorMessage: errMsg
        }));

        toast.error(errMsg);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 15000
      }
    );
  }, []);

  // Re-center Map on Active Points
  const handleRecenter = () => {
    triggerHaptic(30);
    const map = mapInstanceRef.current;
    if (!map) return;

    setIsFollowingRider(true);

    if (riderLat && riderLng) {
      map.setView([riderLat, riderLng], 17);
    } else {
      map.setView([latitude, longitude], 16);
    }
  };

  // Toggle Fullscreen
  const toggleFullscreen = () => {
    triggerHaptic(20);
    setIsFullscreen((prev) => !prev);
    setTimeout(() => {
      mapInstanceRef.current?.invalidateSize();
    }, 200);
  };

  // Filter Campus Locations for search
  const filteredLocations = searchQuery.trim()
    ? DEFAULT_MTU_CAMPUS_LOCATIONS.filter(
        (l) =>
          l.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (l.landmark && l.landmark.toLowerCase().includes(searchQuery.toLowerCase())) ||
          (l.description && l.description.toLowerCase().includes(searchQuery.toLowerCase()))
      )
    : DEFAULT_MTU_CAMPUS_LOCATIONS.slice(0, 8);

  return (
    <div
      className={`relative w-full rounded-3xl overflow-hidden border border-slate-200 shadow-sm bg-slate-900 transition-all ${
        isFullscreen ? 'fixed inset-0 z-50 rounded-none border-none' : ''
      } ${className}`}
      style={{ height: isFullscreen ? '100vh' : height }}
    >
      {/* Map Canvas */}
      <div ref={mapContainerRef} className="w-full h-full z-0" />

      {/* Top Floating Controls Ribbon */}
      <div className="absolute top-3 left-3 right-3 z-10 flex items-center justify-between gap-2 pointer-events-none">
        {/* Search / Location Pill */}
        {!isTrackingMode ? (
          <div className="relative flex-1 max-w-sm pointer-events-auto">
            <div className="flex items-center bg-white/95 backdrop-blur-md px-3 py-2 rounded-2xl shadow-lg border border-slate-200">
              <Search className="w-4 h-4 text-slate-400 mr-2 shrink-0" />
              <input
                type="text"
                value={searchQuery}
                onFocus={() => setShowSearchDropdown(true)}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setShowSearchDropdown(true);
                }}
                placeholder="Search hostel, hall, faculty..."
                className="w-full text-xs font-semibold text-slate-800 outline-none bg-transparent"
              />
              {searchQuery && (
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setShowSearchDropdown(false);
                  }}
                  className="text-xs text-slate-400 hover:text-slate-600 font-bold px-1"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Dropdown Results */}
            {showSearchDropdown && (
              <div className="absolute top-full left-0 right-0 mt-1.5 bg-white rounded-2xl shadow-2xl border border-slate-200 max-h-56 overflow-y-auto z-20 py-1 divide-y divide-slate-100">
                <div className="px-3 py-1.5 text-[10px] font-black tracking-wider uppercase text-slate-400 bg-slate-50">
                  Campus Locations Database ({filteredLocations.length})
                </div>
                {filteredLocations.map((loc) => (
                  <button
                    key={loc.id}
                    type="button"
                    onClick={() => {
                      triggerHaptic(40);
                      setSearchQuery(loc.name);
                      setShowSearchDropdown(false);
                      const map = mapInstanceRef.current;
                      if (map) {
                        map.setView([loc.latitude, loc.longitude], 17);
                      }
                      if (customerMarkerRef.current) {
                        customerMarkerRef.current.setLatLng([loc.latitude, loc.longitude]);
                      }
                      handleLocationUpdate(loc.latitude, loc.longitude);
                      if (onCampusLocationPick) {
                        onCampusLocationPick(loc);
                      }
                      toast.success(`Selected: ${loc.name}`);
                    }}
                    className="w-full px-3 py-2 text-left hover:bg-emerald-50 transition-colors flex items-start gap-2.5 cursor-pointer"
                  >
                    <Building className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-slate-900 truncate">{loc.name}</p>
                      <p className="text-[10px] text-slate-500 truncate">{loc.landmark || loc.description}</p>
                    </div>
                    <span className="text-[9px] font-black bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded-md uppercase">
                      {loc.type}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          /* Live Route Status Pill */
          <div className="bg-slate-900/90 backdrop-blur-md px-3.5 py-1.5 rounded-2xl shadow-lg border border-slate-700 pointer-events-auto flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <div>
              <p className="text-xs font-black text-white flex items-center gap-1.5">
                <Bike className="w-3.5 h-3.5 text-emerald-400" />
                {activeRoute ? `${activeRoute.formattedDistance} • ${activeRoute.formattedDuration}` : 'Live Navigation'}
              </p>
              <p className="text-[10px] text-slate-300 font-medium">
                {activeRoute?.summary || 'Connecting to courier GPS stream'}
              </p>
            </div>
          </div>
        )}

        {/* Action Buttons Right Ribbon */}
        <div className="flex items-center gap-1.5 pointer-events-auto">
          {/* Use My Location GPS Button */}
          {!isTrackingMode && (
            <button
              type="button"
              onClick={handleUseMyLocation}
              className={`p-2.5 rounded-2xl shadow-lg border transition-all cursor-pointer ${
                gpsState.status === 'locating'
                  ? 'bg-emerald-600 text-white animate-spin border-emerald-500'
                  : 'bg-white/95 backdrop-blur-md hover:bg-white text-slate-700 border-slate-200'
              }`}
              title="Use Current Device GPS Location"
            >
              <Crosshair className="w-4 h-4 text-emerald-600" />
            </button>
          )}

          {/* Toggle Landmarks Layer */}
          <button
            type="button"
            onClick={() => {
              triggerHaptic(20);
              setShowLandmarksLayer((prev) => !prev);
            }}
            className={`p-2.5 rounded-2xl shadow-lg border transition-all cursor-pointer ${
              showLandmarksLayer
                ? 'bg-slate-900 text-white border-slate-700'
                : 'bg-white/95 backdrop-blur-md text-slate-600 border-slate-200'
            }`}
            title="Toggle Campus Landmarks"
          >
            <Layers className="w-4 h-4" />
          </button>

          {/* Re-center Button */}
          <button
            type="button"
            onClick={handleRecenter}
            className="p-2.5 bg-white/95 backdrop-blur-md hover:bg-white text-slate-700 rounded-2xl shadow-lg border border-slate-200 transition-colors cursor-pointer"
            title="Re-center Map"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          {/* Fullscreen Button */}
          <button
            type="button"
            onClick={toggleFullscreen}
            className="p-2.5 bg-white/95 backdrop-blur-md hover:bg-white text-slate-700 rounded-2xl shadow-lg border border-slate-200 transition-colors cursor-pointer"
            title={isFullscreen ? 'Exit Fullscreen' : 'View Fullscreen Map'}
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Bottom Floating Info & Geofence Status */}
      <div className="absolute bottom-3 left-3 right-3 z-10 pointer-events-none flex flex-col gap-1.5">
        {/* Out of Campus Boundary Warning */}
        {!isInsideCampus && (
          <div className="bg-amber-500/95 backdrop-blur-md text-white px-3.5 py-2 rounded-2xl shadow-xl border border-amber-400 pointer-events-auto flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 text-amber-100" />
            <p className="text-xs font-bold leading-tight">
              BUKKIT currently delivers within the supported Mountain Top University campus area.
            </p>
          </div>
        )}

        {/* GPS Accuracy Status Pill (When GPS is activated) */}
        {gpsState.accuracy !== null && (
          <div className="bg-white/95 backdrop-blur-md px-3.5 py-1.5 rounded-2xl shadow-lg border border-slate-200 pointer-events-auto flex items-center justify-between text-xs text-slate-700">
            <div className="flex items-center gap-2">
              <span
                className={`w-2 h-2 rounded-full ${
                  (gpsState.accuracy || 0) <= 25
                    ? 'bg-emerald-500'
                    : (gpsState.accuracy || 0) <= 45
                    ? 'bg-amber-500'
                    : 'bg-rose-500'
                }`}
              />
              <span className="font-bold text-slate-900">
                GPS Accuracy: ±{gpsState.accuracy} m
              </span>
            </div>
            {activeZone && (
              <span
                className="text-[10px] font-black px-2 py-0.5 rounded-md"
                style={{ backgroundColor: `${activeZone.color}20`, color: activeZone.color }}
              >
                {activeZone.name}
              </span>
            )}
          </div>
        )}

        {/* Bottom Helper Bar for Manual Location Picking */}
        {!isTrackingMode && gpsState.accuracy === null && (
          <div className="bg-white/95 backdrop-blur-md px-3.5 py-2 rounded-2xl shadow-lg border border-slate-200 pointer-events-auto flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-medium text-slate-700">
              <MapPin className="w-4 h-4 text-rose-600" />
              <span>Tap map or drag pin to exact delivery entrance</span>
            </div>
            {activeZone && (
              <span
                className="text-[10px] font-black px-2 py-0.5 rounded-md"
                style={{ backgroundColor: `${activeZone.color}20`, color: activeZone.color }}
              >
                {activeZone.code}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

import React, { useEffect, useRef } from 'react';
import L from 'leaflet';

interface MapPickerProps {
  latitude: number;
  longitude: number;
  riderLat?: number;
  riderLng?: number;
  restaurantLat?: number;
  restaurantLng?: number;
  onLocationSelect?: (lat: number, lng: number, address: string) => void;
  height?: string;
  isTrackingMode?: boolean;
}

export const MapPicker: React.FC<MapPickerProps> = ({
  latitude,
  longitude,
  riderLat,
  riderLng,
  restaurantLat,
  restaurantLng,
  onLocationSelect,
  height = '300px',
  isTrackingMode = false
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const riderMarkerRef = useRef<L.Marker | null>(null);
  const restaurantMarkerRef = useRef<L.Marker | null>(null);

  useEffect(() => {
    if (!mapContainerRef.current) return;

    // Fix default Leaflet icon paths
    delete (L.Icon.Default.prototype as any)._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
      iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
      shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png'
    });

    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current).setView([latitude, longitude], 14);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors'
      }).addTo(map);

      mapInstanceRef.current = map;

      // Custom pins
      const customerIcon = L.divIcon({
        className: 'custom-map-pin',
        html: `<div style="background-color: #D6001C; width: 28px; height: 28px; border-radius: 50%; border: 3px solid white; box-shadow: 0 4px 10px rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; font-size: 12px;">🏠</div>`,
        iconSize: [28, 28],
        iconAnchor: [14, 14]
      });

      const customerMarker = L.marker([latitude, longitude], {
        icon: customerIcon,
        draggable: !isTrackingMode
      }).addTo(map);

      if (onLocationSelect && !isTrackingMode) {
        customerMarker.on('dragend', (e) => {
          const latlng = e.target.getLatLng();
          onLocationSelect(latlng.lat, latlng.lng, `Location (${latlng.lat.toFixed(4)}, ${latlng.lng.toFixed(4)})`);
        });

        map.on('click', (e) => {
          customerMarker.setLatLng(e.latlng);
          onLocationSelect(e.latlng.lat, e.latlng.lng, `Location (${e.latlng.lat.toFixed(4)}, ${e.latlng.lng.toFixed(4)})`);
        });
      }

      markerRef.current = customerMarker;
    }

    const map = mapInstanceRef.current;

    // Restaurant Marker
    if (restaurantLat && restaurantLng) {
      if (!restaurantMarkerRef.current) {
        const restIcon = L.divIcon({
          className: 'custom-rest-pin',
          html: `<div style="background-color: #1E293B; width: 32px; height: 32px; border-radius: 50%; border: 3px solid white; box-shadow: 0 4px 10px rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center; color: white; font-size: 14px;">🍔</div>`,
          iconSize: [32, 32],
          iconAnchor: [16, 16]
        });
        restaurantMarkerRef.current = L.marker([restaurantLat, restaurantLng], { icon: restIcon }).addTo(map);
      } else {
        restaurantMarkerRef.current.setLatLng([restaurantLat, restaurantLng]);
      }
    }

    // Rider Live Location Marker
    if (riderLat && riderLng) {
      if (!riderMarkerRef.current) {
        const riderIcon = L.divIcon({
          className: 'custom-rider-pin',
          html: `<div style="background-color: #EF4444; width: 36px; height: 36px; border-radius: 50%; border: 3px solid white; box-shadow: 0 6px 14px rgba(239,68,68,0.5); display: flex; align-items: center; justify-content: center; color: white; font-size: 16px; animation: pulse 1.5s infinite;">🛵</div>`,
          iconSize: [36, 36],
          iconAnchor: [18, 18]
        });
        riderMarkerRef.current = L.marker([riderLat, riderLng], { icon: riderIcon }).addTo(map);
      } else {
        riderMarkerRef.current.setLatLng([riderLat, riderLng]);
      }

      // Draw polyline if both rider and customer exist
      const latlngs: L.LatLngExpression[] = [
        [riderLat, riderLng],
        [latitude, longitude]
      ];
      L.polyline(latlngs, { color: '#D6001C', weight: 4, dashArray: '6, 8' }).addTo(map);

      map.fitBounds(L.latLngBounds(latlngs), { padding: [40, 40] });
    }

    return () => {
      // Keep map initialized across re-renders
    };
  }, [latitude, longitude, riderLat, riderLng, restaurantLat, restaurantLng, isTrackingMode]);

  return (
    <div className="relative w-full rounded-2xl overflow-hidden border border-rose-100 shadow-sm">
      <div ref={mapContainerRef} style={{ height }} className="w-full z-0" />
      {!isTrackingMode && (
        <div className="absolute bottom-2 left-2 bg-white/95 backdrop-blur-md px-3 py-1.5 rounded-lg text-xs font-medium text-slate-700 shadow-md">
          📍 Drag marker or tap map to set delivery spot
        </div>
      )}
    </div>
  );
};

import React from 'react';
import { CampusDeliveryMap, CampusDeliveryMapProps } from './CampusDeliveryMap';
import { CampusLocation } from '../../types';

export interface MapPickerProps {
  latitude: number;
  longitude: number;
  riderLat?: number;
  riderLng?: number;
  restaurantLat?: number;
  restaurantLng?: number;
  vendorName?: string;
  customerName?: string;
  orderStatus?: any;
  onLocationSelect?: (lat: number, lng: number, address: string) => void;
  onCampusLocationPick?: (loc: CampusLocation) => void;
  height?: string;
  className?: string;
  isTrackingMode?: boolean;
  showLandmarks?: boolean;
  showGeofence?: boolean;
}

export const MapPicker: React.FC<MapPickerProps> = ({
  latitude,
  longitude,
  riderLat,
  riderLng,
  restaurantLat,
  restaurantLng,
  vendorName,
  customerName,
  orderStatus,
  onLocationSelect,
  onCampusLocationPick,
  height = '300px',
  className = '',
  isTrackingMode = false,
  showLandmarks = true,
  showGeofence = true
}) => {
  return (
    <CampusDeliveryMap
      latitude={latitude}
      longitude={longitude}
      riderLat={riderLat}
      riderLng={riderLng}
      restaurantLat={restaurantLat}
      restaurantLng={restaurantLng}
      vendorName={vendorName}
      customerName={customerName}
      orderStatus={orderStatus}
      height={height}
      className={className}
      isTrackingMode={isTrackingMode}
      showLandmarks={showLandmarks}
      showGeofence={showGeofence}
      onCampusLocationPick={onCampusLocationPick}
      onLocationSelect={(lat, lng, info) => {
        if (onLocationSelect) {
          onLocationSelect(lat, lng, info.address);
        }
      }}
    />
  );
};

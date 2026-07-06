import { useMemo } from 'react';
import {
  MapContainer,
  TileLayer,
  Polyline,
  CircleMarker,
  useMap,
} from 'react-leaflet';
import { LatLngBoundsExpression, LatLngExpression } from 'leaflet';

interface LocationPoint {
  latitude: number;
  longitude: number;
}

interface DeliveryMapProps {
  customerLocation?: LocationPoint;
  courierLocation?: LocationPoint | null;
  height?: number;
}

const FitBounds = ({ bounds }: { bounds?: LatLngBoundsExpression }) => {
  const map = useMap();
  useMemo(() => {
    if (bounds) {
      map.fitBounds(bounds, { padding: [24, 24] });
    }
  }, [bounds, map]);
  return null;
};

export const DeliveryMap = ({
  customerLocation,
  courierLocation,
  height = 260,
}: DeliveryMapProps) => {
  if (!customerLocation) {
    return (
      <div className="rounded-xl border bg-muted/40 p-4 text-center text-sm text-muted-foreground">
        Delivery location will appear once the customer address is geocoded.
      </div>
    );
  }

  const route: LatLngExpression[] = [];
  route.push([customerLocation.latitude, customerLocation.longitude]);
  if (courierLocation) {
    route.push([courierLocation.latitude, courierLocation.longitude]);
  }

  const bounds: LatLngBoundsExpression | undefined =
    route.length === 2 ? (route as LatLngBoundsExpression) : undefined;
  const center: LatLngExpression = route[route.length - 1];

  return (
    <div className="rounded-xl border overflow-hidden">
      <MapContainer
        center={center}
        zoom={15}
        scrollWheelZoom={false}
        style={{ height, width: '100%' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FitBounds bounds={bounds} />
        <CircleMarker
          center={[customerLocation.latitude, customerLocation.longitude]}
          radius={10}
          pathOptions={{
            color: '#ef4444',
            fillColor: '#ef4444',
            fillOpacity: 0.8,
          }}
        >
          <span className="sr-only">Customer location</span>
        </CircleMarker>
        {courierLocation && (
          <CircleMarker
            center={[courierLocation.latitude, courierLocation.longitude]}
            radius={10}
            pathOptions={{
              color: '#2563eb',
              fillColor: '#2563eb',
              fillOpacity: 0.9,
            }}
          >
            <span className="sr-only">Delivery person location</span>
          </CircleMarker>
        )}
        {route.length === 2 && (
          <Polyline
            positions={route}
            pathOptions={{
              color: '#2563eb',
              weight: 4,
              opacity: 0.7,
            }}
          />
        )}
      </MapContainer>
    </div>
  );
};

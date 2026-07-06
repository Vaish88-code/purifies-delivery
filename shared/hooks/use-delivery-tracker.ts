import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Order,
  clearDeliveryTrackingDocument,
  incrementSubscriptionDeliveredCount,
  updateOrderDocument,
  upsertDeliveryTracking,
} from '@shared/lib/firebase/firestore';
import { haversineMeters } from '@shared/utils/geo';

interface UseDeliveryTrackerOptions {
  orders: Order[];
  deliveryPersonId?: string;
}

interface Coordinates {
  latitude: number;
  longitude: number;
}

interface UseDeliveryTrackerResult {
  courierLocation: Coordinates | null;
  distances: Record<string, number>;
  trackingActive: boolean;
  trackingError: string | null;
}

const DELIVERY_THRESHOLD_METERS = 50;

export const useDeliveryTracker = ({
  orders,
  deliveryPersonId,
}: UseDeliveryTrackerOptions): UseDeliveryTrackerResult => {
  const [courierLocation, setCourierLocation] = useState<Coordinates | null>(null);
  const [trackingError, setTrackingError] = useState<string | null>(null);
  const [trackingActive, setTrackingActive] = useState(false);
  const [distances, setDistances] = useState<Record<string, number>>({});

  const watchIdRef = useRef<number | null>(null);
  const completedOrdersRef = useRef<Set<string>>(new Set());
  const activeOrdersRef = useRef<Order[]>([]);

  const activeOrders = useMemo(
    () => orders.filter((order) => order.status === 'out_for_delivery'),
    [orders]
  );

  const hasActiveOrders = activeOrders.length > 0;

  useEffect(() => {
    activeOrdersRef.current = activeOrders;
  }, [activeOrders]);

  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!deliveryPersonId) {
      return;
    }

    if (hasActiveOrders && watchIdRef.current === null) {
      if (!('geolocation' in navigator)) {
        setTrackingError('Geolocation is not supported on this device.');
        return;
      }

      watchIdRef.current = navigator.geolocation.watchPosition(
        (position) => {
          const coords = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          };
          setCourierLocation(coords);
          setTrackingError(null);
          setTrackingActive(true);

          const currentOrders = activeOrdersRef.current;
          currentOrders.forEach(async (order) => {
            if (!order.id) return;
            try {
              await upsertDeliveryTracking(order.id, deliveryPersonId, coords);
            } catch (error) {
              console.error('Error updating delivery tracking', error);
            }

            if (
              typeof order.latitude !== 'number' ||
              typeof order.longitude !== 'number'
            ) {
              return;
            }

            const distance = haversineMeters(
              order.latitude,
              order.longitude,
              coords.latitude,
              coords.longitude
            );

            setDistances((prev) => ({
              ...prev,
              [order.id!]: distance,
            }));

            if (
              distance <= DELIVERY_THRESHOLD_METERS &&
              order.status !== 'delivered' &&
              !completedOrdersRef.current.has(order.id)
            ) {
              completedOrdersRef.current.add(order.id);
              try {
                await updateOrderDocument(order.id, { status: 'delivered' });
                if (order.subscriptionId) {
                  const deliveredQuantity =
                    order.items?.reduce(
                      (sum, item) => sum + (item.quantity || 0),
                      0
                    ) ?? 0;
                  if (deliveredQuantity > 0) {
                    await incrementSubscriptionDeliveredCount(
                      order.subscriptionId,
                      deliveredQuantity
                    );
                  }
                }
                await clearDeliveryTrackingDocument(order.id);
              } catch (error) {
                console.error('Error finalizing delivery automatically', error);
              }
            }
          });
        },
        (error) => {
          console.error('Geolocation watch error', error);
          setTrackingError(error.message || 'Unable to access device location.');
        },
        {
          enableHighAccuracy: true,
          maximumAge: 5000,
          timeout: 20000,
        }
      );
    } else if (!hasActiveOrders && watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
      setTrackingActive(false);
    }
  }, [deliveryPersonId, hasActiveOrders]);

  return {
    courierLocation,
    distances,
    trackingActive: trackingActive && hasActiveOrders,
    trackingError,
  };
};

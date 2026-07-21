import type { Order } from '@shared/lib/firebase/firestore';
import type { Timestamp } from 'firebase/firestore';

export function todayKey(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

/** Driver dashboard: show today's work + undelivered assignments only. */
export function isOrderForDriverDashboardToday(order: Order, today = todayKey()): boolean {
  if (['accepted', 'preparing', 'out_for_delivery'].includes(order.status)) {
    return true;
  }
  if (order.status !== 'delivered') {
    return false;
  }
  const doneAt = order.deliveredAt ?? order.updatedAt;
  if (!doneAt) return false;
  return todayKey(doneAt.toDate()) === today;
}

export function formatDurationMinutes(minutes?: number): string {
  if (minutes == null || minutes < 0) return '—';
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export function getOrderDurationMinutes(order: Order): number | undefined {
  const end = order.deliveredAt ?? (order.status === 'delivered' ? order.updatedAt : undefined);
  const start = order.deliveryStartedAt ?? order.adminAssignedAt;
  if (!end || !start) return undefined;
  return Math.max(0, Math.round((end.toMillis() - start.toMillis()) / 60000));
}

export function formatTimestamp(ts?: Timestamp): string {
  if (!ts) return '—';
  return ts.toDate().toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Same total as delivery map: You→Shop + Shop→Customer (falls back to stored distanceKm). */
export function orderTripTotalKm(order: {
  distanceKm?: number;
  driverToShopKm?: number;
  shopToCustomerKm?: number;
}): number {
  if (order.driverToShopKm != null && order.shopToCustomerKm != null) {
    return Math.round((order.driverToShopKm + order.shopToCustomerKm) * 100) / 100;
  }
  return order.distanceKm ?? 0;
}

/** Delivery record / admin Records total km — same formula as map legend. */
export function recordTotalKm(record: {
  distanceKm?: number;
  driverToShopKm?: number;
  shopToCustomerKm?: number;
}): number {
  return orderTripTotalKm(record);
}

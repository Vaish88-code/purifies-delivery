import { Order } from '@shared/lib/firebase/firestore';

/** One-time quick or scheduled orders — excludes subscription delivery runs. */
export function isQuickOrder(order: Order): boolean {
  return order.deliveryType !== 'subscription';
}

export function filterQuickOrders(orders: Order[]): Order[] {
  return orders.filter(isQuickOrder);
}

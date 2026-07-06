import type { Order } from '@shared/lib/firebase/firestore';

/**
 * Get user-friendly display status for an order.
 * When vendor assigns delivery person (status=accepted + deliveryPersonUid), show "Assigned for Delivery"
 */
export function getOrderDisplayStatus(order: Order): string {
  const status = order.status;
  
  if (status === 'accepted' && order.deliveryPersonUid) {
    return 'assigned_for_delivery';
  }
  if (status === 'preparing' && order.deliveryPersonUid) {
    return 'assigned_for_delivery';
  }
  
  return status;
}

/**
 * Get status badge styling for orders
 */
export function getStatusBadgeStyle(displayStatus: string): string {
  switch (displayStatus) {
    case 'pending':
      return 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30';
    case 'assigned_for_delivery':
      return 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30';
    case 'out_for_delivery':
      return 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/30 animate-pulse';
    case 'delivered':
      return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30';
    case 'rejected':
    case 'cancelled':
      return 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30';
    default:
      return 'bg-muted text-muted-foreground border-border';
  }
}

/**
 * Check if order can be tracked (has meaningful progress)
 */
export function isOrderTrackable(order: Order): boolean {
  return !['rejected', 'cancelled'].includes(order.status);
}

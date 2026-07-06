import { useEffect, useState } from 'react';
import { useAuth } from '@shared/contexts/AuthContext';
import {
  subscribeToOrdersByVendor,
  subscribeToSubscriptionsByVendor,
  subscribeToPaymentsByVendor,
  Order,
  Subscription,
  Payment,
} from '@shared/lib/firebase/firestore';
import { isPendingSubscriptionRequest } from '@shared/utils/subscriptionSchedule';
import { isQuickOrder } from '@shared/utils/orderFilters';

export interface VendorPendingCounts {
  pendingOrders: number;
  paymentsAwaitingApproval: number;
  subscriptionRequests: number;
  loading: boolean;
}

export function useVendorPendingCounts(): VendorPendingCounts {
  const { user } = useAuth();
  const [pendingOrders, setPendingOrders] = useState(0);
  const [paymentsAwaitingApproval, setPaymentsAwaitingApproval] = useState(0);
  const [subscriptionRequests, setSubscriptionRequests] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.id || user.role !== 'vendor') {
      setLoading(false);
      return;
    }

    let ordersReady = false;
    let subsReady = false;
    let paymentsReady = false;

    const maybeDone = () => {
      if (ordersReady && subsReady && paymentsReady) setLoading(false);
    };

    const markReady = (key: 'orders' | 'subs' | 'payments') => {
      if (key === 'orders') ordersReady = true;
      if (key === 'subs') subsReady = true;
      if (key === 'payments') paymentsReady = true;
      maybeDone();
    };

    const readyTimeout = window.setTimeout(() => setLoading(false), 12000);

    const unsubOrders = subscribeToOrdersByVendor(
      user.id,
      (orders: Order[]) => {
        setPendingOrders(
          orders.filter((o) => isQuickOrder(o) && o.status === 'pending').length
        );
        markReady('orders');
      },
      () => markReady('orders')
    );

    const unsubPayments = subscribeToPaymentsByVendor(
      user.id,
      (payments: Payment[]) => {
        setPaymentsAwaitingApproval(
          payments.filter((p) => p.status === 'PAYMENT_REQUESTED').length
        );
        markReady('payments');
      },
      () => markReady('payments')
    );

    const unsubSubs = subscribeToSubscriptionsByVendor(
      user.id,
      (subs: Subscription[]) => {
        setSubscriptionRequests(
          subs.filter(isPendingSubscriptionRequest).length
        );
        markReady('subs');
      },
      () => markReady('subs')
    );

    return () => {
      window.clearTimeout(readyTimeout);
      unsubOrders();
      unsubPayments();
      unsubSubs();
    };
  }, [user?.id, user?.role]);

  return {
    pendingOrders,
    paymentsAwaitingApproval,
    subscriptionRequests,
    loading,
  };
}

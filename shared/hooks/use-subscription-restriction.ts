import { useEffect, useMemo, useState } from 'react';
import {
  Subscription,
  SubscriptionPayment,
  subscribeToSubscriptionsByCustomer,
  subscribeToSubscriptionPaymentsByCustomer,
  computeSubscriptionStatus,
} from '@shared/lib/firebase/firestore';
import { useAuth } from '@shared/contexts/AuthContext';

const getMonthKey = (date: Date) => date.toISOString().slice(0, 7);

export const useSubscriptionRestriction = () => {
  const { user } = useAuth();
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [payments, setPayments] = useState<SubscriptionPayment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) {
      setSubscriptions([]);
      setPayments([]);
      setLoading(false);
      return;
    }
    const unsubSubs = subscribeToSubscriptionsByCustomer(user.id, (list) => {
      setSubscriptions(list);
      setLoading(false);
    });
    const unsubPayments = subscribeToSubscriptionPaymentsByCustomer(user.id, setPayments);
    return () => {
      unsubSubs();
      unsubPayments();
    };
  }, [user?.id]);

  const hasDue = useMemo(() => {
    if (!subscriptions.length) return false;
    const currentMonth = getMonthKey(new Date());
    // Only consider active, non-paused subscriptions (ignore removed/paused so customer can still order)
    const activeSubs = subscriptions.filter(
      (sub) => sub.isActive === true && (sub.isPaused === false || sub.isPaused === undefined)
    );
    if (!activeSubs.length) return false;
    return activeSubs.some((sub) => {
      const subPayments = payments.filter((p) => p.subscriptionId === sub.id);
      const latestPayment = subPayments
        .filter((p) => p.month === currentMonth)
        .sort(
          (a, b) =>
            (b.updatedAt?.toMillis?.() ?? 0) - (a.updatedAt?.toMillis?.() ?? 0)
        )[0];
      const status = computeSubscriptionStatus(sub, latestPayment || null, new Date(), subPayments);
      // Block only when payment is due. PAID or PENDING_VERIFICATION = allow orders.
      return status === 'PAYMENT_DUE';
    });
  }, [subscriptions, payments]);

  return { hasDue, loading };
};


import { Subscription } from '@shared/lib/firebase/firestore';

export const WEEKDAYS = [
  { id: 'monday', label: 'Monday', short: 'Mon' },
  { id: 'tuesday', label: 'Tuesday', short: 'Tue' },
  { id: 'wednesday', label: 'Wednesday', short: 'Wed' },
  { id: 'thursday', label: 'Thursday', short: 'Thu' },
  { id: 'friday', label: 'Friday', short: 'Fri' },
  { id: 'saturday', label: 'Saturday', short: 'Sat' },
  { id: 'sunday', label: 'Sunday', short: 'Sun' },
] as const;

export type WeekdayId = (typeof WEEKDAYS)[number]['id'];

const DAY_TO_JS: Record<WeekdayId, number> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
};

export function formatDeliveryDays(days?: string[]): string {
  if (!days?.length) return 'Not specified';
  return days
    .map((id) => WEEKDAYS.find((d) => d.id === id)?.label ?? id)
    .join(', ');
}

export function deriveFrequencyFromDeliveriesPerWeek(
  deliveriesPerWeek: number
): Subscription['frequency'] {
  if (deliveriesPerWeek >= 6) return 'daily';
  if (deliveriesPerWeek >= 4) return 'alternate';
  if (deliveriesPerWeek === 3) return 'weekly';
  if (deliveriesPerWeek === 2) return 'biweekly';
  return 'weekly';
}

export function calculateMonthlyAmountFromSchedule(
  quantity: number,
  pricePerUnit: number,
  deliveriesPerWeek: number
): { monthlyAmount: number; savings: number; deliveriesPerMonth: number } {
  const deliveriesPerMonth = deliveriesPerWeek * 4;
  const gross = quantity * pricePerUnit * deliveriesPerMonth;

  let discountPercent = 0;
  if (deliveriesPerWeek >= 6) discountPercent = 20;
  else if (deliveriesPerWeek >= 4) discountPercent = 15;
  else if (deliveriesPerWeek >= 2) discountPercent = 10;
  else discountPercent = 5;

  const savings = Math.round(gross * (discountPercent / 100));
  const monthlyAmount = gross - savings;

  return { monthlyAmount, savings, deliveriesPerMonth };
}

export function getDeliveriesPerMonth(subscription: Subscription): number {
  if (subscription.deliveriesPerWeek && subscription.deliveriesPerWeek > 0) {
    return subscription.deliveriesPerWeek * 4;
  }
  switch (subscription.frequency) {
    case 'daily':
      return 30;
    case 'alternate':
      return 15;
    case 'weekly':
      return 4;
    case 'biweekly':
      return 2;
    case 'monthly':
      return 1;
    default:
      return 4;
  }
}

/** Next calendar date matching one of the selected weekdays (ISO YYYY-MM-DD). */
export function getNextDeliveryDateFromDays(
  deliveryDaysOfWeek: string[],
  fromDate: Date = new Date()
): string {
  const jsDays = deliveryDaysOfWeek
    .map((d) => DAY_TO_JS[d as WeekdayId])
    .filter((n) => n !== undefined);

  const start = new Date(fromDate);
  start.setHours(0, 0, 0, 0);

  if (!jsDays.length) {
    const fallback = new Date(start);
    fallback.setDate(start.getDate() + 7);
    return fallback.toISOString().split('T')[0];
  }

  for (let offset = 1; offset <= 21; offset++) {
    const candidate = new Date(start);
    candidate.setDate(start.getDate() + offset);
    if (jsDays.includes(candidate.getDay())) {
      return candidate.toISOString().split('T')[0];
    }
  }

  const fallback = new Date(start);
  fallback.setDate(start.getDate() + 7);
  return fallback.toISOString().split('T')[0];
}

/** Advance to the next delivery day after a completed delivery. */
export function advanceNextDeliveryDate(
  subscription: Subscription,
  afterDate: Date = new Date()
): string {
  const days = subscription.deliveryDaysOfWeek;
  if (days?.length) {
    const from = new Date(afterDate);
    from.setDate(from.getDate() + 1);
    return getNextDeliveryDateFromDays(days, from);
  }

  const next = new Date(afterDate);
  next.setHours(0, 0, 0, 0);
  switch (subscription.frequency) {
    case 'daily':
      next.setDate(next.getDate() + 1);
      break;
    case 'alternate':
      next.setDate(next.getDate() + 2);
      break;
    case 'weekly':
      next.setDate(next.getDate() + 7);
      break;
    case 'biweekly':
      next.setDate(next.getDate() + 14);
      break;
    case 'monthly':
      next.setMonth(next.getMonth() + 1);
      break;
    default:
      next.setDate(next.getDate() + 7);
  }
  return next.toISOString().split('T')[0];
}

export function jarTypeToSubscription(jar: '20L' | '10L' | 'bottles'): Subscription['jarType'] {
  if (jar === '20L') return 'jar20L';
  if (jar === '10L') return 'jar10L';
  return 'bottles';
}

export function isPendingSubscriptionRequest(sub: Subscription): boolean {
  if (sub.vendorApprovalStatus === 'pending') return true;
  if (sub.vendorApprovalStatus === 'approved' || sub.vendorApprovalStatus === 'rejected') return false;
  return sub.isActive === false && sub.isPaused !== true && sub.billingPaid !== true;
}

/** Active subscription approved by vendor and ready for scheduled deliveries. */
export function isActiveApprovedSubscription(sub: Subscription): boolean {
  if (sub.isActive !== true || sub.isPaused === true) return false;
  if (sub.vendorApprovalStatus === 'pending' || sub.vendorApprovalStatus === 'rejected') return false;
  return true;
}

/**
 * Count jars delivered this calendar month for one subscription.
 * - Only orders linked by subscriptionId (never legacy customer/vendor matching)
 * - Only status === 'delivered' (approve / assign does NOT count)
 * - Only orders on or after subscription startDate (approval date)
 */
export function getSubscriptionJarStats(
  subscription: Subscription,
  orders: Array<{ subscriptionId?: string; status?: string; createdAt?: { toDate: () => Date }; items?: Array<{ quantity?: number }> }>
): { deliveredJars: number; expectedJars: number } {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();

  const countFrom = subscription.startDate
    ? new Date(`${subscription.startDate}T00:00:00`)
    : null;

  let deliveredJars = 0;

  for (const order of orders) {
    if (!subscription.id || order.subscriptionId !== subscription.id) continue;
    if (order.status !== 'delivered') continue;
    if (!order.createdAt) continue;

    const created = order.createdAt.toDate();
    if (created.getFullYear() !== currentYear || created.getMonth() !== currentMonth) continue;
    if (countFrom && created < countFrom) continue;

    deliveredJars +=
      order.items?.reduce((sum, item) => sum + (item.quantity || 0), 0) ?? 0;
  }

  const expectedJars = getDeliveriesPerMonth(subscription) * (subscription.quantity || 0);
  return { deliveredJars, expectedJars };
}

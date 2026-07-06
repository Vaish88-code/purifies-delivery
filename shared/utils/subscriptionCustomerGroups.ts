import { Order, Subscription } from '@shared/lib/firebase/firestore';
import { isActiveApprovedSubscription } from '@shared/utils/subscriptionSchedule';

function normalizeText(value?: string): string {
  return (value ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function normalizePhone(phone?: string): string {
  return (phone ?? '').replace(/\D/g, '');
}

/** Stable key for the same person (uid preferred, else name + phone + address). */
export function getSubscriptionCustomerKey(sub: Subscription): string {
  const uid = sub.customerUid?.trim();
  if (uid) return `uid:${uid}`;

  const phone = normalizePhone(sub.customerPhone);
  const name = normalizeText(sub.customerName);
  const address = normalizeText(sub.customerAddress);
  const pincode = (sub.customerPincode ?? '').trim();
  return `profile:${phone}|${name}|${address}|${pincode}`;
}

export type SubscriptionRecordStatus = 'active' | 'ended' | 'rejected';

export function getSubscriptionRecordStatus(sub: Subscription): SubscriptionRecordStatus {
  if (sub.vendorApprovalStatus === 'rejected') return 'rejected';
  if (isActiveApprovedSubscription(sub)) return 'active';
  return 'ended';
}

export interface SubscriptionCustomerGroup {
  key: string;
  customerUid?: string;
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  customerPincode?: string;
  subscriptions: Subscription[];
  subscriptionCount: number;
  activeCount: number;
  totalPaid: number;
  overallStatus: SubscriptionRecordStatus;
  latestActivityMs: number;
}

export function groupSubscriptionsByCustomer(
  subscriptions: Subscription[],
  paidBySubscriptionId: Record<string, number>
): SubscriptionCustomerGroup[] {
  const map = new Map<string, Subscription[]>();

  for (const sub of subscriptions) {
    const key = getSubscriptionCustomerKey(sub);
    const list = map.get(key) ?? [];
    list.push(sub);
    map.set(key, list);
  }

  const groups: SubscriptionCustomerGroup[] = [];

  for (const [key, subs] of map.entries()) {
    const sorted = [...subs].sort(
      (a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0)
    );
    const primary = sorted[0];
    const activeCount = sorted.filter((s) => getSubscriptionRecordStatus(s) === 'active').length;
    const statuses = sorted.map(getSubscriptionRecordStatus);
    const overallStatus: SubscriptionRecordStatus = activeCount > 0
      ? 'active'
      : statuses.every((s) => s === 'rejected')
      ? 'rejected'
      : 'ended';

    const totalPaid = sorted.reduce(
      (sum, s) => sum + (s.id ? paidBySubscriptionId[s.id] || 0 : 0),
      0
    );

    groups.push({
      key,
      customerUid: primary.customerUid?.trim() || undefined,
      customerName: primary.customerName,
      customerPhone: primary.customerPhone,
      customerAddress: primary.customerAddress,
      customerPincode: primary.customerPincode,
      subscriptions: sorted,
      subscriptionCount: sorted.length,
      activeCount,
      totalPaid,
      overallStatus,
      latestActivityMs: sorted[0]?.createdAt?.toMillis?.() ?? 0,
    });
  }

  return groups.sort((a, b) => b.latestActivityMs - a.latestActivityMs);
}

export function orderBelongsToCustomerGroup(order: Order, group: SubscriptionCustomerGroup): boolean {
  const subscriptionDocIds = new Set(
    group.subscriptions.map((s) => s.id).filter(Boolean) as string[]
  );

  if (order.subscriptionId && subscriptionDocIds.has(order.subscriptionId)) {
    return true;
  }

  if (group.customerUid && order.customerUid === group.customerUid) {
    return order.deliveryType === 'subscription';
  }

  const samePhone = normalizePhone(order.customerPhone) === normalizePhone(group.customerPhone);
  const sameName = normalizeText(order.customerName) === normalizeText(group.customerName);
  const sameAddress = normalizeText(order.customerAddress) === normalizeText(group.customerAddress);

  return order.deliveryType === 'subscription' && samePhone && sameName && sameAddress;
}

export function getCustomerSubscriptionOrders(orders: Order[], group: SubscriptionCustomerGroup): Order[] {
  return orders
    .filter((o) => orderBelongsToCustomerGroup(o, group))
    .sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0));
}

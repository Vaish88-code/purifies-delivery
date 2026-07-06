import { Order, Subscription, SubscriptionPayment } from '@shared/lib/firebase/firestore';
import { filterQuickOrders, isQuickOrder } from '@shared/utils/orderFilters';
import { getSubscriptionCustomerKey, getSubscriptionRecordStatus } from '@shared/utils/subscriptionCustomerGroups';
import { isPendingSubscriptionRequest } from '@shared/utils/subscriptionSchedule';

function normalizeText(value?: string): string {
  return (value ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function normalizePhone(phone?: string): string {
  return (phone ?? '').replace(/\D/g, '');
}

export function getOrderCustomerKey(order: Order): string {
  const uid = order.customerUid?.trim();
  if (uid) return `uid:${uid}`;
  return `profile:${normalizePhone(order.customerPhone)}|${normalizeText(order.customerName)}`;
}

export interface VendorAnalyticsReport {
  earnings: {
    today: number;
    thisWeek: number;
    thisMonth: number;
    allTime: number;
    pending: number;
    quickOrders: number;
    subscriptionPayments: number;
  };
  orders: {
    total: number;
    quickTotal: number;
    subscriptionDeliveries: number;
    delivered: number;
    quickDelivered: number;
    pending: number;
    cancelled: number;
    avgQuickOrderValue: number;
  };
  customers: {
    totalUnique: number;
    quickOrderUsers: number;
    subscriptionUsers: number;
    bothChannels: number;
    activeSubscriptionUsers: number;
  };
  revenueBySource: { name: string; key: string; value: number; fill: string }[];
  customersByType: { name: string; key: string; value: number; fill: string }[];
  orderTypeBreakdown: { name: string; key: string; value: number; fill: string }[];
  jarTypeBreakdown: { name: string; key: string; value: number; fill: string }[];
  weeklyEarnings: { day: string; amount: number; orders: number }[];
  monthlyEarnings: { month: string; label: string; amount: number; quick: number; subscription: number }[];
  insights: string[];
}

const CHART_COLORS = {
  quickOrders: 'hsl(201 90% 42%)',
  subscriptions: 'hsl(192 91% 38%)',
  pending: 'hsl(38 92% 50%)',
  quickOnly: 'hsl(201 90% 42%)',
  subscriptionOnly: 'hsl(142 71% 45%)',
  both: 'hsl(262 83% 58%)',
  today: 'hsl(24 95% 53%)',
  schedule: 'hsl(201 90% 42%)',
  subscriptionDelivery: 'hsl(142 71% 45%)',
  jar20L: 'hsl(201 90% 42%)',
  jar10L: 'hsl(192 91% 38%)',
  bottles: 'hsl(142 71% 45%)',
};

function sumDeliveredRevenue(list: Order[]): number {
  return list.filter((o) => o.status === 'delivered').reduce((s, o) => s + (o.total || 0), 0);
}

function sumSubscriptionPayments(payments: SubscriptionPayment[]): number {
  return payments
    .filter((p) => p.status === 'PAID' || p.status === 'SUCCESS')
    .reduce((s, p) => s + (p.amount || 0), 0);
}

export function buildVendorAnalyticsReport(
  orders: Order[],
  subscriptions: Subscription[],
  subscriptionPayments: SubscriptionPayment[]
): VendorAnalyticsReport {
  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);

  const weekStart = new Date(todayStart);
  const dayOfWeek = todayStart.getDay();
  weekStart.setDate(todayStart.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1));
  weekStart.setHours(0, 0, 0, 0);

  const monthStart = new Date(todayStart.getFullYear(), todayStart.getMonth(), 1);

  const quickOrders = filterQuickOrders(orders);
  const subscriptionDeliveries = orders.filter((o) => o.deliveryType === 'subscription');
  const deliveredOrders = orders.filter((o) => o.status === 'delivered');
  const deliveredQuick = quickOrders.filter((o) => o.status === 'delivered');
  const pendingOrders = orders.filter(
    (o) => o.status === 'pending' || o.status === 'accepted' || o.status === 'preparing' || o.status === 'out_for_delivery'
  );

  const quickRevenue = sumDeliveredRevenue(quickOrders);
  const subscriptionDeliveryRevenue = sumDeliveredRevenue(subscriptionDeliveries);
  const subscriptionPaymentRevenue = sumSubscriptionPayments(subscriptionPayments);
  const subscriptionRevenue = subscriptionPaymentRevenue + subscriptionDeliveryRevenue;
  const allTimeRevenue = quickRevenue + subscriptionRevenue;

  const filterByDate = (list: Order[], from: Date) =>
    list.filter((o) => {
      const d = o.createdAt?.toDate();
      if (!d) return false;
      d.setHours(0, 0, 0, 0);
      return d >= from;
    });

  const todayDelivered = filterByDate(deliveredOrders, todayStart);
  const weekDelivered = filterByDate(deliveredOrders, weekStart);
  const monthDelivered = filterByDate(deliveredOrders, monthStart);

  const todaySubPayments = subscriptionPayments.filter((p) => {
    const d = p.createdAt?.toDate();
    if (!d || (p.status !== 'PAID' && p.status !== 'SUCCESS')) return false;
    d.setHours(0, 0, 0, 0);
    return d.getTime() === todayStart.getTime();
  });
  const weekSubPayments = subscriptionPayments.filter((p) => {
    const d = p.createdAt?.toDate();
    if (!d || (p.status !== 'PAID' && p.status !== 'SUCCESS')) return false;
    d.setHours(0, 0, 0, 0);
    return d >= weekStart;
  });
  const monthSubPayments = subscriptionPayments.filter((p) => {
    const d = p.createdAt?.toDate();
    if (!d || (p.status !== 'PAID' && p.status !== 'SUCCESS')) return false;
    d.setHours(0, 0, 0, 0);
    return d >= monthStart;
  });

  const todayEarnings =
    todayDelivered.reduce((s, o) => s + o.total, 0) +
    todaySubPayments.reduce((s, p) => s + p.amount, 0);
  const weekEarnings =
    weekDelivered.reduce((s, o) => s + o.total, 0) +
    weekSubPayments.reduce((s, p) => s + p.amount, 0);
  const monthEarnings =
    monthDelivered.reduce((s, o) => s + o.total, 0) +
    monthSubPayments.reduce((s, p) => s + p.amount, 0);

  const pendingEarnings = pendingOrders.reduce((s, o) => s + (o.total || 0), 0);

  const quickCustomerKeys = new Set<string>();
  for (const o of quickOrders) {
    if (o.status === 'delivered' || o.status === 'accepted' || o.status === 'out_for_delivery' || o.status === 'preparing' || o.status === 'pending') {
      quickCustomerKeys.add(getOrderCustomerKey(o));
    }
  }

  const subscriptionRecords = subscriptions.filter((s) => !isPendingSubscriptionRequest(s));
  const subscriptionCustomerKeys = new Set(subscriptionRecords.map(getSubscriptionCustomerKey));
  const activeSubscriptionUsers = subscriptionRecords.filter(
    (s) => getSubscriptionRecordStatus(s) === 'active'
  ).length;

  let bothChannels = 0;
  for (const key of quickCustomerKeys) {
    if (subscriptionCustomerKeys.has(key)) bothChannels++;
  }
  const quickOnlyUsers = quickCustomerKeys.size - bothChannels;
  const subscriptionOnlyUsers = subscriptionCustomerKeys.size - bothChannels;
  const allCustomerKeys = new Set([...quickCustomerKeys, ...subscriptionCustomerKeys]);

  const todayTypeCount = orders.filter((o) => o.deliveryType === 'today').length;
  const scheduleTypeCount = orders.filter((o) => o.deliveryType === 'schedule').length;
  const subTypeCount = subscriptionDeliveries.length;

  const jarCounts = { jar20L: 0, jar10L: 0, bottles: 0 };
  for (const o of deliveredOrders) {
    for (const item of o.items || []) {
      if (item.jarType === '20L') jarCounts.jar20L += item.quantity;
      else if (item.jarType === '10L') jarCounts.jar10L += item.quantity;
      else jarCounts.bottles += item.quantity;
    }
  }

  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const weeklyEarnings = days.map((day, index) => {
    const dayDate = new Date(weekStart);
    dayDate.setDate(weekStart.getDate() + index);
    dayDate.setHours(0, 0, 0, 0);
    const nextDay = new Date(dayDate);
    nextDay.setDate(dayDate.getDate() + 1);

    const dayOrders = deliveredOrders.filter((o) => {
      const d = o.createdAt?.toDate();
      if (!d) return false;
      return d >= dayDate && d < nextDay;
    });
    const dayPay = subscriptionPayments.filter((p) => {
      const d = p.createdAt?.toDate();
      if (!d || (p.status !== 'PAID' && p.status !== 'SUCCESS')) return false;
      return d >= dayDate && d < nextDay;
    });

    const amount =
      dayOrders.reduce((s, o) => s + o.total, 0) + dayPay.reduce((s, p) => s + p.amount, 0);

    return { day, amount, orders: dayOrders.length };
  });

  const monthlyEarnings: VendorAnalyticsReport['monthlyEarnings'] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(todayStart.getFullYear(), todayStart.getMonth() - i, 1);
    const next = new Date(d.getFullYear(), d.getMonth() + 1, 1);
    const label = d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
    const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

    const monthOrds = deliveredOrders.filter((o) => {
      const created = o.createdAt?.toDate();
      return created && created >= d && created < next;
    });
    const monthQuick = monthOrds.filter(isQuickOrder).reduce((s, o) => s + o.total, 0);
    const monthSubPay = subscriptionPayments
      .filter((p) => {
        if (p.status !== 'PAID' && p.status !== 'SUCCESS') return false;
        const created = p.createdAt?.toDate();
        return created && created >= d && created < next;
      })
      .reduce((s, p) => s + p.amount, 0);
    const monthSubDel = monthOrds
      .filter((o) => o.deliveryType === 'subscription')
      .reduce((s, o) => s + o.total, 0);

    monthlyEarnings.push({
      month: monthKey,
      label,
      amount: monthQuick + monthSubPay + monthSubDel,
      quick: monthQuick,
      subscription: monthSubPay + monthSubDel,
    });
  }

  const revenueBySource = [
    { name: 'Quick Orders', key: 'quickOrders', value: quickRevenue, fill: CHART_COLORS.quickOrders },
    { name: 'Subscriptions', key: 'subscriptions', value: subscriptionRevenue, fill: CHART_COLORS.subscriptions },
  ].filter((x) => x.value > 0);

  const customersByType = [
    { name: 'Quick order only', key: 'quickOnly', value: quickOnlyUsers, fill: CHART_COLORS.quickOnly },
    { name: 'Subscription only', key: 'subscriptionOnly', value: subscriptionOnlyUsers, fill: CHART_COLORS.subscriptionOnly },
    { name: 'Both channels', key: 'both', value: bothChannels, fill: CHART_COLORS.both },
  ].filter((x) => x.value > 0);

  const orderTypeBreakdown = [
    { name: 'Today delivery', key: 'today', value: todayTypeCount, fill: CHART_COLORS.today },
    { name: 'Scheduled', key: 'schedule', value: scheduleTypeCount, fill: CHART_COLORS.schedule },
    { name: 'Subscription runs', key: 'subscriptionDelivery', value: subTypeCount, fill: CHART_COLORS.subscriptionDelivery },
  ].filter((x) => x.value > 0);

  const jarTypeBreakdown = [
    { name: '20L Jars', key: 'jar20L', value: jarCounts.jar20L, fill: CHART_COLORS.jar20L },
    { name: '10L Jars', key: 'jar10L', value: jarCounts.jar10L, fill: CHART_COLORS.jar10L },
    { name: 'Bottle packs', key: 'bottles', value: jarCounts.bottles, fill: CHART_COLORS.bottles },
  ].filter((x) => x.value > 0);

  const quickShare = allTimeRevenue > 0 ? Math.round((quickRevenue / allTimeRevenue) * 100) : 0;
  const subShare = allTimeRevenue > 0 ? Math.round((subscriptionRevenue / allTimeRevenue) * 100) : 0;
  const avgQuick = deliveredQuick.length > 0 ? Math.round(quickRevenue / deliveredQuick.length) : 0;

  const insights: string[] = [
    `Total revenue to date: ₹${allTimeRevenue.toLocaleString()} (${quickShare}% quick orders, ${subShare}% subscriptions).`,
    `${allCustomerKeys.size} unique customer${allCustomerKeys.size !== 1 ? 's' : ''} have ordered from your shop — ${quickCustomerKeys.size} via quick orders, ${subscriptionCustomerKeys.size} via subscriptions.`,
    bothChannels > 0
      ? `${bothChannels} customer${bothChannels !== 1 ? 's' : ''} use both quick orders and subscriptions — strong loyalty signal.`
      : 'No customers yet using both quick orders and subscriptions — consider promoting subscriptions to repeat buyers.',
    `${activeSubscriptionUsers} active subscription customer${activeSubscriptionUsers !== 1 ? 's' : ''} currently on your plan.`,
    deliveredQuick.length > 0
      ? `Average quick order value: ₹${avgQuick.toLocaleString()} across ${deliveredQuick.length} delivered order${deliveredQuick.length !== 1 ? 's' : ''}.`
      : 'No delivered quick orders yet — earnings will appear once orders are completed.',
    pendingOrders.length > 0
      ? `₹${pendingEarnings.toLocaleString()} in pending pipeline from ${pendingOrders.length} in-progress order${pendingOrders.length !== 1 ? 's' : ''}.`
      : 'No pending orders in pipeline right now.',
    monthEarnings > weekEarnings
      ? `This month (₹${monthEarnings.toLocaleString()}) is tracking above this week (₹${weekEarnings.toLocaleString()}).`
      : `This week earned ₹${weekEarnings.toLocaleString()}; month-to-date is ₹${monthEarnings.toLocaleString()}.`,
  ];

  return {
    earnings: {
      today: todayEarnings,
      thisWeek: weekEarnings,
      thisMonth: monthEarnings,
      allTime: allTimeRevenue,
      pending: pendingEarnings,
      quickOrders: quickRevenue,
      subscriptionPayments: subscriptionRevenue,
    },
    orders: {
      total: orders.length,
      quickTotal: quickOrders.length,
      subscriptionDeliveries: subscriptionDeliveries.length,
      delivered: deliveredOrders.length,
      quickDelivered: deliveredQuick.length,
      pending: pendingOrders.length,
      cancelled: orders.filter((o) => o.status === 'cancelled' || o.status === 'rejected').length,
      avgQuickOrderValue: avgQuick,
    },
    customers: {
      totalUnique: allCustomerKeys.size,
      quickOrderUsers: quickCustomerKeys.size,
      subscriptionUsers: subscriptionCustomerKeys.size,
      bothChannels,
      activeSubscriptionUsers,
    },
    revenueBySource,
    customersByType,
    orderTypeBreakdown,
    jarTypeBreakdown,
    weeklyEarnings,
    monthlyEarnings,
    insights,
  };
}

export function formatAnalyticsReportText(report: VendorAnalyticsReport, shopName?: string): string {
  const lines = [
    'PURIFIES — VENDOR ANALYTICS REPORT',
    shopName ? `Shop: ${shopName}` : '',
    `Generated: ${new Date().toLocaleString()}`,
    '',
    '--- EARNINGS ---',
    `Today: ₹${report.earnings.today.toLocaleString()}`,
    `This week: ₹${report.earnings.thisWeek.toLocaleString()}`,
    `This month: ₹${report.earnings.thisMonth.toLocaleString()}`,
    `All time: ₹${report.earnings.allTime.toLocaleString()}`,
    `Quick orders: ₹${report.earnings.quickOrders.toLocaleString()}`,
    `Subscriptions: ₹${report.earnings.subscriptionPayments.toLocaleString()}`,
    `Pending pipeline: ₹${report.earnings.pending.toLocaleString()}`,
    '',
    '--- ORDERS ---',
    `Total orders: ${report.orders.total}`,
    `Quick orders: ${report.orders.quickTotal} (${report.orders.quickDelivered} delivered)`,
    `Subscription deliveries: ${report.orders.subscriptionDeliveries}`,
    `Avg quick order value: ₹${report.orders.avgQuickOrderValue.toLocaleString()}`,
    '',
    '--- CUSTOMERS ---',
    `Unique customers: ${report.customers.totalUnique}`,
    `Quick order users: ${report.customers.quickOrderUsers}`,
    `Subscription users: ${report.customers.subscriptionUsers}`,
    `Using both channels: ${report.customers.bothChannels}`,
    `Active subscribers: ${report.customers.activeSubscriptionUsers}`,
    '',
    '--- INSIGHTS ---',
    ...report.insights.map((i, idx) => `${idx + 1}. ${i}`),
  ];
  return lines.filter(Boolean).join('\n');
}

export { CHART_COLORS };

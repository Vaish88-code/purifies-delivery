/**
 * Purifies platform fee, commission, and driver incentive configuration.
 * Razorpay Route / Cashfree EasySplit should mirror these splits at checkout.
 */

export type DriverTierName = 'bronze' | 'silver' | 'gold' | 'diamond';

export const PLATFORM_FEES = {
  baseCommissionPercent: 10,
  newVendorFreeMonths: 3,
  graduatedCommission: [
    { monthsOnPlatform: 0, percent: 0 },
    { monthsOnPlatform: 3, percent: 5 },
    { monthsOnPlatform: 6, percent: 8 },
    { monthsOnPlatform: 12, percent: 10 },
  ],
  volumeDiscountTiers: [
    { minMonthlyOrders: 500, commissionReduction: 5, minimumPercent: 5 },
    { minMonthlyOrders: 250, commissionReduction: 4, minimumPercent: 5 },
    { minMonthlyOrders: 100, commissionReduction: 2, minimumPercent: 5 },
  ],
  todayDeliveryFee: 20,
  driverPay: {
    basePay: 25,
    perJarRate: 5,
    perKmRate: 7,
    waitTimePerMin: 2,
    waitTimeFreeMinutes: 5,
    peakMultiplierMax: 2.0,
    rainBonus: 20,
    extremeHeatBonus: 15,
    deliveryFeeShare: 1,
    tipShare: 1,
  },
  driverIncentives: {
    dailyMinimumGuarantee: 500,
    dailyMinimumOrderThreshold: 8,
    streakBonus: 50,
    streakOrderCount: 5,
    dailyCompletionBonus: 100,
    dailyCompletionThreshold: 15,
    loginBonus: 20,
    loginBonusWindowMinutes: 30,
    weeklyMilestoneDeliveries: 10,
    weeklyMilestoneBonus: 500,
  },
  surgeHoursStart: 20,
  surgeHoursEnd: 22,
  surgeBonusPerDelivery: 50,
  driverTiers: [
    { name: 'bronze' as const, minOrders: 0, payBoost: 0, payoutFrequency: 'monthly' as const },
    { name: 'silver' as const, minOrders: 50, payBoost: 5, payoutFrequency: 'weekly' as const },
    { name: 'gold' as const, minOrders: 100, payBoost: 10, payoutFrequency: 'weekly' as const },
    { name: 'diamond' as const, minOrders: 200, payBoost: 15, payoutFrequency: 'daily' as const },
  ],
  instantWithdrawal: {
    minimumAmount: 100,
    autoPayoutThreshold: 500,
  },
  /** @deprecated use driverPay.basePay */
  driverBaseFeePerDelivery: 25,
  driverDeliveryFeeShare: 1,
  driverTipShare: 1,
  weeklyMilestoneDeliveries: 10,
  weeklyMilestoneBonus: 500,
} as const;

export interface OrderFeeSplit {
  subtotal: number;
  deliveryFee: number;
  tip: number;
  total: number;
  commissionPercent: number;
  platformCommission: number;
  vendorAmount: number;
  driverBaseFee: number;
  driverDistanceFee: number;
  driverDeliveryShare: number;
  driverTip: number;
  driverSurgeBonus: number;
  driverTierBoost: number;
  driverTotalEarnings: number;
  platformRevenue: number;
  distanceKm: number;
}

export function getDriverTier(monthlyOrderCount: number) {
  const tiers = [...PLATFORM_FEES.driverTiers].reverse();
  return tiers.find((t) => monthlyOrderCount >= t.minOrders) ?? PLATFORM_FEES.driverTiers[0];
}

export function getVendorCommissionPercent(
  monthsOnPlatform: number,
  monthlyDeliveredOrders: number = 0
): number {
  let percent = PLATFORM_FEES.baseCommissionPercent;
  for (const tier of [...PLATFORM_FEES.graduatedCommission].reverse()) {
    if (monthsOnPlatform >= tier.monthsOnPlatform) {
      percent = tier.percent;
      break;
    }
  }
  for (const vol of PLATFORM_FEES.volumeDiscountTiers) {
    if (monthlyDeliveredOrders >= vol.minMonthlyOrders) {
      percent = Math.max(vol.minimumPercent, percent - vol.commissionReduction);
      break;
    }
  }
  return percent;
}

/** @deprecated use getVendorCommissionPercent */
export function getCommissionPercentForVolume(monthlyDeliveredOrders: number): number {
  return getVendorCommissionPercent(12, monthlyDeliveredOrders);
}

export function isSurgeHour(date: Date = new Date()): boolean {
  const hour = date.getHours();
  return hour >= PLATFORM_FEES.surgeHoursStart && hour < PLATFORM_FEES.surgeHoursEnd;
}

export function calculateDriverDistanceFee(distanceKm: number): number {
  return Math.round(Math.max(0, distanceKm) * PLATFORM_FEES.driverPay.perKmRate);
}

/** Admin assignment pay: base + distance + per jar delivered */
export function calculateDriverPayForDelivery(jarCount: number, distanceKm: number): {
  basePay: number;
  distanceFee: number;
  jarFee: number;
  total: number;
  distanceKm: number;
  jarCount: number;
} {
  const jars = Math.max(0, jarCount);
  const km = Math.max(0, distanceKm);
  const basePay = PLATFORM_FEES.driverPay.basePay;
  const distanceFee = calculateDriverDistanceFee(km);
  const jarFee = jars * PLATFORM_FEES.driverPay.perJarRate;
  return {
    basePay,
    distanceFee,
    jarFee,
    total: basePay + distanceFee + jarFee,
    distanceKm: km,
    jarCount: jars,
  };
}

export function countJarsInOrder(
  items: { jarType: string; quantity: number }[] = []
): number {
  return items.reduce((sum, item) => sum + (item.quantity || 0), 0);
}

export function calculateOrderFeeSplit(
  subtotal: number,
  deliveryFee: number,
  tip: number,
  commissionPercent: number = PLATFORM_FEES.baseCommissionPercent,
  options?: {
    applySurgeBonus?: boolean;
    distanceKm?: number;
    driverMonthlyOrders?: number;
    peakMultiplier?: number;
  }
): OrderFeeSplit {
  const distanceKm = options?.distanceKm ?? 0;
  const tier = getDriverTier(options?.driverMonthlyOrders ?? 0);
  const peakMultiplier = Math.min(
    options?.peakMultiplier ?? (isSurgeHour() ? 1.5 : 1),
    PLATFORM_FEES.driverPay.peakMultiplierMax
  );

  const platformCommission = Math.round((subtotal * commissionPercent) / 100);
  const vendorAmount = subtotal - platformCommission;

  const baseBeforeBoost = PLATFORM_FEES.driverPay.basePay;
  const tierBoostAmount = Math.round((baseBeforeBoost * tier.payBoost) / 100);
  const distanceFee = calculateDriverDistanceFee(distanceKm);
  const driverDeliveryShare = Math.round(deliveryFee * PLATFORM_FEES.driverPay.deliveryFeeShare);
  const driverTip = Math.round(tip * PLATFORM_FEES.driverPay.tipShare);
  const surgeBonus =
    options?.applySurgeBonus && isSurgeHour() ? PLATFORM_FEES.surgeBonusPerDelivery : 0;

  const rawDriverPay = baseBeforeBoost + tierBoostAmount + distanceFee + driverDeliveryShare + driverTip + surgeBonus;
  const driverTotalEarnings = Math.round(rawDriverPay * peakMultiplier);
  const platformDeliveryKeep = deliveryFee - driverDeliveryShare;
  const platformRevenue = platformCommission + platformDeliveryKeep;

  return {
    subtotal,
    deliveryFee,
    tip,
    total: subtotal + deliveryFee + tip,
    commissionPercent,
    platformCommission,
    vendorAmount,
    driverBaseFee: baseBeforeBoost + tierBoostAmount,
    driverDistanceFee: distanceFee,
    driverDeliveryShare,
    driverTip,
    driverSurgeBonus: surgeBonus,
    driverTierBoost: tierBoostAmount,
    driverTotalEarnings,
    platformRevenue,
    distanceKm,
  };
}

export interface VendorEarningsSummary {
  grossSales: number;
  platformCommission: number;
  netVendorEarnings: number;
  orderCount: number;
  commissionPercent: number;
}

export function summarizeVendorEarnings(
  orders: {
    status: string;
    subtotal?: number;
    vendorAmount?: number;
    platformCommission?: number;
    total?: number;
  }[],
  monthlyDeliveredCount: number,
  vendorMonthsOnPlatform: number = 12
): VendorEarningsSummary {
  const delivered = orders.filter((o) => o.status === 'delivered');
  const grossSales = delivered.reduce((s, o) => s + (o.subtotal ?? o.total ?? 0), 0);
  const platformCommission = delivered.reduce(
    (s, o) =>
      s + (o.platformCommission ?? Math.round(((o.subtotal ?? 0) * PLATFORM_FEES.baseCommissionPercent) / 100)),
    0
  );
  const netVendorEarnings = delivered.reduce(
    (s, o) => s + (o.vendorAmount ?? (o.subtotal ?? 0) - (o.platformCommission ?? 0)),
    0
  );
  return {
    grossSales,
    platformCommission,
    netVendorEarnings,
    orderCount: delivered.length,
    commissionPercent: getVendorCommissionPercent(vendorMonthsOnPlatform, monthlyDeliveredCount),
  };
}

export interface DriverEarningsSummary {
  todayEarnings: number;
  weekEarnings: number;
  pendingBalance: number;
  totalEarnings: number;
  deliveryCount: number;
  weekDeliveryCount: number;
  tier: (typeof PLATFORM_FEES.driverTiers)[number];
  ordersToNextTier: number;
}

export function summarizeDriverEarnings(
  payouts: {
    amount: number;
    status: string;
    paidAt?: { toDate?: () => Date };
    createdAt?: { toDate?: () => Date };
  }[],
  walletBalance: number = 0,
  totalEarnings: number = 0,
  monthlyOrderCount: number = 0
): DriverEarningsSummary {
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfWeek = new Date(startOfDay);
  startOfWeek.setDate(startOfWeek.getDate() - startOfDay.getDay());

  const getDate = (p: (typeof payouts)[0]) =>
    p.paidAt?.toDate?.() ?? p.createdAt?.toDate?.() ?? new Date(0);

  const completed = payouts.filter(
    (p) => p.amount > 0 && (p.status === 'completed' || p.status === 'paid')
  );
  const todayEarnings = completed
    .filter((p) => getDate(p) >= startOfDay)
    .reduce((s, p) => s + p.amount, 0);
  const weekEarnings = completed
    .filter((p) => getDate(p) >= startOfWeek)
    .reduce((s, p) => s + p.amount, 0);
  const weekDeliveryCount = completed.filter((p) => getDate(p) >= startOfWeek).length;
  const pendingBalance =
    walletBalance || payouts.filter((p) => p.status === 'pending').reduce((s, p) => s + p.amount, 0);

  const tier = getDriverTier(monthlyOrderCount);
  const tierIndex = PLATFORM_FEES.driverTiers.findIndex((t) => t.name === tier.name);
  const nextTier = PLATFORM_FEES.driverTiers[tierIndex + 1];
  const ordersToNextTier = nextTier ? Math.max(0, nextTier.minOrders - monthlyOrderCount) : 0;

  return {
    todayEarnings,
    weekEarnings,
    pendingBalance,
    totalEarnings: totalEarnings || completed.reduce((s, p) => s + p.amount, 0),
    deliveryCount: completed.length,
    weekDeliveryCount,
    tier,
    ordersToNextTier,
  };
}

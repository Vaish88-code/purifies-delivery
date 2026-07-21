import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  IndianRupee,
  TrendingUp,
  ArrowLeft,
  Truck,
  Gift,
  Clock,
  Loader2,
  CheckCircle2,
  BarChart3,
  Calendar,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';
import { Button } from '@shared/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@shared/components/ui/card';
import { Logo } from '@shared/components/Logo';
import { LanguageSelector } from '@shared/components/LanguageSelector';
import { useAuth, useTranslation } from '@shared/contexts/AuthContext';
import {
  DriverDailyPayout,
  subscribeToDriverDailyPayoutsForDriver,
  getUserDocument,
  getOrdersByDeliveryPerson,
  finalizeDriverEarningsForOrder,
} from '@shared/lib/firebase/firestore';
import {
  PLATFORM_FEES,
} from '@shared/utils/platformFees';
import { format, subDays, startOfWeek, endOfWeek, isWithinInterval, parseISO, isToday, startOfMonth, endOfMonth } from 'date-fns';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
} from 'recharts';

export default function DeliveryEarnings() {
  const { user } = useAuth();
  const t = useTranslation();
  const [dailyPayouts, setDailyPayouts] = useState<DriverDailyPayout[]>([]);
  const [totalEarnings, setTotalEarnings] = useState(0);
  const [monthlyOrderCount, setMonthlyOrderCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) {
      setLoading(false);
      return;
    }

    getUserDocument(user.id).then((doc) => {
      if (doc) {
        setTotalEarnings(doc.totalEarnings ?? 0);
        setMonthlyOrderCount(doc.monthlyOrderCount ?? doc.lifetimeDeliveries ?? 0);
      }
    });

    // Backfill earnings for deliveries finalized before payout rules were fixed
    getOrdersByDeliveryPerson(user.id)
      .then(async (orders) => {
        const pending = orders.filter(
          (o) => o.id && o.status === 'delivered' && !o.driverEarningsFinalized
        );
        await Promise.all(
          pending.map((o) =>
            finalizeDriverEarningsForOrder(o.id!, user.id).catch((e) => {
              console.warn('Earnings backfill skipped for', o.id, e);
            })
          )
        );
        const doc = await getUserDocument(user.id);
        if (doc) {
          setTotalEarnings(doc.totalEarnings ?? 0);
          setMonthlyOrderCount(doc.monthlyOrderCount ?? doc.lifetimeDeliveries ?? 0);
        }
      })
      .catch((e) => console.warn('Earnings backfill failed', e));

    // Subscribe to real-time daily payouts for THIS driver
    const unsub = subscribeToDriverDailyPayoutsForDriver(
      user.id,
      (list) => {
        setDailyPayouts(list);
        setLoading(false);
      },
      () => setLoading(false)
    );

    return () => unsub();
  }, [user?.id]);

  // ─── Analytics derived from dailyPayouts ─────────────────────────
  const analytics = useMemo(() => {
    const paid = dailyPayouts.filter((p) => p.status === 'paid' && p.amount > 0);
    const pending = dailyPayouts.filter((p) => p.status === 'pending' && p.amount > 0);

    // Total paid by admin
    const totalPaid = paid.reduce((s, p) => s + p.amount, 0);
    const totalPending = pending.reduce((s, p) => s + p.amount, 0);

    // Today's paid
    const todayPaid = paid
      .filter((p) => {
        try { return isToday(parseISO(p.date)); } catch { return false; }
      })
      .reduce((s, p) => s + p.amount, 0);

    // This week paid
    const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
    const weekEnd = endOfWeek(new Date(), { weekStartsOn: 1 });
    const thisWeekPaid = paid
      .filter((p) => {
        try {
          const d = parseISO(p.date);
          return isWithinInterval(d, { start: weekStart, end: weekEnd });
        } catch { return false; }
      })
      .reduce((s, p) => s + p.amount, 0);

    // This month paid
    const monthStart = startOfMonth(new Date());
    const monthEnd = endOfMonth(new Date());
    const thisMonthPaid = paid
      .filter((p) => {
        try {
          const d = parseISO(p.date);
          return isWithinInterval(d, { start: monthStart, end: monthEnd });
        } catch { return false; }
      })
      .reduce((s, p) => s + p.amount, 0);

    // ── Daily bar chart data (last 7 days) ──
    const last7 = Array.from({ length: 7 }, (_, i) => {
      const day = subDays(new Date(), 6 - i);
      const dateKey = format(day, 'yyyy-MM-dd');
      const match = paid.filter((p) => p.date === dateKey);
      const amount = match.reduce((s, p) => s + p.amount, 0);
      return {
        day: format(day, 'EEE'),
        date: format(day, 'dd MMM'),
        amount,
      };
    });

    // ── Weekly trend (last 4 weeks) ──
    const weeklyTrend = Array.from({ length: 4 }, (_, i) => {
      const ws = startOfWeek(subDays(new Date(), (3 - i) * 7), { weekStartsOn: 1 });
      const we = endOfWeek(ws, { weekStartsOn: 1 });
      const weekPaid = paid
        .filter((p) => {
          try {
            const d = parseISO(p.date);
            return isWithinInterval(d, { start: ws, end: we });
          } catch { return false; }
        })
        .reduce((s, p) => s + p.amount, 0);
      return {
        week: `W${4 - (3 - i)}`,
        label: `${format(ws, 'dd MMM')} – ${format(we, 'dd MMM')}`,
        amount: weekPaid,
      };
    });

    // Best day
    const bestDay = paid.length > 0
      ? paid.reduce((best, p) => (p.amount > best.amount ? p : best), paid[0])
      : null;

    // Average per day
    const uniqueDays = new Set(paid.map((p) => p.date));
    const avgPerDay = uniqueDays.size > 0 ? Math.round(totalPaid / uniqueDays.size) : 0;

    // Total deliveries from paid payouts
    const totalTrips = paid.reduce((s, p) => s + (p.tripCount ?? p.orderIds?.length ?? 0), 0);

    // Compare this week vs last week
    const lastWeekStart = startOfWeek(subDays(new Date(), 7), { weekStartsOn: 1 });
    const lastWeekEnd = endOfWeek(lastWeekStart, { weekStartsOn: 1 });
    const lastWeekPaid = paid
      .filter((p) => {
        try {
          const d = parseISO(p.date);
          return isWithinInterval(d, { start: lastWeekStart, end: lastWeekEnd });
        } catch { return false; }
      })
      .reduce((s, p) => s + p.amount, 0);

    const weekOverWeekChange = lastWeekPaid > 0
      ? Math.round(((thisWeekPaid - lastWeekPaid) / lastWeekPaid) * 100)
      : thisWeekPaid > 0 ? 100 : 0;

    return {
      totalPaid,
      totalPending,
      todayPaid,
      thisWeekPaid,
      thisMonthPaid,
      last7,
      weeklyTrend,
      bestDay,
      avgPerDay,
      totalTrips,
      weekOverWeekChange,
      paidHistory: paid.sort((a, b) => b.date.localeCompare(a.date)),
      pendingHistory: pending.sort((a, b) => b.date.localeCompare(a.date)),
    };
  }, [dailyPayouts]);

  // Milestone
  const weekDeliveryCount = dailyPayouts
    .filter((p) => {
      try {
        const d = parseISO(p.date);
        return isWithinInterval(d, {
          start: startOfWeek(new Date(), { weekStartsOn: 1 }),
          end: endOfWeek(new Date(), { weekStartsOn: 1 }),
        });
      } catch { return false; }
    })
    .reduce((s, p) => s + (p.tripCount ?? p.orderIds?.length ?? 0), 0);

  const milestoneProgress = Math.min(weekDeliveryCount, PLATFORM_FEES.weeklyMilestoneDeliveries);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="p-4 flex justify-between items-center border-b">
        <Logo />
        <div className="flex items-center gap-2">
          <LanguageSelector />
          <Button variant="outline" size="sm" asChild>
            <Link to="/dashboard">
              <ArrowLeft className="h-4 w-4 mr-1" />
              {t('deliveryDashboard')}
            </Link>
          </Button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto p-4 space-y-6">
        <div>
          <h1 className="text-2xl font-bold">{t('earnings')}</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Real-time transfer history from Admin. All payments are directly sent to your UPI.
          </p>
        </div>

        {/* ── KPI Cards ── */}
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: "Today's Transfer", value: analytics.todayPaid, icon: IndianRupee, color: 'text-success' },
            { label: 'This Week', value: analytics.thisWeekPaid, icon: TrendingUp, color: 'text-primary' },
            { label: 'This Month', value: analytics.thisMonthPaid, icon: Calendar, color: 'text-blue-500' },
            { label: 'All Time Received', value: analytics.totalPaid, icon: Truck, color: 'text-emerald-600' },
          ].map((stat) => (
            <Card key={stat.label} className="card-shadow">
              <CardContent className="p-4">
                <stat.icon className={`h-5 w-5 ${stat.color} mb-2`} />
                <p className="text-xl font-bold tabular-nums">₹{stat.value.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">{stat.label}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* ── Quick Stats Row ── */}
        <div className="grid grid-cols-3 gap-3">
          <Card className="card-shadow">
            <CardContent className="p-3 text-center">
              <p className="text-lg font-bold tabular-nums">{analytics.totalTrips}</p>
              <p className="text-xs text-muted-foreground">Total Deliveries</p>
            </CardContent>
          </Card>
          <Card className="card-shadow">
            <CardContent className="p-3 text-center">
              <p className="text-lg font-bold tabular-nums">₹{analytics.avgPerDay.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">Avg / Day</p>
            </CardContent>
          </Card>
          <Card className="card-shadow">
            <CardContent className="p-3 text-center">
              <div className="flex items-center justify-center gap-1">
                {analytics.weekOverWeekChange >= 0 ? (
                  <ArrowUpRight className="h-4 w-4 text-success" />
                ) : (
                  <ArrowDownRight className="h-4 w-4 text-destructive" />
                )}
                <p className={`text-lg font-bold tabular-nums ${analytics.weekOverWeekChange >= 0 ? 'text-success' : 'text-destructive'}`}>
                  {analytics.weekOverWeekChange > 0 ? '+' : ''}{analytics.weekOverWeekChange}%
                </p>
              </div>
              <p className="text-xs text-muted-foreground">vs Last Week</p>
            </CardContent>
          </Card>
        </div>

        {/* ── Daily Transfers Bar Chart (Last 7 Days) ── */}
        <Card className="card-shadow">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-primary" />
              Daily Transfers — Last 7 Days
            </CardTitle>
            <CardDescription>Amount transferred by Admin each day</CardDescription>
          </CardHeader>
          <CardContent>
            {analytics.last7.every((d) => d.amount === 0) ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                No transfers recorded in the last 7 days.
              </p>
            ) : (
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={analytics.last7} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                    <XAxis dataKey="day" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                    <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" tickFormatter={(v) => `₹${v}`} />
                    <Tooltip
                      contentStyle={{ borderRadius: 8, fontSize: 13, border: '1px solid hsl(var(--border))' }}
                      formatter={(value: number) => [`₹${value.toLocaleString()}`, 'Transferred']}
                      labelFormatter={(label, payload) => payload?.[0]?.payload?.date ?? label}
                    />
                    <Bar dataKey="amount" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── Weekly Trend Area Chart ── */}
        <Card className="card-shadow">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-blue-500" />
              Weekly Trend — Last 4 Weeks
            </CardTitle>
          </CardHeader>
          <CardContent>
            {analytics.weeklyTrend.every((w) => w.amount === 0) ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                No weekly data available yet.
              </p>
            ) : (
              <div className="h-44">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={analytics.weeklyTrend} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                    <XAxis dataKey="week" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                    <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" tickFormatter={(v) => `₹${v}`} />
                    <Tooltip
                      contentStyle={{ borderRadius: 8, fontSize: 13, border: '1px solid hsl(var(--border))' }}
                      formatter={(value: number) => [`₹${value.toLocaleString()}`, 'Received']}
                      labelFormatter={(_, payload) => payload?.[0]?.payload?.label ?? ''}
                    />
                    <Area type="monotone" dataKey="amount" stroke="hsl(var(--primary))" fill="url(#areaGrad)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── Best Day Highlight ── */}
        {analytics.bestDay && (
          <Card className="card-shadow border-success/30 bg-success/5">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-success">🏆 Best Earning Day</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {(() => { try { return format(parseISO(analytics.bestDay.date), 'EEEE, dd MMM yyyy'); } catch { return analytics.bestDay.date; } })()}
                </p>
              </div>
              <p className="text-xl font-bold text-success tabular-nums">₹{analytics.bestDay.amount.toLocaleString()}</p>
            </CardContent>
          </Card>
        )}

        {/* ── Weekly Bonus ── */}
        <Card className="card-shadow border-warning/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Gift className="h-4 w-4 text-warning" />
              Weekly Bonus
            </CardTitle>
            <CardDescription>
              Complete {PLATFORM_FEES.weeklyMilestoneDeliveries} deliveries this week → earn ₹
              {PLATFORM_FEES.weeklyMilestoneBonus} bonus
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3">
              <div className="flex-1 h-3 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full bg-warning rounded-full transition-all"
                  style={{
                    width: `${(milestoneProgress / PLATFORM_FEES.weeklyMilestoneDeliveries) * 100}%`,
                  }}
                />
              </div>
              <span className="text-sm font-medium tabular-nums">
                {milestoneProgress}/{PLATFORM_FEES.weeklyMilestoneDeliveries}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* ── Pending Payments (not yet transferred) ── */}
        {analytics.pendingHistory.length > 0 && (
          <Card className="card-shadow border-warning/30">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Clock className="h-4 w-4 text-warning" />
                Pending Transfers
              </CardTitle>
              <CardDescription>
                Awaiting admin to transfer — ₹{analytics.totalPending.toLocaleString()} total
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {analytics.pendingHistory.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between rounded-lg border border-warning/20 bg-warning/5 p-3 text-sm"
                >
                  <div>
                    <p className="font-medium">
                      {(() => { try { return format(parseISO(p.date), 'dd MMM yyyy'); } catch { return p.date; } })()}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {p.tripCount ?? p.orderIds?.length ?? 0} deliveries · {p.distanceKm?.toFixed(1) ?? 0} km
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-warning tabular-nums">₹{p.amount.toLocaleString()}</p>
                    <p className="text-xs text-warning">Pending</p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* ── Admin Transfer History (Paid) ── */}
        <Card className="card-shadow">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-success" />
              Admin Transfer History
            </CardTitle>
            <CardDescription>
              All payments received from Admin — ₹{analytics.totalPaid.toLocaleString()} total
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {analytics.paidHistory.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">
                No transfers received yet. Complete deliveries to start earning.
              </p>
            ) : (
              analytics.paidHistory.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between rounded-lg border p-3 text-sm"
                >
                  <div>
                    <p className="font-medium">
                      {(() => { try { return format(parseISO(p.date), 'dd MMM yyyy (EEEE)'); } catch { return p.date; } })()}
                    </p>
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Truck className="h-3 w-3" />
                      {p.tripCount ?? p.orderIds?.length ?? 0} deliveries · {p.distanceKm?.toFixed(1) ?? 0} km
                    </p>
                    {p.paidAt && (
                      <p className="text-xs text-success flex items-center gap-1 mt-0.5">
                        <CheckCircle2 className="h-3 w-3" />
                        Paid {(() => { try { return format(p.paidAt.toDate(), 'dd MMM, hh:mm a'); } catch { return ''; } })()}
                      </p>
                    )}
                  </div>
                  <p className="font-bold text-success tabular-nums text-lg">+₹{p.amount.toLocaleString()}</p>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

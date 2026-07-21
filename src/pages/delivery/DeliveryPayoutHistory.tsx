import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  Calendar,
  CheckCircle,
  IndianRupee,
  Navigation,
  Package,
  Wallet,
} from 'lucide-react';
import { Button } from '@shared/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@shared/components/ui/card';
import { Logo } from '@shared/components/Logo';
import { LanguageSelector } from '@shared/components/LanguageSelector';
import { useAuth } from '@shared/contexts/AuthContext';
import {
  DriverDailyPayout,
  dedupeDriverDailyPayouts,
  subscribeToDriverDailyPayoutsForDriver,
} from '@shared/lib/firebase/firestore';
import { formatTimestamp } from '@shared/utils/deliveryOrderFilters';

function payoutTripCount(p: DriverDailyPayout): number {
  if (p.tripCount != null && p.tripCount > 0) return p.tripCount;
  return new Set(p.orderIds ?? []).size;
}

export default function DeliveryPayoutHistory() {
  const { user } = useAuth();
  const [rawPayouts, setRawPayouts] = useState<DriverDailyPayout[]>([]);

  useEffect(() => {
    if (!user?.id) return;
    const unsub = subscribeToDriverDailyPayoutsForDriver(user.id, setRawPayouts);
    return () => unsub();
  }, [user?.id]);

  const payouts = useMemo(
    () => dedupeDriverDailyPayouts(rawPayouts),
    [rawPayouts]
  );

  const totalPaid = payouts
    .filter((p) => p.status === 'paid')
    .reduce((s, p) => s + p.amount, 0);

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 glass border-b">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Logo size="sm" />
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link to="/dashboard" className="gap-1">
                <ArrowLeft className="h-4 w-4" />
                Dashboard
              </Link>
            </Button>
            <LanguageSelector />
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 space-y-6 max-w-2xl">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Wallet className="h-7 w-7 text-primary" />
            Payment history
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Live from admin payouts — same kilometers, trips, and amount as Drivers &amp; Payouts
          </p>
        </div>

        <Card>
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Total received</p>
              <p className="text-2xl font-bold flex items-center gap-1">
                <IndianRupee className="h-5 w-5" />
                {totalPaid.toFixed(2)}
              </p>
            </div>
            <p className="text-sm text-muted-foreground">
              {payouts.filter((p) => p.status === 'paid').length} payments
            </p>
          </CardContent>
        </Card>

        {payouts.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center text-muted-foreground">
              No payout summary yet. Complete a delivery — admin will see your trip and can pay via
              UPI.
            </CardContent>
          </Card>
        ) : (
          payouts.map((p) => (
            <Card key={`${p.driverUid}-${p.date}`}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Calendar className="h-5 w-5 text-primary" />
                    {p.date}
                  </CardTitle>
                  {p.status === 'paid' ? (
                    <span className="text-xs px-2 py-1 rounded-full bg-emerald-500/10 text-emerald-600 flex items-center gap-1">
                      <CheckCircle className="h-3 w-3" />
                      Paid
                    </span>
                  ) : (
                    <span className="text-xs px-2 py-1 rounded-full bg-amber-500/10 text-amber-600">
                      Pending
                    </span>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-3 gap-3 text-center text-sm">
                  <div className="rounded-lg bg-muted/50 p-2">
                    <p className="font-bold text-lg">{payoutTripCount(p)}</p>
                    <p className="text-muted-foreground text-xs">Trips</p>
                  </div>
                  <div className="rounded-lg bg-muted/50 p-2">
                    <p className="font-bold text-lg flex items-center justify-center gap-0.5">
                      <Package className="h-3.5 w-3.5" />
                      {p.jarsDelivered}
                    </p>
                    <p className="text-muted-foreground text-xs">Jars</p>
                  </div>
                  <div className="rounded-lg bg-muted/50 p-2">
                    <p className="font-bold text-lg flex items-center justify-center gap-0.5">
                      <Navigation className="h-3.5 w-3.5" />
                      {p.distanceKm?.toFixed(2)}
                    </p>
                    <p className="text-muted-foreground text-xs">km traveled</p>
                  </div>
                </div>

                <div className="flex items-center justify-between border-t pt-3">
                  <div>
                    <p className="text-xs text-muted-foreground">
                      {p.status === 'paid' ? 'Amount paid' : 'Amount'}
                    </p>
                    <p className="text-xl font-bold flex items-center gap-1">
                      <IndianRupee className="h-4 w-4" />
                      {p.amount.toFixed(2)}
                    </p>
                  </div>
                  {p.paidAt && (
                    <p className="text-xs text-muted-foreground text-right">
                      Paid {formatTimestamp(p.paidAt)}
                    </p>
                  )}
                </div>

                {p.payoutUpiId && (
                  <p className="text-xs text-muted-foreground break-all">
                    UPI: {p.payoutUpiId}
                  </p>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </main>
    </div>
  );
}

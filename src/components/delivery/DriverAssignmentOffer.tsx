import { useEffect, useState } from 'react';
import { Clock, MapPin, Package, Store, X, Check } from 'lucide-react';
import { Button } from '@shared/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@shared/components/ui/dialog';
import { DriverAssignment } from '@shared/lib/firebase/firestore';
import { respondToDriverAssignment } from '@shared/lib/firebase/driverAssignments';
import { useToast } from '@shared/hooks/use-toast';

const OFFER_SECONDS = 30;

interface DriverAssignmentOfferProps {
  assignment: DriverAssignment | null;
  onDismiss: () => void;
}

export function DriverAssignmentOffer({ assignment, onDismiss }: DriverAssignmentOfferProps) {
  const { toast } = useToast();
  const [secondsLeft, setSecondsLeft] = useState(OFFER_SECONDS);
  const [responding, setResponding] = useState(false);

  useEffect(() => {
    if (!assignment?.expiresAt) return;

    const tick = () => {
      const ms = assignment.expiresAt.toMillis() - Date.now();
      const sec = Math.max(0, Math.ceil(ms / 1000));
      setSecondsLeft(sec);
      if (sec <= 0) onDismiss();
    };

    tick();
    const id = window.setInterval(tick, 500);
    return () => window.clearInterval(id);
  }, [assignment, onDismiss]);

  const handleResponse = async (response: 'accept' | 'reject') => {
    if (!assignment?.id || responding) return;
    setResponding(true);
    try {
      const result = await respondToDriverAssignment({ assignmentId: assignment.id, response });
      toast({
        title: response === 'accept' ? 'Delivery accepted' : 'Offer declined',
        description: result.message,
      });
      onDismiss();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Could not respond to offer';
      toast({ title: 'Error', description: message, variant: 'destructive' });
    } finally {
      setResponding(false);
    }
  };

  if (!assignment) return null;

  const progress = Math.min(100, (secondsLeft / OFFER_SECONDS) * 100);

  return (
    <Dialog open onOpenChange={(open) => !open && onDismiss()}>
      <DialogContent className="max-w-md border-2 border-primary">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5 text-primary" />
            New delivery offer
          </DialogTitle>
          <DialogDescription>
            Accept within {secondsLeft}s or the offer goes to the next driver.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full bg-primary transition-all duration-500 ease-linear"
              style={{ width: `${progress}%` }}
            />
          </div>

          <div className="flex items-center gap-2 text-sm font-medium">
            <Clock className="h-4 w-4" />
            <span className="tabular-nums">{secondsLeft}s remaining</span>
          </div>

          <div className="rounded-lg bg-muted/50 p-3 space-y-2 text-sm">
            <p className="font-semibold">{assignment.orderOrderId}</p>
            <p className="flex items-center gap-2">
              <Store className="h-4 w-4 shrink-0" />
              {assignment.vendorShopName}
            </p>
            {assignment.itemsSummary && (
              <p className="text-muted-foreground">{assignment.itemsSummary}</p>
            )}
            <p className="flex items-start gap-2">
              <MapPin className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{assignment.customerAddress}</span>
            </p>
            <p className="font-semibold text-primary">₹{assignment.total} total · ₹{assignment.deliveryFee} delivery fee</p>
          </div>

          <div className="flex gap-2">
            <Button
              className="flex-1 gap-2"
              disabled={responding || secondsLeft <= 0}
              onClick={() => handleResponse('accept')}
            >
              <Check className="h-4 w-4" />
              Accept
            </Button>
            <Button
              variant="outline"
              className="flex-1 gap-2"
              disabled={responding}
              onClick={() => handleResponse('reject')}
            >
              <X className="h-4 w-4" />
              Decline
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

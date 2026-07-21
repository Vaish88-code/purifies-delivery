/** Load Razorpay checkout script once. */
export function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') {
      resolve(false);
      return;
    }
    if ((window as unknown as { Razorpay?: unknown }).Razorpay) {
      resolve(true);
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

export function isRazorpayConfigured(): boolean {
  return Boolean(import.meta.env.VITE_RAZORPAY_KEY_ID);
}

export interface RazorpayCheckoutOptions {
  orderId: string;
  amount: number;
  currency?: string;
  name: string;
  description: string;
  customerName: string;
  customerPhone: string;
  onSuccess: (response: {
    razorpay_payment_id: string;
    razorpay_order_id: string;
    razorpay_signature: string;
  }) => void;
  onDismiss?: () => void;
}

export async function openRazorpayCheckout(options: RazorpayCheckoutOptions): Promise<void> {
  const key = import.meta.env.VITE_RAZORPAY_KEY_ID as string | undefined;
  if (!key) throw new Error('Razorpay is not configured');

  const loaded = await loadRazorpayScript();
  if (!loaded) throw new Error('Failed to load Razorpay');

  const Razorpay = (window as unknown as { Razorpay: new (opts: object) => { open: () => void } })
    .Razorpay;

  const rzp = new Razorpay({
    key,
    amount: Math.round(options.amount * 100),
    currency: options.currency ?? 'INR',
    name: options.name,
    description: options.description,
    order_id: options.orderId,
    prefill: {
      name: options.customerName,
      contact: options.customerPhone,
    },
    theme: { color: '#0ea5e9' },
    handler: options.onSuccess,
    modal: {
      ondismiss: options.onDismiss,
    },
  });

  rzp.open();
}

export interface UpiPayLinkParams {
  upiId: string;
  payeeName: string;
  amount: number;
  note?: string;
}

export interface UpiPayDetails {
  link: string;
  upiId: string;
  payeeName: string;
  amount: number;
  note?: string;
  summaryText: string;
}

/** Standard UPI deep link — opens PhonePe, GPay, Paytm, etc. on mobile only. */
export function buildUpiPayLink({
  upiId,
  payeeName,
  amount,
  note,
}: UpiPayLinkParams): string {
  const params = new URLSearchParams();
  params.set('pa', upiId.trim());
  params.set('pn', payeeName.trim().replace(/[^a-zA-Z0-9\s]/g, '') || 'Payee');
  params.set('am', Math.max(0, amount).toFixed(2));
  params.set('cu', 'INR');
  if (note?.trim()) {
    params.set('tn', note.trim().slice(0, 80));
  }
  return `upi://pay?${params.toString()}`;
}

export function getUpiPayDetails(params: UpiPayLinkParams): UpiPayDetails {
  const upiId = params.upiId.trim();
  const payeeName = params.payeeName.trim().replace(/[^a-zA-Z0-9\s]/g, '') || 'Payee';
  const amount = Math.max(0, params.amount);
  const note = params.note?.trim();
  const link = buildUpiPayLink({ upiId, payeeName, amount, note });
  const lines = [
    `Pay ₹${amount.toFixed(2)} to ${payeeName}`,
    `UPI ID: ${upiId}`,
    note ? `Note: ${note}` : null,
  ].filter(Boolean);
  return {
    link,
    upiId,
    payeeName,
    amount,
    note,
    summaryText: lines.join('\n'),
  };
}

/** True only on phones — desktop/laptop browsers cannot handle upi:// links. */
export function supportsUpiDeepLink(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  if (/Windows NT|Win64|WOW64|Macintosh|Linux x86|CrOS/i.test(ua)) {
    return false;
  }
  return /Android|iPhone|iPod/i.test(ua);
}

/** @deprecated Use supportsUpiDeepLink */
export function isLikelyMobileUpiDevice(): boolean {
  return supportsUpiDeepLink();
}

/** Try to open a UPI app. Never call on desktop — browsers log a handler error. */
export function tryOpenUpiPayLink(link: string): boolean {
  if (!supportsUpiDeepLink()) {
    return false;
  }
  const anchor = document.createElement('a');
  anchor.href = link;
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  return true;
}

export function openUpiPayLink(params: UpiPayLinkParams): { opened: boolean; details: UpiPayDetails } {
  const details = getUpiPayDetails(params);
  const opened = tryOpenUpiPayLink(details.link);
  return { opened, details };
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

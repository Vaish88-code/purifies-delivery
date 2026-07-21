import { getFunctions, httpsCallable } from 'firebase/functions';
import app from '../firebase';

const functions = getFunctions(app, 'asia-south1');

export interface CreateRazorpayOrderRequest {
  firestoreOrderId: string;
  orderOrderId: string;
  amount: number;
  vendorUid: string;
  customerUid: string;
}

export interface CreateRazorpayOrderResponse {
  razorpayOrderId: string;
  amount: number;
  currency: string;
}

export async function createRazorpayOrder(
  data: CreateRazorpayOrderRequest
): Promise<CreateRazorpayOrderResponse> {
  const fn = httpsCallable<CreateRazorpayOrderRequest, CreateRazorpayOrderResponse>(
    functions,
    'createRazorpayOrder'
  );
  const result = await fn(data);
  return result.data;
}

export interface VerifyRazorpayPaymentRequest {
  firestoreOrderId: string;
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
}

export async function verifyRazorpayPayment(
  data: VerifyRazorpayPaymentRequest
): Promise<{ success: boolean }> {
  const fn = httpsCallable<VerifyRazorpayPaymentRequest, { success: boolean }>(
    functions,
    'verifyRazorpayPayment'
  );
  const result = await fn(data);
  return result.data;
}

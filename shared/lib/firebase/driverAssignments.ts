import { getFunctions, httpsCallable } from 'firebase/functions';
import app from '../firebase';

const functions = getFunctions(app, 'asia-south1');

export type DriverAssignmentResponse = 'accept' | 'reject';

export interface RespondToDriverAssignmentRequest {
  assignmentId: string;
  response: DriverAssignmentResponse;
}

export interface RespondToDriverAssignmentResult {
  success: boolean;
  message?: string;
}

export interface StartDriverAutoAssignRequest {
  orderId: string;
}

export interface StartDriverAutoAssignResult {
  success: boolean;
  message?: string;
}

export async function respondToDriverAssignment(
  data: RespondToDriverAssignmentRequest
): Promise<RespondToDriverAssignmentResult> {
  const fn = httpsCallable<
    RespondToDriverAssignmentRequest,
    RespondToDriverAssignmentResult
  >(functions, 'respondToDriverAssignment');
  const result = await fn(data);
  return result.data;
}

export async function startDriverAutoAssign(
  data: StartDriverAutoAssignRequest
): Promise<StartDriverAutoAssignResult> {
  const fn = httpsCallable<
    StartDriverAutoAssignRequest,
    StartDriverAutoAssignResult
  >(functions, 'startDriverAutoAssign');
  const result = await fn(data);
  return result.data;
}

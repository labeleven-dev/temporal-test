import { uuid4 } from "@temporalio/workflow";

export async function createOrderIntent(orderId: string): Promise<boolean> {
  console.log(`Creating order intent for ${orderId}`);
  return true;
}

export async function submitPayment(orderId: string, paymentInfo: string) {
  console.log(`Submitting payment (${paymentInfo}) for ${orderId}`);
  return uuid4();
}

export async function getPaymentStatus(paymentId: string) {
  console.log(`Checking payment status for ${paymentId}`);
  return true;
}
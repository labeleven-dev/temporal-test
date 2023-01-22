import { Context } from '@temporalio/activity';
import { uuid4 } from '@temporalio/workflow';

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function createOrderIntent(orderId: string): Promise<boolean> {
  console.log(`Creating order intent for ${orderId}`);
  return true;
}

export async function submitPayment(orderId: string, paymentInfo: string) {
  console.log(`Submitting payment (${paymentInfo}) for ${orderId}`);
  return uuid4();
}

export async function refundPayment(orderId: string, paymentInfo: string) {
  console.log(`Refunding payment (${paymentInfo}) for ${orderId}`);
  return true;
}

export async function getPaymentStatus(paymentId: string) {
  console.log(`Checking payment status for ${paymentId}`);
  return true;
}

export async function createTransaction(orderId: string, paymentId: string) {
  console.log(`Creating transaction for ${orderId} and ${paymentId}`);
  return uuid4();
}

export async function submitAndConfirmTransaction(transactionId: string) {
  console.log(`Submitting and confirming transaction ${transactionId}`);
  for (let i = 0; i < 5; i++) {
    await sleep(500);
    console.log(`Heartbeating ${i}`);
    Context.current().heartbeat();
  }
  return true;
}

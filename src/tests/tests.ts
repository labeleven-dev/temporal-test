import { Client } from '@temporalio/client';
import { createOrder, getOrderStatus, submitPayment, signalPaymentResult, signalTransactionResult } from './common.js';

async function printOrderState(orderId: string) {
  return await getOrderStatus(orderId).then((x) => console.log(new Date(), `${orderId}=${x.status}`));
}

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const client = new Client();

// payment with success signal
async function paymentSuccess() {
  const { orderId } = await createOrder();
  const workflow = client.workflow.getHandle(`order-${orderId}`);
  console.log(new Date(), `Created order ${orderId}`);
  await printOrderState(orderId);
  await sleep(100);
  await printOrderState(orderId);
  await submitPayment(orderId);
  console.log(new Date(), `Submitted payment for ${orderId}`);
  await sleep(100);
  await printOrderState(orderId);
  console.log(new Date(), `Signaling payment success for ${orderId}`);

  // if I signal directly here with an "await" the process crashes
  // this works --> await Promise.all([workflow.signal(SIGNAL_PAYMENT_RESULT, true), sleep(1000)]);
  // this works --> workflow.signal(SIGNAL_PAYMENT_RESULT, true); await sleep(1000);
  // this fails --> await workflow.signal(SIGNAL_PAYMENT_RESULT, true); await sleep(1000);

  await signalPaymentResult(orderId, true);
  await printOrderState(orderId);
  console.log(new Date(), `Signaling transaction success for ${orderId}`);
  await signalTransactionResult(orderId, true);
  await sleep(100);
  await printOrderState(orderId);
}

async function paymentSuccessWithRefund() {
  const { orderId } = await createOrder();
  const workflow = client.workflow.getHandle(`order-${orderId}`);
  console.log(new Date(), `Created order ${orderId}`);
  await printOrderState(orderId);
  await sleep(100);
  await printOrderState(orderId);
  await submitPayment(orderId);
  console.log(new Date(), `Submitted payment for ${orderId}`);
  await sleep(100);
  await printOrderState(orderId);
  console.log(new Date(), `Signaling payment success for ${orderId}`);
  await signalPaymentResult(orderId, true);
  await printOrderState(orderId);
  await sleep(100);
  console.log(new Date(), `Signaling transaction failure for ${orderId}`);
  await signalTransactionResult(orderId, false);
  await sleep(100);
  await printOrderState(orderId);
}

async function paymentFailure() {
  const { orderId } = await createOrder();
  const workflow = client.workflow.getHandle(`order-${orderId}`);
  console.log(new Date(), `Created order ${orderId}`);
  await printOrderState(orderId);
  await sleep(100);
  await printOrderState(orderId);
  await submitPayment(orderId);
  console.log(new Date(), `Submitted payment for ${orderId}`);
  await sleep(100);
  await printOrderState(orderId);
  console.log(new Date(), `Signaling payment failed for ${orderId}`);

  await signalPaymentResult(orderId, false);
  await printOrderState(orderId);
}

// payment with polled payment success and polled transaction success
async function paymentPoll() {
  const { orderId } = await createOrder();
  console.log(new Date(), `Created order ${orderId}`);
  await printOrderState(orderId);
  await sleep(100);
  await printOrderState(orderId);
  await submitPayment(orderId);
  console.log(new Date(), `Submitted payment for ${orderId}`);
  await sleep(100);
  await printOrderState(orderId);
  await sleep(3000);
  await printOrderState(orderId);
  await sleep(3000);
  await printOrderState(orderId);
}

async function orderExpired() {
  const { orderId } = await createOrder();
  console.log(new Date(), `Created order ${orderId}`);
  await printOrderState(orderId);
  await sleep(100);
  await printOrderState(orderId);
  await sleep(5000);
  await printOrderState(orderId);
  await sleep(6000);
  await printOrderState(orderId);
}

async function run() {
  await paymentSuccess().catch((err) => console.error(err));
  await sleep(100);
  console.log('');
  await paymentSuccessWithRefund().catch((err) => console.error(err));
  await sleep(100);
  console.log('');
  await paymentFailure().catch((err) => console.error(err));
  await sleep(100);
  console.log('');
  await paymentPoll().catch((err) => console.error(err));
  await sleep(100);
  console.log('');
  await orderExpired().catch((err) => console.error(err));
  await sleep(100);
}

process.on('beforeExit', (code) => {
  // Can make asynchronous calls
  console.log(`Process will exit in 1 second with code: ${code}`);
  setTimeout(() => {
    process.exit(code);
  }, 1000);
});

process.on('exit', (code) => {
  // Only synchronous calls
  console.log(`Process exited with code: ${code}`);
});

run().catch((e) => console.log(e));

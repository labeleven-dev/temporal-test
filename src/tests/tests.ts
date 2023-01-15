import { Client } from '@temporalio/client';
import { SIGNAL_PAYMENT_RESULT, SIGNAL_SUBMIT_PAYMENT } from '../consts.js';
import { createOrder, getOrderStatus, submitPayment } from './common.js';

async function printOrderState(orderId: string) {
    await getOrderStatus(orderId).then(x => console.log(new Date(), `${orderId}=${x.status}`));
}

async function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
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
    console.log(new Date(), `Signaling payment success for ${orderId}`)
    // an 'await' here causes everything to fail? weird
    workflow.signal(SIGNAL_PAYMENT_RESULT, true);
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
    console.log(new Date(), `Signaling payment failed for ${orderId}`)
    workflow.signal(SIGNAL_PAYMENT_RESULT, false);
    await sleep(100);
    await printOrderState(orderId);
}

// payment with polled success
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

await paymentSuccess().catch(err => console.error(err));
console.log("");
await paymentFailure().catch(err => console.error(err));
console.log("");
await paymentPoll().catch(err => console.error(err));
console.log("");
await orderExpired().catch(err => console.error(err));
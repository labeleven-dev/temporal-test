
import { condition, defineQuery, defineSignal, proxyActivities, setHandler, sleep, Trigger } from '@temporalio/workflow';
import { QUERY_ORDER_STATE, SIGNAL_PAYMENT_RESULT, SIGNAL_SUBMIT_PAYMENT } from '../consts';
// Only import the activity types
import type * as activities from './activities.js';

export interface OrderState {
  status: string;
  paymentId: string | null;
}

const { createOrderIntent, submitPayment, getPaymentStatus } = proxyActivities<typeof activities>({
  startToCloseTimeout: '5 seconds',
});

export const queryOrderState = defineQuery<string, []>(QUERY_ORDER_STATE);
export const signalSubmitPayment = defineSignal<[string]>(SIGNAL_SUBMIT_PAYMENT);
export const signalPaymentResult = defineSignal<[boolean]>(SIGNAL_PAYMENT_RESULT);

export async function order(orderId: string): Promise<OrderState> {
  const orderState:OrderState = {
    status: 'CREATED',
    paymentId: null as string | null,
  }

  setHandler(queryOrderState, () => orderState.status);

  if (!await createOrderIntent(orderId)) {
    orderState.status = 'FAILED';

    return orderState;
  }

  orderState.status = 'PENDING';

  setHandler(signalSubmitPayment, async paymentInfo => {
    const paymentId = await submitPayment(orderId, paymentInfo)

    orderState.status = 'ORDER_SUBMITTED';
    orderState.paymentId = paymentId;
  })

  const paymentResult = new Trigger<boolean>();
  setHandler(signalPaymentResult, result => paymentResult.resolve(result));

  // order must be submitted within 10 seconds
  if (await condition(() => orderState.status !== 'PENDING', "10 seconds")) {
    // payment must be processed / returned within next 10 seconds
    if (await condition(() => orderState.status === 'ORDER_SUBMITTED', "10 seconds")) {
      // wait for payment success / error, but also poll for this info
      while (orderState.status === "ORDER_SUBMITTED") {
        let result = await Promise.race([paymentResult, sleep(2000)]);

        // if we timed out waiting, try to manually retrieve status
        if (result === undefined) {
          result = await getPaymentStatus(orderState.paymentId as string);
        }

        if (result !== undefined) {
          orderState.status = result ? 'PAYMENT_SUCCESS' : 'PAYMENT_FAILED';
        }
      }

      // would continue to fulfilment here
    } else {
      orderState.status = 'PAYMENT_TIMEOUT';
    }
  } else {
    orderState.status = 'ORDER_TIMEOUT';
  }

  return orderState;
}
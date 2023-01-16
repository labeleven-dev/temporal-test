import {
  CancellationScope,
  condition,
  defineQuery,
  defineSignal,
  isCancellation,
  proxyActivities,
  setHandler,
  sleep,
  Trigger
} from '@temporalio/workflow';
import { QUERY_ORDER_STATE, SIGNAL_PAYMENT_RESULT, SIGNAL_SUBMIT_PAYMENT } from '../consts';
import { interpretWithTemporal } from './xstate';
// Only import the activity types
import type * as activities from './activities.js';

export interface OrderState {
  status: string;
  paymentId: string | null;
}

const { createOrderIntent, submitPayment, getPaymentStatus } = proxyActivities<typeof activities>({
  startToCloseTimeout: '5 seconds'
});

export const queryOrderState = defineQuery<string, []>(QUERY_ORDER_STATE);
export const signalSubmitPayment = defineSignal<[string]>(SIGNAL_SUBMIT_PAYMENT);
export const signalPaymentResult = defineSignal<[boolean]>(SIGNAL_PAYMENT_RESULT);

export async function order(orderId: string): Promise<OrderState> {
  const orderState: OrderState = {
    status: 'CREATED',
    paymentId: null as string | null
  };

  setHandler(queryOrderState, () => orderState.status);

  if (!(await createOrderIntent(orderId))) {
    orderState.status = 'FAILED';

    return orderState;
  }

  orderState.status = 'PENDING';

  setHandler(signalSubmitPayment, async (paymentInfo) => {
    const paymentId = await submitPayment(orderId, paymentInfo);

    orderState.status = 'ORDER_SUBMITTED';
    orderState.paymentId = paymentId;
  });

  const paymentResult = new Trigger<boolean>();
  setHandler(signalPaymentResult, (result) => paymentResult.resolve(result));

  // order must be submitted within 10 seconds
  if (await condition(() => orderState.status !== 'PENDING', '10 seconds')) {
    // payment must be processed / returned within next 10 seconds
    if (await condition(() => orderState.status === 'ORDER_SUBMITTED', '10 seconds')) {
      // wait for payment success / error, but also poll for this info
      while (orderState.status === 'ORDER_SUBMITTED') {
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

// XSTATE SPECIFIC
import { createMachine, assign, interpret, StateFrom, send, raise } from 'xstate';

interface OrderMachineContext extends OrderState {
  orderId: string;
  paymentInfo: string | null;
}

type OrderMachineEvents =
  | { type: 'SUBMIT_PAYMENT'; paymentInfo: string }
  | { type: 'PAYMENT_RESULT'; paymentSuccess: boolean }
  | { type: 'PAYMENT_PENDING' }
  | { type: 'PAYMENT_SUCCESS' }
  | { type: 'PAYMENT_FAILED' };

const setStatus = (status: string) =>
  assign<OrderMachineContext, any>({
    status: (_context, _data) => status
  });

function createOrderMachine(orderId: string) {
  return createMachine<OrderMachineContext, OrderMachineEvents>({
    id: 'orderMachine',
    initial: 'created',
    predictableActionArguments: true,
    context: {
      orderId,
      status: 'CREATING',
      paymentInfo: null,
      paymentId: null
    },
    states: {
      created: {
        invoke: {
          src: 'createOrderIntent',
          onDone: 'pending',
          onError: 'createFailed'
        }
      },
      pending: {
        entry: setStatus('PENDING'),
        on: {
          SUBMIT_PAYMENT: {
            actions: assign({
              status: (_context, _data) => 'SUBMITTING_ORDER',
              paymentInfo: (_context, event) => event.paymentInfo
            }),
            target: 'submitOrder'
          }
        },
        after: {
          10000: 'orderTimeout'
        }
      },
      submitOrder: {
        invoke: {
          src: 'submitOrder',
          onDone: {
            target: 'orderSubmitted',
            actions: assign({
              status: (_context, _data) => 'ORDER_SUBMITTED',
              paymentId: (_context, event) => event.data
            })
          },
          onError: 'orderFailed'
        }
      },
      orderSubmitted: {
        initial: 'wait',
        on: {
          PAYMENT_RESULT: [{ target: 'paymentSuccess', cond: (context, event) => event.paymentSuccess }, { target: 'paymentFailed' }]
        },
        states: {
          wait: {
            after: {
              2000: 'checkPaymentStatus'
            }
          },
          checkPaymentStatus: {
            invoke: {
              src: 'getPaymentStatus'
            },
            on: {
              PAYMENT_PENDING: 'wait'
            }
          }
        }
      },
      paymentSuccess: {
        entry: setStatus('PAYMENT_SUCCESS'),
        type: 'final'
      },
      paymentFailed: {
        entry: setStatus('PAYMENT_FAILED'),
        type: 'final'
      },
      orderFailed: {
        entry: setStatus('ORDER_FAILED'),
        type: 'final'
      },
      orderTimeout: {
        entry: setStatus('ORDER_TIMEOUT'),
        type: 'final'
      },
      createFailed: {
        entry: setStatus('CREATE_FAILED'),
        type: 'final'
      }
    }
  });
}

export async function orderX(orderId: string) {
  // map services / activities into the machine
  const machine = createOrderMachine(orderId).withConfig({
    services: {
      createOrderIntent: async (context) => {
        return await createOrderIntent(context.orderId);
      },
      submitOrder: async (context) => {
        return await submitPayment(context.orderId, context.paymentInfo as string);
      },
      getPaymentStatus: (context) => {
        return async (callback: any) => {
          const result = await getPaymentStatus(context.paymentId as string);
          if (result === undefined) {
            callback({ type: 'PAYMENT_PENDING' });
          } else {
            callback({ type: 'PAYMENT_RESULT', paymentSuccess: result });
          }
        };
      }
    }
  });

  // create the xstate service interpreter (using temporal primitives)
  const service = interpretWithTemporal(machine);

  // map signals to machine events
  setHandler(queryOrderState, () => service.state.context.status);
  setHandler(signalSubmitPayment, async (paymentInfo) => {
    service.eventSender({ type: 'SUBMIT_PAYMENT', paymentInfo });
  });
  setHandler(signalPaymentResult, async (paymentSuccess) => {
    service.eventSender({ type: 'PAYMENT_RESULT', paymentSuccess });
  });

  // make sure workflow function doesn't resolve until the machine is done
  await service.serviceDonePromise;

  return service.state.context.status;
}

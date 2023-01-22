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
import { QUERY_ORDER_STATE, SIGNAL_PAYMENT_RESULT, SIGNAL_SUBMIT_PAYMENT, SIGNAL_TRANSACTION_RESULT } from '../consts.js';
import { interpretWithTemporal } from './xstate.js';
// Only import the activity types
import type * as activities from './activities.js';

export interface OrderState {
  status: string;
  paymentId: string | null;
}

const { createOrderIntent, submitPayment, getPaymentStatus, createTransaction, refundPayment } = proxyActivities<typeof activities>({
  startToCloseTimeout: '5 seconds'
});

const { submitAndConfirmTransaction } = proxyActivities<typeof activities>({
  heartbeatTimeout: '5 seconds',
  scheduleToCloseTimeout: '120 seconds' // cause blockhash expires
});

export const queryOrderState = defineQuery<string, []>(QUERY_ORDER_STATE);
export const signalSubmitPayment = defineSignal<[string]>(SIGNAL_SUBMIT_PAYMENT);
export const signalPaymentResult = defineSignal<[boolean]>(SIGNAL_PAYMENT_RESULT);
export const signalTransactionResult = defineSignal<[boolean]>(SIGNAL_TRANSACTION_RESULT);

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
import { createMachine, assign } from 'xstate';
import { log } from 'xstate/lib/actions.js';

interface OrderMachineContext extends OrderState {
  orderId: string;
  paymentInfo: string | null;
  transactionId: string | null;
}

type OrderMachineEvents =
  | { type: 'SUBMIT_PAYMENT'; paymentInfo: string }
  | { type: 'PAYMENT_RESULT'; paymentSuccess: boolean }
  | { type: 'PAYMENT_PENDING' }
  | { type: 'PAYMENT_SUCCESS' }
  | { type: 'PAYMENT_FAILED' }
  | { type: 'TXN_RESULT'; txnSuccess: boolean };

const setStatus = (status: string) =>
  assign<OrderMachineContext, any>({
    status: (_context, _data) => status
  });

function createOrderMachine(orderId: string) {
  return createMachine<OrderMachineContext, OrderMachineEvents>({
    id: 'orderMachine',
    initial: 'creating',
    predictableActionArguments: true,
    context: {
      orderId,
      status: 'CREATING',
      paymentInfo: null,
      paymentId: null,
      transactionId: null
    },
    states: {
      creating: {
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
          PAYMENT_RESULT: [{ target: 'paymentSuccess', cond: { type: 'paymentSuccess' } }, { target: 'paymentFailed' }]
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
        always: 'fulfillOrder'
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
      },
      fulfillOrder: {
        initial: 'createTransaction',
        entry: setStatus('FULFILLING'),
        on: {
          TXN_RESULT: [{ target: 'fulfilSuccess', cond: { type: 'transactionSuccess' } }, { target: 'fulfilFailed' }]
        },
        states: {
          createTransaction: {
            invoke: {
              src: 'createTransaction',
              onDone: {
                target: 'sendAndConfirmTransaction',
                actions: assign({
                  status: (_context, _data) => 'TXN_CREATED',
                  transactionId: (_context, event) => event.data
                })
              }
            }
          },
          sendAndConfirmTransaction: {
            invoke: {
              src: 'sendAndConfirmTransaction',
              onError: 'createTransaction'
            }
          }
        }
      },
      fulfilSuccess: {
        entry: setStatus('FULFIL_SUCCESS'),
        type: 'final'
      },
      fulfilFailed: {
        entry: setStatus('REFUNDING'),
        invoke: {
          src: 'refundPayment',
          onDone: 'refunded'
        }
      },
      refunded: {
        entry: setStatus('REFUNDED'),
        type: 'final'
      }
    }
  });
}

export async function orderX(orderId: string) {
  // map services / activities into the machine
  const machine = createOrderMachine(orderId).withConfig({
    guards: {
      paymentSuccess: (_context, event) => (event as any).paymentSuccess,
      transactionSuccess: (_context, event) => (event as any).txnSuccess
    },
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
      },
      createTransaction: async (context) => {
        return await createTransaction(context.orderId as string, context.paymentId as string);
      },
      sendAndConfirmTransaction: (context) => {
        return async (callback: any) => {
          const result = await submitAndConfirmTransaction(context.transactionId as string);
          callback({ type: 'TXN_RESULT', txnSuccess: true });
        };
      },
      refundPayment: async (context) => {
        return await refundPayment(context.orderId as string, context.paymentId as string);
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
  setHandler(signalTransactionResult, async (txnSuccess) => {
    service.eventSender({ type: 'TXN_RESULT', txnSuccess });
  });

  // make sure workflow function doesn't resolve until the machine is done
  await service.serviceDonePromise;

  return service.state.context.status;
}

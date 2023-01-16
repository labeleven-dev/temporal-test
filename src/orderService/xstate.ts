import { CancellationScope, isCancellation, sleep } from '@temporalio/workflow';
import { EventObject, interpret, StateMachine, StateSchema } from 'xstate';

export function interpretWithTemporal<T1, T2 extends StateSchema<any>, T3 extends EventObject>(machine: StateMachine<T1, T2, T3>) {
  const service = interpret(machine, {
    clock: {
      setTimeout(fn, timeout) {
        const scope = new CancellationScope();

        scope
          // cancellation scope only matters for the sleep call
          .run(() => sleep(timeout))
          // continuation is not cancelled once sleep is done
          .then(fn)
          .catch((err) => {
            if (isCancellation(err)) {
              return;
            }
            throw err;
          });

        return scope;
      },

      clearTimeout(scope: CancellationScope) {
        scope.cancel();
      }
    }
  });

  const result = {
    service,
    state: service.initialState,
    serviceDonePromise: new Promise((resolve) => {
      service.onDone(resolve);
    }),
    eventSender: service.send.bind(service)
  };

  result.service.onTransition((updatedState) => {
    result.state = updatedState;
  });

  result.service.start();

  return result;
}

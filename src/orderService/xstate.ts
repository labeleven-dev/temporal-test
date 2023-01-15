import { CancellationScope, isCancellation, sleep } from '@temporalio/workflow';
import { EventObject, interpret, InterpreterFrom, StateMachine, StateSchema } from 'xstate';

export function interpretWithTemporal<T1, T2 extends StateSchema<any>, T3 extends EventObject>(machine: StateMachine<T1, T2, T3>) {
  const service = interpret(machine, {
    clock: {
      setTimeout(fn, timeout) {
        const scope = {
          cancellationScope: new CancellationScope(),
          slept: false
        };

        scope.cancellationScope
          .run(() => {
            return sleep(timeout).then((args) => {
              scope.slept = true;
              fn(args);
            });
          })
          .catch((err) => {
            if (isCancellation(err)) {
              return;
            }
            throw err;
          });

        return scope;
      },

      clearTimeout(scope: { cancellationScope: CancellationScope; slept: boolean }) {
        if (!scope.slept) {
          scope.cancellationScope.cancel();
        }
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

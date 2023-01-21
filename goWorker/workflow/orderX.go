package workflow

import (
	"fmt"
	"github.com/mitchellh/mapstructure"
	"go.temporal.io/sdk/workflow"
	"goWorker/activity"
	"goWorker/state"
	"time"
)

// OrderX handle state transition in state machine
func OrderX(ctx workflow.Context, orderId string) (state.StateOutput, error) {
	log := workflow.GetLogger(ctx)

	log.Info("Running orderX workflow")

	activityCtx := workflow.WithActivityOptions(
		ctx, DefaultActivityOption)

	orderMachine, err := state.NewFSM(state.InitState)
	if err != nil {
		log.Error(fmt.Sprintf("Creating order machine failed. %s", err))
		return state.FailedStateOutput, err
	}

	// set query handlers
	err = workflow.SetQueryHandler(ctx, QueryState.Order, func() (string, error) {
		return orderMachine.GetStateStatusText(), nil
	})
	if err != nil {
		log.Error(fmt.Sprintf("SetQueryHandler %s failed. %s", QueryState.Order, err))
		return orderMachine.GetStateOutput(), err
	}

	var a *activity.Payment

	var response *activity.CreateOrderIntentResponse
	ctx = workflow.WithActivityOptions(
		ctx, DefaultActivityOption)
	err = workflow.ExecuteActivity(activityCtx, a.CreateOrderIntent, orderId).Get(ctx, &response)
	if err != nil {
		log.Error(fmt.Sprintf("Error execute activity %s", "CreateOrderIntent"))
		return orderMachine.GetStateOutput(), err
	}

	orderState, err := orderMachine.Call(state.EventCreate,
		state.WithOrderSuccess(response.Success),
	)
	if err != nil {
		log.Error(fmt.Sprintf("Call EventCreate failed. %s", err))
		return orderMachine.GetStateOutput(), err
	}
	if orderState.Status == state.StatusFailed {
		log.Error(fmt.Sprintf("Failed to create order intent. Status: %s", orderState.Status))
		return orderMachine.GetStateOutput(), nil
	}

	// define signal
	submitPaymentChannel := workflow.GetSignalChannel(ctx, SignalChannels.SubmitPayment)
	paymentResultChannel := workflow.GetSignalChannel(ctx, SignalChannels.PaymentResult)

	for {
		selector := workflow.NewSelector(ctx)

		// signal submitPaymentChannel handler
		selector.AddReceive(submitPaymentChannel, func(c workflow.ReceiveChannel, _ bool) {
			var signal interface{}
			c.Receive(ctx, &signal)

			var paymentInfo string
			err := mapstructure.Decode(signal, &paymentInfo)
			if err != nil {
				log.Error(fmt.Sprintf("%s: Invalid signal type %v", SignalChannels.SubmitPayment, err))
				return
			}

			var response *activity.SubmitPaymentResponse
			ctx = workflow.WithActivityOptions(
				ctx, DefaultActivityOption)
			err = workflow.ExecuteActivity(activityCtx, a.SubmitPayment, orderId, paymentInfo).Get(ctx, &response)
			if err != nil {
				log.Error(fmt.Sprintf("Error execute activity %s", "SubmitPayment"))
				return
			}

			if _, err = orderMachine.Call(state.EventSubmit,
				state.WithPaymentId(response.PaymentId),
			); err != nil {
				log.Error(fmt.Sprintf("Call EventSubmit failed. %s", err))
				return
			}
		})

		// signal paymentResultChannel handler
		selector.AddReceive(paymentResultChannel, func(c workflow.ReceiveChannel, _ bool) {
			var signal interface{}
			c.Receive(ctx, &signal)

			var paymentSuccess bool
			err := mapstructure.Decode(signal, &paymentSuccess)
			if err != nil {
				log.Error(fmt.Sprintf("%s: Invalid signal type %v", SignalChannels.PaymentResult, err))
				return
			}

			if _, err = orderMachine.Call(state.EventConfirm,
				state.WithPaymentSuccess(paymentSuccess),
				state.WithPaymentId(orderMachine.GetState().PaymentId),
			); err != nil {
				log.Error(fmt.Sprintf("Call EventConfirm failed. %s", err))
				return
			}
		})

		// order must be submitted within 10 seconds
		if orderMachine.GetStateStatus() == state.StatusPending {
			selector.AddFuture(workflow.NewTimer(ctx, orderTimeOut), func(f workflow.Future) {
				if _, err = orderMachine.Call(state.EventOrderTimeout,
					state.WithPaymentId(orderMachine.GetState().PaymentId),
				); err != nil {
					log.Error(fmt.Sprintf("Call EventOrderTimeout failed. %s", err))
					return
				}
			})
		} else if orderMachine.GetStateStatus() == state.StatusOrderSubmitted {
			// polling payment status in 2s
			selector.AddFuture(workflow.NewTimer(ctx, 2*time.Second), func(f workflow.Future) {
				var response *activity.GetPaymentStatusResponse
				ctx = workflow.WithActivityOptions(
					ctx, DefaultActivityOption)
				err = workflow.ExecuteActivity(activityCtx, a.GetPaymentStatus, orderMachine.GetState().PaymentId).Get(ctx, &response)
				if err != nil {
					log.Error(fmt.Sprintf("Error execute activity %s", "GetPaymentStatus"))
					return
				}
				if _, err = orderMachine.Call(state.EventConfirm,
					state.WithPaymentSuccess(response.Success),
					state.WithPaymentId(orderMachine.GetState().PaymentId),
				); err != nil {
					log.Error(fmt.Sprintf("Call EventConfirm failed. %s", err))
					return
				}
			})

			// payment must be processed / returned within next 10 seconds
			selector.AddFuture(workflow.NewTimer(ctx, paymentTimeOut), func(f workflow.Future) {
				if _, err = orderMachine.Call(state.EventPaymentTimeout,
					state.WithPaymentId(orderMachine.GetState().PaymentId),
				); err != nil {
					log.Error(fmt.Sprintf("Call EventPaymentTimeout failed. %s", err))
					return
				}
			})
		} else {
			break
		}

		selector.Select(ctx)

	}

	return orderMachine.GetStateOutput(), nil
}

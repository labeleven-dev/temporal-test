package workflow

import (
	"fmt"
	"github.com/mitchellh/mapstructure"
	"go.temporal.io/sdk/workflow"
	"go.uber.org/zap"
	"goOrder/activity"
	"time"
)

var DefaultActivityOption = workflow.ActivityOptions{
	StartToCloseTimeout: 5 * time.Second,
}

var QueryState = struct {
	Order string
}{
	"getOrderState",
}

var SignalChannels = struct {
	SubmitPayment string
	PaymentResult string
}{
	"submitPayment",
	"paymentResult",
}

var (
	orderTimeOut   = 10 * time.Second
	paymentTimeOut = 10 * time.Second
)

type OrderState struct {
	Status    string
	PaymentId string
}

func Order(ctx workflow.Context, orderId string, log *zap.SugaredLogger) error {

	orderState := OrderState{
		Status:    "CREATED",
		PaymentId: "",
	}

	// set query handlers
	err := workflow.SetQueryHandler(ctx, QueryState.Order, func() (string, error) {
		return orderState.Status, nil
	})
	if err != nil {
		log.Info(fmt.Sprintf("SetQueryHandler %s failed. %s", QueryState.Order, err))
		return err
	}

	var a *activity.Payment

	var response *activity.CreateOrderIntentResponse
	ctx = workflow.WithActivityOptions(
		ctx, DefaultActivityOption)
	err = workflow.ExecuteActivity(ctx, a.CreateOrderIntent, orderId).Get(ctx, &response)
	if err != nil {
		log.Error("Error execute activity %s", "CreateOrderIntent")
		return err
	}
	if !response.Success {
		orderState.Status = "FAILED"
		return nil
	}

	orderState.Status = "PENDING"

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
				log.Error("%s: Invalid signal type %v", SignalChannels.SubmitPayment, err)
				return
			}

			var response *activity.SubmitPaymentResponse
			ctx = workflow.WithActivityOptions(
				ctx, DefaultActivityOption)
			err = workflow.ExecuteActivity(ctx, a.SubmitPayment, orderId, paymentInfo).Get(ctx, &response)
			if err != nil {
				log.Error("Error execute activity %s", "SubmitPayment")
				return
			}
			orderState.Status = "ORDER_SUBMITTED"
			orderState.PaymentId = response.PaymentId
		})

		// signal paymentResultChannel handler
		selector.AddReceive(paymentResultChannel, func(c workflow.ReceiveChannel, _ bool) {
			var signal interface{}
			c.Receive(ctx, &signal)

			var paymentSuccess bool
			err := mapstructure.Decode(signal, &paymentSuccess)
			if err != nil {
				log.Error("%s: Invalid signal type %v", SignalChannels.PaymentResult, err)
				return
			}

			if paymentSuccess {
				orderState.Status = "PAYMENT_SUCCESS"
			} else {
				orderState.Status = "PAYMENT_FAILED"
			}
		})

		// order must be submitted within 10 seconds
		if orderState.Status == "PENDING" {
			selector.AddFuture(workflow.NewTimer(ctx, orderTimeOut), func(f workflow.Future) {
				orderState.Status = "ORDER_TIMEOUT"
			})
		} else if orderState.Status == "ORDER_SUBMITTED" {
			// polling payment status in 2s
			selector.AddFuture(workflow.NewTimer(ctx, 2*time.Second), func(f workflow.Future) {
				var response *activity.GetPaymentStatusResponse
				ctx = workflow.WithActivityOptions(
					ctx, DefaultActivityOption)
				err = workflow.ExecuteActivity(ctx, a.GetPaymentStatus, orderState.PaymentId).Get(ctx, &response)
				if err != nil {
					log.Error("Error execute activity %s", "GetPaymentStatus")
					return
				}
				if response.Success {
					orderState.Status = "PAYMENT_SUCCESS"
				} else {
					orderState.Status = "PAYMENT_FAILED"
				}
			})

			// payment must be processed / returned within next 10 seconds
			selector.AddFuture(workflow.NewTimer(ctx, paymentTimeOut), func(f workflow.Future) {
				orderState.Status = "PAYMENT_TIMEOUT"
			})
		} else {
			break
		}

		selector.Select(ctx)

	}

	return nil
}

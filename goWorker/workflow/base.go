package workflow

import (
	"go.temporal.io/sdk/workflow"
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

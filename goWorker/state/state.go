package state

type State struct {
	Status    Status
	PaymentId string
}

type StateOutput struct {
	Status    string
	PaymentId string
}

var InitState = State{
	Status:    StatusCreated,
	PaymentId: "",
}

var FailedStateOutput = StateOutput{
	Status:    "Failed",
	PaymentId: "",
}

type Status int

// Order Status
const (
	StatusCreated        = Status(0)
	StatusFailed         = Status(1)
	StatusPending        = Status(2)
	StatusOrderSubmitted = Status(3)
	StatusPaymentSuccess = Status(4)
	StatusPaymentFailed  = Status(5)
	StatusOrderTimeout   = Status(6)
	StatusPaymentTimeout = Status(7)
)

// Order Status Display Text
var statusText = map[Status]string{
	StatusCreated:        "CREATED",
	StatusFailed:         "FAILED",
	StatusPending:        "PENDING",
	StatusOrderSubmitted: "ORDER_SUBMITTED",
	StatusPaymentSuccess: "PAYMENT_SUCCESS",
	StatusPaymentFailed:  "PAYMENT_FAILED",
	StatusOrderTimeout:   "ORDER_TIMEOUT",
	StatusPaymentTimeout: "PAYMENT_TIMEOUT",
}

// statusEvent define possible transition
var statusEvent = map[Status][]Event{
	StatusCreated:        {EventCreate},
	StatusPending:        {EventSubmit, EventOrderTimeout},
	StatusOrderSubmitted: {EventConfirm, EventPaymentTimeout},
}

func StatusText(status Status) string {
	return statusText[status]
}

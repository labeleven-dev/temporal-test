package state

type Event string

// define event
const (
	EventCreate         = Event("Create order")
	EventSubmit         = Event("Submit payment")
	EventConfirm        = Event("Confirm payment")
	EventOrderTimeout   = Event("Order timeout")
	EventPaymentTimeout = Event("Payment timeout")
)

// define event handler
var eventHandler = map[Event]Handler{
	EventCreate:         handlerCreate,
	EventSubmit:         handlerSubmit,
	EventConfirm:        handlerConfirm,
	EventOrderTimeout:   handlerOrderTimeout,
	EventPaymentTimeout: handlerPaymentTimeout,
}

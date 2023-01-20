package state

var (
	// create order intent
	handlerCreate = Handler(func(ctx *Ctx) (State, error) {
		if ctx.orderSuccess {
			return State{
				Status: StatusPending,
			}, nil
		} else {
			return State{
				Status: StatusFailed,
			}, nil
		}
	})

	// handlerSubmit
	handlerSubmit = Handler(func(ctx *Ctx) (State, error) {
		return State{
			Status:    StatusOrderSubmitted,
			PaymentId: ctx.paymentId,
		}, nil
	})

	// handlerConfirm
	handlerConfirm = Handler(func(ctx *Ctx) (State, error) {
		if ctx.paymentSuccess {
			return State{
				Status:    StatusPaymentSuccess,
				PaymentId: ctx.paymentId,
			}, nil
		} else {
			return State{
				Status:    StatusPaymentFailed,
				PaymentId: ctx.paymentId,
			}, nil
		}
	})

	// handlerOrderTimeout
	handlerOrderTimeout = Handler(func(ctx *Ctx) (State, error) {
		return State{
			Status:    StatusOrderTimeout,
			PaymentId: ctx.paymentId,
		}, nil
	})

	// handlerPaymentTimeout
	handlerPaymentTimeout = Handler(func(ctx *Ctx) (State, error) {
		return State{
			Status:    StatusPaymentTimeout,
			PaymentId: ctx.paymentId,
		}, nil
	})
)

package state

type Context func(*Ctx)

// Ctx define context
type Ctx struct {
	orderSuccess   bool
	paymentSuccess bool
	paymentId      string
}

func WithOrderSuccess(orderSuccess bool) Context {
	return func(ctx *Ctx) {
		ctx.orderSuccess = orderSuccess
	}
}

func WithPaymentSuccess(paymentSuccess bool) Context {
	return func(ctx *Ctx) {
		ctx.paymentSuccess = paymentSuccess
	}
}

func WithPaymentId(paymentId string) Context {
	return func(ctx *Ctx) {
		ctx.paymentId = paymentId
	}
}

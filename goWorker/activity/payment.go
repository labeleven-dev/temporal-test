package activity

import (
	"fmt"
	"github.com/google/uuid"
	"go.uber.org/zap"
)

type Payment struct {
	log *zap.SugaredLogger
}

func NewPayment(log *zap.SugaredLogger) *Payment {
	return &Payment{log: log}
}

type CreateOrderIntentResponse struct {
	Success bool
}

func (p *Payment) CreateOrderIntent(orderId string) (*CreateOrderIntentResponse, error) {

	p.log.Infof(fmt.Sprintf("Creating order intent for %s", orderId))

	return &CreateOrderIntentResponse{
		Success: true,
	}, nil
}

type SubmitPaymentResponse struct {
	PaymentId string
}

func (p *Payment) SubmitPayment(orderId string, paymentInfo string) (*SubmitPaymentResponse, error) {

	p.log.Infof(fmt.Sprintf("Submitting payment (%s) for %s", paymentInfo, orderId))

	return &SubmitPaymentResponse{
		PaymentId: uuid.New().String(),
	}, nil
}

type GetPaymentStatusResponse struct {
	Success bool
}

func (p *Payment) GetPaymentStatus(paymentId string) (*GetPaymentStatusResponse, error) {

	p.log.Infof(fmt.Sprintf("Checking payment status for %s", paymentId))

	return &GetPaymentStatusResponse{
		Success: true,
	}, nil
}

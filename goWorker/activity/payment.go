package activity

import (
	"fmt"
	"github.com/google/uuid"
	"go.uber.org/zap"
)

type Payment struct {
	log *zap.Logger
}

func NewPayment(log *zap.Logger) *Payment {
	return &Payment{log: log}
}

type CreateOrderIntentResponse struct {
	Success bool
}

func (p *Payment) CreateOrderIntent(orderId string) (*CreateOrderIntentResponse, error) {

	p.log.Info(fmt.Sprintf("Creating order intent for %s", orderId))

	return &CreateOrderIntentResponse{
		Success: true,
	}, nil
}

type SubmitPaymentResponse struct {
	PaymentId string
}

func (p *Payment) SubmitPayment(orderId string, paymentInfo string) (*SubmitPaymentResponse, error) {

	p.log.Info(fmt.Sprintf("Submitting payment (%s) for %s", paymentInfo, orderId))

	return &SubmitPaymentResponse{
		PaymentId: uuid.New().String(),
	}, nil
}

type GetPaymentStatusResponse struct {
	Success bool
}

func (p *Payment) GetPaymentStatus(paymentId string) (*GetPaymentStatusResponse, error) {

	p.log.Info(fmt.Sprintf("Checking payment status for %s", paymentId))

	return &GetPaymentStatusResponse{
		Success: true,
	}, nil
}

package main

import (
	"context"
	"fmt"
	"go.temporal.io/sdk/client"
	"go.temporal.io/sdk/worker"
	temporalWorkflow "go.temporal.io/sdk/workflow"
	"go.uber.org/fx"
	"go.uber.org/zap"
	"goWorker/activity"
	"goWorker/config"
	"goWorker/utils"
	"goWorker/workflow"
)

func NewWorker(config *config.Config, activity *activity.Payment, logger *zap.Logger) (client.Client, worker.Worker) {
	// Create the client object just once per process
	cli, err := client.Dial(client.Options{
		Logger: utils.NewZapAdapter(logger),
	})
	if err != nil {
		logger.Panic(fmt.Sprintf("unable to create Temporal client", err))
	}

	// init worker
	w := worker.New(cli, config.Temporal.TaskQueue, worker.Options{})

	// register activity
	w.RegisterActivity(activity.CreateOrderIntent)
	w.RegisterActivity(activity.SubmitPayment)
	w.RegisterActivity(activity.GetPaymentStatus)

	// register workflow
	if config.Temporal.WorkflowName == "order" {
		w.RegisterWorkflowWithOptions(workflow.Order, temporalWorkflow.RegisterOptions{
			Name: config.Temporal.WorkflowName,
		})
	} else if config.Temporal.WorkflowName == "orderX" {
		w.RegisterWorkflowWithOptions(workflow.OrderX, temporalWorkflow.RegisterOptions{
			Name: config.Temporal.WorkflowName,
		})
	} else {
		panic("workflow not implemented")
	}

	return cli, w
}

func startWorker(cli client.Client, w worker.Worker, lc fx.Lifecycle) {
	lc.Append(fx.Hook{
		OnStart: func(ctx context.Context) error {
			go func() {
				if err := w.Run(worker.InterruptCh()); err != nil {
					fmt.Println(err)
					panic("unable to start Temporal worker")
				}
			}()
			return nil
		},
		OnStop: func(ctx context.Context) error {
			w.Stop()
			cli.Close()
			return nil
		},
	})
}

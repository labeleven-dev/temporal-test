package main

import (
	"go.uber.org/fx"
	"goOrder/activity"
	"goOrder/config"
	"goOrder/infra"
)

func main() {
	fx.New(
		fx.Provide(config.NewConfig),
		fx.Provide(infra.NewLogger),
		fx.Provide(activity.NewPayment),
		fx.Provide(NewWorker),
		fx.Invoke(startWorker),
	).Run()
}

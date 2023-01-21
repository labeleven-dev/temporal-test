package infra

import (
	"fmt"
	"go.uber.org/zap"
	"go.uber.org/zap/zapcore"
	"goWorker/config"
	"gopkg.in/natefinch/lumberjack.v2"
	"os"
)

func NewLogger(config *config.Config) *zap.Logger {
	fileName := fmt.Sprintf("./logs/%s.log", config.Name)
	syncWriter := zapcore.AddSync(
		&lumberjack.Logger{
			Filename:   fileName,
			MaxSize:    1,
			MaxBackups: 1,
			LocalTime:  true,
			Compress:   true,
		})
	pe := zap.NewProductionEncoderConfig()
	pe.EncodeTime = zapcore.ISO8601TimeEncoder
	core := zapcore.NewTee(
		zapcore.NewCore(
			zapcore.NewJSONEncoder(pe),
			syncWriter,
			//
			zap.NewAtomicLevelAt(zap.DebugLevel)),
		zapcore.NewCore(zapcore.NewConsoleEncoder(pe),
			zapcore.AddSync(os.Stdout),
			zap.NewAtomicLevelAt(zap.DebugLevel)),
	)
	log := zap.New(
		core,
		zap.AddCaller(),
		zap.AddCallerSkip(1))

	return log
}

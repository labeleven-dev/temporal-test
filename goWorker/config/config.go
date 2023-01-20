package config

import (
	"fmt"
	"github.com/spf13/viper"
	"os"
)

type Config struct {
	Name     string         `mapstructure:"name" json:"name"`
	Temporal TemporalConfig `mapstructure:"temporal" json:"temporal"`
}

type TemporalConfig struct {
	WorkflowName string `mapstructure:"workflow_name" json:"workflow_name"`
	TaskQueue    string `mapstructure:"task_queue" json:"task_queue"`
}

func NewConfig() *Config {
	var config Config

	v := viper.New()

	workingdir, err := os.Getwd()
	if err != nil {
		panic(err)
	}
	fmt.Println(workingdir)

	v.SetConfigFile(fmt.Sprintf("%s/config.yaml", workingdir))

	if err := v.ReadInConfig(); err != nil {
		panic(err)
	}

	err = v.Unmarshal(&config)
	if err != nil {
		panic(err)
	}

	return &config
}

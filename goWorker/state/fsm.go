package state

import (
	"errors"
	"fmt"
	"sync"
)

type Handler func(ctx *Ctx) (State, error) // handle event and return state

// FSM state machine
type FSM struct {
	mu       sync.Mutex                   // mutex
	state    State                        // current state
	handlers map[Status]map[Event]Handler // match status to event handler
}

// GetState get Current State
func (f *FSM) GetState() State {
	return f.state
}

// GetStateOutput get Current State Output
func (f *FSM) GetStateOutput() StateOutput {
	return StateOutput{
		Status:    f.GetStateStatusText(),
		PaymentId: f.GetState().PaymentId,
	}
}

// GetStateStatus get Current Status
func (f *FSM) GetStateStatus() Status {
	return f.state.Status
}

// GetStateStatusText get Current Status text
func (f *FSM) GetStateStatusText() string {
	return StatusText(f.state.Status)
}

// set State
func (f *FSM) setState(newState State) {
	f.state = newState
}

// addHandlers
func (f *FSM) addHandlers() (*FSM, error) {
	if statusEvent == nil || len(statusEvent) <= 0 {
		return nil, errors.New("statusEvent not defined")
	}

	for status, events := range statusEvent {
		if len(events) <= 0 {
			return nil, errors.New(fmt.Sprintf("Status(%s) has no event", StatusText(status)))
		}

		for _, event := range events {
			handler := eventHandler[event]
			if handler == nil {
				return nil, errors.New(fmt.Sprintf("Event(%s) has not handler", event))
			}

			if _, ok := f.handlers[status]; !ok {
				f.handlers[status] = make(map[Event]Handler)
			}

			if _, ok := f.handlers[status][event]; ok {
				return nil, errors.New(fmt.Sprintf("Status(%s) with event(%s) has been defined", StatusText(status), event))
			}

			f.handlers[status][event] = handler
		}
	}

	return f, nil
}

// Call handle call
func (f *FSM) Call(event Event, ctxs ...Context) (State, error) {
	f.mu.Lock()
	defer f.mu.Unlock()

	events := f.handlers[f.GetStateStatus()]
	if events == nil {
		return InitState, errors.New(fmt.Sprintf("Status(%s) has not event", StatusText(f.GetStateStatus())))
	}

	ctx := new(Ctx)
	for _, f := range ctxs {
		f(ctx)
	}

	fn, ok := events[event]
	if !ok {
		return InitState, errors.New(fmt.Sprintf("Status(%s) cann't handle (%s)", StatusText(f.GetStateStatus()), event))
	}

	state, err := fn(ctx)
	if err != nil {
		return InitState, err
	}

	f.setState(state)

	return f.GetState(), nil
}

func NewFSM(initState State) (fsm *FSM, err error) {
	fsm = new(FSM)
	fsm.state = initState
	fsm.handlers = make(map[Status]map[Event]Handler)

	fsm, err = fsm.addHandlers()
	if err != nil {
		panic("new FSM error")
	}

	return
}

# Temporal Worker implementation in Go

- implement workflow `order`

# Starting

* Run `go mod tidy`
* To start the order Service (Go implementation), do `go run .`
* You can run more instances by starting new terminals
* Change `workflow_name` in `./config.yaml` to `order` or `orderX` implementation
* Test like how you would have tested for the Typescript implementation
    * make sure the `workflow_name`
      in `./config.yaml` is consistent with WORKFLOW_NAME_ORDER in `../src/consts.ts'
* Currently, it is not compatible with the order Service (Typescript implementation) (TODO)
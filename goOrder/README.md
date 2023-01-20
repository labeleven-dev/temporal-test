# Temporal Worker implementation in Go

- implement workflow `order`

# Starting

* Run `go mod tidy`
* To start the order Service (Go implementation), do `go run .`
* (Optional) you can also start the order Service (Typescript implementation), make sure the `workflow_name`
  in `./config.yaml` is consistent with WORKFLOW_NAME_ORDER in `../src/consts.ts'
    * currently it only works for `order`
* Test like how you would have tested for the Typescript implementation
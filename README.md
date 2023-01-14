# Starting

* Install Go and start Temporalite as per https://docs.temporal.io/application-development/foundations/?lang=typescript#temporalite
* `git clone` and `npm install` this repo
* Start the Order API server with `npm run api`
* Start the Order Service worker with `npm run service`

# Using

Just do `npm run test` to see behaviour (2 examples, one where payment is submitted and one where it's not):

```
Created order b64ee276-bdf7-43a4-aaef-32c299b0a69d
Order status is CREATED
Submitted payment for b64ee276-bdf7-43a4-aaef-32c299b0a69d
Order status is PENDING
Order status is ORDER_SUBMITTED
Order status is PAYMENT_SUCCESS
Created order fa3da612-9d87-4ffc-ab1b-c99992361949
Order status is CREATED
Order status is PENDING
Order status is ORDER_TIMEOUT
```
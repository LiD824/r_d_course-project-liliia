# Example stubs

Two ready-made stubs for `POST /v1/payment_intents`, enough to run the example performance test
(`perf/load.js`):

| Stub | Matches | Answers |
|---|---|---|
| `create-payment-intent-declined.json` | body contains `payment_method=pm_card_chargeDeclined` (priority 1) | 402, Stripe `card_error` |
| `create-payment-intent.json` | any other `POST /v1/payment_intents` (priority 5) | 200, a `succeeded` PaymentIntent built from your request |

WireMock doesn't load this folder. To use the stubs, copy them in and reload:

```bash
cp wiremock/examples/mappings/* wiremock/mappings/
cp wiremock/examples/__files/* wiremock/__files/
curl -X POST http://localhost:8080/__admin/mappings/reset
```

If you already have your own stub for `POST /v1/payment_intents`, use yours or replace it, not
both: WireMock would pick one of them unpredictably.

These stubs always answer the same way and remember nothing between calls. That's fine for load
tests, but they're not a full Stripe: for manual capture, capture and refund you write your own
(how: [docs/wiremock.md](../../docs/wiremock.md)).

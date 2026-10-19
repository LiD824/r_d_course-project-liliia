# Bug 3 — `idempotency_key` is ignored: an identical repeated request creates a second payment

- **ID:** BUG-03
- **Severity:** High
- **Priority:** High
- **Component:** `POST /api/payments`
- **Environment:** `ghcr.io/yyushchenko/merchant-api:1.1` + postgres:16, Stripe test mode, `http://localhost:3000`

## Summary

Sending the exact same create request twice with the same `idempotency_key` creates two payments
(and two Stripe PaymentIntents). Idempotency — the whole purpose of the key — does not work.

## Severity

**High.** This directly causes double charging in the exact scenario the key exists for (client
retry after a timeout or a network error), i.e. real money loss for the customer. It is not Critical
because it requires a retry to trigger and does not corrupt existing data.

## Steps to Reproduce

```powershell
$body = '{"amount":1234,"payment_method":"pm_card_visa","customer_email":"idem@example.com","idempotency_key":"TEST-IDEM-1"}'
$r1 = Invoke-RestMethod -Method Post -Uri http://localhost:3000/api/payments -ContentType 'application/json' -Body $body
$r2 = Invoke-RestMethod -Method Post -Uri http://localhost:3000/api/payments -ContentType 'application/json' -Body $body
$r1.id; $r2.id; $r1.stripe_pi_id; $r2.stripe_pi_id
```

## Expected Result

Both calls return the **same** payment and only one Stripe PaymentIntent is created.
`API.md` → `POST /api/payments` → `idempotency_key`: "Clients may safely **retry** a request … with
the same key: a retried request must **not** create a second payment".

## Actual Result

Two separate payments with two separate PaymentIntents.

## Evidence

```
$r1.id           = 943c0646-87f7-4bca-bb0a-7379b61fb6c7
$r2.id           = 8dec9183-bcc4-4f9e-a865-4020bf281481
$r1.stripe_pi_id = pi_3URHvvELoCvq5GvF087cM8jv
$r2.stripe_pi_id = pi_3URHvwELoCvq5GvF1q3bOWIZ
```

Automated proof: `tests/idempotency.integration.test.ts` → `[BUG-03] …`.

## Impact

A client that retries after a timeout/network error is charged twice. Direct financial risk.

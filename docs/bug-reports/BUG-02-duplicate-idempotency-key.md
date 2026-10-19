# Bug 2 — Duplicate `idempotency_key` (`order-123`) across different payments

- **ID:** BUG-02
- **Severity:** Low
- **Priority:** Low
- **Component:** `POST /api/payments`
- **Environment:** `ghcr.io/yyushchenko/merchant-api:1.1` + postgres:16, Stripe test mode, `http://localhost:3000`
- **Status:** open — same root cause as BUG-03; keep separate only for the "same key, different payload" case

## Summary

Several payments exist with the same `idempotency_key` (`order-123`) and different amounts. The
service neither reuses the first payment nor rejects reuse of the key with a different payload.

## Severity

**Low.** It does not by itself prove money loss (the same class of defect is tracked as High in
BUG-03). It is kept Low because `order-123` is the hard-coded value in the course Postman collection,
so part of the duplication may be legitimate test usage rather than a retry. Confirmation needed.

## Steps to Reproduce

1. Send two create requests reusing the key with different amounts:
   ```powershell
   Invoke-RestMethod -Method Post -Uri http://localhost:3000/api/payments -ContentType 'application/json' -Body '{"amount":1000,"payment_method":"pm_card_visa","idempotency_key":"order-123"}'
   Invoke-RestMethod -Method Post -Uri http://localhost:3000/api/payments -ContentType 'application/json' -Body '{"amount":5000,"payment_method":"pm_card_visa","idempotency_key":"order-123"}'
   ```
2. List payments and inspect `idempotency_key`.

## Expected Result

`API.md` → `POST /api/payments`: "a retried request must **not** create a second payment". At most
one payment should exist for a key; reuse with a different payload should be rejected.

## Actual Result

Multiple distinct payments share `idempotency_key: "order-123"` with different ids and amounts.

## Evidence

```json
{ "id": "f5142832-5402-4ead-ac90-c7e8f447dcdb", "amount": 2000, "idempotency_key": "order-123", "created_at": "2026-10-16T19:29:44.671Z" }
{ "id": "c8390b2b-422b-485a-9384-cd0f74b7e78e", "amount": 5000, "idempotency_key": "order-123", "created_at": "2026-10-16T19:29:29.554Z" }
```
Also seen: `3536560f-8a99-4eb2-8b29-6dbaf30a4e08`, `f88c2d6e-…`, `d653a785-…`.

## Impact

Same class of risk as BUG-03 (duplicate charges on retries). Before downgrading/merging, confirm
whether the tester deliberately reused the key.

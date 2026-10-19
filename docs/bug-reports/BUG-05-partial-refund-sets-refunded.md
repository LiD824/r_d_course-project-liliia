# Bug 5 — Partial refund sets the payment status to `refunded`, blocking the remaining amount

- **ID:** BUG-05
- **Severity:** High
- **Priority:** High
- **Component:** `POST /api/payments/{id}/refund`
- **Environment:** `ghcr.io/yyushchenko/merchant-api:1.1` + postgres:16, Stripe test mode, `http://localhost:3000`

## Summary

Refunding part of a payment (1000 of 5000) immediately marks the payment `refunded`. The remaining
4000 can no longer be refunded (`invalid_state`) — the money is stuck.

## Severity

**High.** Money gets stuck: the customer cannot get the rest of their money back, and the payment is
misreported as fully refunded. It is not Critical because no money is created or lost to the wrong
party — it is locked, and is recoverable only via a workaround.

## Steps to Reproduce

1. Refund 1000 of a 5000 payment:
   ```powershell
   Invoke-RestMethod -Method Post -Uri http://localhost:3000/api/payments/9d2dc936-f647-4829-b78e-95affe4226c2/refund -ContentType 'application/json' -Body '{"amount":1000,"reason":"Customer requested"}' | ConvertTo-Json -Depth 6
   ```
2. Read the payment status:
   ```powershell
   Invoke-RestMethod -Uri http://localhost:3000/api/payments/9d2dc936-f647-4829-b78e-95affe4226c2 | ConvertTo-Json -Depth 4
   ```
3. Try to refund the remaining 4000:
   ```powershell
   Invoke-RestMethod -Method Post -Uri http://localhost:3000/api/payments/9d2dc936-f647-4829-b78e-95affe4226c2/refund -ContentType 'application/json' -Body '{"amount":4000}'
   ```

## Expected Result

After a partial refund the payment stays `succeeded` and the remaining amount is refundable; the
status becomes `refunded` only once the **full** amount has been refunded.
`API.md` → `POST /api/payments/{id}/refund`: "a payment can be refunded in several parts; the
**total refunded can never exceed** the amount paid" and the status "becomes `refunded` once the
**full amount** has been refunded".

## Actual Result

Status becomes `refunded` after the 1000 refund; the 4000 refund is rejected with `invalid_state`.

## Evidence

Status after the partial refund: `"status": "refunded"` (API and UI `/payments`).
Second refund:
```json
{"error":{"type":"invalid_state","message":"Payment cannot be refunded (status: refunded)"}}
```

Automated proof: `tests/refund.integration.test.ts` → `[BUG-05] …` (two tests).

## Impact

Partial refunds leave the customer unable to recover the remaining balance; the payment is reported
as fully refunded, which also misleads reporting/reconciliation.

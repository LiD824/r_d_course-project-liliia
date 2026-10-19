# Bug 6 — Refund accepts an amount greater than the paid amount (`stripe_refund_id = null`)

- **ID:** BUG-06
- **Severity:** Critical
- **Priority:** High
- **Component:** `POST /api/payments/{id}/refund`
- **Environment:** `ghcr.io/yyushchenko/merchant-api:1.1` + postgres:16, Stripe test mode, `http://localhost:3000`

## Summary

Refunding 6000 against a 5000 payment succeeds with `200 OK`, records a refund of 6000, and marks
the payment `refunded` — while `stripe_refund_id` is `null`, i.e. no refund was actually created in
Stripe.

## Severity

**Critical.** The service reports money as refunded when no refund exists in Stripe
(`stripe_refund_id = null`). This is a phantom refund: the customer receives nothing while the system
closes the payment as refunded, directly breaking the reconciliation with the payment provider and
hiding the loss. Money- and integrity-critical.

## Steps to Reproduce

1. Create a 5000 automatic-capture payment.
2. Refund 6000:
   ```powershell
   Invoke-RestMethod -Method Post -Uri http://localhost:3000/api/payments/bfac8c6b-a71b-4d3e-9373-aa9d82f25631/refund -ContentType 'application/json' -Body '{"amount":6000}' | ConvertTo-Json -Depth 6
   ```
3. Inspect the payment status and the `refunds` table.

## Expected Result

`400`; a refund may never exceed the amount paid.
`API.md` → `POST /api/payments/{id}/refund`: "the **total refunded can never exceed** the amount
paid".

## Actual Result

`200 OK`, refund record with `amount: 6000`, `status: succeeded`, `stripe_refund_id: null`; payment
status becomes `refunded`.

## Evidence

```json
{
  "id": "c93d5341-6a79-4568-9c19-7a436e8f0377",
  "payment_id": "bfac8c6b-a71b-4d3e-9373-aa9d82f25631",
  "stripe_refund_id": null,
  "amount": 6000,
  "status": "succeeded",
  "created_at": "2026-10-16T21:11:14.209Z"
}
```
Database `refunds` table:
```
          payment_id                  | amount |  status   | stripe_refund_id
--------------------------------------+--------+-----------+-----------------
 bfac8c6b-a71b-4d3e-9373-aa9d82f25631 |   6000 | succeeded |
```

Automated proof: `tests/refund.integration.test.ts` → `[BUG-06] …`.

## Impact

The system believes $60 was refunded on a $50 payment while Stripe has no such refund. Reporting and
reconciliation are wrong and the discrepancy is silent.

## Open item

Verify in the Stripe Dashboard (`pi_3URIOrELoCvq5GvF0fKh4Mr5`) that no refund exists there, to
confirm the phantom-refund conclusion.

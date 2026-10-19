# Bug 4 — Capture accepts an amount greater than the authorized amount

- **ID:** BUG-04
- **Severity:** High
- **Priority:** High
- **Component:** `POST /api/payments/{id}/capture`
- **Environment:** `ghcr.io/yyushchenko/merchant-api:1.1` + postgres:16, Stripe test mode, `http://localhost:3000`

## Summary

A manual-capture payment authorized for 5000 can be captured for 6000. The service accepts the
over-capture with `200` and records `amount`/`captured_amount` = 6000 instead of rejecting it.

## Severity

**High.** Either the customer is charged more than they authorized, or the stored data diverges from
Stripe — both are serious money/data issues. It is not Critical because it requires the client to
send an amount above the authorization and does not silently corrupt existing records.

## Steps to Reproduce

1. Authorize 5000:
   ```powershell
   Invoke-RestMethod -Method Post -Uri http://localhost:3000/api/payments -ContentType 'application/json' -Body '{"amount":5000,"payment_method":"pm_card_visa","capture_method":"manual"}'
   ```
2. Capture 6000 (more than authorized):
   ```powershell
   Invoke-RestMethod -Method Post -Uri http://localhost:3000/api/payments/2594a2a3-5962-4e90-9b28-f702016313ee/capture -ContentType 'application/json' -Body '{"amount":6000}' | ConvertTo-Json -Depth 6
   ```

## Expected Result

`400`; a capture may be **less** than authorized (partial) but never **more**.
`API.md` → `POST /api/payments/{id}/capture` → `amount`: "May be **less** than authorized (partial
capture) … May **not** be more than authorized".

## Actual Result

`200 OK`; `amount` and `captured_amount` become 6000, status `succeeded`.

## Evidence

```json
{
  "id": "2594a2a3-5962-4e90-9b28-f702016313ee",
  "stripe_pi_id": "pi_3URI6VELoCvq5GvF1BsVHA0m",
  "amount": 6000,
  "status": "succeeded",
  "capture_method": "manual",
  "captured_amount": 6000
}
```
Database: `2594a2a3-… | 6000 | succeeded | manual | pi_3URI6VELoCvq5GvF1BsVHA0m`.

Automated proof: `tests/capture.integration.test.ts` → `[BUG-04] …`.

## Impact

Over-charge risk and/or broken reconciliation between the service and Stripe.

## Open item

Verify in the Stripe Dashboard (`pi_3URI6VELoCvq5GvF1BsVHA0m`) how much was actually captured
($50 vs $60).

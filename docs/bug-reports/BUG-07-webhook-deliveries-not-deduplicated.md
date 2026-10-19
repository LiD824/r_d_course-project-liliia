# Bug 7 — Duplicate webhook deliveries are not de-duplicated

- **ID:** BUG-07
- **Severity:** Medium
- **Priority:** Medium
- **Component:** `POST /api/webhooks`
- **Environment:** `ghcr.io/yyushchenko/merchant-api:1.1` + postgres:16, Stripe test mode, `http://localhost:3000`
- **Status:** candidate — fact confirmed, whether it is in scope must be agreed with the requirements

## Summary

Delivering the same event twice (same event `id`, as Stripe does on retry) stores a second row in
`webhook_events` and re-applies the status change. There is no uniqueness constraint on
`stripe_event_id`.

## Severity

**Medium.** It violates webhook idempotency, but the three handled event types are themselves
idempotent in effect (setting a status), so the immediate damage is limited. It would become High
for any side-effecting handler (receipts, inventory, ledger entries). Confirm scope before raising.

## Steps to Reproduce

1. Send the same event twice:
   ```powershell
   $evt = '{"id":"evt_test_1","type":"payment_intent.succeeded","data":{"object":{"id":"pi_3URIA8ELoCvq5GvF0p9bGVy0","object":"payment_intent","status":"succeeded","amount":5000}}}'
   Invoke-RestMethod -Method Post -Uri http://localhost:3000/api/webhooks -ContentType 'application/json' -Body $evt
   Invoke-RestMethod -Method Post -Uri http://localhost:3000/api/webhooks -ContentType 'application/json' -Body $evt
   ```
2. Inspect the table:
   ```powershell
   docker exec course-project-db-1 psql -U payments payments_db -c "SELECT stripe_event_id, event_type, processed_at FROM webhook_events ORDER BY processed_at;"
   ```

## Expected Result

A repeated delivery of the same event is not stored/processed a second time (webhook processing is
idempotent).

## Actual Result

Each delivery adds a new row and re-applies the change; no unique index on `stripe_event_id`.

## Evidence

```
     stripe_event_id      |          event_type           |        processed_at
--------------------------+-------------------------------+----------------------------
 evt_test_1               | payment_intent.succeeded      | 2026-10-18 20:35:14.180416
 evt_test_6               | payment_intent.succeeded      | 2026-10-18 20:45:15.315557
 evt_test_6               | payment_intent.succeeded      | 2026-10-18 20:45:53.189703
 evt_test_1               | payment_intent.succeeded      | 2026-10-18 20:46:37.791057
```
`\d webhook_events` → only `webhook_events_pkey` (on `id`); no unique index on `stripe_event_id`.

## Impact

Retried events are processed more than once. Harmless for the current status-only handlers, but the
pattern is unsafe and would cause duplicate side effects in a real integration.

# Bug 1 — `client_secret` leaked in `GET /api/payments` and `GET /api/payments/{id}`

- **ID:** BUG-01
- **Severity:** Medium
- **Priority:** Medium
- **Component:** `GET /api/payments`, `GET /api/payments/{id}`
- **Environment:** `ghcr.io/yyushchenko/merchant-api:1.1` + postgres:16, Stripe test mode, `http://localhost:3000`

## Summary

The read endpoints return the payment `client_secret`. According to `API.md` it must be returned
**only** in the response to `POST /api/payments` (it is not part of the Payment object). The service
exposes a Stripe secret on every read.

## Severity

**Medium.** This is a security/secret-exposure issue, not a money-loss one, so it is not Critical.
It is Medium rather than Low because `client_secret` is exactly the token needed to drive and finish
3D Secure / confirm a PaymentIntent from the client side: anyone who can reach the (unauthenticated)
read endpoints can obtain it. Its practical exploitability is limited (test mode, no auth), which
keeps it away from High.

## Steps to Reproduce

1. Create a payment:
   ```powershell
   Invoke-RestMethod -Method Post -Uri http://localhost:3000/api/payments -ContentType 'application/json' -Body '{"amount":5000,"payment_method":"pm_card_visa"}'
   ```
2. Read it back:
   ```powershell
   Invoke-RestMethod -Uri http://localhost:3000/api/payments/<id> | ConvertTo-Json -Depth 5
   ```
3. List payments:
   ```powershell
   Invoke-RestMethod -Uri 'http://localhost:3000/api/payments?limit=5' | ConvertTo-Json -Depth 5
   ```

## Expected Result

`client_secret` appears only in the `POST /api/payments` response.
`API.md` → `POST /api/payments` → Responses: "the Payment plus `client_secret` … it's only returned
in this response"; the Payment object definition has no `client_secret` field.

## Actual Result

`client_secret` is present in `GET /api/payments/{id}` and in every element of `GET /api/payments`.

## Evidence

`GET /api/payments/32095c64-6b0c-405e-8b52-fdbba9e43a85`:
```json
{
  "id": "32095c64-6b0c-405e-8b52-fdbba9e43a85",
  "stripe_pi_id": "pi_3URFpGELoCvq5GvF1uatH0dv",
  "client_secret": "pi_3URFpGELoCvq5GvF1uatH0dv_secret_yW6RnDiZerMdmAqPnEmdpK9hl",
  "amount": 5000
}
```

Automated proof: `tests/security.integration.test.ts` → `[BUG-01] …`.

## Impact

Breaks Stripe's security model and the documented API contract: the secret that should stay between
the service and the customer is handed to anyone reading the endpoints, allowing them to confirm the
payment / complete 3D Secure.

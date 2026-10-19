# Bug Reports — Merchant Payment Service

Course project. Service under test: `ghcr.io/yyushchenko/merchant-api:1.1` (black box),
Stripe test mode, Docker, `http://localhost:3000`. Reference behaviour — `course-project/docs/API.md`.

## Template

```
# Bug N — <short title>

- **ID:** BUG-N
- **Severity:** Critical / High / Medium / Low
- **Priority:** High / Medium / Low
- **Component:** <endpoint or page>
- **Environment:** <image:tag> + postgres:16, Stripe test mode, http://localhost:3000

## Summary
One or two sentences: what is broken and where.

## Severity
<level> — why this level (impact on money / data / security / users).

## Steps to Reproduce
1. ...
2. ...

## Expected Result
What API.md says must happen (with a reference).

## Actual Result
What the service really returns / stores.

## Evidence
API response / log line / database row.

## Impact
Business and technical consequences.
```

## List

| # | Title | Severity | Status |
|---|---|---|---|
| [01](BUG-01-client-secret-in-read-endpoints.md) | `client_secret` leaked in `GET /api/payments` and `GET /api/payments/{id}` | Medium | confirmed |
| [02](BUG-02-duplicate-idempotency-key.md) | Duplicate `idempotency_key` (`order-123`) across payments | Low | open |
| [03](BUG-03-idempotency-key-ignored.md) | `idempotency_key` ignored: a repeated request creates a second payment | High | confirmed |
| [04](BUG-04-capture-above-authorized.md) | Capture accepts an amount greater than the authorized amount | High | confirmed |
| [05](BUG-05-partial-refund-sets-refunded.md) | Partial refund sets the payment to `refunded` (remaining amount cannot be refunded) | High | confirmed |
| [06](BUG-06-refund-above-paid-amount.md) | Refund accepts an amount greater than the paid amount (`stripe_refund_id = null`) | Critical | confirmed |
| [07](BUG-07-webhook-deliveries-not-deduplicated.md) | Duplicate webhook deliveries are not de-duplicated | Medium | candidate |

Each bug has an automated proof in `tests/` (a `[BUG-NN]` test that fails against the current
build and passes once the bug is fixed).

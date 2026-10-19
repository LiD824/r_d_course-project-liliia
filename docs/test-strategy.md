# Test Strategy — Merchant Payment Service (course project)

Feature under test: `ghcr.io/yyushchenko/merchant-api:1.1` (Docker, black box) + `postgres:16`,
integrated with the Stripe API in **test mode**. Interfaces available: backend REST API and a small
frontend (`/checkout`, `/payments`). Reference for expected behaviour: `course-project/docs/API.md`.
Language/stack: TypeScript, Jest + axios; UI in Playwright.

---

## 1. What we tested and why

The service moves money, so the testing effort is concentrated on the places where a defect costs
money or leaves it inconsistent. The zones (by priority):

1. **Payment creation** (`POST /api/payments`) — happy path, card decline, 3D Secure, manual capture.
   This is the entry point where the amount and the charge are created; everything else operates on
   its result. Covered at integration level.
2. **Idempotency** (`idempotency_key`) — the feature designed to prevent double charging on client
   retries. A broken idempotency means a duplicated charge, so it gets dedicated tests.
3. **Capture** (`/capture`) — full and partial capture, capture after capture, and the rule that a
   capture can be less than but never more than the authorized amount.
4. **Refund** (`/refund`) — full and partial refunds, over-refunds, and refunds in invalid states.
   Refund arithmetic is where money most easily goes missing.
5. **Read / list** (`GET /api/payments`) — pagination, filters and defaults, plus checking that read
   endpoints do not over-expose data (secrets).
6. **Webhooks** (`POST /api/webhooks`) — the handled event types and error handling for malformed
   events, since webhooks drive payment status.
7. **Input validation and the error contract** — that invalid input is rejected with the documented
   `error.type` (consistency of the API contract).
8. **UI checkout/list** (`/checkout`, `/payments`) — the user-facing flow end to end.

These zones were chosen because they map 1:1 to the financial lifecycle (charge → capture → refund)
and to the two risks that matter for a payment service: **charging the wrong amount** and
**exposing/leaking data**.

## 2. Test types we used and why

| Type | Tooling | Why this type here |
|---|---|---|
| **Unit** | Jest (course lessons, existing) | Pure logic (retry/backoff, error classification) — fast, no service needed. Used where logic is reachable; the service itself is a black box, so it is a smaller slice here. |
| **Integration (API)** | Jest + axios, against the running Docker stack | The main layer. The requirement is to test the service "from the outside" over its real API; integration tests exercise real HTTP, real Stripe test mode and the real database. This is where the financial bugs live. |
| **Contract** | Jest + `ajv` + JSON Schema | Guard the *shape* of responses (fields, types, required, enums) so a change in the API structure is caught even if behaviour tests still pass. |
| **Integration (WireMock)** | Jest + WireMock | Reproduce Stripe conditions the sandbox cannot give (500/429, non-JSON body, dropped connection) and verify how the service maps them to its own error contract, plus what it actually sends to Stripe. |
| **E2E (UI)** | Playwright, Page Object Model | Validate the full checkout journey through the browser, headless, as an exercise of the POM pattern and a cross-layer smoke of UI → API → Stripe. |

A layered approach (unit → contract → integration → E2E) gives fast feedback on logic, structural
stability in the middle, and realistic money-path coverage at the integration layer, with E2E kept
small because it is the slowest and most brittle.

## 3. Risks covered

**Financial**
- Double charging on retries → **idempotency** tests (found BUG-03).
- Charging more than authorized → **over-capture** test (found BUG-04).
- Refunding more than paid → **over-refund** test (found BUG-06, phantom refund, `stripe_refund_id = null`).
- Money stuck after a partial refund → **partial-refund** tests (found BUG-05).
- Losing a payment record after a decline → the "declined payment is still recorded" test.

**Technical**
- Stripe outages/limits handled gracefully instead of crashing → WireMock error-mapping tests
  (500/429/timeout/non-JSON → documented `server_error`/`invalid_request`).
- API contract drift (response shape/enums) → JSON Schema contract tests.
- Pagination/filter boundary errors (limit clamp to 100, default 20, `page=0`) → list tests.
- Secret leakage through read endpoints → security test (found BUG-01).
- Non-idempotent webhook processing → webhook tests (BUG-07 candidate).

**UI**
- The checkout happy path and card-decline path through the browser → E2E tests.

## 4. Out of scope (and why)

- **Load / performance testing** — handled separately (k6 kit) and not part of this deliverable.
- **Real (live) Stripe mode and real 3DS challenges** — test mode only; a real cardholder
  authentication cannot be automated reliably.
- **Security penetration testing / authN-authZ** — the service has no authentication and is a
  training target; only the *leak* observed through the API (BUG-01) is reported.
- **Database internals / white-box unit tests of the service** — the image is a black box; the DB is
  inspected only to corroborate API findings (e.g. the `refunds` row).
- **Mobile, localization, accessibility** — not provided by the service.
- **Idempotency *storage* details** — we verify behaviour (no second payment), not how it is stored.

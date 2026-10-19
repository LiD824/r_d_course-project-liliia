# Merchant Payment Service — QA Course Project

Automated tests, bug reports and a test strategy for the **Merchant Payment Service**
(a black-box service shipped as the Docker image `ghcr.io/yyushchenko/merchant-api:1.1`
with a `postgres:16` database).

The service contains intentional bugs and is tested **only from the outside**: via its
HTTP API and its web UI. Reference behaviour is documented in
[`course-project/docs/API.md`](course-project/docs/API.md).

## Deliverables

| Artefact | Location |
|---|---|
| Bug reports (Summary, Severity, Steps, Expected, Actual) | [`docs/bug-reports/`](docs/bug-reports/) |
| Test strategy | [`docs/test-strategy.md`](docs/test-strategy.md) |
| API integration tests | [`tests/*.integration.test.ts`](tests/) |
| Contract tests (JSON Schema) | [`tests/contracts/`](tests/contracts/) |
| E2E UI tests (Playwright + Page Object Model) | [`tests/e2e/`](tests/e2e/) |
| CI pipeline | [`.github/workflows/course-project-tests.yml`](.github/workflows/course-project-tests.yml) |
| Service documentation | [`course-project/docs/`](course-project/docs/) |

## Test suites

| Suite | File(s) | What it covers |
|---|---|---|
| Payments | `tests/create-payment.integration.test.ts` | happy path, decline, 3DS, manual capture |
| Payments | `tests/validation.integration.test.ts` | negative input / field validation |
| List | `tests/list-payments.integration.test.ts` | listing, pagination, filters |
| Capture | `tests/capture.integration.test.ts` | full / partial / over capture |
| Refund | `tests/refund.integration.test.ts` | full / partial / over refund |
| Idempotency | `tests/idempotency.integration.test.ts` | repeated requests with the same idempotency key |
| Security | `tests/security.integration.test.ts` | secret handling in read endpoints |
| Webhooks | `tests/webhooks.integration.test.ts` | webhook delivery and processing |
| WireMock | `tests/wiremock.integration.test.ts` | Stripe failure handling (500/429/invalid/non-JSON/reset) |
| Contract | `tests/contracts/service.contract.test.ts` | API response shape against JSON Schema |
| E2E | `tests/e2e/*.spec.ts` | checkout and payments-list UI flows (POM) |

> **On the expected failures.** The API suite contains `[BUG-xx]` tests that assert the
> *correct* behaviour and therefore **fail** against the current build — they are the
> automated proof of the reported bugs. All other tests pass. Each failing test maps to a
> bug report in `docs/bug-reports/`.

## Prerequisites

- Node 20+
- Docker Desktop
- Stripe **test** keys (`sk_test_...`, `pk_test_...`)

## 1. Start the service (Stripe test mode)

```bash
cd course-project

# create .env with your Stripe test keys
#   STRIPE_SECRET_KEY=sk_test_...
#   STRIPE_PUBLISHABLE_KEY=pk_test_...

docker compose up -d
```

- Service: `http://localhost:3000`
- Database: `localhost:5433` (db/user/password: `payments`)

## 2. Install dependencies and run the tests

```bash
npm install          # from the repository root
npx playwright install chromium   # once, for the E2E suite

# PowerShell
$env:API_BASE_URL='http://localhost:3000'
```

| Command | What it runs | Needs |
|---|---|---|
| `npm run test:api` | all tests under `tests/` — API integration + contract, incl. bug proofs | running service |
| `npm run test:contract` | JSON Schema contract tests | nothing (live part needs the service) |
| `npm run test:api:wiremock` | Stripe failure-handling tests | WireMock-mode stack (below) |
| `npm run test:e2e` | Playwright UI flows | running service + chromium |

## 3. WireMock mode

Some Stripe failures cannot be produced in the sandbox; a WireMock-backed stack reproduces
them. Stubs live in `course-project/wiremock/mappings/` and are selected by a fake
`payment_method` value (e.g. `pm_error_500`). See
[`course-project/docs/wiremock.md`](course-project/docs/wiremock.md).

```bash
cd course-project
docker compose -f docker-compose.yml -f docker-compose.wiremock.yml up -d
cd ..

# PowerShell
$env:API_BASE_URL='http://localhost:3000'
$env:WIREMOCK_URL='http://localhost:8080'
npm run test:api:wiremock

# back to Stripe mode
cd course-project; docker compose up -d --remove-orphans
```

## 4. CI

[`.github/workflows/course-project-tests.yml`](.github/workflows/course-project-tests.yml)
runs on every push and pull request to `main`, without any secrets:

1. **contract** job — JSON Schema contract tests (no service required);
2. **wiremock** job — starts the WireMock-mode stack and runs the Stripe failure tests.

The full API suite needs the service in real Stripe test mode with a test key, so it is run
locally with the commands above.

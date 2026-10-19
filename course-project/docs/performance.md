# Performance testing with k6

Load tests send many requests at once and measure how the service behaves: how fast it answers,
how many requests fail, where it starts to slow down. You write them with [k6](https://k6.io).

They run against the service in **WireMock mode**, never against the real Stripe sandbox. The
sandbox has rate limits and isn't meant for load, and a load test would measure Stripe, not the
service. WireMock plays Stripe and answers after a simulated delay (~300 ms by default), like the
real API would.

k6 runs in Docker: nothing to install.

---

## Contents

1. [What's in the kit](#1-whats-in-the-kit)
2. [Before you start: stubs](#2-before-you-start-stubs)
3. [Start the perf stack](#3-start-the-perf-stack)
4. [Run the test](#4-run-the-test)
5. [Read the results](#5-read-the-results)
6. [Options](#6-options)
7. [Write your own tests](#7-write-your-own-tests)
8. [Switch back and clean up](#8-switch-back-and-clean-up)
9. [Troubleshooting](#9-troubleshooting)

---

## 1. What's in the kit

```
course-project/
├── docker-compose.perf.yml   adds k6, tunes WireMock for load, own database
├── perf/
│   ├── load.js               example load test: how many users, how long, pass/fail targets
│   ├── lib/
│   │   ├── flows.js          what one virtual user does (example: checkout or browse)
│   │   ├── setup.js          runs once before each test (see below)
│   │   └── config.js         URLs, Stripe latency, webhook secret
│   └── reports/              HTML reports (not committed)
└── wiremock/examples/        two example stubs for POST /v1/payment_intents
```

**One flow, many scenarios.** `lib/flows.js` describes what a user does. `load.js` only describes
the load: how many users, for how long, and which targets must be met. A spike or stress test uses
the same flow with different `options`.

**Before every test**, `lib/setup.js`:
- checks that the service is up and really talks to WireMock: it creates one payment and asks
  WireMock whether it received it. If not, the test stops with `Refusing to load-test real Stripe`
- sets WireMock's response delay for all stubs (the simulated Stripe latency)
- creates 20 payments, so browsing users have something to open

---

## 2. Before you start: stubs

The perf stack uses your stubs from `wiremock/mappings`. The example test needs at least a stub for
`POST /v1/payment_intents`, because it creates payments.

- **You have your own stub for it:** nothing to do.
- **You don't:** copy the examples, see [wiremock/examples/README.md](../wiremock/examples/README.md).

When you add more steps to the flow (capture, refund), you need stubs for those Stripe calls too:
[wiremock.md → Write a stub](wiremock.md#4-write-a-stub).

---

## 3. Start the perf stack

From the `course-project` folder:

```bash
docker compose -f docker-compose.yml -f docker-compose.wiremock.yml -f docker-compose.perf.yml up -d
```

This switches your stack to perf mode, the same way the WireMock command switches to WireMock mode.
Perf mode has **its own database**, so test payments never mix with your other data.

Check it:

```bash
docker compose logs api | grep "Stripe API"      # must say http://wiremock:8080
curl http://localhost:8080/__admin/mappings      # your stubs are listed
```

---

## 4. Run the test

```bash
docker compose -f docker-compose.yml -f docker-compose.wiremock.yml -f docker-compose.perf.yml run --rm --service-ports k6 run /perf/load.js
```

(`run --rm --service-ports k6` starts the k6 container and removes it afterwards; `run /perf/load.js`
is the k6 command. `/perf` inside the container is your `perf` folder.)

The example test takes 2 minutes. While it runs:
- the terminal shows progress
- **live dashboard:** http://localhost:5665

When it ends:
- the terminal prints a summary (section 5)
- **HTML report** with graphs: `perf/reports/report.html`, open it in your browser. The next run
  overwrites it: rename it to keep it, or name it per run (section 6)

> **Tip:** the command is long. On macOS / Linux you can save it as an alias:
> `alias k6perf='docker compose -f docker-compose.yml -f docker-compose.wiremock.yml -f docker-compose.perf.yml'`,
> then run `k6perf up -d` and `k6perf run --rm --service-ports k6 run /perf/load.js`.

---

## 5. Read the results

The summary at the end of the run starts with the **thresholds**, the pass/fail targets from
`load.js`:

```
█ THRESHOLDS

  checks
  ✓ 'rate>0.99' rate=100.00%

  http_req_duration{name:GET /api/payments}
  ✓ 'p(95)<100' p(95)=12.3ms
  ...
```

- `✓` the target is met, `✗` it isn't. If any threshold fails, k6 prints
  `thresholds on metrics '…' have been crossed` and exits with an error. That's a test result, not
  a broken setup.
- `p(95)<100`: 95% of these requests took less than 100 ms. Percentiles show what most users
  experience; an average hides the slow ones.
- `http_req_failed`: share of failed requests (status 400 and up, except the expected 402 for
  declined cards).
- `checks`: share of passed `check(...)` assertions in your flow.

Below the thresholds: all checks and metrics. Response times per endpoint (`name`) appear there only
for endpoints that have a threshold: one more reason to give every endpoint one.

The HTML report shows the same numbers over time: when response times start to grow as users are
added, that's the service reaching its limit.

---

## 6. Options

Add them to the `run` command, before `k6`:

| Option | Effect |
|---|---|
| `-e STRIPE_LATENCY_MS=0` | Instant "Stripe": measures only the service. Default `300` |
| `-e K6_WEB_DASHBOARD_EXPORT=/perf/reports/load-50users.html` | Save the report under another name |

And after `k6 run`, before the script:

| Option | Effect |
|---|---|
| `--stage 30s:50,2m:50,30s:0` | Other stages without editing the script: 30 s ramp to 50 users, 2 min steady, 30 s down |

Example, 50 users, instant Stripe, own report name:

```bash
docker compose -f docker-compose.yml -f docker-compose.wiremock.yml -f docker-compose.perf.yml run --rm --service-ports -e STRIPE_LATENCY_MS=0 -e K6_WEB_DASHBOARD_EXPORT=/perf/reports/load-50users.html k6 run --stage 30s:50,2m:50,30s:0 /perf/load.js
```

---

## 7. Write your own tests

The example is a starting point. The `TODO` comments in `perf/lib/flows.js` and `perf/load.js`
list what's missing:

- **A realistic traffic mix.** Real users don't all do the same thing: most look, fewer pay. The
  shares decide which endpoints get the load, and reads and writes cost very different amounts.
- **The rest of the checkout:** declined cards, manual capture, webhooks, refunds. Each new Stripe
  call needs a stub.
- **Thresholds** for every endpoint you call.
- **Other scenarios:** `spike.js` (a sudden jump in users, then back) and `stress.js` (keep adding
  users until it breaks). Same flow, different `options`.

k6 docs: [writing tests](https://grafana.com/docs/k6/latest/using-k6/),
[thresholds](https://grafana.com/docs/k6/latest/using-k6/thresholds/),
[test types](https://grafana.com/docs/k6/latest/testing-guides/test-types/).

> WireMock stubs always answer the same way, so some bugs that depend on real Stripe behavior
> don't show up in WireMock mode. Look for functional bugs against the real Stripe sandbox.

---

## 8. Switch back and clean up

### Back to the Stripe test mode

When you're done with load tests, switch the service back to the real Stripe sandbox:

```bash
docker compose up -d --remove-orphans
```

This restarts the service with your Stripe test keys from `.env` and removes the WireMock container.
Your normal database is exactly as you left it: the test payments stay in the perf database.

Check that it talks to Stripe again:

```bash
docker compose logs api | grep "Stripe API"      # must say https://api.stripe.com
```

To be sure, create a payment and check that it appears in your Stripe Dashboard.

### Other commands

| Command (in this folder) | Effect |
|---|---|
| `docker compose up -d --remove-orphans` | Back to the Stripe test mode (above) |
| `docker compose -f docker-compose.yml -f docker-compose.wiremock.yml up -d` | Back to WireMock mode, with your WireMock-mode database |
| `docker compose -f docker-compose.yml -f docker-compose.wiremock.yml -f docker-compose.perf.yml down -v` | Stop and **delete the perf-mode data** (the other databases are kept) |

The perf database grows with every test, and listing payments gets slower as it grows. For
comparable runs, start each one with an empty database: `down -v`, then `up -d` (section 3).

---

## 9. Troubleshooting

| Problem | Fix |
|---|---|
| **`Refusing to load-test real Stripe`** | The service isn't in WireMock mode. Start it with all three files (section 3) |
| **`WireMock got the request, but creating a payment returned 500`** | No stub matched `POST /v1/payment_intents`. Add one (section 2), then check `http://localhost:8080/__admin/requests/unmatched/near-misses` |
| **`WireMock not reachable`** | WireMock isn't running. Start the stack with all three files (section 3) |
| **`Service not healthy`** | `docker compose ps`: is `api` running and `healthy`? If not, `docker compose logs api` |
| **Every webhook check fails** | Start the stack with `docker-compose.perf.yml`: it sets the webhook secret the tests sign with |
| **Linux: the report isn't saved (`permission denied`)** | k6 runs as a different user in its container. Run `chmod 777 perf/reports` once |
| **The dashboard at http://localhost:5665 doesn't open** | Use `--service-ports` in the `run` command. The dashboard only exists while a test runs |
| **The test finished, but k6 doesn't exit and prints no summary** | The live dashboard is still open in a browser tab (or a VS Code preview): k6 waits for it. Close the tab. The HTML report is already saved |
| **`port is already allocated`** (5665) | Another k6 run is still going. Stop it with `Ctrl+C`, or `docker ps` and `docker stop` it |
| **Numbers differ a lot between runs** | Close heavy apps, keep the laptop plugged in and awake, and start with an empty database (section 8). k6, the service, the database and WireMock all share your computer |

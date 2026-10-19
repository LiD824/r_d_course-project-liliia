# Running the service against WireMock

Normally the service sends its Stripe API calls to the real Stripe sandbox. In **WireMock mode**
it sends them to [WireMock](https://wiremock.org), a stub server you control. You decide what
"Stripe" answers, so you can test situations the sandbox can't easily give you: Stripe errors,
slow or missing responses, unusual or broken data.

WireMock mode needs no Stripe account and no `.env` file. It uses the same Docker image as the
normal mode.

---

## Contents

1. [How it works](#1-how-it-works)
2. [Start WireMock mode](#2-start-wiremock-mode)
3. [Add your stubs](#3-add-your-stubs)
4. [Write a stub](#4-write-a-stub)
5. [See what the service sent](#5-see-what-the-service-sent)
6. [Switch back to Stripe](#6-switch-back-to-stripe)
7. [What doesn't work in WireMock mode](#7-what-doesnt-work-in-wiremock-mode)
8. [Troubleshooting](#8-troubleshooting)

---

## 1. How it works

```
normal mode:     you ──▶ api ──▶ Stripe sandbox   (https://api.stripe.com)
WireMock mode:   you ──▶ api ──▶ WireMock         (http://wiremock:8080, your stubs)
```

The service reads one setting, `STRIPE_API_BASE`: the address it sends Stripe API calls to. If it
isn't set, that's `https://api.stripe.com`. The file `docker-compose.wiremock.yml` sets it to
`http://wiremock:8080` and adds a WireMock container. The service then sends the **same requests
it would send to Stripe**, such as `POST /v1/payment_intents`, to WireMock.

Which Stripe requests the service makes, and what they look like:
[API.md → Stripe API calls](API.md#stripe-api-calls).

WireMock mode also has **its own database**, so payments you make against WireMock never mix with
your real Stripe test payments.

---

## 2. Start WireMock mode

From the `course-project` folder:

```bash
docker compose -f docker-compose.yml -f docker-compose.wiremock.yml up -d
```

If you have no `.env` file, Docker prints warnings like
`The "STRIPE_SECRET_KEY" variable is not set`. You can ignore them: WireMock mode uses placeholder
keys.

Check that the service really talks to WireMock. The first line of its log says where its Stripe
calls go:

```bash
docker compose logs api | grep "Stripe API"
# [2026-10-08T10:00:00.000Z] Stripe API: http://wiremock:8080
```

Check that WireMock is running (it lists your stubs, empty at first):

```bash
curl http://localhost:8080/__admin/mappings
```

| Address | What it is |
|---|---|
| http://localhost:3000 | The service, as usual |
| http://localhost:8080/__admin | WireMock's admin API: stubs, request journal, settings |
| `http://wiremock:8080` | WireMock as the service sees it, inside Docker. You never type this |

> **WireMock starts with no stubs.** Until you add some, every Stripe call fails, so for example
> creating a payment returns `500`. That's expected: WireMock answers "no stub matched", and the
> service can't read that as a Stripe response. Section 5 shows how to see exactly which request
> didn't match.

---

## 3. Add your stubs

There are two ways. Use either, or both.

### Option A: stub files (recommended)

Put JSON files in the `wiremock` folder:

```
course-project/
├── docker-compose.yml
├── docker-compose.wiremock.yml
└── wiremock/
    ├── mappings/      ← your stubs: one or more per .json file
    └── __files/       ← optional: response bodies, used with "bodyFileName"
```

This folder is mounted into the WireMock container. After you add or change files, tell WireMock to
reload them:

```bash
curl -X POST http://localhost:8080/__admin/mappings/reset
```

Files survive restarts, and you can commit them with your tests.

### Option B: the admin API

Send a stub to WireMock at runtime, for example from Postman or from your test code before a test:

```bash
curl -X POST http://localhost:8080/__admin/mappings \
  -H "Content-Type: application/json" \
  -d @my-stub.json
```

Stubs added this way are **lost when WireMock restarts**. To keep them, run
`curl -X POST http://localhost:8080/__admin/mappings/save`. It writes **all** current stubs to
`wiremock/mappings` and rewrites your existing files in WireMock's own format (with an `id`).

Other useful admin calls:

| Call | Effect |
|---|---|
| `GET /__admin/mappings` | List all stubs |
| `DELETE /__admin/mappings/{id}` | Remove one stub |
| `POST /__admin/mappings/reset` | Remove runtime stubs and reload the files |
| `POST /__admin/reset` | Same, and also clear the request journal |

Full reference: [WireMock admin API](https://wiremock.org/docs/standalone/admin-api-reference/).

---

## 4. Write a stub

A stub has two parts: which **request** it matches, and which **response** it returns.

```json
{
  "request": {
    "method": "POST",
    "urlPath": "/v1/…"
  },
  "response": {
    "status": 200,
    "headers": { "Content-Type": "application/json" },
    "jsonBody": { "…": "…" }
  }
}
```

**The request.** Use the Stripe path without the host, from
[API.md → Stripe API calls](API.md#stripe-api-calls).
- `urlPath` matches an exact path.
- For paths with an ID in them, use `urlPathPattern` with a regular expression, e.g.
  `"/v1/payment_intents/[^/]+"`.
- The service sends bodies **form-encoded** (`amount=5000&currency=usd&…`), not as JSON. To match
  on the body, use `"bodyPatterns": [{ "contains": "amount=5000" }]` or `matches` with a regular
  expression. JSON matchers like `equalToJson` won't match.
- If several stubs match, the one with the lowest `priority` number wins.

**The response.** For a success, return the Stripe object the real API would return; the Stripe API
reference shows each object and an example response (links in
[API.md](API.md#stripe-api-calls)). For a failure, return an HTTP error status with a
[Stripe error object](https://docs.stripe.com/api/errors).

**Dynamic responses.** Response templating is turned on, so a response can use values from the
request or generate new ones, for example `{{randomValue length=24 type='ALPHANUMERIC'}}`, or the
fields of the form body with the `formData` helper.
See [response templating](https://wiremock.org/docs/response-templating/).

**Delays and faults.** WireMock can also answer slowly (`"fixedDelayMilliseconds": 5000`) or break
the connection (`"fault": "CONNECTION_RESET_BY_PEER"`).
See [simulating faults](https://wiremock.org/docs/simulating-faults/).

More on matching: [request matching](https://wiremock.org/docs/request-matching/).

---

## 5. See what the service sent

WireMock records every request it receives in its **request journal**. This is the first place
to look when something doesn't behave as you expect.

| Call | Shows |
|---|---|
| `GET http://localhost:8080/__admin/requests` | All requests: method, URL, headers, body, and which stub answered |
| `GET http://localhost:8080/__admin/requests/unmatched` | Only requests no stub matched |
| `GET http://localhost:8080/__admin/requests/unmatched/near-misses` | For each unmatched request, the closest stub and **why** it didn't match |
| `DELETE http://localhost:8080/__admin/requests` | Clear the journal (e.g. before a test) |

Open them in the browser, Postman, or call them from your tests to check **what the service sent
to Stripe**, not only what it answered you.

Together with the service log (`docker compose logs -f api`), this shows the whole path of a request:
your call → the service → "Stripe" → back.

---

## 6. Switch back to Stripe

```bash
docker compose up -d --remove-orphans
```

This restarts the service with your real Stripe keys from `.env` and removes the WireMock
container. Your normal database is exactly as you left it. Both modes keep their data, so you can
switch back and forth.

| Command (in this folder) | Effect |
|---|---|
| `docker compose -f docker-compose.yml -f docker-compose.wiremock.yml up -d` | Start, or switch to, WireMock mode |
| `docker compose up -d --remove-orphans` | Start, or switch back to, the normal Stripe mode |
| `docker compose -f docker-compose.yml -f docker-compose.wiremock.yml down` | Stop WireMock mode. Data is kept |
| `docker compose -f docker-compose.yml -f docker-compose.wiremock.yml down -v` | Stop and **delete the WireMock-mode data**. Your normal database is kept |

---

## 7. What doesn't work in WireMock mode

- **The checkout page.** It loads Stripe's card form from Stripe's own servers in your browser, and
  that needs a real publishable key. Use the API directly instead.
- **The `stripe-cli` webhook forwarder** (`--profile webhooks`). There's no real Stripe to forward
  events from. To test webhooks, send events yourself
  ([README → Webhooks](../README.md#6-webhooks), option B).
- **The Stripe Dashboard.** Nothing reaches Stripe, so nothing appears there. WireMock's request
  journal is where you see what was "sent to Stripe".

---

## 8. Troubleshooting

| Problem | Fix |
|---|---|
| **Every payment call returns 500** | No stub matched. Check `GET /__admin/requests/unmatched/near-misses` (section 5). The service log shows `Invalid JSON received from the Stripe API` when WireMock answered "no match" or your stub returned a body that isn't JSON |
| **My stub file isn't used** | Run `curl -X POST http://localhost:8080/__admin/mappings/reset` after changing files. Check the file is valid JSON and in `wiremock/mappings` |
| **`docker compose logs api` shows `Stripe API: https://api.stripe.com`** | You started the normal mode. Use the command with both `-f` files (section 2) |
| **`port is already allocated`** (8080) | Another program uses port 8080. Stop it, or change the left-hand port in `docker-compose.wiremock.yml` (e.g. `"8081:8080"`, then use http://localhost:8081/__admin) |
| **I see my old payments / I don't see them** | Each mode has its own database (section 1). Check which mode you're in |
| **I want a clean start** | `docker compose -f docker-compose.yml -f docker-compose.wiremock.yml down -v`, then start again. This empties only the WireMock-mode database; your normal database and your stub files in `wiremock/` are kept |

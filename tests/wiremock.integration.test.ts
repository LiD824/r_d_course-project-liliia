/**
 * Stripe failure handling — runs against the WireMock-mode stack.
 *
 * These scenarios cannot be produced with the real Stripe sandbox: server
 * errors, rate limiting, non-JSON answers and dropped connections. WireMock
 * plays "Stripe" and returns them on demand.
 *
 * The stubs live in course-project/wiremock/mappings/ and are selected by a
 * fake payment_method value (pm_error_500, pm_error_429, …), so the service
 * forwards them unchanged to "Stripe".
 *
 * Requirements:
 *   - service running in WireMock mode (docs/wiremock.md):
 *       docker compose -f docker-compose.yml -f docker-compose.wiremock.yml up -d
 *   - environment: API_BASE_URL=http://localhost:3000 WIREMOCK_URL=http://localhost:8080
 *
 * Run:
 *   $env:API_BASE_URL='http://localhost:3000'; $env:WIREMOCK_URL='http://localhost:8080'; npm run test:api:wiremock
 */

import axios from 'axios';
import { api } from './helpers/api';

const WIREMOCK_URL = process.env.WIREMOCK_URL;
const describeIf = process.env.API_BASE_URL && WIREMOCK_URL ? describe : describe.skip;

const admin = WIREMOCK_URL
  ? axios.create({ baseURL: `${WIREMOCK_URL}/__admin`, timeout: 10_000, validateStatus: () => true })
  : (null as unknown as ReturnType<typeof axios.create>);

interface WiremockRequest {
  request: {
    method: string;
    url: string;
    headers: Record<string, string>;
    body: string;
  };
}

async function sentPaymentIntentRequest() {
  const { data } = await admin.get('/requests');
  const entries = data.requests as WiremockRequest[];
  const match = entries.find(
    (e) => e.request.method === 'POST' && e.request.url === '/v1/payment_intents'
  );
  return match?.request;
}

describeIf('Stripe failure handling (WireMock)', () => {
  beforeAll(async () => {
    // Reload the file-based stubs and clear the request journal
    await admin.post('/reset');
  });

  beforeEach(async () => {
    await admin.delete('/requests');
  });

  test('Stripe 500 api_error → 500 server_error', async () => {
    const res = await api.post('/api/payments', {
      amount: 5000,
      payment_method: 'pm_error_500',
    });

    expect(res.status).toBe(500);
    expect(res.data.error.type).toBe('server_error');
  });

  test('Stripe 429 rate_limit_error → 500 server_error', async () => {
    const res = await api.post('/api/payments', {
      amount: 5000,
      payment_method: 'pm_error_429',
    });

    expect(res.status).toBe(500);
    expect(res.data.error.type).toBe('server_error');
  });

  test('Stripe 400 invalid_request_error → 400 invalid_request with Stripe message', async () => {
    const res = await api.post('/api/payments', {
      amount: 5000,
      payment_method: 'pm_error_400',
    });

    expect(res.status).toBe(400);
    expect(res.data.error.type).toBe('invalid_request');
    expect(res.data.error.message).toMatch(/at least \$0\.50/i);
  });

  test('non-JSON answer from Stripe → 500 server_error', async () => {
    const res = await api.post('/api/payments', {
      amount: 5000,
      payment_method: 'pm_bad_json',
    });

    expect(res.status).toBe(500);
    expect(res.data.error.type).toBe('server_error');
  });

  test('dropped connection to Stripe → 500 server_error', async () => {
    const res = await api.post('/api/payments', {
      amount: 5000,
      payment_method: 'pm_connection_reset',
    });

    expect(res.status).toBe(500);
    expect(res.data.error.type).toBe('server_error');
  });

  test('the service sends Stripe a form-encoded, authenticated request', async () => {
    // Use the 400 stub: it fails before any database write, so the request
    // shape can be inspected without depending on the stub's fixed pi_ id.
    const res = await api.post('/api/payments', {
      amount: 5000,
      currency: 'usd',
      payment_method: 'pm_error_400',
      capture_method: 'manual',
      customer_email: 'wiremock@example.com',
      description: 'wm contract',
    });
    expect(res.status).toBe(400);

    const request = await sentPaymentIntentRequest();
    expect(request).toBeDefined();

    expect(request!.headers['Authorization']).toBe('Bearer sk_test_wiremock');
    expect(request!.headers['Content-Type']).toMatch(/application\/x-www-form-urlencoded/);

    const body = request!.body;
    expect(body).toContain('amount=5000');
    expect(body).toContain('currency=usd');
    expect(body).toContain('payment_method=pm_error_400');
    expect(body).toContain('capture_method=manual');
    expect(body).toContain('confirm=true');
  });
});

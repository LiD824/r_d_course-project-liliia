/**
 * Input validation and error contract for POST /api/payments and GET /api/payments/{id}.
 * Requirement source: course-project/docs/API.md
 */

import { api, PAYMENT_METHODS } from './helpers/api';

const describeIf = process.env.API_BASE_URL ? describe : describe.skip;

const url = (id: string) => `/api/payments/${id}`;

describeIf('POST /api/payments — validation', () => {
  const validBody = { amount: 5000, payment_method: PAYMENT_METHODS.visa };

  test('missing amount → 400 validation_error', async () => {
    const { payment_method } = validBody;
    const res = await api.post('/api/payments', { payment_method });

    expect(res.status).toBe(400);
    expect(res.data.error.type).toBe('validation_error');
  });

  test('amount = 0 → 400', async () => {
    const res = await api.post('/api/payments', { ...validBody, amount: 0 });

    expect(res.status).toBe(400);
    expect(res.data.error.type).toBe('validation_error');
  });

  test('non-integer amount → 400', async () => {
    const res = await api.post('/api/payments', { ...validBody, amount: 12.5 });

    expect(res.status).toBe(400);
    expect(res.data.error.type).toBe('validation_error');
  });

  test('missing payment_method → 400', async () => {
    const res = await api.post('/api/payments', { amount: 5000 });

    expect(res.status).toBe(400);
    expect(res.data.error.type).toBe('validation_error');
  });

  test('unsupported currency → 400', async () => {
    const res = await api.post('/api/payments', { ...validBody, currency: 'eur' });

    expect(res.status).toBe(400);
    expect(res.data.error.type).toBe('validation_error');
  });

  test('invalid capture_method → 400', async () => {
    const res = await api.post('/api/payments', { ...validBody, capture_method: 'later' });

    expect(res.status).toBe(400);
    expect(res.data.error.type).toBe('validation_error');
  });

  test('malformed customer_email → 400 invalid_request', async () => {
    const res = await api.post('/api/payments', {
      ...validBody,
      customer_email: 'not-an-email',
    });

    expect(res.status).toBe(400);
    expect(res.data.error.type).toBe('invalid_request');
    expect(res.data.error.message).toMatch(/email/i);
  });

  test('amount below the Stripe minimum → 400 invalid_request', async () => {
    const res = await api.post('/api/payments', { ...validBody, amount: 10 });

    expect(res.status).toBe(400);
    expect(res.data.error.type).toBe('invalid_request');
  });

  test('invalid JSON body → 400 invalid_request', async () => {
    const res = await api.post('/api/payments', '{ not json }', {
      headers: { 'Content-Type': 'application/json' },
    });

    expect(res.status).toBe(400);
    expect(res.data.error.type).toBe('invalid_request');
  });
});

describeIf('GET /api/payments/{id} — errors', () => {
  test('unknown but well-formed id → 404 not_found', async () => {
    const res = await api.get(url('00000000-0000-4000-8000-000000000000'));

    expect(res.status).toBe(404);
    expect(res.data.error.type).toBe('not_found');
  });

  test('malformed id → 400', async () => {
    const res = await api.get(url('not-a-uuid'));

    expect(res.status).toBe(400);
    expect(res.data.error.type).toBe('validation_error');
  });
});

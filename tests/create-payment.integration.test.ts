/**
 * POST /api/payments — happy paths, declines, 3DS.
 * Requirement source: course-project/docs/API.md
 */

import {
  api,
  createPayment,
  listPayments,
  PAYMENT_METHODS,
  uniqueEmail,
} from './helpers/api';

const describeIf = process.env.API_BASE_URL ? describe : describe.skip;

describeIf('POST /api/payments — creation', () => {
  test('automatic capture → 201 succeeded', async () => {
    const res = await api.post('/api/payments', {
      amount: 5000,
      payment_method: PAYMENT_METHODS.visa,
      customer_email: uniqueEmail(),
    });

    expect(res.status).toBe(201);
    expect(res.data).toMatchObject({
      amount: 5000,
      currency: 'usd',
      status: 'succeeded',
      capture_method: 'automatic',
    });
    expect(res.data.stripe_pi_id).toMatch(/^pi_/);
    expect(res.data.client_secret).toMatch(/_secret_/);
    expect(res.data.id).toEqual(expect.any(String));
  });

  test('manual capture → 201 requires_capture', async () => {
    const payment = await createPayment({ capture_method: 'manual' });

    expect(payment.status).toBe('requires_capture');
    expect(payment.capture_method).toBe('manual');
  });

  test('declined card → 402 card_error / generic_decline', async () => {
    const res = await api.post('/api/payments', {
      amount: 5000,
      payment_method: PAYMENT_METHODS.declined,
    });

    expect(res.status).toBe(402);
    expect(res.data.error).toMatchObject({
      type: 'card_error',
      code: 'card_declined',
      decline_code: 'generic_decline',
    });
  });

  test('insufficient funds → 402 decline_code insufficient_funds', async () => {
    const res = await api.post('/api/payments', {
      amount: 5000,
      payment_method: PAYMENT_METHODS.insufficientFunds,
    });

    expect(res.status).toBe(402);
    expect(res.data.error.decline_code).toBe('insufficient_funds');
  });

  test('3DS card → 201 requires_action with client_secret', async () => {
    const res = await api.post('/api/payments', {
      amount: 5000,
      payment_method: PAYMENT_METHODS.threeDS,
    });

    expect(res.status).toBe(201);
    expect(res.data.status).toBe('requires_action');
    expect(res.data.client_secret).toMatch(/_secret_/);
  });

  test('a declined payment is still recorded as failed', async () => {
    const email = uniqueEmail('declined');

    const res = await api.post('/api/payments', {
      amount: 5000,
      payment_method: PAYMENT_METHODS.declined,
      customer_email: email,
    });
    expect(res.status).toBe(402);

    const list = await listPayments({ limit: 100 });
    const found = list.payments.find((p) => p.customer_email === email);

    expect(found).toBeDefined();
    expect(found!.status).toBe('failed');
  });
});

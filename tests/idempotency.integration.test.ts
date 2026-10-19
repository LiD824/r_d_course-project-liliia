/**
 * Idempotency of POST /api/payments.
 * Requirement source: course-project/docs/API.md
 *
 * [BUG-03] test asserts the documented (correct) behaviour and therefore
 * fails against the current build — it is the automated proof of the bug.
 */

import { api, PAYMENT_METHODS, uniqueEmail, uniqueKey } from './helpers/api';

const describeIf = process.env.API_BASE_URL ? describe : describe.skip;

describeIf('POST /api/payments — idempotency', () => {
  test('[BUG-03] an identical retry with the same idempotency_key is not charged twice', async () => {
    const body = {
      amount: 1234,
      payment_method: PAYMENT_METHODS.visa,
      customer_email: uniqueEmail('idem'),
      idempotency_key: uniqueKey('TEST-IDEM'),
    };

    const first = await api.post('/api/payments', body);
    const second = await api.post('/api/payments', body);

    expect(first.status).toBe(201);
    expect(second.status).toBe(201);

    expect(second.data.id).toBe(first.data.id);
    expect(second.data.stripe_pi_id).toBe(first.data.stripe_pi_id);
  });

  test('distinct idempotency_keys create distinct payments', async () => {
    const base = {
      amount: 1000,
      payment_method: PAYMENT_METHODS.visa,
      customer_email: uniqueEmail('idem'),
    };

    const first = await api.post('/api/payments', { ...base, idempotency_key: uniqueKey('A') });
    const second = await api.post('/api/payments', { ...base, idempotency_key: uniqueKey('B') });

    expect(second.data.id).not.toBe(first.data.id);
  });
});

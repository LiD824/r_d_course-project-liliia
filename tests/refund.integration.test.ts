/**
 * POST /api/payments/{id}/refund — full/partial refund and amount rules.
 * Requirement source: course-project/docs/API.md
 *
 * [BUG-xx] tests assert the documented (correct) behaviour and therefore
 * fail against the current build — they are the automated proof of the bug.
 */

import { api, createPayment, getPayment, refundPayment } from './helpers/api';

const describeIf = process.env.API_BASE_URL ? describe : describe.skip;

const refundUrl = (id: string) => `/api/payments/${id}/refund`;

describeIf('POST /api/payments/{id}/refund', () => {
  test('full refund creates a refund and marks the payment refunded', async () => {
    const created = await createPayment({ amount: 5000 });

    const refund: any = await refundPayment(created.id, {
      amount: 5000,
      reason: 'Customer requested',
    });

    expect(refund.amount).toBe(5000);
    expect(refund.status).toBe('succeeded');
    expect(refund.stripe_refund_id).toMatch(/^re_/);

    const after = await getPayment(created.id);
    expect(after.status).toBe('refunded');
  });

  test('refund without body refunds the full amount', async () => {
    const created = await createPayment({ amount: 5000 });

    const refund: any = await refundPayment(created.id);

    expect(refund.amount).toBe(5000);

    const after = await getPayment(created.id);
    expect(after.status).toBe('refunded');
  });

  test('refunding a not-yet-captured payment → 400 invalid_state', async () => {
    const created = await createPayment({ amount: 5000, capture_method: 'manual' });

    const res = await api.post(refundUrl(created.id), { amount: 1000 });

    expect(res.status).toBe(400);
    expect(res.data.error.type).toBe('invalid_state');
  });

  test('refund with a non-integer amount → 400 validation_error', async () => {
    const created = await createPayment({ amount: 5000 });

    const res = await api.post(refundUrl(created.id), { amount: 12.5 });

    expect(res.status).toBe(400);
    expect(res.data.error.type).toBe('validation_error');
  });

  test('refund of an unknown payment → 404', async () => {
    const res = await api.post(
      refundUrl('00000000-0000-4000-8000-000000000000'),
      { amount: 100 }
    );

    expect(res.status).toBe(404);
  });

  test('[BUG-05] a partial refund keeps the payment in succeeded state', async () => {
    const created = await createPayment({ amount: 5000 });

    await refundPayment(created.id, { amount: 1000 });

    const after = await getPayment(created.id);
    expect(after.status).toBe('succeeded');
  });

  test('[BUG-05] the remaining amount is refundable after a partial refund', async () => {
    const created = await createPayment({ amount: 5000 });

    await refundPayment(created.id, { amount: 1000 });

    const second = await api.post(refundUrl(created.id), { amount: 4000 });

    expect(second.status).toBe(200);
    expect(second.data.amount).toBe(4000);
  });

  test('[BUG-06] refund above the paid amount is rejected', async () => {
    const created = await createPayment({ amount: 5000 });

    const res = await api.post(refundUrl(created.id), { amount: 6000 });

    expect(res.status).toBe(400);
    expect(res.data.error).toBeDefined();
  });
});

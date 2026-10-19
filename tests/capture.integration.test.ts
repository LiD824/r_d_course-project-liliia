/**
 * POST /api/payments/{id}/capture — full/partial capture, state and amount rules.
 * Requirement source: course-project/docs/API.md
 *
 * [BUG-xx] tests assert the documented (correct) behaviour and therefore
 * fail against the current build — they are the automated proof of the bug.
 */

import { api, capturePayment, createPayment, getPayment } from './helpers/api';

const describeIf = process.env.API_BASE_URL ? describe : describe.skip;

const captureUrl = (id: string) => `/api/payments/${id}/capture`;

describeIf('POST /api/payments/{id}/capture', () => {
  test('full capture marks the payment succeeded', async () => {
    const created = await createPayment({ capture_method: 'manual', amount: 5000 });

    const captured = await capturePayment(created.id, { amount: 5000 });

    expect(captured.status).toBe('succeeded');
    expect(captured.amount).toBe(5000);
    expect(captured.captured_amount).toBe(5000);
  });

  test('partial capture is allowed (amount < authorized)', async () => {
    const created = await createPayment({ capture_method: 'manual', amount: 5000 });

    const captured = await capturePayment(created.id, { amount: 3000 });

    expect(captured.status).toBe('succeeded');
    expect(captured.amount).toBe(3000);
    expect(captured.captured_amount).toBe(3000);
  });

  test('capture without body captures the full authorized amount', async () => {
    const created = await createPayment({ capture_method: 'manual', amount: 5000 });

    const captured = await capturePayment(created.id);

    expect(captured.captured_amount).toBe(5000);
  });

  test('capturing an already-captured payment → 400 invalid_state', async () => {
    const created = await createPayment({ capture_method: 'manual', amount: 5000 });
    await capturePayment(created.id, { amount: 5000 });

    const res = await api.post(captureUrl(created.id), { amount: 5000 });

    expect(res.status).toBe(400);
    expect(res.data.error.type).toBe('invalid_state');
  });

  test('capturing an auto-captured (succeeded) payment → 400 invalid_state', async () => {
    const created = await createPayment({ amount: 5000 });

    const res = await api.post(captureUrl(created.id), { amount: 5000 });

    expect(res.status).toBe(400);
    expect(res.data.error.type).toBe('invalid_state');
  });

  test('capture with a non-integer amount → 400 validation_error', async () => {
    const created = await createPayment({ capture_method: 'manual', amount: 5000 });

    const res = await api.post(captureUrl(created.id), { amount: 12.5 });

    expect(res.status).toBe(400);
    expect(res.data.error.type).toBe('validation_error');
  });

  test('capture of an unknown payment → 404', async () => {
    const res = await api.post(
      captureUrl('00000000-0000-4000-8000-000000000000'),
      { amount: 100 }
    );

    expect(res.status).toBe(404);
  });

  test('[BUG-04] capture above the authorized amount is rejected', async () => {
    const created = await createPayment({ capture_method: 'manual', amount: 5000 });

    const res = await api.post(captureUrl(created.id), { amount: 6000 });

    expect(res.status).toBe(400);
    expect(res.data.error).toBeDefined();

    const after = await getPayment(created.id);
    expect(after.amount).toBe(5000);
    expect(after.captured_amount).toBe(5000);
  });
});

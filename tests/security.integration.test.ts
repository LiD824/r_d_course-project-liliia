/**
 * Secret exposure in read endpoints.
 * Requirement source: course-project/docs/API.md
 *
 * [BUG-01] tests assert the documented (correct) behaviour and therefore
 * fail against the current build — they are the automated proof of the bug.
 */

import { createPayment, getPayment, listPayments } from './helpers/api';

const describeIf = process.env.API_BASE_URL ? describe : describe.skip;

describeIf('client_secret exposure', () => {
  test('create response returns client_secret (control)', async () => {
    const created = await createPayment({ amount: 5000 });

    expect(created.client_secret).toMatch(/_secret_/);
  });

  test('[BUG-01] GET /api/payments/{id} does not return client_secret', async () => {
    const created = await createPayment({ amount: 5000 });

    const fetched = await getPayment(created.id);

    expect(fetched).not.toHaveProperty('client_secret');
  });

  test('[BUG-01] GET /api/payments does not return client_secret', async () => {
    await createPayment({ amount: 5000 });

    const list = await listPayments({ limit: 100 });

    for (const payment of list.payments) {
      expect(payment).not.toHaveProperty('client_secret');
    }
  });
});

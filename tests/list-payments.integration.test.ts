/**
 * GET /api/payments — list, pagination, filters.
 * Requirement source: course-project/docs/API.md
 */

import { listPayments } from './helpers/api';

const describeIf = process.env.API_BASE_URL ? describe : describe.skip;

describeIf('GET /api/payments — list & pagination', () => {
  test('default limit is 20', async () => {
    const list = await listPayments();

    expect(list.limit).toBe(20);
    expect(list.payments.length).toBeLessThanOrEqual(20);
    expect(list.total).toEqual(expect.any(Number));
  });

  test('limit is respected', async () => {
    const list = await listPayments({ limit: 5 });

    expect(list.limit).toBe(5);
    expect(list.payments.length).toBeLessThanOrEqual(5);
  });

  test('limit is clamped to a maximum of 100', async () => {
    const list = await listPayments({ limit: 500 });

    expect(list.limit).toBe(100);
    expect(list.payments.length).toBeLessThanOrEqual(100);
  });

  test('invalid limit falls back to the default', async () => {
    const list = await listPayments({ limit: 'abc' });

    expect(list.limit).toBe(20);
  });

  test('page=0 is treated as the first page', async () => {
    const list = await listPayments({ page: 0, limit: 5 });

    expect(list.payments.length).toBeGreaterThan(0);
  });

  test('a page past the end returns an empty list', async () => {
    const list = await listPayments({ page: 99999, limit: 5 });

    expect(list.payments).toEqual([]);
  });

  test('results are ordered newest first', async () => {
    const list = await listPayments({ limit: 10 });

    const dates = list.payments.map((p) => new Date(String(p.created_at)).getTime());
    const sorted = [...dates].sort((a, b) => b - a);

    expect(dates).toEqual(sorted);
  });

  test('status filter returns only matching payments', async () => {
    const list = await listPayments({ status: 'succeeded', limit: 20 });

    expect(list.payments.length).toBeGreaterThan(0);
    for (const payment of list.payments) {
      expect(payment.status).toBe('succeeded');
    }
  });

  test('unknown status returns an empty result set', async () => {
    const list = await listPayments({ status: 'does-not-exist' });

    expect(list.payments).toEqual([]);
    expect(list.total).toBe(0);
  });

  test('pagination slices are consistent (page 1 vs page 2)', async () => {
    const page1 = await listPayments({ page: 1, limit: 5 });
    const page2 = await listPayments({ page: 2, limit: 5 });

    const ids1 = page1.payments.map((p) => p.id);
    const ids2 = page2.payments.map((p) => p.id);

    for (const id of ids2) {
      expect(ids1).not.toContain(id);
    }
  });
});

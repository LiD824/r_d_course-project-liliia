/**
 * POST /api/webhooks — event handling.
 * Requirement source: course-project/docs/API.md
 */

import { api, createPayment, getPayment, sendWebhook } from './helpers/api';

const describeIf = process.env.API_BASE_URL ? describe : describe.skip;

const succeededEvent = (piId: string) => ({
  id: `evt_${Date.now()}`,
  object: 'event',
  type: 'payment_intent.succeeded',
  created: Math.floor(Date.now() / 1000),
  data: {
    object: { id: piId, object: 'payment_intent', amount: 5000, status: 'succeeded' },
  },
});

describeIf('POST /api/webhooks', () => {
  test('payment_intent.succeeded moves the payment to succeeded', async () => {
    const created = await createPayment({ amount: 5000, capture_method: 'manual' });
    expect(created.status).toBe('requires_capture');

    const res = await sendWebhook(succeededEvent(created.stripe_pi_id));
    expect(res.status).toBe(200);
    expect(res.data).toEqual({ received: true });

    const after = await getPayment(created.id);
    expect(after.status).toBe('succeeded');
  });

  test('payment_intent.payment_failed moves the payment to failed', async () => {
    const created = await createPayment({ amount: 5000, capture_method: 'manual' });

    const res = await sendWebhook({
      id: `evt_${Date.now()}`,
      object: 'event',
      type: 'payment_intent.payment_failed',
      created: Math.floor(Date.now() / 1000),
      data: {
        object: {
          id: created.stripe_pi_id,
          object: 'payment_intent',
          amount: 5000,
          status: 'requires_payment_method',
        },
      },
    });

    expect(res.status).toBe(200);

    const after = await getPayment(created.id);
    expect(after.status).toBe('failed');
  });

  test('charge.refunded moves the payment to refunded', async () => {
    const created = await createPayment({ amount: 5000 });

    const res = await sendWebhook({
      id: `evt_${Date.now()}`,
      object: 'event',
      type: 'charge.refunded',
      created: Math.floor(Date.now() / 1000),
      data: {
        object: {
          id: 'ch_test_000',
          object: 'charge',
          payment_intent: created.stripe_pi_id,
          refunded: true,
        },
      },
    });

    expect(res.status).toBe(200);

    const after = await getPayment(created.id);
    expect(after.status).toBe('refunded');
  });

  test('an unhandled event type is accepted but changes nothing', async () => {
    const created = await createPayment({ amount: 5000 });

    const res = await sendWebhook({
      id: `evt_${Date.now()}`,
      object: 'event',
      type: 'customer.created',
      created: Math.floor(Date.now() / 1000),
      data: { object: { id: 'cus_test', object: 'customer' } },
    });

    expect(res.status).toBe(200);
    expect(res.data).toEqual({ received: true });

    const after = await getPayment(created.id);
    expect(after.status).toBe(created.status);
  });

  test('invalid JSON body → 400 validation_error', async () => {
    const res = await api.post('/api/webhooks', '{ not json }', {
      headers: { 'Content-Type': 'application/json' },
    });

    expect(res.status).toBe(400);
    expect(res.data.error.type).toBe('validation_error');
  });

  test('missing event type → 400 validation_error', async () => {
    const res = await sendWebhook({ id: `evt_${Date.now()}`, object: 'event' });

    expect(res.status).toBe(400);
    expect(res.data.error.type).toBe('validation_error');
  });
});

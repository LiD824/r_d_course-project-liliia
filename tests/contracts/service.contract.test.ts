/**
 * Contract tests — JSON Schema validation of the service API responses.
 *
 * Two layers:
 *   1. Live:     calls the running service and validates the real responses.
 *                Re-running this proves the response structure has not changed.
 *   2. Fixtures: validates sample objects, needs no service — so it always runs
 *                (locally and in CI) as a guard on the schemas themselves.
 *
 * Tool: Ajv. Schemas: ./schemas/service.schema.json
 */

import Ajv, { ValidateFunction } from 'ajv';
import serviceSchema from './schemas/service.schema.json';
import {
  api,
  capturePayment,
  createPayment,
  getPayment,
  listPayments,
  refundPayment,
} from '../helpers/api';

const SCHEMA_ID = serviceSchema.$id as string;

function validator(definition: string): ValidateFunction {
  const ajv = new Ajv({ allErrors: true, strict: false });
  ajv.addSchema(serviceSchema as object);
  const validate = ajv.getSchema(`${SCHEMA_ID}#/definitions/${definition}`);
  if (!validate) throw new Error(`Schema definition not found: ${definition}`);
  return validate;
}

const validators = {
  Payment: validator('Payment'),
  PaymentList: validator('PaymentList'),
  Refund: validator('Refund'),
  Error: validator('Error'),
  Health: validator('Health'),
  Config: validator('Config'),
};

describe('API response contracts — fixtures (no service)', () => {
  const paymentFixture = {
    id: '6f805049-2e90-4945-9a27-c6d02692d985',
    stripe_pi_id: 'pi_3UNvqXQpcYDzu4Ef0gYInc7D',
    amount: 5000,
    currency: 'usd',
    status: 'succeeded',
    capture_method: 'automatic',
    customer_email: 'test@example.com',
    description: null,
    metadata: {},
    idempotency_key: 'order-1',
    created_at: '2026-10-08T10:00:00.000Z',
    updated_at: '2026-10-08T10:00:00.000Z',
  };

  test('a valid Payment passes', () => {
    expect(validators.Payment(paymentFixture)).toBe(true);
  });

  test('a valid PaymentList passes', () => {
    expect(
      validators.PaymentList({ payments: [paymentFixture], total: 1, page: 1, limit: 20 })
    ).toBe(true);
  });

  test('a valid Refund passes', () => {
    const refund = {
      id: 'c93d5341-6a79-4568-9c19-7a436e8f0377',
      payment_id: paymentFixture.id,
      stripe_refund_id: 're_3UNvqXQpcYDzu4Ef0abc',
      amount: 5000,
      status: 'succeeded',
      reason: null,
      created_at: '2026-10-08T10:05:00.000Z',
    };
    expect(validators.Refund(refund)).toBe(true);
  });

  test('a valid Error passes and an unknown error.type fails', () => {
    expect(validators.Error({ error: { type: 'not_found', message: 'No payment' } })).toBe(true);
    expect(validators.Error({ error: { type: 'boom', message: 'x' } })).toBe(false);
  });

  test('Health and Config pass', () => {
    expect(
      validators.Health({ status: 'ok', db: 'connected', timestamp: '2026-10-08T10:00:00Z' })
    ).toBe(true);
    expect(validators.Config({ publishableKey: 'pk_test_51Abc' })).toBe(true);
  });

  test('a Payment missing stripe_pi_id fails', () => {
    const broken: Record<string, unknown> = { ...paymentFixture };
    delete broken.stripe_pi_id;

    expect(validators.Payment(broken)).toBe(false);
  });

  test('a Payment with a non-integer amount fails', () => {
    expect(validators.Payment({ ...paymentFixture, amount: '5000' })).toBe(false);
  });

  test('a Payment with an unknown status fails', () => {
    expect(validators.Payment({ ...paymentFixture, status: 'paid' })).toBe(false);
  });

  test('a Payment with a bad stripe_pi_id prefix fails', () => {
    expect(validators.Payment({ ...paymentFixture, stripe_pi_id: 'ch_123' })).toBe(false);
  });

  test('a Refund without a re_ prefix fails', () => {
    const refund = {
      id: 'c93d5341-6a79-4568-9c19-7a436e8f0377',
      payment_id: paymentFixture.id,
      stripe_refund_id: null,
      amount: 5000,
      status: 'succeeded',
      created_at: '2026-10-08T10:05:00.000Z',
    };
    expect(validators.Refund(refund)).toBe(false);
  });
});

const describeIf = process.env.API_BASE_URL ? describe : describe.skip;

describeIf('API response contracts — live service', () => {
  test('POST /api/payments → Payment', async () => {
    const created = await createPayment({ amount: 5000 });

    expect(validators.Payment(created)).toBe(true);
  });

  test('GET /api/payments/{id} → Payment', async () => {
    const created = await createPayment({ amount: 5000 });

    const fetched = await getPayment(created.id);

    expect(validators.Payment(fetched)).toBe(true);
  });

  test('GET /api/payments → PaymentList', async () => {
    const list = await listPayments({ limit: 5 });

    expect(validators.PaymentList(list)).toBe(true);
  });

  test('POST /api/payments/{id}/capture → Payment with captured_amount', async () => {
    const created = await createPayment({ amount: 5000, capture_method: 'manual' });

    const captured = await capturePayment(created.id, { amount: 3000 });

    expect(validators.Payment(captured)).toBe(true);
    expect(captured.captured_amount).toBe(3000);
  });

  test('POST /api/payments/{id}/refund → Refund', async () => {
    const created = await createPayment({ amount: 5000 });

    const refund = await refundPayment(created.id, { amount: 5000 });

    expect(validators.Refund(refund)).toBe(true);
  });

  test('GET /api/payments/{unknown} → Error', async () => {
    const res = await api.get('/api/payments/00000000-0000-4000-8000-000000000000');

    expect(res.status).toBe(404);
    expect(validators.Error(res.data)).toBe(true);
  });

  test('GET /api/health → Health', async () => {
    const res = await api.get('/api/health');

    expect(res.status).toBe(200);
    expect(validators.Health(res.data)).toBe(true);
  });

  test('GET /api/config → Config', async () => {
    const res = await api.get('/api/config');

    expect(res.status).toBe(200);
    expect(validators.Config(res.data)).toBe(true);
  });
});

/**
 * Shared helpers for the course-project API tests.
 *
 * The service under test is the real Docker stack
 * (ghcr.io/yyushchenko/merchant-api:1.1 + postgres) running in Stripe test mode.
 *
 * The whole suite is gated on API_BASE_URL: when it is not set the tests are
 * skipped, mirroring the convention used by the lesson integration suites.
 *
 * Run:
 *   $env:API_BASE_URL='http://localhost:3000'; npm run test:api
 */

import axios, { AxiosInstance } from 'axios';

export const BASE_URL = process.env.API_BASE_URL as string;

export const api: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  timeout: 20_000,
  validateStatus: () => true,
});

export const PAYMENT_METHODS = {
  visa: 'pm_card_visa',
  mastercard: 'pm_card_mastercard',
  declined: 'pm_card_chargeDeclined',
  insufficientFunds: 'pm_card_chargeDeclinedInsufficientFunds',
  threeDS: 'pm_card_threeDSecure2Required',
} as const;

export const DEFAULT_AMOUNT = 5000;

export interface Payment {
  id: string;
  stripe_pi_id: string;
  client_secret?: string;
  amount: number;
  currency: string;
  status: string;
  capture_method: string;
  customer_email: string | null;
  [key: string]: unknown;
}

export interface PaymentList {
  payments: Payment[];
  total: number;
  page: number;
  limit: number;
}

export async function createPayment(body: Record<string, unknown> = {}): Promise<Payment> {
  const { data } = await api.post('/api/payments', {
    amount: DEFAULT_AMOUNT,
    payment_method: PAYMENT_METHODS.visa,
    ...body,
  });
  return data;
}

export async function getPayment(id: string): Promise<Payment> {
  const { data } = await api.get(`/api/payments/${id}`);
  return data;
}

export async function listPayments(params: Record<string, unknown> = {}): Promise<PaymentList> {
  const { data } = await api.get('/api/payments', { params });
  return data;
}

export async function capturePayment(id: string, body: Record<string, unknown> = {}): Promise<Payment> {
  const { data } = await api.post(`/api/payments/${id}/capture`, body);
  return data;
}

export async function refundPayment(id: string, body: Record<string, unknown> = {}): Promise<unknown> {
  const { data } = await api.post(`/api/payments/${id}/refund`, body);
  return data;
}

export async function sendWebhook(event: unknown): Promise<{ status: number; data: any }> {
  const res = await api.post('/api/webhooks', event);
  return { status: res.status, data: res.data };
}

export function uniqueKey(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function uniqueEmail(prefix = 'auto'): string {
  return `${prefix}+${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
}

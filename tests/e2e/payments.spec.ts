import { test, expect } from '@playwright/test';
import { CheckoutPage } from './pages/CheckoutPage';
import { SuccessPage } from './pages/SuccessPage';
import { PaymentsPage } from './pages/PaymentsPage';
import { CARDS } from './fixtures/cards';

/** E2E — the payments list and that a UI-created payment shows up in it. */

test.describe('Payments list', () => {
  test('shows rows and pagination info', async ({ page }) => {
    const payments = new PaymentsPage(page);
    await payments.goto();

    await expect(payments.rows.first()).toBeVisible();
    await expect(payments.pageInfo).toContainText(/Page 1 of/);
  });

  test('a payment created at checkout appears in the list', async ({ page }) => {
    const checkout = new CheckoutPage(page);
    await checkout.goto();
    await checkout.fillEmail(`e2e+${Date.now()}@example.com`);
    await checkout.setAmount('12.34');
    await checkout.fillCard(CARDS.visa.number, CARDS.visa.expiry, CARDS.visa.cvc);
    await checkout.pay();

    await expect(page).toHaveURL(/\/success\?payment_id=/);
    const success = new SuccessPage(page);
    const paymentId = await success.paymentIdText();
    expect(paymentId).not.toBe('');

    const payments = new PaymentsPage(page);
    await payments.goto();

    await expect(payments.rowFor(paymentId)).toBeVisible();
  });
});

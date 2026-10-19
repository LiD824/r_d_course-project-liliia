import { test, expect } from '@playwright/test';
import { CheckoutPage } from './pages/CheckoutPage';
import { SuccessPage } from './pages/SuccessPage';
import { CARDS } from './fixtures/cards';

/** E2E — checkout flow through the UI (Page Object Model). */

const email = () => `e2e+${Date.now()}@example.com`;

test.describe('Checkout flow', () => {
  test('happy path: a valid card completes the payment', async ({ page }) => {
    const checkout = new CheckoutPage(page);
    await checkout.goto();

    await checkout.fillEmail(email());
    await checkout.setAmount('50.00');
    await checkout.fillCard(CARDS.visa.number, CARDS.visa.expiry, CARDS.visa.cvc);
    await checkout.pay();

    await expect(page).toHaveURL(/\/success\?payment_id=/);

    const success = new SuccessPage(page);
    await expect(success.confirmation).toHaveText('Payment Successful!');
    await expect(success.status).toHaveText('succeeded');
    await expect(success.paymentId).not.toBeEmpty();
  });

  test('a declined card shows an error and stays on checkout', async ({ page }) => {
    const checkout = new CheckoutPage(page);
    await checkout.goto();

    await checkout.fillEmail(email());
    await checkout.setAmount('50.00');
    await checkout.fillCard(CARDS.declined.number, CARDS.declined.expiry, CARDS.declined.cvc);
    await checkout.pay();

    await expect(checkout.errorMessage).toContainText(/declined/i);
    await expect(page).toHaveURL(/\/checkout/);
  });

  test('manual capture authorizes without charging', async ({ page }) => {
    const checkout = new CheckoutPage(page);
    await checkout.goto();

    await checkout.fillEmail(email());
    await checkout.setAmount('50.00');
    await checkout.setManualCapture(true);
    await checkout.fillCard(CARDS.visa.number, CARDS.visa.expiry, CARDS.visa.cvc);
    await checkout.pay();

    await expect(page).toHaveURL(/\/success\?payment_id=/);

    const success = new SuccessPage(page);
    await expect(success.confirmation).toHaveText('Payment Authorized');
    await expect(success.status).toHaveText('requires_capture');
  });
});

import { Page, Locator } from '@playwright/test';

/**
 * Page Object for /checkout.
 * Selectors come from the data-testid attributes rendered by the service.
 */
export class CheckoutPage {
  readonly page: Page;
  readonly email: Locator;
  readonly amount: Locator;
  readonly manualCapture: Locator;
  readonly payButton: Locator;
  readonly errorMessage: Locator;

  constructor(page: Page) {
    this.page = page;
    this.email = page.getByTestId('email');
    this.amount = page.getByTestId('amount');
    this.manualCapture = page.getByTestId('manual-capture');
    this.payButton = page.getByTestId('pay-button');
    this.errorMessage = page.getByTestId('error-message');
  }

  async goto(): Promise<void> {
    await this.page.goto('/checkout');
    await this.payButton.waitFor({ state: 'visible' });
  }

  async fillEmail(email: string): Promise<void> {
    await this.email.fill(email);
  }

  async setAmount(amount: string): Promise<void> {
    await this.amount.fill(amount);
  }

  async setManualCapture(enabled: boolean): Promise<void> {
    if (enabled) await this.manualCapture.check();
    else await this.manualCapture.uncheck();
  }

  /** Types card details into the Stripe Elements iframe. */
  async fillCard(number: string, expiry: string, cvc: string): Promise<void> {
    const frame = this.page.frameLocator('iframe[title="Secure card payment input frame"]');
    await frame.locator('input[name="cardnumber"]').fill(number);
    await frame.locator('input[name="exp-date"]').fill(expiry);
    await frame.locator('input[name="cvc"]').fill(cvc);
  }

  async pay(): Promise<void> {
    await this.payButton.click();
  }

  async errorText(): Promise<string> {
    return (await this.errorMessage.textContent()) ?? '';
  }
}

import { Page, Locator } from '@playwright/test';

/** Page Object for /success (payment result). */
export class SuccessPage {
  readonly page: Page;
  readonly confirmation: Locator;
  readonly paymentId: Locator;
  readonly amount: Locator;
  readonly status: Locator;
  readonly errorMessage: Locator;

  constructor(page: Page) {
    this.page = page;
    this.confirmation = page.getByTestId('confirmation');
    this.paymentId = page.getByTestId('payment-id');
    this.amount = page.getByTestId('amount');
    this.status = page.getByTestId('status');
    this.errorMessage = page.getByTestId('error-message');
  }

  async paymentIdText(): Promise<string> {
    return ((await this.paymentId.textContent()) ?? '').trim();
  }
}

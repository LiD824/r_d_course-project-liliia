import { Page, Locator } from '@playwright/test';

/** Page Object for /payments (transaction list with capture/refund actions). */
export class PaymentsPage {
  readonly page: Page;
  readonly rows: Locator;
  readonly pageInfo: Locator;
  readonly message: Locator;
  readonly prevButton: Locator;
  readonly nextButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.rows = page.getByTestId('payment-row');
    this.pageInfo = page.getByTestId('page-info');
    this.message = page.getByTestId('message');
    this.prevButton = page.getByTestId('prev-page');
    this.nextButton = page.getByTestId('next-page');
  }

  async goto(): Promise<void> {
    await this.page.goto('/payments');
    await this.pageInfo.waitFor({ state: 'visible' });
  }

  rowFor(paymentId: string): Locator {
    return this.page.locator(`tr[data-payment-id="${paymentId}"]`);
  }
}

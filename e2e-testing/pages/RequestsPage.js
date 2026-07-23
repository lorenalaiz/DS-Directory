const { BasePage } = require('./BasePage');

class RequestsPage extends BasePage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    super(page);
    this.tab = page.getByRole('button', { name: 'Requests' });
  }

  async goto() {
    await this.tab.click();
  }

  /** A request card for the given entry name, optionally scoped to a request type. */
  card(name, { type } = {}) {
    let locator = this.page
      .locator('#gridAreaReq .card')
      .filter({ hasText: name });
    if (type) {
      locator = locator.filter({ hasText: type });
    }
    return locator;
  }

  async approveEdit(name) {
    this.page.once('dialog', (dialog) => dialog.accept());
    await this.card(name, { type: 'Edit request' }).getByRole('button', { name: 'Approve edit' }).click();
  }

  async approveRemoval(name) {
    this.page.once('dialog', (dialog) => dialog.accept());
    await this.card(name, { type: 'Removal request' }).getByRole('button', { name: 'Approve (delete)' }).click();
  }

  async deny(name, { type } = {}) {
    this.page.once('dialog', (dialog) => dialog.accept());
    await this.card(name, { type }).getByRole('button', { name: 'Deny' }).click();
  }
}

module.exports = { RequestsPage };

const { BasePage } = require('./BasePage');

class MessagesPage extends BasePage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    super(page);
    this.tab = page.getByRole('button', { name: 'Messages' });
  }

  async goto() {
    await this.tab.click();
  }

  card(name) {
    return this.page
      .locator('#gridAreaMsg .card')
      .filter({ has: this.page.getByRole('heading', { name, exact: true }) });
  }
}

module.exports = { MessagesPage };

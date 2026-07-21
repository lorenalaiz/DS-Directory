const { BasePage } = require('./BasePage');

class HomePage extends BasePage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    super(page);
    this.heading = page.locator('h1');
  }

  async goto() {
    await super.goto('/');
  }
}

module.exports = { HomePage };

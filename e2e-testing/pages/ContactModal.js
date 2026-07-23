class ContactModal {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.openButton = page.getByRole('button', { name: 'Contact' });
    this.nameInput = page.locator('#contact-name');
    this.messageInput = page.locator('#contact-message');
    this.submitButton = page.locator('#submitContactBtn');
  }

  async open() {
    await this.openButton.click();
  }

  async submit({ name, message }) {
    await this.open();
    await this.nameInput.fill(name);
    await this.messageInput.fill(message);
    await this.submitButton.click();
  }
}

module.exports = { ContactModal };

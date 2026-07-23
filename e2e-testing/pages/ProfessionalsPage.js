const { BasePage } = require('./BasePage');

class ProfessionalsPage extends BasePage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    super(page);
    this.addButton = page.getByRole('button', { name: '+ Add professional' });
    this.nameInput = page.locator('#f-nome');
    this.phoneInput = page.locator('#f-telefone');
    this.saveButton = page.locator('#saveBtn');
    this.cancelButton = page.locator('#overlay').getByRole('button', { name: 'Cancel' });

    this.requesterNameInput = page.getByPlaceholder("So the admin knows who's asking");
    this.requestRemovalReasonInput = page.getByPlaceholder('Why should this be removed?');
    this.sendRequestButton = page.getByRole('button', { name: 'Send request' });
    this.sendForApprovalButton = page.getByRole('button', { name: 'Send for approval' });

    this.reviewAuthorInput = page.locator('#rv-author');
    this.reviewCommentInput = page.locator('#rv-comment');
    this.reviewSubmitButton = page.locator('#submitReviewBtn');
    this.reviewsList = page.locator('#reviewsList');
    this.closeReviewsButton = page.locator('#closeReviewsBtn');
  }

  async goto() {
    await super.goto('/');
    await this.page.getByRole('button', { name: 'Professionals' }).click();
  }

  specialtyChip(specialty) {
    return this.page.locator('#overlay').getByText(specialty, { exact: true });
  }

  card(name) {
    return this.page
      .locator('#gridArea .card')
      .filter({ has: this.page.getByRole('heading', { name, exact: true }) });
  }

  async create(name, specialty) {
    await this.addButton.click();
    await this.nameInput.fill(name);
    await this.specialtyChip(specialty).click();
    await this.saveButton.click();
  }

  async openRequestRemovalModal(name) {
    await this.card(name).getByRole('button', { name: 'Request removal' }).click();
  }

  /** Non-admin (or stale-rendered admin) removal path: goes to the request queue. */
  async requestRemoval(name, requesterName, reason) {
    await this.openRequestRemovalModal(name);
    await this.requesterNameInput.fill(requesterName);
    await this.requestRemovalReasonInput.fill(reason);
    await this.sendRequestButton.click();
  }

  /** Non-admin edit path: opens the form prefilled, changes the phone field, and sends for approval. */
  async requestEditPhone(name, requesterName, newPhone) {
    await this.openEditForm(name);
    await this.phoneInput.fill(newPhone);
    await this.saveButton.click();
    await this.requesterNameInput.fill(requesterName);
    await this.sendForApprovalButton.click();
  }

  /** Admin-only direct delete — confirms the native browser dialog. */
  async deleteDirectly(name) {
    this.page.once('dialog', (dialog) => dialog.accept());
    await this.card(name).getByRole('button', { name: 'Delete' }).click();
  }

  async openEditForm(name) {
    await this.card(name).getByRole('button', { name: 'Edit' }).click();
  }

  async openReviewsModal(name) {
    await this.card(name).getByRole('button', { name: /review/i }).click();
  }

  reviewStar(value) {
    return this.page.locator(`#starInputReview span[data-v="${value}"]`);
  }

  async postReview(name, { author, rating, comment }) {
    await this.openReviewsModal(name);
    await this.reviewAuthorInput.fill(author);
    await this.reviewStar(rating).click();
    await this.reviewCommentInput.fill(comment);
    await this.reviewSubmitButton.click();
  }
}

module.exports = { ProfessionalsPage };

const { test, expect, ADMIN_EMAIL, ADMIN_PASSWORD, purgeDocsWhere } = require('../../fixtures');
const { HomePage } = require('../../pages/HomePage');
const { ContactModal } = require('../../pages/ContactModal');
const { MessagesPage } = require('../../pages/MessagesPage');

test.describe('Contact', () => {
  test('contact form submission is visible to admin in the Messages tab', async ({ page, request }) => {
    const homePage = new HomePage(page);
    const contactModal = new ContactModal(page);
    const messagesPage = new MessagesPage(page);
    const name = `E2E Test Contact ${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const messageText = 'This is an automated test message.';

    await homePage.goto();
    try {
      await contactModal.submit({ name, message: messageText });
      await expect(page.getByText('Thanks — your message has been sent!')).toBeVisible();

      await homePage.loginAsAdmin(ADMIN_EMAIL, ADMIN_PASSWORD);
      await messagesPage.goto();
      const card = messagesPage.card(name);
      await expect(card).toBeVisible();
      await expect(card).toContainText(messageText);
      await homePage.signOut();
    } finally {
      await purgeDocsWhere(request, 'ds-network-messages', 'name', name);
    }
  });
});

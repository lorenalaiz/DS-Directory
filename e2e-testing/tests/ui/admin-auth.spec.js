const { test, expect } = require('@playwright/test');
const { HomePage } = require('../../pages/HomePage');

test.describe('Admin authentication', () => {
  test('admin login grants access to admin-only tabs and controls', async ({ page }) => {
    const homePage = new HomePage(page);
    await homePage.goto();

    await expect(homePage.messagesTab).toBeHidden();
    await expect(homePage.activityTab).toBeHidden();
    await expect(homePage.requestsTab).toBeHidden();

    await homePage.loginAsAdmin(
      process.env.ADMIN_TEST_EMAIL,
      process.env.ADMIN_TEST_PASSWORD,
    );

    await expect(homePage.messagesTab).toBeVisible();
    await expect(homePage.activityTab).toBeVisible();
    await expect(homePage.requestsTab).toBeVisible();
    await expect(homePage.adminToolsButton).toBeVisible();
    await expect(homePage.contactButton).toBeHidden();
    await expect(homePage.ndisGuideTab).toBeHidden();
    await expect(homePage.installAppButton).toBeHidden();

    await homePage.signOut();
  });

  test('admin login with invalid credentials shows an error and grants no access', async ({ page }) => {
    const homePage = new HomePage(page);
    await homePage.goto();

    await homePage.attemptAdminLogin('e2e-admin@test.local', 'wrong-password');

    await expect(homePage.adminLoginError).toBeVisible();
    await expect(homePage.adminLoginError).not.toBeEmpty();
    await expect(homePage.messagesTab).toBeHidden();
    await expect(homePage.adminToolsButton).toBeHidden();
    await expect(homePage.adminButton).toBeVisible();
  });
});

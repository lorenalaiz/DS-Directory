const { test, expect } = require('@playwright/test');
const { HomePage } = require('../../pages/HomePage');

test.describe('Homepage UI', () => {
  test('loads and shows the main heading', async ({ page }) => {
    const homePage = new HomePage(page);
    await homePage.goto();

    await expect(homePage.heading).toBeVisible();
  });
});

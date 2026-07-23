const { test, expect, ADMIN_EMAIL, ADMIN_PASSWORD } = require('../../fixtures');
const { HomePage } = require('../../pages/HomePage');
const { MarketplacePage } = require('../../pages/MarketplacePage');

function uniqueName(label) {
  return `E2E Test Listing ${label} ${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

test.describe('Marketplace', () => {
  test('marketplace listing price is required only for Sell/Rent, not Donate/Lend', async ({ page }) => {
    const homePage = new HomePage(page);
    const marketplacePage = new MarketplacePage(page);
    const donateName = uniqueName('Donate');
    const sellName = uniqueName('Sell');

    await marketplacePage.goto();
    try {
      await marketplacePage.openForm();
      await marketplacePage.fillRequiredFields({
        name: donateName,
        type: 'Donate',
        condition: 'New',
        postedBy: 'Visitor Tester',
      });
      await marketplacePage.phoneInput.fill('0412345678');
      await marketplacePage.saveButton.click();
      await expect(marketplacePage.card(donateName)).toBeVisible();

      await marketplacePage.openForm();
      await marketplacePage.fillRequiredFields({
        name: sellName,
        type: 'Sell',
        condition: 'New',
        postedBy: 'Visitor Tester',
      });
      await marketplacePage.phoneInput.fill('0412345678');
      await marketplacePage.saveButton.click();
      await expect(marketplacePage.priceError).toBeVisible();

      await marketplacePage.priceInput.fill('50');
      await marketplacePage.saveButton.click();
      await expect(marketplacePage.card(sellName)).toBeVisible();
    } finally {
      await homePage.goto();
      const alreadyAdmin = await homePage.adminToolsButton
        .waitFor({ state: 'visible', timeout: 5000 })
        .then(() => true)
        .catch(() => false);
      if (!alreadyAdmin) {
        await homePage.loginAsAdmin(ADMIN_EMAIL, ADMIN_PASSWORD);
      }
      await marketplacePage.goto();
      for (const name of [donateName, sellName]) {
        const exists = await marketplacePage
          .card(name)
          .waitFor({ state: 'visible', timeout: 5000 })
          .then(() => true)
          .catch(() => false);
        if (exists) {
          await marketplacePage.deleteDirectly(name);
        }
      }
      await homePage.signOut();
    }
  });

  test('marketplace listing requires at least a phone number or an email', async ({ page }) => {
    const homePage = new HomePage(page);
    const marketplacePage = new MarketplacePage(page);
    const name = uniqueName('Contact');

    await marketplacePage.goto();
    try {
      await marketplacePage.openForm();
      await marketplacePage.fillRequiredFields({
        name,
        type: 'Donate',
        condition: 'New',
        postedBy: 'Visitor Tester',
      });
      await marketplacePage.saveButton.click();
      await expect(marketplacePage.contactError).toBeVisible();

      await marketplacePage.emailInput.fill('visitor@example.com');
      await marketplacePage.saveButton.click();
      await expect(marketplacePage.card(name)).toBeVisible();
    } finally {
      await homePage.goto();
      const alreadyAdmin = await homePage.adminToolsButton
        .waitFor({ state: 'visible', timeout: 5000 })
        .then(() => true)
        .catch(() => false);
      if (!alreadyAdmin) {
        await homePage.loginAsAdmin(ADMIN_EMAIL, ADMIN_PASSWORD);
      }
      await marketplacePage.goto();
      const exists = await marketplacePage
        .card(name)
        .waitFor({ state: 'visible', timeout: 5000 })
        .then(() => true)
        .catch(() => false);
      if (exists) {
        await marketplacePage.deleteDirectly(name);
      }
      await homePage.signOut();
    }
  });
});

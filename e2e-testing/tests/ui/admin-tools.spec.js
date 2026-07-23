const { test, expect, ADMIN_EMAIL, ADMIN_PASSWORD } = require('../../fixtures');
const { HomePage } = require('../../pages/HomePage');
const { ProfessionalsPage } = require('../../pages/ProfessionalsPage');

test.describe('Admin tools', () => {
  test('restore-from-backup requires explicit destructive confirmation before replacing data', async ({
    page,
    testProfessional,
  }) => {
    const homePage = new HomePage(page);
    const professionalsPage = new ProfessionalsPage(page);
    const { name } = testProfessional;

    await homePage.loginAsAdmin(ADMIN_EMAIL, ADMIN_PASSWORD);
    await homePage.adminToolsButton.click();
    const [download] = await Promise.all([page.waitForEvent('download'), homePage.backupButton.click()]);
    const backupPath = await download.path();

    page.once('dialog', (dialog) => dialog.dismiss());
    await page.locator('#restoreFileInput').setInputFiles(backupPath);
    await professionalsPage.goto();
    await expect(professionalsPage.card(name)).toBeVisible();

    page.once('dialog', (dialog) => dialog.accept());
    await page.locator('#restoreFileInput').setInputFiles(backupPath);
    await expect(page.getByText('Backup restored. Reloading...')).toBeVisible();
    await page.waitForEvent('load');

    await professionalsPage.goto();
    await expect(professionalsPage.card(name)).toBeVisible();
  });
});

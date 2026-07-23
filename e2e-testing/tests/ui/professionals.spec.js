const { test, expect, ADMIN_EMAIL, ADMIN_PASSWORD } = require('../../fixtures');
const { HomePage } = require('../../pages/HomePage');
const { ProfessionalsPage } = require('../../pages/ProfessionalsPage');
const { RequestsPage } = require('../../pages/RequestsPage');

test.describe('Professionals directory', () => {
  test('public visitor can create a new Professional entry directly', async ({ page }) => {
    const homePage = new HomePage(page);
    const professionalsPage = new ProfessionalsPage(page);
    const name = `E2E Test Professional ${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    await professionalsPage.goto();
    try {
      await professionalsPage.create(name, 'Pediatrician');
      await expect(professionalsPage.card(name)).toBeVisible();
    } finally {
      await homePage.loginAsAdmin(ADMIN_EMAIL, ADMIN_PASSWORD);
      await professionalsPage.goto();
      await expect(professionalsPage.card(name)).toBeVisible();
      await professionalsPage.deleteDirectly(name);
      await homePage.signOut();
    }
  });

  test('non-admin editing an existing entry creates a pending request, not a live change', async ({
    page,
    testProfessional,
  }) => {
    const homePage = new HomePage(page);
    const professionalsPage = new ProfessionalsPage(page);
    const requestsPage = new RequestsPage(page);
    const { name } = testProfessional;

    await professionalsPage.requestEditPhone(name, 'Visitor Tester', '0412345678');
    await expect(page.getByText('Edit sent for approval')).toBeVisible();

    await professionalsPage.goto();
    await expect(professionalsPage.card(name)).not.toContainText('0412345678');

    await homePage.loginAsAdmin(ADMIN_EMAIL, ADMIN_PASSWORD);
    await requestsPage.goto();
    const requestCard = requestsPage.card(name, { type: 'Edit request' });
    await expect(requestCard).toBeVisible();
    await expect(requestCard).toContainText('0412345678');
    await homePage.signOut();
  });

  test('non-admin deleting an existing entry creates a pending removal request requiring a reason', async ({
    page,
    testProfessional,
  }) => {
    const homePage = new HomePage(page);
    const professionalsPage = new ProfessionalsPage(page);
    const requestsPage = new RequestsPage(page);
    const { name } = testProfessional;

    await professionalsPage.openRequestRemovalModal(name);
    await professionalsPage.requesterNameInput.fill('Visitor Tester');
    await professionalsPage.sendRequestButton.click();
    await expect(page.getByText('Please tell the admin why this should be removed.')).toBeVisible();

    await professionalsPage.requestRemovalReasonInput.fill('Duplicate listing');
    await professionalsPage.sendRequestButton.click();
    await expect(page.getByText('Request sent — the admin will review it.')).toBeVisible();

    await professionalsPage.goto();
    await expect(professionalsPage.card(name)).toBeVisible();

    await homePage.loginAsAdmin(ADMIN_EMAIL, ADMIN_PASSWORD);
    await requestsPage.goto();
    const requestCard = requestsPage.card(name, { type: 'Removal request' });
    await expect(requestCard).toBeVisible();
    await expect(requestCard).toContainText('Duplicate listing');
    await homePage.signOut();
  });

  test('admin approving a pending request applies the change to live data', async ({
    page,
    testProfessional,
  }) => {
    const homePage = new HomePage(page);
    const professionalsPage = new ProfessionalsPage(page);
    const requestsPage = new RequestsPage(page);
    const { name } = testProfessional;

    await professionalsPage.requestEditPhone(name, 'Visitor Tester', '0400111222');
    await expect(page.getByText('Edit sent for approval')).toBeVisible();

    await homePage.loginAsAdmin(ADMIN_EMAIL, ADMIN_PASSWORD);
    await requestsPage.goto();
    const requestCard = requestsPage.card(name, { type: 'Edit request' });
    await expect(requestCard).toBeVisible();
    await expect(requestCard).toContainText('0400111222');

    await requestsPage.approveEdit(name);
    await expect(page.getByText('Edit approved and applied.')).toBeVisible();
    await expect(requestsPage.card(name)).toHaveCount(0);

    await professionalsPage.goto();
    await expect(professionalsPage.card(name)).toContainText('0400 111 222');

    await homePage.signOut();
  });

  test('visitor can add a star rating and comment review to a Professional listing', async ({
    page,
    testProfessional,
  }) => {
    const professionalsPage = new ProfessionalsPage(page);
    const { name } = testProfessional;

    await professionalsPage.postReview(name, {
      author: 'Visitor Tester',
      rating: 5,
      comment: 'Wonderful experience, highly recommend.',
    });
    await expect(page.getByText('Review posted.')).toBeVisible();
    await expect(professionalsPage.reviewsList).toContainText('Visitor Tester');
    await expect(professionalsPage.reviewsList).toContainText('Wonderful experience, highly recommend.');

    await professionalsPage.closeReviewsButton.click();
    await expect(professionalsPage.card(name)).toContainText('1 review');
  });
});

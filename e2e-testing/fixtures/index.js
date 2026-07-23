const base = require('@playwright/test');
const { HomePage } = require('../pages/HomePage');
const { ProfessionalsPage } = require('../pages/ProfessionalsPage');

const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

const FIRESTORE_EMULATOR_BASE =
  'http://127.0.0.1:8080/v1/projects/ds-database-84002/databases/(default)/documents';

/**
 * Deletes any delete-requests docs left over for a given entry name.
 * Goes straight through the Firestore emulator's REST API rather than the
 * Requests tab UI — that UI's realtime listener has proven flaky to
 * synchronize with right after a fresh reload, and this is teardown
 * plumbing, not behavior under test (the approve/deny flow itself is
 * covered by its own dedicated test case).
 */
async function purgeDeleteRequestsFor(request, name) {
  await purgeDocsWhere(request, 'delete-requests', 'name', name);
}

/**
 * Deletes any docs in a collection whose given field matches a value, via
 * the Firestore emulator's REST API. Used for teardown of data the app
 * itself provides no delete UI for (e.g. contact messages).
 */
async function purgeDocsWhere(request, collection, field, value) {
  const res = await request.get(`${FIRESTORE_EMULATOR_BASE}/${collection}`);
  const { documents = [] } = await res.json();
  for (const doc of documents) {
    if (doc.fields?.[field]?.stringValue === value) {
      const docId = doc.name.split('/').pop();
      await request.delete(`${FIRESTORE_EMULATOR_BASE}/${collection}/${docId}`);
    }
  }
}

/**
 * Provides a HomePage already signed in as admin. Signs out again on
 * teardown regardless of test outcome, so the app is left signed-out for
 * whichever test/case runs next.
 */
const test = base.test.extend({
  adminHomePage: async ({ page }, use) => {
    const homePage = new HomePage(page);
    await homePage.goto();
    await homePage.loginAsAdmin(ADMIN_EMAIL, ADMIN_PASSWORD);
    await use(homePage);
    await homePage.signOut();
  },

  /**
   * Creates a throwaway Professional entry (as a non-admin visitor) and
   * guarantees it's gone by teardown — clearing any pending requests left
   * on it, then deleting it directly as admin — regardless of what the
   * test itself did to it (edited, requested removal, left untouched).
   */
  testProfessional: async ({ page, request }, use) => {
    const homePage = new HomePage(page);
    const professionalsPage = new ProfessionalsPage(page);
    const name = `E2E Test Professional ${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    await professionalsPage.goto();
    await professionalsPage.create(name, 'Pediatrician');

    await use({ name });

    // Reload fresh rather than trusting an isVisible() snapshot here — the
    // test may have just called signOut() itself, and the admin-tools
    // button can still be mid-fade-out when checked immediately, wrongly
    // signalling "still admin" while the session has actually flipped.
    await homePage.goto();
    const alreadyAdmin = await homePage.adminToolsButton
      .waitFor({ state: 'visible', timeout: 5000 })
      .then(() => true)
      .catch(() => false);
    if (!alreadyAdmin) {
      await homePage.loginAsAdmin(ADMIN_EMAIL, ADMIN_PASSWORD);
    }

    await purgeDeleteRequestsFor(request, name);

    await professionalsPage.goto();
    const card = professionalsPage.card(name);
    const stillExists = await card
      .waitFor({ state: 'visible', timeout: 8000 })
      .then(() => true)
      .catch(() => false);
    if (stillExists) {
      await professionalsPage.deleteDirectly(name);
    }

    await homePage.signOut();
  },
});

module.exports = {
  test,
  expect: base.expect,
  ADMIN_EMAIL,
  ADMIN_PASSWORD,
  purgeDocsWhere,
};

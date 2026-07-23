# Baseline Test Plan

**Type:** Baseline (no diff — covers current app functionality)
**Generated:** 2026-07-23
**Test cases:** 12 of 20 found (limit: 12)

DS Network is a community directory (professionals, products, families,
marketplace listings) for a Trisomy 21 / disability support community, backed
by Firebase (Firestore + Auth + Storage). Anyone can view and create entries;
non-admins editing or deleting existing entries get routed into an
admin-moderated request queue instead of writing directly. This plan focuses
on the security/data-integrity boundary between public and admin actions, the
core create/edit/delete flows across all four directory sections, and the
highest-risk destructive operation (Restore-from-backup), plus a second tier
of form-validation and secondary-flow coverage.

---

## P0 — Critical

### [P0] Admin login grants access to admin-only tabs and controls

**Description:** Verifies the core auth boundary — a successful admin login
must reveal admin-only functionality (Messages, Activity, Requests, admin
tools) and hide public-only UI (Contact button, NDIS banner/tab, Install App
button), since every other admin-path test case depends on this working.

**Steps to Reproduce:**
1. Load the app as a signed-out visitor.
2. Confirm Messages/Activity/Requests tabs and the admin tools dropdown are not visible.
3. Open the Admin login modal and sign in with valid admin credentials.
4. Observe the tab bar and header controls after login.

**Expected Result:** After login, Messages/Activity/Requests tabs and admin
tools appear; Contact button, NDIS Guide, and Install App button are hidden.

✅ Automated: e2e-testing/tests/ui/admin-auth.spec.js

---

### [P0] Public visitor can create a new Professional entry directly

**Description:** Creating directory entries is the app's primary purpose and
is explicitly allowed without login — this must work for an unauthenticated
visitor with no request/approval step involved.

**Steps to Reproduce:**
1. As a signed-out visitor, open the Professionals tab.
2. Click "+ Add professional".
3. Fill in a required name and select at least one specialty.
4. Submit the form.
5. Confirm the new entry appears in the Professionals list immediately.

**Expected Result:** The new professional entry is created and visible right
away, with no approval step required.

✅ Automated: e2e-testing/tests/ui/professionals.spec.js

---

### [P0] Non-admin editing an existing entry creates a pending request, not a live change

**Description:** This is the core data-integrity safeguard for the whole
app — a non-admin must never be able to directly modify existing data;
edits must be redirected into the `delete-requests` moderation queue.

**Steps to Reproduce:**
1. As a signed-out visitor, open any existing Professional entry and click Edit.
2. Change a field (e.g. phone number) and submit.
3. Reload the Professionals list and confirm the original entry is unchanged.
4. Log in as admin and open the Requests tab.

**Expected Result:** The original entry's data is untouched after the
non-admin "edit"; the proposed change appears in Requests as a pending edit
request with both original and proposed values shown.

✅ Automated: e2e-testing/tests/ui/professionals.spec.js

---

### [P0] Non-admin deleting an existing entry creates a pending removal request requiring a reason

**Description:** Mirrors the edit-request safeguard for deletions — a
non-admin delete action must never remove live data directly, and the
removal-request flow must enforce a reason field.

**Steps to Reproduce:**
1. As a signed-out visitor, open any existing entry (any section) and click Delete.
2. Attempt to submit the removal request with no reason entered.
3. Enter a reason and submit.
4. Reload the list and confirm the entry still exists; log in as admin and check Requests.

**Expected Result:** Submitting with no reason is blocked; after entering a
reason, the entry remains live and a pending delete request (with reason)
appears in the admin Requests queue.

✅ Automated: e2e-testing/tests/ui/professionals.spec.js

---

### [P0] Admin approving a pending request applies the change to live data

**Description:** Completes the moderation loop started by the two cases
above — an approved request must actually be applied to the underlying
collection, and a denied one must not be.

**Steps to Reproduce:**
1. As admin, open the Requests tab with at least one pending edit request.
2. Review the shown diff (original vs. proposed values).
3. Click Approve.
4. Navigate to the affected entry in its section.

**Expected Result:** The entry now reflects the proposed changes, and the
request is removed from the pending Requests queue.

✅ Automated: e2e-testing/tests/ui/professionals.spec.js

---

### [P0] Restore-from-backup requires explicit destructive confirmation before replacing data

**Description:** Restore deletes and recreates the professionals, products,
families, and marketplace collections wholesale — the highest blast-radius
action in the app. It must never run without an explicit "REPLACE
everything" confirmation, and cancelling must leave existing data untouched.

**Steps to Reproduce:**
1. As admin, take a Backup (downloads a JSON export).
2. Open Restore and select the backup JSON file.
3. When the destructive confirmation dialog appears, click Cancel.
4. Confirm existing data is unchanged; repeat Restore and this time confirm the destructive dialog.

**Expected Result:** Cancelling leaves all existing data untouched. Confirming
replaces professionals/products/families/marketplace with the backup's
contents exactly.

✅ Automated: e2e-testing/tests/ui/admin-tools.spec.js

---

## P1 — High

### [P1] Admin login with invalid credentials shows an error and grants no access

**Description:** The failure path of the login flow must surface a clear
error and must not leave the app in a partially-authenticated state.

**Steps to Reproduce:**
1. Open the Admin login modal.
2. Enter a valid-looking but incorrect email/password combination.
3. Submit.

**Expected Result:** A visible error message appears; admin-only tabs remain
hidden and the visitor stays in the signed-out state.

✅ Automated: e2e-testing/tests/ui/admin-auth.spec.js

---

### [P1] Marketplace listing price is required only for Sell/Rent, not Donate/Lend

**Description:** Price is conditionally required based on listing type — this
cross-field rule is easy to regress and directly affects whether sellers can
post valid listings.

**Steps to Reproduce:**
1. Open the Marketplace "+ Add listing" form.
2. Select type "Donate", leave price blank, fill other required fields, submit.
3. Repeat with type "Sell" and price left blank — attempt submit.
4. Enter a price greater than 0 for the "Sell" listing and submit.

**Expected Result:** Donate submits successfully with no price. Sell is
blocked until a price greater than 0 is entered, then submits successfully.

✅ Automated: e2e-testing/tests/ui/marketplace.spec.js

---

### [P1] Marketplace listing requires at least a phone number or an email

**Description:** Contact info is validated as "at least one of phone or
email" rather than both being independently optional — a real user must be
reachable by the poster.

**Steps to Reproduce:**
1. Open the Marketplace "+ Add listing" form and fill all required fields except phone and email.
2. Attempt to submit.
3. Fill in only an email (leave phone blank) and submit.

**Expected Result:** Submission is blocked with neither phone nor email
filled; submission succeeds once at least one is provided.

✅ Automated: e2e-testing/tests/ui/marketplace.spec.js

---

### [P1] Family form rejects a suburb that wasn't selected from the autocomplete list

**Description:** Suburb must come from the address-autocomplete selection,
not free-typed text, since downstream features (map pins, postcode
auto-fill) depend on a resolved suburb value.

**Steps to Reproduce:**
1. Open the Families "+ Add family" form.
2. Type a suburb name in the Suburb field but do not select a suggestion from the dropdown.
3. Fill other required fields and attempt to submit.
4. Retype the suburb and select a suggestion from the autocomplete dropdown, then submit.

**Expected Result:** Submission is blocked when the suburb wasn't chosen from
a suggestion; it succeeds once a suggestion is explicitly selected, with
postcode auto-filled.

⚠️ Not automated: the suburb field calls the live Google Places API
(`places.googleapis.com`), which is blocked for localhost in this dev
environment ("Requests from referer http://localhost:3000/ are blocked").
Step 4 (select a suggestion, submit successfully) cannot be executed here.
Skipped this round rather than testing only the partial validation path.

---

### [P1] Visitor can add a star rating and comment review to a Professional listing

**Description:** Reviews are a core engagement feature on professional
listings and should save and display correctly.

**Steps to Reproduce:**
1. Open an existing Professional entry.
2. Check "leave a review", select a star rating, and enter a comment.
3. Submit.
4. Reopen the entry.

**Expected Result:** The review (rating + comment) is saved and visible on
the professional's entry.

✅ Automated: e2e-testing/tests/ui/professionals.spec.js

---

### [P1] Contact form submission is visible to admin in the Messages tab

**Description:** The public Contact modal is the only way a visitor reaches
an admin directly outside the moderation-request flow, so it must reliably
create a readable message for admin.

**Steps to Reproduce:**
1. As a signed-out visitor, open the Contact modal.
2. Fill in required name and message fields, and submit.
3. Log in as admin and open the Messages tab.

**Expected Result:** The submitted message appears in the admin Messages
inbox with the submitted name and message text.

✅ Automated: e2e-testing/tests/ui/contact.spec.js

---

## Already covered (not retested here)

- Homepage loads and shows the main heading — covered by the existing
  `Homepage UI > loads and shows the main heading` test in
  `e2e-testing/tests/ui/example.spec.js`.

## Not included this round

Cases identified but left out due to the 12-case limit, listed by title only,
lowest priority first:

- [P2] NDIS Guide static content displays correctly and is hidden when admin is logged in
- [P2] Last active tab persists across a page reload
- [P2] Install App button behavior differs correctly between iOS/Safari and Android/Chrome, and hides once installed
- [P2] Card view / table view toggle works correctly per section
- [P2] Service worker falls back to cached app shell when offline
- [P1] Admin denying a pending request removes it from the queue without applying the change
- [P1] Photo upload exceeding the 5MB size cap is rejected on Family/Marketplace forms
- [P1] Directory search and filter (by specialty/suburb/category) returns correct results
- [P1] Activity log filters entries correctly by date range

## Notes / unclear impact

- No `firestore.rules` or `storage.rules` files exist in the repo, so
  server-side access control (e.g. whether an unauthenticated client could
  write directly to `ds-network-activity` or `ds-network-messages` by
  calling the Firestore API directly, bypassing the UI) can't be confirmed
  from code alone. Worth a dedicated security-focused pass against the live
  emulator rather than guessing from the client code.
- `ds-network-data` legacy collection and its one-time migration functions
  (`migrateLegacyProfessionals`, etc.) appear to be transitional — unclear
  whether this migration path is still expected to run in production or is
  dead code; not included as a test case since impact is unclear without
  confirming with the author.

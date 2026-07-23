# How to Test DS-Directory — Step by Step

This guide walks you through setting up and running the automated testing
tools for this project. No coding experience needed — just follow the
steps in order.

You'll need a computer with **Terminal** (Mac) already open, and
**Claude Code** already installed.

---

## Part 1 — Get the testing tools (one-time setup)

You only need to do this once per computer.

1. Open Terminal.
2. Decide where you want to keep the tools — anywhere is fine. A common
   choice is your home folder. Go there:
   ```
   cd ~
   ```
3. Copy and paste this, then press Enter — this downloads the tools into
   a new folder called `playwright-foundation`:
   ```
   git clone https://github.com/costajdac/playwright-foundation.git
   ```
4. Copy and paste this, then press Enter — this makes the tools available
   to Claude, wherever you just downloaded them:
   ```
   ln -s "$(pwd)/playwright-foundation/playwright-project-setup" ~/.claude/skills/playwright-project-setup
   ln -s "$(pwd)/playwright-foundation/playwright-github-actions" ~/.claude/skills/playwright-github-actions
   ln -s "$(pwd)/playwright-foundation/test-plan-generator" ~/.claude/skills/test-plan-generator
   ln -s "$(pwd)/playwright-foundation/automation-test-creation-with-playwright" ~/.claude/skills/automation-test-creation-with-playwright
   ```
5. That's it — the tools are installed. You won't need to repeat this
   step again on this computer.

   **Note:** step 4 only works correctly if you run it right after step 3,
   from the same Terminal window, without changing folders in between.
   If you closed Terminal or navigated elsewhere, just run `cd ~` first,
   then run step 4 again — as long as you're in the folder that *contains*
   `playwright-foundation`, it'll work.

---

## Part 2 — Start the app before testing (do this every time)

The tests need the app actually running on your computer first, like
opening two apps side by side.

1. Open **two** Terminal windows (or two tabs).

2. In **both** windows, go to the DS-Directory project folder on your
   computer. You'll need to know where it was saved — if you're not sure,
   ask whoever set it up for you, or use Finder to search for a folder
   named `DS-Directory` and check its location.

   Once you know the location, type `cd ` (with a space after it), then
   drag the DS-Directory folder from Finder directly into the Terminal
   window — this automatically fills in the correct path for you. Press
   Enter.

3. In the **first window**, paste this and press Enter:
   ```
   npx serve . -l 3000
   ```
   Leave this window open and running. This is the app itself.

4. In the **second window**, paste this and press Enter:
   ```
   firebase emulators:start --project demo-ds-directory-test
   ```
   Leave this window open and running too. This is a safe, fake copy of
   the database — so nothing you do during testing affects real data.

5. **Double-check it worked:** open your browser and go to
   `http://localhost:3000`. Press F12 (or Cmd+Option+J on Mac) to open the
   developer console, and look for this message:
   ```
   Connected to Firebase emulators (local dev)
   ```
   If you see that message, you're safe to continue. If you don't see it,
   stop and ask for help before running anything else — this message is
   what confirms tests won't touch real user data.

Keep both windows open for the rest of this guide.

---

## Part 3 — Create a test plan

A test plan is a checklist of what to test, written out in plain English,
ranked by how important each thing is.

### Option A — Testing recent changes on a branch

Use this when you (or someone else) made changes and want a checklist for
just those changes.

1. In Claude Code, make sure you're on the branch with the changes.
2. Type:
   ```
   /test-plan-generator
   ```
3. Claude will ask you a couple of quick questions — just answer them.
4. When it's done, it'll tell you where the checklist was saved (a file
   ending in `-test-plan.md`).

### Option B — Getting full coverage on main (when you want more tests overall)

Use this when you want a broader checklist covering how the whole app
works today, not just recent changes.

1. In Claude Code, switch to the `main` branch.
2. Type:
   ```
   /test-plan-generator
   ```
3. Claude will notice there's nothing new to compare and ask if you want
   a **baseline plan** instead — say yes.
4. This takes a bit longer since it's reading the whole app, not just a
   small change. That's normal.
5. When it's done, it'll tell you where the checklist was saved.

---

## Part 4 — Run all existing tests

Once tests already exist (from a previous session, or written by someone
else on the team), you don't need to regenerate anything — just run them.

1. Make sure the app and the emulator from **Part 2** are still running,
   and you saw "Connected to Firebase emulators" in the browser console.
2. Make sure your local `.env` file has real values for `ADMIN_EMAIL` and
   `ADMIN_PASSWORD` (copy from `.env.example` if you haven't set this up
   yet) — some tests need to log in as admin, and will fail with a
   confusing "expected string, got undefined" error if these are missing.
3. In Claude Code, or directly in Terminal, run:
   ```
   npm run test:ui
   ```
4. This runs every test file under `e2e-testing/tests/`, across both
   Chromium and Firefox. It'll take a few minutes — tests that write or
   change data (adding a listing, admin approving a request, etc.) are
   slower than ones that just check the page loaded correctly.
5. At the end, you'll see a summary like `20 passed` or `2 failed`. If
   anything fails, Playwright saves a screenshot, video, and trace of the
   exact moment it failed under `e2e-testing/test-results/` — helpful for
   figuring out what went wrong without having to reproduce it yourself.

**One test needs to run alone, not alongside the others:** the
restore-from-backup test replaces entire collections of data. If you ever
see instructions to run it separately or notice tests interfering with
each other, that's why — don't run it at the same time as anything else
that's also writing data.

## Part 5 — Turn a checklist into real automated tests

Once you have a test plan (from Part 3), you can turn some or all of it
into tests that run themselves automatically.

1. Make sure the app and the emulator from **Part 2** are still running.
2. In Claude Code, type:
   ```
   /automation-test-creation-with-playwright
   ```
3. Claude will ask which checklist file to use, and which items to turn
   into tests (you don't have to do all of them at once — most important
   first is a good default).
4. Claude will write the tests, run each one to make sure it actually
   works, and clean up after itself automatically (nothing gets left
   behind in the database).
5. At the end, Claude will ask if you want to save (commit) the new tests.
   Say yes if you're happy with them.

---

## Quick troubleshooting

- **Don't see "Connected to Firebase emulators" in the console?** Stop —
  don't run any tests yet. Make sure both Terminal windows from Part 2 are
  still open and running, then refresh the browser page.
- **Claude Code can't find a command like `/test-plan-generator`?** Go
  back to Part 1 and make sure all four lines from step 3 ran without an
  error.
- **Not sure what to answer when Claude asks a question?** It's fine to
  just ask "what do you recommend?" — Claude will explain the options.

---

## When you're done

When you finish a testing session, you can close both Terminal windows
from Part 2. Nothing needs to be shut down in any special order.
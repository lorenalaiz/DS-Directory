# DS-Directory

## Architecture

Static site, no build step. `index.html` holds the page shell (view-panel containers, modal markup, tab bar) and loads `css/styles.css` plus the JS modules below.

```
js/main.js              Application entry point — imports every module, then runs
                         initial data loads and tab restoration.
js/constants.js         Category lists, colors, and storage keys.
js/config.js            Firebase project config and API keys.
js/firebase-service.js  Firebase SDK init (db/auth/storage) and the storageService
                         helper used for one-off legacy-data migrations.
js/utils.js             Small formatting/escaping helpers shared across views.
js/shared.js            Cross-cutting mutable state and helpers used by 2+ views:
                         admin flag, cards/table view-mode registry, the generic
                         "details" modal, the removal-request modal, activity logging.
js/photo-upload.js       Firebase Storage photo compression/upload/preview wiring,
                         shared by the modal forms that accept a photo.
js/toolbar.js            renderToolbar() — generates the search/filter/add-button/
                         count-row/grid markup shared by the view panels.
js/view-switcher.js      Tab switching between view panels.
js/admin.js              Admin login/logout.
js/backup-restore.js     Backup/restore buttons.
js/contact.js            Contact/suggestions modal.
js/views/                One file per view panel (professionals, products, families,
                         marketplace, reviews, activity, requests, messages) — each
                         owns its data array, render/card/table functions, and modal.
partials/                HTML fragments fetched at runtime (e.g. the NDIS Guide tab,
                         loaded lazily the first time it's opened).
```

The Firebase project (`js/config.js`) is the one and only production database — there
is no emulator or staging project, so be careful when testing write paths (add/edit/
delete/backup/restore) against it.
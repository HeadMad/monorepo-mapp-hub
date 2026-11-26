# Changelog

This file is generated automatically from Conventional Commits: `node scripts/changelog.mjs`.

## Unreleased

### Added

- **shell:** shared event bus and console as service mini-app; bump to 0.2.0-beta.6 (82c1b47)
- **shell:** open mini-apps inside browser window via host.relay (bdf446b)

### Documentation

- **api:** design shared event bus and console-as-miniapp tasks (eaade2a)

### Chores

- point beta channel to v0.2.0-beta.5 in release-manifest (d6605bf)

## v0.2.0-beta.5 — 2026-11-25

### Added

- **shell:** debug console, service host, browser mini-app; bump to 0.2.0-beta.5 (adcdb31)
- **launcher:** desktop shows installed mini-apps via miniapp.list (85ffe00)

## v0.2.0-beta.4 — 2026-11-25

### Added

- **shell:** install mini-apps from release archives after shell install (e902f98)

## v0.2.0-beta.3 — 2026-11-25

### Added

- **miniapps:** mount bundled mini-apps on miniapp-<id>.local (TASK-016) (c3bd83d)

### Documentation

- **tasks:** record TASK-016 progress (code done, device check pending) (17462cb)
- switch changelog generator and release notes to English (2a739ee)

### Chores

- point beta channel to v0.2.0-beta.3 in release-manifest (78db22b)
- bump shell to 0.2.0-beta.3 and add release notes (123f981)

## v0.2.0-beta.2 — 2026-11-25

### Added

- migrate launcher and sample-game to MappHub.js, expose MappHub.call; update docs, changelog and v0.2.0-beta.2 release notes (9c11740)
- rename sdk.js to MappHub.js, bump version to v0.2.0-beta.2, update changelog (cb85a4b)
- **native:** theme storage in system_kv, MappThemeCss validation, mapp.local asset handler with Rhino generators (ddb8094)

### Fixed

- **native:** declare MappLocalAssetHandler in MappSystemPlugin so the release build compiles (1f9471c)

### Documentation

- finalize changelog for v0.2.0-beta.2 (9068e53)
- add release notes for v0.2.0-beta.2 (7456c8c)
- add architecture part 2 spec and TASK-009..016 (themes, asset handler, event bus, theme editor, changelog) (bc059e9)

### Chores

- sync all unstaged files and MappHub SDK rename (d0bc81a)
- point beta channel to v0.1.0-beta.3 (786db2e)

## v0.1.0-beta.3 — 2026-11-25

### Added

- **native:** MappHub Android layer (SQLite, package manager, virtual hosts, plugin), host bridge and sdk.js; bump to 0.1.0-beta.3 (9a1fc06)
- shell update prompt with beta opt-in, UI/device/media API modules, beta-aware versionCode (3aa5ad1)

## v0.1.0-beta.2 — 2026-11-25

### Documentation

- add architecture analysis for storage (IndexedDB / Filesystem) and comprehensive API proposal (2131d64)

## v0.2.0-beta.1 — 2026-11-25

### Added

- enforce runtime permission checks against installed mini-app manifests, fix installWithPermissions, and bump version to 0.2.0-beta.1 (26f2926)
- **bridge:** MappHub Proxy bridge with {ok,result,message} envelope; migrate launcher and sample-game (5d48082)

### Fixed

- **ci:** use JDK 21 required by Capacitor 7 (d93a7cc)
- **ci:** restore www sources, bundle mini-apps, manual APK build with GitHub release (2fa1c88)
- update workflow trigger to workflow_dispatch only (cdd5fae)
- stage workflow, package.json and manifests for 0.1.0-beta.1 release (f15110c)

### Documentation

- API reference, permissions model, mini-app dev guide, cross-links (d4ec881)

## v0.1.0-beta.1 — 2026-11-25

### Added

- restructure task tracker into folder-based file routing, add advanced permission modal flow, and update AI context (8cf7162)
- add shell auto-update, beta channel support, mappmanifest.json spec, and new API actions (4a5f9a5)

### Other

- add GitHub Actions workflow for building Android APK and update version to 0.1.0-beta.1 across all manifests (8194948)

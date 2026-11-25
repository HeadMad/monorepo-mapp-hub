# Changelog

Раздел формируется автоматически из Conventional Commits: `node scripts/changelog.mjs`.

## Unreleased

### Добавлено

- migrate launcher and sample-game to MappHub.js, expose MappHub.call; update docs, changelog and v0.2.0-beta.2 release notes (9c11740)
- rename sdk.js to MappHub.js, bump version to v0.2.0-beta.2, update changelog (cb85a4b)
- **native:** theme storage in system_kv, MappThemeCss validation, mapp.local asset handler with Rhino generators (ddb8094)

### Исправлено

- **native:** declare MappLocalAssetHandler in MappSystemPlugin so the release build compiles (1f9471c)

### Документация

- finalize changelog for v0.2.0-beta.2 (9068e53)
- add release notes for v0.2.0-beta.2 (7456c8c)
- add architecture part 2 spec and TASK-009..016 (themes, asset handler, event bus, theme editor, changelog) (bc059e9)

### Служебное

- sync all unstaged files and MappHub SDK rename (d0bc81a)
- point beta channel to v0.1.0-beta.3 (786db2e)

## v0.1.0-beta.3 — 2026-11-25

### Добавлено

- **native:** MappHub Android layer (SQLite, package manager, virtual hosts, plugin), host bridge and sdk.js; bump to 0.1.0-beta.3 (9a1fc06)
- shell update prompt with beta opt-in, UI/device/media API modules, beta-aware versionCode (3aa5ad1)

## v0.1.0-beta.2 — 2026-11-25

### Документация

- add architecture analysis for storage (IndexedDB / Filesystem) and comprehensive API proposal (2131d64)

## v0.2.0-beta.1 — 2026-11-25

### Добавлено

- enforce runtime permission checks against installed mini-app manifests, fix installWithPermissions, and bump version to 0.2.0-beta.1 (26f2926)
- **bridge:** MappHub Proxy bridge with {ok,result,message} envelope; migrate launcher and sample-game (5d48082)

### Исправлено

- **ci:** use JDK 21 required by Capacitor 7 (d93a7cc)
- **ci:** restore www sources, bundle mini-apps, manual APK build with GitHub release (2fa1c88)
- update workflow trigger to workflow_dispatch only (cdd5fae)
- stage workflow, package.json and manifests for 0.1.0-beta.1 release (f15110c)

### Документация

- API reference, permissions model, mini-app dev guide, cross-links (d4ec881)

## v0.1.0-beta.1 — 2026-11-25

### Добавлено

- restructure task tracker into folder-based file routing, add advanced permission modal flow, and update AI context (8cf7162)
- add shell auto-update, beta channel support, mappmanifest.json spec, and new API actions (4a5f9a5)

### Прочее

- add GitHub Actions workflow for building Android APK and update version to 0.1.0-beta.1 across all manifests (8194948)

# TASK-015: Автоматический журнал изменений из коммитов

## Status: In Progress
## Priority: Medium

### Description
- `scripts/changelog.mjs` (Node 20, без зависимостей): читает `git tag` и `git log` и пишет `CHANGELOG.md`.
- Раздел на каждый тег (новые сверху) и раздел «Unreleased» для коммитов после последнего тега.
- Коммиты группируются по Conventional Commits: `feat`, `fix`, `refactor`, `docs`, `chore`, `test`, остальное в «Прочее». Коммит `docs(changelog)` и слияния пропускаются.
- Workflow `.github/workflows/changelog.yml`: запускается на `push` в `main`, `paths-ignore: CHANGELOG.md`. Если файл изменился, коммитит его от `github-actions[bot]` с `[skip ci]`. Права `contents: write`.
- Генерация локально: `node scripts/changelog.mjs`.

### Files
- `scripts/changelog.mjs`
- `.github/workflows/changelog.yml`
- `CHANGELOG.md`

### Acceptance criteria
- Скрипт на текущей истории создает `CHANGELOG.md` с разделами для тегов и коммитов после них.
- Повторный запуск без новых коммитов не меняет файл (идемпотентность).
- Workflow на push создает коммит с обновленным журналом только при изменении.

### Depends on
- Нет.

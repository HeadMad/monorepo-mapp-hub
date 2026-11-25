# AI Agent Context & Developer Guide (MappHub Monorepo)

Welcome, AI Agent! This document serves as your primary entry point and instructions manual for maintaining, developing, and evolving the **MappHub** monorepo project.

---

## 📂 File-Based Task Management System (Crucial for Token Economy)
To prevent context window bloat and ensure precise task execution, tasks are organized into dedicated subfolders under `/tasks`:
- `tasks/backlog/` — Future and planned tasks.
- `tasks/in_progress.md` (or folder) — Currently active tasks being executed.
- `tasks/done/` — Successfully completed tasks.
- `tasks/deprecated/` — Outdated or duplicate tasks.

**AI Agent Rule**: When starting work, read only the active tasks in progress, move completed ones to `tasks/done/`, and avoid parsing unnecessary historical task files.

---

## 🚀 Project Vision & Architecture
- **Thin Shells (`apps/shell-mobile` & `apps/shell-desktop`)**: Minimalistic host wrappers running an iframe runtime.
- **RPC Communication Bridge**: Telegram Bot API inspired asynchronous JSON-RPC protocol over `postMessage`.
- **Modular API Actions**: Stored under `apps/shell-mobile/www/js/api/<category>/<action>.js`, dynamically imported on demand.
- **First-Run Bootstrap & Permissions**: On first launch, the runtime checks for the launcher, loads its manifest, and presents a 2-step permission modal (with warnings if permissions are revoked).
- **Auto-Update & Beta Channels**: Supports checking `release-manifest.json` for shell updates with progress bars and seamless updates.

# TASK-001: First-Run Bootstrap & Launcher Installation

## Status: Backlog
## Priority: High

### Description
Implement the first-run detection logic in `runtime.js`. When the shell starts for the first time and no launcher is installed, it should dynamically load the bootstrap installer module, fetch the `mappmanifest.json` of the launcher, and present the installation flow.

# TASK-002: Advanced Permissions Modal Flow with Checkboxes

## Status: Backlog
## Priority: High

### Description
Update the universal modal system to support permission checkboxes during mini-app installation:
1. Show list of permissions from `mappmanifest.json` with checkboxes (enabled by default).
2. If user unchecks any permission and clicks "Install", show a warning modal: *"Some features may not work without these permissions"*.
3. Provide "Back" (return to checkboxes) and "Proceed anyway" buttons.

# Shell Auto-Update & Mini-App Manifest Architecture

## 1. Shell Self-Update & Beta Channel
The shell checks for updates upon startup by querying the remote `release-manifest.json`.
- **Stable vs Beta**: The update modal includes an option to include beta releases.
- **Seamless Upgrade**: New APK / binary versions are installed seamlessly over the existing package without wiping local app storage or user preferences.

## 2. Mini-App Manifest (`mappmanifest.json`)
Every mini-application must contain a `mappmanifest.json` at its root level:
```json
{
  "id": "com.mapphub.samplegame",
  "name": "Sample HTML5 Game",
  "version": "1.0.0",
  "permissions": ["device.info", "notifications.alert", "storage.get"],
  "archiveUrl": "https://example.com/miniapps/sample-game.zip"
}
```

## 3. RPC Actions for Updates & Installation
- `shell.checkUpdate`: Checks the remote release manifest, compares versions, and displays the update modal.
- `miniapp.install`: Reads a mini-app manifest, presents requested permissions to the user in the universal modal, and handles installation.

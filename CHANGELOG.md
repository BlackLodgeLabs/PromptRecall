# Changelog

## [1.0.1] - 2025-10-13
### Changed
- Removed unused `scripting` permission from `manifest.json` after auditing the codebase.

### Notes for Chrome Web Store Review
- The `scripting` permission was requested previously but not used by the extension. It has been removed to comply with the principle of least privilege.
- Remaining permissions:
  - `storage`: used for saving prompts and syncing via `chrome.storage.sync`.
  - `notifications`: used in the background service worker to show install and other system notifications.
  - `contextMenus`: used to create a right-click "Save Prompt to Prompt Recall" menu for manual prompt capture.
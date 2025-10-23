# Changelog

## [1.0.3] - 2025-10-23
### Added
- Pro Version with unlimited prompt storage
- License verification system using Chrome Identity API
- Upgrade button in popup and storage limit warning
- Pro status indicator in options page
- Cross-device license syncing via Chrome Storage API

### Changed
- background: implemented async license verification service integration (`background/background.js`)
- background: added 24-hour license refresh for Pro users (`background/background.js`)
- popup: added Pro upgrade flow and unlimited storage for licensed users (`popup/popup.js`)
- config: split configuration into module/non-module versions for compatibility (`config.js`, `config.web.js`)
- options: added license status display and manual verification button (`options/options.js`)

### Files changed
- `manifest.json` — added `identity` and `identity.email` permissions for license verification
- `background/background.js` — implemented license verification system and status caching
- `popup/popup.js` — added Pro upgrade flow and storage limit handling
- `options/options.js` — added license management UI
- `config.js` and `config.web.js` — split configuration for module compatibility
- `README.md` — updated documentation to include Pro features and licensing details

### Notes for Chrome Web Store Review
- New permissions:
  - `identity`: used for Pro license verification via Google account
  - `identity.email`: used to verify Pro licenses using primary email
- License verification:
  - Only occurs on install, after purchase, and every 24 hours for Pro users
  - Email is never stored, only used for temporary verification
  - Uses secure Cloud Run endpoint for license validation

## [1.0.2] - 2025-10-21
### Changed
- popup: replace unsafe innerHTML with DOM-created <img> icons for action buttons (external-link, copy, trash) to improve safety and maintainability (`popup/popup.js`).
- popup: update copy-button UX to show a temporary checkmark and restore the icon after a successful copy (`popup/popup.js`).
- popup: remove unused `upgradeLink` reference and guard inline `upgradePromptLink` usage inside `renderPrompts` to prevent a `ReferenceError` when the element is missing (`popup/popup.js`).
- popup: use a `promptCount` variable for clarity when computing counts and displaying `saved X/Y prompts` (`popup/popup.js`).
- popup: tidy CSS and add `.info-prompt` styles; remove `.upgrade-container` and adjust `.search-container` layout (`popup/popup.css`).
- locales: update English strings to improved marketing copy (`_locales/en/messages.json`).

### Files changed
- `popup/popup.html` — markup adjustments for review/upgrade prompts and prompt-count placement.
- `popup/popup.js` — fixes and refactors: DOM creation for icons, prompt counting, guarded upgrade link handling, and copy UX improvements.
- `popup/popup.css` — removed unused `.upgrade-container`, added `.info-prompt` styles and layout tweaks.
- `_locales/en/messages.json` — updated extension name and description.

### Notes & Validation
- Behaviour preserved: header `upgradeButton` and inline `upgradePrompt` remain active upgrade entry points.
- Performed a syntax/reference scan on modified files; no syntax or ReferenceError issues were found after the fixes.
- These edits were in the working tree and are now committed (see commit below).

## [1.0.1] - 2025-10-13
### Changed
- Removed unused `scripting` permission from `manifest.json` after auditing the codebase.

### Notes for Chrome Web Store Review
- The `scripting` permission was requested previously but not used by the extension. It has been removed to comply with the principle of least privilege.
- Remaining permissions:
  - `storage`: used for saving prompts and syncing via `chrome.storage.sync`.
  - `notifications`: used in the background service worker to show install and other system notifications.
  - `contextMenus`: used to create a right-click "Save Prompt to Prompt Recall" menu for manual prompt capture.




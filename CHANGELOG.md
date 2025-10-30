# Changelog

# v1.0.1
## 2025-10-13
### Changed
- Removed unused `scripting` permission from `manifest.json` after auditing the codebase.

### Notes for Chrome Web Store Review
- The `scripting` permission was requested previously but not used by the extension. It has been removed to comply with the principle of least privilege.
- Remaining permissions:
  - `storage`: used for saving prompts and syncing via `chrome.storage.sync`.
  - `notifications`: used in the background service worker to show install and other system notifications.
  - `contextMenus`: used to create a right-click "Save Prompt to Prompt Recall" menu for manual prompt capture.

# v1.0.2
## 2025-10-21
### Changed

### Notes & Validation
### Changed
- popup: replace unsafe innerHTML with DOM-created <img> icons for action buttons (external-link, copy, trash) to improve safety and maintainability (`popup/popup.js`).
- popup: update copy-button UX to show a temporary checkmark and restore the icon after a successful copy (`popup/popup.js`).
- popup: remove unused `upgradeLink` reference and guard inline `upgradePromptLink` usage inside `renderPrompts` to prevent a `ReferenceError` when the element is missing (`popup/popup.js`).
- popup: use a `promptCount` variable for clarity when computing counts and displaying `saved X/Y prompts` (`popup/popup.js`).
- popup: tidy CSS and add `.info-prompt` styles; remove `.upgrade-container` and adjust `.search-container` layout (`popup/popup.css`).
- popup: fixed tick mark display issues
- locales: update English strings to improved marketing copy (`_locales/en/messages.json`).

## 2025-10-29
### Changed
- Implemented prompt compression using `lz-string` library. Prompts are now compressed before being saved to `chrome.storage.sync` and decompressed when read. This allows for significantly larger prompts to be stored, overcoming the previous size limitations.
- Updated `background.js` to include compression and decompression logic.
- Added `utils/lz-string.js` to the project and ensured it is correctly imported in the service worker.

### Files changed
- `popup/popup.html` — markup adjustments for review/upgrade prompts and prompt-count placement. Added standard <meta charset="UTF-8"> declaration as best practice to prevent further character display issues. 
- `popup/popup.js` — fixes and refactors: DOM creation for icons, prompt counting, guarded upgrade link handling, and copy UX improvements.
- `popup/popup.css` — removed unused `.upgrade-container`, added `.info-prompt` styles and layout tweaks.
- `_locales/en/messages.json` — updated extension name and description.

### Notes & Validation
- Behaviour preserved: header `upgradeButton` and inline `upgradePrompt` remain active upgrade entry points.
- Performed a syntax/reference scan on modified files; no syntax or ReferenceError issues were found after the fixes.
- These edits were in the working tree and are now committed (see commit below).

## 2025-10-30
### Changed
- popup: make threshold logic robust — coerce `PROMPT_LIMIT`, compute explicit `reviewThreshold` (Math.ceil 60%) and coerce prompt counts so the review prompt reliably appears at 15 and upgrade at the limit (25). (`popup/popup.js`)
- content: fix async storage call in content script — wrap `chrome.storage.sync.get` in a Promise to avoid using `await` directly on callback-style API and prevent runtime failures in content scripts. (`content/content.js`)
- background: ensure service worker imports resolve reliably — use `chrome.runtime.getURL('utils/lz-string.js')` in `importScripts` so LZString is always available in the service worker. (`background/background.js`)

### Files changed
- `popup/popup.js` — threshold logic and display behavior for review/upgrade prompts.
- `content/content.js` — compatibility fix for chrome.storage call in content script.
- `background/background.js` — importScripts path fix for LZString.

### Notes & Validation
- Searched repository to ensure no remaining uses of `await chrome.storage.sync.get(...)` and confirmed imports use `chrome.runtime.getURL(...)` for LZString.
- Changes are currently in the working tree and are included in the commit pushed to `prompt-compression` per the attached commit message.


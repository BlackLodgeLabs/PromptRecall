# Prompt Recall 

**A Chrome Extension to automatically capture, organize, and sync your favorite AI prompts directly from leading Large Language Model (LLM) websites.**

-----

## Overview

Prompt Recall is designed for prompt engineers, writers, developers, and anyone who uses multiple  AI tools frequently. Stop losing valuable prompts in chat history\!

The extension unobtrusively monitors your activity on supported AI platforms and automatically saves your unique text prompts to a local, private, searchable library within your Chrome browser storage.

### Core Features

  * **Automatic Capture:** Prompts are automatically saved as soon as you submit them on a supported platform.
  * **Prompt Library:** View, search, and filter your saved prompts in a clean, organized popup interface.
  * **Quick Actions:** Copy a prompt to the clipboard with one click, or jump back to the original chat session via the saved URL.
  * **Cross-Device Sync:** Prompts are stored using `chrome.storage.sync`, meaning your entire library automatically syncs across all your devices where you are logged into Chrome.
  * **Site Control:** Customize capture settings to enable or disable automatic saving for specific AI sites.

-----

## Supported Platforms

Prompt Recall is actively designed to monitor user input on the following websites for automatic capture:

| Platform | Domain | Capture Method |
| :--- | :--- | :--- |
| **ChatGPT** | `chatgpt.com` / `chat.openai.com` | MutationObserver |
| **Google Gemini** | `gemini.google.com` | MutationObserver |
| **Perplexity AI** | `perplexity.ai` | MutationObserver |
| **Anthropic Claude** | `claude.ai` | MutationObserver |
| **Grok** | `grok.com` | MutationObserver |
| **Manual Capture:** | Any of the above sites | Context Menu (Right-Click) |

-----

## Installation

### From the Chrome Web Store

The easiest way to install Prompt Recall is via the Chrome Web Store:

1.  [Link to Chrome Web Store Listing] (Coming Soon\!)
2.  Click **"Add to Chrome."**
3.  Pin the extension icon ($\mathbf{\mathbf{\text{Puzzle Piece Icon}}}$) to your toolbar for easy access.

### Local Development / Unpacked Build

1.  Clone this repository to your local machine.
    ```bash
    git clone [Your Repository URL]
    ```
2.  Open Chrome and navigate to `chrome://extensions`.
3.  Toggle **Developer mode** on (top right corner).
4.  Click **Load unpacked**.
5.  Select the directory where you cloned this repository.

-----

## Permissions and Why They're Needed

This extension requests the minimum permissions required to implement its features. Below is a short explanation of each permission declared in `manifest.json` and why the extension needs it:

- `storage` — Used to save users' prompts and settings (like enabled sites and toast notification preferences) via `chrome.storage.sync`. This enables cross-device synchronization of the prompt library. The extension reads and writes saved prompts in `popup`, `options`, `background`, and `content` scripts.

- `notifications` — Used in the background service worker to display a one-time install notification and (optionally) other system notifications. The content script implements small in-page toast messages, but the `notifications` permission allows background-driven notifications if needed.

- `contextMenus` — Used to add a right-click context menu item "Save Prompt to Prompt Recall" for quick manual saving of selected text on supported AI sites. The context menu is created in the background service worker and handled by `background/background.js`.

Note: The `scripting` permission was removed because this extension does not call the `chrome.scripting` API. The extension injects no programmatic scripts from the background; content scripts are declared statically in the manifest and execute where configured. 


## Settings and Customization

Access the Options page by right-clicking the extension icon in the toolbar and selecting **Options**.

| Setting | Default | Function |
| :--- | :--- | :--- |
| **Free Prompt Limit** | 25 Prompts | Maximum number of prompts stored before upgrade is suggested. |
| **Toast Notifications** | Enabled | Displays a small "Prompt saved\!" notification in the corner of the AI site upon successful capture. |
| **Supported Sites** | All listed sites | Toggle individual sites ON/OFF to control automatic prompt capture. |
| **Delete All** | N/A | Button to permanently wipe all saved prompts from your Chrome storage. |

-----

## Roadmap & Limitations

### Current Limitation (Free Version)

  * **Prompt Storage Limit:** The free version is capped at **25 saved prompts**. Users will be prompted to upgrade once this limit is reached.

### Technical Notes

  * The extension stores all user data (prompts and settings) locally via `chrome.storage.sync`. **No user data is ever sent to Black Lodge Labs servers.**
  * The core logic relies on specific DOM selectors for each AI website (e.g., `div[data-message-author-role="user"]` for ChatGPT). These selectors may break if the target AI website changes its front-end structure.

-----

## Support and Contributing

We welcome contributions, bug reports, and feature requests.

| Request Type | Destination |
| :--- | :--- |
| **Bug Report** | Found a problem with capture or functionality? [**File a Bug Report here**](https://github.com/blacklodgelabs/PromptRecall/issues/new?template=bug_report.md) |
| **Feature Request** | Suggest a new feature, a new supported site, or an improvement. [**Suggest a Feature here**](https://github.com/blacklodgelabs/PromptRecall/issues/new?template=feature_request.md) |
| **General Support / Billing** | Please contact us via email: **support@blacklodgelabs.com** |
| **Support Development** | [Buy us a coffee\!](https://github.com/sponsors/blacklodgelabs) |

-----

## License

This project is licensed under the **MIT License**.

See the [LICENSE](LICENSE) file for details.

© 2025 Black Lodge Labs.
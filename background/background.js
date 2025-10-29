// Import extension config into the service worker using an absolute extension URL
importScripts(chrome.runtime.getURL('config.js'), '../utils/lz-string.js');

// Create context menu on extension install
chrome.runtime.onInstalled.addListener(() => {
  chrome.notifications.create({
    type: "basic",
    iconUrl: chrome.runtime.getURL("assets/icons/icon-128.png"),
    title: "Prompt Recall Installed",
    message: "Click the icon to view and manage your AI prompts!"
  });

  chrome.contextMenus.create({
    id: "save-prompt",
    title: "Save Prompt to Prompt Recall",
    contexts: ["selection"],
    documentUrlPatterns: [
      "https://chat.openai.com/*",
      "https://chatgpt.com/*",
      "https://claude.ai/*",
      "https://gemini.google.com/*",
      "https://perplexity.ai/*",
      "https://www.perplexity.ai/*",
      "https://grok.com/*"
    ]
  });

  // Open options page on first install
  chrome.runtime.openOptionsPage();
});

// Log to confirm background script is running
// background debug helper
let __PR_BG_DEBUG = false;
chrome.storage.sync.get({ debugVerbose: false }, (cfg) => { __PR_BG_DEBUG = !!cfg.debugVerbose; });
function dbgBg() { if (!__PR_BG_DEBUG) return; try { console.log.apply(console, arguments); } catch (e) {} }

dbgBg("prompt recall extension installed.");

// Handle context menu click
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "save-prompt" && info.selectionText) {
    const promptText = info.selectionText.trim();
    if (promptText) {
      savePrompt({
        id: Date.now(),
        prompt: promptText,
        timestamp: new Date().toISOString(),
        site: new URL(tab.url).hostname,
        url: tab.url
      }, null, tab);
    }
  }
});

// Handle messages from content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "savePrompt" && message.data) {
    savePrompt(message.data, sendResponse, sender.tab);
    return true; // Indicates that the response is sent asynchronously
  }
});

// Function to save prompt with limit check
function savePrompt(promptData, sendResponse, tab) {
  chrome.storage.sync.get(['prompts'], (result) => {
    const prompts = result.prompts || [];

    // Helper that performs normalization and saves the prompt
    const normalizeAndSave = (freshTabUrl) => {
      try {
        const tabUrl = freshTabUrl || (tab && tab.url) || null;
        let promptUrl = promptData.url || '';

        // Host-aware generic detection: treat some site patterns (like Perplexity's /search/new/...) as still-generic
        const isGeneric = (() => {
          if (!promptUrl) return true;
          try {
            const p = new URL(promptUrl);
            const pathname = p.pathname || '/';
            const segments = pathname.split('/').filter(Boolean);
            // Base rule: single-segment (or root) is generic
            if (segments.length <= 1) return true;
            const host = (p.hostname || '').toLowerCase();
            // Perplexity: /search/new/<uuid> is not a pretty slug — treat as generic
            if (host.includes('perplexity.ai') && /^\/search\/new\//.test(pathname)) return true;
            // Otherwise consider it specific
            return false;
          } catch (e) { return true; }
        })();

        if (isGeneric && tabUrl) {
          try {
            const t = new URL(tabUrl);
            const tSegments = t.pathname.split('/').filter(Boolean);
              if (tSegments.length > 1 || (tSegments.length === 1 && t.pathname !== '/')) {
              dbgBg('background: replacing generic promptData.url', promptUrl, 'with tab.url', tabUrl);
              promptData.url = tabUrl;
            } else if (!promptUrl) {
              dbgBg('background: populating empty promptData.url from tab.url', tabUrl);
              promptData.url = tabUrl;
            }
          } catch (e) {
            if (!promptUrl) promptData.url = tabUrl;
          }
        }

        if ((!promptData.site || promptData.site === '') && promptData.url) {
          try { promptData.site = new URL(promptData.url).hostname; } catch (e) { promptData.site = promptData.url; }
        }
      } catch (e) {
        console.warn('background: error normalizing prompt url/site', e);
      }

      // duplicate check
      const existingPrompt = prompts.find(p => {
        let decompressedPrompt = p.prompt;
        try {
          decompressedPrompt = LZString.decompressFromUTF16(p.prompt) || p.prompt;
        } catch (e) {
          console.warn('Error decompressing prompt for duplicate check:', e);
        }
        return decompressedPrompt === promptData.prompt && p.site === promptData.site;
      });

      if (existingPrompt) {
        dbgBg("Prompt for this site already exists. Ignoring.");
        if (sendResponse) {
          sendResponse({ status: 'duplicate' });
        } else if (tab && tab.id) {
          chrome.tabs.sendMessage(tab.id, { action: "showToast", message: "Prompt already saved." });
        }
        return;
      }

      if (prompts.length >= PROMPT_LIMIT) {
        console.log("Prompt limit reached.");
        if (sendResponse) {
          sendResponse({ status: 'limit_reached' });
        } else if (tab && tab.id) {
          chrome.tabs.sendMessage(tab.id, { action: "showToast", message: "Prompt limit reached." });
        }
        return;
      }

      try {
        const compressedPrompt = LZString.compressToUTF16(promptData.prompt);
        promptData.prompt = compressedPrompt;
      } catch (e) {
        console.warn('Could not compress prompt, saving uncompressed. Error:', e);
        // If compression fails, we'll just try to save it uncompressed.
      }

      prompts.push(promptData);
      chrome.storage.sync.set({ prompts }, () => {
        if (chrome.runtime.lastError) {
          const err = (chrome.runtime.lastError && chrome.runtime.lastError.message) ? chrome.runtime.lastError.message : '';
          console.warn('chrome.storage.sync.set error:', err);
          if (err.toLowerCase().includes('quota')) {
            chrome.storage.local.get(['prompts_local'], (localRes) => {
              const localPrompts = localRes.prompts_local || [];
              localPrompts.push(promptData);
              chrome.storage.local.set({ prompts_local: localPrompts }, () => {
                console.log('Prompt saved to local storage due to sync quota:', promptData);
                chrome.runtime.sendMessage({ action: "promptsUpdated" }, () => {});
                if (sendResponse) {
                  sendResponse({ status: 'success_local' });
                } else if (tab && tab.id) {
                  chrome.tabs.sendMessage(tab.id, { action: "showToast", message: "Prompt saved locally (sync quota reached)." });
                }
              });
            });
            return;
          }
        }

  dbgBg("Prompt saved:", promptData);
        chrome.runtime.sendMessage({ action: "promptsUpdated" }, () => { if (chrome.runtime.lastError) { /* Ignore error */ } });
        if (sendResponse) {
          sendResponse({ status: 'success' });
        } else if (tab && tab.id) {
          chrome.tabs.sendMessage(tab.id, { action: "showToast", message: "Prompt saved!" });
        }
      });
    };

    // If the promptData.url looks generic, poll the tab for a few seconds to see if the URL updates.
    try {
      const promptUrl = promptData.url || '';
      let isGeneric = true;
      try {
        const p = new URL(promptUrl);
        const segments = p.pathname.split('/').filter(Boolean);
        isGeneric = segments.length <= 1;
      } catch (e) {
        isGeneric = true;
      }

        if (isGeneric && tab && tab.id && chrome.tabs && chrome.tabs.get) {
        let attempts = 0;
        const maxAttempts = 24; // up to ~6s (250ms * 24)
        const intervalMs = 250;
        const pollInterval = setInterval(() => {
          attempts += 1;
          try {
            chrome.tabs.get(tab.id, (tabInfo) => {
              if (!chrome.runtime.lastError && tabInfo && tabInfo.url) {
                try {
                    // Use host-aware specificity check to avoid accepting Perplexity's /search/new/* as final
                    const tUrl = tabInfo.url;
                    const tIsSpecific = (() => {
                      try {
                        const tu = new URL(tUrl);
                        const tPath = tu.pathname || '/';
                        const tSeg = tPath.split('/').filter(Boolean);
                        // Base: require more than one segment
                        if (tSeg.length <= 1) return false;
                        const th = (tu.hostname || '').toLowerCase();
                        if (th.includes('perplexity.ai')) {
                          // consider specific only if it's NOT /search/new/
                          if (/^\/search\/(?!new\/).+/.test(tPath)) return true;
                          return false;
                        }
                        // For gemini/chatgpt etc, require >1 segments or known patterns
                        if (tSeg.length > 1) return true;
                        if (/\/app\/[A-Za-z0-9_-]+|\/c\/[A-Za-z0-9_-]+/.test(tPath)) return true;
                        return false;
                      } catch (e) { return false; }
                    })();

                    if (tIsSpecific) {
                      clearInterval(pollInterval);
                      normalizeAndSave(tabInfo.url);
                      return;
                    }
                } catch (e) { /* ignore */ }
              }

              if (attempts >= maxAttempts) {
                clearInterval(pollInterval);
                // give up and use whatever tab.url was provided
                try {
                  chrome.tabs.get(tab.id, (finalTab) => {
                    normalizeAndSave(finalTab && finalTab.url ? finalTab.url : (tab && tab.url));
                  });
                } catch (e) {
                  normalizeAndSave(tab && tab.url);
                }
              }
            });
          } catch (e) {
            clearInterval(pollInterval);
            normalizeAndSave(tab && tab.url);
          }
        }, intervalMs);
        return;
      }
    } catch (e) { /* ignore */ }

    // fallback
    normalizeAndSave(tab && tab.url);
  });
}
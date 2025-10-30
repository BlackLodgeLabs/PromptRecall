// Import extension config into the service worker using absolute extension URLs
// Use chrome.runtime.getURL for all imports to ensure correct resolution in the service worker
importScripts(chrome.runtime.getURL('config.js'), chrome.runtime.getURL('utils/lz-string.js'));

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
  dbgBg('savePrompt: called with', promptData);
  chrome.storage.sync.get(null, (items) => {
    dbgBg('savePrompt: storage.sync.get returned', items);
    const prompts = Object.keys(items)
      .filter(key => key.startsWith('prompt_'))
      .map(key => items[key]);
    dbgBg('savePrompt: existing prompts found:', prompts.length);

    // Helper that performs normalization and saves the prompt
    const normalizeAndSave = (freshTabUrl) => {
      dbgBg('normalizeAndSave: called with', freshTabUrl);
      try {
        const tabUrl = freshTabUrl || (tab && tab.url) || null;
        let promptUrl = promptData.url || '';

        // Host-aware generic detection
        const isGeneric = (() => {
          if (!promptUrl) return true;
          try {
            const p = new URL(promptUrl);
            const pathname = p.pathname || '/';
            const segments = pathname.split('/').filter(Boolean);
            if (segments.length <= 1) return true;
            const host = (p.hostname || '').toLowerCase();
            if (host.includes('perplexity.ai') && /^\/search\/new\//.test(pathname)) return true;
            return false;
          } catch (e) { return true; }
        })();

        if (isGeneric && tabUrl) {
          try {
            const t = new URL(tabUrl);
            const tSegments = t.pathname.split('/').filter(Boolean);
              if (tSegments.length > 1 || (tSegments.length === 1 && t.pathname !== '/')) {
              dbgBg('normalizeAndSave: replacing generic promptData.url', promptUrl, 'with tab.url', tabUrl);
              promptData.url = tabUrl;
            } else if (!promptUrl) {
              dbgBg('normalizeAndSave: populating empty promptData.url from tab.url', tabUrl);
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
        console.warn('normalizeAndSave: error normalizing prompt url/site', e);
      }

      let compressedPrompt;
      try {
        dbgBg('normalizeAndSave: Compressing prompt...');
        compressedPrompt = LZString.compressToUTF16(promptData.prompt);
        dbgBg('normalizeAndSave: Compression successful.');
      } catch (e) {
        console.error('Fatal: Could not compress prompt, aborting save. Error:', e);
        if (sendResponse) sendResponse({ status: 'error', message: 'Could not compress prompt.' });
        return;
      }

      const existingPrompt = prompts.find(p => p.prompt === compressedPrompt && p.site === promptData.site);
      if (existingPrompt) {
        dbgBg("normalizeAndSave: Prompt for this site already exists. Ignoring.");
        if (sendResponse) sendResponse({ status: 'duplicate' });
        else if (tab && tab.id) chrome.tabs.sendMessage(tab.id, { action: "showToast", message: "Prompt already saved." });
        return;
      }

      if (prompts.length >= PROMPT_LIMIT) {
        dbgBg("normalizeAndSave: Prompt limit reached.");
        if (sendResponse) sendResponse({ status: 'limit_reached' });
        else if (tab && tab.id) chrome.tabs.sendMessage(tab.id, { action: "showToast", message: "Prompt limit reached." });
        return;
      }

      promptData.prompt = compressedPrompt;
      const newKey = `prompt_${promptData.id}`;
      const newData = {};
      newData[newKey] = promptData;

      dbgBg('normalizeAndSave: Saving new prompt with key:', newKey);
      chrome.storage.sync.set(newData, () => {
        if (chrome.runtime.lastError) {
          const err = (chrome.runtime.lastError && chrome.runtime.lastError.message) ? chrome.runtime.lastError.message : '';
          console.error('chrome.storage.sync.set error:', err);
          if (sendResponse) sendResponse({ status: 'error', message: 'Failed to save prompt.' });
          return;
        }

        dbgBg("normalizeAndSave: Prompt saved successfully:", promptData);
        chrome.runtime.sendMessage({ action: "promptsUpdated" }, () => { if (chrome.runtime.lastError) { /* Ignore */ } });
        if (sendResponse) sendResponse({ status: 'success' });
        else if (tab && tab.id) chrome.tabs.sendMessage(tab.id, { action: "showToast", message: "Prompt saved!" });
      });
    };

    // URL Polling Logic
    try {
      const promptUrl = promptData.url || '';
      let isGeneric = true;
      try {
        const p = new URL(promptUrl);
        const segments = p.pathname.split('/').filter(Boolean);
        isGeneric = segments.length <= 1;
      } catch (e) { isGeneric = true; }

      if (isGeneric && tab && tab.id && chrome.tabs && chrome.tabs.get) {
        let attempts = 0;
        const maxAttempts = 24;
        const intervalMs = 250;
        dbgBg('savePrompt: URL is generic, starting polling...');
        const pollInterval = setInterval(() => {
          attempts += 1;
          try {
            chrome.tabs.get(tab.id, (tabInfo) => {
              if (chrome.runtime.lastError) {
                clearInterval(pollInterval);
                dbgBg('savePrompt: Polling failed (tab closed?), saving with original URL.');
                normalizeAndSave(tab && tab.url);
                return;
              }

              if (tabInfo && tabInfo.url) {
                const tUrl = tabInfo.url;
                const tIsSpecific = (() => {
                  try {
                    const tu = new URL(tUrl);
                    const tPath = tu.pathname || '/';
                    const tSeg = tPath.split('/').filter(Boolean);
                    if (tSeg.length <= 1) return false;
                    const th = (tu.hostname || '').toLowerCase();
                    if (th.includes('perplexity.ai')) {
                      if (/^\/search\/(?!new\/).+/.test(tPath)) return true;
                      return false;
                    }
                    if (tSeg.length > 1) return true;
                    if (/\/app\/[A-Za-z0-9_-]+|\/c\/[A-Za-z0-9_-]+/.test(tPath)) return true;
                    return false;
                  } catch (e) { return false; }
                })();

                if (tIsSpecific) {
                  dbgBg('savePrompt: Polling found specific URL, saving:', tUrl);
                  clearInterval(pollInterval);
                  normalizeAndSave(tUrl);
                  return;
                }
              }

              if (attempts >= maxAttempts) {
                dbgBg('savePrompt: Polling timed out, saving with current URL.');
                clearInterval(pollInterval);
                normalizeAndSave(tabInfo && tabInfo.url ? tabInfo.url : (tab && tab.url));
              }
            });
          } catch (e) {
            dbgBg('savePrompt: Polling threw an error, stopping.', e);
            clearInterval(pollInterval);
            normalizeAndSave(tab && tab.url);
          }
        }, intervalMs);
        return;
      }
    } catch (e) { dbgBg('savePrompt: URL polling block failed.', e); }

    dbgBg('savePrompt: URL is not generic, saving immediately.');
    normalizeAndSave(tab && tab.url);
  });
}
// Import extension config into the service worker using an absolute extension URL
importScripts(chrome.runtime.getURL('config.js'));

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
console.log("prompt recall extension installed.");

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

    const existingPrompt = prompts.find(p => p.prompt === promptData.prompt && p.site === promptData.site);
    if (existingPrompt) {
      console.log("Prompt for this site already exists. Ignoring.");
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

    prompts.push(promptData);
    chrome.storage.sync.set({ prompts }, () => {
      console.log("Prompt saved:", promptData);
      chrome.runtime.sendMessage({ action: "promptsUpdated" }, () => {
        if (chrome.runtime.lastError) { /* Ignore error */ }
      });
      if (sendResponse) {
        sendResponse({ status: 'success' });
      } else if (tab && tab.id) {
        chrome.tabs.sendMessage(tab.id, { action: "showToast", message: "Prompt saved!" });
      }
    });
  });
}
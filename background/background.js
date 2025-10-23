// Import extension config
import { PROMPT_LIMIT, APP_CONFIG } from '../config.js';

// License verification function
async function verifyLicense(force = false) {
  try {
    // Check if we have a recent verification
    const ONE_DAY = 24 * 60 * 60 * 1000;
    const storageData = await chrome.storage.local.get(['licenseStatus']);
    const licenseStatus = storageData.licenseStatus;
    
    // If we have a recent check (less than 24 hours old) and not forcing, use cached result
    if (!force && licenseStatus?.timestamp && (Date.now() - licenseStatus.timestamp < ONE_DAY)) {
      return licenseStatus.valid;
    }

    // Get user's email
    const userInfo = await chrome.identity.getProfileUserInfo({ accountStatus: 'ANY' });
    if (!userInfo || !userInfo.email) {
      console.warn('Could not get user email for license verification');
      return false;
    }

    // Call license verifier service
    const response = await fetch(`${APP_CONFIG.LINKS.licenseVerifier}/verify?email=${encodeURIComponent(userInfo.email)}`);
    const data = await response.json();
    
    // Store license status with timestamp
    await chrome.storage.local.set({ 
      licenseStatus: {
        valid: data.valid,
        timestamp: Date.now(),
        email: userInfo.email
      }
    });

    return data.valid;
  } catch (error) {
    console.error('License verification failed:', error);
    return false;
  }
}

// Initial license check on startup
async function initializeLicenseCheck() {
  try {
    await verifyLicense(true); // Force initial check
  } catch (error) {
    console.error('Error during license initialization:', error);
  }
}

// Log to confirm background script is running
// background debug helper
let __PR_BG_DEBUG = false;

async function initDebug() {
  const cfg = await chrome.storage.sync.get({ debugVerbose: false });
  __PR_BG_DEBUG = !!cfg.debugVerbose;
}

function dbgBg(...args) {
  if (!__PR_BG_DEBUG) return;
  try {
    console.log(...args);
  } catch (e) {}
}

// Initialize the extension
chrome.runtime.onInstalled.addListener(async () => {
  try {
    // Initialize debug mode
    await initDebug();
    
    // Initialize license check
    await initializeLicenseCheck();
    
    // Create welcome notification
    chrome.notifications.create({
      type: "basic",
      iconUrl: chrome.runtime.getURL("assets/icons/icon-128.png"),
      title: "Prompt Recall Installed",
      message: "Click the icon to view and manage your AI prompts!"
    });

    // Create context menu
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

    // Open options page
    chrome.runtime.openOptionsPage();
    
    dbgBg("Prompt Recall extension installed.");
  } catch (error) {
    console.error('Error during extension initialization:', error);
  }
});

// Handle context menu click
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === "save-prompt" && info.selectionText) {
    const promptText = info.selectionText.trim();
    if (promptText) {
      await savePrompt({
        id: Date.now(),
        prompt: promptText,
        timestamp: new Date().toISOString(),
        site: tab.url ? new URL(tab.url).hostname : '',
        url: tab.url
      }, null, tab);
    }
  }
});

// Handle messages from content script and popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "savePrompt" && message.data) {
    savePrompt(message.data, sendResponse, sender.tab)
      .catch(error => {
        console.error('Error saving prompt:', error);
        sendResponse({ status: 'error' });
      });
    return true; // Indicates that the response is sent asynchronously
  } else if (message.action === "checkLicense") {
    // Check license when popup opens
    verifyLicense()
      .then(isValid => {
        sendResponse({ valid: isValid });
      })
      .catch(error => {
        console.error('Error checking license:', error);
        sendResponse({ valid: false });
      });
    return true; // Indicates that the response is sent asynchronously
  }
});

// Function to normalize URL and check if it's generic
function isUrlGeneric(url) {
  if (!url) return true;
  try {
    const parsedUrl = new URL(url);
    const pathname = parsedUrl.pathname || '/';
    const segments = pathname.split('/').filter(Boolean);
    
    // Base rule: single-segment (or root) is generic
    if (segments.length <= 1) return true;
    
    const host = parsedUrl.hostname.toLowerCase();
    // Perplexity: /search/new/<uuid> is not a pretty slug — treat as generic
    if (host.includes('perplexity.ai') && /^\/search\/new\//.test(pathname)) return true;
    
    return false;
  } catch (e) {
    return true;
  }
}

// Function to check if URL is specific enough
function isUrlSpecific(url) {
  try {
    const parsedUrl = new URL(url);
    const pathname = parsedUrl.pathname || '/';
    const segments = pathname.split('/').filter(Boolean);
    
    // Base: require more than one segment
    if (segments.length <= 1) return false;
    
    const host = parsedUrl.hostname.toLowerCase();
    if (host.includes('perplexity.ai')) {
      // consider specific only if it's NOT /search/new/
      if (/^\/search\/(?!new\/).+/.test(pathname)) return true;
      return false;
    }
    
    // For gemini/chatgpt etc, require >1 segments or known patterns
    if (segments.length > 1) return true;
    if (/\/app\/[A-Za-z0-9_-]+|\/c\/[A-Za-z0-9_-]+/.test(pathname)) return true;
    
    return false;
  } catch (e) {
    return false;
  }
}

// Function to normalize prompt data
async function normalizePromptData(promptData, tab) {
  const normalized = { ...promptData };
  
  try {
    if (tab?.id) {
      // Get fresh tab URL
      const tabInfo = await chrome.tabs.get(tab.id);
      const tabUrl = tabInfo.url;
      const promptUrl = promptData.url || '';

      if (isUrlGeneric(promptUrl) && tabUrl) {
        if (!isUrlGeneric(tabUrl)) {
          dbgBg('background: replacing generic promptData.url', promptUrl, 'with tab.url', tabUrl);
          normalized.url = tabUrl;
        } else if (!promptUrl) {
          dbgBg('background: populating empty promptData.url from tab.url', tabUrl);
          normalized.url = tabUrl;
        }
      }
    }

    // Update site if needed
    if ((!normalized.site || normalized.site === '') && normalized.url) {
      try {
        normalized.site = new URL(normalized.url).hostname;
      } catch (e) {
        normalized.site = normalized.url;
      }
    }
  } catch (e) {
    console.warn('background: error normalizing prompt url/site', e);
  }

  return normalized;
}

// Function to save prompt with limit check
async function savePrompt(promptData, sendResponse, tab) {
  try {
    // Get current prompts
    const [syncResult, licenseResult] = await Promise.all([
      chrome.storage.sync.get(['prompts']),
      chrome.storage.local.get(['licenseStatus'])
    ]);
    
    const prompts = syncResult.prompts || [];
    const hasValidLicense = licenseResult?.licenseStatus?.valid === true;

    // Normalize the prompt data
    const normalizedPrompt = await normalizePromptData(promptData, tab);
    
    // Check for duplicates
    const existingPrompt = prompts.find(p => p.prompt === normalizedPrompt.prompt && p.site === normalizedPrompt.site);
    if (existingPrompt) {
      dbgBg("Prompt for this site already exists. Ignoring.");
      if (sendResponse) {
        sendResponse({ status: 'duplicate' });
      } else if (tab?.id) {
        await chrome.tabs.sendMessage(tab.id, { action: "showToast", message: "Prompt already saved." });
      }
      return;
    }

    // Check prompt limit for free users
    if (!hasValidLicense && prompts.length >= PROMPT_LIMIT) {
      console.log("Prompt limit reached for free tier.");
      if (sendResponse) {
        sendResponse({ 
          status: 'limit_reached',
          upgradeUrl: APP_CONFIG.LINKS.upgradePage
        });
      } else if (tab?.id) {
        await chrome.tabs.sendMessage(tab.id, { 
          action: "showToast", 
          message: "Free tier limit reached. Upgrade for unlimited prompts.",
          isError: true
        });
      }
      return;
    }

    // Save the prompt
    prompts.push(normalizedPrompt);
    try {
      await chrome.storage.sync.set({ prompts });
      dbgBg("Prompt saved:", normalizedPrompt);
      
      // Notify about update
      try {
        await chrome.runtime.sendMessage({ action: "promptsUpdated" });
      } catch (e) {
        // Ignore message sending errors
      }

      if (sendResponse) {
        sendResponse({ status: 'success' });
      } else if (tab?.id) {
        await chrome.tabs.sendMessage(tab.id, { action: "showToast", message: "Prompt saved!" });
      }
    } catch (err) {
      // Handle quota exceeded error
      if (err.message?.toLowerCase().includes('quota')) {
        const localResult = await chrome.storage.local.get(['prompts_local']);
        const localPrompts = localResult.prompts_local || [];
        localPrompts.push(normalizedPrompt);
        await chrome.storage.local.set({ prompts_local: localPrompts });
        
        console.log('Prompt saved to local storage due to sync quota:', normalizedPrompt);
        
        try {
          await chrome.runtime.sendMessage({ action: "promptsUpdated" });
        } catch (e) {
          // Ignore message sending errors
        }

        if (sendResponse) {
          sendResponse({ status: 'success_local' });
        } else if (tab?.id) {
          await chrome.tabs.sendMessage(tab.id, { 
            action: "showToast", 
            message: "Prompt saved locally (sync quota reached)." 
          });
        }
      } else {
        throw err; // Re-throw non-quota errors
      }
    }
  } catch (error) {
    console.error('Error saving prompt:', error);
    if (sendResponse) {
      sendResponse({ status: 'error' });
    }
    throw error; // Re-throw to be caught by the message handler
  }
}
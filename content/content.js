console.log('Content script loaded on:', location.hostname);

// Function to show a toast notification
function showToast(message) {
  const toast = document.createElement('div');
  toast.textContent = message;
  
  // Basic styling for the toast
  toast.style.position = 'fixed';
  toast.style.top = '20px';
  toast.style.right = '20px';
  toast.style.backgroundColor = '#E63946'; // Red background
  toast.style.color = 'white';
  toast.style.padding = '10px 20px';
  toast.style.borderRadius = '5px';
  toast.style.zIndex = '9999';
  toast.style.opacity = '0';
  toast.style.transition = 'opacity 0.3s ease-in-out';
  toast.style.fontFamily = 'Montserrat, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, "Open Sans", "Helvetica Neue", sans-serif';
  toast.style.fontSize = '14px';

  document.body.appendChild(toast);

  // Fade in
  setTimeout(() => {
    toast.style.opacity = '1';
  }, 100);

  // Fade out and remove after 3 seconds
  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => {
      if (document.body.contains(toast)) {
        document.body.removeChild(toast);
      } 
    }, 300);
  }, 3000);
}

// Function to send prompt to background script
function sendPrompt(prompt) {
  if (!chrome.runtime?.id) {
    if (typeof observer !== 'undefined') observer.disconnect();
    return;
  }

  chrome.runtime.sendMessage({ action: 'savePrompt', data: { id: Date.now(), prompt, timestamp: new Date().toISOString(), site: location.hostname, url: window.location.href } }, 
    (response) => {
      if (chrome.runtime.lastError) {
        console.error('Error sending message:', chrome.runtime.lastError.message);
        return;
      }
      
      if (response.status === 'success') {
        chrome.storage.sync.get({ showToastNotifications: true }, (data) => {
          if (data.showToastNotifications) {
            showToast('Prompt saved!');
          }
        });
      }
    });
}

// Configuration for different AI sites
const siteConfigs = {
  'chat.openai.com': {
    userPromptSelector: 'div[data-message-author-role="user"]',
    textSelector: 'div.whitespace-pre-wrap' 
  },
  'chatgpt.com': {
    userPromptSelector: 'div[data-message-author-role="user"]',
    textSelector: 'div.whitespace-pre-wrap' 
  },
  'gemini.google.com': {
    userPromptSelector: 'div.query-text',
    textSelector: 'p.query-text-line'
  },
  'perplexity.ai': {
    userPromptSelector: 'div[data-lexical-editor="true"][aria-readonly="true"]',
    textSelector: 'p'
  },
  'claude.ai': {
    userPromptSelector: 'div[data-testid="user-message"]',
    textSelector: 'p.whitespace-pre-wrap.break-words'
  },
  'grok.com': {
    userPromptSelector: 'div.items-end > div.message-bubble',
    textSelector: 'p.break-words'
  }
};

// Main logic to set up MutationObserver
async function setupMutationObserver() {
  const currentHostname = location.hostname;
  let config = null;

  // Determine site configuration
  for (const domain in siteConfigs) {
    if (currentHostname.includes(domain)) {
      config = siteConfigs[domain];
      break;
    }
  }

  // Fetch enabled sites from storage
  const storageData = await chrome.storage.sync.get({ enabledSites: Object.keys(siteConfigs) });
  const enabledSites = storageData.enabledSites;

  // Check if current site is enabled and a configuration exists
  if (config && enabledSites.some(site => currentHostname.includes(site))) {
    let lastSavedPrompt = '';

    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType !== 1) return;

          const userMessageNode = node.matches(config.userPromptSelector)
            ? node
            : node.querySelector(config.userPromptSelector);

          if (userMessageNode) {
            const textContainer = config.textSelector ? userMessageNode.querySelector(config.textSelector) : userMessageNode;
            const promptText = textContainer ? textContainer.innerText.trim() : userMessageNode.innerText.trim();

            if (promptText && promptText !== lastSavedPrompt) {
              lastSavedPrompt = promptText;
              sendPrompt(promptText);
            }
          }
        });
      });
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    console.log(`MutationObserver for ${currentHostname} is now active.`);
  } else {
    console.log(`Prompt Recall: Not active on ${currentHostname} (either no config or site disabled).`);
  }
}

// Call the setup function
setupMutationObserver();

// Listen for messages from background script (e.g., promptsUpdated)
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'promptsUpdated') {
    // No direct rendering in content script, but could trigger a re-check if needed
    // For now, this message is primarily for popup.js
  } else if (message.action === 'showToast') {
    showToast(message.message);
  }
});
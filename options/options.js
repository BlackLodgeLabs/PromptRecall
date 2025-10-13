document.addEventListener('DOMContentLoaded', () => {
  const toastToggle = document.getElementById('toast-toggle');
  const statusDiv = document.getElementById('status');
  const siteListDiv = document.getElementById('site-list');
  
  const deleteAllButton = document.getElementById('deleteAllButton');
  const promptCounter = document.getElementById('promptCounter');
  const upgradeButtonOptions = document.getElementById('upgradeButtonOptions');
  const buyMeACoffeeButton = document.getElementById('buyMeACoffeeButton');
  const reportBugButton = document.getElementById('reportBugButton');
  const featureRequestButton = document.getElementById('featureRequestButton');
  const upgradeLinkOptions = document.getElementById('upgradeLinkOptions');

  buyMeACoffeeButton.addEventListener('click', (e) => {
    e.preventDefault();
  const url = (window.APP_CONFIG && window.APP_CONFIG.getLink) ? window.APP_CONFIG.getLink('sponsor', 'https://github.com/sponsors/blacklodgelabs') : 'https://github.com/sponsors/blacklodgelabs';
    window.open(url, '_blank');
  });

  reportBugButton.addEventListener('click', (e) => {
    e.preventDefault();
  const url = (window.APP_CONFIG && window.APP_CONFIG.getLink) ? window.APP_CONFIG.getLink('bugReport', 'https://promptrecall.blacklodgelabs.com/support') : 'https://promptrecall.blacklodgelabs.com/support';
    window.open(url, '_blank');
  });

  featureRequestButton.addEventListener('click', (e) => {
    e.preventDefault();
  const url = (window.APP_CONFIG && window.APP_CONFIG.getLink) ? window.APP_CONFIG.getLink('featureRequest', 'https://promptrecall.blacklodgelabs.com/support') : 'https://promptrecall.blacklodgelabs.com/support';
    window.open(url, '_blank');
  });

  upgradeLinkOptions.addEventListener('click', (e) => {
    e.preventDefault();
  const url = (window.APP_CONFIG && window.APP_CONFIG.getLink) ? window.APP_CONFIG.getLink('upgradePage', 'https://promptrecall.blacklodgelabs.com/upgrade') : 'https://promptrecall.blacklodgelabs.com/upgrade';
    window.open(url, '_blank');
  });

  // Hardcoded list of supported sites (from manifest.json matches)
  const supportedSites = [
    "chatgpt.com",
    "gemini.google.com",
    "perplexity.ai",
    "claude.ai",
    "grok.com"
  ];

  // Function to update prompt counter
  function updatePromptCounter() {
    chrome.storage.sync.get(['prompts'], (result) => {
      const prompts = result.prompts || [];
      console.log('options.js: Prompts retrieved for counter:', prompts);
      console.log('options.js: Number of prompts:', prompts.length);
      promptCounter.textContent = `${prompts.length} prompts saved`;
    });
  }

  // Load saved settings and update UI
  chrome.storage.sync.get({ showToastNotifications: true, enabledSites: supportedSites, debugVerbose: false }, (data) => {
    toastToggle.checked = data.showToastNotifications;
    const debugToggle = document.getElementById('debug-toggle');
    debugToggle.checked = !!data.debugVerbose;

    console.log('options.js: supportedSites (hardcoded) =', supportedSites);
    console.log('options.js: data.enabledSites from storage (before check) =', data.enabledSites);

    // Ensure data.enabledSites is an array
    if (!Array.isArray(data.enabledSites)) {
      console.log('options.js: Converting data.enabledSites to array...');
      // If it's an object, convert its keys to an array (assuming keys are enabled sites)
      if (typeof data.enabledSites === 'object' && data.enabledSites !== null) {
        data.enabledSites = Object.keys(data.enabledSites).filter(key => data.enabledSites[key]);
      } else {
        // If it's null, undefined, or anything else, default to an empty array
        data.enabledSites = [];
      }
      // Save the corrected array back to storage immediately
      chrome.storage.sync.set({ enabledSites: data.enabledSites }, () => {
        console.log('options.js: Corrected enabledSites array saved to storage.');
      });
    }

    console.log('options.js: data.enabledSites from storage (after check) =', data.enabledSites);

    // Render site checkboxes
    siteListDiv.innerHTML = ''; // Clear existing content
    supportedSites.forEach(site => {
      const div = document.createElement('div');
      div.className = 'option';
      const label = document.createElement('label');
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.id = `site-${site.replace(/\./g, '-')}`;
      input.value = site;
      input.checked = data.enabledSites.includes(site);

      label.appendChild(input);
      label.appendChild(document.createTextNode(site));
      div.appendChild(label);
      siteListDiv.appendChild(div);
    });
  });

  // Save toast notification setting
  toastToggle.addEventListener('change', () => {
    chrome.storage.sync.set({ showToastNotifications: toastToggle.checked }, () => {
      statusDiv.textContent = 'Options saved.';
      setTimeout(() => {
        statusDiv.textContent = '';
      }, 1500);
    });
  });

    // Save debug toggle
    const debugToggleEl = document.getElementById('debug-toggle');
    debugToggleEl.addEventListener('change', () => {
      chrome.storage.sync.set({ debugVerbose: debugToggleEl.checked }, () => {
        statusDiv.textContent = 'Options saved.';
        setTimeout(() => { statusDiv.textContent = ''; }, 1500);
      });
    });

  // Save enabled sites setting
  siteListDiv.addEventListener('change', (e) => {
    if (e.target.type === 'checkbox' && e.target.id.startsWith('site-')) {
      chrome.storage.sync.get({ enabledSites: supportedSites }, (data) => {
        let updatedEnabledSites = data.enabledSites;
        if (e.target.checked) {
          if (!updatedEnabledSites.includes(e.target.value)) {
            updatedEnabledSites.push(e.target.value);
          }
        } else {
          updatedEnabledSites = updatedEnabledSites.filter(site => site !== e.target.value);
        }
        chrome.storage.sync.set({ enabledSites: updatedEnabledSites }, () => {
          statusDiv.textContent = 'Options saved.';
          setTimeout(() => {
            statusDiv.textContent = '';
          }, 1500);
        });
      });
    }
  });

  

  upgradeButtonOptions.addEventListener('click', (e) => {
    e.preventDefault();
  const url = (window.APP_CONFIG && window.APP_CONFIG.getLink) ? window.APP_CONFIG.getLink('upgradePage', 'https://promptrecall.blacklodgelabs.com/upgrade') : 'https://promptrecall.blacklodgelabs.com/upgrade';
    window.open(url, '_blank');
  });

  deleteAllButton.addEventListener('click', () => {
    chrome.storage.sync.get(['prompts'], (result) => {
      const prompts = result.prompts || [];
      if (prompts.length === 0) {
        alert('There are no prompts to delete.');
        return;
      }
      const confirmation = confirm(`Are you sure you want to delete all ${prompts.length} prompts? This action cannot be undone.`);
      if (confirmation) {
        chrome.storage.sync.set({ prompts: [] }, () => {
          updatePromptCounter();
          statusDiv.textContent = 'All prompts deleted.';
          setTimeout(() => {
            statusDiv.textContent = '';
          }, 1500);
        });
      }
    });
  });

  // Initial prompt counter update
  updatePromptCounter();
});
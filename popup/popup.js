document.addEventListener('DOMContentLoaded', () => {
  const promptList = document.getElementById('promptList');
  const promptCounter = document.getElementById('promptCountHeader'); // Updated ID
  const optionsButton = document.getElementById('optionsButton');
  const searchInput = document.getElementById('searchInput');
  const clearSearchButton = document.getElementById('clearSearchButton');
  const upgradeButton = document.getElementById('upgradeButton');
  const bugButton = document.getElementById('bugButton');

  bugButton.addEventListener('click', (e) => {
    e.preventDefault();
  const url = (window.APP_CONFIG && window.APP_CONFIG.getLink) ? window.APP_CONFIG.getLink('bugReport', 'https://promptrecall.blacklodgelabs.com/support') : 'https://promptrecall.blacklodgelabs.com/support';
  window.open(url, '_blank');
  });


  function formatTime(isoString) {
    return new Date(isoString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  function formatDate(date) {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };

    if (date.toDateString() === today.toDateString()) {
      return `today - ${date.toLocaleDateString(undefined, options)}`.toLowerCase();
    } else if (date.toDateString() === yesterday.toDateString()) {
      return `yesterday - ${date.toLocaleDateString(undefined, options)}`.toLowerCase();
    } else {
      return date.toLocaleDateString(undefined, options).toLowerCase();
    }
  }

  function cleanSite(site) {
    return site.replace(/www\.|\.com/gi, '');
  }

  let currentFilter = ''; // To store the current filter text

  function renderPrompts(filterText = '') {
    currentFilter = filterText.toLowerCase(); // Store and normalize filter text

    chrome.storage.sync.get(['prompts'], (syncRes) => {
      chrome.storage.local.get(['prompts_local'], (localRes) => {
        const syncPrompts = syncRes.prompts || [];
        const localPrompts = localRes.prompts_local || [];
        // Keep sync prompts first, then local fallbacks
        let prompts = syncPrompts.concat(localPrompts);
        const promptCount = prompts.length;
        prompts.reverse();

        if (currentFilter) {
          prompts = prompts.filter(prompt =>
            prompt.prompt.toLowerCase().includes(currentFilter) ||
            (prompt.site && prompt.site.toLowerCase().includes(currentFilter))
          );
        }

        promptCounter.textContent = `saved ${promptCount}/${PROMPT_LIMIT} prompts`;

        // Show/hide review and upgrade prompts
        const reviewPrompt = document.getElementById('reviewPrompt');
        const upgradePrompt = document.getElementById('upgradePrompt');
        const reviewThreshold = Math.floor(PROMPT_LIMIT * 0.6);
        // Guarded lookup for the inline upgrade prompt link (may not exist)
        const upgradePromptLink = document.getElementById('upgradePromptLink');

        if (promptCount >= PROMPT_LIMIT) {
          upgradePrompt.style.display = 'block';
          reviewPrompt.style.display = 'none';
          if (upgradePromptLink) upgradePromptLink.style.display = 'inline';
        } else if (promptCount >= reviewThreshold) {
          reviewPrompt.style.display = 'block';
          upgradePrompt.style.display = 'none';
          if (upgradePromptLink) upgradePromptLink.style.display = 'none';
        } else {
          reviewPrompt.style.display = 'none';
          upgradePrompt.style.display = 'none';
          if (upgradePromptLink) upgradePromptLink.style.display = 'none';
        }

        promptList.innerHTML = '';

        if (prompts.length === 0) {
          const row = document.createElement('tr');
          const cell = document.createElement('td');
          cell.colSpan = 4;
          cell.textContent = 'no prompts saved yet.';
          row.appendChild(cell);
          promptList.appendChild(row);
          return;
        }

        const groupedPrompts = prompts.reduce((groups, prompt) => {
          const date = new Date(prompt.timestamp).toDateString();
          if (!groups[date]) groups[date] = [];
          groups[date].push(prompt);
          return groups;
        }, {});

        for (const dateStr in groupedPrompts) {
          const date = new Date(dateStr);
          const headerRow = document.createElement('tr');
          const headerCell = document.createElement('th');
          headerCell.colSpan = 3;
          headerCell.textContent = formatDate(date);

          const deleteAllCell = document.createElement('th');
          deleteAllCell.className = 'delete-all-header';
          const deleteAllButton = document.createElement('button');
          deleteAllButton.className = 'delete-all-button';
          deleteAllButton.dataset.date = dateStr;
          deleteAllButton.textContent = 'delete all';
          deleteAllCell.appendChild(deleteAllButton);

          headerRow.appendChild(headerCell);
          headerRow.appendChild(deleteAllCell);
          promptList.appendChild(headerRow);

          groupedPrompts[dateStr].forEach((prompt) => {
            const row = document.createElement('tr');
            row.className = 'prompt-item';

            const timeCell = document.createElement('td');
            timeCell.textContent = formatTime(prompt.timestamp);

            const siteCell = document.createElement('td');
            siteCell.textContent = cleanSite(prompt.site || '');

            const promptCell = document.createElement('td');
            const promptText = prompt.prompt || '';
            if (promptText.length > 50) {
              const truncatedText = document.createElement('span');
              truncatedText.textContent = `${promptText.substring(0, 50)}... `;
              const fullText = document.createElement('span');
              fullText.textContent = promptText;
              fullText.style.display = 'none';
              const readMore = document.createElement('a');
              readMore.textContent = 'read more';
              readMore.href = '#';
              readMore.addEventListener('click', (e) => {
                e.preventDefault();
                truncatedText.style.display = 'none';
                fullText.style.display = 'inline';
                readMore.style.display = 'none';
              });
              promptCell.appendChild(truncatedText);
              promptCell.appendChild(fullText);
              promptCell.appendChild(readMore);
            } else {
              promptCell.textContent = promptText;
            }

            const actionsCell = document.createElement('td');
            actionsCell.className = 'prompt-actions';

            // LINK button
            const linkButton = document.createElement('button');
            linkButton.className = 'action-button link-button';
            linkButton.dataset.url = prompt.url || '';
            const linkImg = document.createElement('img');
            linkImg.src = '../assets/icons/external-link.svg';
            linkImg.alt = 'open url';
            linkButton.appendChild(linkImg);
            linkButton.title = 'open url';
            linkButton.addEventListener('click', (e) => {
              e.stopPropagation();
              if (prompt.url) window.open(prompt.url, '_blank');
            });
            actionsCell.appendChild(linkButton);

            // COPY button
            const copyButton = document.createElement('button');
            copyButton.className = 'action-button copy-button';
            copyButton.dataset.prompt = prompt.prompt || '';
            const copyImg = document.createElement('img');
            copyImg.src = '../assets/icons/copy.svg';
            copyImg.alt = 'copy prompt';
            copyButton.appendChild(copyImg);
            copyButton.title = 'copy prompt';
            copyButton.addEventListener('click', (e) => {
              e.stopPropagation();
              navigator.clipboard.writeText(prompt.prompt || '').then(() => {
                const originalSrc = copyImg.src;
                copyImg.src = '../assets/icons/check.svg';
                copyButton.title = 'copied!';
                setTimeout(() => {
                  copyImg.src = originalSrc;
                  copyButton.title = 'copy prompt';
                }, 1000);
              }).catch(err => { console.error('Failed to copy prompt: ', err); });
            });
            actionsCell.appendChild(copyButton);

            // DELETE button
            const deleteButton = document.createElement('button');
            deleteButton.className = 'action-button delete-button';
            deleteButton.dataset.id = prompt.id;
            const deleteImg = document.createElement('img');
            deleteImg.src = '../assets/icons/trash.svg';
            deleteImg.alt = 'delete prompt';
            deleteButton.appendChild(deleteImg);
            deleteButton.title = 'delete prompt';
            actionsCell.appendChild(deleteButton);

            row.appendChild(timeCell);
            row.appendChild(siteCell);
            row.appendChild(promptCell);
            row.appendChild(actionsCell);
            promptList.appendChild(row);
          });
        }
      });
    });
  }

  promptList.addEventListener('click', (e) => {
    const deleteButton = e.target.closest('.delete-button');
    console.log('Clicked target:', e.target);
    console.log('Found delete button:', deleteButton);
    if (deleteButton) {
      const promptId = parseInt(deleteButton.dataset.id, 10);
      console.log('Prompt ID to delete:', promptId);
      chrome.storage.sync.get(['prompts'], (result) => {
        const updatedPrompts = result.prompts.filter((p) => p.id !== promptId);
        console.log('Updated prompts after filter:', updatedPrompts);
        chrome.storage.sync.set({ prompts: updatedPrompts }, () => {
          renderPrompts(currentFilter); // Re-render with current filter after deletion
        });
      });
    } else if (e.target.classList.contains('delete-all-button')) {
      const dateStr = e.target.dataset.date;
      chrome.storage.sync.get(['prompts'], (result) => {
        const updatedPrompts = result.prompts.filter(
          (p) => new Date(p.timestamp).toDateString() !== dateStr
        );
        chrome.storage.sync.set({ prompts: updatedPrompts }, () => {
          renderPrompts(currentFilter); // Re-render with current filter after deletion
        });
      });
    }
  });

  const upgradePromptLink = document.getElementById('upgradePromptLink');
  if (upgradePromptLink) {
    upgradePromptLink.addEventListener('click', (e) => {
      e.preventDefault();
      const url = (window.APP_CONFIG && window.APP_CONFIG.getLink) ? window.APP_CONFIG.getLink('upgradePage', 'https://promptrecall.blacklodgelabs.com/upgrade') : 'https://promptrecall.blacklodgelabs.com/upgrade';
      window.open(url, '_blank');
    });
  }

  upgradeButton.addEventListener('click', (e) => {
    e.preventDefault();
    const url = (window.APP_CONFIG && window.APP_CONFIG.getLink) ? window.APP_CONFIG.getLink('upgradePage', 'https://promptrecall.blacklodgelabs.com/upgrade') : 'https://promptrecall.blacklodgelabs.com/upgrade';
    window.open(url, '_blank');
  });

  optionsButton.addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'promptsUpdated') {
      renderPrompts(currentFilter); // Re-render with current filter
    }
  });

  searchInput.addEventListener('keyup', () => {
    const filter = searchInput.value.trim();
    if (filter) {
      clearSearchButton.style.display = 'inline-block';
    } else {
      clearSearchButton.style.display = 'none';
    }
    renderPrompts(filter);
  });

  clearSearchButton.addEventListener('click', () => {
    searchInput.value = '';
    clearSearchButton.style.display = 'none';
    renderPrompts('');
  });

  renderPrompts(currentFilter); // Initial render with current filter
});
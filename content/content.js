// Debug helper: reads debugVerbose from storage and logs only when enabled
let __PR_DEBUG = false;
chrome.storage.sync.get({ debugVerbose: false }, (cfg) => { __PR_DEBUG = !!cfg.debugVerbose; });
function dbg() {
  if (!__PR_DEBUG) return;
  try {
    console.log.apply(console, arguments);
  } catch (e) { /* ignore */ }
}

dbg('Content script loaded on:', location.hostname);

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

  // Helper to actually send the message to the background
  function doSend(urlToUse) {
    chrome.runtime.sendMessage({ action: 'savePrompt', data: { id: Date.now(), prompt, timestamp: new Date().toISOString(), site: location.hostname, url: urlToUse || window.location.href } }, 
      (response) => {
        if (chrome.runtime.lastError) {
          console.error('Error sending message:', chrome.runtime.lastError.message);
          return;
        }
        
        if (response && response.status === 'success') {
          chrome.storage.sync.get({ showToastNotifications: true }, (data) => {
            if (data.showToastNotifications) {
              showToast('Prompt saved!');
            }
          });
        }
      });
  }

  // If the current URL is just the root host (e.g. https://chatgpt.com/ or https://grok.com/)
  // then many SPA sites will update to a conversation-specific path shortly after.
  // We'll poll briefly for a better URL when the href is 'too generic'.
  try {
    const currentHref = (window.location.href || '').trim();
    const parsed = new URL(currentHref);
    const path = parsed.pathname || '/';
    const host = (parsed.hostname || '').toLowerCase();

    // Consider the path 'generic' if it's the root or a single-segment path like '/app' or '/home'
    const isSingleSegment = path.split('/').filter(Boolean).length <= 1;
    let looksGeneric = (path === '/' || path === '' || path === '/home' || isSingleSegment);
    // Special-case Perplexity: the site briefly uses /search/new/<uuid>; treat that as generic
    try {
      if (host.includes('perplexity.ai') && /^\/search\/new\//.test(path)) {
        looksGeneric = true;
      }
    } catch (e) { /* ignore */ }

    if (looksGeneric) {
      // Poll for a better URL; prefer when a path longer than '/' appears, or known conversation patterns.
      let attempts = 0;
      // Default polling up to ~3s
      let maxAttempts = 12; // up to 3s (250ms * 12)
      const intervalMs = 250;
      // Extend polling for Gemini which may update the URL more slowly
      try {
        const host = (location.hostname || '').toLowerCase();
        if (host.includes('gemini.google.com')) {
          maxAttempts = 24; // ~6s
        }
      } catch (e) { /* ignore */ }
  dbg('sendPrompt: polling for improved URL', {host: location.hostname, maxAttempts, intervalMs});
      // Also listen for SPA URL updates via pushState/replaceState/popstate
      let origPushState = null;
      let origReplaceState = null;
      let urlChangeHandled = false;

      function cleanupUrlListeners() {
        try {
          window.removeEventListener('popstate', onUrlChange);
        } catch (e) {}
        if (origPushState) history.pushState = origPushState;
        if (origReplaceState) history.replaceState = origReplaceState;
      }

      function onUrlChange() {
        try {
          const hrefNowInner = (window.location.href || '').trim();
          const parsedNow = new URL(hrefNowInner);
          const nowPathInner = parsedNow.pathname || '/';
          const nowSegmentsInner = nowPathInner.split('/').filter(Boolean);
          const improvedNow = (nowSegmentsInner.length > 1) || /\/app\/[A-Za-z0-9_-]+|\/c\/[A-Za-z0-9_-]+/.test(nowPathInner);
          if (improvedNow && !urlChangeHandled) {
            urlChangeHandled = true;
            // Clear polling and send immediately with source 'urlchange'
            if (interval) clearInterval(interval);
            cleanupUrlListeners();
            chrome.runtime.sendMessage({ action: 'savePrompt', data: { id: Date.now(), prompt, timestamp: new Date().toISOString(), site: location.hostname, url: hrefNowInner, urlSource: 'urlchange' } }, (response) => {
              if (chrome.runtime.lastError) console.error('Error sending message:', chrome.runtime.lastError.message);
              if (response && response.status === 'success') {
                chrome.storage.sync.get({ showToastNotifications: true }, (data) => { if (data.showToastNotifications) showToast('Prompt saved!'); });
              }
            });
          }
        } catch (e) { /* ignore */ }
      }

      try {
        origPushState = history.pushState;
        origReplaceState = history.replaceState;
        history.pushState = function() {
          const res = origPushState.apply(this, arguments);
          try { onUrlChange(); } catch (e) {}
          return res;
        };
        history.replaceState = function() {
          const res = origReplaceState.apply(this, arguments);
          try { onUrlChange(); } catch (e) {}
          return res;
        };
        window.addEventListener('popstate', onUrlChange);
      } catch (e) { /* ignore */ }

      const interval = setInterval(() => {
        attempts += 1;
        const hrefNow = (window.location.href || '').trim();
        try {
            const nowParsed = new URL(hrefNow);
            const nowPath = nowParsed.pathname || '/';
            const nowSegments = nowPath.split('/').filter(Boolean);
            // Consider it improved only if there's more than one path segment or it matches known conversation patterns
            const improved = (nowSegments.length > 1) || /\/app\/[A-Za-z0-9_-]+|\/c\/[A-Za-z0-9_-]+/.test(nowPath);
            if (improved || attempts >= maxAttempts) {
            clearInterval(interval);
            // If not improved, attempt to extract an improved URL from page state/meta/anchors
            if (!improved) {
              try {
                let candidate = null;

                // 1) history.state might contain conversation id or path
                try {
                  const hs = history.state;
                  if (hs && typeof hs === 'object') {
                    // Look for properties that look like a path or url
                    for (const k of ['conversationId', 'id', 'path', 'url']) {
              if (host.includes('perplexity.ai')) {
                maxAttempts = 32; // ~8s for slower Perplexity URL stabilization
              }
                      if (hs[k] && typeof hs[k] === 'string') {
                        candidate = hs[k];
                        break;
                      }
                    }
                  }
                } catch (e) { /* ignore */ }

                // 2) canonical link
                if (!candidate) {
                  const link = document.querySelector('link[rel="canonical"]');
                  if (link && link.href) candidate = link.href;
                }

                // 3) og:url meta
                if (!candidate) {
                  const meta = document.querySelector('meta[property="og:url"]') || document.querySelector('meta[name="og:url"]');
                  if (meta && meta.content) candidate = meta.content;
                }

                // 4) anchors / DOM heuristics that contain likely conversation paths (e.g., '/app/' or '/c/')
                if (!candidate) {
                  dbg('sendPrompt: fallback extraction running for host=', location.hostname);
                  // Gemini-specific: response-container elements may include a jslog attribute with a c_<id>
                  try {
                    const host = (location.hostname || '').toLowerCase();
                    if (host.includes('gemini.google.com')) {
                      const respEls = Array.from(document.querySelectorAll('response-container[jslog], [jslog], .response-container'));
                      // check from the end (most recent)
                      for (let i = respEls.length - 1; i >= 0; i--) {
                        const el = respEls[i];
                        const jsAttr = el.getAttribute && el.getAttribute('jslog') ? el.getAttribute('jslog') : '';
                        let m = jsAttr.match(/c_([A-Za-z0-9]+)/);
                        if (m && m[1]) {
                          candidate = `https://gemini.google.com/app/${m[1]}`;
                            dbg('sendPrompt: found gemini conversation id in jslog attribute, candidate=', candidate);
                          break;
                        }

                        // If not in attribute, scan the element's outerHTML for a c_<id> token
                        try {
                          const outer = el.outerHTML || '';
                          m = outer.match(/c_([A-Za-z0-9]+)/);
                          if (m && m[1]) {
                            candidate = `https://gemini.google.com/app/${m[1]}`;
                            dbg('sendPrompt: found gemini conversation id in element.outerHTML, candidate=', candidate);
                            // Log a truncated snippet to help debugging
                            dbg('sendPrompt: outerHTML snippet=', outer.slice(0,2000));
                            break;
                          }
                        } catch (e) { /* ignore outerHTML parse errors */ }
                      }
                    }
                  } catch (e) { console.warn('sendPrompt: gemini extraction error', e); }

                    // Perplexity-specific extraction: prefer '/search/<slug>' (human-friendly) over '/search/new/<uuid>'
                    try {
                      const host = (location.hostname || '').toLowerCase();
                      if (host.includes('perplexity.ai')) {
                        dbg('sendPrompt: running perplexity.ai specific extraction');
                        // 1) Look for anchors that point to /search/<slug> and not /search/new/
                        const pAnchors = Array.from(document.querySelectorAll('a[href]'));
                        for (let i = pAnchors.length - 1; i >= 0; i--) {
                          try {
                            const href = pAnchors[i].href;
                            if (!href) continue;
                            const u = new URL(href);
                            if (!u.hostname.includes('perplexity.ai')) continue;
                            // Match /search/<slug> but exclude /search/new/
                            const m = u.pathname.match(/^\/search\/((?!new\/).+)/i);
                            if (m && m[1]) {
                              candidate = u.href;
                              dbg('sendPrompt: found perplexity search slug in anchor, candidate=', candidate);
                              break;
                            }
                          } catch (e) { /* ignore malformed hrefs */ }
                        }

                        // 2) If not found via anchors, scan some element outerHTML for a pretty /search/<slug> URL
                        if (!candidate) {
                          try {
                            const bodyOuter = (document.body && document.body.outerHTML) ? document.body.outerHTML : '';
                            const m2 = bodyOuter.match(/https?:\/\/www\.perplexity\.ai\/search\/(?!new\/)[A-Za-z0-9\-_%]+/i);
                            if (m2 && m2[0]) {
                              candidate = m2[0];
                              dbg('sendPrompt: found perplexity search slug in page HTML, candidate=', candidate);
                              // log a small snippet to help debug timing issues
                              const idx = bodyOuter.indexOf(m2[0]);
                              dbg('sendPrompt: perplexity HTML snippet=', bodyOuter.slice(Math.max(0, idx - 200), Math.min(bodyOuter.length, idx + m2[0].length + 200)));
                            }
                          } catch (e) { /* ignore outerHTML parse errors */ }
                        }
                      }
                    } catch (e) { console.warn('sendPrompt: perplexity extraction error', e); }

                  // generic anchor scan if we still don't have a candidate
                  if (!candidate) {
                    const anchors = Array.from(document.querySelectorAll('a[href]'));
                    for (const a of anchors) {
                      try {
                        const href = a.href;
                        if (/\/app\//.test(href) || /\/c\//.test(href) || /convo|conversation|threads|chat\//.test(href)) {
                          candidate = href;
                          dbg('sendPrompt: found candidate from anchor href=', href);
                          break;
                        }
                      } catch (e) { /* ignore */ }
                    }
                  }
                  dbg('sendPrompt: fallback extraction finished, candidate=', candidate);
                }

                if (candidate) {
                  dbg('sendPrompt: using candidate URL from page fallback', candidate);
                  doSend(candidate);
                } else {
                  dbg('sendPrompt: no candidate found, sending hrefNow=', hrefNow);
                  doSend(hrefNow);
                }
              } catch (e) {
                console.warn('sendPrompt: fallback extraction failed, sending hrefNow', e);
                doSend(hrefNow);
              }
            } else {
              console.log('sendPrompt: improved href found, sending hrefNow=', hrefNow);
              doSend(hrefNow);
            }
          }
        } catch (e) {
          // If URL parsing fails, just bail out and send what we have after timeout
          if (attempts >= maxAttempts) {
            clearInterval(interval);
            doSend(hrefNow);
          }
        }
      }, intervalMs);
      return; // we'll send after poll completes
    }
  } catch (e) {
    console.warn('sendPrompt: polling for improved url failed, sending immediately', e);
  }

  // Default immediate send
  doSend(window.location.href);
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
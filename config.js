const PROMPT_LIMIT = parseInt(atob('MjU=')); 

// Centralized application configuration (exposed on a global root for extension scripts)
// Keep commonly changed URLs and feature flags here so they can be updated in one place.
// Use a safe global (window in pages, self/globalThis in workers) so config can be
// loaded both in pages and in a service worker background script.
const __PR_ROOT = (typeof window !== 'undefined') ? window : (typeof globalThis !== 'undefined') ? globalThis : (typeof self !== 'undefined') ? self : {};
__PR_ROOT.APP_CONFIG = __PR_ROOT.APP_CONFIG || {};
__PR_ROOT.APP_CONFIG.LINKS = {
	sponsor: 'https://github.com/sponsors/blacklodgelabs',
	bugReport: 'https://promptrecall.blacklodgelabs.com/support#bug-report',
	featureRequest: 'https://promptrecall.blacklodgelabs.com/support#feature-request',
 	upgradePage: 'https://promptrecall.blacklodgelabs.com/upgrade'
};

// Helper to retrieve a link by key with an optional fallback.
// Usage: const url = __PR_ROOT.APP_CONFIG.getLink('bugReport');
__PR_ROOT.APP_CONFIG.getLink = function(key, fallback) {
	try {
		if (__PR_ROOT.APP_CONFIG && __PR_ROOT.APP_CONFIG.LINKS && __PR_ROOT.APP_CONFIG.LINKS[key]) {
			return __PR_ROOT.APP_CONFIG.LINKS[key];
		}
	} catch (err) {
		// ignore and fall back
	}
	return fallback || '';
};
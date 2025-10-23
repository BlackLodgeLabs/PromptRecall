// Non-module version of config for use in regular scripts
const PROMPT_LIMIT = parseInt(atob('MjU='));

// Centralized application configuration
window.APP_CONFIG = {
  LINKS: {
    sponsor: 'https://github.com/sponsors/blacklodgelabs',
    bugReport: 'https://promptrecall.blacklodgelabs.com/support#bug-report',
    featureRequest: 'https://promptrecall.blacklodgelabs.com/support#feature-request',
    upgradePage: 'https://promptrecall.blacklodgelabs.com/upgrade',
    licenseVerifier: 'https://license-verifier-xxxxx.run.app'
  },
  
  // Helper to retrieve a link by key with an optional fallback
  getLink: function(key, fallback) {
    try {
      if (this.LINKS && this.LINKS[key]) {
        return this.LINKS[key];
      }
    } catch (err) {
      // ignore and fall back
    }
    return fallback || '';
  }
};
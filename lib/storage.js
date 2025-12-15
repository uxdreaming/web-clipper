// Storage utility for Chrome extension

const Storage = {
  // Default settings
  defaults: {
    graphPath: '~/Documents/logseq',
    journalFormat: 'yyyy-MM-dd',
    theme: 'light',
    defaultFormat: 'markdown',
    defaultDestination: 'journal',
    templates: {},
    recentPages: []
  },

  // Get all settings
  async getAll() {
    return new Promise((resolve) => {
      chrome.storage.sync.get(this.defaults, (result) => {
        resolve(result);
      });
    });
  },

  // Get specific setting
  async get(key) {
    const all = await this.getAll();
    return all[key];
  },

  // Set setting(s)
  async set(data) {
    return new Promise((resolve) => {
      chrome.storage.sync.set(data, () => {
        resolve();
      });
    });
  },

  // Get theme
  async getTheme() {
    return this.get('theme');
  },

  // Set theme
  async setTheme(theme) {
    return this.set({ theme });
  },

  // Get graph path
  async getGraphPath() {
    const path = await this.get('graphPath');
    // Expand ~ to home directory (handled by native host)
    return path;
  },

  // Set graph path
  async setGraphPath(path) {
    return this.set({ graphPath: path });
  },

  // Get journal format
  async getJournalFormat() {
    return this.get('journalFormat');
  },

  // Get templates
  async getTemplates() {
    return this.get('templates');
  },

  // Save template
  async saveTemplate(name, template) {
    const templates = await this.getTemplates();
    templates[name] = template;
    return this.set({ templates });
  },

  // Delete template
  async deleteTemplate(name) {
    const templates = await this.getTemplates();
    delete templates[name];
    return this.set({ templates });
  },

  // Add to recent pages
  async addRecentPage(pageName) {
    let recent = await this.get('recentPages');
    // Remove if already exists
    recent = recent.filter(p => p !== pageName);
    // Add to front
    recent.unshift(pageName);
    // Keep only last 20
    recent = recent.slice(0, 20);
    return this.set({ recentPages: recent });
  },

  // Get recent pages
  async getRecentPages() {
    return this.get('recentPages');
  }
};

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
  module.exports = Storage;
}

// Web Clipper - Options Page

class OptionsPage {
  constructor() {
    this.editingTemplate = null;
    this.init();
  }

  async init() {
    await this.loadSettings();
    this.bindEvents();
    await this.checkNativeHost();
    await this.loadTemplates();
  }

  async loadSettings() {
    const settings = await Storage.getAll();

    document.getElementById('graphPath').value = settings.graphPath || '~/Documents/logseq';
    document.getElementById('journalFormat').value = settings.journalFormat || 'yyyy-MM-dd';
    document.getElementById('defaultFormat').value = settings.defaultFormat || 'markdown';
    document.getElementById('defaultDestination').value = settings.defaultDestination || 'journal';
    document.getElementById('theme').value = settings.theme || 'light';
  }

  bindEvents() {
    // Save settings
    document.getElementById('saveSettings').addEventListener('click', () => this.saveSettings());

    // Reset settings
    document.getElementById('resetSettings').addEventListener('click', () => this.resetSettings());

    // Test connection
    document.getElementById('testConnection').addEventListener('click', () => this.testConnection());

    // Template management
    document.getElementById('addTemplate').addEventListener('click', () => this.showTemplateModal());
    document.getElementById('cancelTemplate').addEventListener('click', () => this.hideTemplateModal());
    document.getElementById('saveTemplate').addEventListener('click', () => this.saveTemplate());

    // Install instructions
    document.getElementById('installInstructions').addEventListener('click', (e) => {
      e.preventDefault();
      this.showInstallInstructions();
    });
  }

  async saveSettings() {
    const settings = {
      graphPath: document.getElementById('graphPath').value,
      journalFormat: document.getElementById('journalFormat').value,
      defaultFormat: document.getElementById('defaultFormat').value,
      defaultDestination: document.getElementById('defaultDestination').value,
      theme: document.getElementById('theme').value
    };

    await Storage.set(settings);

    // Also update native host config
    try {
      await this.sendNativeMessage({
        action: 'setConfig',
        key: 'graphPath',
        value: settings.graphPath
      });
    } catch (e) {
      console.warn('Could not update native host config:', e);
    }

    this.showToast('Settings saved!');
  }

  async resetSettings() {
    if (!confirm('Reset all settings to defaults?')) return;

    await Storage.set(Storage.defaults);
    await this.loadSettings();
    this.showToast('Settings reset to defaults');
  }

  async testConnection() {
    const statusEl = document.getElementById('hostStatus');
    statusEl.className = 'status-indicator';
    statusEl.querySelector('.status-text').textContent = 'Testing...';

    try {
      const response = await this.sendNativeMessage({ action: 'ping' });

      if (response.success) {
        statusEl.classList.add('connected');
        statusEl.querySelector('.status-text').textContent = `Connected - Graph: ${response.graphPath}`;
      } else {
        throw new Error(response.error || 'Unknown error');
      }
    } catch (error) {
      statusEl.classList.add('disconnected');
      statusEl.querySelector('.status-text').textContent = `Not connected: ${error.message}`;
    }
  }

  async checkNativeHost() {
    await this.testConnection();
  }

  async sendNativeMessage(message) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({ type: 'nativeMessage', data: message }, (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else if (response) {
          resolve(response);
        } else {
          reject(new Error('No response'));
        }
      });
    });
  }

  async loadTemplates() {
    const allTemplates = await Templates.getAll();
    const container = document.getElementById('templateList');
    container.innerHTML = '';

    for (const [key, value] of Object.entries(allTemplates)) {
      const item = document.createElement('div');
      item.className = `template-item ${value.isBuiltIn ? 'built-in' : ''}`;
      item.innerHTML = `
        <span class="template-name">${value.name || key}</span>
        <div class="template-actions">
          <button class="btn btn-secondary" data-action="edit" data-key="${key}">Edit</button>
          ${!value.isBuiltIn ? `<button class="btn btn-danger" data-action="delete" data-key="${key}">Delete</button>` : ''}
        </div>
      `;
      container.appendChild(item);
    }

    // Bind template action buttons
    container.querySelectorAll('button[data-action]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const action = e.target.dataset.action;
        const key = e.target.dataset.key;

        if (action === 'edit') {
          this.editTemplate(key);
        } else if (action === 'delete') {
          this.deleteTemplate(key);
        }
      });
    });
  }

  showTemplateModal(template = null) {
    const modal = document.getElementById('templateModal');
    const title = document.getElementById('modalTitle');
    const nameInput = document.getElementById('templateName');
    const contentInput = document.getElementById('templateContent');

    if (template) {
      title.textContent = 'Edit Template';
      nameInput.value = template.name || '';
      contentInput.value = template.template || '';
      this.editingTemplate = template.key;
    } else {
      title.textContent = 'New Template';
      nameInput.value = '';
      contentInput.value = `- **{{title}}**
  url:: {{url}}
  date-clipped:: {{date}}
  tags:: {{tags}}
  - {{content}}`;
      this.editingTemplate = null;
    }

    modal.classList.remove('hidden');
  }

  hideTemplateModal() {
    document.getElementById('templateModal').classList.add('hidden');
    this.editingTemplate = null;
  }

  async editTemplate(key) {
    const allTemplates = await Templates.getAll();
    const template = allTemplates[key];

    if (template) {
      this.showTemplateModal({
        key,
        name: template.name || key,
        template: template.template
      });
    }
  }

  async saveTemplate() {
    const name = document.getElementById('templateName').value.trim();
    const content = document.getElementById('templateContent').value;

    if (!name) {
      alert('Please enter a template name');
      return;
    }

    const key = this.editingTemplate || name.toLowerCase().replace(/\s+/g, '-');

    await Storage.saveTemplate(key, content);
    this.hideTemplateModal();
    await this.loadTemplates();
    this.showToast('Template saved!');
  }

  async deleteTemplate(key) {
    if (!confirm('Delete this template?')) return;

    await Storage.deleteTemplate(key);
    await this.loadTemplates();
    this.showToast('Template deleted');
  }

  showInstallInstructions() {
    alert(`Native Host Installation:

1. Open terminal in the extension folder
2. Navigate to native-host/
3. Run: ./install.sh <extension-id>

To find your extension ID:
1. Go to chrome://extensions
2. Enable "Developer mode"
3. The ID is shown under the extension name`);
  }

  showToast(message, isError = false) {
    const existing = document.querySelector('.toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = `toast ${isError ? 'error' : ''}`;
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => toast.remove(), 3000);
  }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  new OptionsPage();
});

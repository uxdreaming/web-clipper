// Web Clipper - Popup Script

class LogseqClipper {
  constructor() {
    this.currentContent = null;
    this.currentFormat = 'markdown';
    this.currentDestination = 'journal';
    this.turndownService = null;

    this.init();
  }

  async init() {
    // Initialize Turndown
    this.initTurndown();

    // Load theme
    await this.loadTheme();

    // Load settings
    await this.loadSettings();

    // Set today's date as default
    document.getElementById('journalDate').valueAsDate = new Date();

    // Bind event listeners
    this.bindEvents();

    // Load existing pages for autocomplete
    await this.loadPages();

    // Check for pending captured content
    await this.checkPendingCapture();
  }

  async checkPendingCapture() {
    const result = await chrome.storage.local.get('pendingCapture');
    if (result.pendingCapture) {
      this.currentContent = result.pendingCapture;
      // Clear the pending capture
      await chrome.storage.local.remove('pendingCapture');
      // Clear badge
      chrome.action.setBadgeText({ text: '' });
      // Show editor with captured content
      this.showEditor();
    }
  }

  initTurndown() {
    if (typeof TurndownService !== 'undefined') {
      this.turndownService = new TurndownService({
        headingStyle: 'atx',
        codeBlockStyle: 'fenced',
        bulletListMarker: '-'
      });

      // Custom rules for better conversion
      this.turndownService.addRule('removeScripts', {
        filter: ['script', 'style', 'noscript'],
        replacement: () => ''
      });
    }
  }

  async loadTheme() {
    const theme = await Storage.getTheme();
    if (theme === 'dark') {
      document.body.setAttribute('data-theme', 'dark');
    }
  }

  async loadSettings() {
    // Load saved settings
    const journalFormat = await Storage.getJournalFormat();
    const defaultFormat = await Storage.get('defaultFormat') || 'markdown';
    const defaultDestination = await Storage.get('defaultDestination') || 'journal';

    // Apply to UI
    document.getElementById('journalFormat').value = journalFormat;
    document.getElementById('defaultFormat').value = defaultFormat;
    document.getElementById('defaultDestination').value = defaultDestination;

    // Apply to state
    this.currentFormat = defaultFormat;
    this.currentDestination = defaultDestination;

    // Update format buttons to match default
    document.querySelectorAll('.format-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.format === defaultFormat);
    });

    // Update destination buttons to match default
    document.querySelectorAll('.dest-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.dest === defaultDestination);
    });
    document.getElementById('journalOptions').classList.toggle('hidden', defaultDestination !== 'journal');
    document.getElementById('pageOptions').classList.toggle('hidden', defaultDestination !== 'page');
  }

  toggleSettings() {
    const settingsSection = document.getElementById('settingsSection');
    const captureSection = document.getElementById('captureSection');
    const editorSection = document.getElementById('editorSection');

    if (settingsSection.classList.contains('hidden')) {
      // Show settings
      settingsSection.classList.remove('hidden');
      captureSection.classList.add('hidden');
      editorSection.classList.add('hidden');
    } else {
      // Hide settings, show appropriate section
      settingsSection.classList.add('hidden');
      if (this.currentContent) {
        editorSection.classList.remove('hidden');
      } else {
        captureSection.classList.remove('hidden');
      }
    }
  }

  bindEvents() {
    // Theme toggle
    document.getElementById('themeToggle').addEventListener('click', () => this.toggleTheme());

    // Settings button - toggle inline settings
    document.getElementById('settingsBtn').addEventListener('click', () => this.toggleSettings());
    document.getElementById('closeSettings').addEventListener('click', () => this.toggleSettings());

    // Settings changes
    document.getElementById('journalFormat').addEventListener('change', (e) => {
      Storage.set({ journalFormat: e.target.value });
    });
    document.getElementById('defaultFormat').addEventListener('change', (e) => {
      Storage.set({ defaultFormat: e.target.value });
      this.currentFormat = e.target.value;
    });
    document.getElementById('defaultDestination').addEventListener('change', (e) => {
      Storage.set({ defaultDestination: e.target.value });
      this.currentDestination = e.target.value;
    });

    // Capture buttons
    document.getElementById('captureEdit').addEventListener('click', () => this.capture('edit'));
    document.getElementById('captureSelect').addEventListener('click', () => this.capture('select'));

    // Format buttons
    document.querySelectorAll('.format-btn').forEach(btn => {
      btn.addEventListener('click', (e) => this.setFormat(e.target.dataset.format));
    });

    // Template select
    document.getElementById('templateSelect').addEventListener('change', (e) => {
      this.applyTemplate(e.target.value);
    });

    // Editor tabs
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', (e) => this.switchTab(e.target.dataset.tab));
    });

    // Source pane sync
    document.getElementById('sourcePane').addEventListener('input', (e) => {
      this.updatePreview(e.target.value);
    });

    // Destination tabs
    document.querySelectorAll('.dest-btn').forEach(btn => {
      btn.addEventListener('click', (e) => this.setDestination(e.target.dataset.dest));
    });

    // Page search
    document.getElementById('pageSearch').addEventListener('input', (e) => {
      this.searchPages(e.target.value);
    });

    // Back button
    document.getElementById('backBtn').addEventListener('click', () => this.showCaptureSection());

    // Copy button
    document.getElementById('copyBtn').addEventListener('click', () => this.copyToClipboard());
  }

  async copyToClipboard() {
    try {
      const content = document.getElementById('sourcePane').value;
      await navigator.clipboard.writeText(content);
      this.showStatus('Copied to clipboard!');
    } catch (error) {
      this.showStatus('Error copying: ' + error.message, true);
    }
  }

  async toggleTheme() {
    const current = document.body.getAttribute('data-theme');
    const newTheme = current === 'dark' ? 'light' : 'dark';

    if (newTheme === 'dark') {
      document.body.setAttribute('data-theme', 'dark');
    } else {
      document.body.removeAttribute('data-theme');
    }

    await Storage.setTheme(newTheme);
  }

  async capture(mode) {
    try {
      // Get current tab
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

      if (mode === 'edit') {
        await this.startEditMode(tab.id);
        return;
      } else if (mode === 'select') {
        await this.startSelectMode(tab.id);
        return;
      }
    } catch (error) {
      this.showStatus('Error: ' + error.message, true);
    }
  }

  async injectContentScript(tabId) {
    // Inject the content script and CSS if not already loaded
    await chrome.scripting.insertCSS({
      target: { tabId },
      files: ['content/content.css']
    });

    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['content/content.js']
    });

    // Small delay to ensure script is initialized
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  async startEditMode(tabId) {
    try {
      await this.injectContentScript(tabId);
      await chrome.tabs.sendMessage(tabId, { action: 'startEditMode' });
      window.close();
    } catch (error) {
      this.showStatus('Error: ' + error.message, true);
    }
  }

  async startSelectMode(tabId) {
    try {
      await this.injectContentScript(tabId);
      await chrome.tabs.sendMessage(tabId, { action: 'startSelectMode' });
      window.close();
    } catch (error) {
      this.showStatus('Error: ' + error.message, true);
    }
  }

  showEditor() {
    document.getElementById('captureSection').classList.add('hidden');
    document.getElementById('editorSection').classList.remove('hidden');

    // Fill metadata
    document.getElementById('titleInput').value = this.currentContent.title;
    document.getElementById('urlInput').value = this.currentContent.url;

    // Convert to markdown and show
    this.processContent();
  }

  showCaptureSection() {
    document.getElementById('editorSection').classList.add('hidden');
    document.getElementById('captureSection').classList.remove('hidden');
    this.currentContent = null;
  }

  processContent() {
    let content;

    if (this.currentFormat === 'markdown') {
      content = this.turndownService
        ? this.turndownService.turndown(this.currentContent.html)
        : this.currentContent.text;
    } else if (this.currentFormat === 'logseq') {
      const markdown = this.turndownService
        ? this.turndownService.turndown(this.currentContent.html)
        : this.currentContent.text;
      content = LogseqFormatter.toBlocks(markdown, 1);
    } else if (this.currentFormat === 'template') {
      // Template will be applied separately
      content = this.turndownService
        ? this.turndownService.turndown(this.currentContent.html)
        : this.currentContent.text;
    }

    // Append highlights section if there are any
    if (this.currentContent.highlights && this.currentContent.highlights.length > 0) {
      const highlightsSection = this.currentContent.highlights.map(h =>
        `- ==${h.text}== ^^${h.colorName}^^`
      ).join('\n');
      content += '\n\n## Highlights\n' + highlightsSection;
    }

    document.getElementById('sourcePane').value = content;
    this.updatePreview(content);
  }

  setFormat(format) {
    this.currentFormat = format;

    // Update UI
    document.querySelectorAll('.format-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.format === format);
    });

    // Show/hide template selector
    const templateSelect = document.getElementById('templateSelect');
    if (format === 'template') {
      templateSelect.classList.remove('hidden');
    } else {
      templateSelect.classList.add('hidden');
    }

    // Reprocess content
    if (this.currentContent) {
      this.processContent();
    }
  }

  async applyTemplate(templateName) {
    if (!templateName || !this.currentContent) return;

    const template = await Templates.get(templateName);
    if (!template) return;

    const tags = document.getElementById('tagsInput').value;
    const markdown = this.turndownService
      ? this.turndownService.turndown(this.currentContent.html)
      : this.currentContent.text;

    const content = Templates.parse(template, {
      title: this.currentContent.title,
      url: this.currentContent.url,
      date: this.currentContent.date,
      content: markdown,
      selection: markdown,
      tags: tags
    });

    document.getElementById('sourcePane').value = content;
    this.updatePreview(content);
  }

  updatePreview(content) {
    const preview = document.getElementById('previewPane');
    // Simple markdown to HTML for preview (basic rendering)
    preview.innerHTML = this.simpleMarkdownToHtml(content);
  }

  simpleMarkdownToHtml(markdown) {
    return markdown
      .replace(/^- \*\*(.+)\*\*$/gm, '<h3>$1</h3>')
      .replace(/^- > (.+)$/gm, '<blockquote>$1</blockquote>')
      .replace(/^- (.+)$/gm, '<li>$1</li>')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/`(.+?)`/g, '<code>$1</code>')
      .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2">$1</a>')
      .replace(/==(.+?)==/g, '<mark style="background: rgba(255,255,0,0.4)">$1</mark>')
      .replace(/\^\^(.+?)\^\^/g, '<span style="color: #888; font-size: 11px;">($1)</span>')
      .replace(/\n/g, '<br>')
      .replace(/<li>/g, '<ul><li>')
      .replace(/<\/li>/g, '</li></ul>')
      .replace(/<\/ul><ul>/g, '');
  }

  switchTab(tab) {
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tab);
    });

    const preview = document.getElementById('previewPane');
    const source = document.getElementById('sourcePane');

    if (tab === 'preview') {
      preview.classList.remove('hidden');
      source.classList.add('hidden');
      this.updatePreview(source.value);
    } else {
      preview.classList.add('hidden');
      source.classList.remove('hidden');
    }
  }

  setDestination(dest) {
    this.currentDestination = dest;

    document.querySelectorAll('.dest-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.dest === dest);
    });

    document.getElementById('journalOptions').classList.toggle('hidden', dest !== 'journal');
    document.getElementById('pageOptions').classList.toggle('hidden', dest !== 'page');
  }

  async loadPages() {
    // Load recent pages from storage
    this.availablePages = await Storage.getRecentPages();
  }

  searchPages(query) {
    const suggestions = document.getElementById('pageSuggestions');
    suggestions.innerHTML = '';

    if (!query) return;

    const matches = this.availablePages.filter(p =>
      p.toLowerCase().includes(query.toLowerCase())
    ).slice(0, 5);

    matches.forEach(page => {
      const li = document.createElement('li');
      li.textContent = page;
      li.addEventListener('click', () => {
        document.getElementById('pageSearch').value = page;
        suggestions.innerHTML = '';
      });
      suggestions.appendChild(li);
    });

    // Add "create new" option
    if (!matches.includes(query)) {
      const li = document.createElement('li');
      li.className = 'create-new';
      li.textContent = `Create "${query}"`;
      li.addEventListener('click', () => {
        document.getElementById('pageSearch').value = query;
        suggestions.innerHTML = '';
      });
      suggestions.appendChild(li);
    }
  }

  async save() {
    try {
      const content = document.getElementById('sourcePane').value;
      const title = document.getElementById('titleInput').value;
      const url = document.getElementById('urlInput').value;

      // Determine target page
      let targetPage;
      if (this.currentDestination === 'journal') {
        targetPage = 'TODAY';
      } else {
        targetPage = document.getElementById('pageSearch').value || title;
        // Add to recent pages
        await Storage.addRecentPage(targetPage);
      }

      // Build Logseq Quick Capture URL
      const params = new URLSearchParams();
      params.set('url', url);
      params.set('title', title);
      params.set('content', content);
      if (targetPage) {
        params.set('page', targetPage);
      }
      params.set('append', 'true');

      const logseqUrl = `logseq://x-callback-url/quickCapture?${params.toString()}`;

      // Also copy to clipboard as backup
      await navigator.clipboard.writeText(content);

      // Open Logseq with the content
      window.open(logseqUrl);

      this.showStatus('Opening Logseq...');
      setTimeout(() => window.close(), 1000);

    } catch (error) {
      this.showStatus('Error: ' + error.message, true);
    }
  }

  showStatus(message, isError = false) {
    const statusBar = document.getElementById('statusBar');
    const statusMessage = document.getElementById('statusMessage');

    statusMessage.textContent = message;
    statusBar.classList.toggle('error', isError);
    statusBar.classList.remove('hidden');

    setTimeout(() => {
      statusBar.classList.add('hidden');
    }, 3000);
  }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  new LogseqClipper();
});

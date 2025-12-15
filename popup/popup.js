// Logseq Web Clipper - Popup Script

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

    // Set today's date as default
    document.getElementById('journalDate').valueAsDate = new Date();

    // Bind event listeners
    this.bindEvents();

    // Load existing pages for autocomplete
    await this.loadPages();
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

  bindEvents() {
    // Theme toggle
    document.getElementById('themeToggle').addEventListener('click', () => this.toggleTheme());

    // Capture buttons
    document.getElementById('captureSelection').addEventListener('click', () => this.capture('selection'));
    document.getElementById('capturePage').addEventListener('click', () => this.capture('page'));
    document.getElementById('captureElement').addEventListener('click', () => this.capture('element'));

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

    // Save button
    document.getElementById('saveBtn').addEventListener('click', () => this.save());
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

      let result;

      if (mode === 'selection') {
        result = await this.captureSelection(tab.id);
      } else if (mode === 'page') {
        result = await this.capturePage(tab.id);
      } else if (mode === 'element') {
        result = await this.captureElement(tab.id);
        return; // Element capture shows picker, doesn't return immediately
      }

      if (result) {
        this.currentContent = {
          title: tab.title,
          url: tab.url,
          html: result.html,
          text: result.text,
          date: new Date().toISOString().split('T')[0]
        };

        this.showEditor();
      }
    } catch (error) {
      this.showStatus('Error capturing content: ' + error.message, true);
    }
  }

  async captureSelection(tabId) {
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => {
        const selection = window.getSelection();
        if (selection.rangeCount === 0) {
          return null;
        }

        const range = selection.getRangeAt(0);
        const container = document.createElement('div');
        container.appendChild(range.cloneContents());

        return {
          html: container.innerHTML,
          text: selection.toString()
        };
      }
    });

    const result = results[0]?.result;
    if (!result || !result.text) {
      this.showStatus('No text selected. Please select some text first.', true);
      return null;
    }

    return result;
  }

  async capturePage(tabId) {
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => {
        // Try to get main content
        const article = document.querySelector('article') ||
          document.querySelector('main') ||
          document.querySelector('[role="main"]') ||
          document.querySelector('.post-content') ||
          document.querySelector('.article-content') ||
          document.querySelector('.entry-content') ||
          document.body;

        // Clone and clean
        const clone = article.cloneNode(true);

        // Remove unwanted elements
        const unwanted = clone.querySelectorAll('script, style, nav, header, footer, aside, .sidebar, .comments, .advertisement, .ad');
        unwanted.forEach(el => el.remove());

        return {
          html: clone.innerHTML,
          text: clone.innerText
        };
      }
    });

    return results[0]?.result;
  }

  async captureElement(tabId) {
    // Send message to content script to activate element picker
    await chrome.tabs.sendMessage(tabId, { action: 'startElementPicker' });

    // Close popup - content script will handle the rest
    window.close();
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
    // This will be populated by the native host
    // For now, use recent pages from storage
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
      const tags = document.getElementById('tagsInput').value;
      const position = document.querySelector('input[name="position"]:checked').value;

      let filename, folder;

      if (this.currentDestination === 'journal') {
        const date = document.getElementById('journalDate').valueAsDate || new Date();
        const format = await Storage.getJournalFormat();
        filename = LogseqFormatter.getJournalFilename(date, format);
        folder = 'journals';
      } else {
        const pageName = document.getElementById('pageSearch').value || title;
        filename = LogseqFormatter.getPageFilename(pageName);
        folder = 'pages';
        // Add to recent pages
        await Storage.addRecentPage(pageName);
      }

      // Send to native host
      const response = await this.sendToNativeHost({
        action: 'save',
        folder,
        filename,
        content,
        position
      });

      if (response.success) {
        this.showStatus('Saved to Logseq!');
        setTimeout(() => window.close(), 1500);
      } else {
        this.showStatus('Error: ' + response.error, true);
      }
    } catch (error) {
      this.showStatus('Error saving: ' + error.message, true);
    }
  }

  async sendToNativeHost(message) {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ type: 'nativeMessage', data: message }, (response) => {
        resolve(response || { success: false, error: 'No response from native host' });
      });
    });
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

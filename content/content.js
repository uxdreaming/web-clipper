// Logseq Web Clipper - Content Script

class ElementPicker {
  constructor() {
    this.overlay = null;
    this.highlight = null;
    this.isActive = false;
    this.selectedElement = null;
  }

  start() {
    if (this.isActive) return;
    this.isActive = true;

    // Create overlay
    this.overlay = document.createElement('div');
    this.overlay.id = 'logseq-clipper-overlay';
    this.overlay.innerHTML = `
      <div class="lc-toolbar">
        <span>Click an element to select it</span>
        <button id="lc-cancel">Cancel</button>
        <button id="lc-capture">Capture</button>
      </div>
    `;
    document.body.appendChild(this.overlay);

    // Create highlight element
    this.highlight = document.createElement('div');
    this.highlight.id = 'logseq-clipper-highlight';
    document.body.appendChild(this.highlight);

    // Bind events
    document.addEventListener('mousemove', this.onMouseMove.bind(this), true);
    document.addEventListener('click', this.onClick.bind(this), true);
    document.addEventListener('keydown', this.onKeyDown.bind(this), true);

    document.getElementById('lc-cancel').addEventListener('click', () => this.cancel());
    document.getElementById('lc-capture').addEventListener('click', () => this.capture());
  }

  stop() {
    this.isActive = false;

    if (this.overlay) {
      this.overlay.remove();
      this.overlay = null;
    }

    if (this.highlight) {
      this.highlight.remove();
      this.highlight = null;
    }

    document.removeEventListener('mousemove', this.onMouseMove.bind(this), true);
    document.removeEventListener('click', this.onClick.bind(this), true);
    document.removeEventListener('keydown', this.onKeyDown.bind(this), true);
  }

  onMouseMove(e) {
    if (!this.isActive) return;

    const target = e.target;

    // Ignore our own elements
    if (target.closest('#logseq-clipper-overlay') || target.id === 'logseq-clipper-highlight') {
      return;
    }

    // Update highlight position
    const rect = target.getBoundingClientRect();
    this.highlight.style.top = `${rect.top + window.scrollY}px`;
    this.highlight.style.left = `${rect.left + window.scrollX}px`;
    this.highlight.style.width = `${rect.width}px`;
    this.highlight.style.height = `${rect.height}px`;
    this.highlight.style.display = 'block';
  }

  onClick(e) {
    if (!this.isActive) return;

    const target = e.target;

    // Ignore our own elements
    if (target.closest('#logseq-clipper-overlay') || target.id === 'logseq-clipper-highlight') {
      return;
    }

    e.preventDefault();
    e.stopPropagation();

    this.selectedElement = target;

    // Update highlight style to show selection
    this.highlight.classList.add('selected');
  }

  onKeyDown(e) {
    if (!this.isActive) return;

    if (e.key === 'Escape') {
      this.cancel();
    } else if (e.key === 'Enter' && this.selectedElement) {
      this.capture();
    }
  }

  cancel() {
    this.stop();
  }

  capture() {
    if (!this.selectedElement) {
      alert('Please select an element first');
      return;
    }

    const html = this.selectedElement.outerHTML;
    const text = this.selectedElement.innerText;

    // Send captured content to background script
    chrome.runtime.sendMessage({
      type: 'elementCaptured',
      data: {
        html,
        text,
        title: document.title,
        url: window.location.href
      }
    });

    this.stop();
  }
}

// Initialize picker
const picker = new ElementPicker();

// Listen for messages from popup/background
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'startElementPicker') {
    picker.start();
    sendResponse({ success: true });
  } else if (message.action === 'getSelection') {
    const selection = window.getSelection();
    if (selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      const container = document.createElement('div');
      container.appendChild(range.cloneContents());

      sendResponse({
        html: container.innerHTML,
        text: selection.toString()
      });
    } else {
      sendResponse({ html: '', text: '' });
    }
  } else if (message.action === 'getPageContent') {
    // Get main content
    const article = document.querySelector('article') ||
      document.querySelector('main') ||
      document.querySelector('[role="main"]') ||
      document.querySelector('.post-content') ||
      document.querySelector('.article-content') ||
      document.body;

    const clone = article.cloneNode(true);

    // Remove unwanted elements
    const unwanted = clone.querySelectorAll('script, style, nav, header, footer, aside, .sidebar, .comments, .ad');
    unwanted.forEach(el => el.remove());

    sendResponse({
      html: clone.innerHTML,
      text: clone.innerText,
      title: document.title,
      url: window.location.href
    });
  }

  return true; // Keep channel open for async response
});

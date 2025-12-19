// Web Clipper - Content Script
// Two modes: Remove (start full, click to exclude) and Add (start empty, click to include)
// Both modes support highlighting with colors

// Prevent multiple injections
if (typeof window.webClipperLoaded === 'undefined') {
window.webClipperLoaded = true;

// Fluorescent highlight colors
const HIGHLIGHT_COLORS = [
  { name: 'Yellow', color: '#ffff00', bg: 'rgba(255, 255, 0, 0.45)' },
  { name: 'Green', color: '#00ff00', bg: 'rgba(0, 255, 0, 0.4)' },
  { name: 'Pink', color: '#ff69b4', bg: 'rgba(255, 105, 180, 0.4)' },
  { name: 'Blue', color: '#00bfff', bg: 'rgba(0, 191, 255, 0.4)' },
  { name: 'Orange', color: '#ffa500', bg: 'rgba(255, 165, 0, 0.45)' },
  { name: 'Purple', color: '#da70d6', bg: 'rgba(218, 112, 214, 0.4)' }
];

// Generate color buttons HTML
function getColorButtonsHtml(activeIndex = -1) {
  return HIGHLIGHT_COLORS.map((c, i) =>
    `<button class="lc-color-btn ${i === activeIndex ? 'active' : ''}" data-color="${c.color}" data-bg="${c.bg}" data-index="${i}" data-name="${c.name}" title="${c.name}" style="background: ${c.bg}; border-color: ${c.color};"></button>`
  ).join('');
}

// Simple HTML to Markdown conversion
function htmlToMarkdown(html) {
  const temp = document.createElement('div');
  temp.innerHTML = html;

  // Process highlights FIRST (convert to ==text== (Color) syntax for Logseq)
  temp.querySelectorAll('mark.lc-text-highlight').forEach(el => {
    const colorName = el.dataset.colorName || 'Yellow';
    el.outerHTML = `==${el.textContent}== (${colorName})`;
  });

  // Process headings
  temp.querySelectorAll('h1').forEach(el => el.outerHTML = `# ${el.textContent}\n\n`);
  temp.querySelectorAll('h2').forEach(el => el.outerHTML = `## ${el.textContent}\n\n`);
  temp.querySelectorAll('h3').forEach(el => el.outerHTML = `### ${el.textContent}\n\n`);
  temp.querySelectorAll('h4,h5,h6').forEach(el => el.outerHTML = `#### ${el.textContent}\n\n`);

  // Process links
  temp.querySelectorAll('a').forEach(el => {
    const href = el.getAttribute('href') || '';
    el.outerHTML = `[${el.textContent}](${href})`;
  });

  // Process bold/strong
  temp.querySelectorAll('strong, b').forEach(el => el.outerHTML = `**${el.textContent}**`);

  // Process italic/em
  temp.querySelectorAll('em, i').forEach(el => el.outerHTML = `*${el.textContent}*`);

  // Process code
  temp.querySelectorAll('code').forEach(el => el.outerHTML = `\`${el.textContent}\``);

  // Process blockquotes
  temp.querySelectorAll('blockquote').forEach(el => {
    const lines = el.textContent.split('\n').map(l => `> ${l}`).join('\n');
    el.outerHTML = lines + '\n\n';
  });

  // Process lists
  temp.querySelectorAll('ul li').forEach(el => el.outerHTML = `- ${el.textContent}\n`);
  temp.querySelectorAll('ol li').forEach((el, i) => el.outerHTML = `${i + 1}. ${el.textContent}\n`);

  // Process paragraphs
  temp.querySelectorAll('p').forEach(el => el.outerHTML = `${el.textContent}\n\n`);

  // Process images
  temp.querySelectorAll('img').forEach(el => {
    const alt = el.getAttribute('alt') || '';
    const src = el.getAttribute('src') || '';
    el.outerHTML = `![${alt}](${src})\n\n`;
  });

  // Clean up and return
  return temp.textContent
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// Copy text to clipboard
async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (e) {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
    return true;
  }
}

// Copy image to clipboard
async function copyImageToClipboard(canvas) {
  try {
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
    await navigator.clipboard.write([
      new ClipboardItem({ 'image/png': blob })
    ]);
    return true;
  } catch (e) {
    console.error('Failed to copy image:', e);
    return false;
  }
}

// Load html2canvas dynamically
async function loadHtml2Canvas() {
  if (window.html2canvas) return window.html2canvas;

  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = chrome.runtime.getURL('lib/html2canvas.min.js');
    script.onload = () => resolve(window.html2canvas);
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

// Smart word selection - expand selection to word boundaries
function expandToWordBoundaries(range) {
  const wordChars = /[a-zA-ZáéíóúüñÁÉÍÓÚÜÑ0-9_-]/;

  let startContainer = range.startContainer;
  let startOffset = range.startOffset;

  if (startContainer.nodeType === Node.TEXT_NODE) {
    const text = startContainer.textContent;
    while (startOffset > 0 && wordChars.test(text[startOffset - 1])) {
      startOffset--;
    }
  }

  let endContainer = range.endContainer;
  let endOffset = range.endOffset;

  if (endContainer.nodeType === Node.TEXT_NODE) {
    const text = endContainer.textContent;
    while (endOffset < text.length && wordChars.test(text[endOffset])) {
      endOffset++;
    }
  }

  const newRange = document.createRange();
  newRange.setStart(startContainer, startOffset);
  newRange.setEnd(endContainer, endOffset);

  return newRange;
}


// ============================================
// UNIFIED CONTENT PICKER
// ============================================
class ContentPicker {
  constructor() {
    this.overlay = null;
    this.highlight = null;
    this.isActive = false;
    this.mode = 'remove'; // 'remove' or 'add'
    this.allElements = [];
    this.selectedElements = []; // Elements included in capture
    this.highlights = [];
    this.currentColorIndex = -1;
    this.currentColor = null;
    this.currentBg = null;
    this.currentColorName = null;
    this.boundOnMouseMove = this.onMouseMove.bind(this);
    this.boundOnClick = this.onClick.bind(this);
    this.boundOnKeyDown = this.onKeyDown.bind(this);
    this.boundOnMouseUp = this.onMouseUp.bind(this);
    this.boundBlockLinks = this.blockLinks.bind(this);
  }

  blockLinks(e) {
    if (!this.isActive) return;
    const link = e.target.closest('a');
    if (link && !e.target.closest('#logseq-clipper-overlay')) {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      return false;
    }
  }

  addLinkBlockers() {
    document.addEventListener('click', this.boundBlockLinks, true);
    document.addEventListener('mousedown', this.boundBlockLinks, true);
    document.addEventListener('pointerdown', this.boundBlockLinks, true);
    document.addEventListener('auxclick', this.boundBlockLinks, true);
  }

  removeLinkBlockers() {
    document.removeEventListener('click', this.boundBlockLinks, true);
    document.removeEventListener('mousedown', this.boundBlockLinks, true);
    document.removeEventListener('pointerdown', this.boundBlockLinks, true);
    document.removeEventListener('auxclick', this.boundBlockLinks, true);
  }

  start(mode = 'remove') {
    if (this.isActive) return;
    this.isActive = true;
    this.mode = mode;
    this.highlights = [];

    // No color selected by default
    this.currentColorIndex = -1;
    this.currentColor = null;
    this.currentBg = null;
    this.currentColorName = null;

    const mainContent = this.findMainContent();
    this.allElements = this.getSelectableElements(mainContent);

    // Initialize selection based on mode
    if (this.mode === 'remove') {
      // Start with all selected
      this.selectedElements = [...this.allElements];
      this.allElements.forEach(el => el.classList.add('lc-selected'));
    } else {
      // Start with none selected
      this.selectedElements = [];
      this.allElements.forEach(el => el.classList.add('lc-unselected'));
    }

    const modeText = this.mode === 'remove' ? 'Click to exclude' : 'Click to include';

    this.overlay = document.createElement('div');
    this.overlay.id = 'logseq-clipper-overlay';
    this.overlay.innerHTML = `
      <div class="lc-toolbar">
        <span class="lc-status">${modeText}</span>
        <span class="lc-count">${this.selectedElements.length} items</span>
        <button id="lc-restore">Reset</button>
        <button id="lc-cancel">Cancel</button>
        <button id="lc-capture" class="${this.selectedElements.length > 0 ? 'ready' : ''}">Capture</button>
      </div>
      <div class="lc-color-bar">
        ${getColorButtonsHtml(-1)}
      </div>
    `;
    document.body.appendChild(this.overlay);

    this.highlight = document.createElement('div');
    this.highlight.id = 'logseq-clipper-highlight';
    document.body.appendChild(this.highlight);

    this.bindColorButtons();
    this.addLinkBlockers();

    document.addEventListener('mousemove', this.boundOnMouseMove, true);
    document.addEventListener('click', this.boundOnClick, true);
    document.addEventListener('keydown', this.boundOnKeyDown, true);
    document.addEventListener('mouseup', this.boundOnMouseUp, true);

    document.getElementById('lc-restore').addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      this.resetSelection();
    });
    document.getElementById('lc-cancel').addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      this.cancel();
    });
    document.getElementById('lc-capture').addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      this.capture();
    });

    this.updateCount();
  }

  bindColorButtons() {
    const colorBar = this.overlay.querySelector('.lc-color-bar');

    colorBar.querySelectorAll('.lc-color-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        e.preventDefault();
        const clickedIndex = parseInt(btn.dataset.index);

        if (this.currentColorIndex === clickedIndex) {
          this.currentColorIndex = -1;
          this.currentColor = null;
          this.currentBg = null;
          this.currentColorName = null;
          btn.classList.remove('active');
        } else {
          this.currentColorIndex = clickedIndex;
          this.currentColor = btn.dataset.color;
          this.currentBg = btn.dataset.bg;
          this.currentColorName = btn.dataset.name;
          colorBar.querySelectorAll('.lc-color-btn').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
        }

        this.updateModeUI();
      });
    });
  }

  updateModeUI() {
    const status = this.overlay.querySelector('.lc-status');
    const isHighlightMode = this.currentColorIndex >= 0;

    if (isHighlightMode) {
      status.textContent = 'Select text to highlight';
      status.classList.add('highlight-mode');
    } else {
      status.textContent = this.mode === 'remove' ? 'Click to exclude' : 'Click to include';
      status.classList.remove('highlight-mode');
    }
  }

  isHighlightMode() {
    return this.currentColorIndex >= 0;
  }

  onMouseUp(e) {
    if (!this.isActive) return;
    if (e.target.closest('#logseq-clipper-overlay')) return;

    if (!this.isHighlightMode()) return;

    const selection = window.getSelection();
    const text = selection.toString().trim();

    if (text.length > 0) {
      this.highlightSelection(selection);
    }
  }

  highlightSelection(selection) {
    const originalRange = selection.getRangeAt(0);
    const range = expandToWordBoundaries(originalRange);

    const wrapper = document.createElement('mark');
    wrapper.className = 'lc-text-highlight';
    wrapper.style.backgroundColor = this.currentBg;
    wrapper.style.borderBottom = `2px solid ${this.currentColor}`;
    wrapper.dataset.color = this.currentColor;
    wrapper.dataset.colorName = this.currentColorName;

    try {
      range.surroundContents(wrapper);
      this.highlights.push({
        element: wrapper,
        text: wrapper.textContent,
        color: this.currentColor,
        colorName: this.currentColorName
      });
      selection.removeAllRanges();
    } catch (e) {
      // Selection crosses element boundaries
    }
  }

  findMainContent() {
    const selectors = [
      'article', '[role="main"]', 'main',
      '.post-content', '.article-content', '.entry-content',
      '.content', '.post', '.article'
    ];

    for (const selector of selectors) {
      const el = document.querySelector(selector);
      if (el && el.innerText.length > 500) {
        return el;
      }
    }
    return document.body;
  }

  getSelectableElements(container) {
    const selectableTags = ['P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6',
                           'BLOCKQUOTE', 'PRE', 'UL', 'OL',
                           'FIGURE', 'IMG', 'TABLE', 'VIDEO', 'AUDIO'];

    const elements = [];
    const seen = new Set();

    const allEls = container.querySelectorAll(selectableTags.join(','));

    allEls.forEach(el => {
      if (el.closest('nav, header, footer, aside, .sidebar, .comments, .advertisement, .ad, .social-share, .related-posts')) {
        return;
      }

      if (el.tagName !== 'IMG' && el.innerText.trim().length < 10) {
        return;
      }

      let dominated = false;
      for (const seen_el of seen) {
        if (seen_el.contains(el) && seen_el !== el) {
          dominated = true;
          break;
        }
      }

      if (!dominated) {
        for (const seen_el of [...seen]) {
          if (el.contains(seen_el) && el !== seen_el) {
            seen.delete(seen_el);
            elements.splice(elements.indexOf(seen_el), 1);
          }
        }
        seen.add(el);
        elements.push(el);
      }
    });

    return elements;
  }

  stop() {
    this.isActive = false;

    this.allElements.forEach(el => {
      el.classList.remove('lc-selected');
      el.classList.remove('lc-unselected');
      el.classList.remove('lc-excluded');
    });
    this.allElements = [];
    this.selectedElements = [];

    // Remove highlights from DOM
    this.highlights.forEach(h => {
      if (h.element && h.element.parentNode) {
        const parent = h.element.parentNode;
        while (h.element.firstChild) {
          parent.insertBefore(h.element.firstChild, h.element);
        }
        parent.removeChild(h.element);
      }
    });
    this.highlights = [];

    if (this.overlay) {
      this.overlay.remove();
      this.overlay = null;
    }

    if (this.highlight) {
      this.highlight.remove();
      this.highlight = null;
    }

    document.removeEventListener('mousemove', this.boundOnMouseMove, true);
    document.removeEventListener('click', this.boundOnClick, true);
    document.removeEventListener('keydown', this.boundOnKeyDown, true);
    document.removeEventListener('mouseup', this.boundOnMouseUp, true);

    this.removeLinkBlockers();
  }

  onMouseMove(e) {
    if (!this.isActive) return;

    if (this.isHighlightMode()) {
      this.highlight.style.display = 'none';
      return;
    }

    const target = this.getSelectableTarget(e.target);

    if (!target || target.closest('#logseq-clipper-overlay') || target.id === 'logseq-clipper-highlight') {
      this.highlight.style.display = 'none';
      return;
    }

    const rect = target.getBoundingClientRect();
    this.highlight.style.top = `${rect.top + window.scrollY}px`;
    this.highlight.style.left = `${rect.left + window.scrollX}px`;
    this.highlight.style.width = `${rect.width}px`;
    this.highlight.style.height = `${rect.height}px`;
    this.highlight.style.display = 'block';

    const isSelected = this.selectedElements.includes(target);
    if (this.mode === 'remove') {
      // In remove mode: hover shows red (will exclude) if selected, green (will restore) if not
      this.highlight.className = isSelected ? 'lc-highlight-exclude' : 'lc-highlight-restore';
    } else {
      // In add mode: hover shows green (will include) if not selected, red (will remove) if selected
      this.highlight.className = isSelected ? 'lc-highlight-exclude' : 'lc-highlight-include';
    }
  }

  getSelectableTarget(target) {
    let current = target;
    while (current && current !== document.body) {
      if (this.allElements.includes(current)) {
        return current;
      }
      current = current.parentElement;
    }
    return null;
  }

  onClick(e) {
    if (!this.isActive) return;

    if (e.target.closest('#logseq-clipper-overlay')) return;

    const clickedLink = e.target.closest('a');
    if (clickedLink) {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
    }

    if (this.isHighlightMode()) return;

    const target = this.getSelectableTarget(e.target);

    if (!target || target.id === 'logseq-clipper-highlight') {
      return;
    }

    const selection = window.getSelection();
    if (selection.toString().trim().length > 0) {
      return;
    }

    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();

    const index = this.selectedElements.indexOf(target);
    if (index > -1) {
      // Remove from selection
      this.selectedElements.splice(index, 1);
      target.classList.remove('lc-selected');
      target.classList.add(this.mode === 'remove' ? 'lc-excluded' : 'lc-unselected');
    } else {
      // Add to selection
      this.selectedElements.push(target);
      target.classList.remove('lc-excluded', 'lc-unselected');
      target.classList.add('lc-selected');
    }

    this.updateCount();
  }

  updateCount() {
    const count = this.selectedElements.length;
    const countEl = this.overlay.querySelector('.lc-count');
    countEl.textContent = `${count} items`;

    const captureBtn = document.getElementById('lc-capture');
    if (count > 0) {
      captureBtn.classList.add('ready');
    } else {
      captureBtn.classList.remove('ready');
    }
  }

  resetSelection() {
    // Reset to initial state based on mode
    this.allElements.forEach(el => {
      el.classList.remove('lc-selected', 'lc-unselected', 'lc-excluded');
    });

    if (this.mode === 'remove') {
      this.selectedElements = [...this.allElements];
      this.allElements.forEach(el => el.classList.add('lc-selected'));
    } else {
      this.selectedElements = [];
      this.allElements.forEach(el => el.classList.add('lc-unselected'));
    }

    this.updateCount();
  }

  onKeyDown(e) {
    if (!this.isActive) return;

    if (e.key === 'Escape') {
      this.cancel();
    } else if (e.key === 'Enter') {
      this.capture();
    } else if (e.key === 'z' && (e.metaKey || e.ctrlKey) && this.highlights.length > 0) {
      e.preventDefault();
      this.undoLastHighlight();
    }
  }

  undoLastHighlight() {
    if (this.highlights.length === 0) return;
    const last = this.highlights.pop();
    if (last.element && last.element.parentNode) {
      const parent = last.element.parentNode;
      while (last.element.firstChild) {
        parent.insertBefore(last.element.firstChild, last.element);
      }
      parent.removeChild(last.element);
    }
  }

  cancel() {
    this.stop();
  }

  async capture() {
    if (this.selectedElements.length === 0) {
      return;
    }

    // Hide the editing toolbar
    this.overlay.style.display = 'none';
    this.highlight.style.display = 'none';

    // Remove editing classes temporarily for clean preview
    this.allElements.forEach(el => {
      el.classList.remove('lc-selected', 'lc-unselected', 'lc-excluded');
    });

    // Create preview container with selected elements
    const sortedElements = this.sortByDOMOrder(this.selectedElements);

    // Build preview HTML
    const previewContent = document.createElement('div');
    previewContent.className = 'lc-preview-content';
    sortedElements.forEach(el => {
      const clone = el.cloneNode(true);
      previewContent.appendChild(clone);
    });

    // Generate markdown for copy
    const html = sortedElements.map(el => el.outerHTML).join('\n\n');
    const markdown = `# ${document.title}\n\nSource: ${window.location.href}\n\n---\n\n${htmlToMarkdown(html)}`;

    // Create preview modal
    const modal = document.createElement('div');
    modal.id = 'lc-preview-modal';
    modal.innerHTML = `
      <div class="lc-preview-backdrop"></div>
      <div class="lc-preview-container">
        <div class="lc-preview-header">
          <span class="lc-preview-title">Preview</span>
          <button class="lc-preview-close">✕</button>
        </div>
        <div class="lc-preview-body"></div>
        <div class="lc-preview-footer">
          <div class="lc-preview-actions">
            <button class="lc-btn-copy" title="Copy as text">
              <span>📋</span> Copy
            </button>
            <button class="lc-btn-copy-image" title="Copy as image">
              <span>🖼️</span> Image
            </button>
            <button class="lc-btn-share" title="Share">
              <span>📤</span> Share
            </button>
          </div>
        </div>
      </div>
    `;

    modal.querySelector('.lc-preview-body').appendChild(previewContent);
    document.body.appendChild(modal);

    // Store data for actions
    modal.dataset.markdown = markdown;

    // Bind events
    modal.querySelector('.lc-preview-close').addEventListener('click', () => {
      this.closePreview(modal);
    });

    modal.querySelector('.lc-preview-backdrop').addEventListener('click', () => {
      this.closePreview(modal);
    });

    modal.querySelector('.lc-btn-copy').addEventListener('click', async () => {
      await copyToClipboard(markdown);
      this.showToast('Copied as text!');
      this.closePreview(modal);
    });

    modal.querySelector('.lc-btn-copy-image').addEventListener('click', async () => {
      await this.copyAsImage(previewContent);
      this.showToast('Copied as image!');
      this.closePreview(modal);
    });

    modal.querySelector('.lc-btn-share').addEventListener('click', async () => {
      await this.shareContent(markdown, previewContent);
    });

    // Animate in
    requestAnimationFrame(() => {
      modal.classList.add('lc-preview-visible');
    });
  }

  closePreview(modal) {
    modal.classList.remove('lc-preview-visible');
    setTimeout(() => {
      modal.remove();
      this.stop();
    }, 200);
  }

  showToast(message) {
    const toast = document.createElement('div');
    toast.className = 'lc-toast';
    toast.textContent = message;
    document.body.appendChild(toast);

    requestAnimationFrame(() => toast.classList.add('lc-toast-visible'));

    setTimeout(() => {
      toast.classList.remove('lc-toast-visible');
      setTimeout(() => toast.remove(), 300);
    }, 2000);
  }

  async copyAsImage(previewContent) {
    try {
      const html2canvas = await loadHtml2Canvas();
      const canvas = await html2canvas(previewContent, {
        backgroundColor: '#ffffff',
        scale: 2,
        useCORS: true,
        logging: false
      });
      await copyImageToClipboard(canvas);
    } catch (e) {
      console.error('Failed to capture image:', e);
      this.showToast('Failed to copy image');
    }
  }

  async shareContent(markdown, previewContent) {
    // Try native share API first
    if (navigator.share) {
      try {
        // Try to share with image
        const html2canvas = await loadHtml2Canvas();
        const canvas = await html2canvas(previewContent, {
          backgroundColor: '#ffffff',
          scale: 2,
          useCORS: true,
          logging: false
        });

        const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
        const file = new File([blob], 'clip.png', { type: 'image/png' });

        await navigator.share({
          title: document.title,
          text: markdown.substring(0, 280),
          url: window.location.href,
          files: [file]
        });
      } catch (e) {
        // Fallback to text only
        try {
          await navigator.share({
            title: document.title,
            text: markdown.substring(0, 280),
            url: window.location.href
          });
        } catch (e2) {
          console.log('Share cancelled');
        }
      }
    } else {
      // Fallback: open Twitter share
      const text = encodeURIComponent(markdown.substring(0, 240));
      const url = encodeURIComponent(window.location.href);
      window.open(`https://twitter.com/intent/tweet?text=${text}&url=${url}`, '_blank', 'width=550,height=420');
    }
  }

  sortByDOMOrder(elements) {
    return elements.slice().sort((a, b) => {
      const position = a.compareDocumentPosition(b);
      if (position & Node.DOCUMENT_POSITION_FOLLOWING) return -1;
      if (position & Node.DOCUMENT_POSITION_PRECEDING) return 1;
      return 0;
    });
  }
}


// Initialize picker
const contentPicker = new ContentPicker();

// Listen for messages from popup/background
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'startRemoveMode') {
    contentPicker.start('remove');
    sendResponse({ success: true });
  } else if (message.action === 'startAddMode') {
    contentPicker.start('add');
    sendResponse({ success: true });
  }
  return true;
});

} // End of webClipperLoaded guard

// Logseq Web Clipper - Content Script
// Two modes: Edit (subtractive) and Select (text selection)
// Both modes include highlight color functionality

// Color palettes for highlighting
// Light palette: for light background content (fluorescent colors)
const COLORS_FOR_LIGHT_BG = [
  { name: 'Yellow', color: '#ffff00', bg: 'rgba(255, 255, 0, 0.45)' },
  { name: 'Green', color: '#00ff00', bg: 'rgba(0, 255, 0, 0.4)' },
  { name: 'Pink', color: '#ff69b4', bg: 'rgba(255, 105, 180, 0.4)' },
  { name: 'Blue', color: '#00bfff', bg: 'rgba(0, 191, 255, 0.4)' },
  { name: 'Orange', color: '#ffa500', bg: 'rgba(255, 165, 0, 0.45)' },
  { name: 'Purple', color: '#da70d6', bg: 'rgba(218, 112, 214, 0.4)' }
];

// Dark palette: for dark background content (brighter/pastel colors)
const COLORS_FOR_DARK_BG = [
  { name: 'Cream', color: '#fff9c4', bg: 'rgba(255, 249, 196, 0.85)' },
  { name: 'Mint', color: '#b9f6ca', bg: 'rgba(185, 246, 202, 0.85)' },
  { name: 'Lavender', color: '#e1bee7', bg: 'rgba(225, 190, 231, 0.85)' },
  { name: 'Sky', color: '#b3e5fc', bg: 'rgba(179, 229, 252, 0.85)' },
  { name: 'Peach', color: '#ffccbc', bg: 'rgba(255, 204, 188, 0.85)' },
  { name: 'Rose', color: '#f8bbd9', bg: 'rgba(248, 187, 217, 0.85)' }
];

// Detect if page content has dark background
function isPageDarkMode() {
  // Check multiple elements to determine dark mode
  const elementsToCheck = [
    document.body,
    document.querySelector('main'),
    document.querySelector('article'),
    document.querySelector('[role="main"]'),
    document.querySelector('.content'),
    document.querySelector('.post-content')
  ].filter(Boolean);

  for (const el of elementsToCheck) {
    const style = window.getComputedStyle(el);
    const bgColor = style.backgroundColor;

    // Parse RGB values
    const match = bgColor.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    if (match) {
      const [, r, g, b] = match.map(Number);
      // Calculate luminance (perceived brightness)
      const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

      // If luminance < 0.5, it's dark
      if (luminance < 0.5 && bgColor !== 'rgba(0, 0, 0, 0)') {
        return true;
      }
    }
  }

  // Also check color-scheme meta tag
  const colorScheme = document.querySelector('meta[name="color-scheme"]');
  if (colorScheme && colorScheme.content.includes('dark')) {
    return true;
  }

  // Check if body has dark-related classes
  const bodyClasses = document.body.className.toLowerCase();
  if (bodyClasses.includes('dark') || bodyClasses.includes('night')) {
    return true;
  }

  return false;
}

// Generate color buttons HTML with toggle
// activeIndex = -1 means no color selected
function getColorButtonsHtml(isDarkPalette, activeIndex = -1) {
  const colors = isDarkPalette ? COLORS_FOR_DARK_BG : COLORS_FOR_LIGHT_BG;

  return colors.map((c, i) =>
    `<button class="lc-color-btn ${i === activeIndex ? 'active' : ''}" data-color="${c.color}" data-bg="${c.bg}" data-index="${i}" title="${c.name}" style="background: ${c.bg}; border-color: ${c.color};"></button>`
  ).join('') + `<button class="lc-palette-toggle" title="Switch palette">${isDarkPalette ? '🌙' : '☀️'}</button>`;
}

// Smart word selection - expand selection to word boundaries
function expandToWordBoundaries(range) {
  const wordChars = /[a-zA-ZáéíóúüñÁÉÍÓÚÜÑ0-9_-]/;

  // Expand start backwards
  let startContainer = range.startContainer;
  let startOffset = range.startOffset;

  if (startContainer.nodeType === Node.TEXT_NODE) {
    const text = startContainer.textContent;
    while (startOffset > 0 && wordChars.test(text[startOffset - 1])) {
      startOffset--;
    }
  }

  // Expand end forwards
  let endContainer = range.endContainer;
  let endOffset = range.endOffset;

  if (endContainer.nodeType === Node.TEXT_NODE) {
    const text = endContainer.textContent;
    while (endOffset < text.length && wordChars.test(text[endOffset])) {
      endOffset++;
    }
  }

  // Create new range with expanded boundaries
  const newRange = document.createRange();
  newRange.setStart(startContainer, startOffset);
  newRange.setEnd(endContainer, endOffset);

  return newRange;
}


// ============================================
// EDIT MODE - Full content, click to exclude
// ============================================
class EditPicker {
  constructor() {
    this.overlay = null;
    this.highlight = null;
    this.isActive = false;
    this.allElements = [];
    this.excludedElements = [];
    this.highlights = [];
    this.isDarkPalette = false;
    this.currentColorIndex = 0;
    this.currentColor = null;
    this.currentBg = null;
    this.boundOnMouseMove = this.onMouseMove.bind(this);
    this.boundOnClick = this.onClick.bind(this);
    this.boundOnKeyDown = this.onKeyDown.bind(this);
    this.boundOnMouseUp = this.onMouseUp.bind(this);
    this.boundBlockLinks = this.blockLinks.bind(this);
  }

  // Block all link navigation while active (handles multiple event types)
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

  // Register all link-blocking event listeners
  addLinkBlockers() {
    // Block clicks, mousedown, and pointerdown to catch all navigation attempts
    document.addEventListener('click', this.boundBlockLinks, true);
    document.addEventListener('mousedown', this.boundBlockLinks, true);
    document.addEventListener('pointerdown', this.boundBlockLinks, true);
    document.addEventListener('auxclick', this.boundBlockLinks, true);
  }

  // Remove all link-blocking event listeners
  removeLinkBlockers() {
    document.removeEventListener('click', this.boundBlockLinks, true);
    document.removeEventListener('mousedown', this.boundBlockLinks, true);
    document.removeEventListener('pointerdown', this.boundBlockLinks, true);
    document.removeEventListener('auxclick', this.boundBlockLinks, true);
  }

  get palette() {
    return this.isDarkPalette ? COLORS_FOR_DARK_BG : COLORS_FOR_LIGHT_BG;
  }

  start() {
    if (this.isActive) return;
    this.isActive = true;
    this.excludedElements = [];
    this.highlights = [];

    // Initialize palette based on page mode detection
    this.isDarkPalette = isPageDarkMode();
    // No color selected by default (-1)
    this.currentColorIndex = -1;
    this.currentColor = null;
    this.currentBg = null;

    const mainContent = this.findMainContent();
    this.allElements = this.getSelectableElements(mainContent);

    this.allElements.forEach(el => {
      el.classList.add('lc-selected');
    });

    this.overlay = document.createElement('div');
    this.overlay.id = 'logseq-clipper-overlay';
    this.overlay.innerHTML = `
      <div class="lc-toolbar">
        <span class="lc-status">Click to exclude</span>
        <span class="lc-mode-hint"></span>
        <span class="lc-count">${this.getSelectedCount()} items</span>
        <button id="lc-restore">Restore</button>
        <button id="lc-cancel">Cancel</button>
        <button id="lc-capture" class="ready">Capture</button>
      </div>
      <div class="lc-color-bar">
        ${getColorButtonsHtml(this.isDarkPalette, -1)}
      </div>
    `;
    document.body.appendChild(this.overlay);

    this.highlight = document.createElement('div');
    this.highlight.id = 'logseq-clipper-highlight';
    document.body.appendChild(this.highlight);

    this.bindColorButtons();

    // Add link blockers to prevent navigation
    this.addLinkBlockers();

    document.addEventListener('mousemove', this.boundOnMouseMove, true);
    document.addEventListener('click', this.boundOnClick, true);
    document.addEventListener('keydown', this.boundOnKeyDown, true);
    document.addEventListener('mouseup', this.boundOnMouseUp, true);

    document.getElementById('lc-restore').addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      this.restoreAll();
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

    // Bind color buttons (toggle behavior)
    colorBar.querySelectorAll('.lc-color-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        e.preventDefault();
        const clickedIndex = parseInt(btn.dataset.index);

        // Toggle: if same color clicked, deselect it
        if (this.currentColorIndex === clickedIndex) {
          this.currentColorIndex = -1;
          this.currentColor = null;
          this.currentBg = null;
          btn.classList.remove('active');
        } else {
          // Select new color
          this.currentColorIndex = clickedIndex;
          this.setColor(btn.dataset.color, btn.dataset.bg);
          colorBar.querySelectorAll('.lc-color-btn').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
        }

        this.updateModeUI();
      });
    });

    // Bind palette toggle
    const toggleBtn = colorBar.querySelector('.lc-palette-toggle');
    if (toggleBtn) {
      toggleBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        e.preventDefault();
        this.togglePalette();
      });
    }
  }

  togglePalette() {
    this.isDarkPalette = !this.isDarkPalette;

    // Update color bar
    const colorBar = this.overlay.querySelector('.lc-color-bar');
    colorBar.innerHTML = getColorButtonsHtml(this.isDarkPalette, this.currentColorIndex);

    // Re-bind buttons
    this.bindColorButtons();

    // Update current color to same index in new palette (if a color is selected)
    if (this.currentColorIndex >= 0) {
      const newColor = this.palette[this.currentColorIndex];
      this.currentColor = newColor.color;
      this.currentBg = newColor.bg;
    }
  }

  updateModeUI() {
    const status = this.overlay.querySelector('.lc-status');
    const isHighlightMode = this.currentColorIndex >= 0;

    if (isHighlightMode) {
      status.textContent = 'Select text to highlight';
      status.classList.add('highlight-mode');
    } else {
      status.textContent = 'Click to exclude';
      status.classList.remove('highlight-mode');
    }
  }

  isHighlightMode() {
    return this.currentColorIndex >= 0;
  }

  setColor(color, bg) {
    this.currentColor = color;
    this.currentBg = bg;
  }

  onMouseUp(e) {
    if (!this.isActive) return;
    if (e.target.closest('#logseq-clipper-overlay')) return;

    // Only highlight if a color is selected (highlight mode)
    if (!this.isHighlightMode()) return;

    const selection = window.getSelection();
    const text = selection.toString().trim();

    if (text.length > 0) {
      this.highlightSelection(selection);
    }
  }

  highlightSelection(selection) {
    const originalRange = selection.getRangeAt(0);

    // Expand to word boundaries for better UX
    const range = expandToWordBoundaries(originalRange);

    const wrapper = document.createElement('mark');
    wrapper.className = 'lc-text-highlight';
    wrapper.style.backgroundColor = this.currentBg;
    wrapper.style.borderBottom = `2px solid ${this.currentColor}`;
    wrapper.dataset.color = this.currentColor;

    try {
      range.surroundContents(wrapper);
      this.highlights.push({
        element: wrapper,
        text: wrapper.textContent,
        color: this.currentColor
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
      el.classList.remove('lc-excluded');
    });
    this.allElements = [];
    this.excludedElements = [];

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

    // Remove link blockers
    this.removeLinkBlockers();
  }

  onMouseMove(e) {
    if (!this.isActive) return;

    // Hide element highlight in highlight mode
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

    if (this.excludedElements.includes(target)) {
      this.highlight.className = 'lc-highlight-restore';
    } else {
      this.highlight.className = 'lc-highlight-exclude';
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

    // Skip toolbar clicks
    if (e.target.closest('#logseq-clipper-overlay')) return;

    // Always prevent default on links to stop navigation
    const clickedLink = e.target.closest('a');
    if (clickedLink) {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
    }

    // Don't handle element clicks if in highlight mode
    if (this.isHighlightMode()) return;

    const target = this.getSelectableTarget(e.target);

    if (!target || target.id === 'logseq-clipper-highlight') {
      return;
    }

    // Don't toggle if user is selecting text
    const selection = window.getSelection();
    if (selection.toString().trim().length > 0) {
      return;
    }

    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();

    const index = this.excludedElements.indexOf(target);
    if (index > -1) {
      this.excludedElements.splice(index, 1);
      target.classList.remove('lc-excluded');
      target.classList.add('lc-selected');
    } else {
      this.excludedElements.push(target);
      target.classList.remove('lc-selected');
      target.classList.add('lc-excluded');
    }

    this.updateCount();
  }

  updateCount() {
    const count = this.getSelectedCount();
    const countEl = this.overlay.querySelector('.lc-count');
    countEl.textContent = `${count} items`;

    const captureBtn = document.getElementById('lc-capture');
    if (count > 0) {
      captureBtn.classList.add('ready');
    } else {
      captureBtn.classList.remove('ready');
    }
  }

  getSelectedCount() {
    return this.allElements.length - this.excludedElements.length;
  }

  restoreAll() {
    this.excludedElements.forEach(el => {
      el.classList.remove('lc-excluded');
      el.classList.add('lc-selected');
    });
    this.excludedElements = [];
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

  capture() {
    const selectedElements = this.allElements.filter(el => !this.excludedElements.includes(el));

    if (selectedElements.length === 0) {
      alert('No elements selected.');
      return;
    }

    const sortedElements = this.sortByDOMOrder(selectedElements);

    const htmlParts = [];
    const textParts = [];

    sortedElements.forEach(el => {
      htmlParts.push(el.outerHTML);
      textParts.push(el.innerText);
    });

    // Build highlight data
    const highlightData = this.highlights.map(h => ({
      text: h.text,
      color: h.color,
      colorName: this.palette.find(c => c.color === h.color)?.name || 'Highlight'
    }));

    chrome.runtime.sendMessage({
      type: 'elementCaptured',
      data: {
        html: htmlParts.join('\n\n'),
        text: textParts.join('\n\n'),
        title: document.title,
        url: window.location.href,
        elementCount: selectedElements.length,
        highlights: highlightData
      }
    });

    this.stop();
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


// ============================================
// SELECT MODE - Highlight text to capture
// ============================================
class SelectPicker {
  constructor() {
    this.toolbar = null;
    this.instructionBar = null;
    this.isActive = false;
    this.isDarkPalette = false;
    this.currentColorIndex = 0;
    this.currentColor = null;
    this.currentBg = null;
    this.boundOnSelectionChange = this.onSelectionChange.bind(this);
    this.boundOnKeyDown = this.onKeyDown.bind(this);
  }

  get palette() {
    return this.isDarkPalette ? COLORS_FOR_DARK_BG : COLORS_FOR_LIGHT_BG;
  }

  start() {
    if (this.isActive) return;
    this.isActive = true;

    // Initialize palette based on page mode
    this.isDarkPalette = isPageDarkMode();
    this.currentColorIndex = 0;
    this.currentColor = this.palette[0].color;
    this.currentBg = this.palette[0].bg;

    // Create instruction bar with color picker
    this.instructionBar = document.createElement('div');
    this.instructionBar.id = 'logseq-select-instruction';
    this.instructionBar.innerHTML = `
      <span>Select text to capture</span>
      <div class="lc-highlight-colors">
        ${getColorButtonsHtml(this.isDarkPalette)}
      </div>
      <button id="lc-instruction-cancel">Cancel</button>
    `;
    document.body.appendChild(this.instructionBar);

    this.bindColorButtons();

    document.getElementById('lc-instruction-cancel').addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      this.cancel();
    });

    // Create floating toolbar (initially hidden)
    this.toolbar = document.createElement('div');
    this.toolbar.id = 'logseq-select-toolbar';
    this.toolbar.className = 'lc-select-hidden';
    this.toolbar.innerHTML = `
      <button id="lc-select-capture">Capture</button>
      <button id="lc-select-cancel">✕</button>
    `;
    document.body.appendChild(this.toolbar);

    // Bind events
    document.addEventListener('selectionchange', this.boundOnSelectionChange);
    document.addEventListener('keydown', this.boundOnKeyDown, true);

    document.getElementById('lc-select-capture').addEventListener('click', (e) => {
      e.stopPropagation();
      this.capture();
    });
    document.getElementById('lc-select-cancel').addEventListener('click', (e) => {
      e.stopPropagation();
      this.cancel();
    });
  }

  bindColorButtons() {
    const colorContainer = this.instructionBar.querySelector('.lc-highlight-colors');

    // Bind color buttons
    colorContainer.querySelectorAll('.lc-color-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        e.preventDefault();
        this.currentColorIndex = parseInt(btn.dataset.index);
        this.setColor(btn.dataset.color, btn.dataset.bg);
        colorContainer.querySelectorAll('.lc-color-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
      });
    });

    // Bind palette toggle
    const toggleBtn = colorContainer.querySelector('.lc-palette-toggle');
    if (toggleBtn) {
      toggleBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        e.preventDefault();
        this.togglePalette();
      });
    }
  }

  togglePalette() {
    this.isDarkPalette = !this.isDarkPalette;

    // Update color container
    const colorContainer = this.instructionBar.querySelector('.lc-highlight-colors');
    colorContainer.innerHTML = getColorButtonsHtml(this.isDarkPalette, this.currentColorIndex);

    // Re-bind buttons
    this.bindColorButtons();

    // Update current color to same index in new palette
    const newColor = this.palette[this.currentColorIndex];
    this.currentColor = newColor.color;
    this.currentBg = newColor.bg;
  }

  setColor(color, bg) {
    this.currentColor = color;
    this.currentBg = bg;
  }

  stop() {
    this.isActive = false;

    if (this.toolbar) {
      this.toolbar.remove();
      this.toolbar = null;
    }

    if (this.instructionBar) {
      this.instructionBar.remove();
      this.instructionBar = null;
    }

    document.removeEventListener('selectionchange', this.boundOnSelectionChange);
    document.removeEventListener('keydown', this.boundOnKeyDown, true);

    // Clear selection
    window.getSelection().removeAllRanges();
  }

  onSelectionChange() {
    if (!this.isActive) return;

    const selection = window.getSelection();
    const text = selection.toString().trim();

    if (text.length > 0) {
      this.showToolbar(selection);
    } else {
      this.hideToolbar();
    }
  }

  showToolbar(selection) {
    if (!this.toolbar) return;

    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();

    // Position toolbar above the selection
    this.toolbar.style.top = `${rect.top + window.scrollY - 50}px`;
    this.toolbar.style.left = `${rect.left + window.scrollX + (rect.width / 2)}px`;
    this.toolbar.classList.remove('lc-select-hidden');
    this.toolbar.classList.add('lc-select-visible');
  }

  hideToolbar() {
    if (!this.toolbar) return;
    this.toolbar.classList.remove('lc-select-visible');
    this.toolbar.classList.add('lc-select-hidden');
  }

  onKeyDown(e) {
    if (!this.isActive) return;

    if (e.key === 'Escape') {
      this.cancel();
    } else if (e.key === 'Enter') {
      const selection = window.getSelection();
      if (selection.toString().trim().length > 0) {
        this.capture();
      }
    }
  }

  cancel() {
    this.stop();
  }

  capture() {
    const selection = window.getSelection();

    if (!selection.toString().trim()) {
      alert('No text selected.');
      return;
    }

    // Expand to word boundaries for better UX
    const originalRange = selection.getRangeAt(0);
    const range = expandToWordBoundaries(originalRange);

    // Update selection to show expanded range
    selection.removeAllRanges();
    selection.addRange(range);

    const text = selection.toString().trim();
    const container = document.createElement('div');
    container.appendChild(range.cloneContents());

    // Get color info
    const colorName = this.palette.find(c => c.color === this.currentColor)?.name || 'Highlight';

    chrome.runtime.sendMessage({
      type: 'elementCaptured',
      data: {
        html: container.innerHTML,
        text: text,
        title: document.title,
        url: window.location.href,
        elementCount: 1,
        highlights: [{
          text: text,
          color: this.currentColor,
          colorName: colorName
        }]
      }
    });

    this.stop();
  }
}


// Initialize pickers
const editPicker = new EditPicker();
const selectPicker = new SelectPicker();

// Listen for messages from popup/background
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'startEditMode') {
    editPicker.start();
    sendResponse({ success: true });
  } else if (message.action === 'startSelectMode') {
    selectPicker.start();
    sendResponse({ success: true });
  }
  return true;
});

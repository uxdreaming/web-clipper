// Logseq block formatter

const LogseqFormatter = {
  // Convert markdown to Logseq block format
  toBlocks(markdown, indentLevel = 0) {
    const lines = markdown.split('\n');
    const result = [];
    const indent = '  '.repeat(indentLevel);

    let inCodeBlock = false;
    let codeBlockContent = [];
    let codeBlockLang = '';

    for (let i = 0; i < lines.length; i++) {
      let line = lines[i];

      // Handle code blocks
      if (line.trim().startsWith('```')) {
        if (!inCodeBlock) {
          inCodeBlock = true;
          codeBlockLang = line.trim().slice(3);
          codeBlockContent = [];
        } else {
          // End code block
          inCodeBlock = false;
          const codeContent = codeBlockContent.join('\n');
          result.push(`${indent}- \`\`\`${codeBlockLang}`);
          result.push(codeContent);
          result.push(`${indent}  \`\`\``);
        }
        continue;
      }

      if (inCodeBlock) {
        codeBlockContent.push(`${indent}  ${line}`);
        continue;
      }

      // Skip empty lines
      if (line.trim() === '') {
        continue;
      }

      // Handle headers
      const headerMatch = line.match(/^(#{1,6})\s+(.+)/);
      if (headerMatch) {
        const level = headerMatch[1].length;
        const text = headerMatch[2];
        // Convert headers to bold blocks with appropriate nesting
        result.push(`${indent}- **${text}**`);
        continue;
      }

      // Handle blockquotes
      if (line.trim().startsWith('>')) {
        const quoteText = line.replace(/^>\s*/, '').trim();
        result.push(`${indent}- > ${quoteText}`);
        continue;
      }

      // Handle unordered lists (already bullet points)
      const ulMatch = line.match(/^(\s*)[-*+]\s+(.+)/);
      if (ulMatch) {
        const existingIndent = ulMatch[1].length;
        const text = ulMatch[2];
        const extraIndent = '  '.repeat(Math.floor(existingIndent / 2));
        result.push(`${indent}${extraIndent}- ${text}`);
        continue;
      }

      // Handle ordered lists
      const olMatch = line.match(/^(\s*)\d+\.\s+(.+)/);
      if (olMatch) {
        const existingIndent = olMatch[1].length;
        const text = olMatch[2];
        const extraIndent = '  '.repeat(Math.floor(existingIndent / 2));
        result.push(`${indent}${extraIndent}- ${text}`);
        continue;
      }

      // Handle horizontal rules
      if (line.match(/^[-*_]{3,}\s*$/)) {
        result.push(`${indent}- ---`);
        continue;
      }

      // Regular paragraph - wrap as bullet
      result.push(`${indent}- ${line.trim()}`);
    }

    return result.join('\n');
  },

  // Convert HTML to Logseq blocks (via Turndown first)
  htmlToBlocks(html, turndownService, indentLevel = 0) {
    const markdown = turndownService.turndown(html);
    return this.toBlocks(markdown, indentLevel);
  },

  // Format content with properties (Logseq page properties)
  withProperties(content, properties) {
    const propLines = [];

    for (const [key, value] of Object.entries(properties)) {
      if (value && value.trim()) {
        propLines.push(`${key}:: ${value}`);
      }
    }

    if (propLines.length === 0) {
      return content;
    }

    // Insert properties after first bullet
    const lines = content.split('\n');
    if (lines.length > 0 && lines[0].startsWith('- ')) {
      const firstLine = lines[0];
      const rest = lines.slice(1);
      const propsIndented = propLines.map(p => `  ${p}`);
      return [firstLine, ...propsIndented, ...rest].join('\n');
    }

    return content;
  },

  // Escape special Logseq characters
  escape(text) {
    return text
      .replace(/\[\[/g, '\\[\\[')
      .replace(/\]\]/g, '\\]\\]')
      .replace(/\(\(/g, '\\(\\(')
      .replace(/\)\)/g, '\\)\\)');
  },

  // Create a Logseq page link
  pageLink(pageName) {
    return `[[${pageName}]]`;
  },

  // Create a Logseq tag
  tag(tagName) {
    // Remove # if present and spaces
    const clean = tagName.replace(/^#/, '').trim();
    if (clean.includes(' ')) {
      return `#[[${clean}]]`;
    }
    return `#${clean}`;
  },

  // Format tags string to Logseq tags
  formatTags(tagsString) {
    if (!tagsString) return '';

    return tagsString
      .split(',')
      .map(t => t.trim())
      .filter(t => t)
      .map(t => this.tag(t))
      .join(' ');
  },

  // Get journal filename for a date
  getJournalFilename(date, format = 'yyyy-MM-dd') {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    const filename = format
      .replace('yyyy', year)
      .replace('MM', month)
      .replace('dd', day);

    return `${filename}.md`;
  },

  // Get page filename from page name
  getPageFilename(pageName) {
    // Logseq uses URL-encoding-like naming for special chars
    const safe = pageName
      .replace(/\//g, '___')
      .replace(/\\/g, '___')
      .replace(/:/g, '___')
      .replace(/\*/g, '___')
      .replace(/\?/g, '___')
      .replace(/"/g, '___')
      .replace(/</g, '___')
      .replace(/>/g, '___')
      .replace(/\|/g, '___');

    return `${safe}.md`;
  }
};

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
  module.exports = LogseqFormatter;
}

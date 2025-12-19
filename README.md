# Web Clipper

Chrome extension for capturing and highlighting web content with smart export options.

## Features

- **Two capture modes**: Remove (start with all, click to exclude) or Add (start empty, click to include)
- **Text highlighting** with 6 fluorescent colors
- **Preview modal** before exporting
- **Multiple export options**: Copy as text (Markdown), Copy as image, Share
- **Inline highlights** preserved in Markdown: `==text== (Color)`

## Usage

1. Click the extension icon
2. Choose **Remove** or **Add** mode
3. Click elements to include/exclude them
4. Select a color and highlight text (optional)
5. Click **Capture** to preview
6. Choose: Copy (text), Image, or Share

## Installation

### From source

1. Clone or download this repository
2. Open `chrome://extensions/`
3. Enable **Developer mode**
4. Click **Load unpacked**
5. Select the `Web Clipper` folder

## Project Structure

```
Web Clipper/
├── manifest.json          # Extension config (v3)
├── popup/                  # Main UI
│   ├── popup.html
│   ├── popup.js
│   └── popup.css
├── content/                # Injected scripts
│   ├── content.js
│   └── content.css
├── background/             # Service worker
│   └── service-worker.js
├── lib/                    # Libraries
│   ├── html2canvas.min.js  # Image capture
│   └── turndown.min.js     # HTML→Markdown
└── icons/                  # Extension icons
```

## Permissions

- `activeTab` - Access current tab
- `storage` - Save preferences
- `clipboardWrite` - Copy to clipboard
- `scripting` - Inject content scripts

## Compatibility

- Chrome/Chromium (Manifest v3)
- Edge (compatible)

## License

MIT

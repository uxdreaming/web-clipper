#!/bin/bash
# Logseq Web Clipper - Native Host Installer

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
HOST_NAME="com.logseq.clipper"
HOST_PATH="/usr/local/bin/logseq-clipper-host"

echo "Logseq Web Clipper - Native Host Installer"
echo "==========================================="
echo

# Check for extension ID
if [ -z "$1" ]; then
    echo "Usage: $0 <extension-id>"
    echo
    echo "To find your extension ID:"
    echo "1. Go to chrome://extensions"
    echo "2. Enable 'Developer mode'"
    echo "3. Load the extension"
    echo "4. Copy the extension ID"
    exit 1
fi

EXTENSION_ID="$1"

# Detect OS
OS="$(uname -s)"
case "$OS" in
    Linux)
        MANIFEST_DIR="$HOME/.config/google-chrome/NativeMessagingHosts"
        # Also try Chromium path
        if [ -d "$HOME/.config/chromium" ]; then
            MANIFEST_DIR_CHROMIUM="$HOME/.config/chromium/NativeMessagingHosts"
        fi
        ;;
    Darwin)
        MANIFEST_DIR="$HOME/Library/Application Support/Google/Chrome/NativeMessagingHosts"
        ;;
    *)
        echo "Unsupported OS: $OS"
        exit 1
        ;;
esac

echo "Installing native host..."

# Copy host script
echo "  - Copying host script to $HOST_PATH"
sudo cp "$SCRIPT_DIR/logseq-clipper-host.py" "$HOST_PATH"
sudo chmod +x "$HOST_PATH"

# Create manifest directory
echo "  - Creating manifest directory"
mkdir -p "$MANIFEST_DIR"

# Create manifest with correct extension ID
echo "  - Creating manifest file"
cat > "$MANIFEST_DIR/$HOST_NAME.json" << EOF
{
  "name": "$HOST_NAME",
  "description": "Logseq Web Clipper Native Host",
  "path": "$HOST_PATH",
  "type": "stdio",
  "allowed_origins": [
    "chrome-extension://$EXTENSION_ID/"
  ]
}
EOF

# Also install for Chromium if available
if [ -n "$MANIFEST_DIR_CHROMIUM" ]; then
    mkdir -p "$MANIFEST_DIR_CHROMIUM"
    cp "$MANIFEST_DIR/$HOST_NAME.json" "$MANIFEST_DIR_CHROMIUM/"
    echo "  - Also installed for Chromium"
fi

# Create config directory
CONFIG_DIR="$HOME/.config/logseq-clipper"
mkdir -p "$CONFIG_DIR"

# Create default config if not exists
if [ ! -f "$CONFIG_DIR/config.json" ]; then
    echo "  - Creating default config"
    cat > "$CONFIG_DIR/config.json" << EOF
{
  "graphPath": "~/Documents/logseq"
}
EOF
fi

echo
echo "Installation complete!"
echo
echo "Next steps:"
echo "1. Restart Chrome/Chromium"
echo "2. Open the extension popup"
echo "3. Go to options to configure your Logseq graph path"
echo
echo "Config file: $CONFIG_DIR/config.json"

#!/usr/bin/env python3
"""
Logseq Web Clipper - Native Messaging Host
Handles filesystem operations for the Chrome extension
"""

import json
import struct
import sys
import os
from pathlib import Path


def get_message():
    """Read a message from stdin."""
    raw_length = sys.stdin.buffer.read(4)
    if not raw_length:
        return None
    message_length = struct.unpack('=I', raw_length)[0]
    message = sys.stdin.buffer.read(message_length).decode('utf-8')
    return json.loads(message)


def send_message(message):
    """Send a message to stdout."""
    encoded = json.dumps(message).encode('utf-8')
    sys.stdout.buffer.write(struct.pack('=I', len(encoded)))
    sys.stdout.buffer.write(encoded)
    sys.stdout.buffer.flush()


def expand_path(path):
    """Expand ~ and environment variables in path."""
    return os.path.expanduser(os.path.expandvars(path))


def get_graph_path():
    """Get the Logseq graph path from config or default."""
    config_path = Path.home() / '.config' / 'logseq-clipper' / 'config.json'

    if config_path.exists():
        with open(config_path) as f:
            config = json.load(f)
            return expand_path(config.get('graphPath', '~/Documents/logseq'))

    return expand_path('~/Documents/logseq')


def ensure_directory(path):
    """Ensure directory exists."""
    Path(path).mkdir(parents=True, exist_ok=True)


def list_pages(graph_path):
    """List all pages in the Logseq graph."""
    pages_dir = Path(graph_path) / 'pages'
    pages = []

    if pages_dir.exists():
        for f in pages_dir.glob('*.md'):
            # Convert filename back to page name
            name = f.stem.replace('___', '/')
            pages.append(name)

    return sorted(pages)


def save_content(graph_path, folder, filename, content, position='append'):
    """Save content to a Logseq file."""
    file_path = Path(graph_path) / folder / filename

    # Ensure directory exists
    ensure_directory(file_path.parent)

    # Read existing content if file exists
    existing_content = ''
    if file_path.exists():
        with open(file_path, 'r', encoding='utf-8') as f:
            existing_content = f.read()

    # Combine content based on position
    if position == 'prepend':
        new_content = content + '\n' + existing_content if existing_content else content
    else:  # append
        new_content = existing_content + '\n' + content if existing_content else content

    # Write file
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(new_content)

    return True


def set_config(key, value):
    """Save configuration."""
    config_dir = Path.home() / '.config' / 'logseq-clipper'
    config_path = config_dir / 'config.json'

    ensure_directory(config_dir)

    config = {}
    if config_path.exists():
        with open(config_path) as f:
            config = json.load(f)

    config[key] = value

    with open(config_path, 'w') as f:
        json.dump(config, f, indent=2)

    return True


def handle_message(message):
    """Handle incoming message and return response."""
    action = message.get('action')

    try:
        graph_path = get_graph_path()

        if action == 'save':
            folder = message.get('folder', 'journals')
            filename = message.get('filename')
            content = message.get('content')
            position = message.get('position', 'append')

            if not filename or not content:
                return {'success': False, 'error': 'Missing filename or content'}

            save_content(graph_path, folder, filename, content, position)
            return {'success': True, 'path': str(Path(graph_path) / folder / filename)}

        elif action == 'listPages':
            pages = list_pages(graph_path)
            return {'success': True, 'pages': pages}

        elif action == 'getConfig':
            return {
                'success': True,
                'graphPath': graph_path,
                'config': {}
            }

        elif action == 'setConfig':
            key = message.get('key')
            value = message.get('value')
            set_config(key, value)
            return {'success': True}

        elif action == 'ping':
            return {'success': True, 'message': 'pong', 'graphPath': graph_path}

        else:
            return {'success': False, 'error': f'Unknown action: {action}'}

    except Exception as e:
        return {'success': False, 'error': str(e)}


def main():
    """Main loop."""
    while True:
        message = get_message()
        if message is None:
            break
        response = handle_message(message)
        send_message(response)


if __name__ == '__main__':
    main()

// File System Access API wrapper for Logseq Web Clipper
// Allows saving directly to user's Logseq folder

const LogseqFS = {
  DB_NAME: 'logseq-clipper-fs',
  STORE_NAME: 'handles',
  HANDLE_KEY: 'logseq-folder',

  // Open IndexedDB
  async openDB() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.DB_NAME, 1);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(this.STORE_NAME)) {
          db.createObjectStore(this.STORE_NAME);
        }
      };
    });
  },

  // Save folder handle to IndexedDB
  async saveHandle(handle) {
    console.log('[LogseqFS] saveHandle called');
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.STORE_NAME, 'readwrite');
      const store = tx.objectStore(this.STORE_NAME);
      const request = store.put(handle, this.HANDLE_KEY);

      request.onerror = () => {
        console.error('[LogseqFS] saveHandle error:', request.error);
        reject(request.error);
      };
      request.onsuccess = () => {
        console.log('[LogseqFS] saveHandle success');
        resolve();
      };
    });
  },

  // Get saved folder handle from IndexedDB
  async getHandle() {
    console.log('[LogseqFS] getHandle called');
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.STORE_NAME, 'readonly');
      const store = tx.objectStore(this.STORE_NAME);
      const request = store.get(this.HANDLE_KEY);

      request.onerror = () => {
        console.error('[LogseqFS] getHandle error:', request.error);
        reject(request.error);
      };
      request.onsuccess = () => {
        console.log('[LogseqFS] getHandle result:', request.result);
        resolve(request.result);
      };
    });
  },

  // Check if we have permission to access the folder
  async hasPermission() {
    try {
      const handle = await this.getHandle();
      if (!handle) return false;

      const permission = await handle.queryPermission({ mode: 'readwrite' });
      return permission === 'granted';
    } catch (e) {
      return false;
    }
  },

  // Request permission for existing handle
  async requestPermission() {
    try {
      const handle = await this.getHandle();
      if (!handle) return false;

      const permission = await handle.requestPermission({ mode: 'readwrite' });
      return permission === 'granted';
    } catch (e) {
      return false;
    }
  },

  // Let user pick their Logseq folder
  async selectFolder() {
    console.log('[LogseqFS] selectFolder called');
    try {
      const handle = await window.showDirectoryPicker({
        id: 'logseq-folder',
        mode: 'readwrite',
        startIn: 'documents'
      });
      console.log('[LogseqFS] Got handle:', handle.name);

      // Verify it looks like a Logseq folder
      const isValid = await this.validateLogseqFolder(handle);
      console.log('[LogseqFS] Folder validation result:', isValid);
      if (!isValid) {
        throw new Error('This does not appear to be a Logseq folder. Please select a folder containing "journals" and "pages" subfolders.');
      }

      console.log('[LogseqFS] Saving handle to IndexedDB...');
      await this.saveHandle(handle);
      console.log('[LogseqFS] Handle saved successfully');
      return { success: true, name: handle.name };
    } catch (e) {
      console.error('[LogseqFS] selectFolder error:', e);
      if (e.name === 'AbortError') {
        return { success: false, error: 'cancelled' };
      }
      return { success: false, error: e.message };
    }
  },

  // Check if folder has journals/ and pages/ subdirectories
  async validateLogseqFolder(handle) {
    try {
      let hasJournals = false;
      let hasPages = false;

      for await (const entry of handle.values()) {
        if (entry.kind === 'directory') {
          if (entry.name === 'journals') hasJournals = true;
          if (entry.name === 'pages') hasPages = true;
        }
      }

      return hasJournals || hasPages;
    } catch (e) {
      return false;
    }
  },

  // Get or create a subdirectory
  async getSubfolder(parentHandle, name) {
    try {
      return await parentHandle.getDirectoryHandle(name, { create: true });
    } catch (e) {
      throw new Error(`Cannot access ${name} folder: ${e.message}`);
    }
  },

  // Write content to a file
  async writeFile(folderHandle, filename, content) {
    try {
      const fileHandle = await folderHandle.getFileHandle(filename, { create: true });
      const writable = await fileHandle.createWritable();
      await writable.write(content);
      await writable.close();
      return true;
    } catch (e) {
      throw new Error(`Cannot write file: ${e.message}`);
    }
  },

  // Append content to existing file or create new
  async appendToFile(folderHandle, filename, content, position = 'append') {
    try {
      let existingContent = '';

      // Try to read existing file
      try {
        const fileHandle = await folderHandle.getFileHandle(filename);
        const file = await fileHandle.getFile();
        existingContent = await file.text();
      } catch (e) {
        // File doesn't exist, will create new
      }

      // Combine content
      let newContent;
      if (position === 'prepend') {
        newContent = content + (existingContent ? '\n' + existingContent : '');
      } else {
        newContent = (existingContent ? existingContent + '\n' : '') + content;
      }

      // Write combined content
      await this.writeFile(folderHandle, filename, newContent);
      return true;
    } catch (e) {
      throw new Error(`Cannot append to file: ${e.message}`);
    }
  },

  // Main save function
  async saveToLogseq(folder, filename, content, position = 'append') {
    // Get main handle
    const mainHandle = await this.getHandle();
    if (!mainHandle) {
      throw new Error('no-folder');
    }

    // Check permission
    const permission = await mainHandle.queryPermission({ mode: 'readwrite' });
    if (permission !== 'granted') {
      const granted = await mainHandle.requestPermission({ mode: 'readwrite' });
      if (granted !== 'granted') {
        throw new Error('permission-denied');
      }
    }

    // Get subfolder (journals or pages)
    const subfolderHandle = await this.getSubfolder(mainHandle, folder);

    // Append or write content
    await this.appendToFile(subfolderHandle, filename, content, position);

    return { success: true, path: `${folder}/${filename}` };
  },

  // Get list of existing pages
  async getPages() {
    try {
      const mainHandle = await this.getHandle();
      if (!mainHandle) return [];

      const pagesHandle = await this.getSubfolder(mainHandle, 'pages');
      const pages = [];

      for await (const entry of pagesHandle.values()) {
        if (entry.kind === 'file' && entry.name.endsWith('.md')) {
          pages.push(entry.name.replace('.md', ''));
        }
      }

      return pages.sort();
    } catch (e) {
      return [];
    }
  },

  // Clear saved handle
  async clearFolder() {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.STORE_NAME, 'readwrite');
      const store = tx.objectStore(this.STORE_NAME);
      const request = store.delete(this.HANDLE_KEY);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }
};

// Export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = LogseqFS;
}

// Logseq Web Clipper - Background Service Worker

const NATIVE_HOST_NAME = 'com.logseq.clipper';

// Handle messages from popup and content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'nativeMessage') {
    // Forward to native host
    sendNativeMessage(message.data)
      .then(response => sendResponse(response))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true; // Keep channel open for async response
  }

  if (message.type === 'elementCaptured') {
    // Store captured element data for popup to retrieve
    chrome.storage.local.set({ pendingCapture: message.data });

    // Open popup with captured content
    // Note: Can't programmatically open popup, so we'll use a notification or badge
    chrome.action.setBadgeText({ text: '1' });
    chrome.action.setBadgeBackgroundColor({ color: '#4a9eff' });
  }

  return false;
});

// Send message to native host
async function sendNativeMessage(message) {
  return new Promise((resolve, reject) => {
    try {
      chrome.runtime.sendNativeMessage(NATIVE_HOST_NAME, message, (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve(response);
        }
      });
    } catch (error) {
      reject(error);
    }
  });
}

// Context menu for quick capture
chrome.runtime.onInstalled.addListener(() => {
  // Create context menu items
  chrome.contextMenus.create({
    id: 'clipSelection',
    title: 'Clip selection to Logseq',
    contexts: ['selection']
  });

  chrome.contextMenus.create({
    id: 'clipPage',
    title: 'Clip page to Logseq',
    contexts: ['page']
  });

  chrome.contextMenus.create({
    id: 'clipLink',
    title: 'Clip link to Logseq',
    contexts: ['link']
  });

  chrome.contextMenus.create({
    id: 'clipImage',
    title: 'Clip image to Logseq',
    contexts: ['image']
  });
});

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  let data = {
    title: tab.title,
    url: tab.url,
    type: info.menuItemId
  };

  if (info.menuItemId === 'clipSelection') {
    data.selection = info.selectionText;
  } else if (info.menuItemId === 'clipLink') {
    data.linkUrl = info.linkUrl;
    data.linkText = info.linkText || info.linkUrl;
  } else if (info.menuItemId === 'clipImage') {
    data.imageUrl = info.srcUrl;
  }

  // Store for popup
  await chrome.storage.local.set({ pendingCapture: data });

  // Show badge
  chrome.action.setBadgeText({ text: '1', tabId: tab.id });
  chrome.action.setBadgeBackgroundColor({ color: '#4a9eff' });

  // Open popup
  chrome.action.openPopup();
});

// Clear badge when popup opens
chrome.action.onClicked.addListener(() => {
  chrome.action.setBadgeText({ text: '' });
});

// Keyboard shortcut handler
chrome.commands.onCommand.addListener((command) => {
  if (command === 'quick-clip') {
    // Get active tab and capture selection
    chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
      if (tabs[0]) {
        const response = await chrome.tabs.sendMessage(tabs[0].id, { action: 'getSelection' });
        if (response && response.text) {
          await chrome.storage.local.set({
            pendingCapture: {
              ...response,
              title: tabs[0].title,
              url: tabs[0].url
            }
          });
          chrome.action.openPopup();
        }
      }
    });
  }
});

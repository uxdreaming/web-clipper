// Web Clipper - Background Service Worker

// Handle messages from content scripts
chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
  if (message.type === 'elementCaptured') {
    // Store captured content for popup to retrieve
    await chrome.storage.local.set({ pendingCapture: message.data });

    // Try to open popup automatically
    try {
      await chrome.action.openPopup();
    } catch (e) {
      // openPopup failed, open editor in a new tab instead
      chrome.tabs.create({
        url: chrome.runtime.getURL('popup/popup.html'),
        active: true
      });
    }

    sendResponse({ success: true });
  }
  return true;
});

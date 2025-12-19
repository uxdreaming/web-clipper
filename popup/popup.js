// Web Clipper - Simple Popup

document.addEventListener('DOMContentLoaded', async () => {
  // Load theme
  const result = await chrome.storage.local.get('theme');
  if (result.theme === 'dark') {
    document.body.classList.add('dark');
  }

  // Theme toggle
  document.getElementById('themeToggle').addEventListener('click', async () => {
    document.body.classList.toggle('dark');
    const isDark = document.body.classList.contains('dark');
    await chrome.storage.local.set({ theme: isDark ? 'dark' : 'light' });
  });

  // Remove mode (start with all selected)
  document.getElementById('removeMode').addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    await injectAndStart(tab.id, 'startRemoveMode');
    window.close();
  });

  // Add mode (start with nothing selected)
  document.getElementById('addMode').addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    await injectAndStart(tab.id, 'startAddMode');
    window.close();
  });
});

async function injectAndStart(tabId, action) {
  await chrome.scripting.insertCSS({
    target: { tabId },
    files: ['content/content.css']
  });

  await chrome.scripting.executeScript({
    target: { tabId },
    files: ['content/content.js']
  });

  await new Promise(r => setTimeout(r, 100));
  await chrome.tabs.sendMessage(tabId, { action });
}

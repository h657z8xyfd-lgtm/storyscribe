// StoryScribe Content Script
// Runs on Teams, Zoom, and Meet pages

(function() {
  console.log('StoryScribe: Content script loaded');
  
  // Create floating button
  const button = document.createElement('div');
  button.id = 'storyscribe-fab';
  button.innerHTML = '📋';
  button.title = 'StoryScribe - Capture Transcript';
  document.body.appendChild(button);
  
  // Track transcript
  let transcriptBuffer = [];
  
  // Observe for transcript elements
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (node.nodeType === 1) {
          // Check for transcript-like content
          const text = node.textContent;
          if (text && text.length > 10 && text.length < 500) {
            transcriptBuffer.push({
              text: text,
              timestamp: Date.now()
            });
          }
        }
      });
    });
  });
  
  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
  
  // Button click handler
  button.addEventListener('click', () => {
    // Open extension popup
    chrome.runtime.sendMessage({ action: 'openPopup' });
  });
  
  // Listen for capture requests
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'getTranscript') {
      const transcript = transcriptBuffer.map(t => t.text).join('\n');
      sendResponse({ transcript });
    }
  });
})();

// Background service worker for StoryScribe

// Handle installation
chrome.runtime.onInstalled.addListener(() => {
  console.log('StoryScribe installed');
});

// Handle messages from popup or content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'validateLicense') {
    validateLicense(request.licenseKey).then(sendResponse);
    return true;
  }
});

// Validate license with LemonSqueezy
async function validateLicense(licenseKey) {
  try {
    const response = await fetch('https://api.lemonsqueezy.com/v1/licenses/validate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        license_key: licenseKey
      })
    });
    
    const data = await response.json();
    return { valid: data.valid, data };
  } catch (error) {
    return { valid: false, error: error.message };
  }
}

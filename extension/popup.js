// State
let tickets = [];
let isLicensed = false;

// DOM Elements
const licenseSection = document.getElementById('licenseSection');
const licenseStatus = document.getElementById('licenseStatus');
const licenseText = document.getElementById('licenseText');
const licenseKeyInput = document.getElementById('licenseKey');
const activateBtn = document.getElementById('activateBtn');
const mainApp = document.getElementById('mainApp');

const transcriptInput = document.getElementById('transcriptInput');
const analyzeBtn = document.getElementById('analyzeBtn');
const captureBtn = document.getElementById('captureBtn');
const resultsSection = document.getElementById('resultsSection');
const ticketList = document.getElementById('ticketList');
const ticketCount = document.getElementById('ticketCount');
const pushBtn = document.getElementById('pushBtn');
const statusMsg = document.getElementById('statusMsg');
const saveSettingsBtn = document.getElementById('saveSettingsBtn');

// Load saved data
async function loadSettings() {
  const data = await chrome.storage.local.get([
    'licenseKey', 'isLicensed',
    'openaiKey', 'githubToken', 'githubRepo'
  ]);
  
  if (data.licenseKey) {
    licenseKeyInput.value = data.licenseKey;
  }
  
  if (data.isLicensed) {
    isLicensed = true;
    showLicensed();
  }
  
  if (data.openaiKey) document.getElementById('openaiKey').value = data.openaiKey;
  if (data.githubToken) document.getElementById('githubToken').value = data.githubToken;
  if (data.githubRepo) document.getElementById('githubRepo').value = data.githubRepo;
}

function showLicensed() {
  licenseStatus.className = 'license-status active';
  licenseStatus.innerHTML = '<span>✓</span><span>License Active</span>';
  licenseKeyInput.parentElement.classList.add('hidden');
  activateBtn.classList.add('hidden');
}

// Activate license
activateBtn.addEventListener('click', async () => {
  const key = licenseKeyInput.value.trim();
  if (!key) return;
  
  activateBtn.textContent = 'Validating...';
  activateBtn.disabled = true;
  
  // For MVP, accept any key that looks valid
  // In production, validate against LemonSqueezy API
  if (key.length > 10) {
    await chrome.storage.local.set({ licenseKey: key, isLicensed: true });
    isLicensed = true;
    showLicensed();
  } else {
    alert('Invalid license key');
  }
  
  activateBtn.textContent = 'Activate License';
  activateBtn.disabled = false;
});

// Tabs
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    
    document.querySelectorAll('.tab-content').forEach(c => c.classList.add('hidden'));
    document.getElementById(`tab-${tab.dataset.tab}`).classList.remove('hidden');
  });
});

// Capture from page
captureBtn.addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  
  chrome.scripting.executeScript({
    target: { tabId: tab.id },
    function: captureTranscript
  }, (results) => {
    if (results && results[0] && results[0].result) {
      transcriptInput.value = results[0].result;
      document.querySelector('[data-tab="paste"]').click();
      showStatus('Transcript captured!', 'success');
    } else {
      showStatus('No transcript found on page', 'error');
    }
  });
});

function captureTranscript() {
  // Try various selectors for different platforms
  const selectors = [
    // Teams
    '[data-tid="closed-caption-text"]',
    '.ui-chat__message__content',
    // Zoom
    '.transcript-message',
    '.meeting-chat-message',
    // Meet
    '.iOzk7',
    '.CNusmb'
  ];
  
  let transcript = '';
  
  for (const selector of selectors) {
    const elements = document.querySelectorAll(selector);
    if (elements.length > 0) {
      transcript = Array.from(elements).map(el => el.textContent).join('\n');
      break;
    }
  }
  
  // Fallback: try to get any visible text
  if (!transcript) {
    const body = document.body.innerText;
    if (body.length > 100) {
      transcript = body.substring(0, 5000);
    }
  }
  
  return transcript;
}

// Analyze transcript
analyzeBtn.addEventListener('click', async () => {
  const transcript = transcriptInput.value.trim();
  const openaiKey = document.getElementById('openaiKey').value.trim();
  
  if (!transcript) {
    showStatus('Please enter a transcript', 'error');
    return;
  }
  
  if (!openaiKey) {
    showStatus('Please add your OpenAI API key in Settings', 'error');
    document.querySelector('[data-tab="settings"]').click();
    return;
  }
  
  analyzeBtn.textContent = 'Analyzing...';
  analyzeBtn.disabled = true;
  
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openaiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `Extract actionable tickets from meeting transcripts. For each item:
- type: "bug", "story", or "task"
- title: Clear, concise title
- description: Detailed description
Return JSON array only: [{"type":"bug","title":"...","description":"..."}]`
          },
          {
            role: 'user',
            content: transcript
          }
        ],
        temperature: 0.3
      })
    });
    
    const data = await response.json();
    if (data.error) throw new Error(data.error.message);
    
    const content = data.choices[0].message.content;
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      tickets = JSON.parse(jsonMatch[0]);
      renderTickets();
      resultsSection.classList.remove('hidden');
      showStatus(`Found ${tickets.length} tickets!`, 'success');
    }
  } catch (error) {
    showStatus(`Error: ${error.message}`, 'error');
  }
  
  analyzeBtn.textContent = '✨ Analyze Transcript';
  analyzeBtn.disabled = false;
});

function renderTickets() {
  ticketCount.textContent = tickets.length;
  ticketList.innerHTML = tickets.map((t, i) => `
    <div class="ticket-item">
      <span class="ticket-type ${t.type}">${t.type}</span>
      <strong>${t.title}</strong>
    </div>
  `).join('');
}

// Push to GitHub
pushBtn.addEventListener('click', async () => {
  const token = document.getElementById('githubToken').value.trim();
  const repo = document.getElementById('githubRepo').value.trim();
  
  if (!token || !repo) {
    showStatus('Please configure GitHub in Settings', 'error');
    document.querySelector('[data-tab="settings"]').click();
    return;
  }
  
  pushBtn.textContent = 'Pushing...';
  pushBtn.disabled = true;
  
  let created = 0;
  for (const ticket of tickets) {
    try {
      const response = await fetch(`https://api.github.com/repos/${repo}/issues`, {
        method: 'POST',
        headers: {
          'Authorization': `token ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          title: ticket.title,
          body: ticket.description + '\n\n---\n*Created by StoryScribe*',
          labels: [ticket.type]
        })
      });
      
      if (response.ok) created++;
      await new Promise(r => setTimeout(r, 300));
    } catch (e) {
      console.error(e);
    }
  }
  
  showStatus(`Created ${created}/${tickets.length} issues!`, 'success');
  pushBtn.textContent = '🚀 Push to GitHub';
  pushBtn.disabled = false;
});

// Save settings
saveSettingsBtn.addEventListener('click', async () => {
  await chrome.storage.local.set({
    openaiKey: document.getElementById('openaiKey').value,
    githubToken: document.getElementById('githubToken').value,
    githubRepo: document.getElementById('githubRepo').value
  });
  showStatus('Settings saved!', 'success');
});

function showStatus(msg, type) {
  statusMsg.textContent = msg;
  statusMsg.className = `status-msg ${type}`;
  statusMsg.classList.remove('hidden');
  setTimeout(() => statusMsg.classList.add('hidden'), 3000);
}

// Init
loadSettings();

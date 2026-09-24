// Toolbar popup: On or Pause. Options page comes in milestone 6.
const status = document.getElementById('status');
const toggle = document.getElementById('toggle');

function render(enabled) {
  status.textContent = enabled
    ? 'On. Mae checks each reply when you press Send.'
    : 'Paused. Replies send without a check.';
  toggle.textContent = enabled ? 'Pause' : 'Turn on';
  toggle.disabled = false;
}

chrome.storage.local.get('enabled').then(({ enabled = true }) => {
  render(enabled);
  toggle.addEventListener('click', async () => {
    const next = toggle.textContent !== 'Pause';
    toggle.disabled = true;
    await chrome.storage.local.set({ enabled: next });
    render(next);
  });
});

document.getElementById('options').addEventListener('click', (e) => {
  e.preventDefault();
  chrome.runtime.openOptionsPage();
});

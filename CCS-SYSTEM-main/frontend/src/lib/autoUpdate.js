/**
 * Auto-update checker for detecting when new application code is deployed
 * Checks version.json regularly and auto-reloads if a new version is detected
 */

let lastVersion = null;
let checkCount = 0;

export function initAutoUpdate() {
  // Check immediately
  checkForUpdates();
  
  // Check frequently at first (every 5 seconds for first 12 checks = 60 seconds)
  // Then slow down to every 30 seconds
  setInterval(checkForUpdates, 5000);
  
  setTimeout(() => {
    // After 60 seconds, switch to slower interval
    setInterval(checkForUpdates, 30000);
  }, 60000);
}

async function checkForUpdates() {
  try {
    const response = await fetch('/version.json?t=' + Date.now(), {
      method: 'GET',
      cache: 'no-store',
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    });

    if (!response.ok) {
      console.debug('Version check failed:', response.status);
      return;
    }

    const versionData = await response.json();
    const currentVersion = versionData.timestamp;

    if (lastVersion === null) {
      // First check, just store the value
      lastVersion = currentVersion;
      return;
    }

    // If version changed, new code is deployed
    if (currentVersion && currentVersion !== lastVersion) {
      console.log('🔄 New app version detected, reloading...', {
        old: lastVersion,
        new: currentVersion,
      });
      lastVersion = currentVersion;
      
      // Reload the page after a short delay to ensure new assets are available
      setTimeout(() => {
        window.location.reload();
      }, 500);
    }
  } catch (error) {
    // Silently fail - don't spam console
    console.debug('Update check error:', error.message);
  }
}


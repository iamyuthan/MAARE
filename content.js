// 1. Initial Injection & Load
chrome.storage.local.get(['burpRules'], function(result) {
    const rules = result.burpRules || [];

    const script = document.createElement('script');
    script.src = chrome.runtime.getURL('injected.js');
    script.onload = function() {
        // Send rules array once the script initializes
        window.postMessage({ action: 'SET_RULES', rules: rules }, '*');
        this.remove(); 
    };
    (document.head || document.documentElement).appendChild(script);
});

// 2. Listen for live updates from the Popup window
chrome.storage.onChanged.addListener(function(changes, namespace) {
    if (namespace === 'local' && changes.burpRules) {
        // Instantly push the new rules array to the injected script
        window.postMessage({ action: 'SET_RULES', rules: changes.burpRules.newValue }, '*');
    }
});
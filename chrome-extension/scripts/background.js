chrome.runtime.onInstalled.addListener(() => {
    console.log("Extension Installed");
});

// Listen for message from popup.js
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
	if (message.action === "scrape") {
		console.log("Message received in background.js:", message);

		// Get the current active tab
		chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
			// Send message to content script running in the current active tab. Note that tabs[0] is the active tab
			chrome.tabs.sendMessage(tabs[0].id, { action: "scrape" }, (response) => {
				// Respond back to the popup.js after receiving data from content script
				if (response) {
					sendResponse({ success: true, data: response.productData });
				} else {
					sendResponse({ success: false, message: "No data received from content script." });
				}
			});
		});
		
		// Tells Chrome to wait for sendResponse so the 'message port' does not close automatically
		return true;
	}
});




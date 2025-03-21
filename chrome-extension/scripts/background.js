chrome.runtime.onInstalled.addListener(() => {
    console.log("Extension Installed");
});

// Listen for message from popup.js
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
	if (message.action === "scrape") {
		console.log("Message received in background.js:", message);

		// Get the current active tab
		chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
			const url = tabs[0].url; // active tab's url

			// Check if URL is valid on an allowed website (Amazon)
			if (url.includes("amazon.com")) {

				// Send message to content script running in the current active tab. 
				// Note that tabs[0] is the active tab's id
				chrome.tabs.sendMessage(tabs[0].id, { action: "scrape" }, (response) => {
					// Respond back to the popup.js after receiving data from content script
					if (response) {
						// If content.js sends valid data
						sendResponse({ success: true, data: response.productData });
						sendDataToBackend(response.productData);
					} else {
						// If no data received from content.js
						sendResponse({ success: false, message: "No data received from content script." });
					}
				});
			} else { 
				// alertUser("This extension is not supported on this website.");
				// should update the extension UI 
			}
			
		});
		
		// Tells Chrome to wait for sendResponse so the 'message port' does not close automatically
		return true;
	}
});

async function sendDataToBackend(productData) {
	console.log("I'll come back to it another time ☺️")
}

function alertUser(message) {
	// TODO
}





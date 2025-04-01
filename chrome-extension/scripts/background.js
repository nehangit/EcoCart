chrome.runtime.onInstalled.addListener(() => {
    console.log("Extension Installed");
});

// Listen for message from popup.js
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
	if (message.action === "scrape") {
		console.log("Message received in background.js:", message);

		// Get the current active tab
		chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
			if (!tabs.length) {
				sendError("No active tab found.");
				return sendResponse({ success: false, message: "No active tab found."});
			}
		
			let tabId = tabs[0].id // active tab's id
			let tabUrl = tabs[0].url // active tabs url

			// Check if the website is supported by the extension.
			if (!isSupportedWebsite(tabUrl)) {
				sendError("This extension is not supported on this website.");
				return sendResponse({ success: false, message: "This extension is not supported on this website." });
			}
			
			// Inject content script before sending a message
			chrome.scripting.executeScript({
				target: { tabId: tabId }, // The tab where the script is injected
				files: ["scripts/content.js"] // The script being injected
			}, () => {
				if (chrome.runtime.lastError) {
					sendError("Failed to inject content script.");
					return sendResponse({ success: false, message: "Failed to inject content script." });
				}
				console.log("Content script injected successfully.");

				chrome.tabs.sendMessage(tabId, { action: "scrape" }, (response) => {
					// Bad response from content.js
					if (!response) {
						sendError("Could not retrieve product data. Please try again.")
						return sendResponse({ success: false, message: "Could not retrieve product data. Please try again."})
					}
					
					// Send success response to popup.js
					sendResponse({ success: true, data: response.productData });
					
					// Send data to backend
					sendDataToBackend(response.productData).then((result) => {
						// Do something else with result, but just log it for now
						console.log("Data successfully sent to backend ", result);
					}).catch((error) => {
						sendError("Failed to send data to backend. Please try again.")
						
					});
				});
			});
		});
		// Tells Chrome to wait for sendResponse so the 'message port' does not close automatically
		return true;
	}
});

async function sendDataToBackend(productData) {
	const url = "http://localhost:5000/receive-data"; // Set to local host
	try {
		console.log("Sending data to backend...", productData)
		// Asynchronous request to backend
		const response = await fetch(url, {
			method: "POST",
			headers: {"Content-type": "application/json"}, // Set content type to JSON
			body: JSON.stringify(productData)
		});

		if(!response.ok) {
			throw new Error(`Failed to send data ${response.statusText}`);
		}

		// Parse the response and return it to backend
		const data = await response.json();
		return data // Return the response from backend
	} catch(error) {
		console.error("Error sending data to backend: ", error);
		throw error // Throw the error for handling by the caller 
	}
}

function isSupportedWebsite(url) {
	const supportedWebsites = ["amazon.com"]
	return supportedWebsites.some(domain => url.includes(domain))
}

function notifyUser(message) {
	chrome.notifications.create({
		type: "basic",
		iconUrl: chrome.runtime.getURL("images/icon.png"),
		title: "Error encountered :(",
		message: message,
		priority: 2
	});
}

function sendError(message) {
	console.error(message);
	notifyUser(message);
}





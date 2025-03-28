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
						// Send success response to popup.js
						sendResponse({ success: true, data: response.productData });
						
						// Send data to backend
						sendDataToBackend(response.productData).then((result) => {
							// Do something else with result, but just log it for now
							console.log("Data successfully sent to backend ", result);
						}).catch((error) => {
							console.error("Error sending data to backend: ", error);
						}); 

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

function alertUser(message) {
	// TODO
}





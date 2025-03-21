// Listens for messages from background.js
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
	console.log("Received message in content.js:", message);

	if (message.action === "scrape") {
		console.log("Scrape action received. Extracting product data...");
		
		let product = {};

		// Get product name 
		product.name = document.getElementById("productTitle")?.textContent.trim() || null;

		// Get brand name 
		product.brand = document.getElementById("bylineInfo")?.textContent.trim() || null;

		// Get product facts (Information under "product-facts-title")
		product.facts = {};

		// Select all <li> elements (these have the fact-values)
		let listItems = document.querySelectorAll("ul.a-nostyle > li");
		listItems.forEach(item => {

			// Select the 'fact' (key) and 'value' from within the <li>
			let key = item.querySelector("div.a-col-left span.a-color-base")?.textContent.trim() || null;
			let value = item.querySelector("div.a-col-right")?.textContent.trim() || null;

			// Add the key-value pair to the facts object
			if (key) {product.facts[key] = value;}
		});

		console.log("Extracted product data:", product);

		// Send the extracted data back to background.js
		sendResponse({ productData: product });
	}
});




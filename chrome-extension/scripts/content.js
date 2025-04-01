// Check if there is already a listener in the window
if (!window.hasContentScriptListener) {
	window.hasContentScriptListener = true;

	// Listens for messages from background.js
	chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
		console.log("Received message in content.js:", message);

		if (message.action === "scrape") {
			console.log("Scrape action received. Extracting product data...");
			
			let product = scrapeAmazonProduct(sendResponse);
			console.log("Extracted product data:", product);

			// Send the extracted data back to background.js
			sendResponse({ productData: product });

			return true;
		}
	});
}

function scrapeAmazonProduct(sendResponse) {
	let product = {};

	// Get product name 
	product.name = document.getElementById("productTitle")?.textContent.trim() || null;

	// Get brand name 
	let brand = document.getElementById("bylineInfo")?.textContent.trim() || null;
	product.brand = (brand) ? brand.replace(/^(?:Brand:\s*|Visit the )?(.*?)(?: Store)?$/i, "$1").trim() : null;
	
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
	
	return product;
}

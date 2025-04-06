// Check if there is already a listener in the window
if (!window.hasContentScriptListener) {
	window.hasContentScriptListener = true;

	// Listens for messages from background.js
	chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
		console.log("Received message in content.js:", message);

		if (message.action === "scrape") {
			console.log("Scrape action received. Extracting product data...");
			
			let product = scrapeAmazonProduct();
			console.log("Extracted product data:", product);

			// Send the extracted data back to background.js
			sendResponse({ productData: product });

			return true; // Keep message port open for the response
		}
	});
}

function scrapeAmazonProduct() {
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

	// Get the "About this item" section
	let aboutBullets = [];
	let aboutHeader = Array.from(document.querySelectorAll("h3.product-facts-title"))
										.find(ele => ele.textContent.trim().toLowerCase().includes("about this item"));
	if (aboutHeader) {
		const ul = aboutHeader.nextElementSibling;
		// Check the sibling exists and is actually an <ul> element
		if (ul && ul.tagName === "UL") {
			const listItems = ul.querySelectorAll("li span.a-list-item");
			aboutBullets = Array.from(listItems).map(span => span.textContent.trim()) || null;
		}
	}
	product.about = aboutBullets;

	// Get the "Product Description" section
	let descriptionEle = document.querySelector("#productDescription span");
	product.description = descriptionEle?.textContent.trim() || null;
	
	// TODO Check for a sustainable features section
	product.sustainableKeyword = containsSustainableKeyword(product) || false;

	return product;
}

function containsSustainableKeyword(product) {
	// By no means is this an exhaustive list. Find a better way obviously
	const sustainableWords = [
		"biodegradable", "compostable", "organic",
		"bioplastics",
		"carbon neutral", "carbon offsetting",
		"ethically sourced", "responsibly sourced",
		"plant-based", "vegan", "vegetarian",
		"recyclable", "recycled", "renewable", "renewed", "reusable", "reused",
		"reclaimed", "responsible", "upcycling", "upcycled",
		"sustainable", "sustainability",
		"eco-conscious", "eco-friendly", "eco",
		"environmentally conscious", "environmentally friendly", "earth-conscious", "planet-friendly",
		"non-toxic",
		"fair trade",
		"zero-waste", "resource-efficient",
		"clean energy", "energy efficient"
	];

	// Generates a list of matching regexes to each keyword.
	const keyWordRegexes = sustainableWords.map(word => {
		// Replace all matches of dashes '-' or whitespaces with regex pattern [-\s] 
		// i.e. 'eco-friendly becomes eco[-\s]friendly, so eco friendly also matches
		const pattern = word.toLowerCase().replace(/[-\s]/g, '[-\\s]?'); 
		// Returns a case sensitive match with word boundaries 
		// i.e. \\bgreen\\b is matched with green but not evergreen or greenhouse
		return new RegExp(`\\b${pattern}\\b`, 'i');
	});

	// Replaces anything NOT a word character or whitespace (i.e. punctuation and underscores)
	const combinedText = JSON.stringify(product).replace(/[^\w\s]|_/g, "").toLowerCase();
	// Checks for matching regex in the product text
	const hasKeyWords = keyWordRegexes.some(regex => regex.test(combinedText));
	
	return hasKeyWords;
}
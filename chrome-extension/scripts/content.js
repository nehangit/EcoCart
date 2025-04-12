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

/**
 * Retrieves all the relevant amazon product data from the current webpage.
 * @returns {object}
 */
function scrapeAmazonProduct() {
	const product = {};

	// Get product name 
	product.name = document.getElementById("productTitle")?.textContent.trim() || null;

	// Get brand name 
	let brand = document.getElementById("bylineInfo")?.textContent.trim() || null;
	product.brand = (brand) ? brand.replace(/^(?:Brand:\s*|Visit the )?(.*?)(?: Store)?$/i, "$1").trim() : null;
	
	// Get product facts (Information under "product-facts-title")
	product.facts = getFactsSection();

	// Get the "About this item" section
	product.about = getAboutSection();

	// Get the "Product Description" section
	let descriptionEle = document.querySelector("#productDescription span");
	product.description = descriptionEle?.textContent.trim() || null;

	// Get the feature bullets section. Section rarely appears and usually only when the other info sections are missing
	product.featureBullets = getFeatureBullets();
	if (product.featureBullets) fillInInfoFromFeatureBullets(product.featureBullets, product);

	// TODO Check for a sustainable features section (if there is time).

	// Checks for "recycle" and "reuse" keywords and adds these values to product
	const { hasRecycle, hasReuse } = containsRecycleAndReuseKeyword(product);
	product.recycled = hasRecycle;
	product.reused = hasReuse;

	return product;
}

/**
 * Retrieves data from the "Product details" section and wraps it in an object.
 * @returns {object} 
 */
function getFactsSection() {
	const facts = {};

	// Select all <li> elements (these have the fact-values)
	let listItems = document.querySelectorAll("ul.a-nostyle > li");
	listItems.forEach(item => {

		// Select the 'fact' (key) and 'value' from within the <li>
		let key = item.querySelector("div.a-col-left span.a-color-base")?.textContent.trim() || null;
		let value = item.querySelector("div.a-col-right")?.textContent.trim() || null;

		// Add the key-value pair to the facts object
		if (key) {facts[key] = value;}
	});
	return facts;
}

/**
 * Retrieves the text from the "About this item" section and puts it an array.
 * @returns {object}
 */
function getAboutSection() {
	let aboutBullets = [];
	const aboutHeader = Array.from(document.querySelectorAll("h3.product-facts-title"))
										.find(ele => ele.textContent.trim().toLowerCase().includes("about this item"));
	if (aboutHeader) {
		const ul = aboutHeader.nextElementSibling;
		// Check the sibling exists and is actually an <ul> element
		if (ul && ul.tagName === "UL") {
			const listItems = ul.querySelectorAll("li span.a-list-item");
			aboutBullets = Array.from(listItems).map(span => span.textContent.trim()) || null;
		}
	}
	return aboutBullets;
}

/**
 * Gets data from an untitled section about the product. This section is rare and usually appears when the
 * other information sections are not present.
 * @returns {object}
 */
function getFeatureBullets() {
	const bulletNodes = Array.from(document.querySelectorAll("#feature-bullets ul li span.a-list-item"));
		if (!bulletNodes || bulletNodes.length === 0) {
			console.log("No feature bullets found.");
			return null;
		}
	const cleanBullets = bulletNodes.map(ele => ele.textContent.trim()).filter(text => text.length > 0);

	// Captures percentages (if they exist) as well the actual material name
	const fabricRegex = /\b(?:\d{1,3}%\s*)?(cotton|polyester|spandex|nylon|rayon|wool|silk|linen|hemp|jute|leather|acrylic|viscose|denim|elastane)\b/i;
	// Captures machine wash, hand wash, dry clean, tumble dry, line dry, with dashes or spaces between the words. And captures do no bleach
	const careRegex = /\b(machine[\s-]?wash(?:able)?|hand[\s-]?wash(?: only)?|dry[\s-]?clean(?: only)?|tumble[\s-]?dry|line[\s-]?dry|do not bleach)\b/i;
	// Captures phrases like made in {country} and the word imported
	const originRegex = /\b(made in [a-z\s]+|imported)\b/i;

	const info = {
		fabric: [],
		care: [],
		origin: [],
		other: []
	};

	cleanBullets.forEach(bullet => {
		// Replaces anything not a word character, whitespace, %, or -
		const cleanText = bullet.replace(/[^\w\s%-]/gi, "").toLowerCase();

		const fabricMatch = cleanText.match(fabricRegex);
		const careMatch = cleanText.match(careRegex);
		const originMatch = cleanText.match(originRegex);

		if (fabricMatch) {
			info.fabric.push(fabricMatch[0]); // Push only the % and fabric that matched
		} else if (careMatch) {
			info.care.push(careMatch[0]); // Push only the phrase that matched
		} else if (originMatch) {
			info.origin.push(originMatch[0]); // Push only the phrase that matched
		} else {
			info.other.push(bullet);
		}
	});

	return info;
}

/**
 * If the product facts are empty, then fill them with information collected from feature bullets (if any)
 * @param {object} featureBullets 
 * @param {object} product 
 */
function fillInInfoFromFeatureBullets(featureBullets, product) {
	if (featureBullets.fabric.length > 0) product.facts["Fabric type"] = featureBullets.fabric;
	if (featureBullets.care.length > 0) product.facts["Care instructions"] = featureBullets.care;
	if (featureBullets.origin.length > 0) product.facts["Country of origin"] = featureBullets.origin;
}

/**
 * Checks for "recycle" and "reuse" keywords in the product text.
 * @param {object} product 
 * @returns {object}
 */
function containsRecycleAndReuseKeyword(product) {
	const recycleWords = [ "recycle", "recyclable", "recycled" ];
	const reuseWords = [ "reuse", "reusable", "reused" ];
	
	// Generates a list of matching regexes to each keyword.
	const createRegexes = wordArray =>
		wordArray.map(word => {
		// Replace all matches of dashes '-' or whitespaces with regex pattern [-\s] 
		// i.e. 'eco-friendly becomes eco[-\s]friendly, so eco friendly also matches
		const pattern = word.toLowerCase().replace(/[-\s]/g, '[-\\s]?'); 
		// Returns a case sensitive match with word boundaries 
		// i.e. \\bgreen\\b is matched with green but not evergreen or greenhouse
		return new RegExp(`\\b${pattern}\\b`, 'i');
	});

	const recycleRegexes = createRegexes(recycleWords);
	const reuseRegexes = createRegexes(reuseWords);

	// Take the product object and turn it into a single string
	// Replaces anything NOT a word character or whitespace (i.e. punctuation and underscores)
	const combinedText = JSON.stringify(product).replace(/[^\w\s]|_/g, "").toLowerCase();

	// Checks for matching regex in the product text
	const hasRecycle = recycleRegexes.some(regex => regex.test(combinedText));
	const hasReuse = reuseRegexes.some(regex => regex.test(combinedText));
	
	return { hasRecycle, hasReuse };
}
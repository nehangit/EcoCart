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
	
	// Get clothing type
	product.type = (product.name) ? getClothingType(product.name) : null;
	
	// Get brand name 
	let brand = document.getElementById("bylineInfo")?.textContent.trim() || null;
	product.brand = (brand) ? brand.replace(/^(?:Brand:\s*|Visit the )?(.*?)(?: Store)?$/i, "$1").trim() : null;
	
	// Get product facts (Information under "product-facts-title")
	product.facts = getFactsSection();

	// Get the "About this item" section
	product.about = getAboutSection();

	// Get the feature bullets section. Section rarely appears and usually only when the other info sections are missing
	product.featureBullets = getFeatureBullets();
	if (product.featureBullets) fillInInfoFromFeatureBullets(product.featureBullets, product);

	// Get the "Product Description" section
	let descriptionEle = document.querySelector("#productDescription span");
	product.description = descriptionEle?.textContent.trim() || null;

	// TODO Check for a sustainable features section (if there is time).

	// Checks for "recycle" and "reuse" keywords and adds these values to product
	const { hasRecycle, hasReuse } = containsRecycleAndReuseKeyword(product);
	product.recycled = hasRecycle;
	product.reused = hasReuse;

	// Get the wash and dry instruction keys for the product
	if (product.facts["Care instructions"]) {
		const { washInstruction, dryInstruction } = refineCareInstructions(product.facts["Care instructions"]);
		product.washInstr = washInstruction;
		product.dryInstr = dryInstruction;
	} else {
		product.washInstr = null;
		product.dryInstr = null;
	}
	
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

/**
 * Returns the str with escaped (treated literally) special regex characters
 * @param {string} str 
 * @returns {string}
 */
function escapeRegex(str) {
	return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Creates a flexible regex from some text. Allows for variations with -, _, \s
 * @param {string} text 
 * @returns {RegExp} 
 */
function makeFlexibleRegex(text) {
	// Escape special regex characters
	const escaped = escapeRegex(text);

	// Replace one or more whitespaces with a pattern that allows spaces, dashes, or underscores
	const flexiblePattern = escaped.replace(/\s+/g, '[-_\\s]+');

	// Determin the correct plural suffix
	let suffix;
	if (/(ch|sh|[sxz]|ss)$/i.test(text)) {
    suffix = "(?:es)?";
  } else {
    suffix = "(?:s)?";
  }

	// Wrap the regex in word boundaries and make it case sensitive. Optional suffix for plurals
	return new RegExp(`\\b${flexiblePattern}${suffix}\\b`, 'i');
}

/**
 * Returns the first match for a given mapping
 * @param {Array<object>} mapping - An array where each object has property "keys" and a "value"
 * @param {string} text - Input text to search for a match from
 * @returns {string|null} The value of the first matched entry or null if no matches were found.
 */
function getMatches(mapping, text) {
	// Loop over each key(s)-value entry of the mapping
	for (const entry of mapping) {
		for (const key of entry.keys) {
			const regex = makeFlexibleRegex(key);
			if (regex.test(text)){
				return entry.value; // NOTE: This approach only finds the first wash instruction
			}
		}
	}
	return null;
}

/**
 * Looks at the text for matching care instructions to care instructions defined in the model.
 * @param {string} careInstructionText 
 * @returns {object} An object that has two keys, a dry and wash instruction string.
 */
function refineCareInstructions(careInstructionText) {
	// The keys represent phrases that should map to a specified value
	const washInstructionMap = [
		{ keys: ["machine wash cold", "machine washable", "machine wash", "wash cold"], value: "Machine wash_ cold" },
		{ keys: ["machine wash hot", "wash hot"], value: "Machine wash_ hot" },
		{ keys: ["machine wash warm", "wash warm"], value: "Machine wash_ warm" },
		{ keys: ["dry clean"], value: "Dry clean" },
		{ keys: ["hand wash"], value: "Hand wash"}
	];
	const dryInstructionMap = [
		{ keys: ["line dry", "air dry", "lay flat to dry"], value: "Line dry" },
		{ keys: ["tumble dry low", "tumble dry", "dryer", "machine dry", "machine dryable"], value: "Tumble dry_ low"}, 
		{ keys: ["tumble dry medium, tumble dry high"], value: "Tumble dry_ medium" },
		{ keys: ["dry clean"], value: "Dry clean" }
	];

	let washInstruction = getMatches(washInstructionMap, careInstructionText);
	let dryInstruction = getMatches(dryInstructionMap, careInstructionText); 
	
	return { washInstruction, dryInstruction };
} 

function getClothingType(productName) {
	// Entries are arbitrarily ranked by specificity. This is NOT an exhaustive list.
	const typeKeywords = [
		{ keys: ["blouse"], 
			value: "blouse" },
		{ keys: ["jeans", "denim"], 
			value: "jeans" },
		{ keys: [
				"jacket", "blazer", "windbreaker", "parka", "anorak",
				"coat", "overcoat", "trench coat",
				"hoodie", "hooded sweatshirt", "sweatshirt",
				"vest", "suit", "business suit", "blazer suit", "tuxedo"
			], 
			value: "jacket" },
		{ keys: ["skirt", "miniskirt", "maxiskirt"], 
			value: "skirt" },
		{ keys: ["sweater", "jumper", "cardigan"], 
			value: "sweater" },
		{ keys: ["dress", "gown", "dress", "one-piece", "jumpsuit", "overalls"], 
			value: "dress" },
		{ keys: ["t-shirt", "tshirt", "tee", "tee shirt", "graphic tee", "v-neck tee",
			"tank top", "sleeveless top"],
			value: "t‑shirt" },
		{ keys: ["shirt", "button-down shirt", "button up", "collared shirt", "dress shirt"], 
			value: "shirt" },
		{ keys: ["trousers", "pants", "slacks", "leggings", "sweatpants", "jogger"], 
			value: "trousers" },
		{ keys: ["short", "cutoffs"], 
			value: "short" },
	];
	let type = getMatches(typeKeywords, productName);
	if (!type) type = "shirt"; // If no matches are found just default to "shirt"
	return type;
}
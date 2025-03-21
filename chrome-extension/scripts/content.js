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
				 let factsSection = document.querySelector(".product-facts-title");
				 if (factsSection) {
						 let factsList = factsSection.nextElementSibling; // Assuming details are in the next sibling element
						 if (factsList) {
								 product.facts = Array.from(factsList.querySelectorAll("li")).map(li => li.textContent.trim()).join(" | ");
						 } else {
								 product.facts = null;
						 }
				 } else {
						 product.facts = null;
				 }

        console.log("Extracted product data:", product);

        // Send the extracted data back to background.js
				sendResponse({ productData: product });
    }
});




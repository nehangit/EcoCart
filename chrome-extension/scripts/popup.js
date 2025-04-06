document.getElementById("button").addEventListener("click", () => {
  console.log("Popup button clicked!");

  // Send message to background script
  chrome.runtime.sendMessage({ action: "scrape" }, (response) => {
    if (chrome.runtime.lastError) {
      console.error("Error message:", chrome.runtime.lastError.message);
    } else {
      console.log("Message sent to background.js: ", response);
    }
  });
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "updateProduct") {
    const productData = message.data;
    
    document.getElementById("product-name").textContent = productData.name;
    console.log("Updated product name: ", productData.name);
  }
});

function renderProcessingState() {

}

function renderErrorState() {

}

function renderSuccessState() {
  
}


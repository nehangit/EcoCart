document.getElementById("button").addEventListener("click", () => {
  console.log("Popup button clicked!");

  // Send message to background script
  chrome.runtime.sendMessage({ action: "scrape" }, (response) => {
    if (chrome.runtime.lastError) {
      console.error("Error message:", chrome.runtime.lastError.message);
    } else {
      console.log("Message sent to background.js", response);
    }
  });
});


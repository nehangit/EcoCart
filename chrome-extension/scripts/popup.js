document.getElementById("button").addEventListener("click", () => {
  console.log("Popup button clicked!");
  setPopupState("state-processing"); // Show loading UI

  // Send message to background script
  chrome.runtime.sendMessage({ action: "scrape" }, (response) => {

    if (!response || response.success === false) {
      // Initial response resulted in failure so update to error state
      let errorMsg = response ? response.message : "Unknown error"; 
      document.getElementById("state-error").textContent = "😥 Error: " + errorMsg;
      setPopupState("state-error");
      return;
    } else {
      // Update processing state with product name
      document.getElementById("product-name-processing").textContent = response.data.name;
      console.log("Inital scrape response received: ", response);

      // Will stay in processing state until a backend update arrives
    }
  });
});

// Listens for final update messages from background
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "updateProduct") {
    document.getElementById("product-name-success").textContent = message.name; // Refill in the name

    // Successful backend response, update with yes/no on the product sustainability
    const sustainableBool = message.data;
    if (sustainableBool === true) {
      document.getElementById("sustainable-bool").textContent = "✅YES✅";
      document.getElementById("sustainable-bool").style.color = "green";
    } else if (sustainableBool === false) {
      document.getElementById("sustainable-bool").textContent = "❌NO❌";
      document.getElementById("sustainable-bool").style.color = "red";
    }
    setPopupState("state-success")
  } else if (message.action === "backendError") {
    // Error occurred between sending data to, or processing, in backend; update popup to error state
    const errorMsg = message.message;
    document.getElementById("state-error").textContent = "😥 Error: " + errorMsg;
    setPopupState("state-error");
  }
});

function setPopupState(stateId) {
  const states = document.querySelectorAll(".state"); // Get all the state containers
  states.forEach(state => state.classList.remove("active")); // Remove active class from all the containers

  const activeState = document.getElementById(stateId);
  if (activeState) {
    activeState.classList.add("active");
  } else {
    console.error(`State with id ${stateId} not found.`);
  }
}


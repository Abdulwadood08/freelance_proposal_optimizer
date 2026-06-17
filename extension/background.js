chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.set({
    backendBaseUrl: "http://localhost:8000",
    preferredTone: "professional"
  });
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "PING") {
    sendResponse({ ok: true });
  }
});

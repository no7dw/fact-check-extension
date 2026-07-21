const apiKeyInput = document.getElementById("apiKey");
const modelInput = document.getElementById("model");
const endpointInput = document.getElementById("endpoint");
const statusEl = document.getElementById("status");

async function loadSettings() {
  const settings = await chrome.storage.local.get(["openaiApiKey", "openaiModel", "openaiEndpoint"]);
  apiKeyInput.value = settings.openaiApiKey || "";
  modelInput.value = settings.openaiModel || "gpt-4.1-mini";
  endpointInput.value = settings.openaiEndpoint || "https://api.openai.com/v1/responses";
}

async function saveSettings() {
  await chrome.storage.local.set({
    openaiApiKey: apiKeyInput.value.trim(),
    openaiModel: modelInput.value.trim() || "gpt-4.1-mini",
    openaiEndpoint: endpointInput.value.trim() || "https://api.openai.com/v1/responses"
  });
  statusEl.textContent = "Saved.";
}

async function clearKey() {
  await chrome.storage.local.remove("openaiApiKey");
  apiKeyInput.value = "";
  statusEl.textContent = "API key cleared.";
}

document.getElementById("save").addEventListener("click", saveSettings);
document.getElementById("clear").addEventListener("click", clearKey);
loadSettings();

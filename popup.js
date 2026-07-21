const TEST_URL = "https://mp.weixin.qq.com/s/JQXlB5QNuQc98XL8Ytu8kQ";

const statusEl = document.getElementById("status");
const sourceUrlEl = document.getElementById("sourceUrl");
const keyWarningEl = document.getElementById("keyWarning");

function setStatus(message) {
  statusEl.textContent = message;
}

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

async function checkKey() {
  const { openaiApiKey } = await chrome.storage.local.get("openaiApiKey");
  keyWarningEl.hidden = Boolean(openaiApiKey);
  return Boolean(openaiApiKey);
}

async function analyzeCurrentPage() {
  const hasKey = await checkKey();
  if (!hasKey) {
    chrome.runtime.openOptionsPage();
    return;
  }

  const tab = await getActiveTab();
  if (!tab?.id) {
    setStatus("No active tab found.");
    return;
  }

  setStatus("Analyzing current page...");
  const response = await chrome.runtime.sendMessage({
    type: "CEL_ANALYZE_TAB",
    tabId: tab.id
  });
  setStatus(response?.ok ? "Highlights injected into the page." : response?.error || "Analysis failed.");
}

async function openTestUrl() {
  const url = sourceUrlEl.value.trim() || TEST_URL;
  await chrome.tabs.create({ url });
  setStatus("Opened test URL. Click Analyze current page after it loads.");
}

async function analyzeUrl() {
  const hasKey = await checkKey();
  if (!hasKey) {
    chrome.runtime.openOptionsPage();
    return;
  }

  const url = sourceUrlEl.value.trim() || TEST_URL;
  setStatus("Fetching and analyzing URL text...");
  const response = await chrome.runtime.sendMessage({
    type: "CEL_ANALYZE_URL",
    url
  });

  if (!response?.ok) {
    setStatus(response?.error || "URL analysis failed. Open the page and use current-page analysis.");
    return;
  }

  const tab = await chrome.tabs.create({ url });
  chrome.tabs.onUpdated.addListener(function listener(tabId, info) {
    if (tabId !== tab.id || info.status !== "complete") return;
    chrome.tabs.onUpdated.removeListener(listener);
    chrome.runtime.sendMessage({
      type: "CEL_APPLY_TO_TAB",
      tabId: tab.id,
      analysis: response.analysis
    });
  });
  setStatus("Analyzed URL. Opening page and applying highlights.");
}

document.getElementById("analyzePage").addEventListener("click", analyzeCurrentPage);
document.getElementById("openTestUrl").addEventListener("click", openTestUrl);
document.getElementById("analyzeUrl").addEventListener("click", analyzeUrl);
document.getElementById("optionsButton").addEventListener("click", () => chrome.runtime.openOptionsPage());

checkKey();

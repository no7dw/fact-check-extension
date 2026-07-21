const DEFAULT_MODEL = "gpt-4.1-mini";
const DEFAULT_ENDPOINT = "https://api.openai.com/v1/responses";

chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false }).catch(() => {});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleMessage(message, sender).then(sendResponse).catch((error) => {
    sendResponse({ ok: false, error: error.message || String(error) });
  });
  return true;
});

async function handleMessage(message) {
  if (message.type === "CEL_ANALYZE_TAB") {
    return analyzeTab(message.tabId);
  }

  if (message.type === "CEL_ANALYZE_URL") {
    const page = await fetchUrlText(message.url);
    const analysis = await analyzeText(page);
    return { ok: true, analysis };
  }

  if (message.type === "CEL_APPLY_TO_TAB") {
    await applyAnalysisToTab(message.tabId, message.analysis);
    return { ok: true };
  }

  if (message.type === "CEL_CLAIM_SELECTED") {
    await chrome.storage.session?.set({ celSelectedClaim: message.claim });
    await chrome.runtime.sendMessage({ type: "CEL_SELECT_CLAIM", claim: message.claim }).catch(() => {});
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.windowId) await chrome.sidePanel.open({ windowId: tab.windowId });
    return { ok: true };
  }

  return { ok: false, error: "Unknown message type." };
}

async function analyzeTab(tabId) {
  await ensureContentScript(tabId);
  const extraction = await chrome.tabs.sendMessage(tabId, { type: "CEL_EXTRACT_PAGE" });
  if (!extraction?.ok || !extraction.page?.text) {
    throw new Error("Could not extract readable text from this page.");
  }

  const analysis = await analyzeText(extraction.page);
  await applyAnalysisToTab(tabId, analysis);

  const tab = await chrome.tabs.get(tabId);
  if (tab?.windowId) await chrome.sidePanel.open({ windowId: tab.windowId });
  return { ok: true, analysis };
}

async function applyAnalysisToTab(tabId, analysis) {
  await ensureContentScript(tabId);
  await chrome.tabs.sendMessage(tabId, {
    type: "CEL_APPLY_ANALYSIS",
    analysis
  });
}

async function ensureContentScript(tabId) {
  try {
    await chrome.tabs.sendMessage(tabId, { type: "CEL_EXTRACT_PAGE" });
  } catch {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ["content_script.js"]
    });
    await chrome.scripting.insertCSS({
      target: { tabId },
      files: ["overlay.css"]
    });
  }
}

async function fetchUrlText(url) {
  const response = await fetch(url, { credentials: "omit" });
  if (!response.ok) throw new Error(`Fetch failed: HTTP ${response.status}`);
  const html = await response.text();
  const title = (html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || url)
    .replace(/\s+/g, " ")
    .trim();
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s{2,}/g, " ")
    .trim();
  return { url, title, text: `${title}\n\n${text}`.slice(0, 45000) };
}

async function analyzeText(page) {
  const settings = await chrome.storage.local.get(["openaiApiKey", "openaiModel", "openaiEndpoint"]);
  if (!settings.openaiApiKey) throw new Error("Missing OpenAI API key. Open extension settings and add your key.");

  const body = {
    model: settings.openaiModel || DEFAULT_MODEL,
    input: [
      {
        role: "system",
        content: [
          {
            type: "input_text",
            text: [
              "You are a claim evidence analyst for a Chrome extension.",
              "Analyze the supplied article text.",
              "Extract 8 to 16 atomic claims that are important and likely visible verbatim in the page.",
              "Prefer complete sentence spans that can be found in the original text.",
              "Classify each as Fact, Historical Fact, Statistic, Theory, Opinion, Prediction, Causal Claim, Normative Claim, or Investment Thesis.",
              "Separate facts from opinions. Do not label predictions as true or false.",
              "Use confidence 0-10 for how well supported the claim is by mainstream evidence.",
              "For references, include only real source URLs you know are relevant. If uncertain, leave sources empty and say what evidence is missing.",
              "Return only valid JSON matching the requested schema."
            ].join(" ")
          }
        ]
      },
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: `URL: ${page.url}\nTitle: ${page.title}\n\nArticle text:\n${page.text.slice(0, 45000)}`
          }
        ]
      }
    ],
    text: {
      format: {
        type: "json_schema",
        name: "claim_evidence_analysis",
        strict: true,
        schema: {
          type: "object",
          additionalProperties: false,
          required: ["summary", "claims"],
          properties: {
            summary: {
              type: "object",
              additionalProperties: false,
              required: ["fact_percent", "theory_percent", "opinion_percent", "prediction_percent", "unsupported_percent"],
              properties: {
                fact_percent: { type: "number" },
                theory_percent: { type: "number" },
                opinion_percent: { type: "number" },
                prediction_percent: { type: "number" },
                unsupported_percent: { type: "number" }
              }
            },
            claims: {
              type: "array",
              items: {
                type: "object",
                additionalProperties: false,
                required: [
                  "id",
                  "text",
                  "type",
                  "secondary_type",
                  "confidence",
                  "consensus",
                  "verdict",
                  "supporting_evidence",
                  "counter_evidence",
                  "sources",
                  "explanation"
                ],
                properties: {
                  id: { type: "string" },
                  text: { type: "string" },
                  type: { type: "string" },
                  secondary_type: { type: "string" },
                  confidence: { type: "number" },
                  consensus: { type: "string" },
                  verdict: { type: "string" },
                  supporting_evidence: {
                    type: "array",
                    items: { type: "string" }
                  },
                  counter_evidence: {
                    type: "array",
                    items: { type: "string" }
                  },
                  sources: {
                    type: "array",
                    items: {
                      type: "object",
                      additionalProperties: false,
                      required: ["title", "url", "source_type", "quality", "stance"],
                      properties: {
                        title: { type: "string" },
                        url: { type: "string" },
                        source_type: { type: "string" },
                        quality: { type: "number" },
                        stance: { type: "string" }
                      }
                    }
                  },
                  explanation: { type: "string" }
                }
              }
            }
          }
        }
      }
    }
  };

  const response = await fetch(settings.openaiEndpoint || DEFAULT_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${settings.openaiApiKey}`
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI API error ${response.status}: ${errorText.slice(0, 240)}`);
  }

  const data = await response.json();
  const outputText = data.output_text || data.output?.flatMap((item) => item.content || [])
    .find((content) => content.type === "output_text")?.text;
  if (!outputText) throw new Error("OpenAI response did not include output_text.");

  const analysis = JSON.parse(outputText);
  analysis.claims = analysis.claims.map((claim, index) => ({
    ...claim,
    id: claim.id || `claim_${String(index + 1).padStart(3, "0")}`,
    confidence: Math.max(0, Math.min(10, Number(claim.confidence || 0)))
  }));
  return analysis;
}

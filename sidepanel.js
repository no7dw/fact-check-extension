const emptyState = document.getElementById("emptyState");
const claimView = document.getElementById("claimView");
const claimType = document.getElementById("claimType");
const claimText = document.getElementById("claimText");
const confidenceText = document.getElementById("confidenceText");
const confidenceFill = document.getElementById("confidenceFill");
const consensus = document.getElementById("consensus");
const verdict = document.getElementById("verdict");
const explanation = document.getElementById("explanation");
const supportList = document.getElementById("supportList");
const counterList = document.getElementById("counterList");
const sourceList = document.getElementById("sourceList");

function scoreColor(score) {
  if (score >= 8.5) return "#178a4c";
  if (score >= 7) return "#2a895c";
  if (score >= 5) return "#9a7600";
  if (score >= 3) return "#c95e18";
  return "#c93636";
}

function fillList(listEl, items, sourceMode = false) {
  listEl.replaceChildren();
  if (!items?.length) {
    const li = document.createElement("li");
    li.textContent = "No item provided.";
    listEl.append(li);
    return;
  }

  for (const item of items) {
    const li = document.createElement("li");
    if (sourceMode && item.url) {
      const a = document.createElement("a");
      a.href = item.url;
      a.target = "_blank";
      a.rel = "noreferrer";
      a.textContent = item.title || item.url;
      li.append(a);
      const meta = document.createElement("div");
      meta.className = "hint";
      meta.textContent = `${item.source_type || "Source"} · quality ${item.quality ?? "n/a"} · ${item.stance || "reference"}`;
      li.append(meta);
    } else {
      li.textContent = typeof item === "string" ? item : item.summary || item.title || JSON.stringify(item);
    }
    listEl.append(li);
  }
}

function renderClaim(claim) {
  if (!claim) return;

  emptyState.hidden = true;
  claimView.hidden = false;

  const score = Number(claim.confidence || 0);
  claimType.textContent = `${claim.type || "Claim"}${claim.secondary_type ? ` + ${claim.secondary_type}` : ""}`;
  claimText.textContent = claim.text || "";
  confidenceText.textContent = `${score.toFixed(1)} / 10`;
  confidenceFill.style.width = `${Math.max(0, Math.min(100, score * 10))}%`;
  confidenceFill.style.background = scoreColor(score);
  consensus.textContent = claim.consensus || "Unknown";
  verdict.textContent = claim.verdict || "Not labeled";
  explanation.textContent = claim.explanation || "No explanation provided.";

  fillList(supportList, claim.supporting_evidence || claim.evidence || []);
  fillList(counterList, claim.counter_evidence || []);
  fillList(sourceList, claim.sources || [], true);
}

chrome.runtime.onMessage.addListener((message) => {
  if (message.type === "CEL_SELECT_CLAIM") {
    renderClaim(message.claim);
  }
});

chrome.storage.session?.get("celSelectedClaim").then(({ celSelectedClaim }) => {
  if (celSelectedClaim) renderClaim(celSelectedClaim);
});

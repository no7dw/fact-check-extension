let celClaims = [];
let celHoverCard = null;

function extractReadableText() {
  const article = document.querySelector("article, #js_content, .rich_media_content, main") || document.body;
  const title = document.querySelector("h1, .rich_media_title")?.innerText?.trim() || document.title || "";
  const text = article.innerText
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();

  return {
    url: location.href,
    title,
    text: `${title}\n\n${text}`.trim()
  };
}

function confidenceBand(score) {
  if (score >= 8.5) return "high";
  if (score >= 7) return "good";
  if (score >= 5) return "medium";
  if (score >= 3) return "low";
  return "weak";
}

function typeClass(type) {
  return `cel-type-${String(type || "claim").toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
}

function isTextContainer(node) {
  if (!node?.parentElement) return false;
  const tag = node.parentElement.tagName;
  return !["SCRIPT", "STYLE", "TEXTAREA", "INPUT", "CODE", "PRE", "NOSCRIPT"].includes(tag);
}

function highlightClaim(claim) {
  const text = claim.text?.trim();
  if (!text || text.length < 6) return false;

  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      if (!isTextContainer(node)) return NodeFilter.FILTER_REJECT;
      if (!node.nodeValue.includes(text)) return NodeFilter.FILTER_REJECT;
      if (node.parentElement.closest(".cel-claim, .cel-hover-card, .cel-summary")) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    }
  });

  const node = walker.nextNode();
  if (!node) return false;

  const index = node.nodeValue.indexOf(text);
  if (index < 0) return false;

  const range = document.createRange();
  range.setStart(node, index);
  range.setEnd(node, index + text.length);

  const band = confidenceBand(Number(claim.confidence || 0));
  const mark = document.createElement("span");
  mark.className = `cel-claim cel-confidence-${band} ${typeClass(claim.type)}`;
  mark.dataset.claimId = claim.id;
  range.surroundContents(mark);

  const badge = document.createElement("span");
  badge.className = `cel-badge cel-badge-${band}`;
  badge.textContent = `${claim.type || "Claim"} ${Number(claim.confidence || 0).toFixed(1)}`;
  badge.dataset.claimId = claim.id;
  mark.after(badge);

  mark.addEventListener("mouseenter", (event) => showHoverCard(event, claim));
  mark.addEventListener("mouseleave", hideHoverCard);
  mark.addEventListener("click", () => selectClaim(claim));
  badge.addEventListener("mouseenter", (event) => showHoverCard(event, claim));
  badge.addEventListener("mouseleave", hideHoverCard);
  badge.addEventListener("click", () => selectClaim(claim));
  return true;
}

function showHoverCard(event, claim) {
  hideHoverCard();
  const score = Number(claim.confidence || 0).toFixed(1);
  celHoverCard = document.createElement("div");
  celHoverCard.className = "cel-hover-card";

  const supports = (claim.supporting_evidence || claim.evidence || []).slice(0, 2);
  const counters = (claim.counter_evidence || []).slice(0, 1);
  const supportHtml = [...supports, ...counters].map((item) => {
    const text = typeof item === "string" ? item : item.summary || item.title || "";
    return `<li>${escapeHtml(text)}</li>`;
  }).join("");

  celHoverCard.innerHTML = `
    <strong>${escapeHtml(claim.text || "")}</strong>
    <dl>
      <dt>Type</dt><dd>${escapeHtml(claim.type || "Claim")}</dd>
      <dt>Confidence</dt><dd>${score} / 10</dd>
      <dt>Consensus</dt><dd>${escapeHtml(claim.consensus || "Unknown")}</dd>
      <dt>Verdict</dt><dd>${escapeHtml(claim.verdict || "Not labeled")}</dd>
    </dl>
    ${supportHtml ? `<ul>${supportHtml}</ul>` : ""}
  `;

  document.body.append(celHoverCard);
  const rect = celHoverCard.getBoundingClientRect();
  celHoverCard.style.left = `${Math.min(window.innerWidth - rect.width - 12, Math.max(12, event.clientX + 12))}px`;
  celHoverCard.style.top = `${Math.min(window.innerHeight - rect.height - 12, Math.max(12, event.clientY + 12))}px`;
}

function hideHoverCard() {
  celHoverCard?.remove();
  celHoverCard = null;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function selectClaim(claim) {
  chrome.runtime.sendMessage({ type: "CEL_CLAIM_SELECTED", claim });
}

function injectSummary(claims) {
  document.querySelector(".cel-summary")?.remove();
  const counts = claims.reduce((acc, claim) => {
    const type = claim.type || "Claim";
    acc[type] = (acc[type] || 0) + 1;
    return acc;
  }, {});
  const total = Math.max(1, claims.length);

  const summary = document.createElement("aside");
  summary.className = "cel-summary";
  summary.innerHTML = `<strong>Evidence Summary</strong>`;

  for (const [type, count] of Object.entries(counts)) {
    const pct = Math.round((count / total) * 100);
    const row = document.createElement("div");
    row.className = "cel-summary-row";
    row.innerHTML = `
      <span>${escapeHtml(type)}</span>
      <span class="cel-summary-bar"><span style="width:${pct}%"></span></span>
      <span>${pct}%</span>
    `;
    summary.append(row);
  }

  document.body.append(summary);
}

function applyAnalysis(analysis) {
  celClaims = analysis.claims || [];
  document.querySelectorAll(".cel-badge, .cel-summary").forEach((el) => el.remove());
  for (const claim of celClaims) highlightClaim(claim);
  injectSummary(celClaims);
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "CEL_EXTRACT_PAGE") {
    sendResponse({ ok: true, page: extractReadableText() });
    return;
  }

  if (message.type === "CEL_APPLY_ANALYSIS") {
    applyAnalysis(message.analysis);
    sendResponse({ ok: true });
  }
});

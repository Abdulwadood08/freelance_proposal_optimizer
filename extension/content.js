const FPO_DEFAULT_BACKEND = "http://localhost:8000";
const FPO_DEFAULT_TONE = "professional";

function firstMatch(selectors) {
  for (const selector of selectors) {
    const element = document.querySelector(selector);
    if (element && element.textContent) {
      const text = element.textContent.trim();
      if (text) return text;
    }
  }
  return "";
}

function extractUpworkJobData() {
  const titleSelectors = [
    "h1[data-test='job-title']",
    "[data-test='job-title']",
    "[data-qa='job-title']",
    "h2[data-test='job-title']",
    "h3[data-test='job-title']",
    "h4[data-test='job-title']",
    "h1.air3-card-section h1",
    "header h1",
    "h2",
    "h3",
    "h4",
    "h1",
  ];

  const descriptionSelectors = [
    "[data-test='job-description-text']",
    "[data-test='UpCLineClamp JobDescription']",
    "[data-test='job-description']",
    "[data-qa='job-description']",
    "[data-test='description']",
    "[data-qa='description']",
    ".job-description",
    "section[data-test='job-description']",
    "section",
  ];

  let title = firstMatch(titleSelectors);
  let description = firstMatch(descriptionSelectors);

  if (!description) {
    const nodes = [...document.querySelectorAll("h2, h3, h4, span, p, div")];
    const summaryNode = nodes.find((node) =>
      /^summary$/i.test((node.textContent || "").trim()),
    );
    if (summaryNode) {
      let cursor = summaryNode.nextElementSibling;
      const chunks = [];
      let guard = 0;
      while (cursor && guard < 8) {
        const text = (cursor.textContent || "").trim();
        if (
          text &&
          text.length > 10 &&
          !/skills and expertise|activity on this job|entry level|project type/i.test(text)
        ) {
          chunks.push(text);
        }
        if (/skills and expertise|activity on this job/i.test(text)) break;
        cursor = cursor.nextElementSibling;
        guard += 1;
      }
      description = chunks.join("\n\n").trim();
    }
  }

  if (!title) {
    const headingCandidate = [...document.querySelectorAll("h1, h2, h3, h4")]
      .map((node) => (node.textContent || "").trim())
      .find((text) => text && text.length > 3 && text.length < 120 && !/^summary$/i.test(text));
    title = headingCandidate || "";
  }

  const url = window.location.href;
  return { title, description, url };
}

function collectFirebaseAuthKeys(storageObj) {
  const keys = [];
  for (let i = 0; i < storageObj.length; i += 1) {
    const key = storageObj.key(i);
    if (key && key.startsWith("firebase:authUser:")) keys.push(key);
  }
  return keys;
}

function extractFirebaseTokenFromStorage(storageObj) {
  try {
    const tokenKeys = collectFirebaseAuthKeys(storageObj);
    for (const key of tokenKeys) {
      const raw = storageObj.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw);
      const token = parsed?.stsTokenManager?.accessToken;
      if (token) return token;
    }
  } catch (_error) {
    return "";
  }
  return "";
}

function extractFirebaseTokenFromPageStorage() {
  const extensionToken =
    window.localStorage.getItem("fpo_extension_token") ||
    window.sessionStorage.getItem("fpo_extension_token") ||
    "";
  if (extensionToken) return extensionToken;

  const localToken = extractFirebaseTokenFromStorage(window.localStorage);
  if (localToken) return localToken;

  const sessionToken = extractFirebaseTokenFromStorage(window.sessionStorage);
  if (sessionToken) return sessionToken;

  return "";
}

function storageGet(keys) {
  return new Promise((resolve) => chrome.storage.local.get(keys, resolve));
}

function storageSet(payload) {
  return new Promise((resolve) => chrome.storage.local.set(payload, resolve));
}

function createPanelTemplate() {
  return `
    <div class="fpo-panel__header">
      <h2 class="fpo-title">AI Bidding Assistant</h2>
      <button class="fpo-close" id="fpoCloseBtn" aria-label="Close panel">×</button>
    </div>
    <div class="fpo-panel__content">
      <section class="fpo-section">
        <label class="fpo-label" for="fpoTone">Tone</label>
        <select class="fpo-select" id="fpoTone">
          <option value="professional">Professional</option>
          <option value="friendly">Friendly</option>
          <option value="confident">Confident</option>
          <option value="balanced">Balanced</option>
        </select>
      </section>

      <section class="fpo-section">
        <label class="fpo-label" for="fpoBackendUrl">Backend URL</label>
        <input class="fpo-input" id="fpoBackendUrl" type="text" />
      </section>

      <section class="fpo-section">
        <div class="fpo-row">
          <button class="fpo-btn" id="fpoGenerateBtn">Generate Assistant Output</button>
          <button class="fpo-btn fpo-btn--muted" id="fpoRegenerateBtn">Regenerate</button>
        </div>
        <p class="fpo-status" id="fpoStatus">Ready.</p>
      </section>

      <section class="fpo-section">
        <h3>Fit Score</h3>
        <p class="fpo-fit-score" id="fpoFitScore">-</p>
      </section>

      <section class="fpo-section">
        <h3>Key Requirements</h3>
        <ul class="fpo-list" id="fpoKeywords"><li>Generate to view keywords.</li></ul>
      </section>

      <section class="fpo-section">
        <h3>Proposal Strategy</h3>
        <p class="fpo-text" id="fpoStrategy">No strategy yet.</p>
      </section>

      <section class="fpo-section">
        <h3>Personalized Proposal</h3>
        <textarea class="fpo-textarea" id="fpoProposal" placeholder="Generated proposal appears here..."></textarea>
        <div class="fpo-row" style="margin-top:8px;">
          <button class="fpo-btn fpo-btn--muted" id="fpoCopyBtn">Copy Proposal</button>
          <button class="fpo-btn fpo-btn--muted" id="fpoInsertBtn">Insert in Upwork</button>
        </div>
      </section>

      <section class="fpo-section">
        <h3>Variations</h3>
        <ul class="fpo-list" id="fpoVariations"><li>No variations yet.</li></ul>
      </section>
    </div>
  `;
}

function findProposalTextarea() {
  const selectors = [
    "textarea[data-test='cover-letter']",
    "textarea[name='coverLetter']",
    "textarea[aria-label*='Cover']",
    "textarea",
  ];
  for (const selector of selectors) {
    const el = document.querySelector(selector);
    if (el && typeof el.value === "string") {
      return el;
    }
  }
  return null;
}

function truncate(text, max = 150) {
  if (!text) return "";
  return text.length > max ? `${text.slice(0, max)}...` : text;
}

function isUpworkPage() {
  return /(^|\.)upwork\.com$/i.test(window.location.hostname);
}

function setupInPageAssistant() {
  if (!isUpworkPage()) return;
  if (document.getElementById("fpoLauncher")) return;

  const launcher = document.createElement("button");
  launcher.id = "fpoLauncher";
  launcher.className = "fpo-launcher";
  launcher.type = "button";
  launcher.innerHTML = `
    <span class="fpo-launcher__logo">AI</span>
    <span class="fpo-launcher__text">Proposal Optimizer</span>
  `;
  document.body.appendChild(launcher);

  const panel = document.createElement("aside");
  panel.id = "fpoPanel";
  panel.className = "fpo-panel";
  panel.innerHTML = createPanelTemplate();
  document.body.appendChild(panel);

  const closeBtn = panel.querySelector("#fpoCloseBtn");
  const toneEl = panel.querySelector("#fpoTone");
  const backendUrlEl = panel.querySelector("#fpoBackendUrl");
  const generateBtn = panel.querySelector("#fpoGenerateBtn");
  const regenerateBtn = panel.querySelector("#fpoRegenerateBtn");
  const copyBtn = panel.querySelector("#fpoCopyBtn");
  const insertBtn = panel.querySelector("#fpoInsertBtn");
  const proposalEl = panel.querySelector("#fpoProposal");
  const keywordsEl = panel.querySelector("#fpoKeywords");
  const strategyEl = panel.querySelector("#fpoStrategy");
  const fitScoreEl = panel.querySelector("#fpoFitScore");
  const variationsEl = panel.querySelector("#fpoVariations");
  const statusEl = panel.querySelector("#fpoStatus");

  function setStatus(text, isError = false) {
    statusEl.textContent = text;
    statusEl.classList.toggle("is-error", isError);
  }

  function setLoading(loading) {
    generateBtn.disabled = loading;
    regenerateBtn.disabled = loading;
    copyBtn.disabled = loading;
    insertBtn.disabled = loading;
  }

  function setEmptyState() {
    fitScoreEl.textContent = "-";
    strategyEl.textContent = "No strategy yet.";
    keywordsEl.innerHTML = "<li>Generate to view keywords.</li>";
    variationsEl.innerHTML = "<li>No variations yet.</li>";
    proposalEl.value = "";
  }

  async function loadPrefs() {
    const prefs = await storageGet([
      "backendBaseUrl",
      "preferredTone",
      "firebaseIdToken",
    ]);
    backendUrlEl.value = prefs.backendBaseUrl || FPO_DEFAULT_BACKEND;
    toneEl.value = prefs.preferredTone || FPO_DEFAULT_TONE;

    // Try to refresh token from page storage first; useful if user is logged in on same origin.
    const pageToken = extractFirebaseTokenFromPageStorage();
    if (pageToken) {
      await storageSet({ firebaseIdToken: pageToken });
    }
  }

  async function getToken() {
    const { firebaseIdToken } = await storageGet(["firebaseIdToken"]);
    return firebaseIdToken || "";
  }

  function renderResult(result) {
    fitScoreEl.textContent = `${result.fit_score ?? "-"}%`;
    strategyEl.textContent = result.strategy || "No strategy generated.";

    const keywords = Array.isArray(result.keywords) ? result.keywords : [];
    keywordsEl.innerHTML = keywords.length
      ? keywords.map((item) => `<li>${item}</li>`).join("")
      : "<li>No keywords returned.</li>";

    const variations = Array.isArray(result.variations)
      ? result.variations
      : [];
    variationsEl.innerHTML = variations.length
      ? variations
          .map((item) => `<li>${item.tone}: ${truncate(item.proposal)}</li>`)
          .join("")
      : "<li>No variations returned.</li>";

    proposalEl.value = result.proposal || "";
  }

  async function runAnalysis() {
    try {
      setLoading(true);
      setStatus("Extracting job details...");
      setEmptyState();

      const token = await getToken();
      if (!token) {
        throw new Error(
          "No auth token found. Open extension popup on your app tab and click Read Token first.",
        );
      }

      const tone = toneEl.value || FPO_DEFAULT_TONE;
      const backendBaseUrl = (backendUrlEl.value || FPO_DEFAULT_BACKEND).trim();
      await storageSet({ preferredTone: tone, backendBaseUrl });

      const job = extractUpworkJobData();
      if (!job.title && !job.description) {
        throw new Error(
          "Unable to extract job title/description from this Upwork page.",
        );
      }

      setStatus("Analyzing with backend...");
      const response = await fetch(`${backendBaseUrl}/plugin/analyze-job`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          job_title: job.title || "",
          job_description: job.description || "",
          job_url: job.url || window.location.href,
          tone,
        }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        if (response.status === 401) {
          await storageSet({ firebaseIdToken: "" });
          throw new Error(
            "Session expired. Open your app tab, click extension popup -> Read Token, then retry.",
          );
        }
        throw new Error(
          err.detail || `Request failed with status ${response.status}`,
        );
      }

      const data = await response.json();
      renderResult(data);
      setStatus("Done. You can copy or insert the proposal.");
    } catch (error) {
      setStatus(error.message || "Failed to analyze job.", true);
    } finally {
      setLoading(false);
    }
  }

  launcher.addEventListener("click", () => {
    panel.classList.add("is-open");
  });
  closeBtn.addEventListener("click", () => {
    panel.classList.remove("is-open");
  });
  generateBtn.addEventListener("click", runAnalysis);
  regenerateBtn.addEventListener("click", runAnalysis);
  copyBtn.addEventListener("click", async () => {
    if (!proposalEl.value.trim()) {
      setStatus("No proposal to copy.", true);
      return;
    }
    await navigator.clipboard.writeText(proposalEl.value);
    setStatus("Proposal copied.");
  });
  insertBtn.addEventListener("click", () => {
    const textarea = findProposalTextarea();
    if (!textarea) {
      setStatus("Could not find a proposal textarea on this page.", true);
      return;
    }
    if (!proposalEl.value.trim()) {
      setStatus("No proposal to insert.", true);
      return;
    }
    textarea.value = proposalEl.value;
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
    setStatus("Proposal inserted into page.");
  });

  loadPrefs().then(() => setStatus("Ready."));
}

setupInPageAssistant();

// Keep message listener for compatibility with popup flow.
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "GET_JOB_DATA") {
    sendResponse({
      ok: true,
      data: extractUpworkJobData(),
    });
    return true;
  }

  if (message?.type === "GET_FIREBASE_TOKEN") {
    const token = extractFirebaseTokenFromPageStorage();
    sendResponse({
      ok: Boolean(token),
      token,
    });
    return true;
  }

  return false;
});

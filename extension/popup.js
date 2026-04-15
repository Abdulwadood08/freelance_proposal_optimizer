const state = {
  job: null,
  loading: false
};

const toneEl = document.getElementById("tone");
const backendBaseUrlEl = document.getElementById("backendBaseUrl");
const tokenStatusEl = document.getElementById("tokenStatus");
const messageEl = document.getElementById("message");
const readJobBtn = document.getElementById("readJobBtn");
const generateBtn = document.getElementById("generateBtn");
const readTokenBtn = document.getElementById("readTokenBtn");
const clearTokenBtn = document.getElementById("clearTokenBtn");
const copyBtn = document.getElementById("copyBtn");
const proposalOutput = document.getElementById("proposalOutput");
const jobPreview = document.getElementById("jobPreview");

function setMessage(text, isError = false) {
  messageEl.textContent = text;
  messageEl.style.color = isError ? "#f87171" : "#9ca3af";
}

function setLoading(loading) {
  state.loading = loading;
  readJobBtn.disabled = loading;
  generateBtn.disabled = loading;
  copyBtn.disabled = loading;
}

function truncate(text, max = 220) {
  if (!text) return "";
  return text.length > max ? `${text.slice(0, max)}...` : text;
}

function renderJobPreview(job) {
  if (!job) {
    jobPreview.innerHTML = '<p class="muted">No job loaded yet.</p>';
    return;
  }

  jobPreview.innerHTML = `
    <p class="job-title">${job.title || "Untitled Job"}</p>
    <p class="job-description">${truncate(job.description || "No description found.")}</p>
  `;
}

function getActiveTab() {
  return new Promise((resolve, reject) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs && tabs[0];
      if (!tab?.id) {
        reject(new Error("No active tab found."));
        return;
      }
      resolve(tab);
    });
  });
}

function sendToTab(tabId, payload) {
  return new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(tabId, payload, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      resolve(response);
    });
  });
}

function storageGet(keys) {
  return new Promise((resolve) => chrome.storage.local.get(keys, resolve));
}

function storageSet(obj) {
  return new Promise((resolve) => chrome.storage.local.set(obj, resolve));
}

async function updateTokenStatus() {
  const { firebaseIdToken } = await storageGet(["firebaseIdToken"]);
  tokenStatusEl.textContent = firebaseIdToken ? "Token: set" : "Token: not set";
}

async function onReadToken() {
  try {
    setMessage("Reading token from current tab...");
    const tab = await getActiveTab();
    const response = await sendToTab(tab.id, { type: "GET_FIREBASE_TOKEN" });

    if (!response?.ok || !response.token) {
      throw new Error("No Firebase token found in this tab. Open your app tab and try again.");
    }

    await storageSet({ firebaseIdToken: response.token });
    await updateTokenStatus();
    setMessage("Token saved.");
  } catch (error) {
    setMessage(error.message || "Failed to read token.", true);
  }
}

async function onReadJob() {
  try {
    setLoading(true);
    setMessage("Reading job from page...");
    const tab = await getActiveTab();
    const response = await sendToTab(tab.id, { type: "GET_JOB_DATA" });

    if (!response?.ok || !response?.data) {
      throw new Error("Could not extract job data from this page.");
    }

    state.job = response.data;
    renderJobPreview(state.job);
    setMessage("Job data loaded.");
  } catch (error) {
    setMessage(error.message || "Failed to read job.", true);
  } finally {
    setLoading(false);
  }
}

async function onGenerateProposal() {
  try {
    if (!state.job?.title && !state.job?.description) {
      throw new Error("Read job data first.");
    }

    const { firebaseIdToken } = await storageGet(["firebaseIdToken"]);
    if (!firebaseIdToken) {
      throw new Error("No auth token saved. Click Read Token first.");
    }

    setLoading(true);
    setMessage("Generating proposal...");

    const tone = toneEl.value;
    const backendBaseUrl = backendBaseUrlEl.value.trim();
    await storageSet({
      preferredTone: tone,
      backendBaseUrl
    });

    const res = await fetch(`${backendBaseUrl}/plugin/generate-proposal`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${firebaseIdToken}`
      },
      body: JSON.stringify({
        job_title: state.job.title || "",
        job_description: state.job.description || "",
        tone
      })
    });

    if (!res.ok) {
      const errorBody = await res.json().catch(() => ({}));
      const detail = errorBody.detail || `Request failed: ${res.status}`;
      throw new Error(detail);
    }

    const body = await res.json();
    proposalOutput.value = body?.proposal || "";
    setMessage("Proposal generated.");
  } catch (error) {
    setMessage(error.message || "Failed to generate proposal.", true);
  } finally {
    setLoading(false);
  }
}

async function onCopy() {
  try {
    if (!proposalOutput.value.trim()) {
      setMessage("Nothing to copy.", true);
      return;
    }
    await navigator.clipboard.writeText(proposalOutput.value);
    setMessage("Copied to clipboard.");
  } catch (_error) {
    setMessage("Failed to copy proposal.", true);
  }
}

async function init() {
  const saved = await storageGet(["preferredTone", "backendBaseUrl"]);
  if (saved.preferredTone) toneEl.value = saved.preferredTone;
  if (saved.backendBaseUrl) backendBaseUrlEl.value = saved.backendBaseUrl;

  renderJobPreview(null);
  updateTokenStatus();

  readTokenBtn.addEventListener("click", onReadToken);
  clearTokenBtn.addEventListener("click", async () => {
    await storageSet({ firebaseIdToken: "" });
    updateTokenStatus();
    setMessage("Token cleared.");
  });
  readJobBtn.addEventListener("click", onReadJob);
  generateBtn.addEventListener("click", onGenerateProposal);
  copyBtn.addEventListener("click", onCopy);
}

init();

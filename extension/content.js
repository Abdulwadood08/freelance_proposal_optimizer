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

function normalizeWs(s) {
  return String(s || "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Strip Upwork category + "Posted … date" crumbs accidentally merged into the title. */
function sanitizeUpworkJobTitle(raw) {
  let t = normalizeWs(raw);
  if (!t) return "";
  t = t
    .replace(
      /\s+[A-Za-z][A-Za-z &/+.-]{0,60}\s+Posted\s+[A-Za-z]{3,12}\s+\d{1,2},?\s*\d{0,4}.*$/i,
      "",
    )
    .trim();
  const m = t.match(/^(.+?)\s+[A-Za-z][A-Za-z &/+.-]{2,50}\s+Posted\s+/i);
  if (m && normalizeWs(m[1]).length > 12) {
    t = normalizeWs(m[1]);
  }
  return t;
}

function uniqueStrings(arr, max = 50) {
  const seen = new Set();
  const out = [];
  for (const x of arr) {
    const s = normalizeWs(String(x));
    if (!s || s.length > 100) continue;
    const k = s.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(s);
    if (out.length >= max) break;
  }
  return out;
}

/** Proposal submission wizard (/nx/proposals/job/~/apply/) — DOM differs from public job page. */
function isUpworkProposalApplyPage() {
  try {
    const path = window.location.pathname || "";
    return (
      /\/nx\/proposals\/job\/~/i.test(path) ||
      /\/proposals\/job\/~[^/]+\/apply/i.test(path)
    );
  } catch (_e) {
    return false;
  }
}

function isBadNavJobTitle(text) {
  const s = normalizeWs(text).toLowerCase();
  if (!s || s.length > 180) return true;
  return (
    /^submit (a )?proposal\.?$/.test(s) ||
    /^proposal[s]?$/.test(s) ||
    /^apply now\.?$/.test(s) ||
    /^overview$/i.test(s)
  );
}

/** Blocks that come from the apply wizard (Connects, bid UI), not the client's scope. */
function descriptionLooksLikeApplyChrome(text) {
  const t = normalizeWs(text);
  const lower = t.toLowerCase();
  if (!t || t.length < 40) return false;

  const strongSignals = [
    /insufficient connects/i,
    /\d+\s+connects?\s+(?:are\s+)?required/i,
    /need(s)? (?:more |additional )?connects/i,
    /buy connects/i,
    /what is the rate you'd like to bid/i,
    /how much would you like to get paid/i,
    /boost your proposal/i,
    /milestones for this job/i,
    /include an?( introduction)? video/i,
    /proposal settings on upwork/i,
    /using connects on the platform/i,
    /navigate the proposal process/i,
    /articulate your needs clearly.*potential clients/i,
  ];
  if (strongSignals.some((re) => re.test(t))) return true;

  if (
    lower.includes("connects") &&
    /submit (?:this |your )?proposal|apply for this job|required to bid/i.test(lower)
  ) {
    return true;
  }

  return false;
}

function stripApplyChromeLines(text) {
  const lines = normalizeWs(text).split(/\n+/);
  const kept = lines.filter((line) => {
    const L = normalizeWs(line);
    if (!L) return false;
    return !descriptionLooksLikeApplyChrome(L);
  });
  return kept.join("\n\n").trim();
}

function gatherJobDescriptionCandidates() {
  const selectors = [
    "[data-test='job-description-text']",
    "[data-test='UpCLineClamp JobDescription']",
    "[data-test='job-description']",
    "[data-qa='job-description']",
    "[data-ev-job-description]",
  ];
  const seen = new Set();
  const out = [];
  for (const sel of selectors) {
    let nodes = [];
    try {
      nodes = [...document.querySelectorAll(sel)];
    } catch (_e) {
      continue;
    }
    for (const el of nodes) {
      let t = normalizeWs(el.textContent || "");
      if (!t || t.length < 35) continue;
      t = stripApplyChromeLines(t);
      if (!t || t.length < 35) continue;
      if (descriptionLooksLikeApplyChrome(t)) continue;
      const key = t.slice(0, 180).toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(t);
    }
  }
  return out;
}

function scoreJobDescriptionCandidate(text) {
  let score = Math.min(normalizeWs(text).length, 14000);
  const lower = text.toLowerCase();
  if (descriptionLooksLikeApplyChrome(text)) score -= 8000;
  if (/connects|insufficient connects/i.test(lower)) score -= 6000;
  // Mild preference for typical scope language (does not force a vertical)
  if (
    /\b(need help|looking for|seeking|build|develop|implement|create|design|integrate|platform|application|stack)\b/i.test(
      lower,
    )
  ) {
    score += 120;
  }
  return score;
}

function pickBestJobDescription(candidates) {
  if (!Array.isArray(candidates) || !candidates.length) return "";
  return candidates.reduce((best, cur) =>
    scoreJobDescriptionCandidate(cur) > scoreJobDescriptionCandidate(best)
      ? cur
      : best,
  );
}

function extractClientNamePublic() {
  const aside = document.querySelector("aside") || document.body;
  const links = aside.querySelectorAll(
    'a[href*="/clients/"], a[href*="/company/"], a[href*="/freelancers/~"]',
  );
  for (const a of links) {
    const t = normalizeWs(a.textContent || "");
    if (
      t &&
      t.length < 80 &&
      !/^view\b|^rating|^reviews?\b/i.test(t) &&
      !/\$\d/.test(t)
    ) {
      return t;
    }
  }
  return "";
}

function extractSkillsPublic() {
  const out = [];
  const nodes = document.querySelectorAll(
    "[data-test*='skill'], [data-test*='Skill'], .air3-token span",
  );
  for (const el of nodes) {
    const t = normalizeWs(el.textContent || "");
    if (t && t.length > 1 && t.length < 60 && !/skills and expertise/i.test(t)) {
      out.push(t);
    }
  }
  return uniqueStrings(out, 40);
}

function extractProposalActivityPublic(bodyText) {
  const m = bodyText.match(
    /(Proposals?:\s*[^\n]{5,120}|Activity on this job[^\n]{5,200})/i,
  );
  let out = m ? normalizeWs(m[1]) : "";
  if (descriptionLooksLikeApplyChrome(out)) out = "";
  return out;
}

function extractPostedPublic(bodyText) {
  const m = bodyText.match(
    /\bPosted\s+(?:yesterday|today|\d+\s+(?:hour|day|week)s?\s+ago|[A-Za-z]{3,12}\s+\d{1,2},?\s*\d{4})\b/i,
  );
  return m ? normalizeWs(m[0]) : "";
}

function extractExperiencePublic(bodyText) {
  const m = bodyText.match(
    /\b(Entry level|Intermediate|Expert)\s+Experience\b/i,
  );
  return m ? normalizeWs(m[1]) + " experience" : "";
}

function extractProjectTypePublic(bodyText) {
  const m = bodyText.match(
    /\b(Hourly|Fixed-price|Milestone)\s+(?:project|budget|:)?/i,
  );
  return m ? normalizeWs(m[0]) : "";
}

function mergeDescriptionChunks(selectors) {
  const chunks = [];
  const seen = new Set();
  for (const selector of selectors) {
    const els = document.querySelectorAll(selector);
    for (const el of els) {
      let t = normalizeWs(el.textContent || "");
      if (
        !t ||
        t.length < 35 ||
        /skills and expertise|activity on this job|similar jobs/i.test(t)
      ) {
        continue;
      }
      if (descriptionLooksLikeApplyChrome(t)) continue;
      t = stripApplyChromeLines(t);
      if (!t || t.length < 35) continue;
      const key = t.slice(0, 120).toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      chunks.push(t);
    }
  }
  return chunks.join("\n\n");
}

/**
 * Compact "Job details" card on proposal apply flow (title + category pill + posted + scope paragraph).
 */
function findJobDetailsSectionRoot() {
  const probe = [
    ...document.querySelectorAll("h2, h3, h4, h5, h6"),
    ...document.querySelectorAll(
      "[data-test*='job-detail'], [data-test*='JobDetail'], [aria-label*='Job detail'], [aria-label*='job detail']",
    ),
  ];
  for (const el of probe) {
    const ht = normalizeWs(el.textContent || "");
    if (!/^job details\b/i.test(ht) || ht.length > 72) continue;
    let anc = el;
    for (let d = 0; d < 12 && anc; d++) {
      anc = anc.parentElement;
      if (!anc) break;
      const len = normalizeWs(anc.textContent || "").length;
      if (len >= 80 && len <= 14000) return anc;
    }
    return el.parentElement;
  }
  return null;
}

function extractListingCategoryNearJobDetails(root) {
  const selectors = [
    "[data-test*='category']",
    "[data-test*='ontology']",
    "[data-test*='job-category']",
    "[class*='air3-badge']",
    "[class*='pill']",
    "button[class*='air3']",
    "a[class*='badge']",
  ];
  for (const sel of selectors) {
    try {
      const els = root.querySelectorAll(sel);
      for (const el of els) {
        const t = normalizeWs(el.textContent || "");
        if (!t || t.length < 4 || t.length > 90) continue;
        if (/^posted\b/i.test(t)) continue;
        if (/\b20\d{2}\b/.test(t) && t.length < 35) continue;
        if (/^view job posting$/i.test(t)) continue;
        if (/^job details$/i.test(t)) continue;
        return t;
      }
    } catch (_e) {
      /* ignore */
    }
  }
  return "";
}

function extractJobDetailsPanel() {
  const root = findJobDetailsSectionRoot();
  if (!root) return null;

  const listingCategoryLine = extractListingCategoryNearJobDetails(root);

  let title = "";
  const scopedTitle = root.querySelector(
    "[data-test='job-title'], [data-qa='job-title'], [data-ev-job-title]",
  );
  if (scopedTitle) {
    const tt = sanitizeUpworkJobTitle(
      normalizeWs(scopedTitle.textContent || ""),
    );
    if (tt && !isBadNavJobTitle(tt)) title = tt;
  }

  let description = "";
  const scoped =
    root.querySelector("[data-test='job-description-text']") ||
    root.querySelector("[data-test='UpCLineClamp JobDescription']") ||
    root.querySelector("[data-test='job-description']") ||
    root.querySelector("[data-qa='job-description']");
  if (scoped) {
    const t = normalizeWs(scoped.textContent || "");
    if (t.length >= 35 && !descriptionLooksLikeApplyChrome(t)) {
      description = stripApplyChromeLines(t);
    }
  }

  if (!title) {
    const headings = [...root.querySelectorAll("h2, h3, h4, h5, h6")];
    for (const h of headings) {
      const t = normalizeWs(h.textContent || "");
      if (!t || /^job details\b/i.test(t)) continue;
      if (isBadNavJobTitle(t)) continue;
      if (t.length < 6 || t.length > 220) continue;
      const cand = sanitizeUpworkJobTitle(t);
      if (cand && !isBadNavJobTitle(cand)) {
        title = cand;
        break;
      }
    }
  }

  if (!description || description.length < 35) {
    const paras = [];
    root.querySelectorAll("p").forEach((p) => {
      const t = normalizeWs(p.textContent || "");
      if (t.length < 25) return;
      if (/^view job posting$/i.test(t)) return;
      if (descriptionLooksLikeApplyChrome(t)) return;
      paras.push(t);
    });
    description = paras.join("\n\n").trim();
  }

  if (!description || description.length < 35) {
    const lines = normalizeWs(root.innerText || "")
      .replace(/^job details\s*/i, "")
      .split(/\n/)
      .map(normalizeWs)
      .filter(Boolean);

    const skip = new Set(["job details", "view job posting"]);
    if (title) skip.add(title.toLowerCase());
    if (listingCategoryLine) skip.add(listingCategoryLine.toLowerCase());

    const buf = [];
    for (const line of lines) {
      const low = line.toLowerCase();
      if (skip.has(low)) continue;
      if (/^posted\b/i.test(low)) continue;
      if (descriptionLooksLikeApplyChrome(line)) continue;
      if (line.length < 25) continue;
      buf.push(line);
    }
    description = buf.join("\n\n").trim();
  }

  if ((!description || description.length < 35) && title) {
    const lines = normalizeWs(root.innerText || "")
      .split(/\n/)
      .map(normalizeWs)
      .filter(Boolean);
    for (const line of lines) {
      const low = line.toLowerCase();
      if (title && low === title.toLowerCase()) continue;
      if (listingCategoryLine && low === listingCategoryLine.toLowerCase()) continue;
      if (/^job details$/i.test(low)) continue;
      if (/^posted\b/i.test(low)) continue;
      if (/^view job posting$/i.test(low)) continue;
      if (line.length >= 35 && !descriptionLooksLikeApplyChrome(line)) {
        description = line;
        break;
      }
    }
  }

  if (!title && !description) return null;

  return {
    title: title || "",
    description: description || "",
    listingCategory: listingCategoryLine || "",
  };
}

function tryExpandUpworkSeeMore() {
  try {
    document.querySelectorAll("button,a").forEach((btn) => {
      const t = normalizeWs(btn.textContent || "").toLowerCase();
      if (t === "see more" || t === "view more") btn.click();
    });
  } catch (_e) {
    /* ignore */
  }
}

function extractUpworkJobData() {
  tryExpandUpworkSeeMore();

  const onApplyWizard = isUpworkProposalApplyPage();
  const jobDetailsPanel = extractJobDetailsPanel();

  const titleSelectors = onApplyWizard
    ? [
        "h1[data-test='job-title']",
        "[data-test='job-title']",
        "[data-qa='job-title']",
        "[data-ev-job-title]",
        "header h1",
        "h1",
        "h2",
      ]
    : [
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

  /** Never use generic `[data-test=description]` / bare `section` — they match bid/cover UI on apply pages. */
  const safeDescriptionFallbackSelectors = [
    "[data-test='job-description-text']",
    "[data-test='UpCLineClamp JobDescription']",
    "[data-test='job-description']",
    "[data-qa='job-description']",
  ];

  let titleRaw = firstMatch(titleSelectors);
  let title = sanitizeUpworkJobTitle(titleRaw) || normalizeWs(titleRaw);
  if (isBadNavJobTitle(title)) title = "";

  if (jobDetailsPanel?.title && normalizeWs(jobDetailsPanel.title).length >= 6) {
    title = sanitizeUpworkJobTitle(jobDetailsPanel.title);
  }

  let description = "";
  if (jobDetailsPanel?.description && normalizeWs(jobDetailsPanel.description).length >= 35) {
    description = stripApplyChromeLines(jobDetailsPanel.description);
  }

  if (!description || normalizeWs(description).length < 35) {
    const merged = mergeDescriptionChunks([
      "[data-test='job-description-text']",
      "[data-test='UpCLineClamp JobDescription']",
      "[data-test='job-description']",
    ]);
    const fromGather = gatherJobDescriptionCandidates();
    description = pickBestJobDescription(
      [...fromGather, ...(merged ? [merged] : [])].filter(Boolean),
    );
  }

  if (!description) {
    description = firstMatch(safeDescriptionFallbackSelectors);
  }

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
        const text = normalizeWs(cursor.textContent || "");
        if (
          text &&
          text.length > 10 &&
          !/skills and expertise|activity on this job|entry level|project type/i.test(
            text,
          ) &&
          !descriptionLooksLikeApplyChrome(text)
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

  description = stripApplyChromeLines(description || "");
  if (descriptionLooksLikeApplyChrome(description)) {
    description = "";
  }

  if (!title) {
    const headingCandidate = [...document.querySelectorAll("h1, h2, h3, h4")]
      .map((node) => normalizeWs(node.textContent || ""))
      .find(
        (text) =>
          text &&
          text.length > 3 &&
          text.length < 180 &&
          !/^summary$/i.test(text) &&
          !isBadNavJobTitle(text),
      );
    title = headingCandidate ? sanitizeUpworkJobTitle(headingCandidate) : "";
  }

  const pageText = (document.body?.innerText || "").replace(/\s+/g, " ").trim();
  const hourlyMatch = pageText.match(
    /\$ ?\d+(?:\.\d+)?\s*-\s*\$ ?\d+(?:\.\d+)?\s*\/\s*hr/i,
  );
  const fixedMatch = pageText.match(
    /\$ ?\d+(?:\.\d+)?(?:\s*-\s*\$ ?\d+(?:\.\d+)?)?\s*(?:fixed|fixed[- ]?price|budget)/i,
  );
  const paymentTypeHint = /\/\s*hr|hourly/i.test(pageText)
    ? "hourly"
    : /(fixed|fixed[- ]?price|budget)/i.test(pageText)
      ? "fixed"
      : "";
  const budgetText = (hourlyMatch?.[0] || fixedMatch?.[0] || "").trim();

  const url = window.location.href;

  const bodyText = normalizeWs(document.body?.innerText || "");
  const clientName = extractClientNamePublic();
  let jobSkills = extractSkillsPublic();
  if (jobDetailsPanel?.listingCategory) {
    jobSkills = uniqueStrings(
      [jobDetailsPanel.listingCategory, ...jobSkills],
      40,
    );
  }
  const proposalActivity = extractProposalActivityPublic(bodyText);
  const postedTime = extractPostedPublic(bodyText);
  const experienceLevel = extractExperiencePublic(bodyText);
  const projectTypeLabel = extractProjectTypePublic(bodyText);

  return {
    title,
    description,
    url,
    budgetText,
    paymentTypeHint,
    clientName,
    jobSkills,
    proposalActivity,
    postedTime,
    experienceLevel,
    projectTypeLabel,
  };
}

function buildPluginJobBody(job, tone, proposalLength) {
  return {
    job_title: job.title || "",
    job_description: job.description || "",
    job_url: job.url || "",
    tone: tone || FPO_DEFAULT_TONE,
    proposal_length: proposalLength || "medium",
    client_name: job.clientName || "",
    job_skills: Array.isArray(job.jobSkills) ? job.jobSkills : [],
    budget_display: job.budgetText || "",
    proposal_activity: job.proposalActivity || "",
    posted_time: job.postedTime || "",
    experience_level: job.experienceLevel || "",
    project_type_label: job.projectTypeLabel || "",
  };
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
  return new Promise((resolve) => {
    try {
      chrome.storage.local.get(keys, resolve);
    } catch (_err) {
      // Extension context can be invalidated after reload while tab stays open.
      // Return empty object so caller can fallback safely.
      resolve({});
    }
  });
}

function storageSet(payload) {
  return new Promise((resolve) => {
    try {
      chrome.storage.local.set(payload, resolve);
    } catch (_err) {
      // Best-effort in invalidated contexts; caller should continue without crashing.
      resolve();
    }
  });
}

function decodeJwtPayload(token) {
  try {
    const payload = token.split(".")[1];
    if (!payload) return null;
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
    return JSON.parse(atob(padded));
  } catch (_err) {
    return null;
  }
}

function extractUserIdFromToken(token) {
  const payload = decodeJwtPayload(token);
  if (!payload) return "";
  return payload.user_id || payload.uid || payload.sub || "";
}

function createPanelTemplate() {
  return `
    <div class="fpo-panel__header">
      <h2 class="fpo-title">AI Bidding Assistant</h2>
      <button class="fpo-close" id="fpoCloseBtn" aria-label="Close panel">×</button>
    </div>
    <div class="fpo-panel__content">
      <section class="fpo-section">
        <label class="fpo-label" for="fpoTone">Proposal tone</label>
        <select class="fpo-select" id="fpoTone">
          <option value="professional" selected>Professional</option>
          <option value="friendly">Friendly</option>
          <option value="confident">Confident</option>
          <option value="balanced">Balanced</option>
        </select>
      </section>

      <section class="fpo-section">
        <label class="fpo-label" for="fpoLength">Proposal length</label>
        <select class="fpo-select" id="fpoLength">
          <option value="short">Short</option>
          <option value="medium" selected>Medium</option>
          <option value="long">Long</option>
        </select>
      </section>

      <section class="fpo-section">
        <label class="fpo-label" for="fpoRiskLevel">Bid competitiveness</label>
        <select class="fpo-select" id="fpoRiskLevel">
          <option value="conservative">Conservative</option>
          <option value="balanced" selected>Balanced</option>
          <option value="aggressive">Competitive (higher bid)</option>
        </select>
        <p class="fpo-hint">Affects bid suggestion only, not proposal wording.</p>
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
        <p class="fpo-fit-breakdown" id="fpoFitBreakdown"></p>
        <p class="fpo-fit-note">
          Weighted blend of skill overlap, profile vs. job text signals, requirement coverage,
          and draft length/structure (rules on the server). Regenerate keeps the same job
          analysis so the score stays stable; only the draft slice may shift slightly.
        </p>
      </section>

      <section class="fpo-section">
        <h3>Bid Recommendation</h3>
        <p class="fpo-text" id="fpoBidHeadline">Generate to view bid guidance.</p>
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
          <button class="fpo-btn fpo-btn--muted" id="fpoShortenBtn">Make shorter</button>
          <button class="fpo-btn fpo-btn--muted" id="fpoCopyBtn">Copy Proposal</button>
        </div>
        <div class="fpo-row fpo-row--full" style="margin-top:8px;">
          <button class="fpo-btn fpo-btn--muted" id="fpoInsertBtn">Insert in Upwork</button>
        </div>
        <div class="fpo-feedback-row">
          <button class="fpo-btn fpo-btn--muted" id="fpoFeedbackGood">👍 Good</button>
          <button class="fpo-btn fpo-btn--muted" id="fpoFeedbackBad">👎 Bad</button>
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
  panel.className = "fpo-panel fpo-root";
  panel.innerHTML = createPanelTemplate();
  document.body.appendChild(panel);

  const closeBtn = panel.querySelector("#fpoCloseBtn");
  const toneEl = panel.querySelector("#fpoTone");
  const lengthEl = panel.querySelector("#fpoLength");
  const riskLevelEl = panel.querySelector("#fpoRiskLevel");
  const generateBtn = panel.querySelector("#fpoGenerateBtn");
  const regenerateBtn = panel.querySelector("#fpoRegenerateBtn");
  const shortenBtn = panel.querySelector("#fpoShortenBtn");
  const copyBtn = panel.querySelector("#fpoCopyBtn");
  const insertBtn = panel.querySelector("#fpoInsertBtn");
  const proposalEl = panel.querySelector("#fpoProposal");
  const keywordsEl = panel.querySelector("#fpoKeywords");
  const strategyEl = panel.querySelector("#fpoStrategy");
  const fitScoreEl = panel.querySelector("#fpoFitScore");
  const fitBreakdownEl = panel.querySelector("#fpoFitBreakdown");
  const bidHeadlineEl = panel.querySelector("#fpoBidHeadline");
  const variationsEl = panel.querySelector("#fpoVariations");
  const statusEl = panel.querySelector("#fpoStatus");
  const feedbackGoodBtn = panel.querySelector("#fpoFeedbackGood");
  const feedbackBadBtn = panel.querySelector("#fpoFeedbackBad");
  let lastProposalId = "";
  let lastJobId = "";
  let lastAnalysisCache = null;
  let lastJobPayload = null;
  let activeFeedback = 0;

  function setStatus(text, isError = false) {
    statusEl.textContent = text;
    statusEl.classList.toggle("is-error", isError);
  }

  function setLoading(loading) {
    generateBtn.disabled = loading;
    regenerateBtn.disabled = loading;
    shortenBtn.disabled = loading;
    copyBtn.disabled = loading;
    insertBtn.disabled = loading;
    feedbackGoodBtn.disabled = loading;
    feedbackBadBtn.disabled = loading;
  }

  function formatFitBreakdown(breakdown) {
    if (!breakdown || typeof breakdown !== "object") return "";
    const parts = [];
    if (breakdown.skills != null) parts.push(`Skills ${breakdown.skills}`);
    if (breakdown.experience != null) parts.push(`Experience ${breakdown.experience}`);
    if (breakdown.requirements != null) {
      parts.push(`Requirements ${breakdown.requirements}`);
    }
    if (breakdown.proposal != null) parts.push(`Draft ${breakdown.proposal}`);
    return parts.length ? parts.join(" · ") : "";
  }

  function setEmptyState() {
    fitScoreEl.textContent = "-";
    fitBreakdownEl.textContent = "";
    strategyEl.textContent = "No strategy yet.";
    keywordsEl.innerHTML = "<li>Generate to view keywords.</li>";
    variationsEl.innerHTML = "<li>No variations yet.</li>";
    bidHeadlineEl.textContent = "Generate to view bid guidance.";
    proposalEl.value = "";
    lastProposalId = "";
    activeFeedback = 0;
    feedbackGoodBtn.classList.remove("is-active");
    feedbackBadBtn.classList.remove("is-active");
  }

  async function loadPrefs() {
    const prefs = await storageGet([
      "preferredTone",
      "preferredProposalLength",
      "firebaseIdToken",
    ]);
    toneEl.value = prefs.preferredTone || FPO_DEFAULT_TONE;
    if (lengthEl && prefs.preferredProposalLength) {
      lengthEl.value = prefs.preferredProposalLength;
    }

    // Try to refresh token from page storage first; useful if user is logged in on same origin.
    const pageToken = extractFirebaseTokenFromPageStorage();
    if (pageToken) {
      await storageSet({ firebaseIdToken: pageToken });
    }
  }

  async function getToken() {
    const { firebaseIdToken } = await storageGet(["firebaseIdToken"]);
    if (firebaseIdToken) return firebaseIdToken;
    return extractFirebaseTokenFromPageStorage() || "";
  }

  function renderResult(result) {
    fitScoreEl.textContent = `${result.fit_score ?? "-"}%`;
    fitBreakdownEl.textContent = formatFitBreakdown(result.breakdown);
    if (result.analysis_cache) {
      lastAnalysisCache = result.analysis_cache;
    }
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
    lastProposalId = result.id || "";
    activeFeedback = 0;
    feedbackGoodBtn.classList.remove("is-active");
    feedbackBadBtn.classList.remove("is-active");
  }

  function renderBidAdvice(result) {
    const paymentType = result.payment_type || "hourly";
    const low = result.bid_range_low;
    const high = result.bid_range_high;
    const confidence = result.confidence ?? "-";
    let recommendation = "";
    if (paymentType === "fixed" && result.recommended_fixed_bid != null) {
      recommendation = `$${result.recommended_fixed_bid} fixed`;
    } else if (result.recommended_hourly_rate != null) {
      recommendation = `$${result.recommended_hourly_rate}/hr`;
    } else {
      recommendation = "No direct number suggested";
    }
    const rangeText =
      low != null && high != null ? ` (range: $${low} - $${high})` : "";
    bidHeadlineEl.textContent = `${recommendation}${rangeText} | Confidence: ${confidence}%`;
  }

  async function submitFeedback(rating) {
    try {
      if (!lastProposalId) {
        setStatus("Generate a proposal first to submit feedback.", true);
        return;
      }

      const prefsFb = await storageGet(["backendBaseUrl"]);
      const backendBaseUrl =
        (prefsFb.backendBaseUrl || "").trim() || FPO_DEFAULT_BACKEND;
      const token = await getToken();
      if (!token) {
        setStatus("No auth token found for feedback.", true);
        return;
      }
      const userId = extractUserIdFromToken(token);
      if (!userId) {
        setStatus("Could not extract user ID from token.", true);
        return;
      }

      const response = await fetch(`${backendBaseUrl}/v1/feedback`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          user_id: userId,
          proposal_id: lastProposalId,
          job_id: lastJobId || window.location.href,
          rating,
        }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(
          err.detail || `Feedback failed with status ${response.status}`,
        );
      }

      activeFeedback = rating;
      feedbackGoodBtn.classList.toggle("is-active", rating === 1);
      feedbackBadBtn.classList.toggle("is-active", rating === -1);
      setStatus(
        rating === 1
          ? "Thanks! Positive feedback saved."
          : "Feedback saved. We will improve.",
      );
    } catch (error) {
      setStatus(error.message || "Failed to submit feedback.", true);
    }
  }

  async function runAnalysis({ reuseAnalysis = false } = {}) {
    try {
      setLoading(true);
      setStatus("Extracting job details...");
      if (!reuseAnalysis) {
        setEmptyState();
        lastAnalysisCache = null;
      }

      const token = await getToken();
      if (!token) {
        throw new Error(
          "No auth token found. Open extension popup on your app tab and click Read Token first.",
        );
      }

      const tone = toneEl.value || FPO_DEFAULT_TONE;
      const proposalLength = lengthEl?.value || "medium";
      const prefs = await storageGet(["preferredTone", "backendBaseUrl"]);
      const backendBaseUrl =
        (prefs.backendBaseUrl || "").trim() || FPO_DEFAULT_BACKEND;
      await storageSet({
        preferredTone: tone,
        preferredProposalLength: proposalLength,
      });

      const job = extractUpworkJobData();
      lastJobId = job.url || window.location.href;
      if (!job.title && !job.description) {
        throw new Error(
          "Unable to extract job title/description from this Upwork page.",
        );
      }

      const scopeText = normalizeWs(job.description || "");
      if (!scopeText || scopeText.length < 60) {
        const applyHint = isUpworkProposalApplyPage()
          ? ' Expand any "See more" on the job summary on this apply page, or open the job posting view in another tab.'
          : "";
        throw new Error(
          `Could not capture enough job description from this screen.${applyHint} Wait for the page to load, scroll the job section into view, then generate again.`,
        );
      }

      const jobPayload = buildPluginJobBody(job, tone, proposalLength);
      lastJobPayload = jobPayload;

      const canReuse =
        reuseAnalysis &&
        lastAnalysisCache &&
        lastJobId &&
        lastJobId === (job.url || window.location.href);
      const analyzeBody = { ...jobPayload };
      if (canReuse) {
        analyzeBody.reuse_analysis = true;
        analyzeBody.analysis_cache = lastAnalysisCache;
        setStatus("Regenerating proposal (same job analysis)...");
      } else {
        setStatus("Analyzing with backend...");
      }

      const response = await fetch(`${backendBaseUrl}/plugin/analyze-job`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(analyzeBody),
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
      setStatus("Generating bid recommendation...");
      const bidResponse = await fetch(
        `${backendBaseUrl}/plugin/recommend-bid`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            ...jobPayload,
            fit_score: data.fit_score,
            client_budget_text: job.budgetText || "",
            payment_type_hint: job.paymentTypeHint || "",
            risk_level: riskLevelEl.value || "balanced",
          }),
        },
      );
      if (bidResponse.ok) {
        const bidData = await bidResponse.json();
        renderBidAdvice(bidData);
      } else {
        const bidErr = await bidResponse.json().catch(() => ({}));
        bidHeadlineEl.textContent =
          "Bid recommendation unavailable for this job.";
        setStatus(bidErr.detail || "Could not generate bid advice.", true);
      }
      setStatus("Done. You can copy or insert the proposal.");
    } catch (error) {
      const rawMessage = error?.message || "Failed to analyze job.";
      if (rawMessage.includes("Extension context invalidated")) {
        setStatus(
          "Extension was reloaded. Refresh this Upwork tab once, then click Generate again.",
          true,
        );
      } else {
        setStatus(rawMessage, true);
      }
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
  async function shortenProposal() {
    try {
      const draft = proposalEl.value.trim();
      if (!draft) {
        setStatus("Generate or paste a proposal first.", true);
        return;
      }
      if (!lastJobPayload) {
        setStatus("Run Generate on this job first.", true);
        return;
      }

      setLoading(true);
      setStatus("Shortening proposal...");

      const token = await getToken();
      if (!token) {
        throw new Error(
          "No auth token found. Open extension popup on your app tab and click Read Token first.",
        );
      }

      const prefs = await storageGet(["backendBaseUrl"]);
      const backendBaseUrl =
        (prefs.backendBaseUrl || "").trim() || FPO_DEFAULT_BACKEND;

      const response = await fetch(`${backendBaseUrl}/plugin/shorten-proposal`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          job_title: lastJobPayload.job_title,
          job_description: lastJobPayload.job_description,
          job_url: lastJobPayload.job_url,
          tone: toneEl.value || FPO_DEFAULT_TONE,
          proposal_text: draft,
          analysis_cache: lastAnalysisCache || undefined,
        }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(
          err.detail || `Shorten failed with status ${response.status}`,
        );
      }

      const data = await response.json();
      proposalEl.value = data.proposal || draft;
      if (data.fit_score != null) {
        fitScoreEl.textContent = `${data.fit_score}%`;
        fitBreakdownEl.textContent = formatFitBreakdown(data.breakdown);
      }
      setStatus("Proposal shortened.");
    } catch (error) {
      setStatus(error.message || "Failed to shorten proposal.", true);
    } finally {
      setLoading(false);
    }
  }

  generateBtn.addEventListener("click", () => runAnalysis({ reuseAnalysis: false }));
  regenerateBtn.addEventListener("click", () =>
    runAnalysis({ reuseAnalysis: true }),
  );
  shortenBtn.addEventListener("click", shortenProposal);
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
  feedbackGoodBtn.addEventListener("click", () => submitFeedback(1));
  feedbackBadBtn.addEventListener("click", () => submitFeedback(-1));

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

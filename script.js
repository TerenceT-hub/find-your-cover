/* =====================================================================
   CONFIG — edit these three values for your own setup
===================================================================== */
const CONFIG = {
  // Paste your Google Apps Script Web App URL here (see README.md, Part 2)
  GOOGLE_SHEET_ENDPOINT: "https://script.google.com/macros/s/AKfycbwPQOhf6R_bp4TglDCNQJjXmDlHXztIJV-Hc3zvxgNMVi2mZ2rFkLs8j5UD7I6vRWuPWA/exec",

  // Your WhatsApp number in international format, no + no spaces, e.g. 60123456789
  WHATSAPP_NUMBER: "60126739328",

  // Shown in the WhatsApp message
  AGENT_NAME: "Terence",
};

/* =====================================================================
   THEME
===================================================================== */
(function initTheme() {
  const saved = localStorage.getItem("theme");
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const theme = saved || (prefersDark ? "dark" : "light");
  document.documentElement.setAttribute("data-theme", theme);
})();

document.getElementById("themeToggle").addEventListener("click", () => {
  const current = document.documentElement.getAttribute("data-theme");
  const next = current === "dark" ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", next);
  localStorage.setItem("theme", next);
});

/* =====================================================================
   STATE
===================================================================== */
const state = {
  flowType: "quote", // 'quote' | 'review'
  interests: [],
  reviewInterests: [],
  medical: { existing: null, coverage: "", expected: "" },
  life: { existing: null, coverage: "", expected: "" },
  savings: { existing: null, coverage: "", expected: "" },
  pa: { existing: null, coverage: "", expected: "" },
  personal: { name: "", dob: "", gender: null, occupation: "" },
  budget: { amount: "", frequency: null },
  consent: false,
};

let stepOrder = [];
let currentIndex = 0;

const PRODUCT_STEP_MAP = {
  "Medical Card": "medical",
  "Life": "life",
  "Savings": "savings",
  "Personal Accident": "pa",
};
const PRODUCT_ORDER = ["Medical Card", "Life", "Savings", "Personal Accident"];

/* =====================================================================
   NAVIGATION: landing -> wizard
===================================================================== */
function goToWizard(flowType) {
  state.flowType = flowType;
  document.querySelector('[data-screen="landing"]').classList.remove("active");
  document.querySelector('[data-screen="wizard"]').classList.add("active");
  buildStepOrder();
  currentIndex = 0;
  renderStep();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

document.getElementById("startQuoteBtn").addEventListener("click", () => goToWizard("quote"));
document.getElementById("startReviewBtn").addEventListener("click", () => goToWizard("review"));
document.getElementById("reviewStripBtn").addEventListener("click", () => goToWizard("review"));
document.getElementById("restartBtn").addEventListener("click", resetAndGoHome);

function resetAndGoHome() {
  // wipe state back to defaults
  state.flowType = "quote";
  state.interests = [];
  state.reviewInterests = [];
  state.medical = { existing: null, coverage: "", expected: "" };
  state.life = { existing: null, coverage: "", expected: "" };
  state.savings = { existing: null, coverage: "", expected: "" };
  state.pa = { existing: null, coverage: "", expected: "" };
  state.personal = { name: "", dob: "", gender: null, occupation: "" };
  state.budget = { amount: "", frequency: null };
  state.consent = false;

  // clear every input in the wizard
  document.querySelectorAll('.wizard input[type="checkbox"]').forEach((el) => (el.checked = false));
  document.querySelectorAll('.wizard input[type="text"], .wizard input[type="date"]').forEach(
    (el) => (el.value = "")
  );
  document.querySelectorAll(".toggle-btn").forEach((btn) => btn.classList.remove("selected"));
  document.querySelectorAll(".reveal").forEach((el) => el.classList.remove("show"));

  document.querySelector(".step-nav").style.display = "flex";

  // back to the landing screen
  document.querySelector('[data-screen="wizard"]').classList.remove("active");
  document.querySelector('[data-screen="landing"]').classList.add("active");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function buildStepOrder() {
  if (state.flowType === "review") {
    stepOrder = ["reviewpicker", "personal", "privacy", "review", "done"];
  } else {
    const productSteps = PRODUCT_ORDER
      .filter((p) => state.interests.includes(p))
      .map((p) => PRODUCT_STEP_MAP[p]);
    stepOrder = ["products", ...productSteps, "personal", "budget", "privacy", "review", "done"];
  }
}

/* =====================================================================
   RENDER
===================================================================== */
const stepEls = Array.from(document.querySelectorAll(".step"));
const prevBtn = document.getElementById("prevBtn");
const nextBtn = document.getElementById("nextBtn");
const progressFill = document.getElementById("progressFill");
const progressLabel = document.getElementById("progressLabel");

function renderStep() {
  const stepName = stepOrder[currentIndex];

  stepEls.forEach((el) => el.classList.toggle("active", el.dataset.step === stepName));

  // progress
  const totalMinusDone = stepOrder.length - 1; // exclude "done" from progress math
  const pct = Math.min(100, Math.round((currentIndex / totalMinusDone) * 100));
  progressFill.style.width = pct + "%";
  progressLabel.textContent =
    stepName === "done" ? "Complete" : `Step ${currentIndex + 1} of ${totalMinusDone}`;

  // nav buttons
  prevBtn.style.visibility = "visible";
  prevBtn.textContent = currentIndex === 0 ? "← Back to Home" : "← Back";

  if (stepName === "review") {
    nextBtn.textContent = "Send to WhatsApp";
    renderSummary();
  } else if (stepName === "done") {
    document.querySelector(".step-nav").style.display = "none";
  } else {
    nextBtn.textContent = "Continue";
    document.querySelector(".step-nav").style.display = "flex";
  }
}

prevBtn.addEventListener("click", () => {
  if (currentIndex === 0) {
    goBackToLanding();
    return;
  }
  currentIndex -= 1;
  renderStep();
  window.scrollTo({ top: 0, behavior: "smooth" });
});

function goBackToLanding() {
  document.querySelector('[data-screen="wizard"]').classList.remove("active");
  document.querySelector('[data-screen="landing"]').classList.add("active");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

nextBtn.addEventListener("click", () => {
  const stepName = stepOrder[currentIndex];
  if (!validateStep(stepName)) return;

  if (stepName === "review") {
    submitAndRedirect();
    return;
  }

  if (currentIndex < stepOrder.length - 1) {
    currentIndex += 1;
    renderStep();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
});

/* =====================================================================
   PRODUCT CHECKBOXES (main quote flow)
===================================================================== */
document.querySelectorAll('#productChoices input[type="checkbox"]').forEach((cb) => {
  cb.addEventListener("change", () => {
    state.interests = Array.from(
      document.querySelectorAll('#productChoices input[type="checkbox"]:checked')
    ).map((el) => el.value);
  });
});

document.querySelectorAll('#reviewChoices input[type="checkbox"]').forEach((cb) => {
  cb.addEventListener("change", () => {
    state.reviewInterests = Array.from(
      document.querySelectorAll('#reviewChoices input[type="checkbox"]:checked')
    ).map((el) => el.value);
  });
});

/* =====================================================================
   TOGGLE BUTTON GROUPS (Yes/No, Gender)
===================================================================== */
document.querySelectorAll(".toggle-row").forEach((row) => {
  const group = row.dataset.group;
  row.querySelectorAll(".toggle-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      row.querySelectorAll(".toggle-btn").forEach((b) => b.classList.remove("selected"));
      btn.classList.add("selected");
      handleToggleSelection(group, btn.dataset.value);
    });
  });
});

function handleToggleSelection(group, value) {
  switch (group) {
    case "medicalExisting":
      state.medical.existing = value;
      toggleReveal("medical", value);
      break;
    case "lifeExisting":
      state.life.existing = value;
      toggleReveal("life", value);
      break;
    case "savingsExisting":
      state.savings.existing = value;
      toggleReveal("savings", value);
      break;
    case "paExisting":
      state.pa.existing = value;
      toggleReveal("pa", value);
      break;
    case "gender":
      state.personal.gender = value;
      break;
    case "budgetFrequency":
      state.budget.frequency = value;
      break;
  }
}

function toggleReveal(prefix, value) {
  const yesEl = document.querySelector(`[data-reveal="${prefix}-yes"]`);
  const noEl = document.querySelector(`[data-reveal="${prefix}-no"]`);
  if (yesEl) yesEl.classList.toggle("show", value === "Yes");
  if (noEl) noEl.classList.toggle("show", value === "No");
}

/* =====================================================================
   TEXT INPUT BINDINGS
===================================================================== */
const bindings = [
  ["medicalCoverage", () => (state.medical.coverage = getVal("medicalCoverage"))],
  ["medicalExpected", () => (state.medical.expected = getVal("medicalExpected"))],
  ["lifeCoverage", () => (state.life.coverage = getVal("lifeCoverage"))],
  ["lifeExpected", () => (state.life.expected = getVal("lifeExpected"))],
  ["savingsCoverage", () => (state.savings.coverage = getVal("savingsCoverage"))],
  ["savingsExpected", () => (state.savings.expected = getVal("savingsExpected"))],
  ["paCoverage", () => (state.pa.coverage = getVal("paCoverage"))],
  ["paExpected", () => (state.pa.expected = getVal("paExpected"))],
  ["fullName", () => (state.personal.name = getVal("fullName"))],
  ["dob", () => (state.personal.dob = getVal("dob"))],
  ["occupation", () => (state.personal.occupation = getVal("occupation"))],
  ["budgetAmount", () => (state.budget.amount = getVal("budgetAmount"))],
];
bindings.forEach(([id, fn]) => {
  const el = document.getElementById(id);
  if (el) el.addEventListener("input", fn);
});
function getVal(id) {
  const el = document.getElementById(id);
  return el ? el.value.trim() : "";
}

document.getElementById("consentCheck").addEventListener("change", (e) => {
  state.consent = e.target.checked;
});

/* =====================================================================
   VALIDATION
===================================================================== */
function validateStep(stepName) {
  switch (stepName) {
    case "products":
      if (state.interests.length === 0) return alertUser("Pick at least one product to continue.");
      return true;
    case "reviewpicker":
      if (state.reviewInterests.length === 0) return alertUser("Pick at least one to continue.");
      return true;
    case "medical":
      return validateProductStep(state.medical);
    case "life":
      return validateProductStep(state.life);
    case "savings":
      return validateProductStep(state.savings);
    case "pa":
      return validateProductStep(state.pa);
    case "personal":
      if (!state.personal.name) return alertUser("Please enter your name.");
      if (!state.personal.dob) return alertUser("Please enter your date of birth.");
      if (!state.personal.gender) return alertUser("Please select your gender.");
      if (!state.personal.occupation) return alertUser("Please enter your occupation.");
      return true;
    case "budget":
      if (!state.budget.amount) return alertUser("Please enter a budget amount.");
      if (!state.budget.frequency) return alertUser("Please select Monthly or Annual.");
      return true;
    case "privacy":
      if (!state.consent) return alertUser("Please tick the box to confirm you're comfortable continuing.");
      return true;
    default:
      return true;
  }
}

function validateProductStep(obj) {
  if (!obj.existing) return alertUser("Please select Yes or No.");
  if (obj.existing === "Yes" && !obj.coverage) return alertUser("Please tell us your current coverage.");
  if (obj.existing === "No" && !obj.expected) return alertUser("Please tell us how much you'd like to cover.");
  return true;
}

function alertUser(msg) {
  showToastLikeError(msg);
  return false;
}

function showToastLikeError(msg) {
  let toast = document.getElementById("inlineToast");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "inlineToast";
    toast.style.cssText =
      "position:fixed;bottom:24px;left:50%;transform:translateX(-50%);" +
      "background:var(--accent);color:var(--accent-text);padding:12px 22px;" +
      "border-radius:980px;font-size:14px;font-weight:600;z-index:100;" +
      "box-shadow:var(--shadow);transition:opacity .3s;";
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.style.opacity = "1";
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => (toast.style.opacity = "0"), 2600);
}

/* =====================================================================
   SUMMARY (review step)
===================================================================== */
function renderSummary() {
  const card = document.getElementById("summaryCard");
  let html = "";

  if (state.flowType === "review") {
    html += summaryGroup("Requesting a free review on", state.reviewInterests.join(", ") || "—");
  } else {
    html += summaryGroup("Interested in", state.interests.join(", ") || "—");
    if (state.interests.includes("Medical Card")) html += productSummary("Medical Card", state.medical);
    if (state.interests.includes("Life")) html += productSummary("Life", state.life);
    if (state.interests.includes("Savings")) html += productSummary("Savings", state.savings);
    if (state.interests.includes("Personal Accident")) html += productSummary("Personal Accident", state.pa);
  }

  html += summaryGroup(
    "Your details",
    `${state.personal.name} · ${state.personal.dob} · ${state.personal.gender} · ${state.personal.occupation}`
  );

  if (state.flowType === "quote") {
    html += summaryGroup(
      "Budget allocation",
      state.budget.amount ? `${state.budget.amount} (${state.budget.frequency || "—"})` : "—"
    );
  }

  card.innerHTML = html;
}

function productSummary(label, obj) {
  let detail;
  if (obj.existing === "Yes") {
    detail = `Existing — covered for ${obj.coverage || "—"}`;
  } else if (obj.existing === "No") {
    detail = `New — would like to cover ${obj.expected || "—"}`;
  } else {
    detail = "—";
  }
  return summaryGroup(label, detail);
}

function summaryGroup(title, detail) {
  return `<div class="summary-group"><span class="summary-title">${escapeHtml(title)}</span>${escapeHtml(detail)}</div>`;
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (m) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[m]));
}

/* =====================================================================
   SUBMIT: Google Sheet + WhatsApp
===================================================================== */
function submitAndRedirect() {
  nextBtn.disabled = true;
  nextBtn.textContent = "Sending…";

  const payload = buildPayload();

  sendToGoogleSheet(payload).finally(() => {
    const waLink = buildWhatsAppLink(payload);
    document.getElementById("waFallbackBtn").href = waLink;

    currentIndex = stepOrder.indexOf("done");
    renderStep();

    window.open(waLink, "_blank");

    nextBtn.disabled = false;
    nextBtn.textContent = "Send to WhatsApp";
  });
}

function buildPayload() {
  return {
    timestamp: new Date().toISOString(),
    flowType: state.flowType,
    name: state.personal.name,
    dob: state.personal.dob,
    gender: state.personal.gender,
    occupation: state.personal.occupation,
    interests: state.interests.join(", "),
    reviewInterests: state.reviewInterests.join(", "),
    medicalExisting: state.medical.existing || "",
    medicalCoverage: state.medical.coverage,
    medicalExpected: state.medical.expected,
    lifeExisting: state.life.existing || "",
    lifeCoverage: state.life.coverage,
    lifeExpected: state.life.expected,
    savingsExisting: state.savings.existing || "",
    savingsCoverage: state.savings.coverage,
    savingsExpected: state.savings.expected,
    paExisting: state.pa.existing || "",
    paCoverage: state.pa.coverage,
    paExpected: state.pa.expected,
    budgetAmount: state.budget.amount,
    budgetFrequency: state.budget.frequency || "",
  };
}

function sendToGoogleSheet(payload) {
  if (!CONFIG.GOOGLE_SHEET_ENDPOINT || CONFIG.GOOGLE_SHEET_ENDPOINT.includes("PASTE_YOUR")) {
    console.warn("Google Sheet endpoint not configured — skipping save.");
    return Promise.resolve();
  }
  const formData = new URLSearchParams();
  Object.entries(payload).forEach(([k, v]) => formData.append(k, v));

  // Apps Script web apps don't return readable CORS responses from a static
  // site, so we fire with no-cors and treat the request as fire-and-forget.
  return fetch(CONFIG.GOOGLE_SHEET_ENDPOINT, {
    method: "POST",
    mode: "no-cors",
    body: formData,
  }).catch((err) => console.error("Sheet submission failed:", err));
}

function buildWhatsAppLink(p) {
  let lines = [`Hi ${CONFIG.AGENT_NAME}, I'd like to talk about my coverage.`, ""];

  if (p.flowType === "review") {
    lines.push(`I'd like a free Policy Review on: ${p.reviewInterests}`);
  } else {
    lines.push(`I'm interested in: ${p.interests}`);
    if (p.medicalExisting) {
      lines.push(
        p.medicalExisting === "Yes"
          ? `- Medical Card: existing, covered ${p.medicalCoverage}`
          : `- Medical Card: new, would like to cover ${p.medicalExpected}`
      );
    }
    if (p.lifeExisting) {
      lines.push(
        p.lifeExisting === "Yes"
          ? `- Life: existing, covered ${p.lifeCoverage}`
          : `- Life: new, would like to cover ${p.lifeExpected}`
      );
    }
    if (p.savingsExisting) {
      lines.push(
        p.savingsExisting === "Yes"
          ? `- Savings: existing, covered ${p.savingsCoverage}`
          : `- Savings: new, would like to cover ${p.savingsExpected}`
      );
    }
    if (p.paExisting) {
      lines.push(
        p.paExisting === "Yes"
          ? `- Personal Accident: existing, covered ${p.paCoverage}`
          : `- Personal Accident: new, would like to cover ${p.paExpected}`
      );
    }
    lines.push(`Budget allocation: ${p.budgetAmount} (${p.budgetFrequency})`);
  }

  lines.push("", `Name: ${p.name}`, `DOB: ${p.dob}`, `Gender: ${p.gender}`, `Occupation: ${p.occupation}`);

  const text = encodeURIComponent(lines.join("\n"));
  return `https://wa.me/${CONFIG.WHATSAPP_NUMBER}?text=${text}`;
}

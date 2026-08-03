/* =====================================================================
   CONFIG — edit these three values for your own setup
===================================================================== */
const CONFIG = {
  // Paste your Google Apps Script Web App URL here (see README.md, Part 2)
  GOOGLE_SHEET_ENDPOINT: "https://script.google.com/macros/s/AKfycbyT5qM9k4G6AsM9giVE9GZOEF8rB8mQfti3EG3y7HuFrTCuz90OzYMPbL52UFZ8iNLLUg/exec",

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
  medical: { existing: null, coverage: "", budget: "", expected: "" },
  life: { existing: null, coverage: "", budget: "", expected: "" },
  savings: { existing: null, coverage: "", budget: "" },
  pa: { existing: null, coverage: "", budget: "", expected: "" },
  personal: { name: "", dob: "", gender: null, occupation: "" },
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

function buildStepOrder() {
  if (state.flowType === "review") {
    stepOrder = ["reviewpicker", "personal", "privacy", "review", "done"];
  } else {
    const productSteps = PRODUCT_ORDER
      .filter((p) => state.interests.includes(p))
      .map((p) => PRODUCT_STEP_MAP[p]);
    stepOrder = ["products", ...productSteps, "personal", "privacy", "review", "done"];
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
  prevBtn.style.visibility = currentIndex === 0 ? "hidden" : "visible";

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
  if (currentIndex > 0) {
    currentIndex -= 1;
    renderStep();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
});

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
  ["medicalBudget", () => (state.medical.budget = getVal("medicalBudget"))],
  ["medicalExpected", () => (state.medical.expected = getVal("medicalExpected"))],
  ["lifeCoverage", () => (state.life.coverage = getVal("lifeCoverage"))],
  ["lifeBudget", () => (state.life.budget = getVal("lifeBudget"))],
  ["lifeExpected", () => (state.life.expected = getVal("lifeExpected"))],
  ["savingsCoverage", () => (state.savings.coverage = getVal("savingsCoverage"))],
  ["savingsBudget", () => (state.savings.budget = getVal("savingsBudget"))],
  ["paCoverage", () => (state.pa.coverage = getVal("paCoverage"))],
  ["paBudget", () => (state.pa.budget = getVal("paBudget"))],
  ["paExpected", () => (state.pa.expected = getVal("paExpected"))],
  ["fullName", () => (state.personal.name = getVal("fullName"))],
  ["dob", () => (state.personal.dob = getVal("dob"))],
  ["occupation", () => (state.personal.occupation = getVal("occupation"))],
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
      return validateProductStep(state.medical, "medical");
    case "life":
      return validateProductStep(state.life, "life");
    case "savings":
      return validateSavingsStep();
    case "pa":
      return validateProductStep(state.pa, "pa");
    case "personal":
      if (!state.personal.name) return alertUser("Please enter your name.");
      if (!state.personal.dob) return alertUser("Please enter your date of birth.");
      if (!state.personal.gender) return alertUser("Please select your gender.");
      if (!state.personal.occupation) return alertUser("Please enter your occupation.");
      return true;
    case "privacy":
      if (!state.consent) return alertUser("Please tick the box to confirm you're comfortable continuing.");
      return true;
    default:
      return true;
  }
}

function validateProductStep(obj, prefix) {
  if (!obj.existing) return alertUser("Please select Yes or No.");
  if (obj.existing === "Yes" && !obj.coverage) return alertUser("Please tell us your current coverage.");
  if (obj.existing === "No" && (!obj.budget || !obj.expected))
    return alertUser("Please fill in both your budget and expected coverage.");
  return true;
}

function validateSavingsStep() {
  const obj = state.savings;
  if (!obj.existing) return alertUser("Please select Yes or No.");
  if (obj.existing === "Yes" && !obj.coverage) return alertUser("Please tell us your current coverage.");
  if (obj.existing === "No" && !obj.budget) return alertUser("Please fill in your budget.");
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

  card.innerHTML = html;
}

function productSummary(label, obj) {
  let detail;
  if (obj.existing === "Yes") {
    detail = `Existing — covered for ${obj.coverage || "—"}`;
  } else if (obj.existing === "No") {
    detail = obj.expected
      ? `New — budget ${obj.budget || "—"}, hoping for ${obj.expected}`
      : `New — budget ${obj.budget || "—"}`;
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
    medicalBudget: state.medical.budget,
    medicalExpected: state.medical.expected,
    lifeExisting: state.life.existing || "",
    lifeCoverage: state.life.coverage,
    lifeBudget: state.life.budget,
    lifeExpected: state.life.expected,
    savingsExisting: state.savings.existing || "",
    savingsCoverage: state.savings.coverage,
    savingsBudget: state.savings.budget,
    paExisting: state.pa.existing || "",
    paCoverage: state.pa.coverage,
    paBudget: state.pa.budget,
    paExpected: state.pa.expected,
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
          : `- Medical Card: new, budget ${p.medicalBudget}, hoping for ${p.medicalExpected}`
      );
    }
    if (p.lifeExisting) {
      lines.push(
        p.lifeExisting === "Yes"
          ? `- Life: existing, covered ${p.lifeCoverage}`
          : `- Life: new, budget ${p.lifeBudget}, hoping for ${p.lifeExpected}`
      );
    }
    if (p.savingsExisting) {
      lines.push(
        p.savingsExisting === "Yes"
          ? `- Savings: existing, covered ${p.savingsCoverage}`
          : `- Savings: new, budget ${p.savingsBudget}`
      );
    }
    if (p.paExisting) {
      lines.push(
        p.paExisting === "Yes"
          ? `- Personal Accident: existing, covered ${p.paCoverage}`
          : `- Personal Accident: new, budget ${p.paBudget}, hoping for ${p.paExpected}`
      );
    }
  }

  lines.push("", `Name: ${p.name}`, `DOB: ${p.dob}`, `Gender: ${p.gender}`, `Occupation: ${p.occupation}`);

  const text = encodeURIComponent(lines.join("\n"));
  return `https://wa.me/${CONFIG.WHATSAPP_NUMBER}?text=${text}`;
}

import {
  slugifyEmail,
  listSubmissions,
  addSubmission,
  listLinkedPatientIds,
  listChatMessages,
  getShareChatConsent,
  getSharePartnerConsent,
  getShareChildrenConsent,
} from "./storage.js";
import { buildPatientSummary } from "./summary.js";
import { validateCheckinAnswers } from "./checkinValidation.js";
import {
  renderDoctorResearchBody,
  renderResearchPageHead,
  hydrateScRnaDeep,
  initResearchToc,
  initScRnaInventoryFilters,
} from "./researchPage.js";
import { renderLabLookupSection, initLabLookup } from "./researchLabLookup.js";
import { initPhenotypeContext } from "./researchPhenotypeContext.js";
import {
  renderPatientWellbeingPanel,
  initPatientWellbeingPanel,
} from "./patientWellbeingContext.js";
import { renderVisitQuestionsPanel, initVisitQuestionsPanel } from "./visitQuestions.js";
import { renderVisitBriefPage, initVisitBriefPage } from "./visitBrief.js";
import { renderFamilyExplainPage, initFamilyExplainPage } from "./familyExplain.js";
import {
  renderFindHumanHelpPage,
  renderHumanSupportFootnote,
} from "./humanSupportLadder.js";
import {
  renderScreeningPage,
  initScreeningPage,
  parseScreeningBarrierFromHash,
} from "./screeningPage.js";
import { renderBetweenVisitPromptCards } from "./betweenVisitHome.js";
import {
  renderCaregiverHome,
  renderCaregiverLinkPage,
  initCaregiverHome,
  caregiverShareEnabled,
} from "./caregiverPage.js";
import { loadBetweenVisit } from "./betweenVisitStore.js";

const DOCTOR_SELECTED_PATIENT_KEY = "hearher.doctor.selectedPatient";
import { mountPatientChat } from "./patientChatPage.js";
import { renderMobileTabBar, initPlatform, applyMobileShellClasses } from "./platform.js";
import { mountLearnPage } from "./learnPage.js";
import { mountLuneApp, isLuneRoute } from "./lune/mountLuneApp.js";
import {
  renderDoctorModItem,
  normalizeModerationPayload,
} from "./communityModerationUi.js";
import { listRejectedPosts } from "./communityStorage.js";
import { apiFetch } from "./backend.js";
import {
  PRODUCT_NAME,
  PRODUCT_TAGLINE,
  TEAM_CREDIT,
  renderBrandLockup,
  renderHeaderBrand,
  renderProductFooter,
} from "./branding.js";
import {
  initPortal,
  isApiMode,
  getSession,
  setLocalOnlySession,
  clearAllSession,
  refreshApiSession,
  apiRegister,
  apiLogin,
  fetchMySubmissions,
  fetchMyTrashedSubmissions,
  retractSubmissionUnified,
  restoreSubmissionUnified,
  purgeSubmissionUnified,
  fetchDoctorPatients,
  fetchDoctorPatientSubmissions,
  linkPatientUnified,
  apiCreateSubmission,
  getChatConsent,
  setChatConsentUnified,
  fetchChatMessagesUnified,
  appendChatMessageUnified,
  clearChatUnified,
  fetchDoctorPatientChat,
  fetchDoctorClinicalRecords,
  fetchMyClinicalRecords,
  createDoctorClinicalRecord,
  fetchDoctorExportManifest,
  syncDoctorExports,
  setCaregiverConsentUnified,
  syncBetweenVisitSnapshot,
  fetchCaregiverPatients,
  linkCaregiverPatientUnified,
  fetchCaregiverPatientSnapshot,
  fetchDoctorPatientSnapshot,
  fetchDirectMessageContacts,
  fetchDirectMessagesUnified,
  sendDirectMessageUnified,
} from "./sessionManager.js";
import {
  parseDoctorView,
  renderDoctorShell,
  renderDoctorDashboardOverview,
  renderDoctorBetweenVisitPanel,
  renderDoctorNoSelection,
  bindDoctorPatientRail,
  setDoctorPortalBodyClass,
} from "./doctorPage.js";
import {
  renderDirectChatPanel,
  renderPatientMessagesPage,
  renderCaregiverDirectChatPage,
  bindDirectChatForm,
  scrollDirectChatToBottom,
} from "./directMessagesPage.js";
import {
  downloadServerExportFile,
  exportAllLinkedPatientsCsv,
  exportPatientBundleCsv,
} from "./csvExport.js";

const CLINICAL_DIAGNOSIS_SUGGESTIONS = [
  "Breast cancer",
  "DCIS",
  "Metastatic breast cancer",
  "In active treatment",
  "Survivorship follow-up",
  "Other / pending workup",
];

function navIsActive(href) {
  const hash = (location.hash || "#/login").split("?")[0];
  const base = href.split("?")[0];
  if (base === "#/patient") return hash === "#/patient";
  if (base === "#/patient/checkin") {
    return hash === "#/patient/checkin" || hash.startsWith("#/patient/checkins");
  }
  if (base === "#/patient/community") return hash.startsWith("#/patient/community");
  if (base === "#/patient/lune") return hash.startsWith("#/patient/lune");
  if (base === "#/patient/messages") return hash.startsWith("#/patient/messages");
  if (base === "#/doctor") return hash === "#/doctor" || hash.startsWith("#/doctor/");
  if (base === "#/caregiver") {
    return hash === "#/caregiver" || hash.startsWith("#/caregiver?");
  }
  if (base === "#/caregiver/community") return hash.startsWith("#/caregiver/community");
  if (base === "#/caregiver/lune") return hash.startsWith("#/caregiver/lune");
  if (base === "#/caregiver/chat") return hash.startsWith("#/caregiver/chat");
  if (base === "#/caregiver/link") return hash.startsWith("#/caregiver/link");
  return hash === base;
}

function navLink(href, label) {
  const cls = navIsActive(href) ? "nav-link is-active" : "nav-link";
  return `<a href="${href}" class="${cls}">${escapeHtml(label)}</a>`;
}

const HOME_ACTION_ICONS = {
  support: `<svg class="home-action-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" aria-hidden="true"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>`,
  checkin: `<svg class="home-action-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" aria-hidden="true"><path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/><path d="M9 12h6M9 16h4"/></svg>`,
  learn: `<svg class="home-action-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" aria-hidden="true"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/><path d="M8 7h8M8 11h6"/></svg>`,
  community: `<svg class="home-action-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" aria-hidden="true"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>`,
};

function homeGreeting(displayName) {
  const h = new Date().getHours();
  const part = h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
  const first = (displayName || "").trim().split(/\s+/)[0] || "there";
  return `${part}, ${first}`;
}

function renderHomeStats(subs, clinicalCount) {
  const checkinCount = subs.length;
  const lastAt = checkinCount ? subs[0].submittedAt : null;
  const lastLabel = lastAt ? formatCheckinWhen(lastAt) : "—";
  return `
    <div class="home-stats">
      <div class="home-stat">
        <span class="home-stat-value">${checkinCount}</span>
        <span class="home-stat-label">Check-ins</span>
      </div>
      <div class="home-stat">
        <span class="home-stat-value home-stat-value--text">${escapeHtml(lastLabel)}</span>
        <span class="home-stat-label">Latest entry</span>
      </div>
      <div class="home-stat">
        <span class="home-stat-value">${clinicalCount}</span>
        <span class="home-stat-label">Clinician records</span>
      </div>
    </div>`;
}

function renderPatientQuickActions() {
  const items = [
    { href: "#/patient/chat", title: "Between visits", desc: "Feelings, hard questions, visit prep", featured: true, theme: "support", icon: "support" },
    { href: "#/patient/checkin", title: "Wellness log", desc: "Mood, sleep & side effects between visits", featured: false, theme: "checkin", icon: "checkin" },
    { href: "#/patient/learn", title: "Calm & learn", desc: "Breathing exercises, visit prep & caregiver tips", featured: false, theme: "learn", icon: "learn" },
    { href: "#/patient/lune/witnesses", title: "Peer support", desc: "Lune community — moderated, not medical advice", featured: false, theme: "community", icon: "community" },
  ];
  return `<div class="home-actions">${items
    .map(
      (item) =>
        `<a href="${item.href}" class="home-action-card home-action--${item.theme}${item.featured ? " is-featured" : ""}">
          <span class="home-action-icon-wrap" aria-hidden="true">${HOME_ACTION_ICONS[item.icon]}</span>
          <span class="home-action-body">
            <span class="home-action-title">${escapeHtml(item.title)}</span>
            <span class="home-action-desc">${escapeHtml(item.desc)}</span>
          </span>
          <span class="home-action-arrow" aria-hidden="true">→</span>
        </a>`
    )
    .join("")}</div>`;
}

function renderHeader(session) {
  const navPatient =
    session?.role === "patient"
      ? [
          navLink("#/patient", "Home"),
          navLink("#/patient/chat", "Support"),
          navLink("#/patient/messages", "Emergency contacts"),
          navLink("#/patient/find-help", "Find human help"),
          navLink("#/patient/checkin", "Wellness log"),
          navLink("#/patient/learn", "Calm & learn"),
          navLink("#/patient/lune/witnesses", "Community"),
          navLink("#/patient/settings", "Privacy"),
        ].join("")
      : "";
  const navDoctor =
    session?.role === "doctor"
      ? [navLink("#/doctor", "Workspace")].join("")
      : "";
  const navCaregiver =
    session?.role === "caregiver"
      ? [navLink("#/caregiver", "Home"), navLink("#/caregiver/lune/witnesses", "Community"), navLink("#/caregiver/chat", "Emergency contacts"), navLink("#/caregiver/link", "Link patient")].join("")
      : "";
  return `
  <header class="app-header">
    ${renderHeaderBrand(session)}
    <nav class="app-nav">
      ${navLink("#/about", "About")}
      ${session ? navPatient + navDoctor + navCaregiver : ""}
      ${session ? `<button class="btn btn-ghost btn-sm" type="button" id="btnLogout">Log out</button>` : navLink("#/login", "Sign in")}
    </nav>
  </header>
  ${renderMobileTabBar(session)}`;
}

function requireSession(role) {
  const s = getSession();
  if (!s) {
    location.hash = "#/login";
    return null;
  }
  if (role && s.role !== role) {
    location.hash =
      s.role === "doctor" ? "#/doctor" : s.role === "caregiver" ? "#/caregiver" : "#/patient";
    return null;
  }
  return s;
}

function homeRouteForRole(role) {
  if (role === "doctor") return "#/doctor";
  if (role === "caregiver") return "#/caregiver";
  return "#/patient";
}

function sessionLabel(s) {
  if (!s) return "";
  return s.email || s.patientId || "";
}

async function bindLogout() {
  const btn = document.getElementById("btnLogout");
  if (btn) {
    btn.onclick = async () => {
      await clearAllSession();
      location.hash = "#/login";
    };
  }
}

function renderLogin(root) {
  const api = isApiMode();
  const statusBadge = api
    ? `<span class="login-status login-status--on">Server connected</span>`
    : `<span class="login-status">Offline mode</span>`;
  const statusNote = api
    ? "Accounts and check-ins are stored on this server."
    : "Data stay in this browser only. Sign in on the hosted server for synced accounts across devices.";

  root.innerHTML = `
    <div class="login-page">
      <div class="login-shell">
        <section class="login-brand" aria-label="About ${escapeHtml(PRODUCT_NAME)}">
          <div class="login-brand-inner">
            ${renderBrandLockup({ size: "login" })}
            <p class="login-portals-label">Choose your portal</p>
            <div class="login-portals" role="group" aria-label="Choose portal">
              <button type="button" class="login-portal-card is-active" data-role="patient">
                <span class="login-portal-badge badge-patient">Patient</span>
                <strong>Between touchpoints</strong>
                <span class="login-portal-desc">Process emotions &amp; prepare for your team</span>
              </button>
              <button type="button" class="login-portal-card" data-role="caregiver">
                <span class="login-portal-badge badge-caregiver">Caregiver</span>
                <strong>Support someone</strong>
                <span class="login-portal-desc">Plain-language summaries with consent</span>
              </button>
              <button type="button" class="login-portal-card" data-role="doctor">
                <span class="login-portal-badge badge-doctor">Clinician</span>
                <strong>Review wellness logs</strong>
                <span class="login-portal-desc">Check-ins &amp; visit prep notes</span>
              </button>
            </div>
            <ul class="login-brand-list">
              <li>Emotional support between breast cancer medical touchpoints</li>
              <li>Patients, caregivers &amp; clinicians — three connected portals</li>
              <li>Non-medical companion — does not replace your care team</li>
            </ul>
            <a class="login-about-link" href="#/about">Learn more</a>
          </div>
        </section>
        <section class="login-panel">
          <div class="login-panel-bg" aria-hidden="true"></div>
          <div class="login-panel-inner">
            <div class="login-panel-head">
              ${statusBadge}
              <h2 id="loginPanelTitle">Sign in</h2>
              <p id="loginPanelSub" class="muted login-panel-sub">${
                api
                  ? "Sign in with email and password. Display name is only needed when you create an account."
                  : "Offline demo — email is your local ID; we use the part before @ as your display name."
              }</p>
            </div>
            <div class="callout callout-info login-status-callout">${statusNote}</div>
            <form id="loginForm" class="login-form">
              <div class="login-field">
                <span class="login-field-label">I am a</span>
                <div class="login-role-toggle" role="group" aria-label="Role">
                  <button type="button" class="login-role-btn is-active" data-role="patient">Patient</button>
                  <button type="button" class="login-role-btn" data-role="caregiver">Caregiver</button>
                  <button type="button" class="login-role-btn" data-role="doctor">Clinician</button>
                </div>
                <input type="hidden" id="role" name="role" value="patient" />
              </div>
              <div id="loginDisplayNameField" class="login-field login-field--register-only" hidden>
                <label for="displayName">Display name</label>
                <input id="displayName" name="displayName" type="text" autocomplete="name" placeholder="e.g. Alex or Dr. Lee" />
              </div>
              <div class="login-field">
                <label for="email">Email</label>
                <input id="email" name="email" type="email" autocomplete="username" placeholder="you@example.com" required />
              </div>
              <div class="login-field">
                <label for="password">Password</label>
                <input id="password" name="password" type="password" autocomplete="current-password" placeholder="${
                  api ? "At least 4 characters" : "Any password (offline)"
                }" ${api ? "required minlength=\"4\"" : ""} />
              </div>
              <div class="login-form-actions">
                <button class="btn btn-primary btn-block" type="submit" id="btnAuthPrimary">Log in</button>
                ${
                  api
                    ? `<button class="btn btn-ghost btn-block" type="button" id="btnAuthToggle">Create account</button>`
                    : ""
                }
              </div>
              <p id="loginMsg" class="login-msg" role="alert"></p>
            </form>
          </div>
        </section>
      </div>
    </div>`;

  /** @type {"signin"|"register"} */
  let authMode = "signin";
  const displayField = document.getElementById("loginDisplayNameField");
  const displayInput = document.getElementById("displayName");
  const panelTitle = document.getElementById("loginPanelTitle");
  const panelSub = document.getElementById("loginPanelSub");
  const btnPrimary = document.getElementById("btnAuthPrimary");
  const btnToggle = document.getElementById("btnAuthToggle");

  function setLoginRole(role) {
    const r = role || "patient";
    const roleInput = document.getElementById("role");
    if (roleInput) roleInput.value = r;
    document.querySelectorAll(".login-role-btn, .login-portal-card").forEach((el) => {
      el.classList.toggle("is-active", el.getAttribute("data-role") === r);
    });
    const subs = {
      patient: "Sign in to reflect and prepare between clinic visits.",
      caregiver: "Sign in to read shared between-visit summaries (with patient consent).",
      doctor: "Sign in to review linked patients and reference materials.",
    };
    if (panelTitle && authMode === "signin") {
      panelTitle.textContent = "Sign in";
    }
    if (panelSub && authMode === "signin") {
      panelSub.textContent = subs[r] || panelSub.textContent;
    }
  }

  document.querySelectorAll(".login-role-btn, .login-portal-card").forEach((btn) => {
    btn.addEventListener("click", () => {
      setLoginRole(btn.getAttribute("data-role") || "patient");
    });
  });

  function redirectAfterAuth() {
    const s = getSession();
    location.hash = homeRouteForRole(s?.role || "patient");
  }

  function setAuthMode(mode) {
    authMode = mode;
    const registering = mode === "register";
    if (displayField) displayField.hidden = !registering;
    if (displayInput) displayInput.required = registering;
    if (panelTitle) {
      panelTitle.textContent = registering ? "Create account" : "Sign in";
    }
    if (panelSub) {
      panelSub.textContent = registering
        ? "Choose a display name shown in the app. Use a demo email — not real clinical identifiers."
        : {
            patient: "Sign in to reflect and prepare between clinic visits.",
            caregiver: "Sign in to read shared between-visit summaries (with patient consent).",
            doctor: "Sign in to review linked patients and reference materials.",
          }[document.getElementById("role")?.value || "patient"] ||
          (api
            ? "Sign in with email and password. Display name is only needed when you create an account."
            : "Offline demo — email is your local ID; we use the part before @ as your display name.");
    }
    if (btnPrimary) btnPrimary.textContent = registering ? "Create account" : "Log in";
    if (btnToggle) btnToggle.textContent = registering ? "Back to sign in" : "Create account";
    if (!registering) setLoginRole(document.getElementById("role")?.value || "patient");
  }

  const msg = () => document.getElementById("loginMsg");

  if (btnToggle) {
    btnToggle.addEventListener("click", () => {
      msg().textContent = "";
      setAuthMode(authMode === "signin" ? "register" : "signin");
      if (authMode === "register") displayInput?.focus();
    });
  }

  if (api) setAuthMode("signin");
  setLoginRole(document.getElementById("role")?.value || "patient");

  document.getElementById("loginForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    msg().textContent = "";
    const role = document.getElementById("role").value;
    const displayName = (document.getElementById("displayName")?.value || "").trim();
    const email = slugifyEmail(document.getElementById("email").value);
    const password = document.getElementById("password").value;
    if (!email) return;

    if (api && authMode === "register") {
      if (!displayName) {
        msg().textContent = "Display name is required when creating an account.";
        return;
      }
      if (!password || password.length < 4) {
        msg().textContent = "Password must be at least 4 characters.";
        return;
      }
      try {
        await apiRegister({ email, password, displayName, role });
        await apiLogin({ email, password });
        redirectAfterAuth();
      } catch (err) {
        msg().textContent = err instanceof Error ? err.message : String(err);
      }
      return;
    }

    if (api) {
      if (!password || password.length < 4) {
        msg().textContent = "Password must be at least 4 characters in server mode.";
        return;
      }
      try {
        await apiLogin({ email, password });
        redirectAfterAuth();
      } catch (err) {
        msg().textContent = err instanceof Error ? err.message : String(err);
      }
      return;
    }

    const offlineName = displayName || email.split("@")[0] || "User";
    setLocalOnlySession({
      role,
      displayName: offlineName,
      patientId: email,
      doctorId: email,
      caregiverId: email,
    });
    location.hash = homeRouteForRole(role);
  });
}

async function renderAbout(root) {
  const session = getSession();
  root.innerHTML =
    renderHeader(session) +
    `
    <main>
      <div class="card prose">
        <div class="about-brand">${renderBrandLockup({ size: "md" })}</div>
        <h1>About ${escapeHtml(PRODUCT_NAME)}</h1>
        <p class="muted about-team">${escapeHtml(TEAM_CREDIT)}. ${escapeHtml(PRODUCT_TAGLINE)}. Not a medical device or diagnosis tool.</p>
        <p><span class="badge badge-patient">Patient</span> <strong>Between touchpoints</strong> — process anxiety, fear, and information overload; prepare questions; calming exercises. <strong>Wellness log</strong> tracks mood, sleep, and side effects (not medical advice). <strong>Learn</strong> offers brief calming and visit-prep cards.</p>
        <p><span class="badge badge-caregiver">Caregiver</span> Link a patient and read plain-language between-visit summaries when they enable sharing. <a href="https://bcf.org.sg/guidance/caregiving" target="_blank" rel="noopener noreferrer">BCF caregiving guidance</a>.</p>
        <p><span class="badge badge-doctor">Clinician</span> Read linked patients’ wellness check-ins; optionally read <strong>support chat</strong> only if the patient enables sharing under Privacy.</p>

        <div class="callout danger">
          <strong>Not medical advice.</strong> This companion does not diagnose, treat, or prescribe. It does not replace oncologists, counsellors, support groups, or emergency care.
        </div>

        <h2>Compliance notes</h2>
        <ul>
          <li>Outputs are <strong>informational</strong> and may be inaccurate or incomplete.</li>
          <li>AI support (when enabled) offers reflective prompts — not clinical triage.</li>
          <li>Seek urgent or emergency care for acute symptoms your team has identified as emergencies.</li>
          <li>${
            isApiMode()
              ? "When connected to the application server, accounts and submissions are stored in an encrypted database on the deployment host. Organizational HIPAA or GDPR compliance depends on your hosting and policies."
              : "In offline mode, data remain in your browser only and are not synchronized to a clinical record system."
          }</li>
          <li>A production system would require separate security, privacy, clinical validation, and regulatory assessment (for example HIPAA or GDPR where applicable).</li>
        </ul>

        <p class="muted">Literature-level research modules are not part of this BCF-focused demo. Human support remains essential.</p>
      </div>
      ${renderProductFooter()}
    </main>`;

  await bindLogout();
}

function submissionPlainText(s) {
  if (s.summaryModel && typeof s.summaryModel.plainText === "string") {
    return s.summaryModel.plainText;
  }
  if (typeof s.summary === "string") return s.summary;
  return "";
}

function formatSummaryStackHtml(summaryModel) {
  if (!summaryModel || !Array.isArray(summaryModel.blocks)) {
    return "";
  }
  const blocks = summaryModel.blocks;
  const importantTitles = blocks
    .filter((b) => b.variant === "important" && b.title)
    .map((b) => b.title);
  const keyStrip =
    importantTitles.length > 0
      ? `
    <div class="summary-key-strip">
      <div class="summary-key-strip-label">Highlights for your visit</div>
      <ul>
        ${importantTitles.map((t) => `<li>${escapeHtml(t)}</li>`).join("")}
      </ul>
    </div>`
      : "";

  const stack = blocks
    .map((b) => {
      const title = b.title
        ? `<h3 class="summary-block-title">${escapeHtml(b.title)}</h3>`
        : "";
      return `<section class="summary-block summary-${escapeHtml(b.variant)}">${title}<p class="summary-block-text">${escapeHtml(b.text)}</p></section>`;
    })
    .join("");

  return `${keyStrip}<div class="summary-stack">${stack}</div>`;
}

function formatSummaryCellHtml(s) {
  if (s.summaryModel && Array.isArray(s.summaryModel.blocks)) {
    return formatSummaryStackHtml(s.summaryModel);
  }
  return `<pre class="summary-legacy">${escapeHtml(submissionPlainText(s))}</pre>`;
}

async function renderPatientHome(root) {
  const session = requireSession("patient");
  if (!session) return;
  let subs = [];
  let clinicalRecords = [];
  try {
    subs = isApiMode() ? await fetchMySubmissions() : listSubmissions(session.patientId);
  } catch {
    subs = [];
  }
  try {
    clinicalRecords = await fetchMyClinicalRecords(session);
  } catch {
    clinicalRecords = [];
  }

  const greeting = homeGreeting(session.displayName);
  const emailTip = escapeHtml(session.email || session.patientId || "");

  root.innerHTML =
    renderHeader(session) +
    `
    <main class="home-main">
      <section class="home-hero">
        <div class="home-hero-brand-col">
          ${renderBrandLockup({ size: "hero" })}
        </div>
        <div class="home-hero-main-col">
          <div class="home-hero-bg" aria-hidden="true"></div>
          <div class="home-hero-inner">
            <p class="home-eyebrow">${escapeHtml(greeting)}</p>
            <p class="home-hero-tagline">Emotional support between medical touchpoints</p>
            <p class="home-lead">After a breast cancer diagnosis, anxiety and information overload often continue between appointments. Reflect, prepare questions, and access calming exercises — this companion is non-medical and does not replace your oncologist, counsellor, or support groups.</p>
            <div class="home-hero-actions">
              <a class="btn btn-primary" href="#/patient/chat">Open support</a>
              <a class="btn btn-ghost home-hero-ghost" href="#/patient/checkin">Wellness log</a>
            </div>
            <p class="home-email-tip">
              <span class="home-email-label">Share with your clinician</span>
              <code class="home-email-code">${emailTip}</code>
            </p>
          </div>
        </div>
      </section>

      ${renderHomeStats(subs, clinicalRecords.length)}

      ${renderBetweenVisitPromptCards(escapeHtml)}

      ${renderPatientWellbeingPanel()}

      ${renderVisitQuestionsPanel(session.patientId, escapeHtml)}

      <section class="home-panel">
        <header class="home-panel-head">
          <h2>Explore</h2>
          <p class="muted">Symptom log, learning, and peer support</p>
        </header>
        ${renderPatientQuickActions()}
      </section>
      ${
        clinicalRecords.length
          ? `<section class="home-panel home-panel--records">
        <header class="home-panel-head">
          <h2>Clinician records</h2>
          <p class="muted">Diagnoses and visit notes from your linked clinician</p>
        </header>
        ${formatClinicalRecordsListHtml(clinicalRecords)}
      </section>`
          : ""
      }
      <section class="home-panel home-panel--checkins">
        <header class="home-panel-head home-panel-head--row">
          <div>
            <h2>Recent check-ins</h2>
            <p class="muted">Tap an entry for your full educational summary</p>
          </div>
          ${subs.length ? `<a class="btn btn-ghost btn-sm" href="#/patient/checkins">View all</a>` : ""}
        </header>
        ${renderPatientHomeCheckinsSection(subs)}
      </section>
      ${renderProductFooter()}
    </main>`;

  await bindLogout();
  initPatientWellbeingPanel(session.patientId);
  initVisitQuestionsPanel(session.patientId);
}

async function renderPatientCheckin(root) {
  const session = requireSession("patient");
  if (!session) return;

  root.innerHTML =
    renderHeader(session) +
    `
    <main>
      <div class="card">
        <h1>Wellness log</h1>
        <p class="muted">Track mood, sleep, and side effects between oncology touchpoints — not a diagnosis tool. Answer at least <strong>2 questions</strong> or write a short note (<strong>20+ characters</strong>).</p>
        <form id="checkinForm">
          <div class="row two">
            <div>
              <label for="age">Age (years, optional)</label>
              <input id="age" name="age" type="text" inputmode="numeric" placeholder="e.g. 52" />
            </div>
            <div>
              <label for="treatmentPhase">Where you are in care</label>
              <select id="treatmentPhase" name="treatmentPhase">
                <option value="">Prefer not to say</option>
                <option value="newly_diagnosed">Newly diagnosed / planning</option>
                <option value="active_treatment">Active treatment</option>
                <option value="post_treatment">Recently finished a phase</option>
                <option value="survivorship">Survivorship / follow-up</option>
              </select>
            </div>
          </div>
          <div class="row two">
            <div>
              <label for="mood">Mood &amp; anxiety</label>
              <select id="mood" name="mood">
                <option value="">Prefer not to say</option>
                <option value="high_anxiety">High anxiety or fear</option>
                <option value="low_mood">Low mood or grief</option>
                <option value="mixed">Mixed emotions</option>
                <option value="okay">Mostly okay</option>
              </select>
            </div>
            <div>
              <label for="sleep">Sleep</label>
              <select id="sleep" name="sleep">
                <option value="">Prefer not to say</option>
                <option value="poor">Poor most nights</option>
                <option value="fair">Fair / inconsistent</option>
                <option value="good">Mostly good</option>
              </select>
            </div>
          </div>
          <div class="row two">
            <div>
              <label for="sideEffects">Side effects or discomfort</label>
              <select id="sideEffects" name="sideEffects">
                <option value="">Prefer not to say</option>
                <option value="significant">Significant — affects daily life</option>
                <option value="some">Some discomfort</option>
                <option value="minimal">Minimal / none lately</option>
              </select>
            </div>
            <div>
              <label for="informationOverload">Information overload</label>
              <select id="informationOverload" name="informationOverload">
                <option value="">Prefer not to say</option>
                <option value="yes">Yes — overwhelmed</option>
                <option value="sometimes">Sometimes</option>
                <option value="no">Managing okay</option>
              </select>
            </div>
          </div>
          <div class="row">
            <div>
              <label for="notes">Anything on your mind (free text)</label>
              <textarea id="notes" name="notes" maxlength="2000" placeholder="Optional — feelings, worries, or questions for your care team"></textarea>
            </div>
          </div>
          <div id="checkinMsg" class="checkin-form-msg" role="alert" hidden></div>
          <div class="btn-row">
            <button class="btn btn-primary" type="submit">Save &amp; show summary</button>
            <a class="btn btn-ghost" href="#/patient">Cancel</a>
          </div>
        </form>
      </div>
    </main>`;

  await bindLogout();

  document.getElementById("checkinForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const rawAnswers = Object.fromEntries(fd.entries());
    const validation = validateCheckinAnswers(rawAnswers);
    const msgEl = document.getElementById("checkinMsg");
    if (!validation.ok) {
      msgEl.hidden = false;
      msgEl.className = "checkin-form-msg callout danger";
      msgEl.textContent = validation.message;
      msgEl.scrollIntoView({ behavior: "smooth", block: "nearest" });
      return;
    }
    msgEl.hidden = true;
    msgEl.textContent = "";
    const answers = validation.answers;

    if (isApiMode()) {
      try {
        const record = await apiCreateSubmission(answers);
        const summaryModel = record.summaryModel;
        root.innerHTML =
          renderHeader(session) +
          `
      <main>
        <div class="card">
          <h1>Your educational summary</h1>
          <div class="callout danger"><strong>Not a diagnosis.</strong> If you have emergency symptoms, seek urgent care.</div>
          ${formatSummaryStackHtml(summaryModel)}
          <div class="btn-row">
            <a class="btn btn-primary" href="#/patient/checkins">View check-in history</a>
            <a class="btn btn-ghost" href="#/patient/checkin">New check-in</a>
          </div>
        </div>
      </main>`;
        await bindLogout();
      } catch (err) {
        root.innerHTML =
          renderHeader(session) +
          `<main><div class="card"><h1>Could not save</h1><p class="muted">${escapeHtml(err instanceof Error ? err.message : String(err))}</p><div class="btn-row"><a class="btn btn-primary" href="#/patient/checkin">Try again</a></div></div></main>`;
        await bindLogout();
      }
      return;
    }

    let prior = [];
    try {
      prior = listSubmissions(session.patientId);
    } catch {
      prior = [];
    }
    const summaryModel = buildPatientSummary(answers, prior);
    const record = {
      id: crypto.randomUUID(),
      submittedAt: new Date().toISOString(),
      answers,
      summaryModel,
      summary: summaryModel.plainText,
    };
    addSubmission(session.patientId, record);

    root.innerHTML =
      renderHeader(session) +
      `
      <main>
        <div class="card">
          <h1>Your educational summary</h1>
          <div class="callout danger"><strong>Not a diagnosis.</strong> If you have emergency symptoms, seek urgent care.</div>
          ${formatSummaryStackHtml(summaryModel)}
          <div class="btn-row">
            <a class="btn btn-primary" href="#/patient/checkins">View check-in history</a>
            <a class="btn btn-ghost" href="#/patient/checkin">New check-in</a>
          </div>
        </div>
      </main>`;
    await bindLogout();
  });
}

function patientEmailSlug(email) {
  return encodeURIComponent(email).replace(/%/g, "_");
}

async function loadDoctorPatientEmails(session) {
  try {
    if (isApiMode()) return await fetchDoctorPatients();
    return listLinkedPatientIds(session.doctorId).map((email) => ({ patient_email: email }));
  } catch {
    return [];
  }
}

function doctorEmailFromRow(row) {
  return row?.patient_email || row || "";
}

function doctorEmailList(rows) {
  return (rows || []).map(doctorEmailFromRow).filter(Boolean);
}

/** @param {string} patientEmail */
async function loadDoctorPatientBundle(patientEmail) {
  const email = slugifyEmail(patientEmail);
  const [subs, clinicalRecords] = await Promise.all([
    fetchDoctorPatientSubmissions(email),
    fetchDoctorClinicalRecords(email),
  ]);

  let chatBlock;
  if (isApiMode()) {
    const chatRes = await fetchDoctorPatientChat(email);
    if (!chatRes.consent) {
      chatBlock = formatChatLogHtml(
        [],
        chatRes.message || "Patient has not enabled support chat sharing with linked clinicians."
      );
    } else {
      chatBlock = formatChatLogHtml(chatRes.messages || [], null);
    }
  } else if (!getShareChatConsent(email)) {
    chatBlock = formatChatLogHtml(
      [],
      "Patient has not enabled support chat sharing (offline demo)."
    );
  } else {
    chatBlock = formatChatLogHtml(listChatMessages(email), null);
  }

  return {
    subs: subs || [],
    clinicalRecords: clinicalRecords || [],
    chatBlock,
  };
}

function getSelectedDoctorPatient(patientEmails) {
  if (!patientEmails?.length) return null;
  try {
    const saved = sessionStorage.getItem(DOCTOR_SELECTED_PATIENT_KEY);
    if (saved && patientEmails.includes(saved)) return saved;
  } catch {
    /* ignore */
  }
  return patientEmails[0];
}

function setSelectedDoctorPatient(email) {
  try {
    sessionStorage.setItem(DOCTOR_SELECTED_PATIENT_KEY, email);
  } catch {
    /* ignore */
  }
}

function renderDoctorPatientContext(patientRows) {
  const patientEmails = doctorEmailList(patientRows);
  if (!patientEmails.length) {
    return `<div class="doctor-context-bar doctor-context-bar--empty">
      <div class="doctor-context-text">
        <span class="doctor-context-label">Active patient</span>
        <strong>None linked</strong>
      </div>
      <a class="btn btn-sm btn-primary" href="#/doctor/link">Link a patient</a>
    </div>`;
  }
  const selected = getSelectedDoctorPatient(patientEmails);
  return `<div class="doctor-context-bar">
    <div class="doctor-context-text">
      <span class="doctor-context-label">Currently reviewing</span>
      <strong class="doctor-context-email">${escapeHtml(selected)}</strong>
    </div>
    <a class="btn btn-sm btn-ghost doctor-context-change" href="#/doctor">Change on dashboard</a>
  </div>`;
}

function renderDoctorPatientPicker(patientEmails, selectedEmail) {
  if (!patientEmails.length) return "";
  return `<section class="card doctor-picker-card">
    <header class="doctor-picker-head">
      <h2>Select patient</h2>
      <p class="muted">Dashboard and charts below reflect the highlighted account.</p>
    </header>
    <div class="doctor-active-banner" role="status" aria-live="polite">
      <span class="doctor-active-icon" aria-hidden="true">●</span>
      <div>
        <span class="doctor-active-label">Active patient</span>
        <strong class="doctor-active-email">${escapeHtml(selectedEmail)}</strong>
      </div>
    </div>
    <div class="doctor-patient-chips" role="tablist" aria-label="Linked patients">
      ${patientEmails
        .map(
          (email) =>
            `<button type="button" role="tab" class="doctor-patient-chip${
              email === selectedEmail ? " is-active" : ""
            }" data-patient="${escapeHtml(email)}" aria-selected="${email === selectedEmail}">${escapeHtml(email)}</button>`
        )
        .join("")}
    </div>
  </section>`;
}

function bindDoctorPatientPicker(root, onSelect) {
  root.querySelectorAll(".doctor-patient-chip").forEach((btn) => {
    btn.addEventListener("click", () => {
      const email = btn.getAttribute("data-patient");
      if (!email) return;
      setSelectedDoctorPatient(email);
      onSelect();
    });
  });
  root.querySelectorAll(".doctor-overview-table tbody tr").forEach((row) => {
    row.style.cursor = "pointer";
    row.addEventListener("click", () => {
      const email = row.querySelector("strong")?.textContent?.trim();
      if (!email) return;
      setSelectedDoctorPatient(email);
      onSelect();
    });
  });
}

function formatExportSyncedAt(iso) {
  if (!iso) return "Not synced yet";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function renderDoctorExportCard(exportInfo, isApi) {
  const synced = exportInfo?.manifest?.syncedAt;
  const files = exportInfo?.files || [];
  const fileList =
    files.length > 0
      ? `<ul class="doctor-export-filelist">${files
          .map(
            (f) =>
              `<li><button type="button" class="doctor-export-dl btn btn-ghost btn-sm" data-export-path="${escapeHtml(f.path)}">${escapeHtml(f.name)}</button> <span class="muted">${escapeHtml(f.description || "")}${f.bytes ? ` · ${Math.round(f.bytes / 1024)} KB` : ""}</span></li>`
          )
          .join("")}</ul>`
      : `<p class="muted">CSV files appear here after the first check-in, diagnosis, or chat message is saved.</p>`;

  return `<section class="card doctor-export-card">
    <header class="doctor-export-head">
      <h2>Data export (CSV)</h2>
      <p class="muted">When connected to the server, exports refresh automatically after check-ins, diagnoses, or chat updates. Download copies for spreadsheets or records.</p>
      <p class="doctor-export-sync muted">Last sync: <strong>${escapeHtml(formatExportSyncedAt(synced))}</strong></p>
    </header>
    ${isApi ? fileList : `<p class="muted">Offline mode: use the buttons below to generate CSV files in your browser.</p>`}
    <div class="doctor-export-actions btn-row">
      ${
        isApi
          ? `<button type="button" class="btn btn-ghost btn-sm" id="btnExportSync">Refresh exports</button>`
          : ""
      }
      <button type="button" class="btn btn-primary btn-sm" id="btnExportActivePatient">Export active patient</button>
      <button type="button" class="btn btn-ghost btn-sm" id="btnExportAllPatients">Export all linked</button>
    </div>
    <p id="exportMsg" class="muted doctor-export-msg" role="status"></p>
  </section>`;
}

function bindDoctorExportActions(root, session, selectedEmail, loadBundle) {
  const msg = () => root.querySelector("#exportMsg");

  root.querySelectorAll(".doctor-export-dl").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const path = btn.getAttribute("data-export-path");
      if (!path) return;
      if (msg()) msg().textContent = "Downloading…";
      try {
        await downloadServerExportFile(path);
        if (msg()) msg().textContent = "Download started.";
      } catch (e) {
        if (msg()) msg().textContent = e instanceof Error ? e.message : String(e);
      }
    });
  });

  const syncBtn = root.querySelector("#btnExportSync");
  if (syncBtn) {
    syncBtn.addEventListener("click", async () => {
      if (msg()) msg().textContent = "Syncing exports…";
      try {
        await syncDoctorExports();
        await renderDoctorPortal(root);
      } catch (e) {
        if (msg()) msg().textContent = e instanceof Error ? e.message : String(e);
      }
    });
  }

  root.querySelector("#btnExportActivePatient")?.addEventListener("click", async () => {
    if (!selectedEmail) {
      if (msg()) msg().textContent = "Select a patient first.";
      return;
    }
    if (msg()) msg().textContent = "Building CSV…";
    try {
      const bundle = await loadBundle(selectedEmail);
      let chatMessages = [];
      if (isApiMode()) {
        try {
          const chatRes = await fetchDoctorPatientChat(selectedEmail);
          if (chatRes.consent) chatMessages = chatRes.messages || [];
        } catch {
          /* optional */
        }
      }
      exportPatientBundleCsv(selectedEmail, {
        subs: bundle.subs,
        clinicalRecords: bundle.clinicalRecords,
        chatMessages,
      });
      if (msg()) msg().textContent = "Patient CSV files downloaded (check-ins, diagnoses, chat).";
    } catch (e) {
      if (msg()) msg().textContent = e instanceof Error ? e.message : String(e);
    }
  });

  root.querySelectorAll(".doctor-export-one").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const email = btn.getAttribute("data-patient");
      if (!email) return;
      if (msg()) msg().textContent = `Exporting ${email}…`;
      try {
        const bundle = await loadBundle(email);
        let chatMessages = [];
        if (isApiMode()) {
          try {
            const chatRes = await fetchDoctorPatientChat(email);
            if (chatRes.consent) chatMessages = chatRes.messages || [];
          } catch {
            /* optional */
          }
        } else if (getShareChatConsent(email)) {
          chatMessages = listChatMessages(email);
        }
        exportPatientBundleCsv(email, {
          subs: bundle.subs,
          clinicalRecords: bundle.clinicalRecords,
          chatMessages,
        });
        if (msg()) msg().textContent = `Exported ${email}.`;
      } catch (e) {
        if (msg()) msg().textContent = e instanceof Error ? e.message : String(e);
      }
    });
  });

  root.querySelector("#btnExportAllPatients")?.addEventListener("click", async () => {
    if (msg()) msg().textContent = "Building CSV…";
    try {
      if (isApiMode()) {
        const manifest = await syncDoctorExports();
        const files = manifest?.filesForClinician || manifest?.files || [];
        for (const f of files) {
          await downloadServerExportFile(f.path);
        }
        if (msg()) msg().textContent = `Downloaded ${files.length} export file(s).`;
        return;
      }
      await exportAllLinkedPatientsCsv(session.doctorId, async (email) => {
        const b = await loadBundle(email);
        let chatMessages = [];
        if (getShareChatConsent(email)) chatMessages = listChatMessages(email);
        return {
          subs: b.subs,
          clinicalRecords: b.clinicalRecords,
          chatMessages,
        };
      });
      if (msg()) msg().textContent = "All linked patient CSV files downloaded.";
    } catch (e) {
      if (msg()) msg().textContent = e instanceof Error ? e.message : String(e);
    }
  });
}


function formatClinicalRecordsListHtml(records) {
  if (!records?.length) {
    return `<p class="muted">No clinical diagnoses logged yet.</p>`;
  }
  return `<div class="clinical-records-list">${records
    .map((r) => {
      const status = r.confirmed
        ? `<span class="badge badge-status-approved">Confirmed</span>`
        : `<span class="badge badge-status-pending">Provisional</span>`;
      const linked = r.linkedSubmissionId
        ? `<p class="muted clinical-record-meta">Linked check-in: ${escapeHtml(r.linkedSubmissionAt || r.linkedSubmissionId)}</p>`
        : "";
      return `<article class="clinical-record-item">
        <div class="clinical-record-head">
          <strong>${escapeHtml(r.diagnosisName)}</strong> ${status}
          <span class="muted">${escapeHtml(r.recordedAt)} · ${escapeHtml(r.doctorDisplay || "Clinician")}</span>
        </div>
        ${r.notes ? `<p>${escapeHtml(r.notes)}</p>` : ""}
        ${linked}
      </article>`;
    })
    .join("")}</div>`;
}

function formatChatLogHtml(messages, consentDeniedMessage) {
  if (consentDeniedMessage) {
    return `<p class="muted">${escapeHtml(consentDeniedMessage)}</p>`;
  }
  if (!messages || messages.length === 0) {
    return `<p class="muted">No support chat messages saved.</p>`;
  }
  return `<div class="chat-log">${messages
    .map(
      (m) =>
        `<div class="chat-bubble chat-${escapeHtml(m.role)}"><span class="chat-role">${escapeHtml(m.role)}</span>${escapeHtml(m.text)}</div>`
    )
    .join("")}</div>`;
}

function renderDoctorPatientCard(pid, subs, chatBlock, clinicalRecords) {
  const slug = patientEmailSlug(pid);
  const submissionOptions = subs
    .map(
      (s) =>
        `<option value="${escapeHtml(s.id)}">${escapeHtml(s.submittedAt)} — ${escapeHtml(shortPreview(submissionPlainText(s)))}</option>`
    )
    .join("");

  return `
        <div class="doctor-patient-stack">
          <div class="card doctor-patient-card" data-patient-email="${escapeHtml(pid)}">
            <header class="doctor-patient-card-head">
              <div class="doctor-patient-card-head-row">
                <span class="badge badge-doctor">Patient submissions</span>
                <button type="button" class="btn btn-ghost btn-sm doctor-export-one" data-patient="${escapeHtml(pid)}">Export CSV</button>
              </div>
              <h2>${escapeHtml(pid)}</h2>
              <p class="muted">What this patient shared — check-ins and optional support chat (read-only here).</p>
            </header>

            <section class="doctor-section doctor-section--checkins doctor-section--first">
              <h3 class="doctor-section-title">Check-in submissions</h3>
              ${subs.length === 0 ? `<p class="muted">No submissions from this patient yet.</p>` : `
              <table>
                <thead><tr><th>Time (ISO)</th><th>Answers (JSON)</th><th>Patient-facing summary</th></tr></thead>
                <tbody>
                  ${subs.map((s) => `
                    <tr>
                      <td>${escapeHtml(s.submittedAt)}</td>
                      <td><pre style="margin:0;white-space:pre-wrap;font-size:0.82rem;">${escapeHtml(JSON.stringify(s.answers, null, 2))}</pre></td>
                      <td class="doctor-summary-cell">${formatSummaryCellHtml(s)}</td>
                    </tr>`).join("")}
                </tbody>
              </table>`}
            </section>

            <section class="doctor-section doctor-section--chat">
              <h3 class="doctor-section-title">Support chat (with consent)</h3>
              ${chatBlock}
            </section>
          </div>

          <div class="card doctor-clinical-card" data-patient-email="${escapeHtml(pid)}">
            <header class="doctor-clinical-card-head">
              <span class="badge badge-doctor badge-doctor--clinical">Visit documentation</span>
              <h2>Clinical diagnosis log</h2>
              <p class="muted">Your notes after the visit. Saved to this patient's chart when the server is connected; they can read entries on their home screen.</p>
            </header>
            ${formatClinicalRecordsListHtml(clinicalRecords)}
            <form class="clinical-record-form" data-patient="${escapeHtml(pid)}">
              <div class="row two">
                <div>
                  <label for="diag-name-${slug}">Diagnosis name</label>
                  <input id="diag-name-${slug}" name="diagnosisName" type="text" list="diag-suggestions-${slug}" required maxlength="200" placeholder="e.g. Breast cancer" />
                  <datalist id="diag-suggestions-${slug}">
                    ${CLINICAL_DIAGNOSIS_SUGGESTIONS.map((d) => `<option value="${escapeHtml(d)}"></option>`).join("")}
                  </datalist>
                </div>
                <div>
                  <label for="diag-conf-${slug}">Status</label>
                  <select id="diag-conf-${slug}" name="confirmed" required>
                    <option value="true">Confirmed</option>
                    <option value="false">Provisional / rule out</option>
                  </select>
                </div>
              </div>
              <div class="row">
                <div>
                  <label for="diag-notes-${slug}">Clinical notes</label>
                  <textarea id="diag-notes-${slug}" name="notes" rows="3" maxlength="4000" placeholder="Plan, follow-up, differentials…"></textarea>
                </div>
              </div>
              <div class="row">
                <div>
                  <label for="diag-sub-${slug}">Link to check-in (optional)</label>
                  <select id="diag-sub-${slug}" name="linkedSubmissionId">
                    <option value="">— None —</option>
                    ${submissionOptions}
                  </select>
                </div>
              </div>
              <p class="muted clinical-form-msg" id="clinical-msg-${slug}"></p>
              <button type="submit" class="btn btn-primary">Save diagnosis</button>
            </form>
          </div>
        </div>`;
}

function bindDoctorClinicalForms(root, session) {
  root.querySelectorAll(".clinical-record-form").forEach((form) => {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const patientEmail = form.getAttribute("data-patient");
      const slug = patientEmailSlug(patientEmail);
      const msgEl = document.getElementById(`clinical-msg-${slug}`);
      const fd = new FormData(form);
      const diagnosisName = String(fd.get("diagnosisName") || "").trim();
      const confirmed = fd.get("confirmed") === "true";
      const notes = String(fd.get("notes") || "").trim();
      const linkedSubmissionId = String(fd.get("linkedSubmissionId") || "").trim() || null;
      if (!diagnosisName) {
        if (msgEl) msgEl.textContent = "Diagnosis name is required.";
        return;
      }
      if (msgEl) msgEl.textContent = "Saving…";
      try {
        await createDoctorClinicalRecord(
          patientEmail,
          { diagnosisName, confirmed, notes, linkedSubmissionId },
          session
        );
        await renderDoctorPortal(root);
      } catch (err) {
        if (msgEl) msgEl.textContent = err instanceof Error ? err.message : String(err);
      }
    });
  });
}

function renderDoctorCheckinsPanel(pid, subs) {
  return `<section class="doctor-workspace-panel card">
    <h2>Wellness log submissions</h2>
    <p class="muted">Structured mood, sleep, and side-effect entries — educational summaries, not diagnosis.</p>
    ${
      subs.length === 0
        ? `<p class="muted">No submissions yet.</p>`
        : `<table>
        <thead><tr><th>Time</th><th>Answers</th><th>Summary</th></tr></thead>
        <tbody>
          ${subs
            .map(
              (s) =>
                `<tr>
                  <td>${escapeHtml(s.submittedAt)}</td>
                  <td><pre class="doctor-json-pre">${escapeHtml(JSON.stringify(s.answers, null, 2))}</pre></td>
                  <td class="doctor-summary-cell">${formatSummaryCellHtml(s)}</td>
                </tr>`
            )
            .join("")}
        </tbody>
      </table>`
    }
  </section>`;
}

function renderDoctorDirectChatWorkspace(directData, supportChatBlock, escapeHtml) {
  const directPanel = renderDirectChatPanel({
    title: "Direct messages",
    lead: "Two-way chat for urgent check-ins. Available once linked — no Privacy toggle required.",
    messages: directData.messages || [],
    viewerRole: "doctor",
    escapeHtml,
    linked: directData.linked !== false,
    notLinkedMessage:
      directData.message ||
      "Select a linked person in the left rail, or link them under Link person using their exact HearHer sign-in email.",
    formId: "doctorDirectChatForm",
    composerOpts: { placeholder: "Reply to your patient…" },
  });

  return `<div class="doctor-direct-chat-stack">
    ${directPanel}
    <details class="doctor-support-log">
      <summary>AI support chat log (read-only, requires patient consent)</summary>
      <div class="doctor-support-log-body">${supportChatBlock}</div>
    </details>
  </div>`;
}

function renderDoctorClinicalPanel(pid, subs, clinicalRecords) {
  const slug = patientEmailSlug(pid);
  const submissionOptions = subs
    .map(
      (s) =>
        `<option value="${escapeHtml(s.id)}">${escapeHtml(s.submittedAt)} — ${escapeHtml(shortPreview(submissionPlainText(s)))}</option>`
    )
    .join("");
  return `<section class="doctor-workspace-panel card doctor-clinical-card" data-patient-email="${escapeHtml(pid)}">
    <h2>Visit documentation</h2>
    <p class="muted">Your notes after the visit. They can read entries on their home screen.</p>
    ${formatClinicalRecordsListHtml(clinicalRecords)}
    <form class="clinical-record-form" data-patient="${escapeHtml(pid)}">
      <div class="row two">
        <div>
          <label for="diag-name-${slug}">Diagnosis name</label>
          <input id="diag-name-${slug}" name="diagnosisName" type="text" list="diag-suggestions-${slug}" required maxlength="200" placeholder="e.g. Breast cancer" />
          <datalist id="diag-suggestions-${slug}">
            ${CLINICAL_DIAGNOSIS_SUGGESTIONS.map((d) => `<option value="${escapeHtml(d)}"></option>`).join("")}
          </datalist>
        </div>
        <div>
          <label for="diag-conf-${slug}">Status</label>
          <select id="diag-conf-${slug}" name="confirmed" required>
            <option value="true">Confirmed</option>
            <option value="false">Provisional / rule out</option>
          </select>
        </div>
      </div>
      <div class="row">
        <div>
          <label for="diag-notes-${slug}">Clinical notes</label>
          <textarea id="diag-notes-${slug}" name="notes" rows="4" maxlength="4000" placeholder="Plan, follow-up, psychosocial referrals…"></textarea>
        </div>
      </div>
      <div class="row">
        <div>
          <label for="diag-sub-${slug}">Link to wellness log (optional)</label>
          <select id="diag-sub-${slug}" name="linkedSubmissionId">
            <option value="">— None —</option>
            ${submissionOptions}
          </select>
        </div>
      </div>
      <p class="muted clinical-form-msg" id="clinical-msg-${slug}"></p>
      <button type="submit" class="btn btn-primary">Save diagnosis</button>
    </form>
  </section>`;
}

function renderDoctorLinkPanel() {
  return `<section class="doctor-workspace-panel card">
    <h2>Link someone to your roster</h2>
    <p class="muted">Use the same email they use to sign in to HearHer.</p>
    <form id="doctorLinkForm">
      <label>Email<input type="email" id="pEmail" required placeholder="name@example.com" /></label>
      <div class="btn-row">
        <button type="submit" class="btn btn-primary">Link</button>
      </div>
    </form>
    <p id="linkMsg" class="muted"></p>
  </section>`;
}

async function renderDoctorPortal(root) {
  const session = requireSession("doctor");
  if (!session) return;
  setDoctorPortalBodyClass(true);

  const view = parseDoctorView(location.hash);
  let patientRows = [];
  try {
    patientRows = await loadDoctorPatientEmails(session);
  } catch {
    patientRows = [];
  }
  const patientEmails = doctorEmailList(patientRows);
  const selectedEmail = getSelectedDoctorPatient(patientEmails);

  let totalCheckins = 0;
  let withSnapshot = 0;
  const overview = [];
  for (const row of patientRows) {
    const email = row.patient_email || row;
    try {
      const { subs, clinicalRecords } = await loadDoctorPatientBundle(email);
      totalCheckins += subs.length;
      let hasSnapshot = false;
      if (isApiMode()) {
        try {
          const remote = await fetchDoctorPatientSnapshot(email);
          hasSnapshot = Boolean(remote?.snapshot && Object.keys(remote.snapshot).length);
          if (hasSnapshot && email === selectedEmail) {
            localStorage.setItem(
              `hearher.betweenVisit.v1:${email}`,
              JSON.stringify({ ...remote.snapshot, updatedAt: remote.updatedAt })
            );
          }
        } catch {
          hasSnapshot = Boolean(loadBetweenVisit(email).updatedAt);
        }
      } else {
        hasSnapshot = Boolean(loadBetweenVisit(email).updatedAt);
      }
      if (hasSnapshot) withSnapshot += 1;
      overview.push({
        email,
        displayName: row.display_name,
        checkins: subs.length,
        diagnoses: clinicalRecords.length,
        hasSnapshot,
      });
    } catch {
      overview.push({ email, displayName: row.display_name, checkins: 0, diagnoses: 0, hasSnapshot: false });
    }
  }

  let workspaceHtml = "";

  if (view === "dashboard") {
    workspaceHtml = renderDoctorDashboardOverview(
      {
        linkedCount: patientEmails.length,
        totalCheckins,
        withSnapshot,
        selectedEmail,
        overview,
      },
      escapeHtml
    );
  } else if (view === "link") {
    workspaceHtml = renderDoctorLinkPanel();
  } else if (view === "export") {
    let exportInfo = null;
    if (isApiMode()) {
      try {
        exportInfo = await fetchDoctorExportManifest();
      } catch {
        exportInfo = null;
      }
    }
    workspaceHtml = `<div class="doctor-workspace-panel">${renderDoctorExportCard(exportInfo, isApiMode())}</div>`;
  } else if (view === "moderation") {
    workspaceHtml = `<div class="doctor-workspace-panel" id="doctorModerationHost"><p class="muted">Loading safety log…</p></div>`;
  } else if (!selectedEmail) {
    workspaceHtml = renderDoctorNoSelection(view, escapeHtml);
  } else if (view === "between-visit") {
    let data = loadBetweenVisit(selectedEmail);
    let updatedAt = data.updatedAt;
    let displayName = patientRows.find((r) => (r.patient_email || r) === selectedEmail)?.display_name || "";
    if (isApiMode()) {
      try {
        const remote = await fetchDoctorPatientSnapshot(selectedEmail);
        if (remote?.snapshot) {
          data = { ...remote.snapshot, updatedAt: remote.updatedAt };
          localStorage.setItem(`hearher.betweenVisit.v1:${selectedEmail}`, JSON.stringify(data));
          updatedAt = remote.updatedAt;
          displayName = remote.patientDisplayName || displayName;
        }
      } catch {
        /* local */
      }
    }
    workspaceHtml = renderDoctorBetweenVisitPanel(data, selectedEmail, escapeHtml, {
      displayName,
      updatedAt,
    });
  } else {
    try {
      const bundle = await loadDoctorPatientBundle(selectedEmail);
      if (view === "checkins") {
        workspaceHtml = renderDoctorCheckinsPanel(selectedEmail, bundle.subs);
      } else if (view === "chat") {
        let directData = { linked: true, messages: [] };
        try {
          directData = await fetchDirectMessagesUnified(session, {
            channel: "doctor",
            patientEmail: selectedEmail,
          });
        } catch (err) {
          directData = {
            linked: false,
            messages: [],
            message: err instanceof Error ? err.message : String(err),
          };
        }
        workspaceHtml = `<section class="doctor-workspace-panel">${renderDoctorDirectChatWorkspace(
          directData,
          bundle.chatBlock,
          escapeHtml
        )}</section>`;
      } else if (view === "clinical") {
        workspaceHtml = renderDoctorClinicalPanel(selectedEmail, bundle.subs, bundle.clinicalRecords);
      }
    } catch (err) {
      workspaceHtml = `<div class="callout danger"><p>${escapeHtml(err instanceof Error ? err.message : String(err))}</p></div>`;
    }
  }

  root.innerHTML =
    renderHeader(session) +
    renderDoctorShell(session, view, patientRows, selectedEmail, workspaceHtml, escapeHtml) +
    renderProductFooter();

  bindDoctorPatientRail(root, (email) => {
    setSelectedDoctorPatient(email);
    void renderDoctorPortal(root);
  });
  bindDoctorClinicalForms(root, session);
  bindDoctorExportActions(root, session, selectedEmail, loadDoctorPatientBundle);

  document.getElementById("doctorLinkForm")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = document.getElementById("pEmail")?.value || "";
    const res = await linkPatientUnified(session, email);
    const msgEl = document.getElementById("linkMsg");
    if (res.ok) {
      if (msgEl) msgEl.textContent = "Linked. Select them in the rail to review records.";
      setSelectedDoctorPatient(res.patientId || slugifyEmail(email));
      location.hash = "#/doctor/between-visit";
    } else if (msgEl) {
      msgEl.textContent = res.error || "Could not link.";
    }
  });

  if (view === "moderation") {
    await mountDoctorModerationInShell(root, session, patientEmails);
  }

  if (view === "chat" && selectedEmail) {
    bindDirectChatForm(root, "doctorDirectChatForm", {
      onSend: async ({ text, urgent }) => {
        await sendDirectMessageUnified(session, {
          channel: "doctor",
          patientEmail: selectedEmail,
          text,
          urgent,
        });
        await renderDoctorPortal(root);
      },
      onRefresh: () => void renderDoctorPortal(root),
    });
    scrollDirectChatToBottom(root);
  }

  await bindLogout();
}

async function mountDoctorModerationInShell(root, session, patientEmails) {
  const host = root.querySelector("#doctorModerationHost");
  if (!host) return;

  let data = normalizeModerationPayload(null, patientEmails);
  try {
    if (isApiMode()) {
      const raw = await apiFetch("/doctor/community/moderation");
      data = normalizeModerationPayload(raw, patientEmails);
    } else {
      const rejected = listRejectedPosts().map(mapLocalRejectedPost);
      const linkedSet = new Set(patientEmails.map((e) => e.toLowerCase()));
      data = {
        allPosts: rejected,
        allComments: [],
        linkedPosts: rejected.filter((p) => linkedSet.has(String(p.patientEmail).toLowerCase())),
        linkedComments: [],
        note: "Offline mode: rejected posts in this browser only.",
      };
    }
  } catch (e) {
    host.innerHTML = `<p class="muted">${escapeHtml(e instanceof Error ? e.message : String(e))}</p>`;
    return;
  }

  const posts = data.linkedPosts.length ? data.linkedPosts : data.allPosts;
  const postsHtml = posts.length
    ? posts.map((p) => renderDoctorModItem(p, "Post", escapeHtml)).join("")
    : `<p class="muted">No flagged posts.</p>`;
  const comments = data.linkedComments.length ? data.linkedComments : data.allComments;
  const commentsHtml = comments.length
    ? comments.map((c) => renderDoctorModItem(c, "Comment", escapeHtml)).join("")
    : `<p class="muted">No flagged comments.</p>`;
  host.innerHTML = `
    <p class="muted">${escapeHtml(data.note || "")}</p>
    <h2>Flagged posts</h2>${postsHtml}
    <h2>Flagged comments</h2>${commentsHtml}`;
}

async function renderDoctorHome(root) {
  return renderDoctorPortal(root);
}

async function renderPatientLearn(root) {
  const session = requireSession("patient");
  if (!session) return;
  mountLearnPage(root, { session, renderHeader, bindLogout, escapeHtml });
}

async function renderCaregiverLune(root) {
  const session = requireSession("caregiver");
  if (!session) return;
  mountLuneApp(root, {
    session,
    renderHeader,
    bindLogout,
    escapeHtml,
    isApiMode,
    communityRole: "caregiver",
  });
}

async function renderPatientLune(root) {
  const session = requireSession("patient");
  if (!session) return;
  mountLuneApp(root, {
    session,
    renderHeader,
    bindLogout,
    escapeHtml,
    isApiMode,
    communityRole: "patient",
  });
}

async function renderCaregiverCommunity(root) {
  location.hash = "#/caregiver/lune/witnesses";
}

async function renderPatientCommunity(root) {
  location.hash = "#/patient/lune/witnesses";
}

function mapLocalRejectedPost(p) {
  return {
    id: p.id,
    authorDisplay: p.authorDisplay || p.authorId || "Patient",
    body: p.body,
    status: p.status || "rejected",
    moderationReason: p.moderationReason || "",
    patientMessage: p.patientMessage || p.moderationReason || "",
    guidanceType: p.guidanceType || "warning",
    createdAt: p.createdAt || "",
    patientEmail: p.authorId || "",
    groupId: p.groupId || p.group_id || "",
  };
}

async function renderDoctorModeration(root) {
  return renderDoctorPortal(root);
}

async function renderPatientSettings(root) {
  const session = requireSession("patient");
  if (!session) return;
  const consent = getChatConsent(session);
  const partnerConsent = isApiMode()
    ? Boolean(session.shareWithPartner)
    : getSharePartnerConsent(session.patientId);
  const childrenConsent = isApiMode()
    ? Boolean(session.shareWithChildren)
    : getShareChildrenConsent(session.patientId);

  root.innerHTML =
    renderHeader(session) +
    `
    <main>
      <div class="card">
        <h1>Privacy &amp; sharing</h1>
        <p class="muted">Control what linked clinicians and caregivers can read. Wellness log summaries are always available to linked clinicians.</p>
        <label class="checkbox-row">
          <input type="checkbox" id="shareChat" ${consent ? "checked" : ""} />
          Share support chat with linked clinicians
        </label>
        <fieldset class="privacy-caregiver-group">
          <legend>Share with family (separate controls)</legend>
          <label class="checkbox-row">
            <input type="checkbox" id="sharePartner" ${partnerConsent ? "checked" : ""} />
            Share between-visit summaries with partner or spouse
          </label>
          <p class="muted privacy-subnote">Full visit brief, wellness reflection, and Family Explain for partner — when they link as partner.</p>
          <label class="checkbox-row">
            <input type="checkbox" id="shareChildren" ${childrenConsent ? "checked" : ""} />
            Share age-appropriate summaries with adult children
          </label>
          <p class="muted privacy-subnote">Mood, treatment phase, and Family Explain for children only — not full clinical detail.</p>
        </fieldset>
        <p class="muted"><strong>Emergency contacts</strong> — linked clinician and caregiver phone numbers, plus optional in-app backup notes. For life-threatening emergencies, call 995.</p>
        <p id="consentMsg" class="muted"></p>
        <div class="btn-row">
          <button class="btn btn-primary" type="button" id="saveConsent">Save</button>
          <a class="btn btn-ghost" href="#/patient">Back</a>
        </div>
      </div>
    </main>`;

  await bindLogout();
  document.getElementById("saveConsent").onclick = async () => {
    const chatEnabled = document.getElementById("shareChat").checked;
    const partnerEnabled = document.getElementById("sharePartner").checked;
    const childrenEnabled = document.getElementById("shareChildren").checked;
    await setChatConsentUnified(session, chatEnabled);
    await setCaregiverConsentUnified(session, {
      partner: partnerEnabled,
      children: childrenEnabled,
    });
    await syncBetweenVisitSnapshot(session);
    document.getElementById("consentMsg").textContent = [
      chatEnabled ? "Clinician chat sharing on." : "Clinician chat sharing off.",
      partnerEnabled ? "Partner sharing on." : "Partner sharing off.",
      childrenEnabled ? "Adult-children sharing on." : "Adult-children sharing off.",
    ].join(" ");
  };
}

async function renderPatientVisitBrief(root) {
  const session = requireSession("patient");
  if (!session) return;
  let subs = [];
  try {
    subs = isApiMode() ? await fetchMySubmissions() : listSubmissions(session.patientId);
  } catch {
    subs = [];
  }
  root.innerHTML = renderHeader(session) + renderVisitBriefPage(session, escapeHtml, subs);
  await bindLogout();
  initVisitBriefPage(session);
  await syncBetweenVisitSnapshot(session);
}

async function renderPatientFamily(root) {
  const session = requireSession("patient");
  if (!session) return;
  root.innerHTML = renderHeader(session) + renderFamilyExplainPage(session, escapeHtml);
  await bindLogout();
  initFamilyExplainPage(session);
}

async function renderPatientHumanSupport(root) {
  const session = requireSession("patient");
  if (!session) return;
  const data = loadBetweenVisit(session.patientId);
  root.innerHTML =
    renderHeader(session) +
    renderFindHumanHelpPage(escapeHtml, { supportCollected: data.supportCollected });
  await bindLogout();
}

async function renderPatientScreening(root) {
  const session = requireSession("patient");
  if (!session) return;
  const barrier = parseScreeningBarrierFromHash();
  root.innerHTML = renderHeader(session) + renderScreeningPage(session, escapeHtml, barrier);
  await bindLogout();
  initScreeningPage(session);
}

async function renderCaregiverHomePage(root) {
  const session = requireSession("caregiver");
  if (!session) return;

  let linked = [];
  try {
    linked = await fetchCaregiverPatients();
  } catch {
    linked = [];
  }

  const hash = location.hash || "#/caregiver";
  const q = hash.split("?")[1] || "";
  const params = new URLSearchParams(q);
  const selected =
    params.get("patient") ||
    linked[0]?.patient_email ||
    (typeof linked[0] === "string" ? linked[0] : "") ||
    "";

  const row = linked.find((p) => (p.patient_email || p) === selected);
  const relationship = row?.relationship || "other";
  const shareEnabled = selected ? caregiverShareEnabled(selected, row, relationship) : false;
  let patientDisplayName = row?.display_name || "";
  let updatedAt = null;

  if (isApiMode() && selected && shareEnabled) {
    try {
      const remote = await fetchCaregiverPatientSnapshot(selected, relationship);
      if (remote?.snapshot) {
        localStorage.setItem(
          `hearher.betweenVisit.v1:${selected}`,
          JSON.stringify({ ...remote.snapshot, updatedAt: remote.updatedAt })
        );
        updatedAt = remote.updatedAt || null;
        patientDisplayName = remote.patientDisplayName || patientDisplayName;
      }
    } catch {
      /* show local or empty */
    }
  }

  root.innerHTML =
    renderHeader(session) +
    renderCaregiverHome(session, escapeHtml, linked, selected, {
      shareEnabled,
      patientDisplayName,
      updatedAt,
      relationship,
    }) +
    renderProductFooter();

  await bindLogout();
  initCaregiverHome(
    (email) => {
      location.hash = `#/caregiver?patient=${encodeURIComponent(email)}`;
    },
    () => void renderCaregiverHomePage(root)
  );
}

async function renderCaregiverLink(root) {
  const session = requireSession("caregiver");
  if (!session) return;

  root.innerHTML = renderHeader(session) + renderCaregiverLinkPage(session, escapeHtml);

  await bindLogout();
  document.getElementById("caregiverLinkForm")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = document.getElementById("caregiverPatientEmail")?.value || "";
    const relationship = document.getElementById("caregiverRelationship")?.value || "other";
    const res = await linkCaregiverPatientUnified(session, email, relationship);
    document.getElementById("caregiverLinkMsg").textContent = res.ok
      ? relationship === "child"
        ? "Linked as adult child. They must turn on adult-children sharing under Privacy."
        : relationship === "partner"
          ? "Linked as partner. They must turn on partner sharing under Privacy."
          : "Patient linked. They must enable partner sharing under Privacy for full summaries."
      : res.error || "Could not link patient.";
  });
}

async function renderPatientChat(root) {
  const session = requireSession("patient");
  if (!session) return;
  await mountPatientChat(root, {
    session,
    renderHeader,
    bindLogout,
    escapeHtml,
    isApiMode,
    fetchChatMessagesUnified,
    appendChatMessageUnified,
    clearChatUnified,
  });
}

async function renderPatientMessages(root) {
  const session = requireSession("patient");
  if (!session) return;

  const hash = location.hash || "#/patient/messages";
  const params = new URLSearchParams((hash.split("?")[1] || ""));
  let channel = params.get("channel") || "doctor";
  if (channel !== "doctor" && channel !== "caregiver") channel = "doctor";

  let contacts = {
    hasLinkedDoctor: false,
    hasLinkedCaregiver: false,
    doctorDisplayName: null,
    caregiverDisplayNames: [],
  };
  let contactsError = "";
  try {
    contacts = await fetchDirectMessageContacts(session);
  } catch (err) {
    contactsError = err instanceof Error ? err.message : String(err);
  }

  if (channel === "doctor" && !contacts.hasLinkedDoctor && contacts.hasLinkedCaregiver) {
    channel = "caregiver";
  } else if (channel === "caregiver" && !contacts.hasLinkedCaregiver && contacts.hasLinkedDoctor) {
    channel = "doctor";
  }

  let messages = { linked: false, messages: [], message: "Not linked yet." };
  try {
    messages = await fetchDirectMessagesUnified(session, { channel });
  } catch (err) {
    messages = {
      linked: false,
      messages: [],
      message: err instanceof Error ? err.message : String(err),
    };
  }

  root.innerHTML =
    renderHeader(session) +
    renderPatientMessagesPage(session, contacts, channel, messages, escapeHtml, {
      contactsError,
      signInEmail: session.email || session.patientId || "",
      serverMode: isApiMode(),
    }) +
    renderProductFooter();

  await bindLogout();
  bindDirectChatForm(root, "patientDirectChatForm", {
    onSend: async ({ text, urgent }) => {
      await sendDirectMessageUnified(session, { channel, text, urgent });
      await renderPatientMessages(root);
    },
    onRefresh: () => void renderPatientMessages(root),
  });
  scrollDirectChatToBottom(root);
}

async function renderCaregiverDirectChat(root) {
  const session = requireSession("caregiver");
  if (!session) return;

  let linked = [];
  try {
    linked = await fetchCaregiverPatients();
  } catch {
    linked = [];
  }

  const hash = location.hash || "#/caregiver/chat";
  const params = new URLSearchParams((hash.split("?")[1] || ""));
  const selected =
    params.get("patient") ||
    linked[0]?.patient_email ||
    (typeof linked[0] === "string" ? linked[0] : "") ||
    "";

  const row = linked.find((p) => (p.patient_email || p) === selected);
  const patientName = row?.display_name || selected.split("@")[0] || "";

  let messages = { linked: false, messages: [] };
  if (selected) {
    try {
      messages = await fetchDirectMessagesUnified(session, {
        channel: "caregiver",
        patientEmail: selected,
      });
    } catch (err) {
      messages = {
        linked: false,
        messages: [],
        message: err instanceof Error ? err.message : String(err),
      };
    }
  }

  root.innerHTML =
    renderHeader(session) +
    renderCaregiverDirectChatPage(session, selected, patientName, messages, escapeHtml, {
      phone: row?.phone || null,
      linkedPatients: linked,
    }) +
    renderProductFooter();

  await bindLogout();

  if (selected) {
    bindDirectChatForm(root, "caregiverDirectChatForm", {
      onSend: async ({ text, urgent }) => {
        await sendDirectMessageUnified(session, {
          channel: "caregiver",
          patientEmail: selected,
          text,
          urgent,
        });
        await renderCaregiverDirectChat(root);
      },
      onRefresh: () => void renderCaregiverDirectChat(root),
    });
    scrollDirectChatToBottom(root);
  }
}

async function renderDoctorResearch(root) {
  const session = requireSession("doctor");
  if (!session) return;

  const patientRows = await loadDoctorPatientEmails(session);

  root.innerHTML =
    renderHeader(session) +
    renderDoctorPatientContext(patientRows) +
    `
    <main class="doctor-main research-page">
${renderResearchPageHead()}
      <div class="research-layout">
        ${renderDoctorResearchBody()}
      </div>
    </main>`;

  await bindLogout();
  await hydrateScRnaDeep();
  initScRnaInventoryFilters();
  initPhenotypeContext(renderLabLookupSection);
  initLabLookup();
  initResearchToc();
}

async function renderDoctorLink(root) {
  location.hash = "#/doctor/link";
  return renderDoctorPortal(root);
}

function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function shortPreview(text, maxLen = 140) {
  const t = (text || "").replace(/\s+/g, " ").trim();
  return t.length > maxLen ? t.slice(0, maxLen - 1) + "…" : t;
}

function formatCheckinWhen(iso) {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

function checkinHighlightTitles(summaryModel) {
  if (!summaryModel?.blocks) return [];
  return summaryModel.blocks
    .filter((b) => b.variant === "important" && b.title)
    .map((b) => b.title)
    .slice(0, 2);
}

function renderPatientHomeCheckinsSection(subs) {
  if (subs.length === 0) {
    return `
      <div class="home-empty">
        <div class="home-empty-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/></svg>
        </div>
        <p class="home-empty-title">No check-ins yet</p>
        <p class="muted home-empty-text">Log mood or sleep once to build a timeline your care team can review between touchpoints.</p>
        <a class="btn btn-primary" href="#/patient/checkin">Start your first check-in</a>
      </div>`;
  }
  const recent = subs.slice(0, 3);
  return `
    <ul class="checkin-preview-list home-checkin-list">
      ${recent
        .map((s, i) => {
          const highlights = checkinHighlightTitles(s.summaryModel);
          const meta =
            highlights.length > 0
              ? highlights.map((t) => escapeHtml(t)).join(" · ")
              : escapeHtml(shortPreview(submissionPlainText(s), 100));
          return `<li>
            <a class="checkin-preview-link home-checkin-item" href="#/patient/checkins?id=${encodeURIComponent(s.id)}">
              <span class="home-checkin-rank" aria-hidden="true">${i + 1}</span>
              <span class="home-checkin-body">
                <span class="checkin-preview-date">${escapeHtml(formatCheckinWhen(s.submittedAt))}</span>
                <span class="checkin-preview-meta">${meta}</span>
              </span>
              <span class="home-checkin-chevron" aria-hidden="true">›</span>
            </a>
          </li>`;
        })
        .join("")}
    </ul>
    <p class="checkin-preview-footer">
      <a href="#/patient/checkin">+ New check-in</a>
      · <a href="#/patient/checkins/trash">Recycle bin</a>
    </p>`;
}

function renderCheckinHistoryCard(s, { trash = false, focused = false } = {}) {
  const focusedCls = focused ? " checkin-history-card--focus" : "";
  const removedNote = trash && s.deletedAt
    ? `<p class="muted checkin-trash-meta">Moved to recycle bin · ${escapeHtml(formatCheckinWhen(s.deletedAt))}</p>`
    : "";
  const actions = trash
    ? `<div class="checkin-history-actions btn-row">
        <button type="button" class="btn btn-primary btn-sm" data-restore-id="${escapeHtml(s.id)}">Restore</button>
        <button type="button" class="btn btn-ghost btn-sm" data-purge-id="${escapeHtml(s.id)}">Delete permanently</button>
      </div>`
    : `<div class="checkin-history-actions btn-row">
        <button type="button" class="btn btn-ghost btn-sm" data-retract-id="${escapeHtml(s.id)}">Move to recycle bin</button>
      </div>`;
  return `<article class="checkin-history-card${focusedCls}${trash ? " checkin-history-card--trash" : ""}" id="checkin-${escapeHtml(s.id)}">
    <header class="checkin-history-head">
      <h2>${escapeHtml(formatCheckinWhen(s.submittedAt))}</h2>
      ${removedNote}
    </header>
    <details class="checkin-history-details"${trash ? "" : " open"}>
      <summary class="checkin-history-summary-toggle">${trash ? "View summary" : "Summary"}</summary>
      <div class="checkin-history-summary">${formatSummaryCellHtml(s)}</div>
    </details>
    ${actions}
  </article>`;
}

function bindCheckinSubmissionActions(root, session, { onChange }) {
  root.querySelectorAll("[data-retract-id]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = btn.getAttribute("data-retract-id");
      if (
        !id ||
        !confirm(
          "Move this check-in to the recycle bin? It will be hidden from your history and from your linked clinician."
        )
      ) {
        return;
      }
      btn.disabled = true;
      try {
        await retractSubmissionUnified(session, id);
        await onChange();
      } catch (e) {
        alert(e instanceof Error ? e.message : String(e));
        btn.disabled = false;
      }
    });
  });

  root.querySelectorAll("[data-restore-id]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = btn.getAttribute("data-restore-id");
      if (!id) return;
      btn.disabled = true;
      try {
        await restoreSubmissionUnified(session, id);
        await onChange();
      } catch (e) {
        alert(e instanceof Error ? e.message : String(e));
        btn.disabled = false;
      }
    });
  });

  root.querySelectorAll("[data-purge-id]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = btn.getAttribute("data-purge-id");
      if (!id || !confirm("Permanently delete this check-in? This cannot be undone.")) return;
      btn.disabled = true;
      try {
        await purgeSubmissionUnified(session, id);
        await onChange();
      } catch (e) {
        alert(e instanceof Error ? e.message : String(e));
        btn.disabled = false;
      }
    });
  });
}

async function renderPatientCheckinsHistory(root) {
  const session = requireSession("patient");
  if (!session) return;

  let subs = [];
  try {
    subs = isApiMode() ? await fetchMySubmissions() : listSubmissions(session.patientId);
  } catch {
    subs = [];
  }

  const hash = location.hash || "";
  const q = hash.indexOf("?");
  const focusId = q >= 0 ? new URLSearchParams(hash.slice(q + 1)).get("id") : null;

  const cards =
    subs.length === 0
      ? `<p class="muted">No check-ins yet. <a href="#/patient/checkin">Start a check-in</a></p>`
      : subs
          .map((s) => renderCheckinHistoryCard(s, { focused: focusId && s.id === focusId }))
          .join("");

  root.innerHTML =
    renderHeader(session) +
    `
    <main>
      <div class="card">
        <h1>Check-in history</h1>
        <p class="muted">Each entry is your wellness log plus a non-medical summary for visit preparation. You can move entries to the <a href="#/patient/checkins/trash">recycle bin</a> to hide them from your linked clinician.</p>
        <div class="btn-row">
          <a class="btn btn-primary" href="#/patient/checkin">New check-in</a>
          <a class="btn btn-ghost" href="#/patient/checkins/trash">Recycle bin</a>
          <a class="btn btn-ghost" href="#/patient">Back to home</a>
        </div>
        ${cards}
      </div>
    </main>`;

  await bindLogout();
  bindCheckinSubmissionActions(root, session, {
    onChange: () => renderPatientCheckinsHistory(root),
  });
  if (focusId) {
    const el = document.getElementById(`checkin-${focusId}`);
    el?.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

async function renderPatientCheckinsTrash(root) {
  const session = requireSession("patient");
  if (!session) return;

  let subs = [];
  try {
    subs = isApiMode() ? await fetchMyTrashedSubmissions() : listSubmissions(session.patientId, { trash: true });
  } catch {
    subs = [];
  }

  const cards =
    subs.length === 0
      ? `<p class="muted">Recycle bin is empty. Removed check-ins appear here until you restore or delete them permanently.</p>`
      : subs.map((s) => renderCheckinHistoryCard(s, { trash: true })).join("");

  root.innerHTML =
    renderHeader(session) +
    `
    <main>
      <div class="card">
        <h1>Recycle bin</h1>
        <p class="muted">Check-ins here are hidden from your history and from linked clinicians. Restore to make them visible again, or delete permanently.</p>
        <div class="btn-row">
          <a class="btn btn-ghost" href="#/patient/checkins">Back to history</a>
          <a class="btn btn-ghost" href="#/patient">Home</a>
        </div>
        ${cards}
      </div>
    </main>`;

  await bindLogout();
  bindCheckinSubmissionActions(root, session, {
    onChange: () => renderPatientCheckinsTrash(root),
  });
}

async function router() {
  const root = document.getElementById("app");
  applyMobileShellClasses();
  setDoctorPortalBodyClass(false);
  document.body.classList.remove("portal-mobile", "lune-community-active", "lune-fullscreen");
  if (isApiMode()) {
    await refreshApiSession();
  }
  const hash = location.hash || "#/login";
  const route = hash.split("?")[0];

  if (route === "#/about") return await renderAbout(root);
  if (route === "#/login") return renderLogin(root);

  if (route.startsWith("#/patient") || route.startsWith("#/caregiver")) {
    document.body.classList.add("portal-mobile");
  }

  if (route === "#/patient") return await renderPatientHome(root);
  if (route === "#/patient/checkins/trash") return await renderPatientCheckinsTrash(root);
  if (route.startsWith("#/patient/checkins")) return await renderPatientCheckinsHistory(root);
  if (route === "#/patient/checkin") return await renderPatientCheckin(root);
  if (route === "#/patient/learn") return await renderPatientLearn(root);
  if (route === "#/patient/community") return await renderPatientCommunity(root);
  if (isLuneRoute(route, "patient")) return await renderPatientLune(root);
  if (route === "#/patient/chat") return await renderPatientChat(root);
  if (route === "#/patient/messages") return await renderPatientMessages(root);
  if (route === "#/patient/visit-brief") return await renderPatientVisitBrief(root);
  if (route === "#/patient/family") return await renderPatientFamily(root);
  if (route === "#/patient/screening") return await renderPatientScreening(root);
  if (route === "#/patient/find-help" || route === "#/patient/human-support") {
    return await renderPatientHumanSupport(root);
  }
  if (route === "#/patient/settings") return await renderPatientSettings(root);
  if (route === "#/caregiver/community") return await renderCaregiverCommunity(root);
  if (isLuneRoute(route, "caregiver")) return await renderCaregiverLune(root);
  if (route === "#/caregiver/link") return await renderCaregiverLink(root);
  if (route === "#/caregiver/chat") return await renderCaregiverDirectChat(root);
  if (route === "#/caregiver") return await renderCaregiverHomePage(root);
  if (route.startsWith("#/doctor")) {
    if (route === "#/doctor/research") {
      location.hash = "#/doctor";
      return;
    }
    return await renderDoctorPortal(root);
  }

  location.hash = "#/login";
}

window.addEventListener("hashchange", () => void router());
window.addEventListener("pageshow", (ev) => {
  if (ev.persisted) void router();
});

async function bootPortal() {
  initPlatform();
  await initPortal();
  if (!location.hash) location.hash = "#/login";
  await router();
}

window.addEventListener("load", () => void bootPortal());

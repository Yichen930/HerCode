import { loadBetweenVisit } from "./betweenVisitStore.js";
import {
  buildBetweenVisitInsights,
  formatSnapshotUpdatedAt,
  personLabel,
  renderBetweenVisitInsightGrid,
  filterSnapshotForCaregiverAudience,
} from "./betweenVisitInsights.js";
import { renderCohortReassurancePanel } from "./cohortReassurance.js";
import { getSharePartnerConsent, getShareChildrenConsent } from "./storage.js";

const HELP_TODAY = [
  {
    title: "Listen without fixing",
    body: "“I believe you” matters more than having the right answer.",
    theme: "listen",
  },
  {
    title: "Offer practical help",
    body: "Rest, meals, quiet company, or driving to visits — if they invite you.",
    theme: "practical",
  },
  {
    title: "Respect privacy",
    body: "They choose what to share here. Do not push for details they have not offered.",
    theme: "privacy",
  },
  {
    title: "Know when to escalate",
    body: "Encourage their oncology team, BCF, or urgent care — apps cannot replace humans.",
    theme: "escalate",
  },
];

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function sharingStatusLabel(relationship, sharing) {
  if (!sharing) return "Sharing off";
  if (relationship === "child") return "Child sharing on";
  if (relationship === "partner") return "Partner sharing on";
  return "Sharing on";
}

function renderPatientRoster(linkedPatients, selectedEmail, escapeHtml) {
  if (!linkedPatients.length) {
    return `<div class="caregiver-empty-state">
      <p class="caregiver-empty-title">No one linked yet</p>
      <p class="muted">Ask the person you support for the email they use to sign in.</p>
      <a class="btn btn-primary" href="#/caregiver/link">Link someone</a>
    </div>`;
  }

  const cards = linkedPatients
    .map((p) => {
      const email = p.patient_email || p;
      const selected = email === selectedEmail;
      const relationship = p.relationship || "other";
      const sharing = caregiverShareEnabled(email, p, relationship);
      const label = personLabel(email, p.display_name);
      const statusClass = sharing ? "caregiver-status--on" : "caregiver-status--off";
      const statusText = sharingStatusLabel(relationship, sharing);
      const relLabel =
        relationship === "partner" ? "Partner" : relationship === "child" ? "Adult child" : "Caregiver";
      return `<a href="#/caregiver?patient=${encodeURIComponent(email)}" class="caregiver-patient-card${selected ? " is-selected" : ""}">
        <span class="caregiver-patient-name">${escapeHtml(label)}</span>
        <span class="caregiver-patient-email muted">${escapeHtml(email)} · ${escapeHtml(relLabel)}</span>
        <span class="caregiver-status ${statusClass}">${escapeHtml(statusText)}</span>
      </a>`;
    })
    .join("");

  return `<div class="caregiver-roster">
    <div class="caregiver-roster-head">
      <h2>People you support</h2>
      <div class="btn-row">
        <button type="button" class="btn btn-ghost btn-sm" id="caregiverRefreshSnapshot">Refresh</button>
        <a class="btn btn-ghost btn-sm" href="#/caregiver/link">+ Link</a>
      </div>
    </div>
    <div class="caregiver-roster-grid">${cards}</div>
  </div>`;
}

function renderSharingOffPanel(name, personEmail, escapeHtml, relationship = "other") {
  const chatHref = personEmail
    ? `#/caregiver/chat?patient=${encodeURIComponent(personEmail)}`
    : "#/caregiver/chat";
  const privacyStep =
    relationship === "child"
      ? "Turn on <strong>Share age-appropriate summaries with adult children</strong>"
      : "Turn on <strong>Share between-visit summaries with partner or spouse</strong>";
  const who =
    relationship === "child"
      ? "adult children linked as caregivers"
      : "partner or spouse linked as caregivers";
  return `<div class="caregiver-panel caregiver-panel--blocked">
    <div class="caregiver-status-bar caregiver-status-bar--off">
      <span class="caregiver-status caregiver-status--off">Sharing off</span>
      <span class="muted">${escapeHtml(name)} has not enabled this type of sharing yet.</span>
      <a class="btn btn-ghost btn-sm" href="${chatHref}">Direct message</a>
    </div>
    <div class="callout callout-info">
      <p><strong>What they can do</strong></p>
      <ol class="caregiver-steps">
        <li>Sign in to HearHer on their phone or computer</li>
        <li>Open <strong>Privacy</strong></li>
        <li>${privacyStep}</li>
      </ol>
      <p class="muted">Direct messages still work once linked. Summaries for ${escapeHtml(who)} need the matching Privacy toggle.</p>
    </div>
  </div>`;
}

function renderHelpTodayCards(escapeHtml) {
  const cards = HELP_TODAY.map(
    (tip) =>
      `<article class="caregiver-help-card caregiver-help--${escapeHtml(tip.theme)}">
        <h3>${escapeHtml(tip.title)}</h3>
        <p class="muted">${escapeHtml(tip.body)}</p>
      </article>`
  ).join("");
  return `<section class="caregiver-panel">
    <header class="home-panel-head">
      <h2>How you can help today</h2>
    </header>
    <div class="caregiver-help-grid">${cards}</div>
  </section>`;
}

function renderCaregiverQuickActions(escapeHtml) {
  return `<div class="caregiver-quick-actions">
    <a class="caregiver-quick-chip" href="#/caregiver/lune/witnesses">Community</a>
    <a class="caregiver-quick-chip" href="#/caregiver/chat">Emergency contacts</a>
    <a class="caregiver-quick-chip" href="https://bcf.org.sg/guidance/caregiving" target="_blank" rel="noopener noreferrer">BCF guide</a>
    <a class="caregiver-quick-chip" href="#/caregiver/link">Link someone</a>
    <a class="caregiver-quick-chip" href="#/about">About HearHer</a>
  </div>`;
}

function renderCaregiverDashboard(data, personEmail, escapeHtml, opts = {}) {
  const { displayName = "", updatedAt = null, relationship = "other" } = opts;
  const filtered = filterSnapshotForCaregiverAudience(data, relationship);
  const insights = buildBetweenVisitInsights(personEmail, filtered, displayName);

  const emptyPanel = !insights.hasContent
    ? `<div class="callout callout-info caregiver-waiting">
        <p><strong>${escapeHtml(insights.name)} is linked and sharing is on.</strong></p>
        <p class="muted">Their summary appears after they use Support, Wellness log, Visit brief, or Family explain.</p>
      </div>`
    : "";

  return `
    <div class="caregiver-dashboard">
      <div class="caregiver-status-bar caregiver-status-bar--on">
        <span class="caregiver-status caregiver-status--on">${escapeHtml(sharingStatusLabel(relationship, true))}</span>
        <span class="muted">${escapeHtml(formatSnapshotUpdatedAt(updatedAt || data.updatedAt))}</span>
        <a class="btn btn-ghost btn-sm" href="#/caregiver/chat?patient=${encodeURIComponent(personEmail)}">Direct message</a>
      </div>
      ${renderCohortReassurancePanel(insights.reassurance)}
      ${emptyPanel}
      ${insights.hasContent ? renderBetweenVisitInsightGrid(insights, escapeHtml, { audience: "caregiver", caregiverRelationship: relationship }) : ""}
      <p class="muted caregiver-footnote">Read-only with their consent. Not medical advice.</p>
    </div>`;
}

export function renderCaregiverHome(session, escapeHtml, linkedPatients = [], selectedEmail = "", opts = {}) {
  const { shareEnabled = true, patientDisplayName = "", updatedAt = null, relationship = "other" } = opts;

  const roster = renderPatientRoster(linkedPatients, selectedEmail, escapeHtml);
  let content = "";

  if (selectedEmail) {
    const name = personLabel(selectedEmail, patientDisplayName);
    if (!shareEnabled) {
      content = renderSharingOffPanel(name, selectedEmail, escapeHtml, relationship);
    } else {
      const data = loadBetweenVisit(selectedEmail);
      content = renderCaregiverDashboard(data, selectedEmail, escapeHtml, {
        displayName: patientDisplayName,
        updatedAt,
        relationship,
      });
    }
  }

  return `
    <main class="caregiver-main home-main portal-mobile">
      <section class="home-hero home-hero--caregiver">
        <div class="home-hero-inner">
          <p class="home-eyebrow">Caregiver · ${escapeHtml(session.displayName || "Caregiver")}</p>
          <p class="home-hero-tagline">Support between clinic visits</p>
          <p class="home-lead">Plain-language summaries — only when they choose to share.</p>
          ${renderCaregiverQuickActions(escapeHtml)}
        </div>
      </section>
      ${roster}
      ${content}
      ${renderHelpTodayCards(escapeHtml)}
    </main>`;
}

export function renderCaregiverLinkPage(session, escapeHtml) {
  return `
    <main class="caregiver-main portal-mobile">
      <div class="card caregiver-link-page">
        <h1>Link someone you support</h1>
        <p class="muted">Their HearHer sign-in email and your relationship. Summaries stay off until they enable the matching Privacy toggle.</p>
        <ol class="caregiver-steps caregiver-steps--compact">
          <li>Enter their email and how you are linked</li>
          <li>They open <strong>Privacy</strong> → turn on sharing for partner <em>or</em> adult children</li>
          <li>Tap <strong>Refresh</strong> on your dashboard</li>
        </ol>
        <form id="caregiverLinkForm" class="caregiver-link-form">
          <label>Their email
            <input type="email" id="caregiverPatientEmail" required placeholder="name@example.com" autocomplete="email" inputmode="email" />
          </label>
          <label>I am their…
            <select id="caregiverRelationship" required>
              <option value="partner">Partner or spouse</option>
              <option value="child">Adult child</option>
              <option value="other">Other caregiver</option>
            </select>
          </label>
          <div class="btn-row">
            <button type="submit" class="btn btn-primary">Link</button>
            <a class="btn btn-ghost" href="#/caregiver">Back</a>
          </div>
        </form>
        <p id="caregiverLinkMsg" class="muted"></p>
      </div>
    </main>`;
}

export function initCaregiverHome(onSelectPatient, onRefresh) {
  document.getElementById("caregiverPatientSelect")?.addEventListener("change", (e) => {
    onSelectPatient(e.target.value);
  });
  document.getElementById("caregiverRefreshSnapshot")?.addEventListener("click", () => {
    onRefresh?.();
  });
}

export function caregiverShareEnabled(patientEmail, apiPatientRow, relationship = "other") {
  const rel = apiPatientRow?.relationship || relationship || "other";
  if (apiPatientRow) {
    if (typeof apiPatientRow.sharing_enabled === "boolean") return apiPatientRow.sharing_enabled;
    if (rel === "child") {
      return Boolean(apiPatientRow.share_with_children ?? apiPatientRow.share_with_caregiver);
    }
    return Boolean(apiPatientRow.share_with_partner ?? apiPatientRow.share_with_caregiver);
  }
  if (rel === "child") return getShareChildrenConsent(patientEmail);
  return getSharePartnerConsent(patientEmail);
}

export { buildBetweenVisitInsights as buildCaregiverInsights };

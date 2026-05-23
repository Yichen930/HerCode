/**
 * Clinician portal — desktop web layout with sidebar views.
 */

import {
  buildBetweenVisitInsights,
  formatSnapshotUpdatedAt,
  personLabel,
  renderBetweenVisitInsightGrid,
} from "./betweenVisitInsights.js";
import { renderCohortReassurancePanel } from "./cohortReassurance.js";

export const DOCTOR_VIEWS = [
  { id: "dashboard", href: "#/doctor", label: "Dashboard", desc: "Roster & overview" },
  { id: "between-visit", href: "#/doctor/between-visit", label: "Between-visit", desc: "Emotional & visit prep" },
  { id: "checkins", href: "#/doctor/checkins", label: "Wellness log", desc: "Structured check-ins" },
  { id: "chat", href: "#/doctor/chat", label: "Direct messages", desc: "Urgent two-way chat" },
  { id: "clinical", href: "#/doctor/clinical", label: "Documentation", desc: "Diagnosis & visit notes" },
  { id: "export", href: "#/doctor/export", label: "Export CSV", desc: "Download records" },
  { id: "link", href: "#/doctor/link", label: "Link person", desc: "Add to roster" },
  { id: "moderation", href: "#/doctor/moderation", label: "Safety log", desc: "Flagged community posts" },
];

export function parseDoctorView(hash) {
  const route = (hash || "#/doctor").split("?")[0];
  const found = DOCTOR_VIEWS.find((v) => v.href === route);
  return found?.id || "dashboard";
}

export function setDoctorPortalBodyClass(active) {
  document.body.classList.toggle("doctor-desktop-portal", active);
}

function sidebarLink(view, current, escapeHtml) {
  const v = DOCTOR_VIEWS.find((x) => x.id === view);
  if (!v) return "";
  const active = view === current ? " is-active" : "";
  return `<a href="${v.href}" class="doctor-sidebar-link${active}" aria-current="${view === current ? "page" : "false"}">
    <span class="doctor-sidebar-label">${escapeHtml(v.label)}</span>
    <span class="doctor-sidebar-desc">${escapeHtml(v.desc)}</span>
  </a>`;
}

export function renderDoctorPatientRail(patientEmails, selectedEmail, escapeHtml) {
  if (!patientEmails.length) {
    return `<div class="doctor-rail-empty muted">No linked people yet. Use <a href="#/doctor/link">Link person</a>.</div>`;
  }
  return `<div class="doctor-patient-rail" role="tablist" aria-label="Linked people">
    ${patientEmails
      .map((row) => {
        const email = row.patient_email || row;
        const label = personLabel(email, row.display_name);
        const active = email === selectedEmail ? " is-active" : "";
        const chat = row.share_chat_with_doctor ? "Chat on" : "Chat off";
        return `<button type="button" class="doctor-rail-item${active}" data-doctor-patient="${escapeHtml(email)}" role="tab" aria-selected="${email === selectedEmail}">
          <span class="doctor-rail-name">${escapeHtml(label)}</span>
          <span class="doctor-rail-email">${escapeHtml(email)}</span>
          <span class="doctor-rail-meta">${escapeHtml(chat)}</span>
        </button>`;
      })
      .join("")}
  </div>`;
}

export function renderDoctorShell(session, view, patientEmails, selectedEmail, workspaceHtml, escapeHtml) {
  const viewMeta = DOCTOR_VIEWS.find((v) => v.id === view) || DOCTOR_VIEWS[0];
  const selectedLabel = selectedEmail ? personLabel(selectedEmail) : "None selected";

  return `
    <div class="doctor-shell">
      <aside class="doctor-sidebar" aria-label="Clinician navigation">
        <div class="doctor-sidebar-brand">
          <span class="badge badge-doctor">Clinician workspace</span>
          <p class="doctor-sidebar-user muted">${escapeHtml(session.displayName || session.email || "Clinician")}</p>
        </div>
        <nav class="doctor-sidebar-nav">
          ${DOCTOR_VIEWS.map((v) => sidebarLink(v.id, view, escapeHtml)).join("")}
        </nav>
        <div class="doctor-sidebar-rail">
          <p class="doctor-sidebar-rail-title">Active person</p>
          ${renderDoctorPatientRail(patientEmails, selectedEmail, escapeHtml)}
        </div>
      </aside>
      <div class="doctor-workspace">
        <header class="doctor-workspace-head">
          <div>
            <h1>${escapeHtml(viewMeta.label)}</h1>
            <p class="muted">${escapeHtml(viewMeta.desc)} · Reviewing <strong>${escapeHtml(selectedLabel)}</strong></p>
          </div>
          <div class="doctor-workspace-actions btn-row">
            <a class="btn btn-ghost btn-sm" href="#/doctor/link">Link person</a>
            <a class="btn btn-ghost btn-sm" href="#/about">About</a>
          </div>
        </header>
        <div class="doctor-workspace-body">${workspaceHtml}</div>
      </div>
    </div>`;
}

export function renderDoctorDashboardOverview(stats, escapeHtml) {
  const rows = stats.overview
    .map(
      (o) =>
        `<tr class="${o.email === stats.selectedEmail ? "is-active" : ""}" data-doctor-patient-row="${escapeHtml(o.email)}">
          <td><strong>${escapeHtml(personLabel(o.email, o.displayName))}</strong><br><span class="muted">${escapeHtml(o.email)}</span></td>
          <td>${o.checkins}</td>
          <td>${o.diagnoses}</td>
          <td>${o.hasSnapshot ? "Yes" : "—"}</td>
        </tr>`
    )
    .join("");

  return `
    <section class="doctor-workspace-panel">
      <div class="doctor-dash-stat-grid doctor-dash-stat-grid--wide">
        <div class="doctor-dash-stat"><span class="doctor-dash-stat-value">${stats.linkedCount}</span><span class="doctor-dash-stat-label">Linked people</span></div>
        <div class="doctor-dash-stat"><span class="doctor-dash-stat-value">${stats.totalCheckins}</span><span class="doctor-dash-stat-label">Total wellness logs</span></div>
        <div class="doctor-dash-stat"><span class="doctor-dash-stat-value">${stats.withSnapshot}</span><span class="doctor-dash-stat-label">With between-visit data</span></div>
        <div class="doctor-dash-stat doctor-dash-stat--accent"><span class="doctor-dash-stat-value">${stats.selectedEmail ? "1" : "0"}</span><span class="doctor-dash-stat-label">Active selection</span></div>
      </div>
      ${
        stats.linkedCount
          ? `<div class="doctor-use-cases">
          <a class="doctor-use-case" href="#/doctor/between-visit"><strong>Between-visit prep</strong><span class="muted">Emotions, visit brief, questions</span></a>
          <a class="doctor-use-case" href="#/doctor/checkins"><strong>Wellness logs</strong><span class="muted">Mood, sleep, side effects over time</span></a>
          <a class="doctor-use-case" href="#/doctor/chat"><strong>Direct messages</strong><span class="muted">Two-way chat for urgent check-ins</span></a>
          <a class="doctor-use-case" href="#/doctor/clinical"><strong>Visit documentation</strong><span class="muted">Diagnosis log after appointments</span></a>
        </div>
        <div class="research-table-wrap">
          <table class="doctor-overview-table">
            <thead><tr><th>Person</th><th>Logs</th><th>Diagnoses</th><th>Between-visit</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>`
          : `<div class="callout callout-info"><p>No linked people yet. Ask for their HearHer sign-in email and <a href="#/doctor/link">link them</a>.</p></div>`
      }
    </section>`;
}

export function renderDoctorBetweenVisitPanel(data, personEmail, escapeHtml, opts = {}) {
  const { displayName = "", updatedAt = null } = opts;
  const insights = buildBetweenVisitInsights(personEmail, data, displayName);

  if (!insights.hasContent) {
    return `<section class="doctor-workspace-panel callout callout-info">
      <p><strong>No between-visit snapshot yet.</strong></p>
      <p class="muted">${escapeHtml(insights.name)} has not saved Support, Wellness log, or Visit brief content — or has not synced while the server was connected.</p>
    </section>`;
  }

  return `
    <section class="doctor-workspace-panel doctor-between-visit">
      <p class="muted doctor-snapshot-meta">${escapeHtml(formatSnapshotUpdatedAt(updatedAt || data.updatedAt))}</p>
      ${renderCohortReassurancePanel(insights.reassurance)}
      ${renderBetweenVisitInsightGrid(insights, escapeHtml, { audience: "clinician" })}
      <p class="muted">Qualitative context for visit prep — not medical advice or diagnosis.</p>
    </section>`;
}

export function renderDoctorNoSelection(view, escapeHtml) {
  return `<div class="callout callout-info doctor-no-selection">
    <p><strong>Select someone from the left rail</strong> to open ${escapeHtml(view)}.</p>
    <p class="muted">Or link a new person under Link person.</p>
  </div>`;
}

export function bindDoctorPatientRail(root, onSelect) {
  root.querySelectorAll("[data-doctor-patient]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const email = btn.getAttribute("data-doctor-patient");
      if (email) onSelect(email);
    });
  });
  root.querySelectorAll("[data-doctor-patient-row]").forEach((row) => {
    row.style.cursor = "pointer";
    row.addEventListener("click", () => {
      const email = row.getAttribute("data-doctor-patient-row");
      if (email) onSelect(email);
    });
  });
}

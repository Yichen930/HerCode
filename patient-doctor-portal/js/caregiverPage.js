import { loadBetweenVisit } from "./betweenVisitStore.js";
import { buildCaregiverBrief } from "./visitBrief.js";
import { getCohortReassurance, renderCohortReassurancePanel } from "./cohortReassurance.js";
import { getShareCaregiverConsent } from "./storage.js";

export function renderCaregiverHome(session, escapeHtml, linkedPatients = [], selectedEmail = "", opts = {}) {
  const { shareEnabled = true } = opts;
  const patientOptions =
    linkedPatients.length === 0
      ? `<p class="muted">No linked patients yet. Ask the person you support for their account email, then link them below.</p>`
      : `<label>Select person you support
          <select id="caregiverPatientSelect">
            ${linkedPatients
              .map((p) => {
                const email = p.patient_email || p;
                return `<option value="${escapeHtml(email)}" ${email === selectedEmail ? "selected" : ""}>${escapeHtml(email)}</option>`;
              })
              .join("")}
          </select>
        </label>`;

  let content = "";
  if (selectedEmail) {
    if (!shareEnabled) {
      content = `<div class="callout callout-info">
        <p><strong>Sharing is off.</strong> The patient must enable “Share between-visit summaries with linked caregivers” under Privacy before you can read their summary.</p>
      </div>`;
    } else {
      const data = loadBetweenVisit(selectedEmail);
      const brief = buildCaregiverBrief(selectedEmail, selectedEmail.split("@")[0]);
      const reassurance = renderCohortReassurancePanel(
        getCohortReassurance(data.reflectAnswers, data.supportCollected)
      );

      content = `
        <section class="caregiver-view">
          <h2>Shared between-visit summary</h2>
          <p class="muted">Read-only view when the patient enables caregiver sharing. Not medical advice.</p>
          ${reassurance}
          <pre class="caregiver-brief">${escapeHtml(brief)}</pre>
          <h3>How you can help today</h3>
          <ul class="caregiver-tips">
            <li>Listen without minimizing — “I believe you” matters more than fixing everything.</li>
            <li>Offer practical help on hard days (rest, meals, company at visits if invited).</li>
            <li>Encourage professional care for urgent symptoms or emotional crisis — apps cannot replace humans.</li>
            <li>Take care of yourself too — caregivers often struggle quietly while trying to stay strong.</li>
          </ul>
        </section>`;
    }
  }

  return `
    <main class="caregiver-main">
      <section class="home-hero home-hero--caregiver">
        <div class="home-hero-inner">
          <p class="home-eyebrow">Caregiver portal</p>
          <p class="home-hero-tagline">Support between clinic visits</p>
          <p class="home-lead">See what the person you support wants you to understand — in plain language, with their consent.</p>
        </div>
      </section>
      <section class="home-panel">
        <header class="home-panel-head">
          <h2>Linked patients</h2>
        </header>
        ${patientOptions}
        ${content}
        <div class="btn-row">
          <a class="btn btn-ghost" href="#/caregiver/link">Link a patient</a>
          <a class="btn btn-ghost" href="https://bcf.org.sg/guidance/caregiving" target="_blank" rel="noopener noreferrer">BCF caregiving guide</a>
          <a class="btn btn-ghost" href="#/about">About</a>
        </div>
      </section>
    </main>`;
}

export function renderCaregiverLinkPage(session, escapeHtml) {
  return `
    <main>
      <div class="card">
        <h1>Link a patient</h1>
        <p class="muted">Enter the email they use to sign in. They must enable caregiver sharing under Privacy for you to read between-visit summaries.</p>
        <form id="caregiverLinkForm">
          <label>Patient email
            <input type="email" id="caregiverPatientEmail" required placeholder="patient@example.com" />
          </label>
          <button type="submit" class="btn btn-primary">Link patient</button>
        </form>
        <p id="caregiverLinkMsg" class="muted"></p>
        <a class="btn btn-ghost" href="#/caregiver">Back</a>
      </div>
    </main>`;
}

export function initCaregiverHome(onSelectPatient) {
  document.getElementById("caregiverPatientSelect")?.addEventListener("change", (e) => {
    onSelectPatient(e.target.value);
  });
}

export function caregiverShareEnabled(patientEmail, apiPatientRow) {
  if (apiPatientRow && typeof apiPatientRow.share_with_caregiver === "boolean") {
    return apiPatientRow.share_with_caregiver;
  }
  return getShareCaregiverConsent(patientEmail);
}

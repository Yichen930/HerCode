/**
 * Screening barriers — nudge toward annual check-up via professionals, not AI diagnosis.
 */

import { addVisitQuestion } from "./betweenVisitStore.js";
import { syncBetweenVisitSnapshot } from "./sessionManager.js";
import { renderAiNotCounsellorBanner } from "./humanSupportLadder.js";

const REMINDER_KEY = "hearher.screening.reminder.v1";

export const SCREENING_BARRIERS = [
  {
    id: "fear",
    title: "Fear of knowing",
    lead: "Many people delay screening because they fear bad news — that does not mean you do not care about your health.",
    body: [
      "Knowing can feel scary because it makes things real. You are allowed to take small steps — such as asking what screening involves before booking anything.",
      "Screening does not mean you already have cancer. It helps clinicians find changes early, when more options may be available.",
      "You can bring someone you trust, write questions first, or ask for the gentlest pathway your clinic offers.",
    ],
    question: "What would screening involve for me — and what support is available if I feel anxious about results?",
    professionalLabel: "Talk to your GP or breast screening programme",
    professionalNote: "A clinician can explain the process without pushing you before you are ready.",
  },
  {
    id: "faith",
    title: "Faith & privacy",
    lead: "Religious beliefs and modesty are valid. Screening plans can often be adapted when you ask.",
    body: [
      "You can request a female clinician, a chaperone, a private room, or a clear explanation of who will be present.",
      "Some people speak with a faith leader and their doctor together — there is no conflict between faith and caring for your body.",
      "Declining once does not close the door forever. You can revisit when you feel ready.",
    ],
    question: "Can screening be arranged with a female clinician and privacy options that respect my faith?",
    professionalLabel: "Ask your GP or screening centre about privacy options",
    professionalNote: "BCF and clinical teams can help you find culturally sensitive pathways.",
  },
  {
    id: "notme",
    title: "«It won't happen to me»",
    lead: "Feeling «young» or «healthy» is common — breast cancer can still affect people without obvious symptoms.",
    body: [
      "Many women who were diagnosed also thought it would not happen to them.",
      "Annual check-ups are about information, not assuming the worst.",
      "If you have children, early conversations with a doctor can protect your whole family’s peace of mind — without frightening them.",
    ],
    question: "Given my age and family history, do I need a mammogram or breast check this year?",
    professionalLabel: "Ask your GP about screening timing",
    professionalNote: "Only a qualified professional can advise what is right for you.",
  },
];

const BCF_URL = "https://www.bcf.org.sg/";
const BCF_CAREGIVER = "https://bcf.org.sg/guidance/caregiving";

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function getScreeningReminderEnabled(patientId) {
  try {
    return localStorage.getItem(`${REMINDER_KEY}:${patientId}`) === "1";
  } catch {
    return false;
  }
}

export function setScreeningReminderEnabled(patientId, enabled) {
  localStorage.setItem(`${REMINDER_KEY}:${patientId}`, enabled ? "1" : "0");
}

export function renderScreeningPage(session, escapeHtml, activeTab = "fear") {
  const tab = SCREENING_BARRIERS.some((b) => b.id === activeTab) ? activeTab : "fear";
  const barrier = SCREENING_BARRIERS.find((b) => b.id === tab);

  const tabs = SCREENING_BARRIERS.map(
    (b) =>
      `<a href="#/patient/screening?barrier=${escapeHtml(b.id)}" class="screening-tab${b.id === tab ? " is-active" : ""}">${escapeHtml(b.title)}</a>`
  ).join("");

  const body = barrier.body.map((p) => `<p>${escapeHtml(p)}</p>`).join("");
  const reminderOn = getScreeningReminderEnabled(session.patientId);

  return `
    <main>
      <div class="card screening-page">
        <h1>Thinking about your annual check-up?</h1>
        <p class="muted">This app does not diagnose or tell you what to do. It helps you name barriers and <strong>link to professionals</strong> when you are ready.</p>
        ${renderAiNotCounsellorBanner()}
        <nav class="screening-tabs" aria-label="Screening barriers">${tabs}</nav>
        <section class="screening-barrier-panel">
          <h2>${escapeHtml(barrier.title)}</h2>
          <p class="screening-barrier-lead">${escapeHtml(barrier.lead)}</p>
          ${body}
          <div class="screening-question-box">
            <p class="screening-mini-label">Question you can ask a professional</p>
            <blockquote>${escapeHtml(barrier.question)}</blockquote>
            <button type="button" class="btn btn-primary btn-sm" id="saveScreeningQuestion" data-question="${escapeHtml(barrier.question)}">Save to visit questions</button>
          </div>
          <div class="screening-professional-box callout callout-info">
            <h3>${escapeHtml(barrier.professionalLabel)}</h3>
            <p class="muted">${escapeHtml(barrier.professionalNote)}</p>
            <div class="btn-row">
              <a class="btn btn-ghost btn-sm" href="#/patient/find-help">Find human help</a>
              <a class="btn btn-ghost btn-sm" href="${BCF_URL}" target="_blank" rel="noopener noreferrer">BCF resources</a>
            </div>
          </div>
        </section>
        <section class="screening-reminder">
          <h2>When you are ready</h2>
          <label class="checkbox-row">
            <input type="checkbox" id="screeningReminder" ${reminderOn ? "checked" : ""} />
            Remind me once a year to ask my doctor about breast screening (on this device only)
          </label>
          <p id="screeningMsg" class="muted"></p>
        </section>
        <div class="btn-row">
          <a class="btn btn-ghost" href="#/patient/visit-brief">Visit brief</a>
          <a class="btn btn-ghost" href="#/patient">Home</a>
        </div>
      </div>
    </main>`;
}

export function parseScreeningBarrierFromHash() {
  const hash = location.hash || "";
  const q = hash.split("?")[1] || "";
  return new URLSearchParams(q).get("barrier") || "fear";
}

export function initScreeningPage(session) {
  document.getElementById("saveScreeningQuestion")?.addEventListener("click", (e) => {
    const q = e.currentTarget.getAttribute("data-question");
    if (q) {
      addVisitQuestion(session.patientId, { text: q, source: "screening" });
      document.getElementById("screeningMsg").textContent = "Saved to your visit questions on Home.";
      void syncBetweenVisitSnapshot(session);
    }
  });

  document.getElementById("screeningReminder")?.addEventListener("change", (e) => {
    setScreeningReminderEnabled(session.patientId, e.target.checked);
    document.getElementById("screeningMsg").textContent = e.target.checked
      ? "Reminder saved on this device. We will not spam you — this is a gentle annual nudge only."
      : "Reminder turned off.";
  });
}

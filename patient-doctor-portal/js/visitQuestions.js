import {
  loadBetweenVisit,
  addVisitQuestion,
  removeVisitQuestion,
} from "./betweenVisitStore.js";

export function renderVisitQuestionsPanel(patientId, escapeHtml) {
  const data = loadBetweenVisit(patientId);
  const items =
    data.visitQuestions.length === 0
      ? `<p class="muted">Questions you save from Support, Reflect, or Check-in appear here — ready for your next visit.</p>`
      : `<ul class="visit-questions-list" id="visitQuestionsList">${data.visitQuestions
          .map(
            (q) =>
              `<li class="visit-question-item" data-id="${escapeHtml(q.id)}">
                <span class="visit-question-text">${escapeHtml(q.text)}</span>
                <span class="visit-question-meta muted">${escapeHtml(q.source || "saved")}</span>
                <button type="button" class="btn btn-ghost btn-sm visit-question-remove" data-remove="${escapeHtml(q.id)}" aria-label="Remove">×</button>
              </li>`
          )
          .join("")}</ul>`;

  return `<section class="home-panel home-panel--visit-questions" id="visitQuestionsPanel">
    <header class="home-panel-head home-panel-head--row">
      <div>
        <h2>Questions for my next visit</h2>
        <p class="muted">Emotional, practical, or hard to say out loud — save them here.</p>
      </div>
      <a class="btn btn-ghost btn-sm" href="#/patient/visit-brief">Visit brief</a>
    </header>
    ${items}
    <form class="visit-questions-add" id="visitQuestionForm">
      <label class="sr-only" for="visitQuestionInput">Add a question</label>
      <input type="text" id="visitQuestionInput" placeholder="e.g. What could explain my fatigue between periods?" maxlength="500" />
      <button type="submit" class="btn btn-primary btn-sm">Add</button>
    </form>
  </section>`;
}

export function initVisitQuestionsPanel(patientId) {
  const form = document.getElementById("visitQuestionForm");
  const list = document.getElementById("visitQuestionsList");
  const panel = document.getElementById("visitQuestionsPanel");

  form?.addEventListener("submit", (e) => {
    e.preventDefault();
    const input = document.getElementById("visitQuestionInput");
    const text = (input?.value || "").trim();
    if (!text) return;
    addVisitQuestion(patientId, { text, source: "manual" });
    input.value = "";
    refreshVisitQuestionsDom(patientId);
  });

  panel?.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-remove]");
    if (!btn) return;
    removeVisitQuestion(patientId, btn.getAttribute("data-remove"));
    refreshVisitQuestionsDom(patientId);
  });
}

function refreshVisitQuestionsDom(patientId) {
  const panel = document.getElementById("visitQuestionsPanel");
  if (!panel) return;
  const escapeHtml = (s) =>
    String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  const parent = panel.parentElement;
  const html = renderVisitQuestionsPanel(patientId, escapeHtml);
  const tmp = document.createElement("div");
  tmp.innerHTML = html;
  parent.replaceChild(tmp.firstElementChild, panel);
  initVisitQuestionsPanel(patientId);
}

/** Auto-collect from reflect suggestions and support fields */
export function autoCollectVisitQuestions(patientId, { suggestions = [], supportCollected = {}, oneThing = "" } = {}) {
  for (const s of suggestions.slice(0, 2)) {
    if (typeof s === "string" && s.includes("ask")) {
      addVisitQuestion(patientId, { text: s.replace(/^You can ask[: ]*/i, "Can we discuss: "), source: "reflect" });
    }
  }
  if (oneThing) {
    addVisitQuestion(patientId, { text: oneThing, source: "support" });
  }
  if (supportCollected.visitGoal === "heard") {
    addVisitQuestion(patientId, {
      text: "I need you to understand how much this affects my daily life.",
      source: "support",
    });
  }
  if (supportCollected.toldJustStress === "yes") {
    addVisitQuestion(patientId, {
      text: "What else could explain my symptoms besides stress?",
      source: "dismissal",
    });
  }
}

export function getVisitQuestions(patientId) {
  return loadBetweenVisit(patientId).visitQuestions;
}

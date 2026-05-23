/** Home prompt cards — between-visit questions from stakeholder research */

const PROMPTS = [
  {
    id: "feelings",
    question: "What am I feeling right now?",
    desc: "Name fear, grief, or overload after diagnosis.",
    href: "#/patient/chat?tab=feelings",
    theme: "feelings",
  },
  {
    id: "doctor",
    question: "What should I ask my doctor next?",
    desc: "Save questions that are emotional, practical, or hard to say out loud.",
    href: "#/patient/visit-brief",
    theme: "doctor",
  },
  {
    id: "family",
    question: "How do I explain this to my family?",
    desc: "Plain-language words for someone you trust.",
    href: "#/patient/family",
    theme: "family",
  },
  {
    id: "human",
    question: "When should I reach out for human support?",
    desc: "Link to BCF, your GP, counsellor, or oncology team — AI is not your counsellor.",
    href: "#/patient/find-help",
    theme: "human",
  },
  {
    id: "messages",
    question: "Need an emergency contact in case something feels urgent?",
    desc: "Call or text your linked clinician or caregiver — one tap away.",
    href: "#/patient/messages",
    theme: "messages",
  },
  {
    id: "screening",
    question: "Thinking about your annual check-up?",
    desc: "Fear of knowing, faith & privacy, or «it won't happen to me».",
    href: "#/patient/screening",
    theme: "screening",
  },
];

export function renderBetweenVisitPromptCards(escapeHtml) {
  const cards = PROMPTS.map(
    (p) =>
      `<a href="${p.href}" class="between-prompt-card between-prompt--${escapeHtml(p.theme)}">
        <span class="between-prompt-q">${escapeHtml(p.question)}</span>
        <span class="between-prompt-desc muted">${escapeHtml(p.desc)}</span>
        <span class="between-prompt-arrow" aria-hidden="true">→</span>
      </a>`
  ).join("");

  return `<section class="home-panel home-panel--prompts">
    <header class="home-panel-head">
      <h2>Between appointments</h2>
      <p class="muted">Emotions continue when you leave the clinic. Not every question is medical.</p>
    </header>
    <div class="between-prompt-grid">${cards}</div>
  </section>`;
}

export function parseSupportTabFromHash() {
  const hash = location.hash || "";
  const q = hash.split("?")[1] || "";
  const params = new URLSearchParams(q);
  return params.get("tab") || "";
}

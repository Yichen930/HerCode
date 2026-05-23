/**
 * Find human help — link to professionals. AI is not the counsellor.
 */

const BCF_HOME = "https://www.bcf.org.sg/";
const BCF_CAREGIVING = "https://bcf.org.sg/guidance/caregiving";

const PROFESSIONAL_SECTIONS = [
  {
    id: "counsellor",
    title: "Counsellor or mental health professional",
    desc: "For ongoing fear, grief, body-image distress, or anxiety — especially after diagnosis or while waiting for results.",
    links: [
      { label: "Ask your GP for a referral", external: false, note: "Your GP can refer you to counselling or psychosocial oncology support." },
      { label: "BCF support programmes", href: BCF_HOME, external: true, note: "Programmes and peer support — complement, not replace, licensed therapy." },
    ],
  },
  {
    id: "oncology",
    title: "Oncology team & GP",
    desc: "For treatment, side effects, or urgent physical symptoms.",
    links: [
      { label: "Contact your oncology team", external: false, note: "Use the after-hours number your hospital provided when unsure." },
      { label: "Emergency services", external: false, note: "For acute symptoms your team flagged as emergencies — do not wait for an app." },
    ],
  },
  {
    id: "screening",
    title: "Annual breast screening",
    desc: "Screening decisions require a qualified clinician. We help you prepare questions, not decide for you.",
    links: [
      { label: "Screening barriers & questions", href: "#/patient/screening", external: false, note: "Fear of knowing, faith & privacy, or «it won't happen to me»." },
      { label: "Example question for your GP", external: false, note: "«Do I need a mammogram this year given my age and family history?»" },
    ],
  },
  {
    id: "caregiver",
    title: "Caregivers & family",
    desc: "Caregivers often struggle quietly while trying to stay strong.",
    links: [
      { label: "BCF caregiving guidance", href: BCF_CAREGIVING, external: true, note: "Practical support for people caring for someone with breast cancer." },
      { label: "Caregiver portal", href: "#/caregiver", external: false, note: "Read shared summaries when the patient enables consent." },
    ],
  },
  {
    id: "peers",
    title: "Peer support",
    desc: "Community can reduce isolation — not clinical care or crisis support.",
    links: [{ label: "Peer community", href: "#/patient/community", external: false, note: "Moderated stories; not for emergencies." }],
  },
];

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function renderAiNotCounsellorBanner() {
  return `<div class="callout callout-info ai-not-counsellor-banner" role="note">
    <strong>AI is not your counsellor.</strong> This companion helps you reflect and prepare. Emotional care and medical decisions belong with qualified professionals.
  </div>`;
}

function renderLink(l, escapeHtml) {
  if (l.href) {
    const ext = l.external ? ` target="_blank" rel="noopener noreferrer"` : "";
    return `<a href="${escapeHtml(l.href)}"${ext}>${escapeHtml(l.label)}</a>`;
  }
  return `<strong>${escapeHtml(l.label)}</strong>`;
}

/**
 * @param {{ supportCollected?: Record<string, string> }} [ctx]
 */
export function getHighlightedStep(ctx = {}) {
  const c = ctx.supportCollected || {};
  if (c.stressLevel === "high" || c.emotionalBurden === "fear") return "human";
  if (c.emotionalBurden === "dismissed" || c.toldJustStress === "yes") return "clinician";
  if (c.supportNetwork === "alone") return "peers";
  return "reflect";
}

export function renderFindHumanHelpPage(escapeHtml, ctx = {}) {
  const sections = PROFESSIONAL_SECTIONS.map((sec) => {
    const links = sec.links
      .map((l) => `<li>${renderLink(l, escapeHtml)}<span class="muted"> — ${escapeHtml(l.note)}</span></li>`)
      .join("");
    return `<section class="professional-section">
      <h2>${escapeHtml(sec.title)}</h2>
      <p class="muted">${escapeHtml(sec.desc)}</p>
      <ul class="professional-links">${links}</ul>
    </section>`;
  }).join("");

  const escalate = [
    "Reflect here if you need words before calling someone.",
    "Peer community if you need to feel less alone.",
    "Your GP or oncology team for medical and screening questions.",
    "Counsellor, BCF, or emergency services when emotions or symptoms feel unsafe.",
  ];

  return `
    <main>
      <div class="card find-human-help-page">
        <h1>Find human help</h1>
        <p class="muted">HearHer links you to professionals and programmes. It does not replace counsellors, doctors, BCF, or emergency services.</p>
        ${renderAiNotCounsellorBanner()}
        ${sections}
        <h2>When to escalate</h2>
        <ol class="support-ladder compact">${escalate
          .map(
            (text, i) =>
              `<li class="support-ladder-step"><span class="support-ladder-num">${i + 1}</span> ${escapeHtml(text)}</li>`
          )
          .join("")}</ol>
        <div class="btn-row">
          <a class="btn btn-primary" href="#/patient/chat">Back to support</a>
          <a class="btn btn-ghost" href="#/patient/screening">Screening questions</a>
          <a class="btn btn-ghost" href="#/patient">Home</a>
        </div>
      </div>
    </main>`;
}

/** @deprecated alias — same page */
export function renderHumanSupportPage(escapeHtml, ctx = {}) {
  return renderFindHumanHelpPage(escapeHtml, ctx);
}

export function renderHumanSupportFootnote(escapeHtml) {
  return `<p class="human-support-foot muted">
    <strong>AI is not your counsellor.</strong>
    <a href="#/patient/find-help">Find human help →</a>
  </p>`;
}

/**
 * Dismissal-aware support — advocacy when told "just stress" or not believed.
 */

export const DISMISSAL_ADVOCACY = [
  {
    id: "script1",
    text: "I was told this might be stress, but my symptoms persist. I would like proper assessment and a clear plan.",
  },
  {
    id: "script2",
    text: "I have been dealing with this for a long time. I need help understanding what else could explain how I feel.",
  },
  {
    id: "script3",
    text: "I do not need perfect medical words — I need you to take my concerns seriously and explain next steps.",
  },
];

export const DISMISSAL_STARTERS = [
  "I was told it is just stress but I do not feel better",
  "I am scared something is wrong and no one believes me",
  "Doctors keep saying it is normal but it affects my daily life",
];

/** Step indices in CHAT_STEPS for dismissal-focused guided flow */
export const DISMISSAL_STEP_IDS = [
  "emotionalIntro",
  "toldJustStress",
  "emotionalBurden",
  "emotionalText",
  "visitGoal",
  "oneThingForDoctor",
  "done",
];

export function getDismissalIntro() {
  return "Many people are told their symptoms are “just stress,” “normal,” or “in your head.” That can be isolating. Let us focus on what you want your clinician to hear.";
}

export function renderDismissalAdvocacyPanel(escapeHtml, onAddQuestion) {
  const scripts = DISMISSAL_ADVOCACY.map(
    (s) =>
      `<button type="button" class="btn btn-ghost dismissal-script" data-script="${escapeHtml(s.text)}">${escapeHtml(s.text)}</button>`
  ).join("");

  return `<div class="dismissal-panel callout callout-info">
    <h3 class="dismissal-panel-title">Advocacy phrases</h3>
    <p class="muted">Tap to save as a visit question — you can edit them on your home screen.</p>
    <div class="dismissal-scripts">${scripts}</div>
  </div>`;
}

/**
 * Between-visit reassurance — general support copy + BCF resources (not diagnosis).
 */

const BCF_CAREGIVER_URL = "https://bcf.org.sg/guidance/caregiving";

const REASSURANCE = {
  anxiety:
    "Anxiety between medical appointments is one of the most common experiences after a breast cancer diagnosis — it does not mean you are overreacting.",
  grief:
    "Grief for your former sense of normalcy is real and valid. Many people carry it quietly between visits.",
  overload:
    "Information overload is normal. You do not need to understand every term before your next appointment.",
  sleep:
    "Sleep disruption during treatment or worry is widely reported — mentioning it to your team is appropriate.",
  sideEffects:
    "Side effects can feel isolating when you are home between visits. Tracking them helps conversations, not self-diagnosis.",
  dismissed:
    "If you have felt rushed or unheard, you are not alone — preparing one clear sentence for your team can help.",
  fear:
    "Fear between scan or results days is common. This app supports reflection — reach human support when fear feels unmanageable.",
  burnout:
    "Caregivers often try to stay strong while struggling quietly. Support exists for you too.",
  shame:
    "Body-image distress after surgery or treatment is widely reported — it is grief, not vanity. Counsellors and peer groups can help.",
  default:
    "Between medical touchpoints, many women and caregivers feel alone — you are not the only one.",
};

/**
 * @param {Record<string, string>} reflectAnswers
 * @param {Record<string, string>} [supportCollected]
 */
export function getCohortReassurance(reflectAnswers = {}, supportCollected = {}) {
  const lines = [];
  const seen = new Set();

  const push = (text) => {
    if (!text || seen.has(text)) return;
    seen.add(text);
    lines.push(text);
  };

  if (reflectAnswers.mood === "high_anxiety" || reflectAnswers.mood === "mixed") push(REASSURANCE.anxiety);
  if (reflectAnswers.mood === "low_mood") push(REASSURANCE.grief);
  if (reflectAnswers.infoOverload === "yes" || reflectAnswers.infoOverload === "sometimes") {
    push(REASSURANCE.overload);
  }
  if (reflectAnswers.sleep === "poor") push(REASSURANCE.sleep);
  if (reflectAnswers.sideEffects === "significant" || reflectAnswers.sideEffects === "some") {
    push(REASSURANCE.sideEffects);
  }

  if (reflectAnswers.bodyImage === "hard" || reflectAnswers.bodyImage === "some") {
    push(REASSURANCE.shame);
  }

  const burden = supportCollected.emotionalBurden;
  if (burden === "fear") push(REASSURANCE.fear);
  if (burden === "shame") push(REASSURANCE.shame);
  if (burden === "burnout") push(REASSURANCE.burnout);
  if (burden === "dismissed" || supportCollected.toldJustStress === "yes") push(REASSURANCE.dismissed);

  if (lines.length === 0) push(REASSURANCE.default);

  lines.push(`Caregiver resource: ${BCF_CAREGIVER_URL}`);

  return lines.slice(0, 4);
}

export function renderCohortReassurancePanel(lines) {
  if (!lines.length) return "";
  const items = lines.map((l) => {
    if (l.startsWith("Caregiver resource:")) {
      const url = l.replace("Caregiver resource: ", "");
      return `<li>Caregiver resource: <a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">BCF caregiving guidance</a></li>`;
    }
    return `<li>${escapeHtml(l)}</li>`;
  }).join("");
  return `<div class="cohort-reassurance callout callout-info">
    <p class="cohort-reassurance-eyebrow"><strong>You are not alone</strong></p>
    <ul class="cohort-reassurance-list">${items}</ul>
    <p class="muted cohort-reassurance-foot">Emotional support only — not medical advice or diagnosis.</p>
  </div>`;
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

import { loadBetweenVisit, setFamilyExplain } from "./betweenVisitStore.js";
import { buildVisitBrief } from "./visitBrief.js";
import { syncBetweenVisitSnapshot } from "./sessionManager.js";

const AUDIENCES = [
  { id: "partner", label: "Partner or spouse", tip: "Focus on how they can support day-to-day and at visits." },
  { id: "parent", label: "Parent or family member", tip: "Plain language, less clinical detail." },
  { id: "friend", label: "Close friend", tip: "Emotional context without oversharing medical jargon." },
  { id: "caregiver", label: "Caregiver", tip: "Practical ways to help between clinic visits." },
  {
    id: "children",
    label: "My children",
    tip: "Age-appropriate words — reassure without frightening young children.",
  },
];

/**
 * @param {string} audienceId
 * @param {string} patientId
 * @param {{ displayName?: string, submissions?: object[] }} opts
 */
export function buildFamilyExplain(audienceId, patientId, opts = {}) {
  const data = loadBetweenVisit(patientId);
  const c = data.supportCollected;
  const name = (opts.displayName || "I").trim().split(/\s+/)[0] || "I";
  const audience = AUDIENCES.find((a) => a.id === audienceId) || AUDIENCES[0];

  const lines = [`For ${audience.label.toLowerCase()} — from ${name}\n`];

  lines.push(
    `${name} is on a breast cancer care journey. This is not medical advice — it is how things feel between medical touchpoints.`
  );

  if (c.emotionalBurden === "dismissed" || c.toldJustStress === "yes") {
    lines.push(
      `${name} has sometimes felt dismissed or told it is “just stress.” What helps: listening without minimizing, and offering to attend a visit together if invited.`
    );
  } else if (c.emotionalBurden === "fear") {
    lines.push(
      `${name} has been worried something serious is wrong. What helps: reassurance that you believe them, and patience while they wait for clinical answers.`
    );
  } else if (c.emotionalBurden === "burnout") {
    lines.push(
      `${name} has been carrying a lot alone. What helps: small practical help (meals, reminders, company) without needing to “fix” everything.`
    );
  } else {
    lines.push(
      `${name} is preparing for their next clinician visit and may need space to rest, talk, or ask for company.`
    );
  }

  if (c.oneThingForDoctor) {
    lines.push(`Something ${name} wants their doctor to understand: “${c.oneThingForDoctor}”`);
  }

  if (audienceId === "caregiver" || audienceId === "partner") {
    lines.push(
      "You do not need to understand every medical term. Showing up, asking what would help today, and respecting privacy are enough."
    );
  }

  if (audienceId === "children") {
    lines.push(
      `${name} is still your parent. Some days may be tired or need quiet time — that is because of treatment, not because of anything you did.`
    );
    lines.push(
      `You do not need to carry adult worries. It is okay to ask questions, play, and keep routines when ${name} feels up to it.`
    );
    if (data.reflectAnswers?.sideEffects === "significant") {
      lines.push(
        "On harder days, extra hugs, simple meals, or a favourite story can help — you are not expected to fix everything."
      );
    }
  }

  if (audienceId !== "children" && data.reflectAnswers?.bodyImage === "hard") {
    lines.push(
      `${name} may feel different about their body after surgery or treatment. What helps: listening without judging appearance, and not offering quick fixes.`
    );
  }

  if (audienceId !== "children" && data.reflectAnswers?.sideEffects === "significant") {
    lines.push("Treatment days may be harder — extra rest, meals, or quiet company can help.");
  }

  lines.push(
    `\nTechnology and apps cannot replace doctors or counsellors. If ${name} seems in crisis, encourage professional or urgent support.`
  );

  return lines.join("\n\n");
}

export function renderFamilyExplainPage(session, escapeHtml) {
  const audienceOptions = AUDIENCES.map(
    (a) =>
      `<option value="${escapeHtml(a.id)}">${escapeHtml(a.label)}</option>`
  ).join("");

  const data = loadBetweenVisit(session.patientId);
  const defaultText = buildFamilyExplain("partner", session.patientId, {
    displayName: session.displayName,
  });

  return `
    <main>
      <div class="card family-explain-page">
        <h1>Explain to someone you trust</h1>
        <p class="muted">Not every question is medical — some are emotional or hard to say out loud. Generate plain-language words you can share with family or a caregiver.</p>
        <label>Who is this for?
          <select id="familyAudience">${audienceOptions}</select>
        </label>
        <p class="muted" id="familyAudienceTip">${escapeHtml(AUDIENCES[0].tip)}</p>
        <textarea class="family-explain-editor" id="familyExplainEditor" rows="14">${escapeHtml(data.familyExplainByAudience.partner || defaultText)}</textarea>
        <div class="btn-row">
          <button type="button" class="btn btn-primary" id="regenFamilyExplain">Regenerate</button>
          <button type="button" class="btn btn-ghost" id="copyFamilyExplain">Copy</button>
          <button type="button" class="btn btn-ghost" id="saveFamilyExplain">Save &amp; share with caregiver</button>
          <a class="btn btn-ghost" href="#/patient/visit-brief">Visit brief</a>
          <a class="btn btn-ghost" href="#/patient">Home</a>
        </div>
        <p id="familyExplainMsg" class="muted"></p>
        <div class="callout callout-info">
          Linked caregivers can read saved summaries when you enable sharing under <a href="#/patient/settings">Privacy</a>.
        </div>
      </div>
    </main>`;
}

export function initFamilyExplainPage(session) {
  const audienceEl = document.getElementById("familyAudience");
  const editor = document.getElementById("familyExplainEditor");
  const tip = document.getElementById("familyAudienceTip");

  const regen = () => {
    const id = audienceEl?.value || "partner";
    const aud = AUDIENCES.find((a) => a.id === id);
    if (tip && aud) tip.textContent = aud.tip;
    if (editor) {
      editor.value = buildFamilyExplain(id, session.patientId, { displayName: session.displayName });
    }
  };

  audienceEl?.addEventListener("change", regen);

  document.getElementById("regenFamilyExplain")?.addEventListener("click", regen);

  document.getElementById("copyFamilyExplain")?.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(editor?.value || "");
      document.getElementById("familyExplainMsg").textContent = "Copied to clipboard.";
    } catch {
      document.getElementById("familyExplainMsg").textContent = "Select and copy manually.";
    }
  });

  document.getElementById("saveFamilyExplain")?.addEventListener("click", () => {
    const id = audienceEl?.value || "partner";
    setFamilyExplain(session.patientId, id, editor?.value || "");
    void syncBetweenVisitSnapshot(session);
    document.getElementById("familyExplainMsg").textContent =
      "Saved. Enable caregiver sharing in Privacy so linked caregivers can read it.";
  });
}

export { AUDIENCES };

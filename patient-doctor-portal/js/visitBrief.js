import { loadBetweenVisit, setVisitBriefText } from "./betweenVisitStore.js";
import { buildPatientSummary } from "./summary.js";

const GOAL_LABELS = {
  answers: "clear answers about next steps",
  heard: "to feel heard and not rushed",
  tests: "clarity on scans, results, or timelines",
  options: "support options explained (counselling, groups)",
};

const BURDEN_LABELS = {
  fear: "fear about results, recurrence, or the future",
  dismissed: "feeling rushed or not fully heard",
  shame: "body image or identity after treatment changes",
  burnout: "exhaustion — as a patient or caregiver",
  fertility: "grief or worry about life plans",
  other: "information overload or mixed feelings",
};

/**
 * @param {string} patientId
 * @param {{ submissions?: object[], displayName?: string }} [opts]
 */
export function buildVisitBrief(patientId, opts = {}) {
  const data = loadBetweenVisit(patientId);
  const { supportCollected: c = {}, reflectAnswers: r = {} } = data;
  const name = (opts.displayName || "I").trim().split(/\s+/)[0] || "I";
  const parts = [];

  parts.push(`Between medical touchpoints — what ${name} wants their care team to know\n`);

  if (c.emotionalBurden && BURDEN_LABELS[c.emotionalBurden]) {
    parts.push(`What feels heaviest right now: ${BURDEN_LABELS[c.emotionalBurden]}.`);
  } else if (r.mood === "high_anxiety" || r.mood === "low_mood") {
    parts.push("Lately, anxiety or low mood between appointments has been on my mind.");
  } else if (r.sideEffects === "significant" || r.sideEffects === "some") {
    parts.push("Side effects or discomfort between visits have been affecting daily life.");
  }

  if (c.emotionalNotes) {
    parts.push(`In my own words: ${c.emotionalNotes}`);
  }

  if (c.oneThingForDoctor) {
    parts.push(`The one thing I need you to understand: ${c.oneThingForDoctor}`);
  } else if (c.visitGoal && GOAL_LABELS[c.visitGoal]) {
    parts.push(`What I hope from the next visit: ${GOAL_LABELS[c.visitGoal]}.`);
  }

  if (c.toldJustStress === "yes" || c.toldJustStress === "sometimes") {
    parts.push(
      "I have been told to stay positive or not worry, but I still need emotional support and clear answers from my team."
    );
  }

  if (c.concernDuration === "years" || c.concernDuration === "long") {
    parts.push("These worries have been with me for a long time without clear answers.");
  }

  const subs = opts.submissions || [];
  if (subs.length > 0) {
    const latest = subs[0];
    const summary = latest.summaryModel || buildPatientSummary(latest.answers || latest);
    const titles = (summary.blocks || [])
      .filter((b) => b.variant === "important" && b.title)
      .slice(0, 3)
      .map((b) => b.title);
    if (titles.length) {
      parts.push(`From my recent check-in, topics to discuss: ${titles.join("; ")}.`);
    }
  }

  const questions = data.visitQuestions.slice(0, 8);
  if (questions.length) {
    parts.push("");
    parts.push("Questions I want to ask:");
    questions.forEach((q, i) => {
      parts.push(`${i + 1}. ${q.text}`);
    });
  }

  parts.push("");
  parts.push(
    "— For visit preparation only. Not medical advice. This companion does not replace my oncologist, counsellor, BCF support services, or emergency care."
  );

  return parts.join("\n\n");
}

export function renderVisitBriefPage(session, escapeHtml, submissions = []) {
  const brief = buildVisitBrief(session.patientId, {
    submissions,
    displayName: session.displayName,
  });
  setVisitBriefText(session.patientId, brief);

  return `
    <main>
      <div class="card visit-brief-page">
        <h1>Visit brief</h1>
        <p class="muted">A first-person summary from your feelings, reflections, and saved questions — ready to read aloud or hand to your clinician.</p>
        <textarea class="visit-brief-editor" id="visitBriefEditor" rows="16">${escapeHtml(brief)}</textarea>
        <div class="btn-row">
          <button type="button" class="btn btn-primary" id="copyVisitBrief">Copy</button>
          <button type="button" class="btn btn-ghost" id="saveVisitBrief">Save edits</button>
          <a class="btn btn-ghost" href="#/patient/family">Explain to family</a>
          <a class="btn btn-ghost" href="#/patient">Home</a>
        </div>
        <p id="visitBriefMsg" class="muted"></p>
      </div>
    </main>`;
}

export function initVisitBriefPage(session) {
  document.getElementById("copyVisitBrief")?.addEventListener("click", async () => {
    const text = document.getElementById("visitBriefEditor")?.value || "";
    try {
      await navigator.clipboard.writeText(text);
      document.getElementById("visitBriefMsg").textContent = "Copied to clipboard.";
    } catch {
      document.getElementById("visitBriefMsg").textContent = "Select the text and copy manually.";
    }
  });

  document.getElementById("saveVisitBrief")?.addEventListener("click", () => {
    const text = document.getElementById("visitBriefEditor")?.value || "";
    setVisitBriefText(session.patientId, text);
    document.getElementById("visitBriefMsg").textContent = "Saved on this device.";
  });
}

/** Caregiver-safe excerpt */
export function buildCaregiverBrief(patientId, patientDisplayName) {
  const data = loadBetweenVisit(patientId);
  const name = patientDisplayName || "They";
  const lines = [`How ${name} is doing between visits (shared summary)\n`];

  if (data.visitBriefText) {
    lines.push(data.visitBriefText.slice(0, 1200));
  } else {
    const c = data.supportCollected;
    if (c.emotionalBurden) {
      lines.push(`${name} has been carrying ${BURDEN_LABELS[c.emotionalBurden] || "a lot emotionally"}.`);
    }
    if (c.oneThingForDoctor) {
      lines.push(`They wish their clinician knew: “${c.oneThingForDoctor}”`);
    }
  }

  const audience = data.familyExplainByAudience.partner || data.familyExplainByAudience.friend;
  if (audience) {
    lines.push("\nFamily-friendly note:\n" + audience);
  }

  lines.push("\n— Shared with consent. Not medical advice.");
  return lines.join("\n\n");
}

/**
 * Shared between-visit insight panels for caregiver & clinician portals.
 */

import { getCohortReassurance } from "./cohortReassurance.js";

export const BURDEN_LABELS = {
  fear: "Fear about results, recurrence, or the future",
  dismissed: "Feeling rushed or not fully heard",
  shame: "Body image or identity after treatment changes",
  burnout: "Exhaustion — as a patient or caregiver",
  fertility: "Grief or worry about life plans",
  other: "Information overload or mixed feelings",
};

export const MOOD_LABELS = {
  high_anxiety: "High anxiety between visits",
  low_mood: "Low mood or grief",
  mixed: "Mixed emotions",
  okay: "Mostly okay lately",
};

export const REFLECT_LABELS = {
  phase: {
    newly_diagnosed: "Recently diagnosed — lots of uncertainty",
    active_treatment: "In active treatment",
    post_treatment: "Post-treatment recovery",
    survivorship: "Survivorship follow-up",
  },
  sleep: { poor: "Sleep has been poor", fair: "Sleep is fair", good: "Sleep has been okay" },
  sideEffects: {
    significant: "Significant side effects between visits",
    some: "Some side effects",
    minimal: "Minimal side effects lately",
  },
  bodyImage: {
    hard: "Body image or identity feels changed since treatment",
    some: "Body image is up and down",
    okay: "Mostly okay with body image lately",
  },
  infoOverload: {
    yes: "Information overload",
    sometimes: "Sometimes overwhelmed by information",
    no: "Managing information okay",
  },
};

export function personLabel(email, displayName) {
  const name = (displayName || "").trim();
  if (name) return name;
  return (email || "").split("@")[0] || "Person";
}

export function formatSnapshotUpdatedAt(iso) {
  if (!iso) return "No shared updates yet";
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "Updated recently";
    return `Last update · ${d.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    })}`;
  } catch {
    return "Updated recently";
  }
}

/**
 * @param {string} personEmail
 * @param {object} data
 * @param {string} [displayName]
 */
export function buildBetweenVisitInsights(personEmail, data, displayName = "") {
  const name = personLabel(personEmail, displayName);
  const c = data.supportCollected || {};
  const r = data.reflectAnswers || {};
  const family = data.familyExplainByAudience || {};

  const emotional = [];
  if (c.emotionalBurden && BURDEN_LABELS[c.emotionalBurden]) {
    emotional.push({ label: "Heaviest feeling", value: BURDEN_LABELS[c.emotionalBurden] });
  }
  if (c.emotionalNotes) {
    emotional.push({ label: "In their words", value: c.emotionalNotes });
  }
  if (c.oneThingForDoctor) {
    emotional.push({ label: "Priority for next visit", value: c.oneThingForDoctor });
  } else if (c.visitGoal === "heard") {
    emotional.push({ label: "Visit hope", value: "To feel heard and not rushed" });
  }
  if (c.toldJustStress === "yes" || c.toldJustStress === "sometimes") {
    emotional.push({
      label: "Dismissal concern",
      value: "Has been told to stay positive or that it is “just stress” but still needs support",
    });
  }

  const wellness = [];
  if (r.phase && REFLECT_LABELS.phase[r.phase]) {
    wellness.push({ label: "Treatment phase", value: REFLECT_LABELS.phase[r.phase] });
  }
  if (r.mood && MOOD_LABELS[r.mood]) {
    wellness.push({ label: "Mood", value: MOOD_LABELS[r.mood] });
  }
  if (r.bodyImage && REFLECT_LABELS.bodyImage[r.bodyImage]) {
    wellness.push({ label: "Body image", value: REFLECT_LABELS.bodyImage[r.bodyImage] });
  }
  if (r.sleep && REFLECT_LABELS.sleep[r.sleep]) {
    wellness.push({ label: "Sleep", value: REFLECT_LABELS.sleep[r.sleep] });
  }
  if (r.sideEffects && REFLECT_LABELS.sideEffects[r.sideEffects]) {
    wellness.push({ label: "Side effects", value: REFLECT_LABELS.sideEffects[r.sideEffects] });
  }
  if (r.infoOverload && REFLECT_LABELS.infoOverload[r.infoOverload]) {
    wellness.push({ label: "Information", value: REFLECT_LABELS.infoOverload[r.infoOverload] });
  }

  const familyNotes = [];
  for (const [audience, text] of Object.entries(family)) {
    if (!text?.trim()) continue;
    const label =
      audience === "children"
        ? "Note for their children"
        : audience === "partner"
          ? "Note for partner"
          : audience === "caregiver"
            ? "Note for caregivers"
            : `Note for ${audience}`;
    familyNotes.push({ label, text: text.trim().slice(0, 800) });
  }

  return {
    name,
    emotional,
    wellness,
    questions: (data.visitQuestions || []).slice(0, 10),
    familyNotes,
    visitBriefText: (data.visitBriefText || "").trim(),
    reassurance: getCohortReassurance(r, c),
    hasContent:
      emotional.length > 0 ||
      wellness.length > 0 ||
      (data.visitQuestions || []).length > 0 ||
      familyNotes.length > 0 ||
      Boolean((data.visitBriefText || "").trim()),
  };
}

/** Limit between-visit data shown to child caregivers. */
export function filterSnapshotForCaregiverAudience(data, relationship) {
  if (!data || relationship !== "child") return data || {};
  const reflect = data.reflectAnswers || {};
  const childReflect = {};
  if (reflect.phase) childReflect.phase = reflect.phase;
  if (reflect.mood) childReflect.mood = reflect.mood;
  const family = data.familyExplainByAudience || {};
  const childFamily = {};
  if (family.children) childFamily.children = family.children;
  return {
    ...data,
    supportCollected: {},
    reflectAnswers: childReflect,
    visitBriefText: "",
    visitQuestions: [],
    familyExplainByAudience: childFamily,
  };
}

export function renderInsightList(items, escapeHtml, emptyMsg) {
  if (!items.length) {
    return `<p class="muted insight-empty">${escapeHtml(
      emptyMsg || "Nothing here yet — they may add more after using Support or Wellness log."
    )}</p>`;
  }
  return `<dl class="insight-list">${items
    .map(
      (item) =>
        `<div class="insight-row"><dt>${escapeHtml(item.label)}</dt><dd>${escapeHtml(item.value)}</dd></div>`
    )
    .join("")}</dl>`;
}

export function renderBetweenVisitInsightGrid(insights, escapeHtml, opts = {}) {
  const { audience = "caregiver", caregiverRelationship = "other" } = opts;
  const childView = audience === "caregiver" && caregiverRelationship === "child";
  const questionsHtml = childView
    ? `<p class="muted insight-empty">Visit questions are not shared with adult children.</p>`
    : insights.questions.length
    ? `<ol class="insight-questions">${insights.questions
        .map((q) => `<li>${escapeHtml(q.text)}</li>`)
        .join("")}</ol>`
    : `<p class="muted insight-empty">No saved visit questions yet.</p>`;

  const familyHtml = insights.familyNotes.length
    ? insights.familyNotes
        .map(
          (n) =>
            `<article class="insight-family-note">
              <h4>${escapeHtml(n.label)}</h4>
              <p>${escapeHtml(n.text)}</p>
            </article>`
        )
        .join("")
    : `<p class="muted insight-empty">No family-friendly notes yet.</p>`;

  const briefHtml = childView
    ? `<p class="muted insight-empty">Clinical visit briefs are not shared with adult children.</p>`
    : insights.visitBriefText
    ? `<pre class="visit-brief-readonly">${escapeHtml(insights.visitBriefText.slice(0, 2000))}</pre>`
    : `<p class="muted insight-empty">No visit brief saved yet.</p>`;

  const emotionalLead = childView
    ? "Age-appropriate reassurance — not full clinical detail."
    : audience === "clinician"
      ? "Emotional and visit-prep context — not a diagnosis."
      : "What they have shared about feelings between visits.";

  return `
    <div class="insight-grid">
      ${
        childView
          ? ""
          : `<section class="insight-card">
        <h3>Emotional snapshot</h3>
        <p class="muted insight-lead">${escapeHtml(emotionalLead)}</p>
        ${renderInsightList(insights.emotional, escapeHtml)}
      </section>`
      }
      <section class="insight-card">
        <h3>${childView ? "How they are doing" : "Wellness between visits"}</h3>
        <p class="muted insight-lead">${escapeHtml(
          childView ? "Treatment phase and mood only — age-appropriate." : "From wellness reflection — qualitative only."
        )}</p>
        ${renderInsightList(insights.wellness, escapeHtml)}
      </section>
      ${
        childView
          ? ""
          : `<section class="insight-card insight-card--wide">
        <h3>Visit brief</h3>
        ${briefHtml}
      </section>
      <section class="insight-card insight-card--wide">
        <h3>Questions for next visit</h3>
        ${questionsHtml}
      </section>`
      }
      <section class="insight-card insight-card--wide">
        <h3>${childView ? "Words they prepared for you" : audience === "caregiver" ? "Words they prepared for someone they trust" : "Family / caregiver notes (if saved)"}</h3>
        ${familyHtml}
      </section>
    </div>`;
}

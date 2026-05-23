/**
 * Patient-facing reflection between oncology touchpoints — qualitative only, non-diagnostic.
 */

import { setReflectSnapshot } from "./betweenVisitStore.js";
import { getCohortReassurance, renderCohortReassurancePanel } from "./cohortReassurance.js";
import { autoCollectVisitQuestions } from "./visitQuestions.js";
import { syncBetweenVisitSnapshot } from "./sessionManager.js";

const STORAGE_KEY = "hearher.patient.reflect.v1";

const THEMES = [
  {
    id: "phase",
    title: "Treatment phase",
    lead: "Transitions between diagnosis, treatment, and follow-up often bring the most uncertainty.",
    suggestions: [
      "Ask what the next few weeks typically look like for someone at your stage.",
      "It is okay to say you do not understand the timeline yet.",
      "Write down who to call after hours if something worries you.",
    ],
    scoreFrom: (a) => {
      if (a.phase === "newly_diagnosed") return 1;
      if (a.phase === "active_treatment") return 0.85;
      if (a.phase === "post_treatment") return 0.7;
      if (a.phase === "survivorship") return 0.5;
      return null;
    },
  },
  {
    id: "mood",
    title: "Mood & anxiety",
    lead: "Anxiety and grief between appointments are common — they are not a sign you are failing.",
    suggestions: [
      "Tell your team if fear is affecting sleep, appetite, or daily life.",
      "Ask about counsellor or support group referrals — BCF and hospital programmes may help.",
      "Try a two-minute breathing exercise from Learn before your next visit.",
    ],
    scoreFrom: (a) => {
      if (a.mood === "high_anxiety") return 1;
      if (a.mood === "low_mood") return 0.95;
      if (a.mood === "mixed") return 0.75;
      if (a.mood === "okay") return 0.2;
      return null;
    },
  },
  {
    id: "sleep",
    title: "Sleep",
    lead: "Poor sleep can amplify anxiety and fatigue during treatment.",
    suggestions: [
      "Mention sleep changes even if they feel secondary to treatment.",
      "Ask whether timing of medicines or anxiety might be contributing.",
      "Rest is part of care — not laziness.",
    ],
    scoreFrom: (a) => {
      if (a.sleep === "poor") return 1;
      if (a.sleep === "fair") return 0.55;
      if (a.sleep === "good") return 0.1;
      return null;
    },
  },
  {
    id: "sideEffects",
    title: "Side effects & energy",
    lead: "Physical discomfort between visits deserves mention — you do not need medical words.",
    suggestions: [
      "Note which days are hardest (treatment days vs rest days).",
      "Ask what is expected versus what needs a same-day call.",
      "Seek urgent care for sudden severe symptoms your team has flagged as emergencies.",
    ],
    scoreFrom: (a) => {
      if (a.sideEffects === "significant") return 1;
      if (a.sideEffects === "some") return 0.6;
      if (a.sideEffects === "minimal") return 0.1;
      return null;
    },
  },
  {
    id: "overload",
    title: "Information overload",
    lead: "Too much information at once is overwhelming for many people after diagnosis.",
    suggestions: [
      "Ask your doctor to prioritise the top three things to focus on.",
      "It is fine not to read every leaflet before the next visit.",
      "Use Visit Questions to save one question at a time.",
    ],
    scoreFrom: (a) => {
      if (a.infoOverload === "yes") return 1;
      if (a.infoOverload === "sometimes") return 0.65;
      if (a.infoOverload === "no") return 0.05;
      return null;
    },
  },
];

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function readForm(form) {
  const g = (name) => form.elements.namedItem(name)?.value ?? "";
  return {
    phase: g("phase"),
    mood: g("mood"),
    sleep: g("sleep"),
    sideEffects: g("sideEffects"),
    infoOverload: g("infoOverload"),
  };
}

export { readForm as readReflectForm };

function countAnswered(answers) {
  return Object.values(answers).filter((v) => v && v !== "prefer").length;
}

/**
 * @param {ReturnType<readForm>} answers
 */
export function computePatientWellbeing(answers) {
  const filled = countAnswered(answers);
  if (filled < 2) {
    return { status: "insufficient", filled, minFields: 2 };
  }

  const scored = THEMES.map((t) => {
    const score = t.scoreFrom(answers);
    return { ...t, score: score ?? 0, answered: score !== null };
  })
    .filter((t) => t.answered)
    .sort((a, b) => b.score - a.score);

  const active = scored.filter((t) => t.score >= 0.45);
  const top = scored[0];
  const second = scored[1];
  const spread = top && second ? top.score - second.score : 1;

  if (active.length === 0 || (top && top.score < 0.35)) {
    return {
      status: "steady",
      filled,
      scored,
      suggestions: [
        "Nothing urgent stands out from this short reflection — still bring anything that worries you.",
        "Check-in can log mood, sleep, and side effects over time.",
        "Calming exercises in Learn may help before your next touchpoint.",
      ],
    };
  }

  if (active.length >= 2 && (spread < 0.2 || active.length >= 3)) {
    return {
      status: "several",
      filled,
      active,
      scored,
      suggestions: pickSuggestions(active, 4),
    };
  }

  return {
    status: "focus",
    filled,
    top,
    active,
    scored,
    suggestions: pickSuggestions([top], 3),
  };
}

function pickSuggestions(themes, max) {
  const out = [];
  const seen = new Set();
  for (const t of themes) {
    for (const s of t.suggestions) {
      if (out.length >= max) return out;
      if (seen.has(s)) continue;
      seen.add(s);
      out.push(s);
    }
  }
  return out;
}

function renderResult(result) {
  if (result.status === "insufficient") {
    return `<div class="patient-reflect-result patient-reflect-result--muted">
      <p>Choose at least <strong>${result.minFields}</strong> topics that feel relevant — there are no right answers.</p>
      <p class="muted">You selected ${result.filled}.</p>
    </div>`;
  }

  let title = "";
  let lead = "";

  if (result.status === "steady") {
    title = "A snapshot between appointments";
    lead = "From what you shared, nothing stands out as urgent here. You can still use the ideas below to prepare for your care team.";
  } else if (result.status === "several") {
    const names = result.active.map((t) => t.title.toLowerCase()).join(", ");
    title = "A few areas worth attention";
    lead = `Your answers touch on ${escapeHtml(names)}. Overlapping feelings are common between medical touchpoints.`;
  } else {
    title = "Something to bring up at your next touchpoint";
    lead = result.top.lead;
  }

  const suggestionItems = result.suggestions.map((s) => `<li>${escapeHtml(s)}</li>`).join("");

  const chips = (result.active || result.scored?.filter((t) => t.score >= 0.45) || [])
    .slice(0, 4)
    .map((t) => `<span class="patient-reflect-chip">${escapeHtml(t.title)}</span>`)
    .join("");

  return `<div class="patient-reflect-result">
    <p class="patient-reflect-result-eyebrow">Between visits</p>
    <h3 class="patient-reflect-result-title">${escapeHtml(title)}</h3>
    <p class="patient-reflect-result-lead">${lead}</p>
    ${chips ? `<div class="patient-reflect-chips" aria-label="Topics you highlighted">${chips}</div>` : ""}
    <div id="patient-reflect-reassurance"></div>
    <h4 class="patient-reflect-suggestions-label">Suggestions</h4>
    <ul class="patient-reflect-suggestions">${suggestionItems}</ul>
    <p class="patient-reflect-disclaimer muted">
      Emotional and educational support only — not medical advice. For urgent physical symptoms, contact your oncology team or emergency services.
      <a href="#/patient/checkin">Check-in</a> can log mood, sleep, and side effects between visits.
    </p>
  </div>`;
}

export function renderPatientWellbeingPanel() {
  return `<section class="home-panel home-panel--reflect" id="patient-reflect-panel">
    <header class="home-panel-head">
      <h2>Reflect between touchpoints</h2>
      <p class="muted">How are you feeling between appointments? Suggestions for your care team — not a diagnosis.</p>
    </header>
    <div class="patient-reflect-layout">
      <form class="patient-reflect-form" id="patient-reflect-form" onsubmit="return false;">
        <label class="patient-reflect-label">Where you are in care
          <select name="phase">
            <option value="">—</option>
            <option value="newly_diagnosed">Newly diagnosed / planning treatment</option>
            <option value="active_treatment">Active treatment</option>
            <option value="post_treatment">Recently finished a treatment phase</option>
            <option value="survivorship">Survivorship / long-term follow-up</option>
            <option value="prefer">Prefer not to say</option>
          </select>
        </label>
        <label class="patient-reflect-label">Mood lately
          <select name="mood">
            <option value="">—</option>
            <option value="high_anxiety">High anxiety or fear</option>
            <option value="low_mood">Low mood or grief</option>
            <option value="mixed">Mixed — up and down</option>
            <option value="okay">Mostly okay</option>
            <option value="prefer">Prefer not to say</option>
          </select>
        </label>
        <label class="patient-reflect-label">Sleep
          <select name="sleep">
            <option value="">—</option>
            <option value="poor">Poor most nights</option>
            <option value="fair">Fair / inconsistent</option>
            <option value="good">Mostly good</option>
            <option value="prefer">Prefer not to say</option>
          </select>
        </label>
        <label class="patient-reflect-label">Side effects or discomfort
          <select name="sideEffects">
            <option value="">—</option>
            <option value="significant">Significant — affects daily life</option>
            <option value="some">Some discomfort</option>
            <option value="minimal">Minimal / none lately</option>
            <option value="prefer">Prefer not to say</option>
          </select>
        </label>
        <label class="patient-reflect-label">Information overload
          <select name="infoOverload">
            <option value="">—</option>
            <option value="yes">Yes — overwhelmed</option>
            <option value="sometimes">Sometimes</option>
            <option value="no">Managing okay</option>
            <option value="prefer">Prefer not to say</option>
          </select>
        </label>
        <button type="button" class="btn btn-primary btn-sm" id="patient-reflect-btn">See suggestions</button>
        <p class="muted patient-reflect-hint">Pick any two or more. This supports reflection — not medical decisions.</p>
      </form>
      <div class="patient-reflect-result-wrap" aria-live="polite">
        <p id="patient-reflect-placeholder" class="patient-reflect-placeholder muted">
          Suggestions appear here after you submit — to help you prepare emotionally for your next touchpoint.
        </p>
        <div id="patient-reflect-result"></div>
      </div>
    </div>
  </section>`;
}

function saveDraft(answers) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(answers));
  } catch {
    /* ignore */
  }
}

function loadDraft() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function applyDraft(form, draft) {
  if (!draft) return;
  for (const [name, value] of Object.entries(draft)) {
    const el = form.elements.namedItem(name);
    if (el && "value" in el && value) el.value = value;
  }
}

export function initPatientWellbeingPanel(patientId) {
  const form = document.getElementById("patient-reflect-form");
  const btn = document.getElementById("patient-reflect-btn");
  const resultEl = document.getElementById("patient-reflect-result");
  const placeholder = document.getElementById("patient-reflect-placeholder");
  if (!form || !btn || !resultEl) return;

  applyDraft(form, loadDraft());

  const run = () => {
    const answers = readForm(form);
    saveDraft(answers);
    const result = computePatientWellbeing(answers);
    resultEl.innerHTML = renderResult(result);
    if (placeholder) placeholder.classList.toggle("hidden", result.status !== "insufficient");

    if (patientId && result.status !== "insufficient") {
      const themeIds = (result.active || result.scored || []).map((t) => t.id).filter(Boolean);
      setReflectSnapshot(patientId, answers, themeIds);
      autoCollectVisitQuestions(patientId, { suggestions: result.suggestions || [] });
      const reassuranceEl = document.getElementById("patient-reflect-reassurance");
      if (reassuranceEl) {
        const lines = getCohortReassurance(answers, {});
        reassuranceEl.innerHTML = renderCohortReassurancePanel(lines);
      }
      syncBetweenVisitSnapshot({ role: "patient", patientId }).catch(() => {});
    }
  };

  btn.addEventListener("click", run);
  form.addEventListener("change", () => {
    const answers = readForm(form);
    if (countAnswered(answers) >= 2) saveDraft(answers);
  });
}

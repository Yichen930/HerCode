/**
 * Patient-facing multi-topic reflection — qualitative only, no lab values.
 * Educational visit-prep; not a diagnosis.
 */

const STORAGE_KEY = "hearher.patient.reflect.v1";

const THEMES = [
  {
    id: "cycles",
    title: "Cycles & timing",
    lead: "Your answers touch on menstrual pattern — something clinicians often explore alongside hormones and ultrasound.",
    suggestions: [
      "Jot down the first day of your last few periods, even if dates are approximate.",
      "Irregular or unpredictable cycles have many possible causes — you do not need to sort it out alone before the visit.",
      "It is fine to ask how your clinician checks ovulation and thyroid function without bringing exact lab numbers today.",
    ],
    scoreFrom: (a) => {
      if (a.cycle === "often") return 1;
      if (a.cycle === "sometimes") return 0.65;
      if (a.cycle === "unsure") return 0.35;
      if (a.cycle === "regular") return 0.15;
      return null;
    },
  },
  {
    id: "androgen",
    title: "Skin & hair",
    lead: "Skin or hair changes you noticed are worth mentioning — they are often discussed alongside cycle and hormone questions.",
    suggestions: [
      "Describe what changed (acne, excess hair, thinning) and when you first noticed it.",
      "You can ask whether hormone blood tests would help — your clinician interprets results, not this app.",
      "These signs overlap several conditions; a timeline helps more than a single symptom.",
    ],
    scoreFrom: (a) => {
      if (a.skin === "yes") return 1;
      if (a.skin === "little") return 0.55;
      if (a.skin === "no") return 0.1;
      return null;
    },
  },
  {
    id: "metabolic",
    title: "Energy, weight & metabolism",
    lead: "Energy or weight concerns often come up in visits about cycles and long-term health — not a personal failing.",
    suggestions: [
      "Mention any recent weight change and how energy or sleep have been, in your own words.",
      "Clinicians may discuss glucose or insulin screening when appropriate — you can ask what is right for you.",
      "Small, sustainable habits matter; your clinician can help prioritize what to try first.",
    ],
    scoreFrom: (a) => {
      if (a.energy === "concern") return 1;
      if (a.energy === "some") return 0.6;
      if (a.energy === "fine") return 0.1;
      return null;
    },
  },
  {
    id: "pain",
    title: "Period pain & pelvic comfort",
    lead: "Pain that affects your daily life deserves attention — especially if it tracks with your cycle or is getting worse.",
    suggestions: [
      "Note whether pain is cyclical, where you feel it, and if bowel or bladder symptoms flare with periods.",
      "Mild cramping is common; pain that stops you from school, work, or sleep is worth saying clearly.",
      "Seek urgent care if you have sudden severe pain, fainting, or bleeding that soaks through pads very quickly.",
    ],
    scoreFrom: (a) => {
      if (a.pain === "moderate") return 1;
      if (a.pain === "mild") return 0.5;
      if (a.pain === "none") return 0.05;
      return null;
    },
  },
  {
    id: "fertility",
    title: "Fertility & future plans",
    lead: "Wanting to conceive (now or later) is a valid reason to bring up cycles and hormones early.",
    suggestions: [
      "Share your timeline openly — there is no wrong time to ask about fertility planning.",
      "Different conditions affect fertility in different ways; your clinician can outline sensible next steps.",
      "You can ask for a referral to reproductive health services when you feel ready.",
    ],
    scoreFrom: (a) => {
      if (a.fertility === "yes") return 1;
      if (a.fertility === "maybe") return 0.5;
      if (a.fertility === "no") return 0;
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
    cycle: g("cycle"),
    skin: g("skin"),
    energy: g("energy"),
    pain: g("pain"),
    fertility: g("fertility"),
  };
}

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
        "Nothing here sounds urgent from this short reflection — still bring any questions that worry you.",
        "A check-in log can add detail over time if symptoms change.",
        "Your clinician can always run appropriate tests; you do not need numbers before the visit.",
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
      <p>Choose at least <strong>${result.minFields}</strong> topics that feel relevant — there are no right answers, and you never need lab numbers here.</p>
      <p class="muted">You selected ${result.filled}.</p>
    </div>`;
  }

  let title = "";
  let lead = "";

  if (result.status === "steady") {
    title = "A snapshot for your next visit";
    lead =
      "From what you shared, nothing stands out as urgent here. You can still use the ideas below to prepare questions for your clinician.";
  } else if (result.status === "several") {
    const names = result.active.map((t) => t.title.toLowerCase()).join(", ");
    title = "A few areas worth discussing together";
    lead = `Your answers touch on ${escapeHtml(names)}. Overlapping symptoms are common — one visit can cover more than one topic.`;
  } else {
    title = "Something to bring up at your next visit";
    lead = result.top.lead;
  }

  const suggestionItems = result.suggestions
    .map((s) => `<li>${escapeHtml(s)}</li>`)
    .join("");

  const chips = (result.active || result.scored?.filter((t) => t.score >= 0.45) || [])
    .slice(0, 4)
    .map(
      (t) =>
        `<span class="patient-reflect-chip">${escapeHtml(t.title)}</span>`
    )
    .join("");

  return `<div class="patient-reflect-result">
    <p class="patient-reflect-result-eyebrow">Visit prep</p>
    <h3 class="patient-reflect-result-title">${escapeHtml(title)}</h3>
    <p class="patient-reflect-result-lead">${lead}</p>
    ${chips ? `<div class="patient-reflect-chips" aria-label="Topics you highlighted">${chips}</div>` : ""}
    <h4 class="patient-reflect-suggestions-label">Suggestions</h4>
    <ul class="patient-reflect-suggestions">${suggestionItems}</ul>
    <p class="patient-reflect-disclaimer muted">
      This is educational only — not a diagnosis. For severe pain, heavy bleeding, or sudden changes, contact urgent care or your clinician.
      <a href="#/patient/checkin">Check-in</a> can store a fuller symptom log to share.
    </p>
  </div>`;
}

export function renderPatientWellbeingPanel() {
  return `<section class="home-panel home-panel--reflect" id="patient-reflect-panel">
    <header class="home-panel-head">
      <h2>Reflect on your pattern</h2>
      <p class="muted">No lab numbers — just how things feel lately. Suggestions for what to discuss with your clinician, not a diagnosis.</p>
    </header>
    <div class="patient-reflect-layout">
      <form class="patient-reflect-form" id="patient-reflect-form" onsubmit="return false;">
        <label class="patient-reflect-label">Cycles lately
          <select name="cycle">
            <option value="">—</option>
            <option value="regular">Mostly regular</option>
            <option value="sometimes">Sometimes irregular</option>
            <option value="often">Often irregular or unpredictable</option>
            <option value="unsure">Not sure</option>
          </select>
        </label>
        <label class="patient-reflect-label">Skin or hair changes
          <select name="skin">
            <option value="">—</option>
            <option value="no">No noticeable changes</option>
            <option value="little">A little (mild acne, etc.)</option>
            <option value="yes">Yes — noticeable</option>
            <option value="prefer">Prefer not to say</option>
          </select>
        </label>
        <label class="patient-reflect-label">Energy or weight
          <select name="energy">
            <option value="">—</option>
            <option value="fine">Mostly fine</option>
            <option value="some">Some difficulty / fluctuation</option>
            <option value="concern">A bigger concern lately</option>
            <option value="prefer">Prefer not to say</option>
          </select>
        </label>
        <label class="patient-reflect-label">Pain with periods
          <select name="pain">
            <option value="">—</option>
            <option value="none">Little or none</option>
            <option value="mild">Mild — manageable</option>
            <option value="moderate">Moderate or worse / affects daily life</option>
            <option value="prefer">Prefer not to say</option>
          </select>
        </label>
        <label class="patient-reflect-label">Thinking about pregnancy
          <select name="fertility">
            <option value="">—</option>
            <option value="no">Not right now</option>
            <option value="maybe">Maybe / planning ahead</option>
            <option value="yes">Yes — trying or hoping to</option>
            <option value="prefer">Prefer not to say</option>
          </select>
        </label>
        <button type="button" class="btn btn-primary btn-sm" id="patient-reflect-btn">See suggestions</button>
        <p class="muted patient-reflect-hint">Pick any two or more. Your clinician interprets tests — you do not need exact results here.</p>
      </form>
      <div class="patient-reflect-result-wrap" aria-live="polite">
        <p id="patient-reflect-placeholder" class="patient-reflect-placeholder muted">
          Suggestions appear here after you submit. Topics are combined the way clinicians often discuss them — this is not a diagnosis from one symptom.
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

export function initPatientWellbeingPanel() {
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
  };

  btn.addEventListener("click", run);
  form.addEventListener("change", () => {
    const answers = readForm(form);
    if (countAnswered(answers) >= 2) saveDraft(answers);
  });
}

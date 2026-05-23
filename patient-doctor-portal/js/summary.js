/**
 * Non-diagnostic educational copy from structured wellness answers (oncology between-visit).
 */

/** @typedef {{ variant: "disclaimer" | "important" | "note" | "footer", title?: string, text: string }} SummaryBlock */

const PHASE_LABELS = {
  newly_diagnosed: "newly diagnosed or waiting to start treatment",
  active_treatment: "active treatment (surgery, chemo, radiation, or hormone therapy)",
  post_treatment: "recently finished a treatment phase",
  survivorship: "survivorship or long-term follow-up",
};

const MOOD_LABELS = {
  high_anxiety: "high anxiety or fear",
  low_mood: "low mood or grief",
  mixed: "mixed emotions",
  okay: "relatively steady mood",
};

/**
 * @param {Record<string, string>} answers
 * @returns {{ blocks: SummaryBlock[], plainText: string }}
 */
export function buildPatientSummary(answers, _priorSubmissions = []) {
  /** @type {SummaryBlock[]} */
  const blocks = [];

  blocks.push({
    variant: "disclaimer",
    title: "Read this first",
    text: "This summary is for emotional and visit preparation only. It is not medical advice, does not interpret test results, and does not replace your oncologist, counsellor, or care team.",
  });

  const phase = answers.treatmentPhase;
  if (phase && PHASE_LABELS[phase]) {
    blocks.push({
      variant: "note",
      title: "Where you are in care",
      text: `You indicated you are in a phase of ${PHASE_LABELS[phase]}. Many people feel uncertainty between appointments during transitions — it is okay to ask your team what to expect next.`,
    });
  }

  const mood = answers.mood;
  if (mood === "high_anxiety" || mood === "mixed") {
    blocks.push({
      variant: "important",
      title: "Emotional wellbeing",
      text: "You reported anxiety, fear, or mixed emotions between visits. These feelings are common after a breast cancer diagnosis and do not mean you are failing. You might tell your team: “I need help understanding what is normal anxiety versus what needs urgent attention.”",
    });
  } else if (mood === "low_mood") {
    blocks.push({
      variant: "important",
      title: "Emotional wellbeing",
      text: "You reported low mood or grief. This can be part of the journey — and it still deserves support. Ask about counsellor referrals, support groups, or BCF programmes if available in your area.",
    });
  }

  const sleep = answers.sleep;
  if (sleep === "poor") {
    blocks.push({
      variant: "note",
      title: "Sleep",
      text: "Poor sleep can worsen anxiety and fatigue during treatment. Mention sleep changes to your team — they may suggest practical adjustments or refer you for supportive care (not something you have to solve alone).",
    });
  }

  const side = answers.sideEffects;
  if (side === "significant") {
    blocks.push({
      variant: "important",
      title: "Side effects or physical discomfort",
      text: "You reported significant side effects or discomfort. Contact your oncology team if symptoms are new, rapidly worsening, or worrying you — do not wait for a routine visit if you are unsure. Seek emergency care for chest pain, difficulty breathing, high fever, or other acute concerns.",
    });
  } else if (side === "some") {
    blocks.push({
      variant: "note",
      title: "Side effects or physical discomfort",
      text: "You noted some side effects or discomfort. Tracking what happens on treatment days versus rest days can help your next conversation — you do not need medical terminology, just honest descriptions.",
    });
  }

  if (answers.informationOverload === "yes" || answers.informationOverload === "sometimes") {
    blocks.push({
      variant: "note",
      title: "Information overload",
      text: "Feeling overwhelmed by information is very common. You can ask your doctor to prioritise the top three things to focus on before your next visit — you do not need to research everything at once.",
    });
  }

  if (answers.notes) {
    blocks.push({
      variant: "note",
      title: "In your words",
      text: answers.notes,
    });
  }

  blocks.push({
    variant: "footer",
    title: "Bottom line",
    text: "Bring this log to help you remember what mattered between appointments. This tool supports reflection and questions — it does not diagnose or recommend treatment changes.",
  });

  const plainText = blocks.map((b) => (b.title ? `${b.title}: ${b.text}` : b.text)).join("\n\n");

  return { blocks, plainText };
}

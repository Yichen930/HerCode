/**
 * Check-in completeness rules — avoid empty submissions cluttering the database.
 */

const SELECT_FIELDS = [
  "cycleRegularity",
  "painLevel",
  "painTiming",
  "skinHair",
  "bowelBladder",
  "weightChange",
  "heavyBleeding",
  "bmiCategory",
  "fertilityConcern",
];

const MIN_NOTES_CHARS = 20;
const MIN_MEANINGFUL_FIELDS = 2;

function trimVal(v) {
  return String(v ?? "").trim();
}

function isMeaningfulAge(raw) {
  const t = trimVal(raw);
  if (!t) return false;
  const n = parseInt(t, 10);
  return Number.isFinite(n) && n >= 8 && n <= 80;
}

function isMeaningfulSelect(raw) {
  const t = trimVal(raw);
  return t.length > 0;
}

function isMeaningfulNotes(raw) {
  return trimVal(raw).length >= MIN_NOTES_CHARS;
}

/**
 * @param {Record<string, string>} answers
 */
export function countMeaningfulCheckinFields(answers) {
  let n = 0;
  if (isMeaningfulAge(answers.age)) n += 1;
  for (const key of SELECT_FIELDS) {
    if (isMeaningfulSelect(answers[key])) n += 1;
  }
  if (isMeaningfulNotes(answers.notes)) n += 1;
  return n;
}

/**
 * @param {Record<string, string>} answers
 * @returns {{ ok: true, answers: Record<string, string> } | { ok: false, message: string }}
 */
export function validateCheckinAnswers(answers) {
  const normalized = {};
  for (const [k, v] of Object.entries(answers || {})) {
    normalized[k] = trimVal(v);
  }

  const meaningful = countMeaningfulCheckinFields(normalized);
  const hasNotes = isMeaningfulNotes(normalized.notes);
  const selectCount = SELECT_FIELDS.filter((k) => isMeaningfulSelect(normalized[k])).length;
  const hasAge = isMeaningfulAge(normalized.age);

  if (hasNotes || meaningful >= MIN_MEANINGFUL_FIELDS) {
    const stored = {};
    if (hasAge) stored.age = normalized.age;
    for (const key of SELECT_FIELDS) {
      if (isMeaningfulSelect(normalized[key])) stored[key] = normalized[key];
    }
    if (hasNotes) stored.notes = normalized.notes;
    return { ok: true, answers: stored };
  }

  let message =
    "This check-in was not saved. Please answer at least 2 questions (choose an option other than “Prefer not to say”), or add a short note (at least 20 characters) for your clinician.";
  if (hasAge && selectCount === 0 && !hasNotes) {
    message =
      "Age alone is not enough to save a check-in. Please answer at least one symptom question or add a short note.";
  }

  return { ok: false, message };
}

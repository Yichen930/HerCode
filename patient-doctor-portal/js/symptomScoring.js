import { PCOS_COHORT, PCOS_VS_ENDO } from "./researchData.js";

/**
 * Count Rotterdam-style educational overlap (not diagnostic criteria).
 * @param {Record<string, string>} answers
 */
export function countPcosPatternFeatures(answers) {
  let n = 0;
  if (answers.cycleRegularity === "irregular") n += 1;
  if (answers.skinHair === "yes") n += 1;
  if (answers.weightChange === "yes") n += 1;
  if (answers.heavyBleeding === "yes") n += 1;
  const bmi = answers.bmiCategory;
  if (bmi === "overweight" || bmi === "obese") n += 1;
  return n;
}

/**
 * Endometriosis-leaning pattern (educational).
 * @param {Record<string, string>} answers
 */
export function countEndoPatternFeatures(answers) {
  let n = 0;
  if (answers.painTiming === "cyclical") n += 1;
  if (answers.bowelBladder === "yes") n += 1;
  if (answers.painLevel === "moderate" || answers.painLevel === "severe") n += 1;
  if (answers.fertilityConcern === "yes") n += 1;
  return n;
}

/**
 * Educational reference score 0–100 from symptom overlap + cohort base rate.
 * Explicitly NOT a personal diagnosis probability.
 */
export function educationalPcosReferencePercent(answers) {
  const features = countPcosPatternFeatures(answers);
  const maxFeatures = 5;
  const overlapRatio = features / maxFeatures;
  const base = PCOS_COHORT.pcosLabeledRate;
  const adjusted = Math.min(0.85, base + overlapRatio * 0.45);
  return Math.round(adjusted * 100);
}

export function educationalEndoReferencePercent(answers) {
  const features = countEndoPatternFeatures(answers);
  const maxFeatures = 4;
  const overlapRatio = features / maxFeatures;
  const base = PCOS_VS_ENDO.endoN / (PCOS_VS_ENDO.endoN + PCOS_VS_ENDO.pcosN);
  const adjusted = Math.min(0.75, base * 0.15 + overlapRatio * 0.35);
  return Math.round(adjusted * 100);
}

/**
 * @param {Record<string, string>} answers
 * @param {Array<{ answers?: Record<string, string> }>} priorSubmissions
 */
export function detectPersistentPcosPattern(answers, priorSubmissions = []) {
  const current = countPcosPatternFeatures(answers);
  if (current < 2) return { persistent: false, checkInCount: 0 };

  const similarPrior = priorSubmissions.filter((s) => {
    const a = s.answers || {};
    return countPcosPatternFeatures(a) >= 2;
  });

  return {
    persistent: similarPrior.length >= 1,
    checkInCount: similarPrior.length + 1,
    currentFeatures: current,
  };
}

/**
 * @param {Record<string, string>} answers
 * @param {Array<{ answers?: Record<string, string> }>} priorSubmissions
 * @returns {import("./summary.js").SummaryBlock[]}
 */
export function buildScoringBlocks(answers, priorSubmissions = []) {
  /** @type {import("./summary.js").SummaryBlock[]} */
  const blocks = [];

  const pcosFeat = countPcosPatternFeatures(answers);
  const endoFeat = countEndoPatternFeatures(answers);
  const pcosRef = educationalPcosReferencePercent(answers);
  const endoRef = educationalEndoReferencePercent(answers);
  const persistence = detectPersistentPcosPattern(answers, priorSubmissions);

  if (pcosFeat >= 1 || endoFeat >= 1) {
    blocks.push({
      variant: "note",
      title: "Symptom pattern (educational reference)",
      text:
        `Your answers overlap ${pcosFeat} of 5 features often discussed in PCOS education (irregular cycles, skin/hair changes, weight change, heavy bleeding, elevated BMI category) ` +
        `and ${endoFeat} of 4 features often discussed for endometriosis (cyclical pain, bowel/bladder symptoms, notable pain, fertility concerns). ` +
        `These patterns are not specific to one disease.`,
    });

    blocks.push({
      variant: "note",
      title: "Cohort reference scores (not your diagnosis)",
      text:
        `Using published-style symptom overlap only (no labs or imaging): ` +
        `PCOS-labeled pattern reference ≈ ${pcosRef}% relative to our research cohort base rate (~${Math.round(PCOS_COHORT.pcosLabeledRate * 100)}% PCOS-labeled in n=${PCOS_COHORT.n}). ` +
        `Endometriosis-pattern reference ≈ ${endoRef}% for symptom overlap only. ` +
        `A logistic model on full clinical datasets in this project reached ~${Math.round(PCOS_COHORT.cvRocAuc * 100)}% ROC-AUC (PCOS) and ~${Math.round(PCOS_VS_ENDO.differentiationAuc * 100)}% ROC-AUC (PCOS vs endometriosis on overlapping fields)—still not a substitute for clinical diagnosis.`,
    });
  }

  if (pcosFeat >= 2 && endoFeat >= 2) {
    blocks.push({
      variant: "important",
      title: "Overlapping conditions",
      text:
        "PCOS and endometriosis frequently co-occur or mimic each other (irregular bleeding, pain, infertility). Clinicians often need history, exam, pelvic ultrasound, and selective labs; laparoscopy may be discussed for endometriosis when appropriate.",
    });
  } else if (pcosFeat >= 2 && endoFeat <= 1) {
    blocks.push({
      variant: "note",
      title: "Conditions to discuss with your clinician",
      text:
        "Your pattern aligns more with features commonly screened for in PCOS workups (ovulation, androgen signs, metabolic risk). Thyroid disease and other causes of irregular cycles should still be considered.",
    });
  } else if (endoFeat >= 2 && pcosFeat <= 1) {
    blocks.push({
      variant: "note",
      title: "Conditions to discuss with your clinician",
      text:
        "Your pattern aligns more with features often discussed in endometriosis evaluation (cyclical pain, bowel/bladder symptoms). PCOS and adenomyosis can still overlap—share a symptom timeline.",
    });
  }

  if (persistence.persistent || (pcosFeat >= 3 && priorSubmissions.length === 0)) {
    blocks.push({
      variant: "important",
      title: "Timely check-up (delayed diagnosis awareness)",
      text:
        persistence.persistent
          ? `You have reported a similar PCOS-related symptom pattern in ${persistence.checkInCount} check-in(s). Many people wait years for PCOS evaluation. Consider booking a gynecology or primary-care visit, bringing this log, and asking about cycle tracking, androgens, glucose/insulin, and pelvic ultrasound if not yet done.`
          : `You reported several features associated with PCOS in community data. If these symptoms are new, worsening, or have persisted many cycles, early evaluation can reduce long-term metabolic and fertility complications—even when periods still occur.`,
    });
  }

  const age = parseInt(String(answers.age || "").trim(), 10);
  if (!Number.isNaN(age) && age >= 18 && age <= 45 && pcosFeat >= 2) {
    blocks.push({
      variant: "note",
      title: "Age context",
      text: `In our comparison dataset, PCOS-labeled participants averaged ~${PCOS_VS_ENDO.pcosMeanAge} years vs ~${PCOS_VS_ENDO.endoMeanAge} for endometriosis-labeled cases—your reported age (${age}) is within the typical reproductive-age window for both discussions.`,
    });
  }

  return blocks;
}

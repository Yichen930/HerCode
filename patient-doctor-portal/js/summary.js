/**
 * Non-diagnostic educational copy from structured answers.
 */

import { buildScoringBlocks } from "./symptomScoring.js";

/** @typedef {{ variant: "disclaimer" | "important" | "note" | "footer", title?: string, text: string }} SummaryBlock */

/**
 * @param {Record<string, string>} answers
 * @param {Array<{ answers?: Record<string, string> }>} [priorSubmissions]
 * @returns {{ blocks: SummaryBlock[], plainText: string }}
 */
export function buildPatientSummary(answers, priorSubmissions = []) {
  /** @type {SummaryBlock[]} */
  const blocks = [];

  blocks.push({
    variant: "disclaimer",
    title: "Read this first",
    text: "This summary is for general education only. It is not a medical diagnosis and does not replace a clinician’s assessment, examination, or tests.",
  });

  const cycle = answers.cycleRegularity;
  if (cycle === "irregular") {
    blocks.push({
      variant: "important",
      title: "Menstrual pattern",
      text: "You reported irregular cycles. Irregular bleeding can reflect anovulation (often discussed in PCOS), thyroid disease, stress, perimenopause, or other causes. Many people normalize irregular bleeding for years—if this is persistent, ask about ovulation, androgens, TSH, and pelvic ultrasound.",
    });
  } else if (cycle === "regular") {
    blocks.push({
      variant: "note",
      title: "Menstrual pattern",
      text: "You reported relatively regular cycles. Regular cycles do not rule out endometriosis, adenomyosis, or mild androgen excess.",
    });
  }

  const pain = answers.painLevel;
  if (pain === "severe" || answers.painTiming === "progressive") {
    blocks.push({
      variant: "important",
      title: "Pelvic pain",
      text: "You indicated severe or progressive pelvic pain. Strong or worsening pain should be evaluated promptly in person (urgent care or emergency services if red-flag symptoms are present).",
    });
  } else if (pain === "mild" || pain === "moderate") {
    const cyclical = answers.painTiming === "cyclical";
    blocks.push({
      variant: "note",
      title: "Pelvic pain",
      text: cyclical
        ? "You reported pelvic pain that worsens around menses. Cyclical pain is a hallmark feature discussed in endometriosis education, but adenomyosis and other causes exist—note location, duration, and bowel/bladder timing for your visit."
        : "You reported pelvic pain. Tracking timing with menses, bowel/bladder symptoms, and daily impact helps distinguish overlapping conditions.",
    });
  }

  if (answers.skinHair === "yes") {
    blocks.push({
      variant: "important",
      title: "Skin / hair (androgen-related signs)",
      text: "You noted skin or hair changes (acne, excess hair, or thinning). In PCOS phenotypes, androgen excess is a core discussion point; labs (testosterone, DHEA-S) and history distinguish PCOS from adrenal or medication causes.",
    });
  }

  if (answers.weightChange === "yes") {
    blocks.push({
      variant: "note",
      title: "Weight change",
      text: "You reported recent weight gain or difficulty losing weight. Insulin resistance and metabolic risk are common discussion topics in PCOS care—not moral failure, and worth screening with glucose/HbA1c when clinically appropriate.",
    });
  }

  if (answers.heavyBleeding === "yes") {
    blocks.push({
      variant: "important",
      title: "Heavy bleeding",
      text: "You reported heavy menstrual bleeding. This can occur in PCOS, fibroids, bleeding disorders, and endometriosis/adenomyosis. Seek urgent care if soaking pads hourly, fainting, or postpartum/heavy bleeding with dizziness.",
    });
  }

  if (answers.bowelBladder === "yes") {
    blocks.push({
      variant: "important",
      title: "Bowel / bladder",
      text: "You reported bowel or bladder symptoms associated with your cycle. Cyclical GI or urinary symptoms are often highlighted in endometriosis education; deep endometriosis may need imaging and specialist referral.",
    });
  }

  if (answers.fertilityConcern === "yes") {
    blocks.push({
      variant: "note",
      title: "Fertility",
      text: "You indicated fertility concerns. PCOS-related anovulation and endometriosis-related inflammation are different mechanisms—early referral to reproductive endocrinology can shorten time-to-diagnosis.",
    });
  }

  blocks.push(...buildScoringBlocks(answers, priorSubmissions));

  blocks.push({
    variant: "footer",
    title: "Bottom line",
    text: "Overlapping symptoms are common. Rotterdam/Amsterdam criteria and imaging are used clinically; this tool only helps you prepare questions. Bring a symptom timeline and ask what conditions are being ruled in or out.",
  });

  const plainText = blocks.map((b) => b.text).join("\n\n");

  return { blocks, plainText };
}

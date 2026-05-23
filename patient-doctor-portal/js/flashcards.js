import { CONDITION_EDUCATION, SYMPTOM_DIFFERENTIATION, PCOS_COHORT } from "./researchData.js";

/**
 * @typedef {{ id: string, deck: string, front: string, back: string, tag?: string }} Flashcard
 */

const QUICK_FACTS = [
  {
    id: "qf-delay",
    deck: "Quick facts",
    tag: "Did you know?",
    front: "Why do many people wait years before a diagnosis?",
    back: `In our research cohort (n=${PCOS_COHORT.n}), symptoms are often dismissed as stress or “normal hormones.” Long delays are common—not a sign that you are overreacting.`,
  },
  {
    id: "qf-labs",
    deck: "Quick facts",
    tag: "Labs",
    front: "Why might a clinician order blood tests for irregular cycles?",
    back: "Thyroid disease, prolactin, and androgen levels can all change bleeding and skin/hair symptoms. Ruling these out helps avoid chasing the wrong explanation.",
  },
  {
    id: "qf-pcos-not-one",
    deck: "Quick facts",
    tag: "PCOS",
    front: "Is PCOS only an “ovary” problem?",
    back: "No. It often involves metabolism (insulin resistance), androgen signs, and cycle regulation—not just cysts on an ultrasound. Treatment targets your main concerns, not a single lab value.",
  },
  {
    id: "qf-pain",
    deck: "Quick facts",
    tag: "Pain",
    front: "When is period pain worth bringing up again?",
    back: "If pain limits work, school, or relationships—or keeps getting worse—it deserves evaluation. Endometriosis and other conditions are frequently underdiagnosed.",
  },
  {
    id: "qf-overlap",
    deck: "Quick facts",
    tag: "Overlap",
    front: "Can someone have both PCOS and endometriosis?",
    back: "Yes. They are different mechanisms and can overlap. Symptoms alone rarely separate them—clinicians use patterns, exams, imaging, and sometimes surgery.",
  },
];

const VISIT_PREP = [
  {
    id: "vp-one-sentence",
    deck: "Visit prep",
    tag: "Before you go",
    front: "You have 15 minutes. What is the one sentence that helps most?",
    back: "Lead with: what worries you most + how long + what you already tried.\n\nExample: “Pelvic pain for two years; ibuprofen only helps a little; I’m scared I’m being dismissed.”",
  },
  {
    id: "vp-symptoms-list",
    deck: "Visit prep",
    tag: "Before you go",
    front: "Should you memorize every symptom?",
    back: "No—pick your top three that affect daily life. Use Check-in to log details beforehand so you can show a clear timeline instead of trying to remember under pressure.",
  },
  {
    id: "vp-dismissed",
    deck: "Visit prep",
    tag: "Advocacy",
    front: "What if you were told it is “just stress”?",
    back: "You can say: “Stress may play a role, but these symptoms persist and affect my life. I would like a structured workup for cycle and pain disorders.” Bring dates and severity, not just feelings.",
  },
  {
    id: "vp-questions",
    deck: "Visit prep",
    tag: "Questions to ask",
    front: "Three questions worth asking at the end of a visit",
    back: "• What are we ruling in or out next?\n• What should I track before follow-up?\n• When should I seek urgent care if things change?",
  },
  {
    id: "vp-records",
    deck: "Visit prep",
    tag: "Records",
    front: "What is worth saving between appointments?",
    back: "Cycle dates, pain severity (0–10), bleeding heaviness, and photos of skin changes if relevant. Patterns over 2–3 months beat a single bad day.",
  },
];

const MYTHS = [
  {
    id: "myth-stress",
    deck: "Myths",
    tag: "Myth vs fact",
    front: "“It is probably just stress.”",
    back: "Stress can affect cycles, but ongoing pain, irregular bleeding, or androgen signs deserve medical evaluation—not dismissal.",
  },
  {
    id: "myth-normal",
    deck: "Myths",
    tag: "Myth vs fact",
    front: "“Painful periods are normal for everyone.”",
    back: "Mild cramping is common. Pain that regularly stops you from normal activities, or that worsens year after year, is worth discussing with a clinician.",
  },
  {
    id: "myth-pcos-only",
    deck: "Myths",
    tag: "Myth vs fact",
    front: "“PCOS only matters if you want pregnancy.”",
    back: "PCOS also relates to metabolic health, skin and hair changes, and long-term cardiovascular risk—not only fertility.",
  },
  {
    id: "myth-weight",
    deck: "Myths",
    tag: "Myth vs fact",
    front: "“Just lose weight and PCOS will disappear.”",
    back: "Weight can influence symptoms, but PCOS is not a willpower problem. Care should address hormones, metabolism, mental health, and your goals—not blame.",
  },
  {
    id: "myth-ultrasound",
    deck: "Myths",
    tag: "Myth vs fact",
    front: "“A clear ultrasound means nothing is wrong.”",
    back: "PCOS and endometriosis are not always visible on routine imaging. Normal scans do not erase your symptoms or the need for follow-up.",
  },
];

/** @returns {Flashcard[]} */
export function buildFlashcardDeck() {
  /** @type {Flashcard[]} */
  const cards = [...QUICK_FACTS, ...VISIT_PREP, ...MYTHS];

  for (const c of CONDITION_EDUCATION) {
    const short = c.name.split("(")[0].trim();
    cards.push({
      id: `${c.id}-what`,
      deck: "Conditions",
      tag: short,
      front: `What should I know about ${short}?`,
      back: c.summary,
    });
    cards.push({
      id: `${c.id}-symptoms`,
      deck: "Conditions",
      tag: "Symptoms",
      front: `Which symptoms might point to ${short}?`,
      back: c.commonSymptoms.map((s) => `• ${s}`).join("\n"),
    });
    cards.push({
      id: `${c.id}-care`,
      deck: "Conditions",
      tag: "When to seek care",
      front: `When is it time to push for more evaluation (${short})?`,
      back: c.whenToSeekCare,
    });
  }

  for (const row of SYMPTOM_DIFFERENTIATION) {
    cards.push({
      id: `diff-${row.topic.replace(/\s+/g, "-").toLowerCase()}`,
      deck: "Compare",
      tag: row.topic,
      front: `${row.topic}: could this be PCOS, endometriosis, or something else?`,
      back: `Often with PCOS: ${row.pcos}\n\nOften with endometriosis: ${row.endo}\n\nAlso consider: ${row.other}`,
    });
  }

  return cards;
}

export const FLASHCARD_DECKS = ["All", "Quick facts", "Visit prep", "Conditions", "Compare", "Myths"];

/**
 * Guided emotional-support conversation (rule-based).
 * Does NOT duplicate structured check-in symptom fields — use check-in for that.
 */

export const CHAT_STEPS = [
  {
    id: "welcome",
    bot: "Hi — this is a private space for stress, feelings, and preparing to talk with a clinician. We will not repeat the symptom questionnaire here; use Check-in in the menu when you are ready to log cycles, pain, and similar details.",
    type: "continue",
  },
  {
    id: "emotionalIntro",
    bot: "First: how this has felt emotionally. Many people live with worry, shame, or burnout for years before getting answers—that is more common than you might think.",
    type: "continue",
  },
  {
    id: "stressLevel",
    bot: "Recently, how much have stress, anxiety, or overwhelm affected your daily life?",
    type: "choice",
    field: "stressLevel",
    options: [
      { value: "high", label: "A lot — hard to cope on most days" },
      { value: "moderate", label: "Moderate — some very difficult weeks" },
      { value: "low", label: "A little, or only sometimes" },
      { value: "unsure", label: "Not sure / prefer not to say" },
    ],
  },
  {
    id: "toldJustStress",
    bot: "Has anyone (a doctor, family, or friend) told you your symptoms are “just stress,” “normal,” or “in your head”?",
    type: "choice",
    field: "toldJustStress",
    options: [
      { value: "yes", label: "Yes, often or recently" },
      { value: "sometimes", label: "Sometimes" },
      { value: "no", label: "No" },
      { value: "unsure", label: "Prefer not to say" },
    ],
  },
  {
    id: "embarrassed",
    bot: "Do you feel embarrassed or uncomfortable bringing this up with a clinician?",
    type: "choice",
    field: "embarrassedDiscussing",
    options: [
      { value: "yes", label: "Yes, quite a bit" },
      { value: "somewhat", label: "Somewhat" },
      { value: "no", label: "Not really" },
    ],
  },
  {
    id: "emotionalBurden",
    bot: "What feels heaviest right now? (choose the closest; you can add detail next)",
    type: "choice",
    field: "emotionalBurden",
    options: [
      { value: "fear", label: "Fear something is seriously wrong" },
      { value: "dismissed", label: "Feeling dismissed or not believed" },
      { value: "shame", label: "Shame about body, weight, hair, or periods" },
      { value: "burnout", label: "Exhaustion from trying to manage it alone" },
      { value: "fertility", label: "Worry about fertility or the future" },
      { value: "other", label: "Something else / mixed" },
    ],
  },
  {
    id: "emotionalText",
    bot: "In your own words: what has been hardest emotionally lately? (optional — e.g. work pressure, family, fear of a diagnosis, feeling alone)",
    type: "text",
    field: "emotionalNotes",
  },
  {
    id: "journeyIntro",
    bot: "Thank you for trusting this space. Next: your care journey and what you want from a visit—not a symptom checklist.",
    type: "continue",
  },
  {
    id: "concernDuration",
    bot: "How long have these health worries been on your mind?",
    type: "choice",
    field: "concernDuration",
    options: [
      { value: "months", label: "A few months" },
      { value: "years", label: "1–3 years" },
      { value: "long", label: "Many years" },
      { value: "recent", label: "Only recently" },
      { value: "unsure", label: "Not sure" },
    ],
  },
  {
    id: "careDelay",
    bot: "Have you put off seeing a clinician about this?",
    type: "choice",
    field: "careDelay",
    options: [
      { value: "yes_shame", label: "Yes — embarrassment or shame" },
      { value: "yes_time", label: "Yes — time, cost, or access" },
      { value: "yes_dismissed", label: "Yes — past bad experiences / not believed" },
      { value: "no", label: "No — I am in care or planning soon" },
      { value: "unsure", label: "Prefer not to say" },
    ],
  },
  {
    id: "supportNetwork",
    bot: "Who do you talk to about this, if anyone?",
    type: "choice",
    field: "supportNetwork",
    options: [
      { value: "partner", label: "Partner or close family" },
      { value: "friends", label: "Friends or peers" },
      { value: "online", label: "Online communities only" },
      { value: "alone", label: "Mostly keep it to myself" },
      { value: "clinician", label: "A clinician already" },
    ],
  },
  {
    id: "visitGoal",
    bot: "If you had a good appointment, what would you most want out of it?",
    type: "choice",
    field: "visitGoal",
    options: [
      { value: "answers", label: "Clear answers or a plan" },
      { value: "heard", label: "To feel heard and believed" },
      { value: "tests", label: "Tests or referrals" },
      { value: "options", label: "Treatment or lifestyle options explained" },
      { value: "unsure", label: "Not sure yet" },
    ],
  },
  {
    id: "oneThingForDoctor",
    bot: "If your clinician could understand just one thing about how this affects you, what would it be? (optional — feelings and impact, not a symptom list)",
    type: "text",
    field: "oneThingForDoctor",
  },
  {
    id: "checkinBridge",
    bot: "When you are ready, open Check-in from the menu or home to log cycles, pain, skin/hair changes, and receive an educational summary with population reference context. This page stays focused on feelings and visit prep.",
    type: "continue",
  },
  {
    id: "done",
    bot: "You are done with the step-by-step flow for now. Switch to Open conversation to keep talking, or start a Check-in when you want a symptom log for your clinician.",
    type: "done",
  },
];

/**
 * @param {number} stepIndex
 * @param {string} [userText]
 * @param {Record<string, string>} collected
 */
export function advanceChat(stepIndex, userText, collected) {
  const step = CHAT_STEPS[stepIndex];
  if (!step) return { nextIndex: stepIndex, collected, done: true };

  if (step.type === "continue") {
    return { nextIndex: stepIndex + 1, collected, done: false };
  }

  if (step.type === "choice" && step.field && userText) {
    const next = { ...collected, [step.field]: userText };
    return { nextIndex: stepIndex + 1, collected: next, done: false };
  }

  if (step.type === "text" && step.field) {
    const next = { ...collected };
    if (userText && userText.trim()) next[step.field] = userText.trim();
    return { nextIndex: stepIndex + 1, collected: next, done: false };
  }

  if (step.type === "done") {
    return { nextIndex: stepIndex, collected, done: true };
  }

  return { nextIndex: stepIndex + 1, collected, done: false };
}

export function chatStepCount() {
  return CHAT_STEPS.length;
}

/** Steps that use a wide free-text area in the UI */
export const OPEN_TEXT_STEP_IDS = new Set(["emotionalText", "oneThingForDoctor"]);

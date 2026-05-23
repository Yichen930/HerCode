/**
 * Guided emotional-support conversation between oncology touchpoints (non-medical).
 */

export const CHAT_STEPS = [
  {
    id: "welcome",
    bot: "Hi — this is a private space for feelings between medical appointments. We will not repeat your wellness log here; use Wellness log in the menu for mood, sleep, and side effects.",
    type: "continue",
  },
  {
    id: "emotionalIntro",
    bot: "First: how this has felt emotionally. After a breast cancer diagnosis, anxiety, fear, and grief between touchpoints are very common — more than many people expect.",
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
    bot: "Has anyone told you to “stay positive,” “not worry,” or that your feelings are an overreaction?",
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
    bot: "Do you feel embarrassed or uncomfortable bringing up emotions with your oncology team?",
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
      { value: "fear", label: "Fear about results, recurrence, or the future" },
      { value: "dismissed", label: "Feeling rushed or not fully heard" },
      { value: "shame", label: "Body image or identity after treatment changes" },
      { value: "burnout", label: "Exhaustion — patient or caregiver" },
      { value: "fertility", label: "Grief or worry about life plans" },
      { value: "other", label: "Information overload / something else" },
    ],
  },
  {
    id: "emotionalText",
    bot: "In your own words: what has been hardest emotionally lately? (optional — e.g. scan anxiety, chemo days, feeling alone)",
    type: "text",
    field: "emotionalNotes",
  },
  {
    id: "journeyIntro",
    bot: "Thank you for trusting this space. Next: what you want from your next touchpoint with your care team.",
    type: "continue",
  },
  {
    id: "concernDuration",
    bot: "How long have these worries been on your mind?",
    type: "choice",
    field: "concernDuration",
    options: [
      { value: "months", label: "A few months" },
      { value: "years", label: "1–3 years" },
      { value: "long", label: "Many years" },
      { value: "recent", label: "Since diagnosis / recently" },
      { value: "unsure", label: "Not sure" },
    ],
  },
  {
    id: "careDelay",
    bot: "Have you delayed asking for emotional or practical support?",
    type: "choice",
    field: "careDelay",
    options: [
      { value: "yes_shame", label: "Yes — embarrassment or stigma" },
      { value: "yes_time", label: "Yes — too busy with treatment logistics" },
      { value: "yes_dismissed", label: "Yes — past experiences of not being heard" },
      { value: "no", label: "No — I am reaching out" },
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
      { value: "clinician", label: "A counsellor or care team member" },
    ],
  },
  {
    id: "visitGoal",
    bot: "If your next appointment went well emotionally, what would you most want?",
    type: "choice",
    field: "visitGoal",
    options: [
      { value: "answers", label: "Clear answers about next steps" },
      { value: "heard", label: "To feel heard and not rushed" },
      { value: "tests", label: "Clarity on scans, results, or timelines" },
      { value: "options", label: "Support options explained (counselling, groups)" },
      { value: "unsure", label: "Not sure yet" },
    ],
  },
  {
    id: "oneThingForDoctor",
    bot: "If your care team could understand just one thing about how this affects you, what would it be? (optional — feelings and impact)",
    type: "text",
    field: "oneThingForDoctor",
  },
  {
    id: "checkinBridge",
    bot: "When you are ready, open Wellness log from the menu to track mood, sleep, and side effects between touchpoints. Try Calm & learn for brief breathing exercises. This page stays focused on feelings and visit prep.",
    type: "continue",
  },
  {
    id: "done",
    bot: "You are done with the step-by-step flow for now. Switch to Open conversation to keep talking, build a Visit brief, or explore calming exercises in Learn.",
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

export const OPEN_TEXT_STEP_IDS = new Set(["emotionalText", "oneThingForDoctor"]);

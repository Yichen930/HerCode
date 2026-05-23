/**
 * Learn flashcards — BCF-aligned between-visit support (non-medical).
 */

const BCF_CAREGIVER_URL = "https://bcf.org.sg/guidance/caregiving";

/**
 * @typedef {{ id: string, deck: string, front: string, back: string, tag?: string }} Flashcard
 */

const CALMING = [
  {
    id: "calm-breath",
    deck: "Calming exercises",
    tag: "2 minutes",
    front: "Box breathing when anxiety spikes",
    back: "Breathe in for 4 counts, hold 4, out 4, hold 4. Repeat 4 times.\n\nThis is not treatment — a brief pause before you call someone, write a note, or rest.",
  },
  {
    id: "calm-ground",
    deck: "Calming exercises",
    tag: "Grounding",
    front: "5-4-3-2-1 grounding",
    back: "Name 5 things you see, 4 you feel, 3 you hear, 2 you smell, 1 you taste.\n\nUseful when information overload or fear feels loud between appointments.",
  },
  {
    id: "calm-hand",
    deck: "Calming exercises",
    tag: "Before a visit",
    front: "One minute before your appointment",
    back: "Place a hand on your chest. Say one true sentence: “I can ask one question at a time.”\n\nYou do not need to be calm — just present enough to be heard.",
  },
];

const VISIT_PREP = [
  {
    id: "vp-one-sentence",
    deck: "Visit prep",
    tag: "Before you go",
    front: "You have limited time with your oncologist. What helps most?",
    back: "Lead with: what worries you most + since when + what you already tried.\n\nExample: “Anxiety between chemo cycles is affecting sleep — I need clarity on what is normal versus urgent.”",
  },
  {
    id: "vp-questions",
    deck: "Visit prep",
    tag: "Questions to ask",
    front: "Three questions worth asking",
    back: "• What should I watch for before the next visit?\n• Who do I contact if I am unsure after hours?\n• What support (counselling, groups) do you recommend?",
  },
  {
    id: "vp-overload",
    deck: "Visit prep",
    tag: "Information overload",
    front: "Too much information — what can I say?",
    back: "“I feel overwhelmed. Can we focus on the top three priorities for this week?”\n\nValid, common, and helps your team meet you where you are.",
  },
  {
    id: "vp-records",
    deck: "Visit prep",
    tag: "Between visits",
    front: "What is worth tracking between appointments?",
    back: "Mood (1–10), sleep, side effects on treatment days, and one sentence of what felt hardest emotionally — patterns help more than a single bad day.",
  },
];

const CAREGIVER = [
  {
    id: "cg-listen",
    deck: "Caregiver support",
    tag: "For caregivers",
    front: "What helps most when you cannot fix it?",
    back: "Listen without minimising (“I believe you”, “That sounds hard”). Offer practical help on treatment days.\n\nBCF caregiving guide: " + BCF_CAREGIVER_URL,
  },
  {
    id: "cg-boundaries",
    deck: "Caregiver support",
    tag: "For caregivers",
    front: "Caregivers struggle quietly too",
    back: "You are allowed to feel exhausted or scared. Taking care of yourself helps you show up — BCF and counsellors support caregivers, not only patients.",
  },
  {
    id: "cg-explain",
    deck: "Caregiver support",
    tag: "Family",
    front: "How do I explain this to children or family?",
    back: "Use plain language, one fact at a time. It is okay to say “I do not have all the answers yet.” Use the app’s Family Explain page to draft words you can share.",
  },
];

const MYTHS = [
  {
    id: "myth-positive",
    deck: "Emotional support",
    tag: "Myth vs fact",
    front: "“I should stay positive all the time.”",
    back: "Fear, grief, and anger are normal after diagnosis. Naming feelings is not negativity — it is part of coping. Counsellors and peer support exist for this.",
  },
  {
    id: "myth-ai",
    deck: "Emotional support",
    tag: "This app",
    front: "Can this app replace my doctor or counsellor?",
    back: "No. This companion helps you reflect, prepare questions, and feel less alone between touchpoints — human care remains essential.",
  },
  {
    id: "myth-alone",
    deck: "Emotional support",
    tag: "You are not alone",
    front: "“No one understands what I am going through.”",
    back: "Many women and caregivers describe the same anxiety between appointments. Peer community and BCF support services exist because this isolation is common — not because you are failing.",
  },
];

/** @returns {Flashcard[]} */
export function buildFlashcardDeck() {
  return [...CALMING, ...VISIT_PREP, ...CAREGIVER, ...MYTHS];
}

export const FLASHCARD_DECKS = ["All", "Calming exercises", "Visit prep", "Caregiver support", "Emotional support"];

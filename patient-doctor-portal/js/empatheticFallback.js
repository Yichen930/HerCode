/**
 * Supportive copy when AI API is unavailable (offline mode or missing OPENAI_API_KEY).
 */

const STEP_REPLIES = {
  emotionalIntro:
    "Taking time to name feelings is a real step. You do not have to minimize stress to deserve care—both emotional strain and physical symptoms can matter together.",
  stressLevel: {
    high:
      "High stress while your body feels “off” is exhausting—and it does not mean your symptoms are fake. You might tell a clinician: “My stress is high, and I am not sure what is causing what anymore.”",
    moderate:
      "Stress and hormonal symptoms often feed each other. Example phrase: “Some weeks I cope, but symptoms and worry pile up together.”",
    low:
      "Even if stress feels manageable, your physical symptoms still deserve attention—they are not invalid.",
    unsure:
      "It is fine not to label it. You can say: “I am not sure how stressed I am, but something feels wrong in my body.”",
  },
  toldJustStress: {
    yes:
      "Being told it is “just stress” hurts—and it stops many people from getting evaluated for years. You might say: “I was told this was stress, but symptoms persist and I want proper assessment.”",
    sometimes:
      "Mixed messages are confusing. It is okay to ask: “What else could explain this besides stress?”",
    no: "I am glad you have not heard that as often. If symptoms persist, you still deserve a thorough look.",
    unsure: "You can simply ask a clinician to take your concerns seriously regardless of stress levels.",
  },
  embarrassed: {
    yes:
      "Many patients feel the same. Clinicians discuss periods, hair, and sex-related health every day. A starter line: “I feel awkward saying this, but…”",
    somewhat:
      "A little nervousness is normal. You can bring notes or this chat log so you do not have to say everything from memory.",
    no: "That confidence helps. You can still use this log to make sure nothing gets forgotten.",
  },
  emotionalBurden: {
    fear: "Fear of the unknown is valid. Clinicians can explain step by step what tests mean and what they rule in or out.",
    dismissed:
      "Feeling unheard is isolating. Tracking how you feel here is a form of advocacy—you might say: “I have been dealing with this for a long time and I need help understanding it.”",
    shame:
      "Shame often comes from culture, not from you. Body changes and pain are medical topics, not personal failures.",
    burnout:
      "Carrying this alone is heavy. It is okay to ask for referral or more than one short visit to cover everything.",
    fertility:
      "Fertility worries can be deeply emotional. You deserve time to ask questions without being rushed.",
    other:
      "Mixed feelings are common. Pick the one or two sentences that feel most true when you see your clinician.",
  },
  emotionalText:
    "Thank you for putting words to it. Whatever you wrote can be read aloud or handed to your clinician—you do not need perfect phrasing.",
  journeyIntro:
    "You have done the emotional part. Next we focus on your care journey—not repeating a symptom checklist (use Check-in for that).",
  concernDuration: {
    months:
      "A few months of worry is long enough to deserve a visit. Example: “This has been on my mind for several months and I want a plan.”",
    years:
      "Living with uncertainty for years is exhausting. You might say: “I have had these concerns for years without clear answers.”",
    long:
      "Many people wait a decade before diagnosis. Saying how long you have carried this helps clinicians take it seriously.",
    recent:
      "New worries still matter. You do not need years of suffering to book an appointment.",
    unsure:
      "You can say: “I am not sure when this started, but it has been affecting me.”",
  },
  careDelay: {
    yes_shame:
      "Shame delays care for many people—you are not alone. A clinician’s job includes making these topics normal to discuss.",
    yes_time:
      "Time and access barriers are real. If you get one visit, bring your top concern first (you can draft it in the next question).",
    yes_dismissed:
      "Past dismissal makes it hard to try again. You might say: “I have been discouraged before, but symptoms are still here.”",
    no: "Good that you are engaged with care. This chat can still help you organize what to say at the next visit.",
    unsure: "It is okay not to label why you waited. You still deserve evaluation when you are ready.",
  },
  supportNetwork: {
    partner: "Having someone in your corner helps. They can attend visits with you if you want support.",
    friends: "Peer support matters. You can also share only what you are comfortable with clinically.",
    online: "Online communities can help you feel less alone—bring questions from them to a clinician for medical facts.",
    alone:
      "Keeping it to yourself is common and heavy. This log can be something you do not have to say out loud at first.",
    clinician:
      "Being in care is a strength. Use check-in summaries to make visits more efficient between appointments.",
  },
  visitGoal: {
    answers: "Asking for a clear plan is reasonable. Example: “What are the next steps and what would you rule out?”",
    heard:
      "Wanting to be heard is valid. You might say: “I need you to understand how much this affects my life.”",
    tests: "It is fine to ask what tests are for and what happens if results are normal.",
    options:
      "Asking about options—not only one treatment—is part of shared decision-making.",
    unsure:
      "You can say: “I am not sure what I need yet, but I want to work through it together.”",
  },
  oneThingForDoctor:
    "That sentence can open the visit. Clinicians often appreciate one clear line about impact before details—use check-in for symptom specifics.",
  checkinBridge:
    "Check-in is the right place for cycles, pain, and similar fields, plus educational reference scores. This chat log is for feelings and how you want to be treated in care.",
  welcome:
    "Welcome. This guided flow is for stress, shame, and visit prep—not a duplicate symptom form. Many people feel awkward talking about periods or body changes; you can skip any question.",
};

/**
 * @param {string} stepId
 * @param {string} [userLabel]
 */
export function getSupportiveFallback(stepId, userLabel) {
  const raw = STEP_REPLIES[stepId];
  if (typeof raw === "string") return raw;
  const map = raw;
  if (map && userLabel && map[userLabel]) return map[userLabel];
  if (stepId === "welcome") return STEP_REPLIES.welcome;
  if (stepId === "oneThingForDoctor") return STEP_REPLIES.oneThingForDoctor;
  return (
    "Thank you for sharing. This space is for feelings and advocacy before a visit—not for logging individual symptoms. " +
    "Use Check-in when you are ready to record cycles, pain, and related details for your clinician."
  );
}

/**
 * @param {string} text
 */
export function getFreeformFallback(text) {
  const t = (text || "").toLowerCase().trim();
  if (/^(hi|hello|hey|hiya|yo)\b[!?.]*$|^good (morning|afternoon|evening)\b/.test(t)) {
    return (
      "Hi — glad you reached out. This is a private space for stress, shame, and preparing for a clinician visit—not for diagnosis. " +
      "What has been on your mind lately? You can also try a starter button above or Check-in when you want a symptom log."
    );
  }
  if (/stress|anxiet|overwhelm|burnout|pressure|depress|panic|cannot cope|can't cope/.test(t)) {
    return (
      "Stress and physical symptoms often overlap—one does not cancel the other. " +
      "You might say: “My stress is high and my body symptoms are affecting daily life—I want both taken seriously.” " +
      "If you ever feel unable to stay safe, please reach out to urgent support in your area."
    );
  }
  if (/embarrass|ashamed|awkward|shy|stupid|gross|weird|afraid to say/.test(t)) {
    return (
      "Feeling embarrassed is very common, especially with periods, hair growth, or sexual health topics. " +
      "Clinicians discuss these every day. You might start with: “I have been hesitant to mention this, but…” " +
      "You are not expected to use perfect medical words."
    );
  }
  if (/accept|denial|not real|in my head|making it up/.test(t)) {
    return (
      "Doubting your own symptoms is something many patients describe—especially after years of being told it is “normal.” " +
      "Tracking patterns in Check-in can help you advocate. A clinician can validate with exams and tests, not guesswork."
    );
  }
  if (/pcos|endometri|endo\b|period|cycle|hair|acne|infertil|pelvic/.test(t)) {
    return (
      "Those sound like topics for your oncology or wellness team — use Wellness log to track mood, sleep, and side effects. In this chat, focus on how the journey affects you emotionally between touchpoints."
    );
  }
  if (/chemo|mastect|radiation|oncolog|breast cancer|tumor|scan|metastas/.test(t)) {
    return (
      "Treatment and scan worries are heavy to carry alone. You might write one sentence you wish your team understood about your emotional impact. Use Visit brief to prepare questions — this chat is not medical advice."
    );
  }
  return (
    "I hear you. This space is for feelings and visit prep, not diagnosis. " +
    "Try writing one sentence you wish your doctor understood about your life impact. " +
    "Use Check-in when you want a symptom summary to bring to an appointment."
  );
}

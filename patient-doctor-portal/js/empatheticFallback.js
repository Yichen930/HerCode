/**
 * Empathetic support copy when AI is unavailable — breast cancer between-visit focus.
 */

const STEP_REPLIES = {
  emotionalIntro:
    "Anxiety, grief, and fear between oncology appointments are very common — more than many people expect. You do not have to be calm to deserve care.",
  stressLevel: {
    high:
      "Carrying this much stress while waiting for answers or going through treatment is exhausting. You might tell your team: “My anxiety is high between visits and it is affecting daily life — I need support, not just reassurance.”",
    moderate:
      "Some weeks are harder than others — that pattern matters. Example: “Stress spikes around scan days and I want help managing the wait.”",
    low:
      "Even when stress feels manageable, your feelings still count. You can still ask for counselling or peer support before things build up.",
    unsure:
      "It is fine not to label it. You could say: “I am not sure how to describe it, but something feels heavy between appointments.”",
  },
  toldJustStress: {
    yes:
      "Being told to stay positive or that it is “just stress” can feel isolating after a cancer diagnosis. You might say: “I still need emotional support and clear answers — my feelings are real even if tests look okay.”",
    sometimes:
      "Mixed messages are confusing when you are already scared. Ask: “What support options exist if fear and grief continue between visits?”",
    no: "I am glad you have not heard that often. Your emotional needs still deserve space in every visit.",
    unsure:
      "You can simply say: “I need my team to take how this affects me emotionally as seriously as the medical plan.”",
  },
  embarrassed: {
    yes:
      "Many people feel awkward discussing emotions, body changes, or intimacy with their oncology team. A starter: “This is hard for me to say, but it has been affecting me…”",
    somewhat:
      "A little nervousness is normal. Bring your Visit brief or read from notes — you do not have to perform being okay.",
    no: "That openness helps. You can still use this space to prepare the one sentence that matters most.",
  },
  emotionalBurden: {
    fear:
      "Fear between scan or results days is one of the most shared experiences on this journey. You might say: “Waiting is the hardest part — I need help coping between touchpoints.”",
    dismissed:
      "Feeling rushed or unheard is painful. Try: “I need more than a few minutes to explain how this affects my life and my family.”",
    shame:
      "Body image distress after surgery or treatment is a real grief — not vanity. Clinicians and counsellors hear this often. You might say: “I am struggling with how I see myself since treatment.”",
    burnout:
      "Exhaustion — as a patient or caregiver — is not failure. Ask about respite, practical help, or caregiver support programmes.",
    fertility:
      "Grief for life plans you hoped for is valid. You deserve time with someone who can sit with that — counsellor, social worker, or trusted peer group.",
    other:
      "Mixed feelings are normal. Pick one true sentence for your next visit — you do not need to explain everything at once.",
  },
  emotionalText:
    "Thank you for putting words to it. What you wrote can go into your Visit brief or be read aloud — imperfect phrasing is still honest.",
  journeyIntro:
    "You have named some of what you carry. Next: what you want from your care team emotionally — not a medical checklist (Wellness log helps track mood and side effects).",
  concernDuration: {
    months:
      "Months of worry between touchpoints is long enough to ask for psychosocial support — not only at crisis points.",
    years:
      "Living with uncertainty for years is exhausting. Saying how long you have carried this helps your team understand.",
    long:
      "Many people describe years of fear before feeling fully heard. Your timeline matters.",
    recent:
      "A recent diagnosis can bring shock and grief that hit in waves — support early can help.",
    unsure:
      "You can say: “I am not sure when this started, but emotionally it has been hard between visits.”",
  },
  careDelay: {
    yes_shame:
      "Shame about body, mood, or “being a burden” delays support for many people — you are not alone. Counsellors specialise in cancer-related distress.",
    yes_time:
      "Treatment logistics leave little room for feelings — if you get one opening, lead with emotional impact first.",
    yes_dismissed:
      "Past dismissal makes it hard to try again. You might say: “I have hesitated to ask for emotional support before, but I need it now.”",
    no: "Reaching out here is already a form of self-support. Visit brief and human help links can strengthen that.",
    unsure:
      "It is okay not to know why you waited. You still deserve counselling, groups, or a longer conversation when you are ready.",
  },
  supportNetwork: {
    partner:
      "A partner can attend visits, hold your hand, or simply listen. Family Explain can help you find words for them.",
    friends:
      "Friends can offer practical help on treatment days. You choose how much medical detail to share.",
    online:
      "Online peers can reduce isolation — bring medical questions back to your oncology team for facts.",
    alone:
      "Keeping it to yourself is common and heavy. This log, Visit brief, or a counsellor can be a first step without performing strength.",
    clinician:
      "If you already see a counsellor or social worker, bring one sentence from here to deepen that conversation.",
  },
  visitGoal: {
    answers:
      "Asking for a clear plan is reasonable. Example: “What should I expect emotionally between this visit and the next?”",
    heard:
      "Wanting to be heard is valid. Try: “I need you to understand how much this affects my daily life and relationships.”",
    tests:
      "Clarity on timelines can reduce scan anxiety. Ask what each wait means and who to call if fear spikes.",
    options:
      "Asking about counselling, support groups, or BCF programmes is part of whole-person care — not extra.",
    unsure:
      "You can say: “I am not sure what I need yet, but I do not want to cope alone between visits.”",
  },
  oneThingForDoctor:
    "That one sentence can open the visit. Oncologists often appreciate hearing emotional impact before logistics — save it in Visit brief.",
  checkinBridge:
    "Wellness log tracks mood, sleep, and side effects between visits. Calm & learn has brief exercises. This Support space stays focused on feelings and words you need.",
  welcome:
    "Welcome. This is a private space for fear, grief, body-image worries, and visit prep between oncology appointments. You can skip any question. I am not your counsellor — human support matters too.",
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
    "Thank you for sharing. Many people feel this way between medical touchpoints — you are not failing. " +
    "Try Visit brief to gather your words, or Find human help for counsellors and BCF programmes."
  );
}

/**
 * @param {string} text
 */
export function getFreeformFallback(text) {
  const t = (text || "").toLowerCase().trim();
  if (/^(hi|hello|hey|hiya|yo)\b[!?.]*$|^good (morning|afternoon|evening)\b/.test(t)) {
    return (
      "Hi — I am glad you reached out. This is a private space for feelings between oncology visits — not diagnosis or treatment advice. " +
      "What has been weighing on you? You can use a starter button, continue the guided flow, or open Find human help for counsellors and BCF."
    );
  }
  if (/suicid|kill myself|want to die|self.?harm|end my life/.test(t)) {
    return (
      "I hear how much pain you are in. Please contact emergency services (995 in Singapore) or a crisis line now — you deserve immediate human support. " +
      "This app cannot keep you safe in a crisis."
    );
  }
  if (/stress|anxiet|overwhelm|burnout|pressure|depress|panic|cannot cope|can't cope|scan|result|wait/.test(t)) {
    return (
      "Scan and results anxiety between appointments is one of the most common experiences after breast cancer — it does not mean you are overreacting. " +
      "You might tell your team: “The wait between tests is affecting my sleep and mood — what support is available?” " +
      "If fear feels unmanageable, Find human help lists counsellors and BCF programmes."
    );
  }
  if (/child|kid|daughter|son|mum|mom|mother|parent/.test(t)) {
    return (
      "Worry about children is so common — and so hard to carry alone. Family Explain has age-appropriate words under “My children.” " +
      "You might say to your team: “I need help talking to my children without frightening them.” Counsellors can help with this too."
    );
  }
  if (/mastect|reconstruct|body image|mirror|scar|breast|appearance|ugly|feminine|identity/.test(t)) {
    return (
      "Grief for how your body looks or feels after surgery is real medical distress — not vanity. Many women describe the same shame. " +
      "You might ask your team about reconstruction options, peer support, or a counsellor who specialises in body image after cancer. " +
      "Find human help links BCF and professional support."
    );
  }
  if (/embarrass|ashamed|awkward|shy|stupid|gross|weird|afraid to say|hard to say/.test(t)) {
    return (
      "Feeling ashamed or awkward is very common — especially about body, mood, or intimacy after treatment. " +
      "Clinicians and counsellors hear this often. Start with: “I have been hesitant to bring this up, but…” " +
      "The Hard to say tab has advocacy phrases you can save as visit questions."
    );
  }
  if (/dismiss|not believe|just stress|stay positive|in my head|making it up|normal/.test(t)) {
    return (
      "Being dismissed or told to stay positive after a cancer diagnosis hurts deeply. " +
      "You might say: “I still need emotional support and clear answers — please do not minimize what I am carrying.” " +
      "Tracking feelings here is a form of self-advocacy."
    );
  }
  if (/alone|lonely|no one understand|isolated/.test(t)) {
    return (
      "Isolation between appointments is widely reported — not a personal failure. Peer community and BCF programmes exist because this journey is hard. " +
      "Consider one small step: message a linked caregiver, open Calm & learn, or ask your team for a support group referral."
    );
  }
  if (/chemo|radiation|oncolog|breast cancer|tumor|treatment|side effect/.test(t)) {
    return (
      "Treatment days and side effects can drain emotional energy as well as physical energy. " +
      "Wellness log helps track patterns; this chat helps you name what is hardest emotionally. " +
      "For medical decisions, your oncology team remains essential."
    );
  }
  return (
    "I hear you. This space is for feelings and visit prep — not medical advice. " +
    "Try writing one sentence you wish someone understood about your emotional life right now, then save it in Visit brief. " +
    "If distress feels heavy, Find human help points to counsellors, BCF, and emergency care."
  );
}

/**
 * Offline community feed (localStorage demo).
 */
const NS = "pdportal_v1:community";

function load(key) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function save(key, arr) {
  localStorage.setItem(key, JSON.stringify(arr));
}

export function listApprovedPosts() {
  return load(`${NS}:posts`).filter((p) => p.status === "approved");
}

export function listMyPosts(authorId) {
  return load(`${NS}:posts`).filter((p) => p.authorId === authorId);
}

/** All posts not published to the public feed (offline demo). */
export function listRejectedPosts() {
  return load(`${NS}:posts`).filter((p) => p.status !== "approved");
}

export function listComments(postId) {
  return load(`${NS}:comments:${postId}`).filter((c) => c.status === "approved");
}

/** @param {object} post */
export function addPostLocal(post) {
  const all = load(`${NS}:posts`);
  all.unshift(post);
  save(`${NS}:posts`, all);
  return post;
}

/** @param {object} comment */
export function addCommentLocal(postId, comment) {
  const key = `${NS}:comments:${postId}`;
  const all = load(key);
  all.push(comment);
  save(key, all);
  return comment;
}

/** Simple offline moderation with patient-facing guidance */
export function moderateLocal(text) {
  const t = (text || "").toLowerCase();
  if (/\byou have pcos\b|\btake \d+ mg\b|@[\w.-]+\.\w+/.test(t)) {
    return {
      approved: false,
      reason: "Please avoid diagnosis claims, dosing advice, or email addresses.",
      flags: ["policy"],
      guidanceType: "warning",
      patientMessage:
        "Your message was not published. Please share your experience or questions without telling others what disease they have, without medication doses, and without email addresses.",
    };
  }
  if (/suicid|kill myself|severe bleeding|want to die|fainting/.test(t)) {
    return {
      approved: false,
      reason: "Possible crisis — requires in-person or emergency care.",
      flags: ["emergency"],
      guidanceType: "emergency",
      patientMessage:
        "If you are in crisis or have emergency symptoms, please contact local emergency services or a clinician immediately. This community cannot provide urgent care, but you deserve support in person.",
    };
  }
  return {
    approved: true,
    reason: "Approved by community safety rules.",
    flags: [],
    guidanceType: "comfort",
    patientMessage:
      "Thank you for sharing. Your post is published. Bring persistent symptoms to a clinician — this space is peer support, not medical advice.",
  };
}

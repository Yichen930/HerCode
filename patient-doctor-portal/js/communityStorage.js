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

export function listApprovedPosts(groupIds = null, groupId = null) {
  let posts = load(`${NS}:posts`).filter((p) => p.status === "approved");
  if (groupId) {
    posts = posts.filter((p) => (p.groupId || p.group_id) === groupId);
  } else if (groupIds && groupIds.length) {
    const set = new Set(groupIds);
    posts = posts.filter((p) => set.has(p.groupId || p.group_id || ""));
  } else if (groupIds && groupIds.length === 0) {
    posts = [];
  }
  return posts;
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

function reactionsKey(targetType, targetId) {
  return `${NS}:reactions:${targetType}:${targetId}`;
}

function loadReactions(targetType, targetId) {
  return load(reactionsKey(targetType, targetId));
}

function saveReactions(targetType, targetId, rows) {
  save(reactionsKey(targetType, targetId), rows);
}

/** @returns {{ reactions: object[], totalReactions: number }} */
export function getReactionSummaryLocal(targetType, targetId, userId) {
  const rows = loadReactions(targetType, targetId);
  const counts = new Map();
  const mine = new Set();
  for (const row of rows) {
    const id = row.emojiId || row.emoji_id;
    if (!id) continue;
    counts.set(id, (counts.get(id) || 0) + 1);
    if (row.userId === userId) mine.add(id);
  }
  const reactions = [...counts.entries()].map(([emojiId, count]) => ({
    emojiId,
    count,
    reactedByMe: mine.has(emojiId),
  }));
  return {
    reactions,
    totalReactions: reactions.reduce((n, r) => n + r.count, 0),
  };
}

/** Toggle one emoji reaction for a user (local demo). */
export function toggleReactionLocal(targetType, targetId, userId, emojiId) {
  const rows = loadReactions(targetType, targetId);
  const idx = rows.findIndex((r) => r.userId === userId && (r.emojiId || r.emoji_id) === emojiId);
  if (idx >= 0) rows.splice(idx, 1);
  else rows.push({ userId, emojiId, createdAt: new Date().toISOString() });
  saveReactions(targetType, targetId, rows);
  return getReactionSummaryLocal(targetType, targetId, userId);
}

/** Attach reaction summaries to posts in offline mode. */
export function attachLocalPostReactions(posts, userId) {
  return posts.map((p) => {
    const summary = getReactionSummaryLocal("post", p.id, userId);
    return { ...p, ...summary };
  });
}

/** Attach reaction summaries to comments in offline mode. */
export function attachLocalCommentReactions(comments, userId) {
  return comments.map((c) => {
    const summary = getReactionSummaryLocal("comment", c.id, userId);
    return { ...c, ...summary };
  });
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

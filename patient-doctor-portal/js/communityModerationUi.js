/** Shared UI helpers for community moderation feedback. */

/** @typedef {"none"|"comfort"|"see_doctor"|"warning"|"emergency"} GuidanceType */

/**
 * Normalize API payload (supports legacy `posts` / `comments` keys).
 * @param {object | null | undefined} raw
 * @param {string[]} [linkedEmails]
 */
export function normalizeModerationPayload(raw, linkedEmails = []) {
  const empty = {
    allPosts: [],
    allComments: [],
    linkedPosts: [],
    linkedComments: [],
    note: "",
  };
  if (!raw || typeof raw !== "object") return empty;

  const legacyPosts = Array.isArray(raw.posts) ? raw.posts : [];
  const legacyComments = Array.isArray(raw.comments) ? raw.comments : [];
  const allPosts = Array.isArray(raw.allPosts) ? raw.allPosts : legacyPosts;
  const allComments = Array.isArray(raw.allComments) ? raw.allComments : legacyComments;

  const linkedSet = new Set((linkedEmails || []).map((e) => String(e).toLowerCase()));
  const matchLinked = (item) => {
    const em = String(item.patientEmail || item.authorEmail || item.authorId || "").toLowerCase();
    return em && linkedSet.has(em);
  };

  const linkedPosts = Array.isArray(raw.linkedPosts)
    ? raw.linkedPosts
    : allPosts.filter(matchLinked);
  const linkedComments = Array.isArray(raw.linkedComments)
    ? raw.linkedComments
    : allComments.filter(matchLinked);

  return {
    allPosts,
    allComments,
    linkedPosts,
    linkedComments,
    note: raw.note || "",
  };
}

/**
 * @param {GuidanceType | string} type
 */
export function guidanceTypeLabel(type) {
  const map = {
    none: "Note",
    comfort: "Support",
    see_doctor: "See a clinician",
    warning: "Safety notice",
    emergency: "Urgent — get help now",
  };
  return map[type] || "Note";
}

/**
 * @param {GuidanceType | string} type
 */
export function guidanceCalloutClass(type) {
  if (type === "emergency") return "callout danger community-guidance-callout";
  if (type === "warning") return "callout danger community-guidance-callout";
  if (type === "see_doctor") return "callout community-guidance-callout community-guidance-callout--doctor";
  if (type === "comfort") return "callout callout-support community-guidance-callout";
  return "callout community-guidance-callout";
}

/**
 * @param {object} item
 * @param {(s: string) => string} escapeHtml
 */
export function renderPatientSubmitBanner(item, escapeHtml) {
  if (!item || item.status === "approved") return "";

  const gt = item.guidanceType || "warning";
  const msg =
    item.patientMessage ||
    item.moderationReason ||
    "Your post was not published. Please read the guidance below.";
  const reason =
    item.moderationReason && item.patientMessage && item.moderationReason !== item.patientMessage
      ? `<p class="community-rejected-reason"><strong>Review note:</strong> ${escapeHtml(item.moderationReason)}</p>`
      : "";

  return (
    `<motion-placeholder></motion-placeholder><div class="community-rejected-banner" role="alert" id="communityLastResult">` +
    `<div class="community-rejected-banner-head">` +
    `<span class="badge badge-status-rejected community-rejected-badge">NOT PUBLISHED</span>` +
    `<span class="community-guidance-type-label">${escapeHtml(guidanceTypeLabel(gt))}</span>` +
    `</div>` +
    `<p class="community-rejected-lead">This message was <strong>not</strong> shared with the community feed.</p>` +
    `<div class="${guidanceCalloutClass(gt)}">` +
    `<p class="community-guidance-text">${escapeHtml(msg)}</p>` +
    `</div>` +
    reason +
    `<p class="muted community-rejected-foot">If you are in immediate danger, call your local emergency number. You can also use <a href="#/patient/checkin">Check-in</a> or talk to a linked clinician.</p>` +
    `</div>`
  ).replace(/<motion-placeholder><\/motion-placeholder>/g, "");
}

/**
 * @param {object} item
 * @param {(s: string) => string} escapeHtml
 */
export function renderGuidanceInline(item, escapeHtml) {
  if (!item || item.status === "approved") return "";
  const gt = item.guidanceType || "warning";
  const msg = item.patientMessage || item.moderationReason || "";
  if (!msg) return "";
  return (
    `<div class="${guidanceCalloutClass(gt)} community-guidance-inline">` +
    `<span class="badge badge-status-rejected">REJECTED</span>` +
    `<span class="community-guidance-type-label">${escapeHtml(guidanceTypeLabel(gt))}</span>` +
    `<p class="community-guidance-text">${escapeHtml(msg)}</p>` +
    `${
      item.moderationReason && item.patientMessage && item.moderationReason !== item.patientMessage
        ? `<p class="muted community-mod-note">${escapeHtml(item.moderationReason)}</p>`
        : ""
    }` +
    `</div>`
  );
}

/**
 * @param {object} item
 * @param {(s: string) => string} escapeHtml
 */
export function renderDoctorModItem(item, kind, escapeHtml) {
  const gt = item.guidanceType || "none";
  const email = item.patientEmail ? `<span class="muted"> · ${escapeHtml(item.patientEmail)}</span>` : "";
  const guidance =
    item.patientMessage || item.moderationReason
      ? `<div class="${guidanceCalloutClass(gt)} mod-item-guidance">
          <span class="community-guidance-type-label">${escapeHtml(guidanceTypeLabel(gt))}</span>
          <p class="community-guidance-text">${escapeHtml(item.patientMessage || item.moderationReason || "")}</p>
          ${
            item.moderationReason && item.patientMessage && item.moderationReason !== item.patientMessage
              ? `<p class="muted community-mod-note">${escapeHtml(item.moderationReason)}</p>`
              : ""
          }
        </div>`
      : "";
  return (
    `<div class="mod-item">` +
    `<span class="badge badge-status-${escapeHtml(item.status)}">${escapeHtml(item.status)}</span>` +
  ` <span class="badge mod-guidance-badge mod-guidance-badge--${escapeHtml(gt)}">${escapeHtml(guidanceTypeLabel(gt))}</span>` +
    `<strong>${escapeHtml(kind)}</strong> · ${escapeHtml(item.authorDisplay)}${email}` +
    ` · <span class="muted">${escapeHtml(item.createdAt)}</span>` +
    `<p class="mod-item-body">${escapeHtml(item.body)}</p>` +
    guidance +
    `</div>`
  );
}

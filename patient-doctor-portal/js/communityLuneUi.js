/**
 * Lune-inspired community UI — night sky, constellation cards, witness flow.
 * Based on https://awake-gills-36030163.figma.site (Witnesses screen)
 */

import { renderGroupBadge, getCommunityGroup } from "./communityGroups.js";
import { renderReactionBar, totalReactionCount } from "./communityReactions.js";
import { renderGuidanceInline } from "./communityModerationUi.js";

export const LUNE_COMMUNITY_COPY = {
  patient: {
    heroLine1: "You do not have to carry",
    heroLine2: "tonight alone.",
    intro:
      "Voices from others on similar journeys — moderated peer support, not medical advice.",
    groupsTitle: "Find your constellation",
    groupsLead: "Join the spaces that match where you are now.",
    composeTitle: "Share your universe",
    composePlaceholder: "There is space here for everything…",
    composeHint: "Submitted for review before others can witness it.",
    feedTitle: "Witnesses",
    feedIntro: "Stories from others walking a similar path.",
    myPostsTitle: "Your submissions",
    witnessLabel: "Witness",
    witnessedLabel: "Witnessed",
    replyPlaceholder: "Send a quiet note of understanding…",
    replySend: "Send quietly",
    joinHint: "Join a constellation first — then you can share and witness others.",
    footNote:
      "If something feels urgent, use Emergency contacts or call 995. Clinicians may see rejected posts in their safety log.",
  },
  caregiver: {
    heroLine1: "You do not have to carry",
    heroLine2: "this alone either.",
    intro:
      "Other caregivers on similar journeys — share support without burning out. Not medical advice.",
    groupsTitle: "Caregiver constellations",
    groupsLead: "Many start with Family & caregivers.",
    composeTitle: "Share with other caregivers",
    composePlaceholder: "What helped you today — or what felt hard…",
    composeHint: "Submitted for review. Do not share your loved one's private details without consent.",
    feedTitle: "Witnesses",
    feedIntro: "Support from others who understand the caregiver path.",
    myPostsTitle: "Your submissions",
    witnessLabel: "Witness",
    witnessedLabel: "Witnessed",
    replyPlaceholder: "Send a quiet note of understanding…",
    replySend: "Send quietly",
    joinHint: "Join a group first — Family & caregivers is a good start.",
    footNote:
      "For urgent concerns about the person you support, call them or use Emergency contacts.",
  },
};

function hashSeed(str) {
  let h = 0;
  for (let i = 0; i < str.length; i += 1) {
    h = (Math.imul(31, h) + str.charCodeAt(i)) >>> 0;
  }
  return h || 1;
}

/** Deterministic star points for constellation SVG from post id. */
export function constellationPoints(seed, count = 4) {
  let h = hashSeed(String(seed));
  const pts = [];
  for (let i = 0; i < count; i += 1) {
    h = (Math.imul(1103515245, h) + 12345) >>> 0;
    pts.push({ x: 14 + (h % 52), y: 12 + ((h >> 8) % 56) });
  }
  return pts;
}

export function renderConstellationSvg(seed, escapeHtml) {
  const pts = constellationPoints(seed, 3 + (hashSeed(seed) % 3));
  const lines = pts
    .slice(0, -1)
    .map(
      (p, i) =>
        `<line x1="${p.x}" y1="${p.y}" x2="${pts[i + 1].x}" y2="${pts[i + 1].y}" stroke="rgba(184, 176, 212, 0.35)" stroke-width="1"/>`
    )
    .join("");
  const dots = pts
    .map(
      (p, i) =>
        `<circle cx="${p.x}" cy="${p.y}" r="2" fill="#E8E6F0" class="lune-star-dot" style="animation-delay:${(i * 0.4).toFixed(1)}s"/>`
    )
    .join("");
  return `<svg viewBox="0 0 80 80" class="lune-constellation" aria-hidden="true" data-seed="${escapeHtml(String(seed))}">${lines}${dots}</svg>`;
}

export function witnessCountForPost(post) {
  return totalReactionCount(post.reactions || []) + (post.commentCount || 0);
}

export function userHasWitnessed(post) {
  return (post.reactions || []).some((r) => r.reactedByMe || r.reacted_by_me);
}

export function renderLuneStarfield() {
  const stars = Array.from({ length: 36 }, (_, i) => {
    const h = hashSeed(`star-${i}`);
    return {
      id: i,
      left: (h % 100).toFixed(1),
      top: ((h >> 8) % 100).toFixed(1),
      size: 1 + (h % 3),
      delay: ((h >> 4) % 50) / 10,
      duration: 2 + (h % 4),
    };
  });
  return `<div class="lune-community-stars" aria-hidden="true">
    ${stars
      .map(
        (s) =>
          `<span class="lune-star" style="left:${s.left}%;top:${s.top}%;width:${s.size}px;height:${s.size}px;animation-delay:${s.delay}s;animation-duration:${s.duration}s"></span>`
      )
      .join("")}
    <div class="lune-glow lune-glow--a"></div>
    <div class="lune-glow lune-glow--b"></div>
  </div>`;
}

export function renderLuneHero(copy, escapeHtml) {
  return `<header class="lune-community-hero">
    <div class="lune-community-moon" aria-hidden="true"></div>
    <p class="lune-community-tagline">
      ${escapeHtml(copy.heroLine1)}<br/>
      ${escapeHtml(copy.heroLine2)}
    </p>
    <p class="lune-community-intro">${escapeHtml(copy.intro)}</p>
  </header>`;
}

export function renderLuneGroupCards(groups, joinedGroupIds, basePath, escapeHtml, feedHrefFn) {
  return `<div class="lune-groups-grid">${groups
    .map((g) => {
      const joined = joinedGroupIds.includes(g.id);
      return `<article class="lune-group-card${joined ? " is-joined" : ""}">
        <h3>${escapeHtml(g.label)}</h3>
        <p class="lune-muted">${escapeHtml(g.desc)}</p>
        <p class="lune-group-meta lune-muted">${joined ? "Joined" : "Not joined"} · ${g.memberCount || 0} in feed</p>
        <div class="lune-group-actions">
          <button type="button" class="lune-pill-btn${joined ? " lune-pill-btn--ghost" : " lune-pill-btn--primary"}" data-join-group="${escapeHtml(g.id)}" data-join-action="${joined ? "leave" : "join"}">
            ${joined ? "Leave" : "Join"}
          </button>
          ${joined ? `<a class="lune-pill-btn lune-pill-btn--ghost" href="${feedHrefFn(basePath, g.id)}">View</a>` : ""}
        </div>
      </article>`;
    })
    .join("")}</div>`;
}

export function renderLuneFeedTabs(joinedGroupIds, feedGroupId, basePath, escapeHtml, feedHrefFn) {
  if (!joinedGroupIds.length) {
    return `<p class="lune-muted lune-feed-hint">${escapeHtml("Join a constellation above to witness others.")}</p>`;
  }
  const tabs = [
    `<a href="${feedHrefFn(basePath, "")}" class="lune-filter-pill${!feedGroupId ? " is-active" : ""}">All</a>`,
    ...joinedGroupIds
      .map((id) => getCommunityGroup(id))
      .filter(Boolean)
      .map(
        (g) =>
          `<a href="${feedHrefFn(basePath, g.id)}" class="lune-filter-pill${feedGroupId === g.id ? " is-active" : ""}">${escapeHtml(g.label)}</a>`
      ),
  ];
  return `<div class="lune-filter-row" role="tablist">${tabs.join("")}</div>`;
}

function renderLuneDiscussionSection(p, copy, escapeHtml) {
  const count = witnessCountForPost(p);
  const witnessed = userHasWitnessed(p);
  const countLabel = count === 1 ? "1 witness" : `${count} witnesses`;
  return `<div class="lune-universe-foot">
    <span class="lune-muted lune-witness-count">${escapeHtml(countLabel)}</span>
    <button type="button" class="lune-pill-btn lune-pill-btn--witness${witnessed ? " is-witnessed" : ""} community-discussion-toggle" data-pid="${escapeHtml(p.id)}" aria-expanded="false">
      <span class="lune-witness-icon" aria-hidden="true">${witnessed ? "✦" : "♡"}</span>
      ${escapeHtml(witnessed ? copy.witnessedLabel : copy.witnessLabel)}
    </button>
  </div>
  <section class="lune-universe-expand" id="lune-expand-${escapeHtml(p.id)}" hidden>
    ${renderReactionBar({
      targetType: "post",
      targetId: p.id,
      reactions: p.reactions || [],
      escapeHtml,
    })}
    <div class="community-comments community-chat-thread lune-chat-thread" id="comments-${escapeHtml(p.id)}"></div>
    <form class="lune-quiet-reply community-comment-form community-chat-compose" data-pid="${escapeHtml(p.id)}" hidden>
      <label class="sr-only" for="communityReply-${escapeHtml(p.id)}">Reply</label>
      <textarea id="communityReply-${escapeHtml(p.id)}" name="body" rows="3" placeholder="${escapeHtml(copy.replyPlaceholder)}" maxlength="500" required></textarea>
      <div class="lune-quiet-reply-actions">
        <button class="lune-pill-btn lune-pill-btn--primary" type="submit">${escapeHtml(copy.replySend)}</button>
      </div>
    </form>
  </section>`;
}

export function renderLuneUniverseCard(p, copy, escapeHtml) {
  const gid = p.groupId || p.group_id || "";
  const group = getCommunityGroup(gid);
  const theme = group?.label || "Community";
  const preview =
    p.body.length > 140 ? `${p.body.slice(0, 137).trim()}…` : p.body;

  return `<article class="lune-universe-card community-post" data-post-id="${escapeHtml(p.id)}">
    <div class="lune-universe-card-inner">
      ${renderConstellationSvg(p.id, escapeHtml)}
      <div class="lune-universe-body">
        <div class="lune-universe-meta">
          ${renderGroupBadge(gid, escapeHtml)}
          <span class="lune-muted">${escapeHtml(p.createdAt)}</span>
        </div>
        <p class="lune-universe-theme">${escapeHtml(theme)}</p>
        <p class="lune-universe-preview">${escapeHtml(preview)}</p>
        <p class="lune-universe-author lune-muted">${escapeHtml(p.authorDisplay)}</p>
      </div>
    </div>
    ${renderLuneDiscussionSection(p, copy, escapeHtml)}
  </article>`;
}

export function renderLuneMyPostCard(p, escapeHtml) {
  const rejected = p.status !== "approved";
  const gid = p.groupId || p.group_id || "";
  return `<article class="lune-universe-card lune-universe-card--mine community-post community-post--mine ${rejected ? "community-post--rejected" : "community-post--published"}">
    <div class="lune-universe-card-inner">
      ${renderConstellationSvg(`${p.id}-mine`, escapeHtml)}
      <div class="lune-universe-body">
        <div class="lune-universe-meta">
          ${renderGroupBadge(gid, escapeHtml)}
          <span class="lune-status-badge badge badge-status-${escapeHtml(p.status)}">${escapeHtml(p.status === "approved" ? "published" : p.status)}</span>
        </div>
        <p class="lune-universe-preview">${escapeHtml(p.body)}</p>
        <span class="lune-muted">${escapeHtml(p.createdAt)}</span>
        ${rejected ? renderGuidanceInline(p, escapeHtml) : `<p class="lune-muted lune-mod-note">Visible in the community feed.</p>`}
      </div>
    </div>
  </article>`;
}

export function renderLuneComposeForm(joinedGroupIds, feedGroupId, copy, escapeHtml) {
  if (!joinedGroupIds.length) {
    return `<p class="lune-muted">${escapeHtml(copy.joinHint)}</p>`;
  }
  const defaultGroup = feedGroupId && joinedGroupIds.includes(feedGroupId) ? feedGroupId : joinedGroupIds[0];
  const options = joinedGroupIds
    .map((id) => {
      const g = getCommunityGroup(id);
      return g
        ? `<option value="${escapeHtml(id)}"${id === defaultGroup ? " selected" : ""}>${escapeHtml(g.label)}</option>`
        : "";
    })
    .join("");
  return `<form id="communityPostForm" class="lune-compose">
    <label class="lune-compose-label">Constellation
      <select id="communityPostGroup" required>${options}</select>
    </label>
    <textarea id="communityPostBody" rows="4" placeholder="${escapeHtml(copy.composePlaceholder)}" maxlength="2000" required></textarea>
    <p class="lune-muted lune-compose-hint">${escapeHtml(copy.composeHint)}</p>
    <button class="lune-pill-btn lune-pill-btn--primary lune-pill-btn--wide" type="submit">Release to review</button>
  </form>`;
}

export function renderLuneApprovedBanner(item, escapeHtml) {
  if (!item || item.status !== "approved") return "";
  const msg =
    item.patientMessage ||
    "Published — thank you for sharing. Others can witness your words.";
  return `<div class="lune-banner lune-banner--ok" role="status" id="communityLastResult">
    <span class="lune-banner-badge">Published</span>
    <p>${escapeHtml(msg)}</p>
  </div>`;
}

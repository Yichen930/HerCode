import {
  listApprovedPosts,
  listMyPosts,
  listComments,
  addPostLocal,
  addCommentLocal,
  moderateLocal,
  attachLocalPostReactions,
  attachLocalCommentReactions,
  toggleReactionLocal,
} from "./communityStorage.js";
import {
  COMMUNITY_GROUPS,
  getCommunityGroup,
  joinLocalGroup,
  leaveLocalGroup,
  listLocalGroupMemberships,
  isValidGroupId,
} from "./communityGroups.js";
import { refreshReactionBarElement } from "./communityReactions.js";
import { apiFetch } from "./backend.js";
import { renderPatientSubmitBanner } from "./communityModerationUi.js";
import { luneHomeHref, renderLuneCommunityBackBar } from "./lune/luneShell.js";
import {
  LUNE_COMMUNITY_COPY,
  renderLuneStarfield,
  renderLuneHero,
  renderLuneGroupCards,
  renderLuneFeedTabs,
  renderLuneUniverseCard,
  renderLuneMyPostCard,
  renderLuneComposeForm,
  renderLuneApprovedBanner,
  witnessCountForPost,
} from "./communityLuneUi.js";

function parseCommunityGroupFromHash(basePath) {
  const hash = location.hash || basePath;
  const q = hash.split("?")[1] || "";
  const group = new URLSearchParams(q).get("group") || "";
  return isValidGroupId(group) ? group : "";
}

function communityFeedHref(basePath, groupId) {
  return groupId ? `${basePath}?group=${encodeURIComponent(groupId)}` : basePath;
}

/**
 * @param {HTMLElement} root
 * @param {object} deps
 */
export function mountCommunityPage(root, deps) {
  const {
    session,
    renderHeader,
    bindLogout,
    escapeHtml,
    isApiMode,
    communityRole = "patient",
    embedded = false,
    luneBasePath = "",
  } = deps;
  const copy = LUNE_COMMUNITY_COPY[communityRole] || LUNE_COMMUNITY_COPY.patient;
  const basePath =
    luneBasePath ||
    (communityRole === "caregiver" ? "#/caregiver/community" : "#/patient/community");
  const memberId =
    communityRole === "caregiver"
      ? session.caregiverId || session.email || session.patientId
      : session.patientId || session.email;
  let posts = [];
  let myPosts = [];
  let groups = COMMUNITY_GROUPS.map((g) => ({ ...g, joined: false, memberCount: 0 }));
  let joinedGroupIds = [];
  let feedGroupId = parseCommunityGroupFromHash(basePath);
  let commentsCache = {};
  /** @type {object | null} */
  let lastSubmitFeedback = null;
  let reactionsBound = false;

  function renderCommentBlock(c) {
    return `<div class="community-comment lune-comment" data-comment-id="${escapeHtml(c.id)}">
      <div class="community-comment-head">
        <strong>${escapeHtml(c.authorDisplay)}</strong>
        <span class="lune-muted">${escapeHtml(c.createdAt)}</span>
      </div>
      <p>${escapeHtml(c.body)}</p>
    </div>`;
  }

  async function handleReactionClick(btn) {
    const targetType = btn.getAttribute("data-react-type");
    const targetId = btn.getAttribute("data-react-id");
    const emojiId = btn.getAttribute("data-emoji-id");
    if (!targetType || !targetId || !emojiId) return;
    btn.disabled = true;
    try {
      let result;
      if (isApiMode()) {
        const path =
          targetType === "post"
            ? `/community/posts/${encodeURIComponent(targetId)}/reactions`
            : `/community/comments/${encodeURIComponent(targetId)}/reactions`;
        result = await apiFetch(path, {
          method: "POST",
          body: JSON.stringify({ emoji_id: emojiId }),
        });
      } else {
        result = toggleReactionLocal(targetType, targetId, memberId, emojiId);
      }
      const container = btn.closest(".community-reactions");
      refreshReactionBarElement(container, result.reactions, escapeHtml);
      if (targetType === "post") {
        const post = posts.find((p) => p.id === targetId);
        if (post) {
          post.reactions = result.reactions;
          post.totalReactions = result.totalReactions;
          updateWitnessCountLabel(targetId, post);
        }
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err));
    } finally {
      btn.disabled = false;
    }
  }

  function updateWitnessCountLabel(postId, post) {
    const card = root.querySelector(`.lune-universe-card[data-post-id="${postId}"]`);
    const label = card?.querySelector(".lune-witness-count");
    if (!label) return;
    const count = witnessCountForPost(post);
    label.textContent = count === 1 ? "1 witness" : `${count} witnesses`;
  }

  function bindReactionDelegation() {
    if (reactionsBound) return;
    reactionsBound = true;
    root.addEventListener("click", (e) => {
      const btn = e.target.closest(".community-emoji-btn");
      if (!btn || !root.contains(btn)) return;
      e.preventDefault();
      void handleReactionClick(btn);
    });
  }

  async function loadGroups() {
    if (isApiMode()) {
      const res = await apiFetch("/community/groups");
      groups = res.groups || groups;
      joinedGroupIds = res.joinedGroupIds || [];
      return;
    }
    joinedGroupIds = listLocalGroupMemberships(memberId);
    groups = COMMUNITY_GROUPS.map((g) => ({
      ...g,
      joined: joinedGroupIds.includes(g.id),
      memberCount: listApprovedPosts(null, g.id).length,
    }));
  }

  async function loadPosts() {
    if (isApiMode()) {
      const path = feedGroupId
        ? `/community/posts?group_id=${encodeURIComponent(feedGroupId)}`
        : "/community/posts";
      posts = await apiFetch(path);
      return;
    }
    if (feedGroupId) {
      posts = listApprovedPosts(null, feedGroupId);
    } else {
      posts = listApprovedPosts(joinedGroupIds);
    }
    posts = attachLocalPostReactions(posts, memberId);
  }

  async function loadMyPosts() {
    if (isApiMode()) {
      myPosts = await apiFetch("/community/posts/mine");
      return;
    }
    myPosts = listMyPosts(memberId);
  }

  async function loadComments(postId) {
    if (isApiMode()) {
      commentsCache[postId] = await apiFetch(`/community/posts/${encodeURIComponent(postId)}/comments`);
      return;
    }
    commentsCache[postId] = listComments(postId);
    commentsCache[postId] = attachLocalCommentReactions(commentsCache[postId], memberId);
  }

  async function toggleJoin(groupId, join) {
    if (isApiMode()) {
      await apiFetch(`/community/groups/${encodeURIComponent(groupId)}/join`, {
        method: join ? "POST" : "DELETE",
      });
      if (!join && feedGroupId === groupId) {
        location.hash = basePath;
      }
    } else if (join) {
      joinedGroupIds = joinLocalGroup(memberId, groupId);
    } else {
      joinedGroupIds = leaveLocalGroup(memberId, groupId);
      if (feedGroupId === groupId) {
        feedGroupId = "";
        location.hash = basePath;
      }
    }
    await loadGroups();
    await render();
  }

  function renderCommentsInto(box, comments) {
    if (!box) return;
    box.innerHTML =
      comments.length === 0
        ? `<p class="lune-muted community-chat-empty">No quiet notes yet — yours can be the first.</p>`
        : comments.map(renderCommentBlock).join("");
  }

  async function setDiscussionOpen(pid, open) {
    const expand = document.getElementById(`lune-expand-${pid}`);
    const box = document.getElementById(`comments-${pid}`);
    const form = root.querySelector(`form.community-comment-form[data-pid="${pid}"]`);
    const toggle = root.querySelector(`.community-discussion-toggle[data-pid="${pid}"]`);
    if (!expand || !toggle) return;
    if (open) {
      await loadComments(pid);
      renderCommentsInto(box, commentsCache[pid] || []);
      expand.hidden = false;
      if (form) form.hidden = false;
      toggle.classList.add("is-open");
      toggle.setAttribute("aria-expanded", "true");
      expand.scrollIntoView({ behavior: "smooth", block: "nearest" });
    } else {
      expand.hidden = true;
      if (form) form.hidden = true;
      toggle.classList.remove("is-open");
      toggle.setAttribute("aria-expanded", "false");
    }
  }

  const homeHref = luneHomeHref(basePath);

  const render = async () => {
    feedGroupId = parseCommunityGroupFromHash(basePath);
    if (!embedded) {
      document.body.classList.add("lune-community-active");
    }
    const feedbackHtml =
      lastSubmitFeedback?.status === "approved"
        ? renderLuneApprovedBanner(lastSubmitFeedback, escapeHtml)
        : renderPatientSubmitBanner(lastSubmitFeedback, escapeHtml);

    root.innerHTML =
      (embedded ? "" : renderHeader(session)) +
      `
      <main class="portal-mobile lune-community${embedded ? " lune-community--embedded" : ""}">
        ${embedded ? "" : renderLuneStarfield()}
        <div class="lune-community-inner">
          ${embedded ? `${renderLuneCommunityBackBar(homeHref, escapeHtml)}<header class="lune-witnesses-head"><h2 class="lune-section-title">${escapeHtml(copy.feedTitle)}</h2><p class="lune-muted">${escapeHtml(copy.feedIntro)}</p></header>` : renderLuneHero(copy, escapeHtml)}
          ${feedbackHtml}

          <section class="lune-section">
            <h2 class="lune-section-title">${escapeHtml(copy.groupsTitle)}</h2>
            <p class="lune-muted">${escapeHtml(copy.groupsLead)}</p>
            <div id="communityGroupsHost"><p class="lune-muted">Loading groups…</p></div>
          </section>

          <section class="lune-section lune-section--compose">
            <h2 class="lune-section-title">${escapeHtml(copy.composeTitle)}</h2>
            ${renderLuneComposeForm(joinedGroupIds, feedGroupId, copy, escapeHtml)}
            <p id="communityPostMsg" class="community-post-msg" aria-live="polite"></p>
          </section>

          <section class="lune-section">
            ${embedded ? "" : `<h2 class="lune-section-title">${escapeHtml(copy.feedTitle)}</h2><p class="lune-muted lune-feed-intro">${escapeHtml(copy.feedIntro)}</p>`}
            ${renderLuneFeedTabs(joinedGroupIds, feedGroupId, basePath, escapeHtml, communityFeedHref)}
            <div id="communityFeed" class="lune-universe-feed community-feed">
              <p class="lune-muted">Loading…</p>
            </div>
          </section>

          <details class="lune-section lune-section--mine">
            <summary class="lune-section-title">${escapeHtml(copy.myPostsTitle)}</summary>
            <p class="lune-muted">Includes posts not published — read guidance on each rejected entry.</p>
            <div id="communityMyPosts" class="lune-universe-feed community-feed community-feed--mine">
              <p class="lune-muted">Loading…</p>
            </div>
          </details>

          <p class="lune-muted lune-foot-note">${escapeHtml(copy.footNote)}</p>
        </div>
      </main>`;

    if (!embedded) {
      bindLogout();
    }

    try {
      await loadGroups();
      document.getElementById("communityGroupsHost").innerHTML = renderLuneGroupCards(
        groups,
        joinedGroupIds,
        basePath,
        escapeHtml,
        communityFeedHref
      );
      await Promise.all([loadPosts(), loadMyPosts()]);

      const feed = document.getElementById("communityFeed");
      if (!joinedGroupIds.length) {
        feed.innerHTML = `<p class="lune-muted">Join a constellation to witness others on a similar journey.</p>`;
      } else if (posts.length === 0) {
        const label = feedGroupId ? getCommunityGroup(feedGroupId)?.label || "this group" : "your groups";
        feed.innerHTML = `<p class="lune-muted">No published stories in ${escapeHtml(label)} yet. Yours can be the first after review.</p>`;
      } else {
        feed.innerHTML = posts.map((p) => renderLuneUniverseCard(p, copy, escapeHtml)).join("");
        for (const p of posts) {
          if ((p.commentCount || 0) > 0) {
            await setDiscussionOpen(p.id, true);
          }
        }
      }

      const mine = document.getElementById("communityMyPosts");
      mine.innerHTML =
        myPosts.length === 0
          ? `<p class="lune-muted">You have not submitted any posts yet.</p>`
          : myPosts.map((p) => renderLuneMyPostCard(p, escapeHtml)).join("");
    } catch (e) {
      const err = escapeHtml(e instanceof Error ? e.message : String(e));
      document.getElementById("communityGroupsHost").innerHTML = `<p class="lune-muted">${err}</p>`;
      document.getElementById("communityFeed").innerHTML = `<p class="lune-muted">${err}</p>`;
      document.getElementById("communityMyPosts").innerHTML = `<p class="lune-muted">${err}</p>`;
    }

    if (lastSubmitFeedback) {
      document.getElementById("communityLastResult")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }

    bindInteractions();
    bindReactionDelegation();
  };

  function bindInteractions() {
    root.querySelectorAll("[data-join-group]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const groupId = btn.getAttribute("data-join-group");
        const action = btn.getAttribute("data-join-action");
        if (!groupId) return;
        btn.disabled = true;
        try {
          await toggleJoin(groupId, action === "join");
        } catch (err) {
          alert(err instanceof Error ? err.message : String(err));
          btn.disabled = false;
        }
      });
    });

    document.getElementById("communityPostForm")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const msg = document.getElementById("communityPostMsg");
      const body = document.getElementById("communityPostBody").value.trim();
      const groupId = document.getElementById("communityPostGroup")?.value || joinedGroupIds[0];
      msg.textContent = "Reviewing your post for safety…";
      msg.className = "community-post-msg lune-muted";
      try {
        let result;
        if (isApiMode()) {
          result = await apiFetch("/community/posts", {
            method: "POST",
            body: JSON.stringify({ body, group_id: groupId }),
          });
        } else {
          if (!joinedGroupIds.includes(groupId)) {
            throw new Error("Join this group before posting.");
          }
          const mod = moderateLocal(body);
          result = addPostLocal({
            id: crypto.randomUUID(),
            authorId: memberId,
            authorDisplay: session.displayName,
            body,
            groupId,
            status: mod.approved ? "approved" : "rejected",
            moderationReason: mod.reason,
            guidanceType: mod.guidanceType,
            patientMessage: mod.patientMessage,
            createdAt: new Date().toISOString(),
          });
        }
        document.getElementById("communityPostBody").value = "";
        lastSubmitFeedback = result;
        await render();
      } catch (err) {
        lastSubmitFeedback = null;
        msg.className = "community-post-msg lune-banner lune-banner--danger";
        msg.textContent = err instanceof Error ? err.message : String(err);
      }
    });

    root.querySelectorAll(".community-discussion-toggle").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const pid = btn.getAttribute("data-pid");
        if (!pid) return;
        const expand = document.getElementById(`lune-expand-${pid}`);
        const isOpen = expand && !expand.hidden;
        await setDiscussionOpen(pid, !isOpen);
      });
    });

    root.querySelectorAll(".community-comment-form").forEach((form) => {
      form.addEventListener("submit", async (e) => {
        e.preventDefault();
        const pid = form.getAttribute("data-pid");
        const input = form.querySelector('textarea[name="body"], input[name="body"]');
        const text = (input?.value || "").trim();
        if (!text) return;
        try {
          if (isApiMode()) {
            const res = await apiFetch(`/community/posts/${encodeURIComponent(pid)}/comments`, {
              method: "POST",
              body: JSON.stringify({ body: text }),
            });
            if (res.status !== "approved") {
              lastSubmitFeedback = res;
              await render();
              return;
            }
          } else {
            const mod = moderateLocal(text);
            const comment = {
              id: crypto.randomUUID(),
              postId: pid,
              authorDisplay: session.displayName,
              body: text,
              status: mod.approved ? "approved" : "rejected",
              moderationReason: mod.reason,
              guidanceType: mod.guidanceType,
              patientMessage: mod.patientMessage,
              createdAt: new Date().toISOString(),
            };
            addCommentLocal(pid, comment);
            if (!mod.approved) {
              lastSubmitFeedback = comment;
              await render();
              return;
            }
          }
          input.value = "";
          await loadComments(pid);
          const box = document.getElementById(`comments-${pid}`);
          renderCommentsInto(box, commentsCache[pid] || []);
          const post = posts.find((p) => p.id === pid);
          if (post) post.commentCount = (post.commentCount || 0) + 1;
          updateWitnessCountLabel(pid, post);
        } catch (err) {
          alert(err instanceof Error ? err.message : String(err));
        }
      });
    });
  }

  window.addEventListener("hashchange", () => {
    const next = parseCommunityGroupFromHash(basePath);
    if (next !== feedGroupId) void render();
  });

  render();
}

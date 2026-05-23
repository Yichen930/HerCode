import {
  listApprovedPosts,
  listMyPosts,
  listComments,
  addPostLocal,
  addCommentLocal,
  moderateLocal,
} from "./communityStorage.js";
import { apiFetch } from "./backend.js";
import {
  renderPatientSubmitBanner,
  renderGuidanceInline,
} from "./communityModerationUi.js";

/**
 * @param {HTMLElement} root
 * @param {object} deps
 */
export function mountCommunityPage(root, deps) {
  const { session, renderHeader, bindLogout, escapeHtml, isApiMode } = deps;
  let posts = [];
  let myPosts = [];
  let expandedPostId = null;
  let commentsCache = {};
  /** @type {object | null} */
  let lastSubmitFeedback = null;

  async function loadPosts() {
    if (isApiMode()) {
      posts = await apiFetch("/community/posts");
      return;
    }
    posts = listApprovedPosts();
  }

  async function loadMyPosts() {
    if (isApiMode()) {
      myPosts = await apiFetch("/community/posts/mine");
      return;
    }
    myPosts = listMyPosts(session.patientId);
  }

  async function loadComments(postId) {
    if (isApiMode()) {
      commentsCache[postId] = await apiFetch(`/community/posts/${encodeURIComponent(postId)}/comments`);
      return;
    }
    commentsCache[postId] = listComments(postId);
  }

  function renderApprovedPostCard(p) {
    return `
      <article class="community-post" data-post-id="${escapeHtml(p.id)}">
        <div class="community-post-head">
          <strong>${escapeHtml(p.authorDisplay)}</strong>
          <span class="muted">${escapeHtml(p.createdAt)}</span>
        </div>
        <p class="community-post-body">${escapeHtml(p.body)}</p>
        <button type="button" class="btn btn-ghost btn-sm community-toggle-comments" data-pid="${escapeHtml(p.id)}">
          Comments (${p.commentCount || 0})
        </button>
        <div class="community-comments" id="comments-${escapeHtml(p.id)}" style="display:none;"></div>
        <form class="community-comment-form" data-pid="${escapeHtml(p.id)}" style="display:none;">
          <input type="text" name="body" placeholder="Write a supportive comment…" maxlength="500" required />
          <button class="btn btn-primary" type="submit">Comment</button>
        </form>
      </article>`;
  }

  function renderMyPostCard(p) {
    const rejected = p.status !== "approved";
    return `
      <article class="community-post community-post--mine ${rejected ? "community-post--rejected" : "community-post--published"}">
        <div class="community-post-head">
          <span class="badge badge-status-${escapeHtml(p.status)}">${escapeHtml(p.status === "approved" ? "published" : p.status)}</span>
          <span class="muted">${escapeHtml(p.createdAt)}</span>
        </div>
        <p class="community-post-body">${escapeHtml(p.body)}</p>
        ${rejected ? renderGuidanceInline(p, escapeHtml) : `<p class="muted community-mod-note">Visible in the community feed.</p>`}
      </article>`;
  }

  function renderApprovedBanner(item) {
    if (!item || item.status !== "approved") return "";
    const msg =
      item.patientMessage ||
      "Published — thank you for contributing. This is peer support, not medical advice.";
    return `
      <div class="community-approved-banner" role="status" id="communityLastResult">
        <span class="badge badge-status-approved">PUBLISHED</span>
        <p class="community-guidance-text">${escapeHtml(msg)}</p>
      </div>`;
  }

  const render = async () => {
    const feedbackHtml =
      lastSubmitFeedback?.status === "approved"
        ? renderApprovedBanner(lastSubmitFeedback)
        : renderPatientSubmitBanner(lastSubmitFeedback, escapeHtml);

    root.innerHTML =
      renderHeader(session) +
      `
      <main>
        <div class="card">
          <h1>Community</h1>
          <p class="muted">Peer support for people navigating PCOS and related conditions. Every post is reviewed automatically before publishing. No diagnoses or emergency care here.</p>
          ${feedbackHtml}
          <div class="callout callout-support">
            Share encouragement, coping strategies, or questions for your clinician—use “I feel” / “my experience”. Avoid naming doctors, sharing contact info, or telling others what disease they have.
          </div>
          <h2>Share with the community</h2>
          <form id="communityPostForm" class="community-compose">
            <textarea id="communityPostBody" rows="4" placeholder="e.g. It took years before anyone took my pain seriously…" maxlength="2000" required></textarea>
            <button class="btn btn-primary" type="submit">Submit for review</button>
          </form>
          <p id="communityPostMsg" class="community-post-msg" aria-live="polite"></p>

          <h2>Your submissions</h2>
          <p class="muted">Includes posts that were <strong>not published</strong>—read the guidance below each rejected entry.</p>
          <div id="communityMyPosts" class="community-feed community-feed--mine">
            <p class="muted">Loading…</p>
          </div>

          <h2>Community feed</h2>
          <div id="communityFeed" class="community-feed">
            <p class="muted">Loading…</p>
          </div>
          <p class="muted community-foot-note">If something urgent comes up, contact emergency services or your clinician. Linked clinicians may see rejected posts in their safety log.</p>
        </div>
      </main>`;

    bindLogout();

    try {
      await Promise.all([loadPosts(), loadMyPosts()]);
      const feed = document.getElementById("communityFeed");
      feed.innerHTML =
        posts.length === 0
          ? `<p class="muted">No published posts yet. Yours will appear here after safety review approves it.</p>`
          : posts.map(renderApprovedPostCard).join("");

      const mine = document.getElementById("communityMyPosts");
      mine.innerHTML =
        myPosts.length === 0
          ? `<p class="muted">You have not submitted any posts yet.</p>`
          : myPosts.map(renderMyPostCard).join("");
    } catch (e) {
      const err = escapeHtml(e instanceof Error ? e.message : String(e));
      document.getElementById("communityFeed").innerHTML = `<p class="muted">${err}</p>`;
      document.getElementById("communityMyPosts").innerHTML = `<p class="muted">${err}</p>`;
    }

    if (lastSubmitFeedback) {
      document.getElementById("communityLastResult")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }

    bindInteractions();
  };

  function bindInteractions() {
    document.getElementById("communityPostForm")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const msg = document.getElementById("communityPostMsg");
      const body = document.getElementById("communityPostBody").value.trim();
      msg.textContent = "Reviewing your post for safety…";
      msg.className = "community-post-msg muted";
      try {
        let result;
        if (isApiMode()) {
          result = await apiFetch("/community/posts", {
            method: "POST",
            body: JSON.stringify({ body }),
          });
        } else {
          const mod = moderateLocal(body);
          result = addPostLocal({
            id: crypto.randomUUID(),
            authorId: session.patientId,
            authorDisplay: session.displayName,
            body,
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
        msg.className = "community-post-msg callout danger";
        msg.textContent = err instanceof Error ? err.message : String(err);
      }
    });

    root.querySelectorAll(".community-toggle-comments").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const pid = btn.getAttribute("data-pid");
        const box = document.getElementById(`comments-${pid}`);
        const form = root.querySelector(`form.community-comment-form[data-pid="${pid}"]`);
        if (!box) return;
        const open = box.style.display !== "none";
        if (open) {
          box.style.display = "none";
          if (form) form.style.display = "none";
          return;
        }
        await loadComments(pid);
        const comments = commentsCache[pid] || [];
        box.innerHTML =
          comments.length === 0
            ? `<p class="muted">No comments yet.</p>`
            : comments
                .map(
                  (c) =>
                    `<div class="community-comment"><strong>${escapeHtml(c.authorDisplay)}</strong> <span class="muted">${escapeHtml(c.createdAt)}</span><p>${escapeHtml(c.body)}</p></div>`
                )
                .join("");
        box.style.display = "block";
        if (form) form.style.display = "flex";
      });
    });

    root.querySelectorAll(".community-comment-form").forEach((form) => {
      form.addEventListener("submit", async (e) => {
        e.preventDefault();
        const pid = form.getAttribute("data-pid");
        const input = form.querySelector('input[name="body"]');
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
          const comments = commentsCache[pid] || [];
          box.innerHTML = comments
            .map(
              (c) =>
                `<div class="community-comment"><strong>${escapeHtml(c.authorDisplay)}</strong><p>${escapeHtml(c.body)}</p></div>`
            )
            .join("");
        } catch (err) {
          alert(err instanceof Error ? err.message : String(err));
        }
      });
    });
  }

  render();
}

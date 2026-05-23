import {
  getLuneState,
  saveLuneState,
  addTomorrowItem,
  unsealTomorrowItem,
  LUNE_TONES,
  UNIVERSE_CONSTELLATIONS,
  SHARE_CONSTELLATIONS,
  SHARE_AUDIENCES,
} from "./luneStore.js";
import {
  renderLuneShell,
  renderPresenceRing,
  luneHref,
} from "./luneShell.js";

export function renderWelcomePage(basePath, escapeHtml) {
  const content = `<section class="lune-welcome">
    ${renderPresenceRing("md")}
    <p class="lune-welcome-line">You do not have to carry<br/>tonight alone.</p>
    <button type="button" class="lune-pill-btn lune-pill-btn--primary lune-begin-btn" id="luneBeginBtn">Begin</button>
  </section>
  <section class="lune-tone-picker" id="luneTonePicker" hidden>
    <p class="lune-muted lune-tone-lead">How would you like me to be with you?</p>
    <div class="lune-tone-list">${LUNE_TONES.map(
      (t) =>
        `<button type="button" class="lune-tone-card" data-tone="${escapeHtml(t.id)}">
          <strong>${escapeHtml(t.label)}</strong>
          <span class="lune-muted">${escapeHtml(t.description)}</span>
        </button>`
    ).join("")}</div>
  </section>`;
  return renderLuneShell({
    basePath,
    activeSegment: "universe",
    title: "",
    showTabBar: false,
    contentHtml: content,
    escapeHtml,
  });
}

export function bindWelcomePage(root, { userId, basePath }) {
  root.querySelector("#luneBeginBtn")?.addEventListener("click", () => {
    root.querySelector(".lune-welcome")?.setAttribute("hidden", "");
    const picker = root.querySelector("#luneTonePicker");
    if (picker) picker.hidden = false;
  });
  root.querySelectorAll("[data-tone]").forEach((btn) => {
    btn.addEventListener("click", () => {
      saveLuneState(userId, { tone: btn.getAttribute("data-tone"), onboarded: true });
      location.hash = luneHref(basePath, "universe");
    });
  });
}

export function renderUniversePage(basePath, escapeHtml) {
  const nodes = UNIVERSE_CONSTELLATIONS.map(
    (c) =>
      `<g class="lune-universe-node" transform="translate(${c.x},${c.y})">
        <circle r="5" fill="#E8E6F0" class="lune-star-dot"/>
        <text y="18" text-anchor="middle" fill="rgba(232,230,240,0.75)" font-size="9">${escapeHtml(c.label)}</text>
      </g>`
  ).join("");

  const content = `<div class="lune-universe-page">
    <header class="lune-universe-header">
      <span class="lune-back-spacer"></span>
      <h1 class="lune-page-title">Your Universe</h1>
      <div class="lune-menu-wrap">
        <button type="button" class="lune-icon-btn" id="luneUniverseMenu" aria-expanded="false" aria-haspopup="true">⋯</button>
        <div class="lune-menu" id="luneUniverseMenuPanel" hidden>
          <a href="${luneHref(basePath, "share")}" class="lune-menu-item">Share Universe</a>
          <a href="${luneHref(basePath, "no-google")}" class="lune-menu-item">Feeling Scared</a>
        </div>
      </div>
    </header>
    <div class="lune-universe-map">
      <svg viewBox="0 0 500 600" class="lune-universe-svg" aria-hidden="true">${nodes}</svg>
    </div>
    <div class="lune-universe-cta">
      <a href="${luneHref(basePath, "spill")}" class="lune-pill-btn lune-pill-btn--primary lune-spill-cta">Spill Your Heart</a>
    </div>
  </div>`;

  return renderLuneShell({
    basePath,
    activeSegment: "universe",
    title: "",
    showTabBar: true,
    contentHtml: content,
    escapeHtml,
  });
}

export function bindUniversePage(root) {
  const btn = root.querySelector("#luneUniverseMenu");
  const panel = root.querySelector("#luneUniverseMenuPanel");
  btn?.addEventListener("click", (e) => {
    e.stopPropagation();
    const open = panel && panel.hidden;
    if (panel) panel.hidden = !open;
    btn.setAttribute("aria-expanded", open ? "true" : "false");
  });
  document.addEventListener(
    "click",
    () => {
      if (panel) panel.hidden = true;
      btn?.setAttribute("aria-expanded", "false");
    },
    { once: false }
  );
}

export function renderSpillPage(basePath, escapeHtml) {
  const content = `<div class="lune-spill-page">
    <a href="${luneHref(basePath, "universe")}" class="lune-back lune-spill-back" aria-label="Back">${BACK}</a>
    ${renderPresenceRing("md")}
    <p class="lune-spill-lead">Tell me what tonight feels like.</p>
    <form id="luneSpillForm" class="lune-spill-form">
      <textarea id="luneSpillText" rows="8" placeholder="There is space here for everything..." maxlength="4000" required></textarea>
      <div class="lune-spill-actions">
        <button type="submit" class="lune-pill-btn lune-pill-btn--primary">Release</button>
      </div>
    </form>
  </div>`;
  return renderLuneShell({
    basePath,
    activeSegment: "universe",
    title: "",
    showTabBar: false,
    contentHtml: content,
    escapeHtml,
  });
}

export function bindSpillPage(root, { userId, basePath }) {
  root.querySelector("#luneSpillForm")?.addEventListener("submit", (e) => {
    e.preventDefault();
    const text = root.querySelector("#luneSpillText")?.value?.trim();
    if (!text) return;
    saveLuneState(userId, { lastSpill: text });
    location.hash = `${basePath}/processing`;
  });
}

export function renderProcessingPage(basePath, escapeHtml) {
  const content = `<div class="lune-processing-page">
    ${renderPresenceRing("lg")}
    <p class="lune-processing-text">I'm gently organizing<br/>what you shared...</p>
  </div>`;
  return renderLuneShell({
    basePath,
    activeSegment: "universe",
    title: "",
    showTabBar: false,
    contentHtml: content,
    escapeHtml,
  });
}

export function bindProcessingPage(_root, { basePath }) {
  window.setTimeout(() => {
    location.hash = luneHref(basePath, "universe");
  }, 4500);
}

const PRESENCE_LINES = [
  "I'm here.",
  "You don't have to solve everything tonight.",
  "It's okay to just be.",
  "Your feelings are safe here.",
];

export function renderStayPage(basePath, escapeHtml, mode = "presence") {
  const modes = [
    { id: "presence", label: "Quiet Presence" },
    { id: "grounding", label: "Grounding" },
    { id: "reflection", label: "Reflection" },
  ];
  const pills = modes
    .map(
      (m) =>
        `<button type="button" class="lune-filter-pill lune-stay-mode${m.id === mode ? " is-active" : ""}" data-stay-mode="${m.id}">${escapeHtml(m.label)}</button>`
    )
    .join("");

  let body = "";
  if (mode === "presence") {
    body = `<div class="lune-stay-presence">${PRESENCE_LINES.map(
      (line) => `<p class="lune-stay-line">${escapeHtml(line)}</p>`
    ).join("")}</div>`;
  } else if (mode === "grounding") {
    body = `<div class="lune-stay-grounding" id="luneGrounding">
      <p class="lune-stay-line">Follow the light.<br/>Breathe in... breathe out...</p>
      <p class="lune-muted lune-breathe-hint">In for 4... Hold for 4... Out for 6...</p>
      <button type="button" class="lune-pill-btn lune-pill-btn--ghost" id="luneGroundNext">Continue</button>
    </div>`;
  } else {
    body = `<div class="lune-stay-reflection">
      <div class="lune-reflection-log" id="luneReflectionLog">
        <div class="lune-reflection-bubble lune-reflection-bubble--in">I hear the weight in that. Tell me more about what that feels like.</div>
      </div>
      <form id="luneReflectionForm" class="lune-reflection-form">
        <input type="text" name="body" placeholder="What's on your mind..." maxlength="500" required />
        <button type="submit" class="lune-pill-btn lune-pill-btn--primary">Send</button>
      </form>
    </div>`;
  }

  const content = `<div class="lune-stay-page">
    <a href="${luneHref(basePath, "universe")}" class="lune-back lune-stay-back" aria-label="Back">${BACK}</a>
    ${renderPresenceRing("lg")}
    <div class="lune-filter-row lune-stay-modes">${pills}</div>
    ${body}
  </div>`;

  return renderLuneShell({
    basePath,
    activeSegment: "stay",
    title: "",
    showTabBar: true,
    contentHtml: content,
    escapeHtml,
  });
}

export function bindStayPage(root, { basePath }) {
  root.querySelectorAll("[data-stay-mode]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const mode = btn.getAttribute("data-stay-mode");
      location.hash = `${luneHref(basePath, "stay")}?mode=${mode}`;
    });
  });
  root.querySelector("#luneGroundNext")?.addEventListener("click", () => {
    const el = root.querySelector("#luneGrounding");
    if (el) {
      el.innerHTML = `<p class="lune-stay-line">Notice five things you can see.<br/>Four things you can touch.<br/>Three things you can hear.</p>
        <button type="button" class="lune-pill-btn lune-pill-btn--ghost" id="luneGroundAnchor">Continue</button>`;
      root.querySelector("#luneGroundAnchor")?.addEventListener("click", () => {
        el.innerHTML = `<p class="lune-stay-line">Feel your feet on the ground.<br/>You are here.<br/>You are safe in this moment.</p>`;
      });
    }
  });
  root.querySelector("#luneReflectionForm")?.addEventListener("submit", (e) => {
    e.preventDefault();
    const input = e.target.querySelector('input[name="body"]');
    const text = (input?.value || "").trim();
    if (!text) return;
    const log = root.querySelector("#luneReflectionLog");
    log?.insertAdjacentHTML(
      "beforeend",
      `<div class="lune-reflection-bubble lune-reflection-bubble--out">${text.replace(/</g, "&lt;")}</div>`
    );
    input.value = "";
    window.setTimeout(() => {
      log?.insertAdjacentHTML(
        "beforeend",
        `<div class="lune-reflection-bubble lune-reflection-bubble--in">Thank you for sharing that. Your feelings matter.</div>`
      );
    }, 1200);
  });
}

export function renderTomorrowPage(basePath, userId, escapeHtml) {
  const items = getLuneState(userId).tomorrowItems || [];
  const list =
    items.length === 0
      ? `<p class="lune-muted">Nothing sealed for tomorrow yet.</p>`
      : items
          .map(
            (it) =>
              `<article class="lune-tomorrow-item${it.sealed ? " is-sealed" : ""}" data-id="${escapeHtml(it.id)}">
                <p>${escapeHtml(it.text)}</p>
                ${it.sealed ? `<button type="button" class="lune-pill-btn lune-pill-btn--ghost lune-unseal-btn" data-unseal="${escapeHtml(it.id)}">Open box</button>` : `<span class="lune-muted lune-unsealed-label">Opened</span>`}
              </article>`
          )
          .join("");

  const content = `<div class="lune-tomorrow-page">
    <p class="lune-muted lune-tomorrow-lead">Worries and questions for tomorrow — sealed until you're ready.</p>
    <div class="lune-tomorrow-list">${list}</div>
    <button type="button" class="lune-tomorrow-add" id="luneTomorrowAdd">+ Add to tomorrow box</button>
    <form id="luneTomorrowForm" class="lune-tomorrow-form" hidden>
      <textarea id="luneTomorrowText" rows="4" placeholder="What if the scan shows something?" maxlength="500" required></textarea>
      <div class="lune-spill-actions">
        <button type="button" class="lune-pill-btn lune-pill-btn--ghost" id="luneTomorrowCancel">Cancel</button>
        <button type="submit" class="lune-pill-btn lune-pill-btn--primary">Seal in box</button>
      </div>
    </form>
  </div>`;

  return renderLuneShell({
    basePath,
    activeSegment: "tomorrow",
    title: "Tomorrow Box",
    showTabBar: true,
    contentHtml: content,
    escapeHtml,
  });
}

export function bindTomorrowPage(root, { userId, onRefresh }) {
  root.querySelector("#luneTomorrowAdd")?.addEventListener("click", () => {
    root.querySelector("#luneTomorrowForm")?.removeAttribute("hidden");
  });
  root.querySelector("#luneTomorrowCancel")?.addEventListener("click", () => {
    const form = root.querySelector("#luneTomorrowForm");
    if (form) form.hidden = true;
  });
  root.querySelector("#luneTomorrowForm")?.addEventListener("submit", (e) => {
    e.preventDefault();
    const text = root.querySelector("#luneTomorrowText")?.value?.trim();
    if (!text) return;
    addTomorrowItem(userId, text);
    onRefresh?.();
  });
  root.querySelectorAll("[data-unseal]").forEach((btn) => {
    btn.addEventListener("click", () => {
      unsealTomorrowItem(userId, btn.getAttribute("data-unseal"));
      onRefresh?.();
    });
  });
}

export function renderMePage(basePath, session, escapeHtml) {
  const name = session?.displayName || "Friend";
  const rows = [
    { label: "Night Mode", desc: "Auto-activates after 10pm", value: "On" },
    { label: "Morning Reminders", desc: "Check your Tomorrow Box", value: "8:00 AM" },
    { label: "Privacy", desc: "Your universe is private", value: "Manage" },
    { label: "Sharing", desc: "Control what caregivers see", value: "Customize" },
    { label: "Support", desc: "Get help or share feedback", value: "" },
  ];
  const content = `<div class="lune-me-page">
    <div class="lune-me-profile">
      ${renderPresenceRing("sm")}
      <p class="lune-me-name">${escapeHtml(name)}</p>
      <p class="lune-muted">42 days of companionship</p>
    </div>
    <div class="lune-me-cards">${rows
      .map(
        (r) =>
          `<button type="button" class="lune-me-card">
            <span class="lune-me-card-label">${escapeHtml(r.label)}</span>
            <span class="lune-muted">${escapeHtml(r.desc)}</span>
            ${r.value ? `<span class="lune-me-card-value">${escapeHtml(r.value)}</span>` : ""}
          </button>`
      )
      .join("")}</div>
    <div class="lune-me-foot">
      <button type="button" class="lune-pill-btn lune-pill-btn--ghost">Export My Universe</button>
      <p class="lune-muted">Your emotional data is encrypted and private.<br/>Only you control what is shared.</p>
    </div>
  </div>`;
  return renderLuneShell({
    basePath,
    activeSegment: "me",
    title: "Settings",
    showTabBar: true,
    contentHtml: content,
    escapeHtml,
  });
}

export function renderNoGooglePage(basePath, escapeHtml, phase = "ask") {
  if (phase === "response") {
    const content = `<div class="lune-scared-page">
      ${renderPresenceRing("md")}
      <p class="lune-stay-line">That sounds frightening.</p>
      <p class="lune-stay-line">Tonight may not be the best moment<br/>to carry the internet alone.</p>
      <p class="lune-muted">Your mind is looking for certainty<br/>in a place that often offers fear<br/>dressed as information.</p>
      <p class="lune-muted lune-scared-prompt">What would help right now?</p>
      <a href="${luneHref(basePath, "stay")}" class="lune-pill-btn lune-pill-btn--primary lune-pill-btn--wide">Stay with me</a>
      <a href="${luneHref(basePath, "stay")}?mode=grounding" class="lune-pill-btn lune-pill-btn--ghost lune-pill-btn--wide">Ground me</a>
      <a href="${luneHref(basePath, "tomorrow")}" class="lune-pill-btn lune-pill-btn--ghost lune-pill-btn--wide">Tomorrow Box</a>
      <a href="${luneHref(basePath, "universe")}" class="lune-muted lune-return-link">Return to my universe</a>
    </div>`;
    return renderLuneShell({
      basePath,
      activeSegment: "universe",
      title: "",
      showTabBar: false,
      backHref: luneHref(basePath, "universe"),
      contentHtml: content,
      escapeHtml,
    });
  }

  const content = `<div class="lune-scared-page">
    <a href="${luneHref(basePath, "universe")}" class="lune-back" aria-label="Back">${BACK}</a>
    <p class="lune-spill-lead">What are you afraid of right now?</p>
    <form id="luneScaredForm">
      <textarea id="luneScaredText" rows="5" placeholder="I'm scared that..." maxlength="2000" required></textarea>
      <button type="submit" class="lune-pill-btn lune-pill-btn--primary lune-pill-btn--wide">I need to know</button>
    </form>
  </div>`;
  return renderLuneShell({
    basePath,
    activeSegment: "universe",
    title: "",
    showTabBar: false,
    contentHtml: content,
    escapeHtml,
  });
}

export function bindNoGooglePage(root, { basePath }) {
  root.querySelector("#luneScaredForm")?.addEventListener("submit", (e) => {
    e.preventDefault();
    location.hash = `${luneHref(basePath, "no-google")}?phase=response`;
  });
}

export function renderSharePage(basePath, escapeHtml, step = "audience", audience = "") {
  if (step === "done") {
    const content = `<div class="lune-share-done">
      ${renderPresenceRing("md")}
      <p class="lune-stay-line">Shared.</p>
      <p class="lune-muted">When they view your universe,<br/>the constellation will softly light up.</p>
      <a href="${luneHref(basePath, "universe")}" class="lune-pill-btn lune-pill-btn--primary">Return to universe</a>
    </div>`;
    return renderLuneShell({
      basePath,
      activeSegment: "universe",
      title: "Share Universe",
      showTabBar: false,
      backHref: luneHref(basePath, "universe"),
      contentHtml: content,
      escapeHtml,
    });
  }

  if (step === "pick") {
    const cards = SHARE_CONSTELLATIONS.map(
      (c) =>
        `<button type="button" class="lune-share-constellation" data-constellation-id="${c.id}">
          <span class="lune-share-check" aria-hidden="true"></span>
          <span>${escapeHtml(c.label)}</span>
          <span class="lune-muted">${c.thoughtCount} thoughts</span>
        </button>`
    ).join("");
    const audienceLabel =
      audience === "caregiver"
        ? "My Caregiver"
        : audience === "doctor"
          ? "My Doctor"
          : "Anonymous Witnesses";
    const content = `<div class="lune-share-page">
      <p class="lune-muted">Sharing with: <strong class="lune-share-audience">${escapeHtml(audienceLabel)}</strong></p>
      <p class="lune-muted">Select constellations to share:</p>
      <div class="lune-share-list">${cards}</div>
      <div class="lune-spill-actions">
        <a href="${luneHref(basePath, "share")}" class="lune-pill-btn lune-pill-btn--ghost">Back</a>
        <button type="button" class="lune-pill-btn lune-pill-btn--primary" id="luneShareConfirm" disabled>Share</button>
      </div>
    </div>`;
    return renderLuneShell({
      basePath,
      activeSegment: "universe",
      title: "Share Universe",
      showTabBar: false,
      backHref: luneHref(basePath, "universe"),
      contentHtml: content,
      escapeHtml,
    });
  }

  const content = `<div class="lune-share-page">
    <p class="lune-muted lune-share-intro">Choose what to share and with whom.<br/>You control what becomes visible.</p>
    <p class="lune-muted">Share with:</p>
    <div class="lune-share-audiences">${SHARE_AUDIENCES.map(
      (a) =>
        `<a href="${luneHref(basePath, "share")}?step=pick&audience=${encodeURIComponent(a.id)}" class="lune-share-audience-card">
          <strong>${escapeHtml(a.label)}</strong>
          <span class="lune-muted">${escapeHtml(a.description)}</span>
        </a>`
    ).join("")}</div>
  </div>`;
  return renderLuneShell({
    basePath,
    activeSegment: "universe",
    title: "Share Universe",
    showTabBar: false,
    backHref: luneHref(basePath, "universe"),
    contentHtml: content,
    escapeHtml,
  });
}

export function bindSharePage(root, { basePath }) {
  const selected = new Set();
  root.querySelectorAll(".lune-share-constellation").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-constellation-id");
      if (selected.has(id)) {
        selected.delete(id);
        btn.classList.remove("is-selected");
      } else {
        selected.add(id);
        btn.classList.add("is-selected");
      }
      const confirm = root.querySelector("#luneShareConfirm");
      if (confirm) confirm.disabled = selected.size === 0;
    });
  });
  root.querySelector("#luneShareConfirm")?.addEventListener("click", () => {
    location.hash = `${luneHref(basePath, "share")}?step=done`;
  });
}

const BACK = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="24" height="24"><path d="m15 18-6-6 6-6"/></svg>`;

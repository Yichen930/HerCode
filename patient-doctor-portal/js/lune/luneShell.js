import { renderLuneStarfield } from "../communityLuneUi.js";

const TAB_ICONS = {
  back: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="m15 18-6-6 6-6"/></svg>`,
  universe: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="3"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg>`,
  stay: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>`,
  tomorrow: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>`,
  witnesses: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>`,
  me: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>`,
};

export const LUNE_TABS = [
  { id: "universe", label: "Universe", segment: "universe" },
  { id: "stay", label: "Stay With Me", segment: "stay" },
  { id: "tomorrow", label: "Tomorrow Box", segment: "tomorrow" },
  { id: "witnesses", label: "Witnesses", segment: "witnesses" },
  { id: "me", label: "Me", segment: "me" },
];

export function luneHref(basePath, segment) {
  return segment === "universe" ? `${basePath}/universe` : `${basePath}/${segment}`;
}

export function parseLuneSegment(basePath) {
  const hash = location.hash || basePath;
  const path = hash.split("?")[0];
  if (path === basePath) return "index";
  const prefix = `${basePath}/`;
  if (!path.startsWith(prefix)) return "index";
  const rest = path.slice(prefix.length);
  const segment = rest.split("/")[0] || "universe";
  const valid = [
    "welcome",
    "universe",
    "spill",
    "processing",
    "stay",
    "tomorrow",
    "witnesses",
    "me",
    "no-google",
    "share",
  ];
  return valid.includes(segment) ? segment : "universe";
}

export function luneHomeHref(basePath) {
  return String(basePath).includes("/caregiver/") ? "#/caregiver" : "#/patient";
}

export function renderLuneTabBar(basePath, activeSegment, escapeHtml, homeHref = luneHomeHref(basePath)) {
  return `<nav class="lune-tabbar" aria-label="Lune">
    <a href="${escapeHtml(homeHref)}" class="lune-tab lune-tab--back" aria-label="Back to main app">
      <span class="lune-tab-icon" aria-hidden="true">${TAB_ICONS.back}</span>
      <span class="lune-tab-label">Back</span>
    </a>
    ${LUNE_TABS.map((t) => {
      const active = t.segment === activeSegment ? " is-active" : "";
      return `<a href="${luneHref(basePath, t.segment)}" class="lune-tab${active}" aria-current="${active ? "page" : "false"}">
        <span class="lune-tab-icon" aria-hidden="true">${TAB_ICONS[t.id]}</span>
        <span class="lune-tab-label">${escapeHtml(t.label)}</span>
      </a>`;
    }).join("")}
  </nav>`;
}

export function renderLuneCommunityBackBar(homeHref, escapeHtml) {
  return `<div class="lune-community-topbar">
    <a href="${escapeHtml(homeHref)}" class="lune-community-back" aria-label="Back to main app">
      <span class="lune-community-back-icon" aria-hidden="true">${TAB_ICONS.back}</span>
      <span>Back to app</span>
    </a>
  </div>`;
}

export function renderLuneShell({ basePath, activeSegment, title, contentHtml, showTabBar = true, backHref = "", escapeHtml }) {
  const back =
    backHref &&
    `<a href="${escapeHtml(backHref)}" class="lune-back" aria-label="Back">${LUNE_BACK_SVG}</a>`;
  const header = title
    ? `<header class="lune-page-header">
        ${back || `<span class="lune-back-spacer"></span>`}
        <h1 class="lune-page-title">${escapeHtml(title)}</h1>
        <span class="lune-back-spacer"></span>
      </header>`
    : "";

  return `<div class="lune-app">
    ${renderLuneStarfield()}
    <div class="lune-app-inner${showTabBar ? " lune-app-inner--tabbed" : ""}">
      ${header}
      ${contentHtml}
    </div>
    ${showTabBar ? renderLuneTabBar(basePath, activeSegment, escapeHtml, luneHomeHref(basePath)) : ""}
  </div>`;
}

const LUNE_BACK_SVG = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="24" height="24"><path d="m15 18-6-6 6-6"/></svg>`;

export function renderPresenceRing(size = "md") {
  const cls = size === "lg" ? "lune-presence-ring lune-presence-ring--lg" : "lune-presence-ring";
  return `<div class="${cls}" aria-hidden="true"><div class="lune-presence-ring-core"></div></div>`;
}

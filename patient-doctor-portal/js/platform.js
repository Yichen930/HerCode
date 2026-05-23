/**
 * Mobile app shell — PWA install, Capacitor detection, bottom tab bar.
 */

const MOBILE_TAB_BREAKPOINT = 768;

export function getApiBaseFromMeta() {
  const meta = document.querySelector('meta[name="hearher-api-base"]')?.content?.trim();
  return meta ? meta.replace(/\/$/, "") : "";
}

export function isStandaloneApp() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.navigator.standalone === true ||
    document.referrer.includes("android-app://")
  );
}

export function isCapacitorNative() {
  return Boolean(window.Capacitor?.isNativePlatform?.());
}

export function isMobileLayout() {
  return window.matchMedia(`(max-width: ${MOBILE_TAB_BREAKPOINT}px)`).matches;
}

function tabActive(href) {
  const hash = (location.hash || "#/login").split("?")[0];
  const base = href.split("?")[0];
  if (base === "#/patient") return hash === "#/patient";
  if (base === "#/patient/checkin") {
    return hash === "#/patient/checkin" || hash.startsWith("#/patient/checkins");
  }
  if (base === "#/patient/lune") return hash.startsWith("#/patient/lune");
  if (base === "#/caregiver") return hash === "#/caregiver" || hash.startsWith("#/caregiver?");
  if (base === "#/caregiver/lune") return hash.startsWith("#/caregiver/lune");
  if (base === "#/caregiver/chat") return hash.startsWith("#/caregiver/chat");
  return hash === base || hash.startsWith(`${base}?`);
}

function mobileTab(href, label, icon) {
  const active = tabActive(href) ? " is-active" : "";
  return `<a href="${href}" class="mobile-tab${active}" aria-current="${active ? "page" : "false"}">
    <span class="mobile-tab-icon" aria-hidden="true">${icon}</span>
    <span class="mobile-tab-label">${label}</span>
  </a>`;
}

const ICONS = {
  home: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75"><path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1v-9.5z"/></svg>`,
  support: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>`,
  log: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75"><path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/></svg>`,
  help: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75"><circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 4.2 1.8c-.8.7-1.7 1.2-1.7 2.2"/><circle cx="12" cy="16.5" r=".75" fill="currentColor"/></svg>`,
  settings: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75"><circle cx="12" cy="12" r="3"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>`,
  link: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>`,
  messages: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75"><path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z"/></svg>`,
  community: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>`,
};

/** @param {{ role?: string } | null} session */
export function renderMobileTabBar(session) {
  if (!session || session.role === "doctor") return "";

  let tabs = "";
  if (session.role === "patient") {
    tabs = [
      mobileTab("#/patient", "Home", ICONS.home),
      mobileTab("#/patient/lune/witnesses", "Community", ICONS.community),
      mobileTab("#/patient/chat", "Support", ICONS.support),
      mobileTab("#/patient/messages", "Contacts", ICONS.messages),
      mobileTab("#/patient/checkin", "Log", ICONS.log),
    ].join("");
  } else if (session.role === "caregiver") {
    tabs = [
      mobileTab("#/caregiver", "Home", ICONS.home),
      mobileTab("#/caregiver/lune/witnesses", "Community", ICONS.community),
      mobileTab("#/caregiver/chat", "Contacts", ICONS.messages),
      mobileTab("#/caregiver/link", "Link", ICONS.link),
    ].join("");
  }

  return `<nav class="mobile-tabbar" aria-label="Main">${tabs}</nav>`;
}

export function applyMobileShellClasses() {
  const body = document.body;
  body.classList.toggle("is-standalone", isStandaloneApp() || isCapacitorNative());
  body.classList.toggle("has-mobile-tabbar", isMobileLayout());
}

export async function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  try {
    await navigator.serviceWorker.register("/sw.js", { scope: "/" });
  } catch (err) {
    console.warn("Service worker registration failed:", err);
  }
}

export function initPlatform() {
  applyMobileShellClasses();
  window.addEventListener("resize", applyMobileShellClasses);
  void registerServiceWorker();
}

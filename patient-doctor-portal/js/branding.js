/** Product identity — Lune. */

export const PRODUCT_NAME = "Lune";
export const PRODUCT_TAGLINE = "A quiet light for difficult nights.";
export const TEAM_NAME = "Lune";
export const TEAM_CREDIT = "Produced by Lune";

/** Full lockup — dark background (login hero on dark, about). */
export const LOGO_URL = "/logo/Lune-logo.svg";
/** Full lockup — light background (login panel, footer). */
export const LOGO_LIGHT_URL = "/logo/Lune-logo-light.svg";
/** Moon + star mark for header and favicon. */
export const LOGO_MARK_URL = "/logo/Lune-logo-mark.svg";

/** @type {Record<string, { w: number, h: number }>} */
const LOGO_DIMS = {
  header: { w: 44, h: 44 },
  sm: { w: 120, h: 156 },
  md: { w: 220, h: 286 },
  lg: { w: 220, h: 286 },
  login: { w: 240, h: 312 },
  hero: { w: 200, h: 260 },
};

/**
 * @param {{ size?: "sm" | "md" | "lg" | "login" | "hero", className?: string, onDark?: boolean }} [opts]
 */
export function renderLogo(opts = {}) {
  const size = opts.size || "md";
  const extra = opts.className ? ` ${opts.className}` : "";
  const dim = LOGO_DIMS[size] || LOGO_DIMS.md;
  const src = opts.onDark ? LOGO_URL : LOGO_LIGHT_URL;
  const img = `<img src="${src}" alt="${PRODUCT_NAME}" width="${dim.w}" height="${dim.h}" class="brand-logo brand-logo--${size}${extra}" loading="lazy" decoding="async" />`;
  if (opts.onDark) {
    return `<div class="brand-logo-panel brand-logo-panel--${size}">${img}</div>`;
  }
  return img;
}

/**
 * Logo stacked above team credit, centered as a unit.
 * @param {{ size?: "sm" | "md" | "lg" | "login" | "hero", onDark?: boolean, className?: string }} [opts]
 */
export function renderBrandLockup(opts = {}) {
  const size = opts.size || "md";
  const onDark = Boolean(opts.onDark);
  const mod = onDark ? " brand-lockup--on-dark" : "";
  const creditMod = onDark ? " brand-lockup-credit--on-dark" : "";
  const logoClass = opts.className || "";
  return `<div class="brand-lockup brand-lockup--${size}${mod}">
    ${renderLogo({ size, onDark, className: logoClass })}
    <p class="brand-lockup-credit${creditMod}">${TEAM_CREDIT}</p>
  </div>`;
}

export function renderHeaderBrand(session) {
  const href = session
    ? session.role === "doctor"
      ? "#/doctor"
      : session.role === "caregiver"
        ? "#/caregiver"
        : "#/patient"
    : "#/about";
  const dim = LOGO_DIMS.header;
  return `<a href="${href}" class="brand brand-header">
    <img src="${LOGO_MARK_URL}" alt="" width="${dim.w}" height="${dim.h}" class="brand-logo brand-logo--header" loading="eager" decoding="async" />
    <span class="brand-header-text">
      <span class="brand-header-name">${PRODUCT_NAME}</span>
      <span class="brand-header-tagline">${PRODUCT_TAGLINE}</span>
    </span>
  </a>`;
}

export function renderProductFooter() {
  return `<footer class="app-footer">
    ${renderBrandLockup({ size: "sm" })}
  </footer>`;
}

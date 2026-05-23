/** Product identity — BioHackzard is the team, not the product name. */

export const PRODUCT_NAME = "HearHer";
export const PRODUCT_TAGLINE = "Hear her. Care, connected.";
export const TEAM_NAME = "BioHackzard";
export const TEAM_CREDIT = `Produced by ${TEAM_NAME}`;

/** Official logo (1024×1024, transparent PNG embedded in SVG). */
export const LOGO_URL = "/logo/HearHer-logo-from-png.svg";
export const LOGO_PNG_URL = "/logo/HearHer-logo.png";

/** @type {Record<string, { w: number, h: number }>} */
const LOGO_DIMS = {
  header: { w: 44, h: 44 },
  sm: { w: 88, h: 88 },
  md: { w: 280, h: 280 },
  lg: { w: 280, h: 280 },
  login: { w: 280, h: 280 },
  hero: { w: 240, h: 240 },
};

/**
 * @param {{ size?: "sm" | "md" | "lg" | "login" | "hero", className?: string, onDark?: boolean }} [opts]
 */
export function renderLogo(opts = {}) {
  const size = opts.size || "md";
  const extra = opts.className ? ` ${opts.className}` : "";
  const dim = LOGO_DIMS[size] || LOGO_DIMS.md;
  const img = `<img src="${LOGO_URL}" alt="${PRODUCT_NAME}" width="${dim.w}" height="${dim.h}" class="brand-logo brand-logo--${size}${extra}" loading="lazy" decoding="async" />`;
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
      : "#/patient"
    : "#/about";
  const dim = LOGO_DIMS.header;
  return `<a href="${href}" class="brand brand-header">
    <img src="${LOGO_PNG_URL}" alt="" width="${dim.w}" height="${dim.h}" class="brand-logo brand-logo--header" loading="eager" decoding="async" />
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

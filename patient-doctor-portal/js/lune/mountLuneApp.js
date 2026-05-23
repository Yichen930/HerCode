import { getLuneState } from "./luneStore.js";
import { parseLuneSegment, luneHref, renderLuneTabBar } from "./luneShell.js";
import { renderLuneStarfield } from "../communityLuneUi.js";
import { mountCommunityPage } from "../communityPage.js";
import {
  renderWelcomePage,
  bindWelcomePage,
  renderUniversePage,
  bindUniversePage,
  renderSpillPage,
  bindSpillPage,
  renderProcessingPage,
  bindProcessingPage,
  renderStayPage,
  bindStayPage,
  renderTomorrowPage,
  bindTomorrowPage,
  renderMePage,
  renderNoGooglePage,
  bindNoGooglePage,
  renderSharePage,
  bindSharePage,
} from "./lunePages.js";

/**
 * Full Lune app — all pages from Figma prototype (awake-gills-36030163.figma.site)
 * @param {HTMLElement} root
 * @param {object} deps
 */
export function mountLuneApp(root, deps) {
  const {
    session,
    communityRole = "patient",
    escapeHtml,
    renderHeader,
    bindLogout,
    isApiMode,
  } = deps;

  const basePath =
    communityRole === "caregiver" ? "#/caregiver/lune" : "#/patient/lune";
  const userId =
    communityRole === "caregiver"
      ? session?.caregiverId || session?.email || session?.patientId || "anon"
      : session?.patientId || session?.email || session?.caregiverId || "anon";
  let segment = parseLuneSegment(basePath);
  const params = new URLSearchParams((location.hash.split("?")[1] || ""));

  document.body.classList.add("lune-community-active", "lune-fullscreen");

  const onboarded = getLuneState(userId).onboarded;
  const caregiverCommunityFirst = communityRole === "caregiver";

  if (segment === "index") {
    if (caregiverCommunityFirst) {
      segment = "witnesses";
    } else {
      segment = onboarded ? "universe" : "welcome";
    }
  }
  if (!onboarded && segment !== "welcome" && !caregiverCommunityFirst && segment !== "witnesses") {
    segment = "welcome";
  }

  const rerender = () => mountLuneApp(root, deps);

  if (segment === "witnesses") {
    root.innerHTML =
      renderHeader(session) +
      `<div class="lune-app">
        ${renderLuneStarfield()}
        <div class="lune-app-inner lune-app-inner--tabbed lune-witnesses-embed" id="luneCommunityHost"></div>
        ${renderLuneTabBar(basePath, "witnesses", escapeHtml)}
      </div>`;
    bindLogout();
    mountCommunityPage(root.querySelector("#luneCommunityHost"), {
      ...deps,
      communityRole,
      embedded: true,
      luneBasePath: `${basePath}/witnesses`,
    });
    return;
  }

  let html = "";
  switch (segment) {
    case "welcome":
      html = renderWelcomePage(basePath, escapeHtml);
      break;
    case "universe":
      html = renderUniversePage(basePath, escapeHtml);
      break;
    case "spill":
      html = renderSpillPage(basePath, escapeHtml);
      break;
    case "processing":
      html = renderProcessingPage(basePath, escapeHtml);
      break;
    case "stay":
      html = renderStayPage(basePath, escapeHtml, params.get("mode") || "presence");
      break;
    case "tomorrow":
      html = renderTomorrowPage(basePath, userId, escapeHtml);
      break;
    case "me":
      html = renderMePage(basePath, session, escapeHtml);
      break;
    case "no-google":
      html = renderNoGooglePage(
        basePath,
        escapeHtml,
        params.get("phase") === "response" ? "response" : "ask"
      );
      break;
    case "share":
      html = renderSharePage(
        basePath,
        escapeHtml,
        params.get("step") || "audience",
        params.get("audience") || ""
      );
      break;
    default:
      location.hash = luneHref(basePath, caregiverCommunityFirst ? "witnesses" : "universe");
      return;
  }

  root.innerHTML = renderHeader(session) + html;
  bindLogout();

  switch (segment) {
    case "welcome":
      bindWelcomePage(root, { userId, basePath });
      break;
    case "universe":
      bindUniversePage(root);
      break;
    case "spill":
      bindSpillPage(root, { userId, basePath });
      break;
    case "processing":
      bindProcessingPage(root, { basePath });
      break;
    case "stay":
      bindStayPage(root, { basePath });
      break;
    case "tomorrow":
      bindTomorrowPage(root, { userId, onRefresh: rerender });
      break;
    case "no-google":
      bindNoGooglePage(root, { basePath });
      break;
    case "share":
      bindSharePage(root, { basePath });
      break;
    default:
      break;
  }
}

export function luneRoutePattern(role) {
  return role === "caregiver" ? "#/caregiver/lune" : "#/patient/lune";
}

export function isLuneRoute(route, role) {
  const prefix = luneRoutePattern(role);
  return route === prefix || route.startsWith(`${prefix}/`);
}

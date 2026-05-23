/**
 * After guided Support flow — reassurance + concrete next steps.
 */

import { getCohortReassurance, renderCohortReassurancePanel } from "./cohortReassurance.js";

export function renderEmotionalWrapUp(supportCollected, escapeHtml) {
  const lines = getCohortReassurance({}, supportCollected || {});
  return `
    <div class="emotional-wrap-up">
      ${renderCohortReassurancePanel(lines)}
      <h3 class="emotional-wrap-up-title">You have done something caring for yourself</h3>
      <p class="muted">Naming feelings is emotional support — not weakness. When you are ready:</p>
      <div class="btn-row emotional-wrap-up-actions">
        <a class="btn btn-primary" href="#/patient/visit-brief">Build visit brief</a>
        <a class="btn btn-ghost" href="#/patient/find-help">Find human help</a>
        <a class="btn btn-ghost" href="#/patient/learn">Calm &amp; learn</a>
        <a class="btn btn-ghost" href="#/patient/messages">Message someone linked</a>
      </div>
    </div>`;
}

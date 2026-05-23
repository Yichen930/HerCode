/**
 * Cohort logistic joint score — loads pcos_joint_model.json (from export_pcos_joint_model.py).
 */

let cachedModel = null;

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function loadJointModel() {
  if (cachedModel) return cachedModel;
  const res = await fetch("/research-figures/pcos_joint_model.json", { cache: "no-store" });
  if (!res.ok) throw new Error("Joint model not found");
  cachedModel = await res.json();
  return cachedModel;
}

function sigmoid(x) {
  if (x >= 0) {
    const z = Math.exp(-x);
    return 1 / (1 + z);
  }
  const z = Math.exp(x);
  return z / (1 + z);
}

function parseUserValue(raw, featureMeta) {
  if (raw == null || raw === "" || raw === "unknown") return null;
  if (featureMeta.kind === "binary" || /\(Y\/N\)/i.test(featureMeta.feature || "")) {
    if (raw === "yes" || raw === "1" || raw === 1) return 1;
    if (raw === "no" || raw === "0" || raw === 0) return 0;
    return null;
  }
  const v = Number(raw);
  return Number.isFinite(v) ? v : null;
}

/** Ordinal readout — avoids presenting raw % as patient probability. */
export function overlapBandFromProbability(probability) {
  const p = probability;
  if (p >= 0.72) {
    return {
      id: "strong",
      label: "Strong overlap with PCOS-enriched cohort pattern",
      className: "overlap-band overlap-band--strong",
    };
  }
  if (p >= 0.58) {
    return {
      id: "moderate",
      label: "Moderate overlap with PCOS-enriched cohort pattern",
      className: "overlap-band overlap-band--moderate",
    };
  }
  if (p >= 0.42) {
    return {
      id: "mixed",
      label: "Mixed overlap — entered measures pull in different directions in the fit",
      className: "overlap-band overlap-band--mixed",
    };
  }
  if (p >= 0.28) {
    return {
      id: "limited",
      label: "Limited overlap with PCOS-enriched cohort pattern",
      className: "overlap-band overlap-band--limited",
    };
  }
  return {
    id: "low",
    label: "Low overlap with PCOS-enriched cohort pattern",
    className: "overlap-band overlap-band--low",
  };
}

/**
 * @param {Record<string, string|number>} valuesByLabId
 */
export function scoreJointModel(model, valuesByLabId) {
  let logit = model.intercept;
  const contributions = [];
  const imputed = [];
  const used = [];

  for (const f of model.features) {
    const raw = valuesByLabId[f.id];
    const parsed = parseUserValue(raw, f);
    const numeric = parsed != null ? parsed : f.median;
    const imputedFlag = parsed == null;
    if (imputedFlag) imputed.push(f.id);

    const z = (numeric - f.mean) / (f.std || 1);
    const contrib = f.coef * z;
    logit += contrib;

    if (!imputedFlag) {
      used.push(f.id);
      contributions.push({
        id: f.id,
        feature: f.feature,
        value: numeric,
        z,
        contrib,
        imputed: false,
      });
    } else if (Object.keys(valuesByLabId).length > 0) {
      contributions.push({
        id: f.id,
        feature: f.feature,
        value: numeric,
        z,
        contrib,
        imputed: true,
      });
    }
  }

  const probability = sigmoid(logit);
  contributions.sort((a, b) => Math.abs(b.contrib) - Math.abs(a.contrib));

  return {
    probability,
    logit,
    contributions,
    imputed,
    used,
    userProvidedCount: used.length,
  };
}

export function renderJointScoreBlock(model, score, { minUserFields = 2 } = {}) {
  if (score.userProvidedCount < minUserFields) {
    return `<div class="readout-layer readout-layer--stat joint-score-card joint-score-card--muted">
      <p class="readout-layer-tag">Layer 1 — Statistical overlap</p>
      <p>Add at least <strong>${minUserFields}</strong> measures (not cohort medians) for in-cohort logistic overlap. The fit uses ${model.featureCount} numeric cohort fields together.</p>
    </div>`;
  }

  const band = overlapBandFromProbability(score.probability);
  const pct = Math.round(score.probability * 100);
  const userContribs = score.contributions.filter((c) => !c.imputed);
  const minDriver = 0.04;
  const driverItems = userContribs
    .filter((c) => Math.abs(c.contrib) >= minDriver)
    .slice(0, 8)
    .map((c) => {
      const dir = c.contrib > 0 ? "toward PCOS-labeled side of fit" : "toward non–PCOS-labeled side of fit";
      return `<li><strong>${escapeHtml(c.feature)}</strong> — ${dir}</li>`;
    });
  const drivers =
    driverItems.length > 0
      ? driverItems.join("")
      : userContribs
          .slice(0, 4)
          .map((c) => {
            const dir = c.contrib > 0 ? "slight pull toward PCOS-labeled fit" : "slight pull away";
            return `<li><strong>${escapeHtml(c.feature)}</strong> — ${dir}</li>`;
          })
          .join("");

  const imputedHeavy = score.imputed.length >= 15;
  const imputedNote = imputedHeavy
    ? `<p class="joint-imputed-note joint-imputed-note--warn"><strong>Limited input:</strong> ${score.userProvidedCount} measure(s) entered; ${score.imputed.length} of ${model.featureCount} fields imputed to cohort medians. Ordinal overlap can shift sharply — not for individual risk.</p>`
    : score.imputed.length > 0
      ? `<p class="muted joint-imputed-note">${score.imputed.length} field(s) imputed to cohort median in the fit.</p>`
      : "";

  const technicalBody = `
    <p class="muted">In-cohort logistic score (research index, <strong>not</strong> calibrated diagnostic probability): <strong>${pct}%</strong> on a 0–100 training scale (~50 = neutral in this table).</p>
    <p class="muted">Training cohort n=${model.n}; 5-fold CV AUC ${Math.round(model.cvRocAuc * 100)}% (in-sample reference only).</p>
    ${drivers ? `<p class="research-mini-label">Largest shifts in the combined fit (your values)</p><ul class="research-list">${drivers}</ul>` : ""}
    <p class="muted">${escapeHtml(model.disclaimer)}</p>`;

  return `<div class="readout-layer readout-layer--stat joint-score-card">
    <p class="readout-layer-tag">Layer 1 — Statistical overlap</p>
    <p class="joint-score-lead muted">How entered measures move together in the published tabular cohort logistic fit. <strong>Not a diagnosis</strong> — supports clinical reasoning only.</p>
    <p class="${band.className}">${escapeHtml(band.label)}</p>
    ${imputedNote}
    <details class="research-details research-details--joint-tech">
      <summary>Technical details (in-cohort logistic fit)</summary>
      <div class="research-details-body">${technicalBody}</div>
    </details>
  </div>`;
}

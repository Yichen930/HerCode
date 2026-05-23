/**
 * Multi-parameter cohort contextualization — not diagnosis.
 * Uses published PCOS cohort directions (correlations / model coefficients).
 */
import { LAB_COHORT_REFERENCE, PCOS_COHORT } from "./researchData.js";
import { loadJointModel, scoreJointModel, renderJointScoreBlock } from "./researchJointModel.js";

/** Measures with cohort means or binary association — usable in multi-parameter scoring. */
export const PHENOTYPE_SCORABLE_COUNT = LAB_COHORT_REFERENCE.filter(
  (l) => l.kind === "numeric" || l.kind === "binary"
).length;

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function findLab(id) {
  return LAB_COHORT_REFERENCE.find((l) => l.id === id);
}

function cohortSeparatesGroups(lab) {
  const p = lab?.pValue;
  if (typeof p === "number" && Number.isFinite(p) && p < 0.05) return true;
  const m0 = Number(lab?.meanNonPcos);
  const m1 = Number(lab?.meanPcos);
  if (!Number.isFinite(m0) || !Number.isFinite(m1)) return false;
  const ref = Math.max(Math.abs(m0), Math.abs(m1), 1e-6);
  return Math.abs(m0 - m1) / ref >= 0.1;
}

/** @returns {-1|0|1|null} null = no input */
function numericAlignment(lab, value) {
  const v = Number(value);
  const m0 = Number(lab.meanNonPcos);
  const m1 = Number(lab.meanPcos);
  if (!Number.isFinite(v) || !Number.isFinite(m0) || !Number.isFinite(m1)) return null;
  if (!cohortSeparatesGroups(lab)) return 0;

  const higherInPcos = m1 > m0;
  const dPcos = Math.abs(v - m1);
  const dNon = Math.abs(v - m0);
  if (dPcos < dNon * 0.9) return higherInPcos ? 1 : -1;
  if (dNon < dPcos * 0.9) return higherInPcos ? -1 : 1;
  return 0;
}

/** @returns {-1|0|1|null} */
function binaryAlignment(lab, answer) {
  if (!answer || answer === "unknown") return null;
  const separates = typeof lab.pValue === "number" && lab.pValue < 0.05;
  if (!separates) return 0;
  if (answer === "yes") return 1;
  if (answer === "no") return -1;
  return null;
}

const COHORT_TOWARD_PCOS = {
  amh_ng_ml: "AMH elevated vs non–PCOS cohort mean",
  cycle_r_i: "Irregular / oligo-anovulatory cycles",
  follicle_no_r: "Elevated antral follicle count (R)",
  follicle_no_l: "Elevated antral follicle count (L)",
  lh_miu_ml: "Elevated LH vs non–PCOS mean",
  hair_growth_y_n: "Hirsutism",
  pimples_y_n: "Acne",
  skin_darkening_y_n: "Acanthosis / skin darkening",
  hair_loss_y_n: "Hair thinning or loss",
  weight_gain_y_n: "Reported weight gain",
  bmi: "BMI toward PCOS-labeled mean",
  rbs_mg_dl: "Glucose toward PCOS-labeled mean",
  waist_inch: "Waist toward PCOS-labeled mean",
};

const COHORT_AWAY_PCOS = {
  bmi: "BMI closer to non–PCOS-labeled mean",
  fsh_miu_ml: "FSH closer to non–PCOS-labeled mean",
  amh_ng_ml: "AMH closer to non–PCOS-labeled mean",
  lh_miu_ml: "LH closer to non–PCOS-labeled mean",
};

const PHENOTYPE_AXES = [
  {
    id: "reproductive",
    title: "Reproductive / ovulatory pattern",
    axisGroup: "Reproductive axis",
    headline:
      "resembles a reproductive–ovulatory PCOS-enriched pattern in this cohort (ovulatory dysfunction + ovarian reserve markers)",
    fields: [
      { labId: "amh_ng_ml", weight: 1.0 },
      { labId: "cycle_r_i", weight: 1.1 },
      { labId: "follicle_no_r", weight: 1.2 },
      { labId: "follicle_no_l", weight: 1.0 },
      { labId: "cycle_length_days", weight: 0.5 },
    ],
  },
  {
    id: "hyperandrogenic",
    title: "Hyperandrogenic pattern",
    axisGroup: "Hyperandrogenic axis",
    headline:
      "closer to hyperandrogenism-associated profiles in this cohort (clinical signs + LH context)",
    fields: [
      { labId: "hair_growth_y_n", weight: 1.2 },
      { labId: "pimples_y_n", weight: 1.0 },
      { labId: "skin_darkening_y_n", weight: 0.9 },
      { labId: "hair_loss_y_n", weight: 0.5 },
      { labId: "lh_miu_ml", weight: 0.7 },
      { labId: "fsh_miu_ml", weight: 0.4 },
    ],
  },
  {
    id: "metabolic",
    title: "Metabolic-dominant pattern",
    axisGroup: "Metabolic axis",
    headline:
      "resembles metabolic-dominant PCOS phenotype patterns in this cohort (anthropometrics + insulin-resistance proxies)",
    fields: [
      { labId: "bmi", weight: 1.2 },
      { labId: "weight_gain_y_n", weight: 1.1 },
      { labId: "skin_darkening_y_n", weight: 0.8 },
      { labId: "rbs_mg_dl", weight: 0.6 },
      { labId: "waist_inch", weight: 0.7 },
    ],
  },
];

function resolveCycleValue(preset) {
  const lab = findLab("cycle_r_i");
  if (!lab || !preset) return null;
  if (preset === "irregular") return String(lab.meanPcos);
  if (preset === "regular") return String(lab.meanNonPcos);
  return null;
}

/**
 * @param {{
 *   amh?: string, bmi?: string, lh?: string, fsh?: string,
 *   cycle?: string, hirsutism?: string, acne?: string, weightGain?: string,
 *   follicleR?: string, follicleL?: string, age?: string, cycleLength?: string,
 *   tsh?: string, rbs?: string, waist?: string,
 *   skinDarkening?: string, hairLoss?: string,
 * }} raw
 */
export function computePhenotypeContext(raw, dynamicRoot = null) {
  const values = buildValuesMap(raw, dynamicRoot);

  const lh = Number(values.lh_miu_ml);
  const fsh = Number(values.fsh_miu_ml);
  let lhFshNote = null;
  if (Number.isFinite(lh) && Number.isFinite(fsh) && fsh > 0) {
    const ratio = lh / fsh;
    lhFshNote = `LH/FSH ≈ ${ratio.toFixed(2)} (educational; ratio >2 is often discussed in PCOS workups—not diagnostic alone).`;
    if (ratio > 2 && !values.lh_miu_ml) values.lh_miu_ml = String(lh);
  }

  const contributions = [];
  let filled = 0;

  for (const [labId, val] of Object.entries(values)) {
    if (val == null || val === "" || val === "unknown") continue;
    const lab = findLab(labId);
    if (!lab) continue;

    let alignment = null;
    if (lab.kind === "binary") alignment = binaryAlignment(lab, val);
    else if (lab.kind === "numeric") alignment = numericAlignment(lab, val);

    if (alignment === null) continue;
    filled += 1;
    contributions.push({
      labId,
      feature: lab.feature,
      alignment,
      separates: cohortSeparatesGroups(lab),
    });
  }

  const axisScores = PHENOTYPE_AXES.map((axis) => {
    let wSum = 0;
    let score = 0;
    const matched = [];
    for (const { labId, weight } of axis.fields) {
      const val = values[labId];
      if (val == null || val === "" || val === "unknown") continue;
      const lab = findLab(labId);
      if (!lab) continue;
      let alignment = lab.kind === "binary" ? binaryAlignment(lab, val) : numericAlignment(lab, val);
      if (alignment === null) continue;
      wSum += weight;
      score += alignment * weight;
      if (alignment !== 0) {
        matched.push({ feature: lab.feature, alignment, labId });
      }
    }
    return {
      ...axis,
      score: wSum > 0 ? score / wSum : 0,
      weight: wSum,
      matched,
    };
  }).sort((a, b) => b.score - a.score);

  const minFields = 2;
  if (filled < minFields) {
    return {
      status: "insufficient",
      filled,
      minFields,
      lhFshNote,
      contributions,
      axisScores,
    };
  }

  const top = axisScores[0];
  const second = axisScores[1];
  const spread = top && second ? top.score - second.score : 0;

  if (top.score < 0.15 && axisScores.every((a) => a.score < 0.25)) {
    return {
      status: "weak_overlap",
      filled,
      lhFshNote,
      contributions,
      axisScores,
    };
  }

  const strongAxes = axisScores.filter((a) => a.weight > 0 && a.score >= 0.35);
  if (spread < 0.2 && strongAxes.length >= 2 && top.score >= 0.35) {
    if (strongAxes.every((a) => a.score >= 0.5)) {
      return {
        status: "multimodal",
        filled,
        lhFshNote,
        contributions,
        axisScores,
        strongAxes,
        top,
      };
    }
    return {
      status: "mixed",
      filled,
      lhFshNote,
      contributions,
      axisScores,
      top,
      second,
    };
  }

  if (top.score < 0) {
    return {
      status: "away_from_patterns",
      filled,
      lhFshNote,
      contributions,
      axisScores,
      top,
    };
  }

  return {
    status: "pattern",
    filled,
    lhFshNote,
    contributions,
    axisScores,
    top,
    second,
  };
}

function clinicalCohortBullet(c) {
  if (c.alignment > 0) {
    return COHORT_TOWARD_PCOS[c.labId] || `${c.feature} — toward PCOS-labeled group mean`;
  }
  if (c.alignment < 0) {
    return COHORT_AWAY_PCOS[c.labId] || `${c.feature} — closer to non–PCOS-labeled mean`;
  }
  return `${c.feature} — similar between groups in this cohort`;
}

function renderAxisGroupedCohortComparison(contributions, lhFshNote) {
  if (!contributions.length && !lhFshNote) return "";

  const assigned = new Set();
  const groups = PHENOTYPE_AXES.map((axis) => {
    const items = contributions.filter((c) => {
      const inAxis = axis.fields.some((f) => f.labId === c.labId);
      if (inAxis) assigned.add(c.labId);
      return inAxis;
    });
    return { axis, items };
  }).filter((g) => g.items.length > 0);

  const other = contributions.filter((c) => !assigned.has(c.labId));
  if (other.length) groups.push({ axis: { axisGroup: "Other measures" }, items: other });

  const body = groups
    .map(
      (g) => `<div class="cohort-axis-group">
      <h4 class="cohort-axis-group-title">${escapeHtml(g.axis.axisGroup || g.axis.title)}</h4>
      <ul class="research-list cohort-axis-group-list">${g.items.map((c) => `<li>${escapeHtml(clinicalCohortBullet(c))}</li>`).join("")}</ul>
    </div>`
    )
    .join("");

  const lhBlock = lhFshNote
    ? `<p class="lab-lookup-patient-note cohort-lh-note">${escapeHtml(lhFshNote)}</p>`
    : "";

  return `<details class="research-details research-details--cohort-raw">
    <summary>Layer 3 — Raw cohort comparison (by clinical axis)</summary>
    <div class="research-details-body cohort-axis-groups">
      <p class="muted">Per-field distance to PCOS-labeled vs non–PCOS-labeled <em>means</em> in the published table (n=${PCOS_COHORT.n}). Use with examination and Rotterdam criteria.</p>
      ${body}
      ${lhBlock}
    </div>
  </details>`;
}

function renderPhenotypeResult(result) {
  if (result.status === "insufficient") {
    return `<div class="phenotype-result-card phenotype-result-card--muted">
      <h3>Add more parameters together</h3>
      <p>PCOS is heterogeneous — a <strong>single</strong> lab value is weak decision support. Enter at least <strong>${result.minFields}</strong> fields (e.g. cycle pattern + androgen signs + BMI or AMH) for multi-parameter cohort contextualization.</p>
      <p class="muted">You provided ${result.filled} measure${result.filled === 1 ? "" : "s"}.</p>
    </div>`;
  }

  let headline = "";
  let body = "";

  if (result.status === "weak_overlap") {
    headline = "Limited overlap with dominant PCOS phenotype clusters";
    body =
      "<p>Entered values, taken together, do not align strongly with one PCOS-enriched pattern in this supplementary cohort. That does <strong>not</strong> rule out PCOS clinically — use Rotterdam criteria, imaging, and full hormone panel.</p>";
  } else if (result.status === "multimodal") {
    const names = result.strongAxes.map((a) => a.title.toLowerCase()).join(", ");
    headline = "Overlapping PCOS-enriched phenotype patterns";
    body = `<p>Your combination aligns with <strong>several</strong> cohort-enriched clusters at once (${escapeHtml(names)}) — consistent with real PCOS heterogeneity. Use Rotterdam criteria and full workup; no single pattern is required.</p>`;
  } else if (result.status === "mixed") {
    headline = "Mixed phenotype / insufficient overlap with one dominant pattern";
    body = `<p>Signals pull in different directions in this cohort (e.g. reproductive vs metabolic vs hyperandrogenic). This is common in real PCOS heterogeneity — integrate with examination, ultrasound, and differential (thyroid, hyperprolactinemia, NCCAH, endometriosis).</p>
      <p class="muted">Strongest partial pattern: <em>${escapeHtml(result.top?.title || "—")}</em> and <em>${escapeHtml(result.second?.title || "—")}</em>.</p>`;
  } else if (result.status === "away_from_patterns") {
    headline = "Overall pattern: away from PCOS-labeled averages on entered fields";
    body =
      "<p>On the measures you entered, this combination sits closer to non–PCOS-labeled averages in the dataset. Clinical PCOS may still apply — cohort labels are not gold standard diagnosis.</p>";
  } else {
    headline = result.top.title;
    body = `<p class="phenotype-headline-lead">${escapeHtml(result.top.headline)}</p>
      <p class="muted">This is <strong>not</strong> a diagnosis — cross-check Rotterdam criteria (oligo-anovulation, hyperandrogenism, polycystic ovaries), ultrasound, and metabolic screening.</p>`;
  }

  const axisBars = result.axisScores
    .filter((a) => a.weight > 0)
    .map((a) => {
      const pct = Math.round(((a.score + 1) / 2) * 100);
      const label =
        a.score > 0.25
          ? "supports PCOS-enriched pattern"
          : a.score < -0.25
            ? "does not support PCOS-enriched pattern"
            : "neutral / mixed";
      return `<li class="phenotype-axis-row">
        <span class="phenotype-axis-name">${escapeHtml(a.title)}</span>
        <span class="phenotype-axis-bar" style="--pct:${pct}%" aria-hidden="true"></span>
        <span class="phenotype-axis-label muted">${label}</span>
      </li>`;
    })
    .join("");

  return `<div class="readout-layer readout-layer--clinical phenotype-result-card">
    <p class="readout-layer-tag">Layer 2 — Clinical phenotype framing</p>
    <p class="phenotype-result-eyebrow">Phenotype-style readout — not a diagnosis</p>
    <h3>${escapeHtml(headline)}</h3>
    ${body}
    <p class="phenotype-crosscheck muted">Cross-check together — symptoms, cycles, androgen signs, imaging, metabolic screening, and Rotterdam criteria.</p>
    <h4 class="research-mini-label">Phenotype balance (reproductive · hyperandrogenic · metabolic)</h4>
    <ul class="phenotype-axis-list">${axisBars}</ul>
    ${renderAxisGroupedCohortComparison(result.contributions, result.lhFshNote)}
    <div class="phenotype-disclaimer callout">
      <p><strong>Not a diagnosis.</strong> Heterogeneous PCOS phenotypes in literature — axis overlap with the published cohort (n=${PCOS_COHORT.n}), not individual disease probability.</p>
    </div>
  </div>`;
}

export function renderPhenotypeContextSection() {
  return `<div class="phenotype-panel" id="phenotype-panel">
    <p class="phenotype-panel-intro muted">
      PCOS is a <strong>heterogeneous syndrome</strong>. Enter several parameters for <strong>multi-parameter cohort contextualization</strong> — three readout layers: clinical phenotype framing (primary), statistical overlap (in-cohort logistic), then raw cohort comparison by axis. Not a diagnosis.
    </p>
    <div class="phenotype-layout">
      <form class="phenotype-form" id="phenotype-form" onsubmit="return false;">
        <fieldset class="phenotype-fieldset">
          <legend>Hormones &amp; anthropometrics</legend>
          <div class="phenotype-form-grid">
            <label>AMH (ng/mL)<input type="number" step="any" name="amh" placeholder="Optional" /></label>
            <label>BMI<input type="number" step="any" name="bmi" placeholder="Optional" /></label>
            <label>LH (mIU/mL)<input type="number" step="any" name="lh" placeholder="Optional" /></label>
            <label>FSH (mIU/mL)<input type="number" step="any" name="fsh" placeholder="Optional" /></label>
            <label>Antral follicles (R)<input type="number" step="any" name="follicleR" placeholder="Optional" /></label>
          </div>
        </fieldset>
        <fieldset class="phenotype-fieldset">
          <legend>Cycle &amp; androgen signs</legend>
          <div class="phenotype-form-grid">
            <label>Menstrual pattern
              <select name="cycle">
                <option value="">—</option>
                <option value="irregular">Irregular / oligo-anovulation</option>
                <option value="regular">Regular</option>
              </select>
            </label>
            <label>Hirsutism / hair growth
              <select name="hirsutism">
                <option value="">—</option>
                <option value="yes">Yes</option>
                <option value="no">No</option>
              </select>
            </label>
            <label>Acne
              <select name="acne">
                <option value="">—</option>
                <option value="yes">Yes</option>
                <option value="no">No</option>
              </select>
            </label>
            <label>Reported weight gain
              <select name="weightGain">
                <option value="">—</option>
                <option value="yes">Yes</option>
                <option value="no">No</option>
              </select>
            </label>
            <label>Skin darkening (acanthosis)
              <select name="skinDarkening">
                <option value="">—</option>
                <option value="yes">Yes</option>
                <option value="no">No</option>
              </select>
            </label>
            <label>Hair thinning / loss
              <select name="hairLoss">
                <option value="">—</option>
                <option value="yes">Yes</option>
                <option value="no">No</option>
              </select>
            </label>
          </div>
        </fieldset>
        <details class="phenotype-fieldset-details" open>
          <summary>More measures (optional) — imaging, age, metabolic labs</summary>
          <div class="phenotype-form-grid phenotype-form-grid--optional">
            <label>Age (years)<input type="number" step="any" name="age" placeholder="Optional" /></label>
            <label>Antral follicles (L)<input type="number" step="any" name="follicleL" placeholder="Optional" /></label>
            <label>Cycle length (days)<input type="number" step="any" name="cycleLength" placeholder="Optional" /></label>
            <label>TSH (mIU/L)<input type="number" step="any" name="tsh" placeholder="Optional" /></label>
            <label>Random glucose (mg/dL)<input type="number" step="any" name="rbs" placeholder="Optional" /></label>
            <label>Waist (inch)<input type="number" step="any" name="waist" placeholder="Optional" /></label>
          </div>
        </details>
        <div class="phenotype-add-measure">
          <p class="research-mini-label">Add any cohort measure</p>
          <div id="phenotype-dynamic-rows" class="phenotype-dynamic-rows"></div>
          <button type="button" class="btn btn-ghost btn-sm" id="phenotype-add-row">+ Add measure</button>
        </div>
        <button type="button" class="btn btn-primary" id="phenotype-submit-btn">Contextualize profile</button>
        <p class="muted phenotype-form-hint">Include cycle + androgen sign + lab or BMI when possible. Same inputs feed all three layers.</p>
      </form>
      <aside class="phenotype-result-col" aria-live="polite">
        <h3 class="lab-lookup-result-heading">Combined cohort readout</h3>
        <p class="readout-hierarchy muted">
          <strong>Layer 2</strong> clinical phenotype · <strong>Layer 1</strong> statistical overlap · <strong>Layer 3</strong> raw cohort means (collapsed)
        </p>
        <p id="phenotype-placeholder" class="lab-lookup-placeholder muted">
          Enter several parameters, then <strong>Contextualize profile</strong>. Primary readout is phenotype framing — not a PCOS probability score.
        </p>
        <div id="phenotype-result"></div>
        <div id="joint-result"></div>
      </aside>
    </div>
    <details class="research-details research-details--single-measure">
      <summary>Single measure lookup (advanced)</summary>
      <div class="research-details-body" id="single-measure-lookup-slot"></div>
    </details>
  </div>`;
}

const DYNAMIC_LAB_OPTIONS = LAB_COHORT_REFERENCE.filter((l) => l.kind === "numeric" || l.kind === "binary");

function buildValuesMap(raw, dynamicRoot) {
  const values = {
    amh_ng_ml: raw.amh?.trim() || null,
    bmi: raw.bmi?.trim() || null,
    lh_miu_ml: raw.lh?.trim() || null,
    fsh_miu_ml: raw.fsh?.trim() || null,
    cycle_r_i: resolveCycleValue(raw.cycle),
    hair_growth_y_n: raw.hirsutism || null,
    pimples_y_n: raw.acne || null,
    weight_gain_y_n: raw.weightGain || null,
    follicle_no_r: raw.follicleR?.trim() || null,
    follicle_no_l: raw.follicleL?.trim() || null,
    age_yrs: raw.age?.trim() || null,
    cycle_length_days: raw.cycleLength?.trim() || null,
    tsh_miu_l: raw.tsh?.trim() || null,
    rbs_mg_dl: raw.rbs?.trim() || null,
    waist_inch: raw.waist?.trim() || null,
    skin_darkening_y_n: raw.skinDarkening || null,
    hair_loss_y_n: raw.hairLoss || null,
  };
  if (dynamicRoot) {
    dynamicRoot.querySelectorAll(".phenotype-dynamic-row").forEach((row) => {
      const id = row.querySelector(".phenotype-dyn-lab")?.value;
      const valEl = row.querySelector(".phenotype-dyn-val");
      if (!id || !valEl) return;
      const val = valEl.value;
      if (val === "" || val === "unknown") return;
      values[id] = val;
    });
  }
  return values;
}

function renderDynamicLabOptions(selectedId = "") {
  return DYNAMIC_LAB_OPTIONS.map((l) => {
    const sel = l.id === selectedId ? " selected" : "";
    return `<option value="${escapeHtml(l.id)}"${sel}>${escapeHtml(l.feature)}</option>`;
  }).join("");
}

function createDynamicRow(selectedId = "") {
  const lab = selectedId ? findLab(selectedId) : null;
  const isBinary = lab?.kind === "binary";
  const valueField = isBinary
    ? `<select class="phenotype-dyn-val">
        <option value="">—</option>
        <option value="yes">Yes</option>
        <option value="no">No</option>
      </select>`
    : `<input type="number" step="any" class="phenotype-dyn-val" placeholder="Value" />`;
  return `<div class="phenotype-dynamic-row">
    <select class="phenotype-dyn-lab" aria-label="Measure">
      <option value="">— Measure —</option>
      ${renderDynamicLabOptions(selectedId)}
    </select>
    ${valueField}
    <button type="button" class="btn btn-ghost btn-sm phenotype-dyn-remove" title="Remove">×</button>
  </div>`;
}

function readPhenotypeForm(form) {
  const g = (name) => form.elements.namedItem(name)?.value ?? "";
  return {
    amh: g("amh"),
    bmi: g("bmi"),
    lh: g("lh"),
    fsh: g("fsh"),
    cycle: g("cycle"),
    hirsutism: g("hirsutism"),
    acne: g("acne"),
    weightGain: g("weightGain"),
    follicleR: g("follicleR"),
    follicleL: g("follicleL"),
    age: g("age"),
    cycleLength: g("cycleLength"),
    tsh: g("tsh"),
    rbs: g("rbs"),
    waist: g("waist"),
    skinDarkening: g("skinDarkening"),
    hairLoss: g("hairLoss"),
  };
}

export function initPhenotypeContext(renderSingleMeasureLookup) {
  const form = document.getElementById("phenotype-form");
  const btn = document.getElementById("phenotype-submit-btn");
  const resultEl = document.getElementById("phenotype-result");
  const jointEl = document.getElementById("joint-result");
  const placeholder = document.getElementById("phenotype-placeholder");
  const slot = document.getElementById("single-measure-lookup-slot");
  const dynamicRoot = document.getElementById("phenotype-dynamic-rows");
  const addRowBtn = document.getElementById("phenotype-add-row");

  if (slot && typeof renderSingleMeasureLookup === "function") {
    slot.innerHTML = renderSingleMeasureLookup();
  }

  if (dynamicRoot && addRowBtn) {
    addRowBtn.addEventListener("click", () => {
      dynamicRoot.insertAdjacentHTML("beforeend", createDynamicRow());
    });
    dynamicRoot.addEventListener("click", (e) => {
      if (e.target.classList.contains("phenotype-dyn-remove")) {
        e.target.closest(".phenotype-dynamic-row")?.remove();
      }
    });
    dynamicRoot.addEventListener("change", (e) => {
      if (!e.target.classList.contains("phenotype-dyn-lab")) return;
      const row = e.target.closest(".phenotype-dynamic-row");
      if (!row) return;
      row.outerHTML = createDynamicRow(e.target.value);
    });
  }

  if (!form || !btn || !resultEl) return;

  const jointModelPromise = loadJointModel().catch(() => null);

  const run = async () => {
    const raw = readPhenotypeForm(form);
    const result = computePhenotypeContext(raw, dynamicRoot);
    resultEl.innerHTML = renderPhenotypeResult(result);
    if (placeholder) placeholder.classList.add("hidden");

    if (!jointEl) return;
    jointEl.innerHTML = `<p class="muted joint-score-loading">Loading joint cohort model…</p>`;
    const model = await jointModelPromise;
    if (!model) {
      jointEl.innerHTML = `<p class="muted">Joint model file missing. From repo root run: <code>python3 backup/scripts/export_pcos_joint_model.py</code> or <code>python3 backup/scripts/sync_portal_research.py</code> (with dataset).</p>`;
      return;
    }
    const values = buildValuesMap(raw, dynamicRoot);
    const score = scoreJointModel(model, values);
    jointEl.innerHTML = renderJointScoreBlock(model, score);
  };

  btn.addEventListener("click", () => {
    void run();
  });
  form.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && e.target.tagName !== "TEXTAREA") {
      e.preventDefault();
      void run();
    }
  });
}

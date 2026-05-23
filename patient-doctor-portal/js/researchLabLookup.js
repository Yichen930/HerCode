import {
  LAB_COHORT_REFERENCE,
  PCOS_COHORT,
  PCOS_TOP_CORRELATIONS,
  PCOS_MODEL_COEF_POSITIVE,
} from "./researchData.js";

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatPValue(p) {
  if (p == null || Number.isNaN(p)) return "—";
  if (typeof p === "string") return p;
  if (p < 0.001) return p < 1e-6 ? "<1e-6" : p.toExponential(1);
  return String(p);
}

function findLabById(id) {
  return LAB_COHORT_REFERENCE.find((l) => l.id === id);
}

function numericLabByInputName(fragment) {
  return LAB_COHORT_REFERENCE.find(
    (l) => l.kind === "numeric" && l.searchTerms?.some((t) => t.includes(fragment))
  );
}

function getMeasureMeta(lab) {
  const f = (lab?.feature || "").toLowerCase();
  const id = lab?.id || "";
  if (id === "age_yrs" || /\bage\b/.test(f)) {
    return {
      type: "age",
      isLab: false,
      intro:
        "Ages of women in the PCOS tabular cohort (years). This is a demographic comparison, not a laboratory test.",
      valueLabel: "Patient age (years)",
      valuePlaceholder: "e.g. 32",
      cohortNoteSeparates:
        "Average age differed between groups in this cohort — you can compare your patient’s age to the means below.",
      cohortNoteNotSeparates: "Average age was similar between groups in this cohort.",
      foot: "Cohort means describe who was enrolled in the study, not whether an individual’s age is “normal” for care.",
    };
  }
  if (id === "bmi" || f === "bmi") {
    return {
      type: "bmi",
      isLab: false,
      intro:
        "Body mass index in the cohort. Use clinical BMI categories with cycle pattern, hormones, and metabolic risk.",
      valueLabel: "Patient BMI (kg/m²)",
      valuePlaceholder: "e.g. 26",
      cohortNoteSeparates:
        "Average BMI differed between groups — compare your patient’s BMI to the means below.",
      cohortNoteNotSeparates: "Average BMI was similar between groups in this cohort.",
      foot: "Use standard BMI categories and phenotype—not cohort proximity alone.",
    };
  }
  if (
    /follicle|cycle length|regularity|waist|weight|height|blood pressure|heart rate|hirsutism|acne|hair loss|skin darkening|gain weight|pulse|fast food|exercise|sleep/i.test(
      f
    )
  ) {
    return {
      type: "clinical",
      isLab: false,
      intro: "Clinical, imaging, or history field from the cohort — not a single lab analyte.",
      valueLabel: "Patient value (optional)",
      valuePlaceholder: "",
      cohortNoteSeparates:
        "Groups differed on average in this cohort — optional comparison to means below.",
      cohortNoteNotSeparates:
        "Groups did not differ significantly — table means are descriptive only.",
      foot: "Interpret with examination, imaging, and guidelines—not cohort labels alone.",
    };
  }
  return {
    type: "lab",
    isLab: true,
    intro: `Main PCOS cohort (n=${PCOS_COHORT.n}) — population reference only.`,
    valueLabel: "Patient value (optional)",
    valuePlaceholder: "Lab result — most useful when groups differ in the cohort",
    cohortNoteSeparates:
      "Groups differ on average in this cohort — optional patient value can be compared to group means below.",
    cohortNoteNotSeparates:
      "Groups did <strong>not</strong> differ significantly on this measure in the cohort — table means are descriptive only.",
    foot: "Not a substitute for your laboratory reference ranges or clinical judgment.",
  };
}

function buildClinicalMeaningBlock(lab) {
  const separates = cohortSeparatesGroups(lab);
  const pText = formatPValue(lab.pValue);
  if (!separates) {
    return `<div class="lab-lookup-clinical-card lab-lookup-clinical-card--muted">
      <h4>Does this measure separate PCOS in the cohort?</h4>
      <p><strong>Not meaningfully.</strong> Group averages were similar (p=${pText}). Use it for clinical interpretation (reference ranges, symptoms)—not to argue “closer to PCOS mean.”</p>
    </div>`;
  }
  return `<div class="lab-lookup-clinical-card">
    <h4>Does this measure separate PCOS in the cohort?</h4>
    <p><strong>Yes — statistically associated</strong> with the PCOS label here (p=${pText}). That supports it as a <em>population pattern</em> to discuss with phenotype—it is still not a diagnosis by itself.</p>
  </div>`;
}

function buildNextStepsBlock(lab) {
  const id = lab.id || "";
  const steps = [];
  if (id === "amh_ng_ml") {
    steps.push("Place AMH in context of age and antral follicle count on ultrasound.");
    steps.push("If AMH is high with oligo-anovulation or hyperandrogenism, align with Rotterdam criteria and consider metabolic screening.");
    steps.push("Discuss fertility planning early when AMH is low for age.");
  } else if (id === "bmi") {
    steps.push("Use BMI category (overweight/obesity) with waist circumference and metabolic labs.");
    steps.push("Discuss lifestyle, insulin resistance, and cardiovascular risk—common PCOS co-morbidity themes.");
  } else if (id === "age_yrs") {
    steps.push("Interpret age against fertility goals and ovarian reserve markers—not against cohort means alone.");
    steps.push("Older presentation may shift toward diminished ovarian reserve workup if clinically indicated.");
  } else if (/follicle/i.test(lab.feature || "")) {
    steps.push("Correlate antral follicle counts with AMH and cycle pattern.");
    steps.push("Very high counts support PCOS phenotype discussion; imaging protocol and operator matter.");
  } else if (/tsh/i.test(lab.feature || "")) {
    steps.push("Interpret with laboratory reference interval and thyroid symptoms.");
    steps.push("Treat thyroid disease per guidelines; do not attribute cycle issues to PCOS without ruling out thyroid dysfunction.");
  } else if (/lh|fsh/i.test(lab.feature || "") || id === "fsh_lh") {
    steps.push("Interpret LH/FSH with cycle timing (early follicular) when possible.");
    steps.push("Elevated LH or LH/FSH pattern supports hyperandrogenic anovulation discussion alongside exam and AMH.");
  } else if (cohortSeparatesGroups(lab)) {
    steps.push("Compare to your laboratory reference interval first, then use cohort direction as secondary context.");
    steps.push("Integrate with Rotterdam criteria, metabolic screening, and patient priorities (fertility, cycles, hyperandrogenism).");
  } else {
    steps.push("Prioritize standard clinical reference ranges and examination findings.");
    steps.push("Use cohort means only as weak background when groups did not separate in this dataset.");
  }
  steps.push("Document shared decision-making—this tool does not replace judgment or local guidelines.");
  return `<div class="lab-lookup-next-steps">
    <h4>Suggested clinical framing</h4>
    <ul class="research-list">${steps.map((s) => `<li>${escapeHtml(s)}</li>`).join("")}</ul>
  </div>`;
}

function cohortSeparatesGroups(lab) {
  const p = lab.pValue;
  if (typeof p === "number" && Number.isFinite(p) && p < 0.05) return true;
  const m0 = Number(lab.meanNonPcos);
  const m1 = Number(lab.meanPcos);
  if (!Number.isFinite(m0) || !Number.isFinite(m1)) return false;
  const ref = Math.max(Math.abs(m0), Math.abs(m1), 1e-6);
  return Math.abs(m0 - m1) / ref >= 0.1;
}

/**
 * Patient-value context when it adds clinical meaning. Returns null to show nothing extra.
 * @returns {{ message: string, variant: "info" | "neutral" } | null}
 */
function compareValueToCohort(value, lab) {
  const v = Number(value);
  const m0 = Number(lab.meanNonPcos);
  const m1 = Number(lab.meanPcos);
  if (!Number.isFinite(v) || !Number.isFinite(m0) || !Number.isFinite(m1)) return null;

  const meta = getMeasureMeta(lab);
  const separates = cohortSeparatesGroups(lab);
  const pText = formatPValue(lab.pValue);
  const lo = Math.min(m0, m1);
  const hi = Math.max(m0, m1);
  const higherInPcos = m1 > m0;

  if (!separates) {
    const tail = meta.isLab
      ? "use the laboratory reference interval and clinical context—not which cohort mean is nearer."
      : "interpret with clinical context—not which cohort mean is nearer.";
    return {
      variant: "neutral",
      message: `This measure did not separate PCOS-labeled from non-PCOS women in the cohort (p=${pText}; means about ${m0} vs ${m1}). For your patient (${v}), ${tail}`,
    };
  }

  if (meta.isLab) {
    const ref = Math.max(Math.abs(m0), Math.abs(m1), 1e-6);
    const minD = Math.min(Math.abs(v - m0), Math.abs(v - m1));
    if (minD > 0.6 * ref) return null;
  }

  if (meta.type === "age") {
    if (v > hi) {
      return {
        variant: "info",
        message: `At ${v} years, this patient is older than the averages in this study (non-PCOS ~${m0}, PCOS-labeled ~${m1}). In the cohort, PCOS-labeled women were younger on average (p=${pText}). PCOS is seen across reproductive ages—use presentation, fertility goals, and workup, not study means alone.`,
      };
    }
    if (v < lo) {
      return {
        variant: "info",
        message: `At ${v} years, this patient is younger than the averages in this study (non-PCOS ~${m0}, PCOS-labeled ~${m1}). In the cohort, PCOS-labeled women were younger on average (p=${pText}). Younger age alone does not confirm PCOS—integrate hormones, cycle, and imaging.`,
      };
    }
  }

  const dPcos = Math.abs(v - m1);
  const dNon = Math.abs(v - m0);

  if (dPcos < dNon * 0.85) {
    const dir = higherInPcos ? "higher" : "lower";
    return {
      variant: "info",
      message: `In this cohort, ${lab.feature} was ${dir} in the PCOS-labeled group (mean ${m1} vs ${m0}, p=${pText}). Your value (${v}) is closer to the PCOS-labeled average—context only, not a diagnosis.`,
    };
  }
  if (dNon < dPcos * 0.85) {
    const dir = higherInPcos ? "lower" : "higher";
    return {
      variant: "info",
      message: `In this cohort, ${lab.feature} was ${dir} in the PCOS-labeled group (mean ${m1} vs ${m0}, p=${pText}). Your value (${v}) is closer to the non–PCOS-labeled average—context only, not a diagnosis.`,
    };
  }

  if (v >= lo && v <= hi) {
    const tail = meta.isLab
      ? "Use the lab reference interval and phenotype, not group labels alone."
      : "Use full clinical assessment, not group labels alone.";
    return {
      variant: "info",
      message: `Your value (${v}) falls between the two cohort means (${m0} vs ${m1}, p=${pText}). ${tail}`,
    };
  }

  if (v > hi) {
    if (meta.type === "bmi") {
      return {
        variant: "info",
        message: `BMI ${v} is above both cohort means here (${m0} vs ${m1}). PCOS-labeled participants averaged higher BMI in this dataset (p=${pText}). Consider metabolic risk and Rotterdam criteria alongside WHO BMI categories.`,
      };
    }
    const dirWord = higherInPcos ? "higher" : "lower";
    const tail = meta.isLab
      ? "Weigh with the laboratory reference interval and clinical findings."
      : "Weigh with examination, imaging, and the full phenotype.";
    return {
      variant: "info",
      message: `Your value (${v}) is above both cohort means (${m0} vs ${m1}). The PCOS-labeled group tended ${dirWord} on average (p=${pText}). ${tail}`,
    };
  }

  const dirWord = higherInPcos ? "higher" : "lower";
  const tail = meta.isLab
    ? "Weigh with the laboratory reference interval and clinical findings."
    : "Weigh with examination, imaging, and the full phenotype.";
  return {
    variant: "info",
    message: `Your value (${v}) is below both cohort means (${m0} vs ${m1}). The PCOS-labeled group tended ${dirWord} on average (p=${pText}). ${tail}`,
  };
}

function buildCorrelationNote(feature) {
  const row = PCOS_TOP_CORRELATIONS.find((r) => r.feature === feature);
  if (!row) return "";
  const strength =
    Math.abs(row.corr) >= 0.4 ? "strong" : Math.abs(row.corr) >= 0.2 ? "moderate" : "weak";
  return `Correlation with PCOS label (n=${PCOS_COHORT.n}): ${row.corr} (${strength}).`;
}

function buildModelNote(feature) {
  const row = PCOS_MODEL_COEF_POSITIVE.find((r) => r.feature === feature);
  if (!row) return "";
  return `Positive logistic-model coefficient in cohort (educational): ${row.coef}.`;
}

function buildDerivedResult(lh, fsh) {
  const lhN = Number(lh);
  const fshN = Number(fsh);
  if (!Number.isFinite(lhN) || !Number.isFinite(fshN) || fshN <= 0) {
    return `<p class="callout warn">Enter valid LH and FSH (FSH &gt; 0).</p>`;
  }
  const ratio = lhN / fshN;
  const lhLab = numericLabByInputName("LH(mIU/mL)");
  const fshLab = numericLabByInputName("FSH(mIU/mL)");
  let html = `<div class="lab-lookup-result-card">
    <h3>LH/FSH ratio</h3>
    <p class="lab-lookup-highlight"><strong>${ratio.toFixed(2)}</strong></p>
    <p class="muted">Educational only. Ratio &gt;2 is often discussed in PCOS workups—not diagnostic alone.</p>`;
  if (ratio > 2) {
    html += `<p class="lab-lookup-flag">Above 2 — discuss with hyperandrogenism signs and cycle pattern.</p>`;
  }
  if (lhLab && fshLab) {
    html += `<ul class="research-list">
      <li>LH means: non-PCOS ${lhLab.meanNonPcos}, PCOS-labeled ${lhLab.meanPcos}</li>
      <li>FSH means: non-PCOS ${fshLab.meanNonPcos}, PCOS-labeled ${fshLab.meanPcos}</li>
    </ul>`;
  }
  return `${html}</div>`;
}
function buildNumericResult(lab, valueRaw) {
  const meta = getMeasureMeta(lab);
  let html = `<div class="lab-lookup-result-card">
    <h3>${escapeHtml(lab.feature)}</h3>
    <p class="muted">${escapeHtml(meta.intro)}</p>
    <div class="research-table-wrap"><table class="research-table research-table--compact">
      <thead><tr><th>Group</th><th>Cohort mean</th></tr></thead>
      <tbody>
        <tr><th scope="row">Not PCOS-labeled</th><td>${lab.meanNonPcos}</td></tr>
        <tr><th scope="row">PCOS-labeled</th><td>${lab.meanPcos}</td></tr>
      </tbody>
    </table></div>
    <p><strong>Between-group p-value:</strong> ${formatPValue(lab.pValue)}</p>
    <p class="muted lab-lookup-cohort-note">${
      cohortSeparatesGroups(lab) ? meta.cohortNoteSeparates : meta.cohortNoteNotSeparates
    }</p>`;
  html += buildClinicalMeaningBlock(lab);
  if (lab.endoCompare) {
    html += `<p class="research-mini-label">PCOS vs endometriosis comparison</p>
      <p>${escapeHtml(lab.endoCompare.field)} — PCOS ~${lab.endoCompare.pcos}, endo ~${lab.endoCompare.endo} (see section below).</p>`;
  }
  if (valueRaw !== "" && valueRaw != null) {
    const cmp = compareValueToCohort(valueRaw, lab);
    if (cmp) {
      const flagClass =
        cmp.variant === "neutral" ? "lab-lookup-patient-note" : "lab-lookup-flag";
      html += `<p class="${flagClass}"><strong>Your patient:</strong> ${escapeHtml(cmp.message)}</p>`;
    }
  }
  html += buildNextStepsBlock(lab);
  const corrNote = buildCorrelationNote(lab.feature);
  const modelNote = buildModelNote(lab.feature);
  if (corrNote || modelNote) {
    html += `<details class="research-details research-details--inline">
      <summary>Cohort statistics (optional)</summary>
      ${corrNote ? `<p>${escapeHtml(corrNote)}</p>` : ""}
      ${modelNote ? `<p>${escapeHtml(modelNote)}</p>` : ""}
    </details>`;
  }
  if (lab.hint) {
    html += `<p class="research-mini-label">Cohort note</p><p>${escapeHtml(lab.hint)}</p>`;
  }
  html += `<p class="muted lab-lookup-foot">${escapeHtml(meta.foot)}</p></div>`;
  return html;
}


function buildBinaryResult(lab, answer) {
  let html = `<div class="lab-lookup-result-card">
    <h3>${escapeHtml(lab.feature)}</h3>
    <p class="muted">Sign in PCOS cohort (n=${PCOS_COHORT.n}).</p>
    <p><strong>Association with PCOS label:</strong> p=${formatPValue(lab.pValue)}, Cramér's V=${lab.cramersV}</p>`;
  const corrNote = buildCorrelationNote(lab.feature);
  if (corrNote) html += `<p>${escapeHtml(corrNote)}</p>`;
  if (answer === "yes") {
    html += `<p class="lab-lookup-flag">Reported <strong>yes</strong> — more common among PCOS-labeled participants in this cohort.</p>`;
  } else if (answer === "no") {
    html += `<p>Reported <strong>no</strong> — less common in PCOS-labeled group in chi-square analysis.</p>`;
  }
  if (lab.hint) html += `<p>${escapeHtml(lab.hint)}</p>`;
  html += `</div>`;
  return html;
}

function lookupLab(labId, valueRaw, binaryAnswer) {
  const lab = findLabById(labId);
  if (!lab) return `<p class="callout warn">Select a test from the list.</p>`;
  if (lab.kind === "derived") {
    const lh = document.getElementById("lab-lh-input")?.value;
    const fsh = document.getElementById("lab-fsh-input")?.value;
    return buildDerivedResult(lh, fsh);
  }
  if (lab.kind === "binary") return buildBinaryResult(lab, binaryAnswer);
  return buildNumericResult(lab, valueRaw);
}

export function renderLabLookupSection() {
  const options = LAB_COHORT_REFERENCE.map(
    (l) => `<option value="${escapeHtml(l.id)}">${escapeHtml(l.feature)}</option>`
  ).join("");
  return `<div class="lab-lookup-panel">
    <p class="muted lab-lookup-advanced-note">One measure at a time — for clinical reasoning, prefer <strong>multi-parameter contextualization</strong> above.</p>
    <div class="lab-lookup-layout">
      <div class="lab-lookup-form-col">
    <div class="lab-lookup-form">
      <label class="lab-lookup-label" for="lab-test-select">Test or measure</label>
      <select id="lab-test-select" class="lab-lookup-select" aria-label="Select lab test">
        <option value="">— Select —</option>
        ${options}
      </select>
      <label class="lab-lookup-label" for="lab-test-search">Quick filter</label>
      <input type="search" id="lab-test-search" class="lab-lookup-input" placeholder="e.g. AMH, LH, BMI…" autocomplete="off" />
      <div id="lab-value-fields">
            <label class="lab-lookup-label" for="lab-test-value">Patient value (optional)</label>
            <input type="number" step="any" id="lab-test-value" class="lab-lookup-input" placeholder="For context — best when groups differ in cohort" />
      </div>
      <div id="lab-binary-field" class="hidden">
        <span class="lab-lookup-label">Present?</span>
        <label class="lab-lookup-radio"><input type="radio" name="lab-binary" value="yes" /> Yes</label>
        <label class="lab-lookup-radio"><input type="radio" name="lab-binary" value="no" /> No</label>
      </div>
      <div id="lab-derived-fields" class="hidden">
        <label class="lab-lookup-label" for="lab-lh-input">LH (mIU/mL)</label>
        <input type="number" step="any" id="lab-lh-input" class="lab-lookup-input" />
        <label class="lab-lookup-label" for="lab-fsh-input">FSH (mIU/mL)</label>
        <input type="number" step="any" id="lab-fsh-input" class="lab-lookup-input" />
      </div>
      <button type="button" class="btn btn-primary" id="lab-lookup-btn">Show cohort context</button>
    </div>
      </div>
      <aside class="lab-lookup-result-col" aria-labelledby="lab-result-heading">
        <h3 id="lab-result-heading" class="lab-lookup-result-heading">Cohort comparison</h3>
        <p id="lab-lookup-placeholder" class="lab-lookup-placeholder muted">Results appear here after you choose a test and click Show cohort context.</p>
        <div id="lab-lookup-result" class="lab-lookup-result" aria-live="polite"></div>
      </aside>
    </div>
  </div>`;
}

function updateMeasureFormLabels(lab) {
  const meta = lab ? getMeasureMeta(lab) : null;
  const label = document.querySelector('label[for="lab-test-value"]');
  const input = document.getElementById("lab-test-value");
  if (label) label.textContent = meta?.valueLabel || "Patient value (optional)";
  if (input) input.placeholder = meta?.valuePlaceholder || "";
}

function updateLabFormFields(lab) {
  const valueFields = document.getElementById("lab-value-fields");
  const binaryField = document.getElementById("lab-binary-field");
  const derivedFields = document.getElementById("lab-derived-fields");
  if (!valueFields || !binaryField || !derivedFields) return;

  valueFields.classList.toggle("hidden", !lab || lab.kind !== "numeric");
  binaryField.classList.toggle("hidden", !lab || lab.kind !== "binary");
  derivedFields.classList.toggle("hidden", !lab || lab.kind !== "derived");
  updateMeasureFormLabels(lab);
}

function setLabResultPlaceholderVisible(show) {
  const placeholder = document.getElementById("lab-lookup-placeholder");
  if (placeholder) placeholder.classList.toggle("hidden", !show);
}

function runLabLookup() {
  const select = document.getElementById("lab-test-select");
  const result = document.getElementById("lab-lookup-result");
  if (!select || !result) return;

  const lab = findLabById(select.value);
  const valueRaw = document.getElementById("lab-test-value")?.value ?? "";
  const binaryEl = document.querySelector('input[name="lab-binary"]:checked');
  const binaryAnswer = binaryEl ? binaryEl.value : "";

  result.innerHTML = lookupLab(select.value, valueRaw, binaryAnswer);
  setLabResultPlaceholderVisible(!result.innerHTML.trim());
}

export function initLabLookup() {
  const select = document.getElementById("lab-test-select");
  const search = document.getElementById("lab-test-search");
  const btn = document.getElementById("lab-lookup-btn");
  if (!select || !btn) return;

  const allOptions = Array.from(select.options).map((o) => ({
    value: o.value,
    text: o.textContent,
  }));

  select.addEventListener("change", () => {
    updateLabFormFields(findLabById(select.value));
    const result = document.getElementById("lab-lookup-result");
    if (result) result.innerHTML = "";
    setLabResultPlaceholderVisible(true);
  });

  if (search) {
    search.addEventListener("input", () => {
      const q = search.value.trim().toLowerCase();
      const current = select.value;
      select.innerHTML = '<option value="">— Select —</option>';
      for (const opt of allOptions) {
        if (!opt.value) continue;
        if (!q || opt.text.toLowerCase().includes(q)) {
          const el = document.createElement("option");
          el.value = opt.value;
          el.textContent = opt.text;
          select.appendChild(el);
        }
      }
      if (current && [...select.options].some((o) => o.value === current)) {
        select.value = current;
      }
    });
  }

  btn.addEventListener("click", runLabLookup);

  select.addEventListener("keydown", (e) => {
    if (e.key === "Enter") runLabLookup();
  });
}

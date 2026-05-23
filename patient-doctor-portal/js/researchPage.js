import {
  PCOS_COHORT,
  PCOS_TOP_CORRELATIONS,
  PCOS_MODEL_COEF_POSITIVE,
  PCOS_VS_ENDO,
  PCOS_VS_ENDO_DIFF_TESTS,
  DIFFERENTIATION_RULES,
  SCRNA_INVENTORY,
  SCRNA_LIBRARY_INVENTORY,
  SCRNA_DEEP_SCOPE,
  RESEARCH_FIGURES,
  RESEARCH_DATA_SOURCES,
  CONDITION_EDUCATION,
  SYMPTOM_DIFFERENTIATION,
  LAB_COHORT_REFERENCE,
} from "./researchData.js";
import { renderPhenotypeContextSection } from "./researchPhenotypeContext.js";

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatPValue(p) {
  if (p == null || Number.isNaN(p)) return "—";
  if (p < 0.001) return p < 1e-6 ? "<1e-6" : p.toExponential(1);
  return p.toFixed(4);
}

function renderResearchToc() {
  const groups = [
    {
      label: "Patient vs cohort",
      links: [["research-lab", "Multi-parameter profile"]],
      primary: true,
    },
    {
      label: "Population patterns",
      links: [
        ["research-cohort", "PCOS cohort patterns"],
        ["research-compare", "PCOS vs endometriosis"],
      ],
    },
    {
      label: "Translational biology (optional)",
      links: [
        ["research-scrna", "Tissue insights"],
        ["research-scrna-deep", "Supporting figures"],
      ],
    },
    {
      label: "Reference",
      links: [
        ["research-scope", "Data scope"],
        ["research-sources", "Provenance"],
        ["research-education", "Education"],
      ],
    },
  ];
  return `<nav class="research-toc" aria-label="Reference sections">
    ${groups
      .map(
        (g) => `<div class="research-toc-group${g.primary ? " research-toc-group--primary" : ""}">
      <p class="research-toc-group-label">${escapeHtml(g.label)}</p>
      <div class="research-toc-group-links">
        ${g.links
          .map(
            ([id, label]) =>
              `<button type="button" class="research-toc-link${g.primary ? " research-toc-link--primary" : ""}" data-research-jump="${escapeHtml(id)}">${escapeHtml(label)}</button>`
          )
          .join("")}
      </div>
    </div>`
      )
      .join("")}
  </nav>`.replace(/<motion-placeholder><\/motion-placeholder>/g, "");
}

const RESEARCH_TOP_ID = "research-top";

export function scrollToResearchSection(sectionId) {
  const target = document.getElementById(sectionId);
  if (!target) return;
  const header = document.querySelector("header.app-header");
  const offset = (header?.getBoundingClientRect().height ?? 72) + 16;
  const top = target.getBoundingClientRect().top + window.scrollY - offset;
  window.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
}

/** In-page jumps only — hash links break the #/doctor/research SPA route. */
export function initResearchToc() {
  document.querySelectorAll("[data-research-jump]").forEach((btn) => {
    btn.addEventListener("click", () => {
      scrollToResearchSection(btn.getAttribute("data-research-jump"));
    });
  });
  document.querySelectorAll(".research-back-to-top").forEach((btn) => {
    btn.addEventListener("click", () => {
      scrollToResearchSection(RESEARCH_TOP_ID);
    });
  });
}

function renderBackToTop() {
  return `<p class="research-zone-foot">
    <button type="button" class="research-back-to-top">Back to top</button>
  </p>`;
}

function renderResearchZone(id, title, tone, bodyHtml, subtitle = "") {
  return `<section id="${escapeHtml(id)}" class="research-zone research-zone--${tone}">
    <header class="research-zone-head">
      <h2>${escapeHtml(title)}</h2>
      ${subtitle ? `<p class="research-zone-sub">${escapeHtml(subtitle)}</p>` : ""}
    </header>
    <div class="research-zone-body">${bodyHtml}${renderBackToTop()}</div>
  </section>`;
}

function renderResearchPart(eyebrow, subtitle, zonesHtml, partClass = "") {
  return `<div class="research-part${partClass ? ` ${escapeHtml(partClass)}` : ""}">
    <header class="research-part-head">
      <h2 class="research-part-title">${escapeHtml(eyebrow)}</h2>
      ${subtitle ? `<p class="research-part-sub muted">${escapeHtml(subtitle)}</p>` : ""}
    </header>
    <div class="research-part-zones">${zonesHtml}</div>
  </div>`;
}

function renderResearchScopeCompact() {
  return `<div class="research-quick-scope card" role="note">
    <p><strong>Population reference only.</strong> Numbers come from published supplementary cohorts — not from labs or cells of patients linked in this portal.</p>
    <button type="button" class="btn btn-ghost btn-sm research-quick-scope-jump" data-research-jump="research-scope">Read full data scope</button>
  </div>`;
}

function renderFeaturedLabZone() {
  const n = PCOS_COHORT.n;
  const labCount = LAB_COHORT_REFERENCE.length;
  return `<section id="research-lab" class="research-zone research-zone--lab-lookup research-zone--featured">
    <header class="research-zone-head">
      <span class="research-zone-eyebrow">Clinical workflow</span>
      <h2>Multi-parameter cohort contextualization</h2>
      <p class="research-zone-sub">PCOS is heterogeneous — enter cycle pattern, androgen signs, and labs <strong>together</strong> (n=${n} published cohort). Phenotype-style readout — <strong>not</strong> a diagnosis from a single AMH or BMI.</p>
      <ul class="research-workflow-prompts">
        <li><strong>Cross-check together</strong> — symptoms, cycles, androgen signs, ultrasound, hormone panel, metabolic markers.</li>
        <li><strong>Phenotype readout</strong> — which cohort pattern your combination resembles (or mixed / insufficient).</li>
        <li><strong>Single measure</strong> — optional advanced lookup (${labCount} mapped fields).</li>
      </ul>
    </header>
    <div class="research-zone-body">${renderPhenotypeContextSection()}${renderBackToTop()}</div>
  </section>`;
}

function renderMetricTable(rows) {
  return `<div class="research-table-wrap"><table class="research-table research-table--compact">
    <thead><tr><th>Metric</th><th>Value</th></tr></thead>
    <tbody>${rows
      .map(
        ([label, value]) =>
          `<tr><th scope="row">${escapeHtml(label)}</th><td>${escapeHtml(value)}</td></tr>`
      )
      .join("")}</tbody>
  </table></div>`;
}

function renderFigure(fig, caption) {
  return `<figure class="research-figure">
    <img src="${escapeHtml(fig.src)}" alt="${escapeHtml(fig.alt)}" loading="lazy" />
    <figcaption>${escapeHtml(caption)}</figcaption>
  </figure>`;
}

function renderFigureGrid(figures) {
  return `<div class="research-figure-grid">${figures
    .map((f) => renderFigure(f, f.caption))
    .join("")}</div>`;
}

function renderScopeBanner() {
  return `<div class="research-scope-banner" role="note">
    <h2 class="research-scope-title">What this page shows (and what it does not)</h2>
    <ul class="research-scope-list">
      <li><strong>Population reference only</strong> — numbers come from published <em>supplementary</em> PCOS, endometriosis, and single-cell research cohorts, not from labs run on patients who use this app.</li>
      <li><strong>No blood tests or single-cell profiling</strong> — HearHer does not measure any app user’s cells. Linked patients appear only on the <strong>Dashboard</strong> (check-ins, optional chat, diagnoses).</li>
      <li><strong>Not individual diagnosis</strong> — models and tables support education and research context; clinical decisions require examination, imaging, and laboratories.</li>
    </ul>
  </div>`;
}

function renderDataSources() {
  const rows = RESEARCH_DATA_SOURCES.map(
    (s) => `<tr>
      <th scope="row">${escapeHtml(s.label)}</th>
      <td>${escapeHtml(s.description)}</td>
      <td>${escapeHtml(String(s.n))}</td>
      <td>${escapeHtml(s.method)}</td>
    </tr>`
  ).join("");
  return `<p class="muted research-sources-intro">Figures and tables on this page summarize peer-reviewed supplementary datasets. They are not generated from your linked patients’ check-ins.</p>
    <div class="research-table-wrap"><table class="research-table research-table--compact">
      <thead><tr><th>Dataset</th><th>Description</th><th>Scale</th><th>Methods (summary)</th></tr></thead>
      <tbody>${rows}</tbody>
    </table></div>`;
}

function clinicalCorrelationLine(r) {
  const dir = r.corr >= 0 ? "higher" : "lower";
  return `${r.feature} tends to be ${dir} with a PCOS label in this cohort (r=${r.corr >= 0 ? "+" : ""}${r.corr.toFixed(2)}).`;
}

function renderTabularCohortSection() {
  const c = PCOS_COHORT;
  const clinicalLead = `
    <p class="research-clinical-lead">Published tabular PCOS cohort (n=${c.n}): which symptoms and measures <strong>travel with</strong> a PCOS label here. Use <strong>Multi-parameter profile</strong> above for combined contextualization — this section is population context only.</p>
    <h3 class="research-mini-label">Patterns clinicians recognize in this dataset</h3>
    <ul class="research-clinical-bullets">${PCOS_TOP_CORRELATIONS.slice(0, 6)
      .map((r) => `<li>${escapeHtml(clinicalCorrelationLine(r))}</li>`)
      .join("")}</ul>`;
  const stats = `
    <div class="research-stat-grid research-stat-grid--3">
      <div class="research-stat"><span class="research-stat-value">${c.n}</span><span class="research-stat-label">Participants</span></div>
      <div class="research-stat"><span class="research-stat-value">${c.pcosLabeledCount}</span><span class="research-stat-label">PCOS-labeled</span></div>
      <div class="research-stat"><span class="research-stat-value">${c.n - c.pcosLabeledCount}</span><span class="research-stat-label">Not PCOS-labeled</span></div>
    </div>`;

  const cvMetrics = renderMetricTable([
    ["5-fold CV accuracy", `${Math.round(c.cvAccuracy * 100)}%`],
    ["Precision (PCOS class)", `${Math.round(c.cvPrecision * 100)}%`],
    ["Recall (PCOS class)", `${Math.round(c.cvRecall * 100)}%`],
    ["Features (columns)", String(c.columnCount)],
    ["Non-PCOS / PCOS", `${c.n - c.pcosLabeledCount} / ${c.pcosLabeledCount}`],
  ]);

  const [[tn, fp], [fn, tp]] = c.cvConfusionMatrix;
  const confusion = `<p class="research-mini-label">5-fold CV confusion matrix (aggregated)</p>
    <div class="research-table-wrap"><table class="research-table research-table--compact research-confusion">
      <thead><tr><th></th><th>Pred. non-PCOS</th><th>Pred. PCOS</th></tr></thead>
      <tbody>
        <tr><th scope="row">Actual non-PCOS</th><td>${tn}</td><td>${fp}</td></tr>
        <tr><th scope="row">Actual PCOS</th><td>${fn}</td><td>${tp}</td></tr>
      </tbody>
    </table></div>`;

  const corrRows = PCOS_TOP_CORRELATIONS.map(
    (r) =>
      `<tr><td>${escapeHtml(r.feature)}</td><td>${r.corr >= 0 ? "+" : ""}${r.corr.toFixed(3)}</td></tr>`
  ).join("");
  const correlations = `<p class="research-mini-label">Top Pearson correlations with PCOS label</p>
    <div class="research-table-wrap"><table class="research-table research-table--compact">
      <thead><tr><th>Feature</th><th>r</th></tr></thead>
      <tbody>${corrRows}</tbody>
    </table></div>`;

  const coefRows = PCOS_MODEL_COEF_POSITIVE.map(
    (r) => `<tr><td>${escapeHtml(r.feature)}</td><td>+${r.coef.toFixed(3)}</td></tr>`
  ).join("");
  const coefficients = `<p class="research-mini-label">Logistic regression — top positive coefficients (scaled features)</p>
    <div class="research-table-wrap"><table class="research-table research-table--compact">
      <thead><tr><th>Feature</th><th>Coef.</th></tr></thead>
      <tbody>${coefRows}</tbody>
    </table></div>`;

  const figures = renderFigureGrid([
    {
      src: RESEARCH_FIGURES.pcosCoefficients,
      alt: "Top logistic regression coefficients for PCOS",
      caption: "Top model coefficients (tabular PCOS cohort).",
    },
    {
      src: RESEARCH_FIGURES.pcosPredictionDist,
      alt: "Distribution of predicted PCOS probabilities",
      caption: "Predicted probability distribution by true class.",
    },
  ]);

  const caveat = `<p class="muted research-cohort-caveat">Model metrics are in-cohort research reference only — not external validation and not for scoring individual patients.</p>`;

  const mlBlock = `${caveat}${cvMetrics}${confusion}${correlations}${coefficients}${figures}`;

  return `${clinicalLead}${stats}
    <details class="research-details research-details--ml">
      <summary>Technical details — classifier metrics &amp; coefficients (in-cohort only)</summary>
      <div class="research-details-body">${mlBlock}</div>
    </details>`;
}

function renderCompareSection() {
  const v = PCOS_VS_ENDO;
  const clinicalLead = `<p class="research-clinical-lead">When PCOS and endometriosis are both in the differential, compare <strong>harmonized fields</strong> between confirmed cases — use symptoms and examination first; these tables are secondary context.</p>`;
  const stats = `
    <div class="research-stat-grid research-stat-grid--3">
      <div class="research-stat"><span class="research-stat-value">${v.pcosN}</span><span class="research-stat-label">PCOS confirmed</span></div>
      <div class="research-stat"><span class="research-stat-value">${v.endoN.toLocaleString()}</span><span class="research-stat-label">Endo confirmed</span></div>
      <div class="research-stat"><span class="research-stat-value">${PCOS_VS_ENDO_DIFF_TESTS.length}</span><span class="research-stat-label">Fields compared</span></div>
    </div>`;

  const diffRows = PCOS_VS_ENDO_DIFF_TESTS.map(
    (r) =>
      `<tr>
        <th scope="row">${escapeHtml(r.field)}</th>
        <td>${escapeHtml(r.pcos)}</td>
        <td>${escapeHtml(r.endo)}</td>
        <td>${formatPValue(r.pValue)}</td>
      </tr>`
  ).join("");
  const diffTable = `<p class="research-mini-label">Harmonized-field comparison (confirmed cases)</p>
    <div class="research-table-wrap"><table class="research-table research-table--compact">
      <thead><tr><th>Field</th><th>PCOS</th><th>Endometriosis</th><th>p-value</th></tr></thead>
      <tbody>${diffRows}</tbody>
    </table></div>`;

  const rules = `<p class="research-mini-label">Data-level differentiation notes</p>
    <ul class="research-list">${DIFFERENTIATION_RULES.map((r) => `<li>${escapeHtml(r)}</li>`).join("")}</ul>`;

  const figures = renderFigureGrid([
    {
      src: RESEARCH_FIGURES.compareFeatures,
      alt: "Matched feature comparison PCOS vs endometriosis",
      caption: "Harmonized features: group means / rates.",
    },
    {
      src: RESEARCH_FIGURES.compareCoefficients,
      alt: "Disease differentiation classifier coefficients",
      caption: "Logistic classifier coefficients (PCOS vs endo label).",
    },
  ]);

  const mlStats = renderMetricTable([
    ["Differentiation AUC (in-cohort)", `${Math.round(v.differentiationAuc * 100)}%`],
    ["Accuracy", `${Math.round(v.differentiationAccuracy * 100)}%`],
  ]);

  return `${clinicalLead}${stats}${diffTable}${rules}
    <details class="research-details research-details--ml">
      <summary>Classifier figures &amp; metrics (research reference)</summary>
      <div class="research-details-body">${mlStats}${figures}</div>
    </details>`;
}

function inventoryRowFilterKey(row) {
  if (row.deepOnPortal) return "deep";
  if (/endometri/i.test(row.dataset || "")) return "endo";
  if (/pcos/i.test(row.dataset || "")) return "pcos";
  return "inventory";
}

function renderScRnaNarrativeBlock() {
  const scope = SCRNA_DEEP_SCOPE || {};
  const invN =
    scope.inventoryLibraries ??
    SCRNA_INVENTORY.endometriumLibraries + SCRNA_INVENTORY.pcosLibraries;
  return `<div class="scrna-narrative-block">
    <p class="research-clinical-lead">Published supplementary tissue — <strong>not</strong> cells from patients linked in this portal. Read as translational background; figures support the narratives below.</p>
    <div class="scrna-narrative-grid">
      <article class="scrna-narrative-card scrna-narrative-card--primary">
        <h3>Androgen biosynthesis activity increases under stimulation</h3>
        <p>One PCOS ovarian donor (Mc26): forskolin (cAMP) vs control shifts clustering and androgen-pathway-related expression in vitro — illustrative of ovarian tissue response to signaling, not a point-of-care test.</p>
        <button type="button" class="btn btn-primary btn-sm scrna-jump-figures">See supporting figures</button>
      </article>
      <article class="scrna-narrative-card">
        <h3>Representative stromal–epithelial pattern in eutopic endometrium</h3>
        <p>Clusters reflect mixed stromal, epithelial, immune, and cycle-phase programs — useful endometrial biology context, not a patient-specific assay.</p>
      </article>
      <article class="scrna-narrative-card">
        <h3>Inflammatory and remodeling signatures</h3>
        <p>Immune and stromal states appear alongside epithelial clusters — relevant to translational discussions, not individual diagnosis.</p>
      </article>
    </div>
    <p class="muted scrna-narrative-foot">${invN} published libraries inventoried; ${scope.deepRunsOnPortal ?? 2} have illustrative figures on this page.</p>
  </div>`;
}

function renderScRnaInventoryTable() {
  const inventory = SCRNA_LIBRARY_INVENTORY || [];
  const deepCount = inventory.filter((r) => r.deepOnPortal).length;
  const rows = inventory
    .map((r) => {
      const filterKey = inventoryRowFilterKey(r);
      const badge = r.deepOnPortal
        ? `<span class="scrna-badge scrna-badge--deep">Figures on this page</span>`
        : `<span class="scrna-badge scrna-badge--inventory">Listed only</span>`;
      const arm = r.arm ? escapeHtml(r.arm) : "—";
      const rowClass = r.deepOnPortal ? " scrna-inventory-row--deep" : "";
      return `<tr class="scrna-inventory-row${rowClass}" data-inventory-row="${escapeHtml(filterKey)}" data-deep="${r.deepOnPortal ? "1" : "0"}">
      <td>${escapeHtml(r.dataset)}</td>
      <td><code class="scrna-lib-code">${escapeHtml(r.library)}</code></td>
      <td>${arm}</td>
      <td>${r.cells.toLocaleString()}</td>
      <td>${r.nnzPerCell.toLocaleString()}</td>
      <td>${badge}</td>
    </tr>`;
    })
    .join("");

  return `<div id="scrna-inventory-root" class="scrna-inventory-block">
    <div class="scrna-inventory-head">
      <div>
        <h3 class="research-scrna-section-title">Library inventory</h3>
        <p class="muted">Filter ${inventory.length} supplementary libraries. <span id="scrna-inventory-count">Showing ${inventory.length} libraries</span> · ${deepCount} with UMAP figures below.</p>
      </div>
      <div class="scrna-inventory-filters" role="group" aria-label="Filter libraries">
        <button type="button" class="scrna-filter-btn is-active" data-inventory-filter="all">All</button>
        <button type="button" class="scrna-filter-btn" data-inventory-filter="deep">On this page (${deepCount})</button>
        <button type="button" class="scrna-filter-btn" data-inventory-filter="endo">Endometrium</button>
        <button type="button" class="scrna-filter-btn" data-inventory-filter="pcos">PCOS ovarian</button>
      </div>
    </div>
    <div class="research-table-wrap research-table-wrap--scroll">
      <table class="research-table research-table--compact scrna-inventory-table">
        <thead><tr><th>Dataset</th><th>Library ID</th><th>Study arm</th><th>Cells</th><th>Mean UMIs/cell</th><th>Figures</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
    <p class="scrna-inventory-foot muted">
      <a href="/research-figures/scrna/inventory_report.html?v=4">Open full inventory report</a> (summary cards + filterable table; use browser Back or the report link to return).
    </p>
  </div>`;
}

export function initScRnaInventoryFilters() {
  const root = document.getElementById("scrna-inventory-root");
  if (!root) return;
  const rows = root.querySelectorAll("tbody tr[data-inventory-row]");
  const countEl = root.querySelector("#scrna-inventory-count");
  const buttons = root.querySelectorAll("[data-inventory-filter]");

  const applyFilter = (filter) => {
    let visible = 0;
    rows.forEach((row) => {
      const key = row.getAttribute("data-inventory-row") || "";
      const show =
        filter === "all" ||
        key === filter ||
        (filter === "deep" && row.getAttribute("data-deep") === "1");
      row.hidden = !show;
      if (show) visible += 1;
    });
    if (countEl) {
      countEl.textContent = `Showing ${visible} of ${rows.length} libraries`;
    }
    buttons.forEach((btn) => {
      btn.classList.toggle("is-active", btn.getAttribute("data-inventory-filter") === filter);
    });
  };

  buttons.forEach((btn) => {
    btn.addEventListener("click", () => {
      applyFilter(btn.getAttribute("data-inventory-filter") || "all");
    });
  });

  document.querySelector(".scrna-jump-figures")?.addEventListener("click", () => {
    scrollToResearchSection("research-scrna-deep");
  });
}

function friendlyDeepRunMeta(run) {
  if (run.dataset === "endometrium") {
    return {
      title: "Endometrium (eutopic tissue)",
      narrativeTitle: "Inflammatory and stromal–epithelial programs in eutopic endometrium",
      insight:
        "Clusters mix cycle-phase, stromal, epithelial, and immune states — translational background for endometrial biology, not a patient-specific assay.",
      subtitle: "2 supplementary libraries · ~8,000 cells after QC",
      blurb: "",
    };
  }
  if (run.pair_prefix === "Mc26" || /Mc26/i.test(run.label || "")) {
    return {
      title: "PCOS ovarian — donor Mc26",
      narrativeTitle: "Androgen biosynthesis activity increases under stimulation",
      insight:
        "Same-donor control vs forskolin (cAMP) illustrates how ovarian tissue clustering and androgen-pathway expression can shift in vitro — research context, not clinical validation.",
      subtitle: "Control vs forskolin, same donor",
      blurb: "",
    };
  }
  return {
    title: run.label || "Single-cell run",
    narrativeTitle: run.label || "Single-cell run",
    insight: "",
    subtitle: "",
    blurb: "",
  };
}

function renderScRnaSection() {
  const inventory = SCRNA_LIBRARY_INVENTORY || [];

  const deepSlot = `
    <section id="research-scrna-deep" class="scrna-deep-section" tabindex="-1">
      <header class="scrna-deep-section-head">
        <h3 class="research-scrna-section-title">Supporting figures</h3>
        <p class="muted">Illustrations for the narratives above — technical QC and cluster tables are inside each card.</p>
      </header>
      <div id="scrna-deep-slot" class="scrna-deep-loading muted">Loading figures…</div>
    </section>`;

  const inventoryBlock = `<details class="research-details research-details--scrna-inventory">
    <summary>Full library inventory (${inventory.length} supplementary libraries)</summary>
    <div class="research-details-body">${renderScRnaInventoryTable()}</div>
  </details>`;

  const workflows = `<details class="research-details">
    <summary>Computational methods (offline pipeline)</summary>
    <p class="muted">For re-running analysis from raw ZIPs — not required to use the app.</p>
    <h4 class="research-mini-label">Endometrium workflow</h4>
    <ol class="research-steps">
      <li>Annotate stromal, epithelial, immune, and endothelial marker sets.</li>
      <li>Compare proliferative vs secretory programs.</li>
    </ol>
    <h4 class="research-mini-label">PCOS ovarian workflow</h4>
    <ol class="research-steps">
      <li>Integrate donors; compare control (C) vs forskolin (F) within donor.</li>
      <li>Mc26 on this page is one representative donor pair.</li>
    </ol>
    <p class="muted scrna-dev-note">Regenerate figures: <code>python3 backup/scripts/scrna_deep_analysis.py</code></p>
  </details>`;

  return renderScRnaNarrativeBlock() + deepSlot + inventoryBlock + workflows;
}

function renderEducationSection() {
  return `<h3 class="research-mini-label">Condition reference</h3>
    <div class="research-condition-grid">${renderConditionCards()}</div>
    <h3 class="research-mini-label">Symptom differentiation</h3>
    ${renderSymptomTable()}`;
}

function renderConditionCards() {
  return CONDITION_EDUCATION.map(
    (c) => `<article class="research-condition-card">
      <h3>${escapeHtml(c.name)}</h3>
      <p>${escapeHtml(c.summary)}</p>
      <p class="research-mini-label">Mechanisms (population / literature)</p>
      <p class="research-mechanisms">${escapeHtml(c.mechanisms)}</p>
      <p class="research-mini-label">Common symptoms</p>
      <ul>${c.commonSymptoms.map((s) => `<li>${escapeHtml(s)}</li>`).join("")}</ul>
      <p class="research-mini-label">When to refer / escalate</p>
      <p class="muted">${escapeHtml(c.whenToSeekCare)}</p>
    </article>`
  ).join("");
}

function renderSymptomTable() {
  return `<div class="research-table-wrap"><table class="research-table">
    <thead><tr><th>Topic</th><th>PCOS pattern</th><th>Endometriosis pattern</th><th>Other causes</th></tr></thead>
    <tbody>${SYMPTOM_DIFFERENTIATION.map(
      (row) =>
        `<tr><th scope="row">${escapeHtml(row.topic)}</th><td>${escapeHtml(row.pcos)}</td><td>${escapeHtml(row.endo)}</td><td>${escapeHtml(row.other)}</td></tr>`
    ).join("")}</tbody>
  </table></div>`;
}

export function renderResearchPageHead() {
  const labCount = LAB_COHORT_REFERENCE.length;
  return `<header id="${RESEARCH_TOP_ID}" class="card research-page-head" tabindex="-1">
    <div class="research-page-head-top">
      <div class="research-page-head-brand">
        <span class="badge badge-doctor">Reference library</span>
        <h1>Context for clinical decisions</h1>
        <p class="research-page-tagline muted">Cohort &amp; population reference</p>
        <p class="muted">Help clinicians <strong>contextualize symptoms and labs</strong> against published PCOS cohorts — not to replace examination, imaging, or local guidelines. Linked patients stay on the dashboard; this page is population reference only.</p>
        <p class="research-page-head-cta">
          <button type="button" class="btn btn-primary" data-research-jump="research-lab">Contextualize patient profile</button>
        </p>
      </div>
    </div>
    <div class="research-page-head-stats" aria-label="Dataset scale">
      <div class="research-head-stat research-head-stat--primary"><span class="research-head-stat-value">${labCount}</span><span class="research-head-stat-label">Measures in lab lookup</span></div>
      <div class="research-head-stat"><span class="research-head-stat-value">${PCOS_COHORT.n}</span><span class="research-head-stat-label">PCOS cohort participants</span></div>
      <div class="research-head-stat"><span class="research-head-stat-value">${PCOS_VS_ENDO_DIFF_TESTS.length}</span><span class="research-head-stat-label">PCOS vs endo fields</span></div>
    </div>
  </header>`;
}

export function renderDoctorResearchBody() {
  return [
    renderResearchToc(),
    renderResearchScopeCompact(),
    renderFeaturedLabZone(),
    renderResearchPart(
      "Population patterns",
      "What tends to associate with a PCOS label in the published tabular cohort — use lab lookup for an individual value.",
      [
        renderResearchZone(
          "research-cohort",
          "PCOS cohort — clinical patterns",
          "cohort",
          renderTabularCohortSection(),
          `n=${PCOS_COHORT.n} · population context`
        ),
        renderResearchZone(
          "research-compare",
          "PCOS vs endometriosis",
          "compare",
          renderCompareSection(),
          "Harmonized fields — confirmed cases only"
        ),
      ].join("")
    ),
    renderResearchPart(
      "Translational biology (optional)",
      "Narrative insights from published single-cell supplementary data — not patient assays.",
      renderResearchZone(
        "research-scrna",
        "Tissue-level insights",
        "scrna",
        renderScRnaSection(),
        "Illustrative figures · full inventory collapsible"
      ),
      "research-part--secondary"
    ),
    renderResearchPart(
      "Background & education",
      "Data scope, provenance, and condition reference material.",
      [
        renderResearchZone(
          "research-scope",
          "Data scope",
          "scope",
          renderScopeBanner(),
          "Supplementary cohorts ≠ patients in this portal"
        ),
        renderResearchZone(
          "research-sources",
          "Analysis provenance",
          "sources",
          renderDataSources(),
          "Published supplementary datasets"
        ),
        renderResearchZone(
          "research-education",
          "Clinical education",
          "education",
          renderEducationSection(),
          "Mechanisms, referral cues, symptom patterns"
        ),
      ].join("")
    ),
    `<div class="callout danger research-disclaimer">Educational reference only — not a diagnosis for a linked patient. Do not present cohort or scRNA plots as individual lab results.</div>`,
  ].join("").replace(/<motion-placeholder><\/motion-placeholder>/, "");
}

function renderOneScRnaDeepRun(run) {
  const meta = friendlyDeepRunMeta(run);
  const clusters = (run.clusters || [])
    .map(
      (c) =>
        `<tr><td>${escapeHtml(c.cluster)}</td><td>${c.n_cells}</td><td>${c.pct}%</td><td>${escapeHtml(c.top_marker_set)}</td></tr>`
    )
    .join("");
  const scores = Object.entries(run.mean_marker_scores || {})
    .filter(([, v]) => v != null)
    .map(([k, v]) => `<li>${escapeHtml(k)}: ${v}</li>`)
    .join("");
  const figs = [];
  if (run.portal_umap) {
    figs.push({
      src: run.portal_umap,
      alt: `UMAP ${meta.title}`,
      caption: `${meta.title} — Leiden clusters (UMAP).`,
    });
  }
  if (run.portal_heatmap) {
    figs.push({
      src: run.portal_heatmap,
      alt: `Marker heatmap ${meta.title}`,
      caption: `${meta.title} — mean marker-set scores by cluster.`,
    });
  }
  const cf = run.forskolin_comparison
    ? `<div class="scrna-androgen-callout">
         <p>Under forskolin, mean androgen-biosynthesis gene expression rises (control <strong>${run.forskolin_comparison.mean_log_expr_androgen_biosynthesis_genes.control.toFixed(2)}</strong> → forskolin <strong>${run.forskolin_comparison.mean_log_expr_androgen_biosynthesis_genes.forskolin.toFixed(2)}</strong>, donor ${escapeHtml(run.forskolin_comparison.donor)}).</p>
         <p class="muted">${escapeHtml(run.forskolin_comparison.interpretation)}</p>
       </div>`
    : "";

  const headline = meta.narrativeTitle || meta.title;
  const technical = `
    <p class="scrna-deep-run-meta muted">${Number(run.cells_after_qc).toLocaleString()} cells after QC · ${run.n_clusters} clusters · ${run.genes_after_hvg} variable genes</p>
    ${scores ? `<ul class="research-list">${scores}</ul>` : ""}
    ${
      clusters
        ? `<div class="research-table-wrap"><table class="research-table research-table--compact">
      <thead><tr><th>Cluster</th><th>Cells</th><th>%</th><th>Top marker set</th></tr></thead>
      <tbody>${clusters}</tbody>
    </table></div>`
        : ""
    }`;

  const figHtml = figs.length ? renderFigureGrid(figs) : "";

  return `<article class="scrna-deep-run">
    <div class="scrna-deep-run-layout">
      <div class="scrna-deep-run-copy">
        <header class="scrna-deep-run-head">
          <h3>${escapeHtml(headline)}</h3>
          ${meta.subtitle ? `<p class="scrna-deep-run-sub muted">${escapeHtml(meta.subtitle)}</p>` : ""}
          ${meta.insight ? `<p class="scrna-narrative-lead">${escapeHtml(meta.insight)}</p>` : ""}
        </header>
        ${cf}
        <details class="research-details research-details--inline">
          <summary>Technical detail (QC, clusters, marker scores)</summary>
          <div class="research-details-body">${technical}</div>
        </details>
      </div>
      ${figHtml ? `<div class="scrna-deep-run-figures">${figHtml}</div>` : ""}
    </div>
  </article>`;
}

function renderScRnaDeepManifest(manifest) {
  const runs = manifest.analyses || [];
  if (!runs.length) {
    return `<p class="muted">No extended single-cell runs are available yet.</p>`;
  }
  return runs.map((r) => renderOneScRnaDeepRun(r)).join("");
}

export async function hydrateScRnaDeep() {
  const slot = document.getElementById("scrna-deep-slot");
  if (!slot) return;
  try {
    const res = await fetch("/research-figures/scrna/scrna_deep_summary.json", {
      cache: "no-store",
    });
    if (!res.ok) {
      slot.innerHTML =
        "<p class=\"muted\">Extended UMAP and clustering figures appear here after supplementary single-cell archives are analyzed. Inventory counts above remain available.</p>";
      return;
    }
    const manifest = await res.json();
    slot.innerHTML = renderScRnaDeepManifest(manifest);
  } catch {
    slot.innerHTML =
      "<p class=\"muted\">Could not load extended single-cell results. Try refreshing the page.</p>";
  }
}

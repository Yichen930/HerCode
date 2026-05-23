#!/usr/bin/env python3
"""
Regenerate patient-doctor-portal/js/researchData.js and copy figures from backup/ outputs.
Writes backup/portal_sync_manifest.json for verification.
"""
from __future__ import annotations

import json
import re
import shutil
from datetime import datetime, timezone
from pathlib import Path

import pandas as pd

SCRIPTS = Path(__file__).resolve().parent
REPO = SCRIPTS.parents[1]
BACKUP = SCRIPTS.parent
PORTAL = REPO / "patient-doctor-portal"
RESEARCH_JS = PORTAL / "js" / "researchData.js"
FIG_DIR = PORTAL / "research-figures"
SCRNA_FIG = FIG_DIR / "scrna"
EDUCATION_JSON = BACKUP / "portal_education.json"
LAB_HINTS_JSON = BACKUP / "portal_lab_hints.json"
MANIFEST_PATH = BACKUP / "portal_sync_manifest.json"

LAB_SKIP = {
    "Sl. No",
    "Patient File No.",
    "Blood Group",
    "Height(Cm)",
    "I beta-HCG(mIU/mL)",
    "II beta-HCG(mIU/mL)",
}
LAB_PRIORITY = [
    "AMH(ng/mL)",
    "LH(mIU/mL)",
    "FSH(mIU/mL)",
    "FSH/LH",
    "BMI",
    "Age (yrs)",
    "Follicle No. (R)",
    "Follicle No. (L)",
    "Cycle(R/I)",
    "Cycle length(days)",
    "Endometrium (mm)",
    "TSH (mIU/L)",
    "PRL(ng/mL)",
    "RBS(mg/dl)",
    "Hb(g/dl)",
    "hair growth(Y/N)",
    "Pimples(Y/N)",
    "Skin darkening (Y/N)",
    "Weight gain(Y/N)",
]
ENDO_LAB_KEYS = {
    "BMI": "bmi",
    "Age (yrs)": "age",
}

PLAIN_CORRELATES = {
    "Follicle No. (R)": "ovarian follicle counts (imaging)",
    "Follicle No. (L)": "ovarian follicle counts (imaging)",
    "hair growth(Y/N)": "excess hair growth",
    "Skin darkening (Y/N)": "skin darkening",
    "Weight gain(Y/N)": "weight gain",
    "Cycle(R/I)": "irregular cycles",
    "Pimples(Y/N)": "acne",
    "AMH(ng/mL)": "elevated AMH",
    "BMI": "higher BMI",
    "Fast food (Y/N)": "dietary patterns (fast food)",
}


def _round(x: float, n: int = 3) -> float:
    return round(float(x), n)


def _round1(x: float) -> float:
    return round(float(x), 1)


def _fmt_p(p: float) -> float | str:
    p = float(p)
    if p < 0.0001:
        return float(f"{p:.1e}")
    if p < 0.01:
        return round(p, 4)
    return round(p, 4)


def _pct(rate: float) -> str:
    return f"{rate * 100:.1f}%"


def _strip_coef_feature(name: str) -> str:
    return re.sub(r"^num__", "", name).replace("(Y/N)", " (Y/N)")


def _pretty_feature(name: str) -> str:
    return _strip_coef_feature(name)


def _top_correlates_plain(correlations: list[dict]) -> list[str]:
    seen: set[str] = set()
    out: list[str] = []
    for row in correlations:
        feat = row["feature"]
        label = PLAIN_CORRELATES.get(feat, _pretty_feature(feat).lower())
        if label in seen:
            continue
        seen.add(label)
        out.append(label)
        if len(out) >= 7:
            break
    return out


def _library_label(archive_name: str) -> str:
    m = re.search(r"(UA_Endo\d+)", archive_name)
    if m:
        return m.group(1)
    return Path(archive_name).stem.replace(".tar.gz", "").replace(".tar", "")


def _pcos_treatment_arm(archive_name: str) -> str | None:
    if "-C." in archive_name or archive_name.endswith("-C.tar"):
        return "Control (C)"
    if "-F." in archive_name or archive_name.endswith("-F.tar"):
        return "Forskolin (F)"
    return None


def _scrna_deep_on_portal(dataset: str, archive_name: str) -> bool:
    if dataset == "Endometrium":
        return True
    return "Mc26" in archive_name


def _load_scrna_library_inventory() -> list[dict]:
    csv_path = BACKUP / "scRNA_analysis" / "single_cell_sample_inventory.csv"
    df = pd.read_csv(csv_path)
    df["nnz_per_cell"] = pd.to_numeric(df["nnz_per_cell"], errors="coerce")
    df["n_cells"] = pd.to_numeric(df["n_cells"], errors="coerce")
    rows: list[dict] = []
    for _, row in df.iterrows():
        ds = str(row["dataset"])
        archive = str(row["archive_in_zip"])
        rows.append(
            {
                "dataset": "Endometrium" if ds == "Endometrium" else "PCOS ovarian",
                "library": _library_label(archive),
                "arm": _pcos_treatment_arm(archive),
                "cells": int(row["n_cells"]),
                "nnzPerCell": int(round(float(row["nnz_per_cell"]))),
                "deepOnPortal": _scrna_deep_on_portal(ds, archive),
            }
        )
    return rows


def _slug_feature(name: str) -> str:
    s = re.sub(r"[^a-z0-9]+", "_", name.strip().lower())
    return s.strip("_") or "lab"


def _lab_sort_key(feature: str) -> tuple:
    try:
        pri = LAB_PRIORITY.index(feature)
    except ValueError:
        pri = 999
    return (pri, feature)


def build_lab_reference(
    correlations: list[dict], coef_df: pd.DataFrame, pcos_vs_endo: dict
) -> list[dict]:
    hints = json.loads(LAB_HINTS_JSON.read_text(encoding="utf-8"))
    corr_by_feat = {c["feature"]: c["corr"] for c in correlations}
    corr_by_pretty = {_pretty_feature(k): v for k, v in corr_by_feat.items()}
    coef_by_pretty: dict[str, float] = {}
    for _, row in coef_df.iterrows():
        coef_by_pretty[_pretty_feature(str(row["feature"]))] = _round(float(row["coef"]), 3)

    labs: list[dict] = []
    ttest = pd.read_csv(BACKUP / "analysis_output" / "numeric_feature_ttest.csv")
    for _, row in ttest.iterrows():
        feat = str(row["feature"]).strip()
        if feat in LAB_SKIP:
            continue
        pretty = _pretty_feature(feat)
        entry: dict = {
            "id": _slug_feature(feat),
            "feature": pretty,
            "kind": "numeric",
            "meanNonPcos": _round1(row["mean_non_pcos"]),
            "meanPcos": _round1(row["mean_pcos"]),
            "pValue": _fmt_p(row["p_value"]),
            "correlation": corr_by_pretty.get(pretty),
            "modelCoef": coef_by_pretty.get(pretty),
            "hint": hints.get(feat, ""),
            "searchTerms": [pretty, feat],
        }
        endo_key = ENDO_LAB_KEYS.get(feat)
        if endo_key == "bmi":
            entry["endoCompare"] = {
                "field": "BMI",
                "pcos": pcos_vs_endo["pcosMeanBmi"],
                "endo": pcos_vs_endo["endoMeanBmi"],
            }
        elif endo_key == "age":
            entry["endoCompare"] = {
                "field": "Age (years)",
                "pcos": pcos_vs_endo["pcosMeanAge"],
                "endo": pcos_vs_endo["endoMeanAge"],
            }
        labs.append(entry)

    chi2 = pd.read_csv(BACKUP / "analysis_output" / "binary_feature_chi2.csv")
    for _, row in chi2.iterrows():
        feat = str(row["feature"]).strip()
        if feat in LAB_SKIP:
            continue
        pretty = _pretty_feature(feat)
        labs.append(
            {
                "id": _slug_feature(feat),
                "feature": pretty,
                "kind": "binary",
                "pValue": _fmt_p(row["p_value"]),
                "cramersV": _round(float(row["cramers_v"]), 3),
                "correlation": corr_by_pretty.get(pretty),
                "hint": hints.get(feat, ""),
                "searchTerms": [pretty, feat.replace("(Y/N)", "").strip()],
            }
        )

    labs.append(
        {
            "id": "lh_fsh_ratio",
            "feature": "LH/FSH ratio (computed)",
            "kind": "derived",
            "hint": "Enter LH and FSH below to compute. Ratio >2 is often discussed in PCOS workups; not a separate column in the cohort table.",
            "searchTerms": ["lh fsh", "ratio", "lh/fsh"],
            "inputs": ["LH(mIU/mL)", "FSH(mIU/mL)"],
        }
    )

    labs.sort(key=lambda x: _lab_sort_key(x.get("feature", "")))
    return labs


def _load_scrna_library_samples() -> list[dict]:
    csv_path = BACKUP / "scRNA_analysis" / "single_cell_sample_inventory.csv"
    df = pd.read_csv(csv_path)
    df["nnz_per_cell"] = pd.to_numeric(df["nnz_per_cell"], errors="coerce")
    df["n_cells"] = pd.to_numeric(df["n_cells"], errors="coerce")
    samples: list[dict] = []

    endo = df[df["dataset"] == "Endometrium"].sort_values("n_cells", ascending=False)
    for _, row in endo.head(2).iterrows():
        samples.append(
            {
                "dataset": "Endometrium",
                "library": _library_label(str(row["archive_in_zip"])),
                "cells": int(row["n_cells"]),
                "nnzPerCell": int(round(float(row["nnz_per_cell"]))),
            }
        )

    pcos = df[df["dataset"] == "PCOS"]
    picks: list[pd.Series] = []
    for prefix in ("Mc03", "Mc27", "Mc50", "Mc26"):
        sub = pcos[pcos["archive_in_zip"].str.contains(prefix, na=False)]
        if not sub.empty:
            picks.append(sub.sort_values("n_cells", ascending=False).iloc[0])
    if len(picks) < 4:
        for _, row in pcos.sort_values("n_cells", ascending=False).iterrows():
            if len(picks) >= 4:
                break
            picks.append(row)
    for row in picks[:4]:
        samples.append(
            {
                "dataset": "PCOS ovarian",
                "library": _library_label(str(row["archive_in_zip"])),
                "cells": int(row["n_cells"]),
                "nnzPerCell": int(round(float(row["nnz_per_cell"]))),
            }
        )
    return samples


def build_manifest() -> dict:
    analysis = json.loads((BACKUP / "analysis_output" / "analysis_summary.json").read_text())
    compare = json.loads((BACKUP / "compare_output" / "pcos_vs_endo_summary.json").read_text())
    scrna = json.loads((BACKUP / "scRNA_analysis" / "single_cell_inventory_summary.json").read_text())
    corr_df = pd.read_csv(BACKUP / "analysis_output" / "top_correlations.csv", index_col=0)
    coef_df = pd.read_csv(BACKUP / "analysis_output" / "top_model_features.csv")

    metrics = analysis["model_metrics_5fold_cv"]
    balance = analysis["class_balance"]
    sizes = compare["sample_sizes_confirmed_cases"]
    diffs = compare["difference_tests"]
    model = compare["disease_differentiation_model_metrics"]

    if "top_correlations" in analysis:
        correlations = analysis["top_correlations"]
    else:
        correlations = [
            {"feature": idx, "corr": float(row.iloc[0])}
            for idx, row in corr_df.head(10).iterrows()
        ]
    top_coef = coef_df[coef_df["coef"] > 0].head(8)
    coef_positive = [
        {"feature": _pretty_feature(r["feature"]), "coef": _round(r["coef"], 3)}
        for _, r in top_coef.iterrows()
    ]

    endo = scrna["Endometrium"]
    pcos_sc = scrna["PCOS"]
    total_cells = int(endo["total_cells"]) + int(pcos_sc["total_cells"])

    diff_rows = [
        {
            "field": "Age (years)",
            "pcos": str(_round1(diffs["age"]["pcos_mean"])),
            "endo": str(_round1(diffs["age"]["endo_mean"])),
            "pValue": _fmt_p(diffs["age"]["p_value"]),
            "kind": "mean",
        },
        {
            "field": "BMI",
            "pcos": str(_round1(diffs["bmi"]["pcos_mean"])),
            "endo": str(_round1(diffs["bmi"]["endo_mean"])),
            "pValue": _fmt_p(diffs["bmi"]["p_value"]),
            "kind": "mean",
        },
        {
            "field": "Menstrual irregularity",
            "pcos": _pct(diffs["menstrual_irregularity"]["pcos_rate"]),
            "endo": _pct(diffs["menstrual_irregularity"]["endo_rate"]),
            "pValue": _fmt_p(diffs["menstrual_irregularity"]["p_value"]),
            "kind": "rate",
        },
        {
            "field": "Hormone abnormality proxy",
            "pcos": _pct(diffs["hormone_level_abnormality"]["pcos_rate"]),
            "endo": _pct(diffs["hormone_level_abnormality"]["endo_rate"]),
            "pValue": _fmt_p(diffs["hormone_level_abnormality"]["p_value"]),
            "kind": "rate",
        },
    ]

    pcos_vs_endo = {
        "pcosN": int(sizes["pcos_confirmed"]),
        "endoN": int(sizes["endometriosis_confirmed"]),
        "differentiationAccuracy": _round(model["accuracy"], 3),
        "differentiationAuc": _round(model["roc_auc"], 3),
        "pcosMeanAge": _round1(diffs["age"]["pcos_mean"]),
        "endoMeanAge": _round1(diffs["age"]["endo_mean"]),
        "pcosMeanBmi": _round1(diffs["bmi"]["pcos_mean"]),
        "endoMeanBmi": _round1(diffs["bmi"]["endo_mean"]),
        "pcosIrregularCycleRate": _round(diffs["menstrual_irregularity"]["pcos_rate"], 3),
        "endoIrregularCycleRate": _round(diffs["menstrual_irregularity"]["endo_rate"], 3),
        "differentiationF1": _round(model["f1"], 3),
    }

    return {
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "sources": {
            "analysis_summary": str(BACKUP / "analysis_output" / "analysis_summary.json"),
            "compare_summary": str(BACKUP / "compare_output" / "pcos_vs_endo_summary.json"),
            "scrna_inventory": str(BACKUP / "scRNA_analysis" / "single_cell_inventory_summary.json"),
        },
        "pcosCohort": {
            "n": int(analysis["dataset"]["rows"]),
            "columnCount": int(analysis["dataset"]["columns"]),
            "pcosLabeledCount": int(balance["pcos_count"]),
            "pcosLabeledRate": _round(balance["pcos_rate"], 3),
            "cvAccuracy": _round(metrics["accuracy"], 3),
            "cvPrecision": _round(metrics["precision"], 3),
            "cvRecall": _round(metrics["recall"], 3),
            "cvF1": _round(metrics["f1"], 3),
            "cvRocAuc": _round(metrics["roc_auc"], 3),
            "cvConfusionMatrix": metrics["confusion_matrix"],
            "topCorrelates": _top_correlates_plain(correlations),
        },
        "pcosTopCorrelations": [
            {"feature": _pretty_feature(c["feature"]), "corr": _round(c["corr"], 3)}
            for c in correlations[:10]
        ],
        "pcosModelCoefPositive": coef_positive,
        "pcosVsEndo": pcos_vs_endo,
        "pcosVsEndoDiffTests": diff_rows,
        "differentiationRules": compare.get("differentiation_rules", []),
        "scrnaInventory": {
            "endometriumLibraries": int(endo["libraries"]),
            "endometriumCells": int(endo["total_cells"]),
            "pcosLibraries": int(pcos_sc["libraries"]),
            "pcosCells": int(pcos_sc["total_cells"]),
            "genesPerMatrix": int(endo["genes_per_matrix"]),
            "meanNnzPerCellEndo": int(round(endo["mean_nnz_per_cell"])),
            "meanNnzPerCellPcos": int(round(pcos_sc["mean_nnz_per_cell"])),
            "totalCells": total_cells,
        },
        "scrnaLibrarySamples": _load_scrna_library_samples(),
        "scrnaLibraryInventory": _load_scrna_library_inventory(),
        "scrnaDeepScope": {
            "inventoryLibraries": 22,
            "deepRunsOnPortal": 2,
            "deepRunLabels": [
                "Endometrium — combined UMAP / Leiden (both supplementary libraries)",
                "PCOS Mc26 — control vs forskolin UMAP / androgen-pathway comparison",
            ],
            "summary": (
                "All 22 published 10x libraries are inventoried below (genes × cells from MTX headers). "
                "Full Scanpy QC, clustering, and UMAP on this page cover endometrium and the Mc26 donor pair "
                "(representative forskolin stimulation design in the PCOS ovarian dataset). "
                "The remaining 18 PCOS libraries share the same study design (10 donors × control/forskolin); "
                "re-running deep analysis for every library is supported offline via backup/scripts/scrna_deep_analysis.py."
            ),
        },
        "labCohortReference": build_lab_reference(correlations, coef_df, pcos_vs_endo),
    }


def _js_string(s: str) -> str:
    return json.dumps(s, ensure_ascii=False)


def _js_export(name: str, value) -> str:
    body = json.dumps(value, indent=2, ensure_ascii=False)
    return f"export const {name} = {body};\n"


def render_research_data_js(manifest: dict) -> str:
    edu = json.loads(EDUCATION_JSON.read_text(encoding="utf-8"))
    pve = manifest["pcosVsEndo"]
    bmi_row = {
        "topic": "BMI pattern (cohort-level)",
        "pcos": f"Higher mean BMI in PCOS-labeled group (~{pve['pcosMeanBmi']}) in project comparison data.",
        "endo": f"Lower mean BMI (~{pve['endoMeanBmi']}) in endometriosis-labeled supplementary cohort—population-dependent.",
        "other": "Individual BMI does not diagnose either condition.",
    }
    symptom_diff = edu["symptomDifferentiationBase"] + [bmi_row]

    inv = manifest["scrnaInventory"]
    n_pcos = manifest["pcosCohort"]["n"]
    endo_n = manifest["pcosVsEndo"]["endoN"]
    n_conf = f"{manifest['pcosVsEndo']['pcosN']} PCOS + {endo_n:,} endometriosis (confirmed)"

    parts = [
        "/**\n",
        " * AUTO-GENERATED by backup/scripts/sync_portal_research.py\n",
        f" * Source manifest: backup/portal_sync_manifest.json ({manifest['generatedAt']})\n",
        " * Educational reference only — not individual diagnosis.\n",
        " * Do not edit by hand; re-run: python3 backup/scripts/run_all_analyses.py\n",
        " */\n\n",
        _js_export("PCOS_COHORT", manifest["pcosCohort"]),
        "\n",
        _js_export("PCOS_TOP_CORRELATIONS", manifest["pcosTopCorrelations"]),
        "\n",
        _js_export("PCOS_MODEL_COEF_POSITIVE", manifest["pcosModelCoefPositive"]),
        "\n",
        _js_export("PCOS_VS_ENDO", manifest["pcosVsEndo"]),
        "\n",
        _js_export("PCOS_VS_ENDO_DIFF_TESTS", manifest["pcosVsEndoDiffTests"]),
        "\n",
        _js_export("DIFFERENTIATION_RULES", manifest["differentiationRules"]),
        "\n",
        _js_export("SCRNA_INVENTORY", {
            k: v
            for k, v in manifest["scrnaInventory"].items()
            if k != "totalCells"
        }),
        "\n",
        _js_export("SCRNA_LIBRARY_SAMPLES", manifest["scrnaLibrarySamples"]),
        "\n",
        _js_export("SCRNA_LIBRARY_INVENTORY", manifest["scrnaLibraryInventory"]),
        "\n",
        _js_export("SCRNA_DEEP_SCOPE", manifest["scrnaDeepScope"]),
        "\n",
        _js_export("LAB_COHORT_REFERENCE", manifest["labCohortReference"]),
        "\n",
        _js_export(
            "RESEARCH_FIGURES",
            {
                "pcosCoefficients": "/research-figures/pcos-top-coefficients.png",
                "pcosPredictionDist": "/research-figures/pcos-prediction-distribution.png",
                "compareFeatures": "/research-figures/pcos-vs-endo-features.png",
                "compareCoefficients": "/research-figures/pcos-vs-endo-coefficients.png",
            },
        ),
        "\n",
        _js_export(
            "RESEARCH_DATA_SOURCES",
            [
                {
                    "id": "pcos-tabular",
                    "label": "PCOS tabular cohort",
                    "description": "Published PCOS clinical & questionnaire dataset",
                    "n": f"{n_pcos} participants",
                    "method": "Correlation analysis; logistic regression with 5-fold cross-validation",
                },
                {
                    "id": "pcos-vs-endo",
                    "label": "PCOS vs endometriosis comparison",
                    "description": "Harmonized overlapping fields across two published supplementary cohorts",
                    "n": n_conf,
                    "method": "Group comparisons; disease-label classifier on shared features",
                },
                {
                    "id": "scrna",
                    "label": "Single-cell resources",
                    "description": "Endometrium and ovarian 10x gene-expression libraries from supplementary studies",
                    "n": f"{inv['totalCells']:,} cells inventoried".replace(",", ","),
                    "method": "Library inventory; Scanpy UMAP/clustering on representative subsets",
                },
            ],
        ),
        "\n",
        _js_export("CONDITION_EDUCATION", edu["conditionEducation"]),
        "\n",
        _js_export("SYMPTOM_DIFFERENTIATION", symptom_diff),
        "\n",
    ]
    return "".join(parts)


def copy_figures() -> list[str]:
    copied: list[str] = []
    pairs = [
        (BACKUP / "analysis_output" / "top_coefficients.png", FIG_DIR / "pcos-top-coefficients.png"),
        (BACKUP / "analysis_output" / "prediction_distribution.png", FIG_DIR / "pcos-prediction-distribution.png"),
        (BACKUP / "compare_output" / "matched_feature_comparison.png", FIG_DIR / "pcos-vs-endo-features.png"),
        (BACKUP / "compare_output" / "differentiation_coefficients.png", FIG_DIR / "pcos-vs-endo-coefficients.png"),
    ]
    FIG_DIR.mkdir(parents=True, exist_ok=True)
    for src, dst in pairs:
        if not src.is_file():
            raise FileNotFoundError(f"Missing analysis figure: {src}")
        shutil.copy2(src, dst)
        copied.append(str(dst.relative_to(REPO)))

    manifest_path = SCRNA_FIG / "scrna_deep_summary.json"
    if not manifest_path.is_file():
        raise FileNotFoundError(
            f"Missing {manifest_path}; run scrna deep analysis first (run_all_analyses.py)."
        )
    data = json.loads(manifest_path.read_text())
    for run in data.get("analyses", []):
        for key in ("umap", "marker_heatmap"):
            fig = run.get("figures", {}).get(key)
            if fig and not (SCRNA_FIG / fig).is_file():
                raise FileNotFoundError(f"Missing scRNA figure: {SCRNA_FIG / fig}")
        copied.append(f"patient-doctor-portal/research-figures/scrna/{run['figures']['umap']}")
    inv_report = BACKUP / "scRNA_analysis" / "single_cell_inventory_report.html"
    if inv_report.is_file():
        shutil.copy2(inv_report, SCRNA_FIG / "inventory_report.html")
        copied.append("patient-doctor-portal/research-figures/scrna/inventory_report.html")
    inv_csv = BACKUP / "scRNA_analysis" / "single_cell_sample_inventory.csv"
    if inv_csv.is_file():
        shutil.copy2(inv_csv, SCRNA_FIG / "single_cell_sample_inventory.csv")
        copied.append("patient-doctor-portal/research-figures/scrna/single_cell_sample_inventory.csv")
    return copied


def export_joint_model_if_dataset() -> list[str]:
    """Export browser joint model when PCOS workbook is on disk."""
    try:
        from dataset_paths import PCOS_XLSX
    except ImportError:
        return []
    if not PCOS_XLSX.is_file():
        return []
    from export_pcos_joint_model import export_joint_model

    out = FIG_DIR / "pcos_joint_model.json"
    export_joint_model(out)
    rel = str(out.relative_to(REPO))
    print(f"Exported joint model → {rel}")
    return [rel]


def sync_all() -> dict:
    required = [
        BACKUP / "analysis_output" / "analysis_summary.json",
        BACKUP / "compare_output" / "pcos_vs_endo_summary.json",
        BACKUP / "scRNA_analysis" / "single_cell_inventory_summary.json",
        BACKUP / "analysis_output" / "top_correlations.csv",
        BACKUP / "analysis_output" / "top_model_features.csv",
        BACKUP / "analysis_output" / "numeric_feature_ttest.csv",
        BACKUP / "analysis_output" / "binary_feature_chi2.csv",
        BACKUP / "scRNA_analysis" / "single_cell_sample_inventory.csv",
        EDUCATION_JSON,
        LAB_HINTS_JSON,
    ]
    missing = [str(p) for p in required if not p.is_file()]
    if missing:
        raise FileNotFoundError("Cannot sync portal — missing backup outputs:\n  " + "\n  ".join(missing))

    manifest = build_manifest()
    figures = copy_figures()
    joint_paths = export_joint_model_if_dataset()
    if joint_paths:
        figures = figures + joint_paths
    manifest["figuresCopied"] = figures

    js = render_research_data_js(manifest)
    RESEARCH_JS.write_text(js, encoding="utf-8")
    manifest["researchDataJs"] = str(RESEARCH_JS.relative_to(REPO))

    MANIFEST_PATH.write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    print(f"Wrote {RESEARCH_JS.relative_to(REPO)}")
    print(f"Wrote {MANIFEST_PATH.relative_to(REPO)}")
    print(f"Copied {len(figures)} figure path(s) into portal")
    return manifest


def main() -> None:
    sync_all()


if __name__ == "__main__":
    main()

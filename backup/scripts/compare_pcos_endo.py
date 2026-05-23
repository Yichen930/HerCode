import json
from pathlib import Path

import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from scipy import stats
from sklearn.compose import ColumnTransformer
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, f1_score, roc_auc_score
from sklearn.model_selection import StratifiedKFold, cross_val_predict
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler


def load_data() -> tuple[pd.DataFrame, pd.DataFrame]:
    from dataset_paths import ENDO_CSV, ENDO_XLSX, PCOS_XLSX

    if not PCOS_XLSX.is_file():
        raise FileNotFoundError(f"Missing PCOS dataset: {PCOS_XLSX}")
    pcos = pd.read_excel(PCOS_XLSX, sheet_name="Full_new")
    if ENDO_CSV.is_file():
        endo = pd.read_csv(ENDO_CSV)
    elif ENDO_XLSX.is_file():
        endo = pd.read_excel(ENDO_XLSX, sheet_name="in")
    else:
        raise FileNotFoundError(
            f"Missing endometriosis dataset (expected {ENDO_CSV.name} or {ENDO_XLSX.name})"
        )
    return pcos, endo


def build_harmonized_positive_cohorts(
    pcos: pd.DataFrame, endo: pd.DataFrame
) -> tuple[pd.DataFrame, pd.DataFrame]:
    p = pcos.copy()
    e = endo.copy()

    p["PCOS (Y/N)"] = pd.to_numeric(p["PCOS (Y/N)"], errors="coerce")
    p = p[p["PCOS (Y/N)"] == 1].copy()
    e = e[pd.to_numeric(e["Diagnosis"], errors="coerce") == 1].copy()

    p["age"] = pd.to_numeric(p[" Age (yrs)"], errors="coerce")
    p["bmi"] = pd.to_numeric(p["BMI"], errors="coerce")
    p["cycle_code"] = pd.to_numeric(p["Cycle(R/I)"], errors="coerce")
    p["menstrual_irregularity"] = p["cycle_code"].isin([4, 5]).astype(int)
    p["lh"] = pd.to_numeric(p["LH(mIU/mL)"], errors="coerce")
    p["fsh"] = pd.to_numeric(p["FSH(mIU/mL)"], errors="coerce")
    p["amh"] = pd.to_numeric(p["AMH(ng/mL)"], errors="coerce")
    p["hormone_level_abnormality"] = (
        (p["lh"] / p["fsh"] > 2.0) | (p["amh"] > 4.5)
    ).astype(int)

    p_h = p[
        ["age", "bmi", "menstrual_irregularity", "hormone_level_abnormality"]
    ].copy()
    p_h["disease"] = "PCOS"

    e_h = pd.DataFrame(
        {
            "age": pd.to_numeric(e["Age"], errors="coerce"),
            "bmi": pd.to_numeric(e["BMI"], errors="coerce"),
            "menstrual_irregularity": pd.to_numeric(
                e["Menstrual_Irregularity"], errors="coerce"
            ),
            "hormone_level_abnormality": pd.to_numeric(
                e["Hormone_Level_Abnormality"], errors="coerce"
            ),
            "disease": "Endometriosis",
            "chronic_pain_level": pd.to_numeric(e["Chronic_Pain_Level"], errors="coerce"),
            "infertility": pd.to_numeric(e["Infertility"], errors="coerce"),
        }
    )
    p_h["chronic_pain_level"] = np.nan
    p_h["infertility"] = np.nan

    return p_h, e_h


def summarize_differences(combined: pd.DataFrame) -> dict:
    res = {}
    for col in ["age", "bmi", "menstrual_irregularity", "hormone_level_abnormality"]:
        a = combined.loc[combined["disease"] == "PCOS", col].dropna()
        b = combined.loc[combined["disease"] == "Endometriosis", col].dropna()
        if col in ["age", "bmi"]:
            t, p = stats.ttest_ind(a, b, equal_var=False, nan_policy="omit")
            res[col] = {
                "pcos_mean": float(a.mean()),
                "endo_mean": float(b.mean()),
                "difference": float(a.mean() - b.mean()),
                "p_value": float(p),
            }
        else:
            ct = pd.crosstab(combined["disease"], combined[col])
            chi2, p, _, _ = stats.chi2_contingency(ct)
            res[col] = {
                "pcos_rate": float(a.mean()),
                "endo_rate": float(b.mean()),
                "difference": float(a.mean() - b.mean()),
                "p_value": float(p),
                "chi2": float(chi2),
            }
    return res


def disease_classifier(combined: pd.DataFrame) -> tuple[dict, pd.DataFrame]:
    model_df = combined.copy()
    y = (model_df["disease"] == "PCOS").astype(int)
    X = model_df[["age", "bmi", "menstrual_irregularity", "hormone_level_abnormality"]]

    pre = ColumnTransformer(
        [
            (
                "num",
                Pipeline(
                    [
                        ("imputer", SimpleImputer(strategy="median")),
                        ("scaler", StandardScaler()),
                    ]
                ),
                ["age", "bmi", "menstrual_irregularity", "hormone_level_abnormality"],
            )
        ]
    )
    clf = Pipeline(
        [("pre", pre), ("logit", LogisticRegression(max_iter=1500, class_weight="balanced"))]
    )
    cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)
    prob = cross_val_predict(clf, X, y, cv=cv, method="predict_proba")[:, 1]
    pred = (prob >= 0.5).astype(int)

    metrics = {
        "accuracy": float(accuracy_score(y, pred)),
        "f1": float(f1_score(y, pred)),
        "roc_auc": float(roc_auc_score(y, prob)),
        "pcos_positive_rate_in_combined": float(y.mean()),
    }

    clf.fit(X, y)
    coefs = clf.named_steps["logit"].coef_[0]
    coef_df = pd.DataFrame(
        {
            "feature": ["age", "bmi", "menstrual_irregularity", "hormone_level_abnormality"],
            "coef": coefs,
        }
    ).sort_values("coef", ascending=False)
    return metrics, coef_df


def save_outputs(root: Path, combined: pd.DataFrame, diffs: dict, metrics: dict, coef_df: pd.DataFrame):
    out = root / "compare_output"
    out.mkdir(exist_ok=True)

    combined.to_csv(out / "harmonized_positive_cohorts.csv", index=False)
    pd.DataFrame.from_dict(diffs, orient="index").to_csv(out / "pcos_vs_endo_diff_tests.csv")
    coef_df.to_csv(out / "disease_classifier_coefficients.csv", index=False)

    plt.figure(figsize=(8, 4))
    cat = ["Age", "BMI", "Menstrual irregularity", "Hormone abnormality"]
    pcos_vals = [
        diffs["age"]["pcos_mean"],
        diffs["bmi"]["pcos_mean"],
        diffs["menstrual_irregularity"]["pcos_rate"] * 100,
        diffs["hormone_level_abnormality"]["pcos_rate"] * 100,
    ]
    endo_vals = [
        diffs["age"]["endo_mean"],
        diffs["bmi"]["endo_mean"],
        diffs["menstrual_irregularity"]["endo_rate"] * 100,
        diffs["hormone_level_abnormality"]["endo_rate"] * 100,
    ]
    x = np.arange(len(cat))
    width = 0.38
    plt.bar(x - width / 2, pcos_vals, width, label="PCOS")
    plt.bar(x + width / 2, endo_vals, width, label="Endometriosis")
    plt.xticks(x, cat, rotation=10)
    plt.title("Matched Feature Comparison (Confirmed Cases)")
    plt.legend()
    plt.tight_layout()
    plt.savefig(out / "matched_feature_comparison.png", dpi=140)
    plt.close()

    plt.figure(figsize=(7, 4))
    plot_coef = coef_df.sort_values("coef")
    plt.barh(plot_coef["feature"], plot_coef["coef"])
    plt.title("Disease Differentiation Model Coefficients")
    plt.tight_layout()
    plt.savefig(out / "differentiation_coefficients.png", dpi=140)
    plt.close()

    rules = [
        "Indicators leaning toward PCOS in this comparison: higher hormone abnormality proxy (LH/FSH>2 or AMH>4.5), higher BMI, lower age.",
        "Indicators leaning toward Endometriosis in this comparison: lower menstrual irregularity rate (in this synthetic supplementary cohort) and comparatively lower hormone abnormality flag.",
        "Important: Chronic pain and infertility are available only in the endometriosis file, so cross-disease rule quality is constrained by feature overlap.",
        "Do not use this as medical diagnosis guidance; this is a data-level comparative exercise.",
    ]

    summary = {
        "sample_sizes_confirmed_cases": {
            "pcos_confirmed": int((combined["disease"] == "PCOS").sum()),
            "endometriosis_confirmed": int((combined["disease"] == "Endometriosis").sum()),
        },
        "difference_tests": diffs,
        "disease_differentiation_model_metrics": metrics,
        "differentiation_rules": rules,
    }
    (out / "pcos_vs_endo_summary.json").write_text(
        json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8"
    )

    html = f"""<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>PCOS vs Endometriosis Differentiation Report</title>
  <style>
    body {{ font-family: Arial, sans-serif; margin: 24px; color: #222; }}
    h1, h2 {{ margin-bottom: 8px; }}
    .grid {{ display: grid; grid-template-columns: repeat(3, minmax(220px, 1fr)); gap: 12px; margin: 12px 0 20px; }}
    .card {{ border: 1px solid #ddd; border-radius: 8px; padding: 12px; }}
    table {{ border-collapse: collapse; width: 100%; margin: 8px 0 18px; }}
    th, td {{ border: 1px solid #ddd; padding: 8px; text-align: left; font-size: 14px; }}
    th {{ background: #f6f6f6; }}
    img {{ max-width: 100%; border: 1px solid #ddd; border-radius: 6px; margin: 10px 0 20px; }}
    code {{ background: #f4f4f4; padding: 1px 4px; border-radius: 4px; }}
  </style>
</head>
<body>
  <h1>PCOS vs Endometriosis: Comparative Analysis</h1>
  <p>Goal: use a PCOS-like analysis on the supplementary endometriosis dataset, then identify differentiating patterns.</p>

  <h2>1) Confirmed-case comparison scope</h2>
  <div class="grid">
    <div class="card"><b>PCOS confirmed cases</b><br>{summary["sample_sizes_confirmed_cases"]["pcos_confirmed"]}</div>
    <div class="card"><b>Endometriosis confirmed cases</b><br>{summary["sample_sizes_confirmed_cases"]["endometriosis_confirmed"]}</div>
    <div class="card"><b>Shared features used</b><br>Age, BMI, Menstrual irregularity, Hormone abnormality</div>
  </div>

  <h2>2) Matched-feature differences</h2>
  <table>
    <thead><tr><th>Feature</th><th>PCOS</th><th>Endometriosis</th><th>PCOS - Endo</th><th>p-value</th></tr></thead>
    <tbody>
      <tr><td>Age (mean)</td><td>{diffs["age"]["pcos_mean"]:.2f}</td><td>{diffs["age"]["endo_mean"]:.2f}</td><td>{diffs["age"]["difference"]:.2f}</td><td>{diffs["age"]["p_value"]:.3g}</td></tr>
      <tr><td>BMI (mean)</td><td>{diffs["bmi"]["pcos_mean"]:.2f}</td><td>{diffs["bmi"]["endo_mean"]:.2f}</td><td>{diffs["bmi"]["difference"]:.2f}</td><td>{diffs["bmi"]["p_value"]:.3g}</td></tr>
      <tr><td>Menstrual irregularity rate</td><td>{diffs["menstrual_irregularity"]["pcos_rate"]:.1%}</td><td>{diffs["menstrual_irregularity"]["endo_rate"]:.1%}</td><td>{diffs["menstrual_irregularity"]["difference"]:.1%}</td><td>{diffs["menstrual_irregularity"]["p_value"]:.3g}</td></tr>
      <tr><td>Hormone abnormality rate</td><td>{diffs["hormone_level_abnormality"]["pcos_rate"]:.1%}</td><td>{diffs["hormone_level_abnormality"]["endo_rate"]:.1%}</td><td>{diffs["hormone_level_abnormality"]["difference"]:.1%}</td><td>{diffs["hormone_level_abnormality"]["p_value"]:.3g}</td></tr>
    </tbody>
  </table>

  <img src="matched_feature_comparison.png" alt="matched feature comparison" />

  <h2>3) Disease differentiation model (PCOS vs Endometriosis)</h2>
  <div class="grid">
    <div class="card"><b>Accuracy</b><br>{metrics["accuracy"]:.3f}</div>
    <div class="card"><b>F1</b><br>{metrics["f1"]:.3f}</div>
    <div class="card"><b>ROC-AUC</b><br>{metrics["roc_auc"]:.3f}</div>
  </div>

  <img src="differentiation_coefficients.png" alt="differentiation coefficients" />

  <h2>4) Practical differentiation hints from this data</h2>
  <ul>
    {"".join(f"<li>{r}</li>" for r in rules)}
  </ul>

  <h2>5) Files included</h2>
  <ul>
    <li><code>pcos_vs_endo_summary.json</code></li>
    <li><code>harmonized_positive_cohorts.csv</code></li>
    <li><code>pcos_vs_endo_diff_tests.csv</code></li>
    <li><code>disease_classifier_coefficients.csv</code></li>
    <li><code>matched_feature_comparison.png</code></li>
    <li><code>differentiation_coefficients.png</code></li>
  </ul>
</body>
</html>"""
    (out / "pcos_vs_endo_report.html").write_text(html, encoding="utf-8")
    print(f"Saved comparison outputs to: {out}")


def main():
    backup_root = Path(__file__).resolve().parents[1]
    pcos, endo = load_data()
    pcos_h, endo_h = build_harmonized_positive_cohorts(pcos, endo)
    combined = pd.concat([pcos_h, endo_h], ignore_index=True)
    combined = combined.dropna(subset=["age", "bmi", "menstrual_irregularity", "hormone_level_abnormality"])
    diffs = summarize_differences(combined)
    metrics, coef_df = disease_classifier(combined)
    save_outputs(backup_root, combined, diffs, metrics, coef_df)


if __name__ == "__main__":
    main()

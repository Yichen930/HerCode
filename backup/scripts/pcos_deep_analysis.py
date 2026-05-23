import json
from pathlib import Path

import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from scipy import stats
from sklearn.compose import ColumnTransformer
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    accuracy_score,
    confusion_matrix,
    f1_score,
    precision_score,
    recall_score,
    roc_auc_score,
)
from sklearn.model_selection import StratifiedKFold, cross_val_predict
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler


def sanitize_columns(df: pd.DataFrame) -> pd.DataFrame:
    renamed = {c: " ".join(str(c).split()) for c in df.columns}
    return df.rename(columns=renamed)


def cramers_v(x: pd.Series, y: pd.Series) -> float:
    table = pd.crosstab(x, y)
    if table.empty:
        return np.nan
    chi2 = stats.chi2_contingency(table)[0]
    n = table.values.sum()
    if n == 0:
        return np.nan
    phi2 = chi2 / n
    r, k = table.shape
    phi2corr = max(0, phi2 - ((k - 1) * (r - 1)) / (n - 1))
    rcorr = r - ((r - 1) ** 2) / (n - 1)
    kcorr = k - ((k - 1) ** 2) / (n - 1)
    denom = min((kcorr - 1), (rcorr - 1))
    if denom <= 0:
        return np.nan
    return float(np.sqrt(phi2corr / denom))


def main() -> None:
    from dataset_paths import PCOS_XLSX

    backup_root = Path(__file__).resolve().parents[1]
    src = PCOS_XLSX
    if not src.is_file():
        raise FileNotFoundError(f"Missing PCOS dataset (place in dataset/): {src}")
    out = backup_root / "analysis_output"
    out.mkdir(exist_ok=True)

    df = pd.read_excel(src, sheet_name="Full_new")
    df = sanitize_columns(df)
    target = "PCOS (Y/N)"
    df[target] = pd.to_numeric(df[target], errors="coerce")
    df = df.dropna(subset=[target]).copy()
    df[target] = df[target].astype(int)

    missing = df.isna().sum().sort_values(ascending=False)
    missing = missing[missing > 0]

    numeric_df = df.copy()
    for c in numeric_df.columns:
        numeric_df[c] = pd.to_numeric(numeric_df[c], errors="coerce")
    corr = (
        numeric_df.corr(numeric_only=True)[target]
        .drop(labels=[target])
        .dropna()
        .sort_values(key=lambda s: s.abs(), ascending=False)
    )

    binary_cols = [c for c in df.columns if "(Y/N)" in c and c != target]
    chi2_results = []
    for c in binary_cols:
        x = pd.to_numeric(df[c], errors="coerce")
        valid = x.notna()
        if valid.sum() < 30:
            continue
        ct = pd.crosstab(x[valid].astype(int), df.loc[valid, target])
        if ct.shape[0] < 2 or ct.shape[1] < 2:
            continue
        chi2, p, _, _ = stats.chi2_contingency(ct)
        chi2_results.append(
            {
                "feature": c,
                "chi2": float(chi2),
                "p_value": float(p),
                "cramers_v": cramers_v(x[valid].astype(int), df.loc[valid, target]),
            }
        )
    chi2_df = pd.DataFrame(chi2_results).sort_values("p_value")

    numeric_features = []
    ttest_results = []
    for c in df.columns:
        if c == target:
            continue
        col = pd.to_numeric(df[c], errors="coerce")
        if col.notna().sum() < 100:
            continue
        if col.nunique(dropna=True) <= 10 and "(Y/N)" in c:
            continue
        a = col[df[target] == 0].dropna()
        b = col[df[target] == 1].dropna()
        if len(a) < 20 or len(b) < 20:
            continue
        t, p = stats.ttest_ind(a, b, equal_var=False, nan_policy="omit")
        diff = float(b.mean() - a.mean())
        ttest_results.append(
            {
                "feature": c,
                "mean_non_pcos": float(a.mean()),
                "mean_pcos": float(b.mean()),
                "mean_diff": diff,
                "p_value": float(p),
            }
        )
        numeric_features.append(c)
    ttest_df = pd.DataFrame(ttest_results).sort_values("p_value")

    X = df.drop(columns=[target])
    y = df[target]
    num_cols = [c for c in X.columns if pd.to_numeric(X[c], errors="coerce").notna().mean() > 0.9]
    cat_cols = [c for c in X.columns if c not in num_cols]

    for c in num_cols:
        X[c] = pd.to_numeric(X[c], errors="coerce")

    preprocessor = ColumnTransformer(
        transformers=[
            (
                "num",
                Pipeline(
                    steps=[
                        ("imputer", SimpleImputer(strategy="median")),
                        ("scaler", StandardScaler()),
                    ]
                ),
                num_cols,
            ),
            (
                "cat",
                Pipeline(
                    steps=[
                        ("imputer", SimpleImputer(strategy="most_frequent")),
                        ("onehot", OneHotEncoder(handle_unknown="ignore")),
                    ]
                ),
                cat_cols,
            ),
        ]
    )

    model = Pipeline(
        steps=[
            ("prep", preprocessor),
            ("clf", LogisticRegression(max_iter=2000, class_weight="balanced")),
        ]
    )

    cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)
    prob = cross_val_predict(model, X, y, cv=cv, method="predict_proba")[:, 1]
    pred = (prob >= 0.5).astype(int)
    metrics = {
        "accuracy": float(accuracy_score(y, pred)),
        "precision": float(precision_score(y, pred)),
        "recall": float(recall_score(y, pred)),
        "f1": float(f1_score(y, pred)),
        "roc_auc": float(roc_auc_score(y, prob)),
        "confusion_matrix": confusion_matrix(y, pred).tolist(),
    }

    model.fit(X, y)
    clf = model.named_steps["clf"]
    feature_names = model.named_steps["prep"].get_feature_names_out()
    coef_df = pd.DataFrame({"feature": feature_names, "coef": clf.coef_[0]})
    coef_df["abs_coef"] = coef_df["coef"].abs()
    coef_df = coef_df.sort_values("abs_coef", ascending=False)

    top_features = coef_df.head(15).copy()
    top_features.to_csv(out / "top_model_features.csv", index=False)
    chi2_df.to_csv(out / "binary_feature_chi2.csv", index=False)
    ttest_df.to_csv(out / "numeric_feature_ttest.csv", index=False)
    corr.head(20).to_csv(out / "top_correlations.csv")

    plt.figure(figsize=(10, 6))
    plot_df = top_features.head(12).iloc[::-1]
    plt.barh(plot_df["feature"], plot_df["coef"])
    plt.title("Top Logistic Regression Coefficients")
    plt.tight_layout()
    plt.savefig(out / "top_coefficients.png", dpi=140)
    plt.close()

    plt.figure(figsize=(8, 4))
    bins = np.linspace(0, 1, 21)
    plt.hist(prob[y == 0], bins=bins, alpha=0.7, label="Non-PCOS")
    plt.hist(prob[y == 1], bins=bins, alpha=0.7, label="PCOS")
    plt.title("Predicted Probability Distribution")
    plt.xlabel("Predicted PCOS Probability")
    plt.ylabel("Count")
    plt.legend()
    plt.tight_layout()
    plt.savefig(out / "prediction_distribution.png", dpi=140)
    plt.close()

    summary = {
        "dataset": {"rows": int(df.shape[0]), "columns": int(df.shape[1])},
        "class_balance": {
            "pcos_count": int(y.sum()),
            "non_pcos_count": int((1 - y).sum()),
            "pcos_rate": float(y.mean()),
        },
        "missing_top10": {k: int(v) for k, v in missing.head(10).items()},
        "top_correlations": [
            {"feature": idx, "corr": float(val)} for idx, val in corr.head(12).items()
        ],
        "model_metrics_5fold_cv": metrics,
        "top_positive_coefficients": top_features[top_features["coef"] > 0]
        .head(8)[["feature", "coef"]]
        .to_dict(orient="records"),
        "top_negative_coefficients": top_features[top_features["coef"] < 0]
        .head(8)[["feature", "coef"]]
        .to_dict(orient="records"),
    }
    (out / "analysis_summary.json").write_text(
        json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8"
    )

    html = f"""<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>PCOS Deep Analysis Report</title>
  <style>
    body {{ font-family: Arial, sans-serif; margin: 24px; color: #222; }}
    h1, h2 {{ margin-bottom: 8px; }}
    .grid {{ display: grid; grid-template-columns: repeat(3, minmax(220px, 1fr)); gap: 12px; margin: 12px 0 20px; }}
    .card {{ border: 1px solid #ddd; border-radius: 8px; padding: 12px; }}
    .muted {{ color: #666; }}
    table {{ border-collapse: collapse; width: 100%; margin: 8px 0 18px; }}
    th, td {{ border: 1px solid #ddd; padding: 8px; text-align: left; font-size: 14px; }}
    th {{ background: #f5f5f5; }}
    img {{ max-width: 100%; border: 1px solid #ddd; border-radius: 6px; margin: 10px 0; }}
    code {{ background: #f4f4f4; padding: 1px 4px; border-radius: 4px; }}
  </style>
</head>
<body>
  <h1>PCOS Deep Analysis Report</h1>
  <p class="muted">Source: <code>{src.name}</code> (sheet: <code>Full_new</code>)</p>

  <h2>1) Dataset Overview</h2>
  <div class="grid">
    <div class="card"><b>Rows</b><br>{summary["dataset"]["rows"]}</div>
    <div class="card"><b>Columns</b><br>{summary["dataset"]["columns"]}</div>
    <div class="card"><b>PCOS Rate</b><br>{summary["class_balance"]["pcos_rate"]:.1%}</div>
  </div>

  <h2>2) Model Performance (5-fold CV, Logistic Regression)</h2>
  <div class="grid">
    <div class="card"><b>Accuracy</b><br>{metrics["accuracy"]:.3f}</div>
    <div class="card"><b>Precision</b><br>{metrics["precision"]:.3f}</div>
    <div class="card"><b>Recall</b><br>{metrics["recall"]:.3f}</div>
    <div class="card"><b>F1</b><br>{metrics["f1"]:.3f}</div>
    <div class="card"><b>ROC-AUC</b><br>{metrics["roc_auc"]:.3f}</div>
    <div class="card"><b>Confusion Matrix</b><br>{metrics["confusion_matrix"]}</div>
  </div>

  <h2>3) Top Correlated Features</h2>
  <table>
    <thead><tr><th>Feature</th><th>Correlation</th></tr></thead>
    <tbody>
      {"".join(f"<tr><td>{r['feature']}</td><td>{r['corr']:.3f}</td></tr>" for r in summary["top_correlations"])}
    </tbody>
  </table>

  <h2>4) Visualizations</h2>
  <p><b>Top Coefficients</b></p>
  <img src="top_coefficients.png" alt="Top coefficients" />
  <p><b>Predicted Probability Distribution</b></p>
  <img src="prediction_distribution.png" alt="Prediction distribution" />

  <h2>5) Exported Files</h2>
  <ul>
    <li><code>analysis_summary.json</code>: Core summary metrics</li>
    <li><code>binary_feature_chi2.csv</code>: Chi-square tests for binary features</li>
    <li><code>numeric_feature_ttest.csv</code>: Mean difference tests for numeric features</li>
    <li><code>top_model_features.csv</code>: Model coefficient importances</li>
    <li><code>top_correlations.csv</code>: Top label correlations</li>
  </ul>
</body>
</html>
"""
    (out / "pcos_deep_report.html").write_text(html, encoding="utf-8")
    print(f"Report generated in: {out}")


if __name__ == "__main__":
    main()

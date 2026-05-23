#!/usr/bin/env python3
"""
Export a browser-scorable logistic joint model (numeric columns only) for the portal.

Re-trains the same pipeline as pcos_deep_analysis.py and writes:
  patient-doctor-portal/research-figures/pcos_joint_model.json

Run from repo root:
  python3 backup/scripts/export_pcos_joint_model.py

Called automatically by backup/scripts/sync_portal_research.py when the PCOS workbook exists.
"""
from __future__ import annotations

import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import roc_auc_score
from sklearn.model_selection import StratifiedKFold, cross_val_predict
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

SCRIPTS = Path(__file__).resolve().parent
if str(SCRIPTS) not in sys.path:
    sys.path.insert(0, str(SCRIPTS))

from dataset_paths import PCOS_XLSX  # noqa: E402

REPO = SCRIPTS.parents[1]
DEFAULT_OUT = REPO / "patient-doctor-portal" / "research-figures" / "pcos_joint_model.json"

TARGET = "PCOS (Y/N)"
LAB_SKIP = {
    "Sl. No",
    "Patient File No.",
    "Blood Group",
    "Height(Cm)",
    "I beta-HCG(mIU/mL)",
    "II beta-HCG(mIU/mL)",
}


def sanitize_columns(df: pd.DataFrame) -> pd.DataFrame:
    renamed = {c: " ".join(str(c).split()) for c in df.columns}
    return df.rename(columns=renamed)


def pretty_feature(name: str) -> str:
    return re.sub(r"^num__", "", name).replace("(Y/N)", " (Y/N)")


def slug_feature(name: str) -> str:
    s = re.sub(r"[^a-z0-9]+", "_", name.strip().lower())
    return s.strip("_") or "lab"


def load_pcos_frame() -> pd.DataFrame:
    if not PCOS_XLSX.is_file():
        raise FileNotFoundError(f"Missing PCOS dataset: {PCOS_XLSX}")
    df = pd.read_excel(PCOS_XLSX, sheet_name="Full_new")
    df = sanitize_columns(df)
    df[TARGET] = pd.to_numeric(df[TARGET], errors="coerce")
    df = df.dropna(subset=[TARGET]).copy()
    df[TARGET] = df[TARGET].astype(int)
    return df


def export_joint_model(out_path: Path) -> dict:
    df = load_pcos_frame()
    y = df[TARGET]

    num_cols: list[str] = []
    for c in df.columns:
        if c == TARGET or c in LAB_SKIP:
            continue
        col = pd.to_numeric(df[c], errors="coerce")
        if col.notna().mean() < 0.9:
            continue
        num_cols.append(c)

    X = df[num_cols].apply(pd.to_numeric, errors="coerce")

    imputer = SimpleImputer(strategy="median")
    scaler = StandardScaler()
    clf = LogisticRegression(max_iter=2000, class_weight="balanced")

    X_imp = imputer.fit_transform(X)
    X_scaled = scaler.fit_transform(X_imp)
    clf.fit(X_scaled, y)

    cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)
    prob = cross_val_predict(
        Pipeline(
            steps=[
                ("imputer", SimpleImputer(strategy="median")),
                ("scaler", StandardScaler()),
                ("clf", LogisticRegression(max_iter=2000, class_weight="balanced")),
            ]
        ),
        X,
        y,
        cv=cv,
        method="predict_proba",
    )[:, 1]
    cv_auc = float(roc_auc_score(y, prob))

    medians = imputer.statistics_
    means = scaler.mean_
    scales = scaler.scale_
    coefs = clf.coef_[0]
    intercept = float(clf.intercept_[0])

    features: list[dict] = []
    for i, col in enumerate(num_cols):
        pretty = pretty_feature(col)
        features.append(
            {
                "id": slug_feature(pretty),
                "column": col,
                "feature": pretty,
                "kind": "numeric",
                "median": round(float(medians[i]), 6),
                "mean": round(float(means[i]), 6),
                "std": round(float(scales[i]) if scales[i] > 1e-12 else 1.0, 6),
                "coef": round(float(coefs[i]), 6),
            }
        )

    features.sort(key=lambda x: x["feature"].lower())

    payload = {
        "version": 1,
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "source": str(PCOS_XLSX.name),
        "n": int(len(df)),
        "pcosLabeledCount": int(y.sum()),
        "featureCount": len(features),
        "intercept": round(intercept, 6),
        "cvRocAuc": round(cv_auc, 4),
        "disclaimer": (
            "In-cohort logistic model (numeric features, median imputation). "
            "Research reference only — not external validation or individual diagnosis."
        ),
        "features": features,
    }

    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    return payload


def main() -> None:
    out = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_OUT
    payload = export_joint_model(out)
    print(f"Wrote {out} ({payload['featureCount']} features, CV AUC={payload['cvRocAuc']})")


if __name__ == "__main__":
    main()

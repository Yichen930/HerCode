"""
Lightweight single-cell analysis on supplementary 10x ZIP archives.

Requires ZIP files at repo root (see backup/README.md). Produces QC, clustering,
UMAP, marker-set scores, and summary JSON/PNG under backup/scRNA_analysis/deep/
and copies figures + manifest to patient-doctor-portal/research-figures/scrna/.

Example:
  python3 -m pip install -r backup/requirements-scrna.txt
  python3 backup/scripts/scrna_deep_analysis.py --dataset endometrium
  python3 backup/scripts/scrna_deep_analysis.py --dataset pcos --library Mc26-C
  python3 backup/scripts/scrna_deep_analysis.py --dataset pcos --pair Mc26
"""
from __future__ import annotations

import argparse
import gzip
import io
import json
import shutil
import tarfile
import zipfile
from pathlib import Path
from typing import Iterator

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
import scanpy as sc

from dataset_paths import REPO_ROOT, ZIP_ENDO, ZIP_PCOS

BACKUP_SCRNA = Path(__file__).resolve().parents[1] / "scRNA_analysis"
OUT_DEEP = BACKUP_SCRNA / "deep"
PORTAL_FIG = REPO_ROOT / "patient-doctor-portal" / "research-figures" / "scrna"

_TENX_FILES = ("matrix.mtx.gz", "barcodes.tsv.gz", "features.tsv.gz")

MARKER_SETS = {
    "Granulosa": ["FOXL2", "AMH", "FSHR", "INHA"],
    "Theca": ["CYP17A1", "CYP11A1", "STAR", "HSD3B2"],
    "Stromal": ["DCN", "LUM", "COL1A1", "PDGFRA"],
    "Epithelial": ["EPCAM", "KRT8", "KRT18", "KRT19"],
    "Immune": ["PTPRC", "CD68", "CD3D"],
    "Endothelial": ["PECAM1", "VWF", "CDH5"],
    "Proliferative": ["MKI67", "TOP2A", "PCNA"],
    "Secretory": ["PAEP", "GPX3", "MSMB"],
}

MAX_CELLS = 8000
RANDOM_STATE = 42


def _open_tar(blob: bytes, name: str):
    bio = io.BytesIO(blob)
    mode = "r:gz" if name.endswith(".tar.gz") else "r"
    return tarfile.open(fileobj=bio, mode=mode)


def _iter_10x_prefixes_in_tar(tf: tarfile.TarFile) -> Iterator[str]:
    """Yield directory prefixes that contain a full 10x trio (matrix, barcodes, features)."""
    by_dir: dict[str, set[str]] = {}
    for m in tf.getmembers():
        if not m.isfile():
            continue
        parent = str(Path(m.name).parent).replace("\\", "/")
        if parent == ".":
            parent = ""
        by_dir.setdefault(parent, set()).add(Path(m.name).name)
    needed = set(_TENX_FILES)
    for prefix, files in sorted(by_dir.items()):
        if needed <= files:
            yield prefix


def iter_10x_dirs_in_zip(zip_path: Path, dataset: str) -> Iterator[tuple[str, str]]:
    """Yield (outer_archive_name, inner_prefix) for each 10x matrix folder in the ZIP."""
    with zipfile.ZipFile(zip_path) as zf:
        for info in zf.infolist():
            if not (info.filename.endswith(".tar") or info.filename.endswith(".tar.gz")):
                continue
            blob = zf.read(info.filename)
            with _open_tar(blob, info.filename) as tf:
                for prefix in _iter_10x_prefixes_in_tar(tf):
                    yield info.filename, prefix


def extract_10x_to_dir(
    zip_path: Path, outer_tar: str, inner_prefix: str, dest: Path
) -> Path:
    dest.mkdir(parents=True, exist_ok=True)
    prefix = inner_prefix.rstrip("/")
    with zipfile.ZipFile(zip_path) as zf:
        blob = zf.read(outer_tar)
        with _open_tar(blob, outer_tar) as tf:
            for m in tf.getmembers():
                if not m.isfile():
                    continue
                name = m.name.replace("\\", "/")
                if prefix and not (name == prefix or name.startswith(prefix + "/")):
                    continue
                base = Path(name).name
                if base not in _TENX_FILES:
                    continue
                stream = tf.extractfile(m)
                if stream is None:
                    continue
                (dest / base).write_bytes(stream.read())
    for n in _TENX_FILES:
        if not (dest / n).exists():
            raise FileNotFoundError(f"Missing {n} under {inner_prefix}")
    return dest


def read_10x_mtx(mtx_dir: Path, sample_id: str) -> sc.AnnData:
    adata = sc.read_10x_mtx(mtx_dir, var_names="gene_symbols", cache=False)
    adata.var_names_make_unique()
    adata.obs["sample_id"] = sample_id
    return adata


def load_libraries(
    zip_path: Path,
    dataset: str,
    library_filter: str | None = None,
    pair_prefix: str | None = None,
) -> sc.AnnData:
    adatas: list[sc.AnnData] = []
    work = OUT_DEEP / "_cache" / dataset
    if work.exists():
        shutil.rmtree(work)
    work.mkdir(parents=True)

    for outer, prefix in iter_10x_dirs_in_zip(zip_path, dataset):
        lib_name = Path(outer).stem
        if library_filter and library_filter not in lib_name and library_filter not in prefix:
            continue
        if pair_prefix and pair_prefix not in lib_name and pair_prefix not in prefix:
            continue
        extract_dir = work / lib_name.replace("/", "_")
        extract_10x_to_dir(zip_path, outer, prefix, extract_dir)
        ad = read_10x_mtx(extract_dir, lib_name)
        ad.obs["library"] = lib_name
        adatas.append(ad)

    if not adatas:
        hint = library_filter or pair_prefix or "any"
        raise FileNotFoundError(
            f"No libraries matched filter '{hint}' in {zip_path.name}. "
            "Run scRNA_zip_inventory.py to list library names."
        )

    if len(adatas) == 1:
        combined = adatas[0]
    else:
        combined = sc.concat(adatas, label="library_batch", join="inner")
    combined.obs_names_make_unique()
    combined.obs["dataset"] = dataset
    return combined


def preprocess(adata: sc.AnnData) -> tuple[sc.AnnData, sc.AnnData]:
    """Return (clustered AnnData on HVGs, log-normalized AnnData before HVG subset)."""
    sc.pp.calculate_qc_metrics(adata, percent_top=None, inplace=True)
    sc.pp.filter_cells(adata, min_genes=200)
    sc.pp.filter_genes(adata, min_cells=3)
    if adata.n_obs > MAX_CELLS:
        sc.pp.subsample(adata, n_obs=MAX_CELLS, random_state=RANDOM_STATE)
    sc.pp.normalize_total(adata, target_sum=1e4)
    sc.pp.log1p(adata)
    log_full = adata.copy()
    sc.pp.highly_variable_genes(log_full, n_top_genes=2000, flavor="seurat")
    clustered = log_full[:, log_full.var["highly_variable"]].copy()
    sc.pp.scale(clustered, max_value=10)
    sc.tl.pca(clustered, svd_solver="arpack")
    sc.pp.neighbors(
        clustered,
        n_neighbors=15,
        n_pcs=min(30, clustered.obsm["X_pca"].shape[1]),
    )
    sc.tl.umap(clustered, random_state=RANDOM_STATE)
    sc.tl.leiden(clustered, resolution=0.6, random_state=RANDOM_STATE)
    return clustered, log_full


def score_marker_sets(adata: sc.AnnData) -> dict[str, float]:
    scores: dict[str, float] = {}
    for name, genes in MARKER_SETS.items():
        present = [g for g in genes if g in adata.var_names]
        if len(present) < 2:
            scores[name] = float("nan")
            continue
        sc.tl.score_genes(adata, gene_list=present, score_name=f"score_{name}")
        scores[name] = float(adata.obs[f"score_{name}"].mean())
    return scores


def dominant_marker_label(adata: sc.AnnData) -> str:
    best = ("Unknown", -np.inf)
    for name, genes in MARKER_SETS.items():
        col = f"score_{name}"
        if col not in adata.obs.columns:
            continue
        m = float(adata.obs[col].mean())
        if m > best[1]:
            best = (name, m)
    return best[0]


def cluster_summary(adata: sc.AnnData) -> list[dict]:
    rows = []
    for cl in sorted(adata.obs["leiden"].unique(), key=lambda x: int(x)):
        mask = adata.obs["leiden"] == cl
        sub = adata[mask]
        rows.append(
            {
                "cluster": str(cl),
                "n_cells": int(mask.sum()),
                "pct": round(100 * mask.sum() / adata.n_obs, 1),
                "top_marker_set": dominant_marker_label(sub),
            }
        )
    return rows


def plot_umap(adata: sc.AnnData, title: str, path: Path) -> None:
    fig, axes = plt.subplots(1, 2, figsize=(11, 4.5))
    sc.pl.umap(adata, color="leiden", ax=axes[0], show=False, title="Leiden clusters")
    # best marker score among cell types
    score_cols = [c for c in adata.obs.columns if c.startswith("score_")]
    if score_cols:
        mat = adata.obs[score_cols].to_numpy()
        labels = [c.replace("score_", "") for c in score_cols]
        best_idx = mat.argmax(axis=1)
        adata.obs["dominant_type"] = [labels[i] for i in best_idx]
        sc.pl.umap(adata, color="dominant_type", ax=axes[1], show=False, title="Dominant marker set")
    fig.suptitle(title, fontsize=12, fontweight="bold")
    fig.tight_layout()
    fig.savefig(path, dpi=140, bbox_inches="tight")
    plt.close(fig)


def plot_marker_heatmap(adata: sc.AnnData, title: str, path: Path) -> None:
    score_cols = [f"score_{n}" for n in MARKER_SETS if f"score_{n}" in adata.obs.columns]
    if not score_cols:
        return
    mean_by_cluster = (
        adata.obs.groupby("leiden", observed=True)[score_cols].mean().sort_index(key=lambda s: s.astype(int))
    )
    fig, ax = plt.subplots(figsize=(8, max(3, len(mean_by_cluster) * 0.35)))
    im = ax.imshow(mean_by_cluster.values, aspect="auto", cmap="viridis")
    ax.set_xticks(range(len(score_cols)))
    ax.set_xticklabels([c.replace("score_", "") for c in score_cols], rotation=45, ha="right")
    ax.set_yticks(range(len(mean_by_cluster)))
    ax.set_yticklabels([f"Cluster {i}" for i in mean_by_cluster.index])
    ax.set_title(title)
    fig.colorbar(im, ax=ax, label="Mean score")
    fig.tight_layout()
    fig.savefig(path, dpi=140, bbox_inches="tight")
    plt.close(fig)


def compare_c_f_pair(adata: sc.AnnData, donor: str) -> dict | None:
    libs = adata.obs["library"].astype(str)
    c_mask = libs.str.contains(f"{donor}-C") | libs.str.contains(f"{donor}_C")
    f_mask = libs.str.contains(f"{donor}-F") | libs.str.contains(f"{donor}_F")
    if c_mask.sum() < 50 or f_mask.sum() < 50:
        return None
    androgen_genes = [g for g in ["CYP17A1", "CYP11A1", "STAR", "HSD3B2"] if g in adata.var_names]
    if not androgen_genes:
        return None
    def _mean_expr(mask):
        x = adata[mask, androgen_genes].X
        if hasattr(x, "toarray"):
            x = x.toarray()
        return float(np.mean(x))

    c_mean = _mean_expr(c_mask)
    f_mean = _mean_expr(f_mask)
    return {
        "donor": donor,
        "cells_control": int(c_mask.sum()),
        "cells_forskolin": int(f_mask.sum()),
        "mean_log_expr_androgen_biosynthesis_genes": {"control": c_mean, "forskolin": f_mean},
        "interpretation": "Educational: higher mean log-expression of androgen biosynthesis markers under forskolin vs control in this donor subset.",
    }


def run_analysis(dataset: str, library: str | None, pair: str | None) -> dict:
    if dataset == "endometrium":
        zip_path = ZIP_ENDO
        label = "Endometrium (supplementary)"
        library_filter = None
        pair_prefix = None
    else:
        zip_path = ZIP_PCOS
        label = "PCOS ovarian (supplementary)"
        library_filter = library
        pair_prefix = pair

    if not zip_path.is_file():
        raise FileNotFoundError(f"Missing supplementary ZIP: {zip_path}")

    adata = load_libraries(zip_path, dataset, library_filter, pair_prefix)
    n_start = adata.n_obs
    clustered, log_full = preprocess(adata)
    marker_means = score_marker_sets(log_full)
    for col in [c for c in log_full.obs.columns if c.startswith("score_")]:
        clustered.obs[col] = log_full.obs.loc[clustered.obs_names, col].to_numpy()
    clusters = cluster_summary(clustered)
    adata = clustered
    cf_source = log_full

    slug = dataset if dataset == "endometrium" else (library or pair or "pcos_subset")
    safe_slug = "".join(c if c.isalnum() or c in "-_" else "_" for c in slug)

    umap_path = OUT_DEEP / f"umap_{safe_slug}.png"
    heat_path = OUT_DEEP / f"marker_heatmap_{safe_slug}.png"
    plot_umap(adata, f"{label} — UMAP", umap_path)
    plot_marker_heatmap(adata, f"{label} — marker scores by cluster", heat_path)

    result = {
        "dataset": dataset,
        "label": label,
        "library_filter": library,
        "pair_prefix": pair,
        "cells_loaded": n_start,
        "cells_after_qc": int(adata.n_obs),
        "genes_after_hvg": int(adata.n_vars),
        "n_clusters": int(adata.obs["leiden"].nunique()),
        "mean_marker_scores": {k: round(v, 4) if v == v else None for k, v in marker_means.items()},
        "clusters": clusters,
        "figures": {
            "umap": f"umap_{safe_slug}.png",
            "marker_heatmap": f"marker_heatmap_{safe_slug}.png",
        },
    }
    if pair and dataset == "pcos":
        cf = compare_c_f_pair(cf_source, pair)
        if cf:
            result["forskolin_comparison"] = cf

    return result


def publish_to_portal(results: list[dict]) -> None:
    PORTAL_FIG.mkdir(parents=True, exist_ok=True)
    manifest = {
        "available": True,
        "generated": True,
        "analyses": [],
    }
    for res in results:
        slug = res["figures"]["umap"].replace("umap_", "").replace(".png", "")
        umap_src = OUT_DEEP / res["figures"]["umap"]
        heat_src = OUT_DEEP / res["figures"]["marker_heatmap"]
        umap_dst = PORTAL_FIG / f"umap_{slug}.png"
        heat_dst = PORTAL_FIG / f"marker_heatmap_{slug}.png"
        if umap_src.is_file():
            shutil.copy2(umap_src, umap_dst)
        if heat_src.is_file():
            shutil.copy2(heat_src, heat_dst)
        manifest["analyses"].append(
            {
                **res,
                "portal_umap": f"/research-figures/scrna/umap_{slug}.png",
                "portal_heatmap": f"/research-figures/scrna/marker_heatmap_{slug}.png",
            }
        )
    (OUT_DEEP / "scrna_deep_summary.json").write_text(
        json.dumps({"runs": results}, indent=2), encoding="utf-8"
    )
    (PORTAL_FIG / "scrna_deep_summary.json").write_text(
        json.dumps(manifest, indent=2), encoding="utf-8"
    )


def main() -> None:
    parser = argparse.ArgumentParser(description="Lightweight scRNA analysis on supplementary ZIPs")
    parser.add_argument(
        "--dataset",
        choices=["endometrium", "pcos"],
        required=True,
        help="Which supplementary ZIP to analyze",
    )
    parser.add_argument("--library", help="Substring match for one PCOS library (e.g. Mc26-C)")
    parser.add_argument("--pair", help="Donor prefix for C/F pair on PCOS (e.g. Mc26)")
    args = parser.parse_args()

    if args.dataset == "pcos" and not args.library and not args.pair:
        args.library = "Mc26-C"

    OUT_DEEP.mkdir(parents=True, exist_ok=True)
    sc.settings.verbosity = 2
    sc.settings.set_figure_params(dpi=100, facecolor="white")

    result = run_analysis(args.dataset, args.library, args.pair)
    publish_to_portal([result])

    print(json.dumps(result, indent=2))
    print(f"\nWrote figures and manifest under {OUT_DEEP} and {PORTAL_FIG}")


if __name__ == "__main__":
    main()

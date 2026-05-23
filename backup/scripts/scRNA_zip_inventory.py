"""
Inventory 10x-style single-cell archives inside the two supplementary ZIPs.
Reads only MTX headers + optional feature peek (no full matrix load).
"""
from __future__ import annotations

import csv
import gzip
import io
import json
import tarfile
import zipfile
from dataclasses import dataclass
from pathlib import Path
from typing import Iterator


@dataclass
class SampleRow:
    dataset: str
    archive_in_zip: str
    matrix_member: str
    n_genes: int
    n_cells: int
    nnz: int

    @property
    def nnz_per_cell(self) -> float:
        return self.nnz / max(self.n_cells, 1)

    @property
    def sparsity(self) -> float:
        denom = max(self.n_genes * self.n_cells, 1)
        return 1.0 - (self.nnz / denom)


def _first_mtx_triplet_from_gz_stream(stream) -> tuple[int, int, int]:
    gz = gzip.GzipFile(fileobj=stream)
    for raw in gz:
        line = raw.decode().strip()
        if not line or line.startswith("%"):
            continue
        a, b, c = map(int, line.split())
        return a, b, c
    raise ValueError("Empty or invalid MTX stream")


DEEP_PORTAL_LIBRARIES = frozenset(
    {"UA_Endo12269811", "UA_Endo12604667", "Mc26-C", "Mc26-F"}
)


def library_id_from_row(row: SampleRow) -> str:
    base = Path(row.archive_in_zip).name
    if base.endswith(".tar.gz"):
        base = base[: -len(".tar.gz")]
    elif base.endswith(".tar"):
        base = base[: -len(".tar")]
    if "_FX" in base:
        base = base.split("_FX", 1)[0]
    return base


def arm_label(library_id: str) -> str:
    if library_id.endswith("-C"):
        return "Control (C)"
    if library_id.endswith("-F"):
        return "Forskolin (F)"
    return "—"


def _fmt_int(n: int | float) -> str:
    return f"{int(round(n)):,}"


def _fmt_float(n: float, digits: int = 0) -> str:
    return f"{n:,.{digits}f}"


def build_inventory_report_html(rows: list[SampleRow], summary: dict) -> str:
    endo = summary["Endometrium"]
    pcos = summary["PCOS"]
    total_libs = len(rows)
    deep_count = sum(
        1 for r in rows if library_id_from_row(r) in DEEP_PORTAL_LIBRARIES
    )

    table_rows = []
    for r in sorted(rows, key=lambda x: (x.dataset, library_id_from_row(x))):
        lib_id = library_id_from_row(r)
        deep = lib_id in DEEP_PORTAL_LIBRARIES
        dataset_label = "Endometrium" if r.dataset == "Endometrium" else "PCOS ovarian"
        filter_key = "endo" if r.dataset == "Endometrium" else "pcos"
        badge = (
            '<span class="badge badge--deep">UMAP on portal</span>'
            if deep
            else '<span class="badge badge--listed">Listed only</span>'
        )
        row_class = "row--deep" if deep else ""
        table_rows.append(
            f"""<tr class="{row_class}" data-dataset="{filter_key}" data-deep="{"1" if deep else "0"}">
  <td>{dataset_label}</td>
  <td><code>{lib_id}</code></td>
  <td>{arm_label(lib_id)}</td>
  <td class="num">{_fmt_int(r.n_cells)}</td>
  <td class="num">{_fmt_float(r.nnz_per_cell, 0)}</td>
  <td>{badge}</td>
  <td class="archive muted" title="{r.archive_in_zip}">{r.archive_in_zip}</td>
</tr>"""
        )
    tbody = "\n".join(table_rows)

    notes_html = "".join(f"<li>{note}</li>" for note in summary.get("notes", []))

    return f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>Single-cell library inventory — HearHer research</title>
<style>
:root {{
  --text: #1a1a22;
  --muted: #5c5c6a;
  --border: #e4e4ec;
  --accent: #6b4f8a;
  --accent-soft: #f3eff8;
  --surface: #fafafb;
}}
* {{ box-sizing: border-box; }}
body {{
  margin: 0;
  font-family: "Segoe UI", system-ui, -apple-system, sans-serif;
  color: var(--text);
  background: var(--surface);
  line-height: 1.5;
}}
.wrap {{ max-width: 1100px; margin: 0 auto; padding: 28px 20px 48px; }}
.top-bar {{
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 20px;
}}
.back-link {{
  color: var(--accent);
  font-weight: 600;
  text-decoration: none;
  font-size: 0.9rem;
}}
.back-link:hover {{ text-decoration: underline; }}
h1 {{ margin: 0 0 8px; font-size: 1.65rem; font-weight: 800; }}
.lead {{ margin: 0 0 20px; color: var(--muted); max-width: 42rem; }}
.scope {{
  margin: 0 0 24px;
  padding: 12px 16px;
  border-radius: 10px;
  border: 1px solid #e8dff5;
  background: #faf7ff;
  font-size: 0.9rem;
}}
.scope strong {{ color: var(--accent); }}
.cards {{
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 14px;
  margin-bottom: 28px;
}}
.card {{
  background: #fff;
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 16px 18px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.04);
}}
.card h2 {{ margin: 0 0 12px; font-size: 1rem; font-weight: 800; }}
.stat-grid {{ display: grid; grid-template-columns: 1fr 1fr; gap: 10px 16px; }}
.stat dt {{ margin: 0; font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.04em; color: var(--muted); font-weight: 600; }}
.stat dd {{ margin: 2px 0 0; font-size: 1.05rem; font-weight: 700; }}
.notes {{
  margin: 0 0 28px;
  padding: 14px 18px;
  background: #fff;
  border: 1px solid var(--border);
  border-radius: 12px;
  font-size: 0.88rem;
}}
.notes h2 {{ margin: 0 0 8px; font-size: 0.95rem; }}
.notes ul {{ margin: 0; padding-left: 1.2rem; color: var(--muted); }}
.panel {{
  background: #fff;
  border: 1px solid var(--border);
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 1px 3px rgba(0,0,0,0.04);
}}
.panel-head {{
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  justify-content: space-between;
  gap: 12px;
  padding: 16px 18px;
  border-bottom: 1px solid var(--border);
}}
.panel-head h2 {{ margin: 0; font-size: 1.05rem; font-weight: 800; }}
.panel-head p {{ margin: 4px 0 0; font-size: 0.85rem; color: var(--muted); }}
.filters {{ display: flex; flex-wrap: wrap; gap: 6px; }}
.filter-btn {{
  appearance: none;
  border: 1px solid var(--border);
  background: #fff;
  border-radius: 999px;
  padding: 6px 12px;
  font: inherit;
  font-size: 0.8rem;
  font-weight: 600;
  cursor: pointer;
}}
.filter-btn:hover {{ border-color: var(--accent); }}
.filter-btn.is-active {{
  background: var(--accent);
  border-color: var(--accent);
  color: #fff;
}}
.table-scroll {{ overflow: auto; max-height: 520px; }}
table {{ border-collapse: collapse; width: 100%; font-size: 0.85rem; }}
th, td {{ padding: 10px 12px; text-align: left; border-bottom: 1px solid var(--border); }}
th {{
  position: sticky;
  top: 0;
  background: #f6f6f9;
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  color: var(--muted);
  z-index: 1;
}}
td.num {{ text-align: right; font-variant-numeric: tabular-nums; }}
td.archive {{ max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 0.78rem; }}
tr.row--deep {{ background: #faf7ff; }}
code {{ font-size: 0.82rem; background: #f0f0f5; padding: 2px 6px; border-radius: 4px; }}
.badge {{
  display: inline-block;
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 0.72rem;
  font-weight: 700;
  white-space: nowrap;
}}
.badge--deep {{ background: var(--accent-soft); color: var(--accent); }}
.badge--listed {{ background: #eef4fb; color: #2a4a6f; }}
.foot {{
  margin-top: 14px;
  padding: 0 18px 16px;
  font-size: 0.85rem;
  color: var(--muted);
}}
.foot a {{ color: var(--accent); font-weight: 600; }}
</style>
</head>
<body>
<div class="wrap">
  <div class="top-bar">
    <a class="back-link" href="/index.html#/doctor/research">← Back to Reference library</a>
  </div>
  <h1>Single-cell library inventory</h1>
  <p class="lead">All {total_libs} supplementary 10x libraries from the hackathon ZIP archives. Cell counts come from MTX headers only (no full matrix loaded).</p>
  <p class="scope"><strong>Reference data only</strong> — not from patients using HearHer. The portal shows UMAP deep dives for <strong>{deep_count} libraries</strong> (combined endometrium + PCOS donor Mc26).</p>

  <div class="cards">
    <article class="card">
      <h2>Endometrium</h2>
      <dl class="stat-grid">
        <div><dt>Libraries</dt><dd>{endo["libraries"]}</dd></div>
        <div><dt>Total cells</dt><dd>{_fmt_int(endo["total_cells"])}</dd></div>
        <div><dt>Mean cells / library</dt><dd>{_fmt_int(endo["mean_cells_per_library"])}</dd></div>
        <div><dt>Mean UMIs / cell</dt><dd>{_fmt_float(endo["mean_nnz_per_cell"], 0)}</dd></div>
      </dl>
    </article>
    <article class="card">
      <h2>PCOS ovarian</h2>
      <dl class="stat-grid">
        <div><dt>Libraries</dt><dd>{pcos["libraries"]}</dd></div>
        <div><dt>Total cells</dt><dd>{_fmt_int(pcos["total_cells"])}</dd></div>
        <div><dt>Mean cells / library</dt><dd>{_fmt_int(pcos["mean_cells_per_library"])}</dd></div>
        <div><dt>Mean UMIs / cell</dt><dd>{_fmt_float(pcos["mean_nnz_per_cell"], 0)}</dd></div>
      </dl>
    </article>
    <article class="card">
      <h2>Matrix format</h2>
      <dl class="stat-grid">
        <div style="grid-column: 1 / -1"><dt>Reference</dt><dd style="font-size:0.85rem;font-weight:600">{summary["feature_reference"]}</dd></div>
        <div style="grid-column: 1 / -1"><dt>Structure</dt><dd style="font-size:0.8rem;font-weight:500;line-height:1.4">10x filtered_feature_bc_matrix inside per-sample tar archives within each ZIP</dd></div>
      </dl>
    </article>
  </div>

  <section class="notes">
    <h2>Notes</h2>
    <ul>{notes_html}</ul>
  </section>

  <section class="panel">
    <header class="panel-head">
      <div>
        <h2>Per-library table</h2>
        <p id="row-count">Showing {total_libs} libraries</p>
      </div>
      <div class="filters" role="group" aria-label="Filter table">
        <button type="button" class="filter-btn is-active" data-filter="all">All</button>
        <button type="button" class="filter-btn" data-filter="deep">UMAP on portal ({deep_count})</button>
        <button type="button" class="filter-btn" data-filter="endo">Endometrium</button>
        <button type="button" class="filter-btn" data-filter="pcos">PCOS</button>
      </div>
    </header>
    <div class="table-scroll">
      <table>
        <thead>
          <tr>
            <th>Dataset</th>
            <th>Library ID</th>
            <th>Study arm</th>
            <th>Cells</th>
            <th>Mean UMIs/cell</th>
            <th>Portal</th>
            <th>Archive in ZIP</th>
          </tr>
        </thead>
        <tbody>
{tbody}
        </tbody>
      </table>
    </div>
    <p class="foot">Machine-readable export: <a href="single_cell_sample_inventory.csv">single_cell_sample_inventory.csv</a></p>
  </section>
</div>
<script>
(function () {{
  const rows = document.querySelectorAll("tbody tr[data-dataset]");
  const countEl = document.getElementById("row-count");
  const buttons = document.querySelectorAll("[data-filter]");
  function apply(filter) {{
    let n = 0;
    rows.forEach((row) => {{
      const ds = row.getAttribute("data-dataset");
      const deep = row.getAttribute("data-deep") === "1";
      const show = filter === "all" || (filter === "deep" && deep) || ds === filter;
      row.hidden = !show;
      if (show) n++;
    }});
    if (countEl) countEl.textContent = "Showing " + n + " of " + rows.length + " libraries";
    buttons.forEach((b) => b.classList.toggle("is-active", b.getAttribute("data-filter") === filter));
  }}
  buttons.forEach((b) => b.addEventListener("click", () => apply(b.getAttribute("data-filter"))));
}})();
</script>
</body>
</html>"""


def iter_mtx_samples(zip_path: Path, dataset_label: str) -> Iterator[SampleRow]:
    with zipfile.ZipFile(zip_path) as zf:
        for info in zf.infolist():
            name = info.filename
            if name.endswith(".tar.gz"):
                mode = "r:gz"
            elif name.endswith(".tar"):
                mode = "r"
            else:
                continue
            blob = zf.read(name)
            bio = io.BytesIO(blob)
            with tarfile.open(fileobj=bio, mode=mode) as tf:
                for m in tf.getmembers():
                    if not m.name.endswith("matrix.mtx.gz"):
                        continue
                    mtx_stream = tf.extractfile(m)
                    if mtx_stream is None:
                        continue
                    genes, cells, nnz = _first_mtx_triplet_from_gz_stream(mtx_stream)
                    yield SampleRow(
                        dataset=dataset_label,
                        archive_in_zip=name,
                        matrix_member=m.name,
                        n_genes=genes,
                        n_cells=cells,
                        nnz=nnz,
                    )


def main() -> None:
    from dataset_paths import ZIP_ENDO, ZIP_PCOS

    backup_root = Path(__file__).resolve().parents[1]
    out_dir = backup_root / "scRNA_analysis"
    out_dir.mkdir(exist_ok=True)

    z_endo = ZIP_ENDO
    z_pcos = ZIP_PCOS

    rows = list(iter_mtx_samples(z_endo, "Endometrium")) + list(
        iter_mtx_samples(z_pcos, "PCOS")
    )

    csv_path = out_dir / "single_cell_sample_inventory.csv"
    with csv_path.open("w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(
            [
                "dataset",
                "archive_in_zip",
                "matrix_member",
                "n_genes",
                "n_cells",
                "nnz",
                "nnz_per_cell",
                "sparsity",
            ]
        )
        for r in rows:
            w.writerow(
                [
                    r.dataset,
                    r.archive_in_zip,
                    r.matrix_member,
                    r.n_genes,
                    r.n_cells,
                    r.nnz,
                    f"{r.nnz_per_cell:.2f}",
                    f"{r.sparsity:.4f}",
                ]
            )

    def agg(label: str) -> dict:
        sub = [r for r in rows if r.dataset == label]
        total_cells = sum(r.n_cells for r in sub)
        total_nnz = sum(r.nnz for r in sub)
        return {
            "libraries": len(sub),
            "total_cells": total_cells,
            "mean_cells_per_library": total_cells / max(len(sub), 1),
            "median_cells_per_library": float(
                sorted(r.n_cells for r in sub)[len(sub) // 2]
            )
            if sub
            else 0.0,
            "genes_per_matrix": sub[0].n_genes if sub else 0,
            "mean_nnz_per_cell": total_nnz / max(total_cells, 1),
        }

    summary = {
        "format": "10x Cell Ranger filtered_feature_bc_matrix (matrix.mtx.gz, barcodes.tsv.gz, features.tsv.gz) nested in per-sample .tar / .tar.gz inside each ZIP",
        "feature_reference": "GRCh38-style Cell Ranger gene list (Gene Expression); 36601 features in all inspected libraries",
        "Endometrium": agg("Endometrium"),
        "PCOS": agg("PCOS"),
        "notes": [
            "PCOS ZIP contains 20 libraries named Mc##-C and Mc##-F (10 donor codes × two conditions); interpret C/F from the original publication.",
            "Endometrium ZIP contains 2 libraries (UA_Endo… tar.gz).",
            "This script does not load full count matrices; QC, normalization, and clustering require Scanpy/Seurat and sufficient RAM.",
        ],
    }
    (out_dir / "single_cell_inventory_summary.json").write_text(
        json.dumps(summary, indent=2), encoding="utf-8"
    )

    html = build_inventory_report_html(rows, summary)
    (out_dir / "single_cell_inventory_report.html").write_text(html, encoding="utf-8")

    print(f"Wrote: {csv_path}")


if __name__ == "__main__":
    main()

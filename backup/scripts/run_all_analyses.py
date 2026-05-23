#!/usr/bin/env python3
"""Run all offline research pipelines (tabular + scRNA inventory + deep scRNA)."""
from __future__ import annotations

import subprocess
import sys
from pathlib import Path

SCRIPTS = Path(__file__).resolve().parent
PY = sys.executable


def run(cmd: list[str], label: str) -> None:
    print(f"\n=== {label} ===", flush=True)
    subprocess.run(cmd, check=True)


def main() -> None:
    run([PY, str(SCRIPTS / "pcos_deep_analysis.py")], "PCOS tabular deep analysis")
    run([PY, str(SCRIPTS / "compare_pcos_endo.py")], "PCOS vs endometriosis comparison")
    run([PY, str(SCRIPTS / "scRNA_zip_inventory.py")], "scRNA ZIP inventory")

    sys.path.insert(0, str(SCRIPTS))
    import scanpy as sc
    from scrna_deep_analysis import OUT_DEEP, publish_to_portal, run_analysis

    OUT_DEEP.mkdir(parents=True, exist_ok=True)
    sc.settings.verbosity = 2
    sc.settings.set_figure_params(dpi=100, facecolor="white")
    scrna_results = []
    for dataset, library, pair, label in [
        ("endometrium", None, None, "scRNA deep — endometrium"),
        ("pcos", None, "Mc26", "scRNA deep — PCOS Mc26 C/F"),
    ]:
        print(f"\n=== {label} ===", flush=True)
        scrna_results.append(run_analysis(dataset, library, pair))
    publish_to_portal(scrna_results)

    from sync_portal_research import sync_all
    from verify_portal_sync import verify

    print("\n=== Sync results to portal (researchData.js + figures) ===", flush=True)
    sync_all()
    print("\n=== Verify portal sync ===", flush=True)
    verify()
    print("\nAll analyses finished and portal is in sync.", flush=True)


if __name__ == "__main__":
    main()

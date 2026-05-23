# Backup — offline analysis & portal sync

Scripts and reports for hackathon datasets. **Not required** to run the web app (the portal uses synced `researchData.js`). Live patient data stays in SQLite / `localStorage`.

## One command

From repo root (files in [`../dataset/`](../dataset/)):

```bash
python3 -m pip install pandas numpy scipy scikit-learn matplotlib openpyxl
python3 -m pip install -r backup/requirements-scrna.txt
python3 backup/scripts/run_all_analyses.py
```

Runs all pipelines → **syncs** `patient-doctor-portal/js/researchData.js` + figures → **verify** (exits with error if portal ≠ backup JSON).

## Results (current run)

| Step | Output | Headline |
|------|--------|----------|
| PCOS tabular | `analysis_output/` | n=541, CV **AUC ~0.94** |
| PCOS vs endo | `compare_output/` | 177 vs 4,079, **AUC ~0.73** |
| scRNA inventory | `scRNA_analysis/` | 10,578 + 70,223 cells |
| scRNA deep | `scRNA_analysis/deep/`, portal `research-figures/scrna/` | Endometrium clusters; Mc26 forskolin ↑ androgen genes |

## `dataset/` inputs

| File | Pipeline |
|------|----------|
| `(Main_Dataset)_PCOS_data_without_infertility.xlsx` | Tabular + compare |
| `(Supplementary_Dataset)_structured_endometriosis_data.csv` | Compare (xlsx `in` sheet also OK) |
| `(Supplementary_Dataset)_*_single_cell_data.zip` | Inventory + Scanpy |

Paths: `scripts/dataset_paths.py`. ZIPs: `.tar` / `.tar.gz` at **zip root**.

## Pipelines (individual)

```bash
python3 backup/scripts/pcos_deep_analysis.py
python3 backup/scripts/compare_pcos_endo.py
python3 backup/scripts/scRNA_zip_inventory.py
python3 backup/scripts/scrna_deep_analysis.py --dataset endometrium
python3 backup/scripts/scrna_deep_analysis.py --dataset pcos --pair Mc26
```

| Script | Does |
|--------|------|
| `pcos_deep_analysis.py` | EDA, chi² / t-tests, logistic CV → `analysis_output/` + HTML report |
| `compare_pcos_endo.py` | Harmonized PCOS vs endo → `compare_output/` |
| `scRNA_zip_inventory.py` | MTX headers only (fast) → inventory CSV/JSON |
| `scrna_deep_analysis.py` | Scanpy QC → UMAP → Leiden → marker scores |

## Portal sync

| Script | Role |
|--------|------|
| `sync_portal_research.py` | Regenerates `researchData.js`, copies PNGs |
| `verify_portal_sync.py` | Checks manifest + JS + required figures |

- **Do not edit** `researchData.js` by hand.
- Edit clinical prose in **`portal_education.json`** (flashcards / symptom table).
- After sync: hard-refresh the browser.

## Layout

```
backup/
├── scripts/           run_all_analyses.py, sync, verify, pipelines
├── portal_education.json
├── portal_sync_manifest.json
├── analysis_output/
├── compare_output/
└── scRNA_analysis/    inventory + deep/
```

## What this is not

Hackathon / education only — not HIPAA, not individual diagnosis, not connected to demo user check-ins unless you re-run and sync.

## See also

- [../patient-doctor-portal/README.md](../patient-doctor-portal/README.md) — run the app  
- [../README.md](../README.md) — repo overview

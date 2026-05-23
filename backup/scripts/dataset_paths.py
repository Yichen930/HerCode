"""Canonical paths for hackathon raw datasets (see repo dataset/)."""
from __future__ import annotations

from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
DATASET_DIR = REPO_ROOT / "dataset"

PCOS_XLSX = DATASET_DIR / "(Main_Dataset)_PCOS_data_without_infertility.xlsx"
ENDO_CSV = DATASET_DIR / "(Supplementary_Dataset)_structured_endometriosis_data.csv"
ENDO_XLSX = DATASET_DIR / "(Supplementary_Dataset)_structured_endometriosis_data (1).xlsx"
ZIP_ENDO = DATASET_DIR / "(Supplementary_Dataset)_Endometrium_single_cell_data.zip"
ZIP_PCOS = DATASET_DIR / "(Supplementary_Dataset)_PCOS_single_cell_data.zip"

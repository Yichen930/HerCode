"""Sync portal SQLite data to CSV files under data/exports/ (updated on each write)."""

from __future__ import annotations

import csv
import json
import re
import sqlite3
from datetime import datetime, timezone
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
EXPORT_DIR = BASE_DIR / "data" / "exports"
CLINICIAN_DIR = EXPORT_DIR / "clinicians"

CHECKIN_ANSWER_KEYS = [
    "age",
    "cycleRegularity",
    "painLevel",
    "painTiming",
    "skinHair",
    "bowelBladder",
    "weightChange",
    "heavyBleeding",
    "bmiCategory",
    "fertilityConcern",
    "notes",
]


def _utc_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _safe_slug(email: str) -> str:
    return re.sub(r"[^a-zA-Z0-9._-]+", "_", (email or "").strip().lower())


def _write_csv(path: Path, fieldnames: list[str], rows: list[dict]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".tmp")
    with tmp.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames, extrasaction="ignore")
        writer.writeheader()
        for row in rows:
            writer.writerow(row)
    tmp.replace(path)


def sync_exports(conn: sqlite3.Connection) -> dict:
    """Rewrite export CSVs from the database. Returns manifest metadata."""
    EXPORT_DIR.mkdir(parents=True, exist_ok=True)
    synced_at = _utc_iso()

    links = conn.execute(
        """
        SELECT d.email AS doctor_email, d.display_name AS doctor_name,
               p.email AS patient_email, p.display_name AS patient_name,
               l.created_at AS linked_at
        FROM doctor_patient_links l
        JOIN users d ON d.id = l.doctor_user_id
        JOIN users p ON p.id = l.patient_user_id
        ORDER BY d.email, p.email
        """
    ).fetchall()

    _write_csv(
        EXPORT_DIR / "roster.csv",
        ["doctor_email", "doctor_name", "patient_email", "patient_name", "linked_at"],
        [dict(r) for r in links],
    )

    submissions = conn.execute(
        """
        SELECT s.id, p.email AS patient_email, s.submitted_at, s.deleted_at,
               s.summary_plain, s.answers_json
        FROM submissions s
        JOIN users p ON p.id = s.patient_user_id
        ORDER BY s.submitted_at DESC
        """
    ).fetchall()

    checkin_fields = (
        ["submission_id", "patient_email", "submitted_at", "deleted_at", "summary_plain"]
        + CHECKIN_ANSWER_KEYS
    )
    checkin_rows: list[dict] = []
    for r in submissions:
        answers = json.loads(r["answers_json"] or "{}")
        row = {
            "submission_id": r["id"],
            "patient_email": r["patient_email"],
            "submitted_at": r["submitted_at"],
            "deleted_at": r["deleted_at"] or "",
            "summary_plain": r["summary_plain"] or "",
        }
        for k in CHECKIN_ANSWER_KEYS:
            row[k] = answers.get(k, "")
        checkin_rows.append(row)
    _write_csv(EXPORT_DIR / "checkins.csv", checkin_fields, checkin_rows)

    clinical = conn.execute(
        """
        SELECT cr.id, p.email AS patient_email, d.email AS doctor_email,
               d.display_name AS doctor_name, cr.diagnosis_name, cr.confirmed,
               cr.notes, cr.linked_submission_id, cr.recorded_at
        FROM clinical_records cr
        JOIN users p ON p.id = cr.patient_user_id
        JOIN users d ON d.id = cr.doctor_user_id
        ORDER BY cr.recorded_at DESC
        """
    ).fetchall()
    _write_csv(
        EXPORT_DIR / "clinical_records.csv",
        [
            "record_id",
            "patient_email",
            "doctor_email",
            "doctor_name",
            "diagnosis_name",
            "confirmed",
            "notes",
            "linked_submission_id",
            "recorded_at",
        ],
        [
            {
                "record_id": r["id"],
                "patient_email": r["patient_email"],
                "doctor_email": r["doctor_email"],
                "doctor_name": r["doctor_name"],
                "diagnosis_name": r["diagnosis_name"],
                "confirmed": "yes" if r["confirmed"] else "provisional",
                "notes": r["notes"] or "",
                "linked_submission_id": r["linked_submission_id"] or "",
                "recorded_at": r["recorded_at"],
            }
            for r in clinical
        ],
    )

    chats = conn.execute(
        """
        SELECT m.id, p.email AS patient_email, p.share_chat_with_doctor,
               m.role, m.text, m.created_at
        FROM chat_messages m
        JOIN users p ON p.id = m.patient_user_id
        ORDER BY m.created_at ASC
        """
    ).fetchall()
    _write_csv(
        EXPORT_DIR / "chat_messages.csv",
        ["message_id", "patient_email", "chat_shared_with_clinicians", "role", "text", "created_at"],
        [
            {
                "message_id": r["id"],
                "patient_email": r["patient_email"],
                "chat_shared_with_clinicians": "yes" if r["share_chat_with_doctor"] else "no",
                "role": r["role"],
                "text": r["text"],
                "created_at": r["created_at"],
            }
            for r in chats
        ],
    )

    doctors = conn.execute(
        """
        SELECT DISTINCT d.id, d.email
        FROM users d
        JOIN doctor_patient_links l ON l.doctor_user_id = d.id
        """
    ).fetchall()

    clinician_manifests: dict[str, dict] = {}
    for doc in doctors:
        doc_email = doc["email"]
        doc_id = doc["id"]
        slug = _safe_slug(doc_email)
        out_dir = CLINICIAN_DIR / slug
        out_dir.mkdir(parents=True, exist_ok=True)

        doc_links = [dict(r) for r in links if r["doctor_email"] == doc_email]
        _write_csv(
            out_dir / "roster.csv",
            ["doctor_email", "doctor_name", "patient_email", "patient_name", "linked_at"],
            doc_links,
        )

        patient_emails = {r["patient_email"] for r in doc_links}
        doc_checkins = [r for r in checkin_rows if r["patient_email"] in patient_emails and not r["deleted_at"]]
        _write_csv(out_dir / "checkins.csv", checkin_fields, doc_checkins)

        doc_clinical = [
            {
                "record_id": r["id"],
                "patient_email": r["patient_email"],
                "doctor_email": r["doctor_email"],
                "doctor_name": r["doctor_name"],
                "diagnosis_name": r["diagnosis_name"],
                "confirmed": "yes" if r["confirmed"] else "provisional",
                "notes": r["notes"] or "",
                "linked_submission_id": r["linked_submission_id"] or "",
                "recorded_at": r["recorded_at"],
            }
            for r in clinical
            if r["doctor_email"] == doc_email
        ]
        _write_csv(
            out_dir / "clinical_records.csv",
            [
                "record_id",
                "patient_email",
                "doctor_email",
                "doctor_name",
                "diagnosis_name",
                "confirmed",
                "notes",
                "linked_submission_id",
                "recorded_at",
            ],
            doc_clinical,
        )

        doc_chats = [
            {
                "message_id": r["id"],
                "patient_email": r["patient_email"],
                "chat_shared_with_clinicians": "yes" if r["share_chat_with_doctor"] else "no",
                "role": r["role"],
                "text": r["text"],
                "created_at": r["created_at"],
            }
            for r in chats
            if r["patient_email"] in patient_emails and r["share_chat_with_doctor"]
        ]
        _write_csv(
            out_dir / "chat_messages.csv",
            ["message_id", "patient_email", "chat_shared_with_clinicians", "role", "text", "created_at"],
            doc_chats,
        )

        clinician_manifests[doc_email] = {
            "folder": f"clinicians/{slug}",
            "files": ["roster.csv", "checkins.csv", "clinical_records.csv", "chat_messages.csv"],
            "patient_count": len(patient_emails),
        }

    manifest = {
        "syncedAt": synced_at,
        "exportDir": str(EXPORT_DIR.relative_to(BASE_DIR)),
        "files": [
            {"name": "roster.csv", "description": "Doctor–patient links"},
            {"name": "checkins.csv", "description": "All check-in submissions (active + deleted flag)"},
            {"name": "clinical_records.csv", "description": "Clinician diagnosis log"},
            {"name": "chat_messages.csv", "description": "Support chat messages"},
        ],
        "clinicians": clinician_manifests,
    }

    manifest_path = EXPORT_DIR / "manifest.json"
    manifest_path.write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    return manifest


def list_export_files_for_doctor(doctor_email: str) -> list[dict]:
    slug = _safe_slug(doctor_email)
    folder = CLINICIAN_DIR / slug
    if not folder.is_dir():
        return []
    descriptions = {
        "roster.csv": "Your linked patients",
        "checkins.csv": "Check-ins (active only)",
        "clinical_records.csv": "Diagnoses you logged",
        "chat_messages.csv": "Support chat (consent enabled)",
    }
    out = []
    for path in sorted(folder.glob("*.csv")):
        stat = path.stat()
        out.append(
            {
                "name": path.name,
                "path": f"clinicians/{slug}/{path.name}",
                "description": descriptions.get(path.name, ""),
                "bytes": stat.st_size,
                "updatedAt": datetime.fromtimestamp(stat.st_mtime, timezone.utc).isoformat(),
            }
        )
    return out


def resolve_export_path(relative_path: str) -> Path | None:
    """Safe path under EXPORT_DIR."""
    rel = (relative_path or "").strip().lstrip("/")
    if not rel or ".." in rel.split("/"):
        return None
    full = (EXPORT_DIR / rel).resolve()
    try:
        full.relative_to(EXPORT_DIR.resolve())
    except ValueError:
        return None
    if full.is_file() and full.suffix.lower() == ".csv":
        return full
    return None

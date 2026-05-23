#!/usr/bin/env python3
"""Create demo patient/doctor accounts, link, consent, and one sample check-in."""

from __future__ import annotations

import json
import sys
import uuid
from datetime import datetime, timezone
from pathlib import Path

from werkzeug.security import generate_password_hash

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from checkin_validation import validate_checkin_answers  # noqa: E402
from summary_backend import build_patient_summary  # noqa: E402

PATIENT_EMAIL = "patient@gmail.com"
DOCTOR_EMAIL = "doctor@gmail.com"
PASSWORD = "2026"


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def main() -> int:
    from server import DB_PATH, get_db, init_db  # noqa: E402

    init_db()

    pw = generate_password_hash(PASSWORD)
    created = utcnow().isoformat()

    answers = {
        "age": "28",
        "cycleRegularity": "irregular",
        "painLevel": "moderate",
        "skinHair": "both",
        "weightChange": "gain",
        "fertilityConcern": "yes",
        "notes": "Cycles have been irregular for several months with skin changes. Preparing questions for my gynecology visit.",
    }
    ok, stored, err = validate_checkin_answers(answers)
    if not ok or stored is None:
        print(f"Check-in validation failed: {err}", file=sys.stderr)
        return 1

    with get_db() as conn:
        for email, role, name in [
            (PATIENT_EMAIL, "patient", "Alex (demo patient)"),
            (DOCTOR_EMAIL, "doctor", "Dr. Lee (demo)"),
        ]:
            conn.execute(
                """
                INSERT OR IGNORE INTO users (email, password_hash, role, display_name, created_at, share_chat_with_doctor)
                VALUES (?, ?, ?, ?, ?, 0)
                """,
                (email.lower(), pw, role, name, created),
            )

        patient = conn.execute(
            "SELECT id FROM users WHERE email = ?", (PATIENT_EMAIL.lower(),)
        ).fetchone()
        doctor = conn.execute(
            "SELECT id FROM users WHERE email = ?", (DOCTOR_EMAIL.lower(),)
        ).fetchone()
        if not patient or not doctor:
            print("Failed to create demo users.", file=sys.stderr)
            return 1

        conn.execute(
            "UPDATE users SET share_chat_with_doctor = 1 WHERE id = ?",
            (patient["id"],),
        )
        conn.execute(
            """
            INSERT OR IGNORE INTO doctor_patient_links (doctor_user_id, patient_user_id, created_at)
            VALUES (?, ?, ?)
            """,
            (doctor["id"], patient["id"], created),
        )

        sm = build_patient_summary(stored, [])
        sid = str(uuid.uuid4())
        conn.execute(
            """
            INSERT INTO submissions (id, patient_user_id, submitted_at, answers_json, summary_model_json, summary_plain)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (
                sid,
                patient["id"],
                created,
                json.dumps(stored, ensure_ascii=False),
                json.dumps(sm, ensure_ascii=False),
                sm["plainText"],
            ),
        )

    try:
        from csv_export import sync_exports  # noqa: E402

        with get_db() as conn:
            sync_exports(conn)
    except Exception as e:
        print(f"Note: CSV export sync skipped: {e}")

    print("Demo accounts ready:")
    print(f"  Patient: {PATIENT_EMAIL} / {PASSWORD}")
    print(f"  Doctor:  {DOCTOR_EMAIL} / {PASSWORD}")
    print("  Linked + chat sharing on + 1 sample check-in")
    return 0


if __name__ == "__main__":
    sys.exit(main())

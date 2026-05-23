#!/usr/bin/env python3
"""
Create a full HearHer showcase database (SQLite).

Wipes existing portal.sqlite3, seeds users, links, between-visit data,
community, chat, direct messages, check-ins, and clinical records.

Usage (stop server.py first to avoid DB lock):
  cd patient-doctor-portal
  python3 scripts/seed_demo.py
  python3 server.py

Then hard-refresh the browser (clear localStorage if you used offline mode before).
"""

from __future__ import annotations

import json
import sys
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path

from werkzeug.security import generate_password_hash

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from ai_moderation import moderation_guidance_json  # noqa: E402
from checkin_validation import validate_checkin_answers  # noqa: E402
from summary_backend import build_patient_summary  # noqa: E402

PASSWORD = "2026"

ACCOUNTS = [
    ("patient@gmail.com", "patient", "Mei Lin"),
    ("peer@gmail.com", "patient", "Jordan"),
    ("doctor@gmail.com", "doctor", "Dr. Tan"),
    ("partner@gmail.com", "caregiver", "James (partner)"),
    ("child@gmail.com", "caregiver", "Sam (adult child)"),
]

COMMUNITY_GROUPS = [
    "chemo",
    "surgery",
    "body-image",
    "scanxiety",
    "survivorship",
]


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def iso_days_ago(days: float) -> str:
    return (utcnow() - timedelta(days=days)).isoformat()


def guidance_ok() -> str:
    return moderation_guidance_json(
        {
            "approved": True,
            "guidanceType": "comfort",
            "patientMessage": "Thank you for sharing. This is peer support, not medical advice.",
        }
    )


def guidance_rejected() -> str:
    return moderation_guidance_json(
        {
            "approved": False,
            "guidanceType": "warning",
            "patientMessage": "Your message was not published. Please share your experience without telling others what disease they have.",
        }
    )


def between_visit_snapshot() -> dict:
    return {
        "visitQuestions": [
            {
                "id": str(uuid.uuid4()),
                "text": "Is tingling in my fingers normal after taxane chemo, or should I call the hotline?",
                "source": "manual",
                "createdAt": iso_days_ago(2),
            },
            {
                "id": str(uuid.uuid4()),
                "text": "When can I expect energy to return after cycle 4?",
                "source": "support",
                "createdAt": iso_days_ago(5),
            },
        ],
        "supportCollected": {
            "emotionalBurden": "fear",
            "emotionalNotes": "Scan next Tuesday — I keep waking at 3am thinking about recurrence.",
            "oneThingForDoctor": "I need clearer guidance on when to call the oncology hotline vs wait until the visit.",
            "visitGoal": "heard",
            "toldJustStress": "sometimes",
        },
        "reflectAnswers": {
            "phase": "active_treatment",
            "mood": "high_anxiety",
            "sleep": "poor",
            "sideEffects": "some",
            "bodyImage": "hard",
            "infoOverload": "sometimes",
        },
        "reflectThemeIds": ["anxiety", "body"],
        "visitBriefText": (
            "Mei — next oncology visit brief\n\n"
            "Heaviest feeling: fear before upcoming scan.\n"
            "Sleep has been poor this week.\n"
            "Body image feels changed since surgery — hard to talk about at home.\n\n"
            "Priority for clinician: clearer hotline guidance + scanxiety support."
        ),
        "familyExplainByAudience": {
            "partner": (
                "James — from Mei\n\n"
                "I am in active treatment. Some days I am exhausted, not distant from you. "
                "What helps: listening without fixing, and offering to come to visits if I ask."
            ),
            "children": (
                "Sam — from Mum\n\n"
                "Some days I need quiet because of treatment — not because of anything you did. "
                "You do not need to carry adult worries. Hugs and normal routines help on harder days."
            ),
        },
        "updatedAt": iso_days_ago(0.5),
    }


def wellness_checkin_answers() -> dict:
    return {
        "age": "52",
        "treatmentPhase": "active_treatment",
        "mood": "high_anxiety",
        "sideEffects": "some",
        "sleep": "poor",
        "informationOverload": "sometimes",
        "notes": (
            "Cycle 4 of chemo finished last week. Fatigue and scan anxiety before Tuesday MRI. "
            "Using HearHer between visits to organise questions for Dr. Tan."
        ),
    }


def upsert_user(conn, email: str, role: str, display_name: str, pw_hash: str, created: str) -> int:
    conn.execute(
        """
        INSERT OR IGNORE INTO users (email, password_hash, role, display_name, created_at)
        VALUES (?, ?, ?, ?, ?)
        """,
        (email.lower(), pw_hash, role, display_name, created),
    )
    row = conn.execute("SELECT id FROM users WHERE email = ?", (email.lower(),)).fetchone()
    if row is None:
        raise RuntimeError(f"Failed to create user {email}")
    return int(row["id"])


def insert_community_post(
    conn,
    *,
    author_id: int,
    author_display: str,
    body: str,
    group_id: str,
    status: str,
    created: str,
    reason: str = "Approved by community safety rules.",
    flags: list | None = None,
    guidance: str | None = None,
) -> str:
    pid = str(uuid.uuid4())
    conn.execute(
        """
        INSERT INTO community_posts
        (id, author_user_id, author_display, body, status, moderation_reason,
         moderation_flags_json, moderation_guidance_json, group_id, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            pid,
            author_id,
            author_display,
            body,
            status,
            reason,
            json.dumps(flags or []),
            guidance or guidance_ok(),
            group_id,
            created,
        ),
    )
    return pid


def insert_community_comment(
    conn,
    *,
    post_id: str,
    author_id: int,
    author_display: str,
    body: str,
    created: str,
) -> str:
    cid = str(uuid.uuid4())
    conn.execute(
        """
        INSERT INTO community_comments
        (id, post_id, author_user_id, author_display, body, status, moderation_reason,
         moderation_flags_json, moderation_guidance_json, created_at)
        VALUES (?, ?, ?, ?, ?, 'approved', ?, '[]', ?, ?)
        """,
        (
            cid,
            post_id,
            author_id,
            author_display,
            body,
            "Approved by community safety rules.",
            guidance_ok(),
            created,
        ),
    )
    return cid


def add_reaction(conn, target_type: str, target_id: str, user_id: int, emoji_id: str, created: str) -> None:
    conn.execute(
        """
        INSERT OR IGNORE INTO community_reactions
        (target_type, target_id, user_id, emoji_id, created_at)
        VALUES (?, ?, ?, ?, ?)
        """,
        (target_type, target_id, user_id, emoji_id, created),
    )


def add_direct_message(
    conn,
    *,
    patient_id: int,
    channel: str,
    sender_role: str,
    sender_id: int,
    text: str,
    urgent: bool,
    created: str,
) -> None:
    conn.execute(
        """
        INSERT INTO direct_messages
        (id, patient_user_id, channel, sender_role, sender_user_id, text, urgent, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            str(uuid.uuid4()),
            patient_id,
            channel,
            sender_role,
            sender_id,
            text,
            1 if urgent else 0,
            created,
        ),
    )


def main() -> int:
    from server import DB_PATH, get_db, init_db  # noqa: E402

    if DB_PATH.is_file():
        DB_PATH.unlink()
        print(f"Removed old database: {DB_PATH.relative_to(ROOT)}")

    init_db()
    pw_hash = generate_password_hash(PASSWORD)
    created = utcnow().isoformat()

    ok, stored_answers, err = validate_checkin_answers(wellness_checkin_answers())
    if not ok or stored_answers is None:
        print(f"Check-in validation failed: {err}", file=sys.stderr)
        return 1

    summary = build_patient_summary(stored_answers, [])
    snapshot = between_visit_snapshot()

    with get_db() as conn:
        ids: dict[str, int] = {}
        for email, role, name in ACCOUNTS:
            ids[email] = upsert_user(conn, email, role, name, pw_hash, created)

        mei = ids["patient@gmail.com"]
        peer = ids["peer@gmail.com"]
        doctor = ids["doctor@gmail.com"]
        partner = ids["partner@gmail.com"]
        child = ids["child@gmail.com"]

        conn.execute(
            """
            UPDATE users SET share_chat_with_doctor = 1, share_with_partner = 1,
                   share_with_children = 1, share_with_caregiver = 1
            WHERE id = ?
            """,
            (mei,),
        )

        demo_phones = {
            "patient@gmail.com": "+65 9123 4567",
            "doctor@gmail.com": "+65 6311 2222",
            "partner@gmail.com": "+65 9876 5432",
            "child@gmail.com": "+65 9112 2334",
        }
        for email, phone in demo_phones.items():
            conn.execute(
                "UPDATE users SET contact_phone = ? WHERE email = ?",
                (phone, email.lower()),
            )

        conn.execute(
            """
            INSERT INTO doctor_patient_links (doctor_user_id, patient_user_id, created_at)
            VALUES (?, ?, ?)
            """,
            (doctor, mei, created),
        )
        conn.execute(
            """
            INSERT INTO caregiver_patient_links (caregiver_user_id, patient_user_id, created_at, relationship)
            VALUES (?, ?, ?, 'partner')
            """,
            (partner, mei, created),
        )
        conn.execute(
            """
            INSERT INTO caregiver_patient_links (caregiver_user_id, patient_user_id, created_at, relationship)
            VALUES (?, ?, ?, 'child')
            """,
            (child, mei, created),
        )

        conn.execute(
            """
            INSERT INTO between_visit_snapshots (patient_user_id, snapshot_json, updated_at)
            VALUES (?, ?, ?)
            """,
            (mei, json.dumps(snapshot, ensure_ascii=False), snapshot["updatedAt"]),
        )

        submission_id = str(uuid.uuid4())
        conn.execute(
            """
            INSERT INTO submissions
            (id, patient_user_id, submitted_at, answers_json, summary_model_json, summary_plain)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (
                submission_id,
                mei,
                iso_days_ago(3),
                json.dumps(stored_answers, ensure_ascii=False),
                json.dumps(summary, ensure_ascii=False),
                summary["plainText"],
            ),
        )

        conn.execute(
            """
            INSERT INTO clinical_records
            (id, patient_user_id, doctor_user_id, diagnosis_name, confirmed, notes,
             linked_submission_id, recorded_at)
            VALUES (?, ?, ?, ?, 1, ?, ?, ?)
            """,
            (
                str(uuid.uuid4()),
                mei,
                doctor,
                "Invasive ductal carcinoma, ER+/HER2-",
                "On active chemotherapy; monitor neuropathy and scan schedule.",
                submission_id,
                iso_days_ago(10),
            ),
        )

        chat_samples = [
            ("user", "I feel sick with anxiety before every scan — is that normal?", iso_days_ago(4)),
            (
                "bot",
                "Scan anxiety is very common between oncology visits — it does not mean you are failing. "
                "Many people on a breast cancer journey describe the same waiting period. "
                "Would it help to name one small thing that soothes you before Tuesday?",
                iso_days_ago(4),
            ),
            ("user", "Talking to James helps. I still feel alone at 3am.", iso_days_ago(2)),
            (
                "bot",
                "Night-time fear can feel loudest when everyone else is asleep. You are not alone in that pattern. "
                "If thoughts turn urgent or you feel unsafe, please contact your team or emergency services.",
                iso_days_ago(2),
            ),
        ]
        for role, text, ts in chat_samples:
            conn.execute(
                """
                INSERT INTO chat_messages (id, patient_user_id, role, text, created_at)
                VALUES (?, ?, ?, ?, ?)
                """,
                (str(uuid.uuid4()), mei, role, text, ts),
            )

        add_direct_message(
            conn,
            patient_id=mei,
            channel="doctor",
            sender_role="patient",
            sender_id=mei,
            text="Dr. Tan — mild tingling in fingers since last cycle. Not sure if I should call the hotline.",
            urgent=False,
            created=iso_days_ago(1),
        )
        add_direct_message(
            conn,
            patient_id=mei,
            channel="doctor",
            sender_role="doctor",
            sender_id=doctor,
            text="Thank you for flagging this. If it worsens or you lose function, call the hotline today. Otherwise note it for Tuesday.",
            urgent=False,
            created=iso_days_ago(0.9),
        )
        add_direct_message(
            conn,
            patient_id=mei,
            channel="caregiver",
            sender_role="patient",
            sender_id=mei,
            text="Scan on Tuesday — I might need quiet tonight. Not angry at you.",
            urgent=False,
            created=iso_days_ago(0.5),
        )
        add_direct_message(
            conn,
            patient_id=mei,
            channel="caregiver",
            sender_role="caregiver",
            sender_id=partner,
            text="I am here. Want me to drive you Tuesday?",
            urgent=False,
            created=iso_days_ago(0.4),
        )

        for gid in COMMUNITY_GROUPS:
            conn.execute(
                """
                INSERT OR IGNORE INTO community_group_memberships (user_id, group_id, joined_at)
                VALUES (?, ?, ?)
                """,
                (mei, gid, created),
            )
            conn.execute(
                """
                INSERT OR IGNORE INTO community_group_memberships (user_id, group_id, joined_at)
                VALUES (?, ?, ?)
                """,
                (peer, gid, created),
            )
        for gid in ("caregivers", "scanxiety", "newly-diagnosed"):
            conn.execute(
                """
                INSERT OR IGNORE INTO community_group_memberships (user_id, group_id, joined_at)
                VALUES (?, ?, ?)
                """,
                (partner, gid, created),
            )

        posts = [
            (
                peer,
                "Jordan",
                "chemo",
                "Cycle 3 hit me hard — nausea plus guilt for cancelling on my kids. Anyone else feel selfish for resting?",
                iso_days_ago(6),
            ),
            (
                peer,
                "Jordan",
                "surgery",
                "One week post-mastectomy. Mirror days are harder than I expected. Grateful for this group.",
                iso_days_ago(5),
            ),
            (
                mei,
                "Mei Lin",
                "scanxiety",
                "MRI on Tuesday and my brain will not switch off. Coping strategies welcome — what helped you in the waiting room?",
                iso_days_ago(3),
            ),
            (
                peer,
                "Jordan",
                "body-image",
                "Prosthetic fit finally feels okay. Small win — sharing in case someone needs hope today.",
                iso_days_ago(2),
            ),
            (
                peer,
                "Jordan",
                "survivorship",
                "Six months post-chemo. Energy is back in patches. Still learning my new normal.",
                iso_days_ago(1),
            ),
            (
                partner,
                "James (partner)",
                "caregivers",
                "How do you support scanxiety without saying “stay positive”? Mei has MRI Tuesday and I want to be helpful, not dismissive.",
                iso_days_ago(1.5),
            ),
        ]
        post_ids: list[str] = []
        for author_id, author_name, group_id, body, ts in posts:
            post_ids.append(
                insert_community_post(
                    conn,
                    author_id=author_id,
                    author_display=author_name,
                    body=body,
                    group_id=group_id,
                    status="approved",
                    created=ts,
                )
            )

        insert_community_post(
            conn,
            author_id=mei,
            author_display="Mei Lin",
            body="You have stage four cancer — you should take 500 mg metformin daily. Email me at fake@clinic.com",
            group_id="chemo",
            status="rejected",
            created=iso_days_ago(0.2),
            reason="Please avoid diagnosis claims, dosing advice, or email addresses.",
            flags=["policy"],
            guidance=guidance_rejected(),
        )

        c1 = insert_community_comment(
            conn,
            post_id=post_ids[2],
            author_id=peer,
            author_display="Jordan",
            body="I bring headphones and a soft scarf — something familiar. You are not alone in this.",
            created=iso_days_ago(2.8),
        )
        c2 = insert_community_comment(
            conn,
            post_id=post_ids[0],
            author_id=mei,
            author_display="Mei Lin",
            body="Rest is treatment too. Your kids need you rested more than they need you at every event.",
            created=iso_days_ago(5.5),
        )

        add_reaction(conn, "post", post_ids[0], mei, "hug", iso_days_ago(5.4))
        add_reaction(conn, "post", post_ids[0], peer, "together", iso_days_ago(5.3))
        add_reaction(conn, "post", post_ids[2], peer, "care", iso_days_ago(2.5))
        add_reaction(conn, "post", post_ids[2], mei, "hope", iso_days_ago(2.4))
        add_reaction(conn, "post", post_ids[2], partner, "strong", iso_days_ago(2.3))
        add_reaction(conn, "comment", c1, mei, "care", iso_days_ago(2.7))
        add_reaction(conn, "comment", c2, peer, "gentle", iso_days_ago(5.2))

    try:
        from csv_export import sync_exports  # noqa: E402

        with get_db() as conn:
            sync_exports(conn)
    except Exception as e:
        print(f"Note: CSV export sync skipped: {e}")

    print("\nShowcase database ready.\n")
    print("Password for all accounts:", PASSWORD)
    print()
    print("Patient (main demo)     patient@gmail.com   — Mei Lin")
    print("Peer (community posts)  peer@gmail.com")
    print("Clinician               doctor@gmail.com    — linked to Mei")
    print("Partner caregiver       partner@gmail.com     — James (+ caregiver community)")
    print("Adult-child caregiver   child@gmail.com       — Sam")
    print()
    print("Seeded: links, Privacy on, between-visit snapshot, wellness check-in,")
    print("        clinical record, AI chat, direct messages, community groups/posts,")
    print("        comments, emoji reactions, 1 rejected post (doctor safety log).")
    print()
    print("Next:")
    print("  1. python3 server.py")
    print("  2. Hard refresh browser — clear site data if you used offline mode before")
    print("  3. Log in as patient@gmail.com → explore Community, Messages, Privacy, etc.")
    return 0


if __name__ == "__main__":
    sys.exit(main())

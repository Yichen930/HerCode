"""
SQLite-backed API + static file server for patient-doctor-portal.

Run (from this directory):
  pip install -r requirements-api.txt
  cp .env.example .env   # add OPENAI_API_KEY for AI support chat
  python3 server.py

Open http://127.0.0.1:8000
"""
from __future__ import annotations

from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
import sys

sys.path.insert(0, str(BASE_DIR))

from dotenv import load_dotenv

load_dotenv(BASE_DIR / ".env")

import json
import secrets
import sqlite3
import uuid
from contextlib import contextmanager
from datetime import datetime, timedelta, timezone

from fastapi import Depends, FastAPI, HTTPException
from fastapi.responses import FileResponse, JSONResponse, RedirectResponse
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, EmailStr, Field
from werkzeug.security import check_password_hash, generate_password_hash

from ai_chat_backend import generate_reply, is_configured as ai_chat_configured
from ai_moderation import (
    moderate_community_text,
    moderation_guidance_json,
    parse_moderation_guidance,
)
from checkin_validation import validate_checkin_answers
from summary_backend import build_patient_summary
from csv_export import (
    EXPORT_DIR,
    _safe_slug,
    list_export_files_for_doctor,
    resolve_export_path,
    sync_exports,
)

DB_PATH = BASE_DIR / "data" / "portal.sqlite3"

app = FastAPI(title="HearHer API")
security = HTTPBearer(auto_error=False)


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def slug_email(email: str) -> str:
    return (email or "").strip().lower()


@contextmanager
def get_db():
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


def _ensure_user_columns(conn: sqlite3.Connection) -> None:
    cols = {r[1] for r in conn.execute("PRAGMA table_info(users)").fetchall()}
    if "share_chat_with_doctor" not in cols:
        conn.execute(
            "ALTER TABLE users ADD COLUMN share_chat_with_doctor INTEGER NOT NULL DEFAULT 0"
        )
    if "share_with_caregiver" not in cols:
        conn.execute(
            "ALTER TABLE users ADD COLUMN share_with_caregiver INTEGER NOT NULL DEFAULT 0"
        )
    if "share_with_partner" not in cols:
        conn.execute(
            "ALTER TABLE users ADD COLUMN share_with_partner INTEGER NOT NULL DEFAULT 0"
        )
        conn.execute(
            """
            UPDATE users SET share_with_partner = COALESCE(share_with_caregiver, 0)
            WHERE share_with_partner = 0 AND COALESCE(share_with_caregiver, 0) = 1
            """
        )
    if "share_with_children" not in cols:
        conn.execute(
            "ALTER TABLE users ADD COLUMN share_with_children INTEGER NOT NULL DEFAULT 0"
        )
        conn.execute(
            """
            UPDATE users SET share_with_children = COALESCE(share_with_caregiver, 0)
            WHERE share_with_children = 0 AND COALESCE(share_with_caregiver, 0) = 1
            """
        )
    if "contact_phone" not in cols:
        conn.execute("ALTER TABLE users ADD COLUMN contact_phone TEXT")


def _ensure_direct_messages_schema(conn: sqlite3.Connection) -> None:
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS direct_messages (
            id TEXT PRIMARY KEY,
            patient_user_id INTEGER NOT NULL,
            channel TEXT NOT NULL CHECK (channel IN ('doctor', 'caregiver')),
            sender_role TEXT NOT NULL CHECK (sender_role IN ('patient', 'doctor', 'caregiver')),
            sender_user_id INTEGER NOT NULL,
            text TEXT NOT NULL,
            urgent INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL,
            FOREIGN KEY (patient_user_id) REFERENCES users(id),
            FOREIGN KEY (sender_user_id) REFERENCES users(id)
        )
        """
    )
    conn.execute(
        """
        CREATE INDEX IF NOT EXISTS idx_direct_messages_patient_channel
        ON direct_messages (patient_user_id, channel, created_at)
        """
    )


def _ensure_caregiver_schema(conn: sqlite3.Connection) -> None:
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS caregiver_patient_links (
            caregiver_user_id INTEGER NOT NULL,
            patient_user_id INTEGER NOT NULL,
            created_at TEXT NOT NULL,
            PRIMARY KEY (caregiver_user_id, patient_user_id),
            FOREIGN KEY (caregiver_user_id) REFERENCES users(id),
            FOREIGN KEY (patient_user_id) REFERENCES users(id)
        )
        """
    )
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS between_visit_snapshots (
            patient_user_id INTEGER PRIMARY KEY,
            snapshot_json TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            FOREIGN KEY (patient_user_id) REFERENCES users(id)
        )
        """
    )
    link_cols = {r[1] for r in conn.execute("PRAGMA table_info(caregiver_patient_links)").fetchall()}
    if "relationship" not in link_cols:
        conn.execute(
            """
            ALTER TABLE caregiver_patient_links
            ADD COLUMN relationship TEXT NOT NULL DEFAULT 'other'
            """
        )
    row = conn.execute(
        "SELECT sql FROM sqlite_master WHERE type='table' AND name='users'"
    ).fetchone()
    sql = (row["sql"] if row else "") or ""
    role_check_ok = "roleIN('patient','doctor','caregiver')" in sql.replace(" ", "")
    if not role_check_ok:
        conn.executescript(
            """
            CREATE TABLE users_role_mig (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                email TEXT NOT NULL UNIQUE,
                password_hash TEXT NOT NULL,
                role TEXT NOT NULL CHECK (role IN ('patient', 'doctor', 'caregiver')),
                display_name TEXT NOT NULL,
                created_at TEXT NOT NULL,
                share_chat_with_doctor INTEGER NOT NULL DEFAULT 0,
                share_with_caregiver INTEGER NOT NULL DEFAULT 0,
                share_with_partner INTEGER NOT NULL DEFAULT 0,
                share_with_children INTEGER NOT NULL DEFAULT 0
            );
            INSERT INTO users_role_mig (id, email, password_hash, role, display_name, created_at, share_chat_with_doctor, share_with_caregiver, share_with_partner, share_with_children)
            SELECT id, email, password_hash, role, display_name, created_at,
                   COALESCE(share_chat_with_doctor, 0),
                   COALESCE(share_with_caregiver, 0),
                   COALESCE(share_with_partner, 0),
                   COALESCE(share_with_children, 0)
            FROM users;
            DROP TABLE users;
            ALTER TABLE users_role_mig RENAME TO users;
            """
        )


def _ensure_submission_columns(conn: sqlite3.Connection) -> None:
    cols = {r[1] for r in conn.execute("PRAGMA table_info(submissions)").fetchall()}
    if "deleted_at" not in cols:
        conn.execute("ALTER TABLE submissions ADD COLUMN deleted_at TEXT")


def _ensure_community_columns(conn: sqlite3.Connection) -> None:
    for table in ("community_posts", "community_comments"):
        cols = {r[1] for r in conn.execute(f"PRAGMA table_info({table})").fetchall()}
        if "moderation_guidance_json" not in cols:
            conn.execute(
                f"ALTER TABLE {table} ADD COLUMN moderation_guidance_json TEXT NOT NULL DEFAULT '{{}}'"
            )
    post_cols = {r[1] for r in conn.execute("PRAGMA table_info(community_posts)").fetchall()}
    if "group_id" not in post_cols:
        conn.execute(
            "ALTER TABLE community_posts ADD COLUMN group_id TEXT NOT NULL DEFAULT 'survivorship'"
        )


def _ensure_community_groups_schema(conn: sqlite3.Connection) -> None:
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS community_group_memberships (
            user_id INTEGER NOT NULL,
            group_id TEXT NOT NULL,
            joined_at TEXT NOT NULL,
            PRIMARY KEY (user_id, group_id),
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
        """
    )
    _ensure_community_columns(conn)
    _ensure_community_reactions_schema(conn)


def _ensure_community_reactions_schema(conn: sqlite3.Connection) -> None:
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS community_reactions (
            target_type TEXT NOT NULL CHECK (target_type IN ('post', 'comment')),
            target_id TEXT NOT NULL,
            user_id INTEGER NOT NULL,
            emoji_id TEXT NOT NULL,
            created_at TEXT NOT NULL,
            PRIMARY KEY (target_type, target_id, user_id, emoji_id),
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
        """
    )


def init_db() -> None:
    with get_db() as conn:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                email TEXT NOT NULL UNIQUE,
                password_hash TEXT NOT NULL,
                role TEXT NOT NULL CHECK (role IN ('patient', 'doctor', 'caregiver')),
                display_name TEXT NOT NULL,
                created_at TEXT NOT NULL,
                share_chat_with_doctor INTEGER NOT NULL DEFAULT 0,
                share_with_caregiver INTEGER NOT NULL DEFAULT 0
            );

            CREATE TABLE IF NOT EXISTS sessions (
                token TEXT PRIMARY KEY,
                user_id INTEGER NOT NULL,
                expires_at TEXT NOT NULL,
                FOREIGN KEY (user_id) REFERENCES users(id)
            );

            CREATE TABLE IF NOT EXISTS doctor_patient_links (
                doctor_user_id INTEGER NOT NULL,
                patient_user_id INTEGER NOT NULL,
                created_at TEXT NOT NULL,
                PRIMARY KEY (doctor_user_id, patient_user_id),
                FOREIGN KEY (doctor_user_id) REFERENCES users(id),
                FOREIGN KEY (patient_user_id) REFERENCES users(id)
            );

            CREATE TABLE IF NOT EXISTS submissions (
                id TEXT PRIMARY KEY,
                patient_user_id INTEGER NOT NULL,
                submitted_at TEXT NOT NULL,
                answers_json TEXT NOT NULL,
                summary_model_json TEXT NOT NULL,
                summary_plain TEXT NOT NULL,
                FOREIGN KEY (patient_user_id) REFERENCES users(id)
            );

            CREATE TABLE IF NOT EXISTS chat_messages (
                id TEXT PRIMARY KEY,
                patient_user_id INTEGER NOT NULL,
                role TEXT NOT NULL CHECK (role IN ('bot', 'user')),
                text TEXT NOT NULL,
                created_at TEXT NOT NULL,
                FOREIGN KEY (patient_user_id) REFERENCES users(id)
            );

            CREATE TABLE IF NOT EXISTS community_posts (
                id TEXT PRIMARY KEY,
                author_user_id INTEGER NOT NULL,
                author_display TEXT NOT NULL,
                body TEXT NOT NULL,
                status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'rejected')),
                moderation_reason TEXT NOT NULL DEFAULT '',
                moderation_flags_json TEXT NOT NULL DEFAULT '[]',
                created_at TEXT NOT NULL,
                FOREIGN KEY (author_user_id) REFERENCES users(id)
            );

            CREATE TABLE IF NOT EXISTS community_comments (
                id TEXT PRIMARY KEY,
                post_id TEXT NOT NULL,
                author_user_id INTEGER NOT NULL,
                author_display TEXT NOT NULL,
                body TEXT NOT NULL,
                status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'rejected')),
                moderation_reason TEXT NOT NULL DEFAULT '',
                moderation_flags_json TEXT NOT NULL DEFAULT '[]',
                created_at TEXT NOT NULL,
                FOREIGN KEY (post_id) REFERENCES community_posts(id),
                FOREIGN KEY (author_user_id) REFERENCES users(id)
            );

            CREATE TABLE IF NOT EXISTS clinical_records (
                id TEXT PRIMARY KEY,
                patient_user_id INTEGER NOT NULL,
                doctor_user_id INTEGER NOT NULL,
                diagnosis_name TEXT NOT NULL,
                confirmed INTEGER NOT NULL,
                notes TEXT NOT NULL DEFAULT '',
                linked_submission_id TEXT,
                recorded_at TEXT NOT NULL,
                FOREIGN KEY (patient_user_id) REFERENCES users(id),
                FOREIGN KEY (doctor_user_id) REFERENCES users(id),
                FOREIGN KEY (linked_submission_id) REFERENCES submissions(id)
            );
            """
        )
        _ensure_user_columns(conn)
        _ensure_submission_columns(conn)
        _ensure_community_groups_schema(conn)
        _ensure_caregiver_schema(conn)
        _ensure_direct_messages_schema(conn)
        _ensure_user_columns(conn)


class RegisterBody(BaseModel):
    email: EmailStr
    password: str = Field(min_length=4, max_length=128)
    display_name: str = Field(min_length=1, max_length=120)
    role: str = Field(pattern="^(patient|doctor|caregiver)$")


class LoginBody(BaseModel):
    email: EmailStr
    password: str


class AnswersBody(BaseModel):
    answers: dict[str, str]


class LinkBody(BaseModel):
    patient_email: EmailStr


class ConsentBody(BaseModel):
    share_chat_with_doctor: bool


class CaregiverConsentBody(BaseModel):
    share_with_partner: bool | None = None
    share_with_children: bool | None = None
    share_with_caregiver: bool | None = None  # legacy — sets both when used alone


class CaregiverLinkBody(BaseModel):
    patient_email: EmailStr
    relationship: str = Field(default="other", pattern="^(partner|child|other)$")


class BetweenVisitBody(BaseModel):
    snapshot: dict


class ChatMessageBody(BaseModel):
    role: str = Field(pattern="^(bot|user)$")
    text: str = Field(min_length=1, max_length=4000)


class DirectMessageBody(BaseModel):
    text: str = Field(min_length=1, max_length=4000)
    urgent: bool = False


class AiReplyBody(BaseModel):
    message: str = Field(min_length=1, max_length=4000)
    context: dict | None = None


class CommunityBody(BaseModel):
    body: str = Field(min_length=3, max_length=2000)


class CommunityPostBody(BaseModel):
    body: str = Field(min_length=3, max_length=2000)
    group_id: str = Field(min_length=1, max_length=40)


class CommunityReactionBody(BaseModel):
    emoji_id: str = Field(min_length=1, max_length=32)


class ClinicalRecordBody(BaseModel):
    diagnosis_name: str = Field(min_length=1, max_length=200)
    confirmed: bool
    notes: str = Field(default="", max_length=4000)
    linked_submission_id: str | None = None


def row_user(r: sqlite3.Row) -> dict:
    share = 0
    share_cg = 0
    share_partner = 0
    share_children = 0
    try:
        share = int(r["share_chat_with_doctor"] or 0)
    except (KeyError, IndexError):
        share = 0
    try:
        share_cg = int(r["share_with_caregiver"] or 0)
    except (KeyError, IndexError):
        share_cg = 0
    try:
        share_partner = int(r["share_with_partner"] or 0)
    except (KeyError, IndexError):
        share_partner = share_cg
    try:
        share_children = int(r["share_with_children"] or 0)
    except (KeyError, IndexError):
        share_children = share_cg
    return {
        "id": r["id"],
        "email": r["email"],
        "role": r["role"],
        "display_name": r["display_name"],
        "share_chat_with_doctor": bool(share),
        "share_with_caregiver": bool(share_cg or share_partner or share_children),
        "share_with_partner": bool(share_partner),
        "share_with_children": bool(share_children),
    }


def _caregiver_relationship(row: sqlite3.Row) -> str:
    try:
        rel = (row["relationship"] or "other").strip().lower()
    except (KeyError, IndexError):
        rel = "other"
    return rel if rel in ("partner", "child", "other") else "other"


def _patient_sharing_enabled_for_caregiver(patient_row: sqlite3.Row, relationship: str) -> bool:
    if relationship == "child":
        try:
            return bool(int(patient_row["share_with_children"] or 0))
        except (KeyError, IndexError):
            return bool(int(patient_row["share_with_caregiver"] or 0))
    try:
        return bool(int(patient_row["share_with_partner"] or 0))
    except (KeyError, IndexError):
        return bool(int(patient_row["share_with_caregiver"] or 0))


def _filter_snapshot_for_caregiver(snapshot: dict, relationship: str) -> dict:
    if relationship != "child":
        return snapshot
    reflect = snapshot.get("reflectAnswers") or {}
    child_reflect = {}
    if reflect.get("phase"):
        child_reflect["phase"] = reflect["phase"]
    if reflect.get("mood"):
        child_reflect["mood"] = reflect["mood"]
    family = snapshot.get("familyExplainByAudience") or {}
    child_family = {}
    if family.get("children"):
        child_family["children"] = family["children"]
    return {
        **snapshot,
        "supportCollected": {},
        "reflectAnswers": child_reflect,
        "visitBriefText": "",
        "visitQuestions": [],
        "familyExplainByAudience": child_family,
    }


def get_token(creds: HTTPAuthorizationCredentials | None = Depends(security)) -> str:
    if creds is None or creds.scheme.lower() != "bearer":
        raise HTTPException(status_code=401, detail="Missing bearer token")
    return creds.credentials


def get_current_user(token: str = Depends(get_token)) -> sqlite3.Row:
    with get_db() as conn:
        row = conn.execute(
            """
            SELECT u.* FROM users u
            JOIN sessions s ON s.user_id = u.id
            WHERE s.token = ? AND s.expires_at > ?
            """,
            (token, utcnow().isoformat()),
        ).fetchone()
    if row is None:
        raise HTTPException(status_code=401, detail="Invalid or expired session")
    return row


def _refresh_exports() -> dict | None:
    try:
        with get_db() as conn:
            return sync_exports(conn)
    except Exception as exc:
        print(f"[csv_export] sync failed: {exc}", file=sys.stderr)
        return None


@app.on_event("startup")
def _startup() -> None:
    init_db()
    _refresh_exports()


@app.get("/api/health")
def health() -> dict:
    manifest_path = EXPORT_DIR / "manifest.json"
    exports_ok = manifest_path.is_file()
    return {
        "ok": True,
        "db": str(DB_PATH),
        "ai_chat": ai_chat_configured(),
        "exports_dir": str(EXPORT_DIR.relative_to(BASE_DIR)),
        "exports_synced": exports_ok,
    }


@app.get("/api/doctor/exports/manifest")
def doctor_exports_manifest(user: sqlite3.Row = Depends(get_current_user)) -> dict:
    if user["role"] != "doctor":
        raise HTTPException(status_code=403, detail="Doctors only")
    manifest_path = EXPORT_DIR / "manifest.json"
    if not manifest_path.is_file():
        refreshed = _refresh_exports()
        if refreshed:
            return {"manifest": refreshed, "files": list_export_files_for_doctor(user["email"])}
        raise HTTPException(status_code=503, detail="Export sync unavailable")
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    manifest["filesForClinician"] = list_export_files_for_doctor(user["email"])
    return {"manifest": manifest, "files": manifest["filesForClinician"]}


@app.post("/api/doctor/exports/sync")
def doctor_exports_sync(user: sqlite3.Row = Depends(get_current_user)) -> dict:
    if user["role"] != "doctor":
        raise HTTPException(status_code=403, detail="Doctors only")
    refreshed = _refresh_exports()
    if refreshed is None:
        raise HTTPException(status_code=503, detail="Export sync failed")
    refreshed["filesForClinician"] = list_export_files_for_doctor(user["email"])
    return refreshed


@app.get("/api/doctor/exports/download")
def doctor_export_download(
    path: str,
    user: sqlite3.Row = Depends(get_current_user),
) -> FileResponse:
    if user["role"] != "doctor":
        raise HTTPException(status_code=403, detail="Doctors only")
    doctor_slug = path.split("/")[1] if path.startswith("clinicians/") else ""
    if doctor_slug:
        expected = _safe_slug(user["email"])
        if doctor_slug != expected:
            raise HTTPException(status_code=403, detail="Not allowed to download another clinician's export")
    full = resolve_export_path(path)
    if full is None:
        raise HTTPException(status_code=404, detail="Export file not found")
    return FileResponse(
        full,
        media_type="text/csv",
        filename=full.name,
    )


@app.post("/api/register")
def register(body: RegisterBody) -> JSONResponse:
    email = slug_email(str(body.email))
    pw_hash = generate_password_hash(body.password)
    created = utcnow().isoformat()
    try:
        with get_db() as conn:
            cur = conn.execute(
                """
                INSERT INTO users (email, password_hash, role, display_name, created_at)
                VALUES (?, ?, ?, ?, ?)
                """,
                (email, pw_hash, body.role, body.display_name.strip(), created),
            )
            uid = cur.lastrowid
    except sqlite3.IntegrityError as exc:
        msg = str(exc).lower()
        if "unique" in msg or "email" in msg:
            raise HTTPException(status_code=409, detail="Email already registered")
        if "check constraint failed" in msg and body.role == "caregiver":
            raise HTTPException(
                status_code=500,
                detail="Caregiver accounts are not enabled on this server database. Restart server.py after updating.",
            )
        raise HTTPException(status_code=400, detail="Could not create account")
    return JSONResponse({"ok": True, "user_id": uid}, status_code=201)


@app.post("/api/login")
def login(body: LoginBody) -> dict:
    email = slug_email(str(body.email))
    with get_db() as conn:
        row = conn.execute("SELECT * FROM users WHERE email = ?", (email,)).fetchone()
    if row is None or not check_password_hash(row["password_hash"], body.password):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    token = secrets.token_urlsafe(32)
    expires = (utcnow() + timedelta(days=7)).isoformat()
    with get_db() as conn:
        conn.execute(
            "INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)",
            (token, row["id"], expires),
        )
    return {"token": token, "user": row_user(row)}


@app.post("/api/logout")
def logout(token: str = Depends(get_token)) -> dict:
    with get_db() as conn:
        conn.execute("DELETE FROM sessions WHERE token = ?", (token,))
    return {"ok": True}


@app.get("/api/me")
def me(user: sqlite3.Row = Depends(get_current_user)) -> dict:
    return {"user": row_user(user)}


def _prior_submissions_for_user(conn: sqlite3.Connection, patient_user_id: int, limit: int = 10) -> list[dict]:
    rows = conn.execute(
        """
        SELECT answers_json FROM submissions
        WHERE patient_user_id = ? AND deleted_at IS NULL
        ORDER BY submitted_at DESC LIMIT ?
        """,
        (patient_user_id, limit),
    ).fetchall()
    return [{"answers": json.loads(r["answers_json"])} for r in rows]


@app.patch("/api/me/consent")
def update_consent(body: ConsentBody, user: sqlite3.Row = Depends(get_current_user)) -> dict:
    if user["role"] != "patient":
        raise HTTPException(status_code=403, detail="Only patients can set chat sharing consent")
    val = 1 if body.share_chat_with_doctor else 0
    with get_db() as conn:
        conn.execute(
            "UPDATE users SET share_chat_with_doctor = ? WHERE id = ?",
            (val, user["id"]),
        )
        row = conn.execute("SELECT * FROM users WHERE id = ?", (user["id"],)).fetchone()
    _refresh_exports()
    return {"user": row_user(row)}


@app.patch("/api/me/caregiver-consent")
def update_caregiver_consent(body: CaregiverConsentBody, user: sqlite3.Row = Depends(get_current_user)) -> dict:
    if user["role"] != "patient":
        raise HTTPException(status_code=403, detail="Only patients can set caregiver sharing consent")
    with get_db() as conn:
        row = conn.execute("SELECT * FROM users WHERE id = ?", (user["id"],)).fetchone()
        partner_val = int(row["share_with_partner"] or 0)
        children_val = int(row["share_with_children"] or 0)
        if body.share_with_partner is not None:
            partner_val = 1 if body.share_with_partner else 0
        if body.share_with_children is not None:
            children_val = 1 if body.share_with_children else 0
        if (
            body.share_with_caregiver is not None
            and body.share_with_partner is None
            and body.share_with_children is None
        ):
            partner_val = children_val = 1 if body.share_with_caregiver else 0
        legacy_val = 1 if (partner_val or children_val) else 0
        conn.execute(
            """
            UPDATE users
            SET share_with_partner = ?, share_with_children = ?, share_with_caregiver = ?
            WHERE id = ?
            """,
            (partner_val, children_val, legacy_val, user["id"]),
        )
        row = conn.execute("SELECT * FROM users WHERE id = ?", (user["id"],)).fetchone()
    return {"user": row_user(row)}


@app.put("/api/me/between-visit")
def upsert_between_visit(body: BetweenVisitBody, user: sqlite3.Row = Depends(get_current_user)) -> dict:
    if user["role"] != "patient":
        raise HTTPException(status_code=403, detail="Patients only")
    updated = utcnow().isoformat()
    payload = json.dumps(body.snapshot)
    with get_db() as conn:
        conn.execute(
            """
            INSERT INTO between_visit_snapshots (patient_user_id, snapshot_json, updated_at)
            VALUES (?, ?, ?)
            ON CONFLICT(patient_user_id) DO UPDATE SET snapshot_json = excluded.snapshot_json, updated_at = excluded.updated_at
            """,
            (user["id"], payload, updated),
        )
    return {"ok": True, "updatedAt": updated}


@app.get("/api/chat/messages")
def list_chat(user: sqlite3.Row = Depends(get_current_user)) -> list[dict]:
    if user["role"] != "patient":
        raise HTTPException(status_code=403, detail="Patients only")
    with get_db() as conn:
        rows = conn.execute(
            """
            SELECT id, role, text, created_at FROM chat_messages
            WHERE patient_user_id = ? ORDER BY created_at ASC
            """,
            (user["id"],),
        ).fetchall()
    return [_chat_from_row(r) for r in rows]


@app.post("/api/chat/messages")
def add_chat(body: ChatMessageBody, user: sqlite3.Row = Depends(get_current_user)) -> dict:
    if user["role"] != "patient":
        raise HTTPException(status_code=403, detail="Patients only")
    mid = str(uuid.uuid4())
    created = utcnow().isoformat()
    with get_db() as conn:
        conn.execute(
            """
            INSERT INTO chat_messages (id, patient_user_id, role, text, created_at)
            VALUES (?, ?, ?, ?, ?)
            """,
            (mid, user["id"], body.role, body.text.strip(), created),
        )
    _refresh_exports()
    return {"id": mid, "role": body.role, "text": body.text.strip(), "createdAt": created}


@app.delete("/api/chat/messages")
def clear_chat(user: sqlite3.Row = Depends(get_current_user)) -> dict:
    if user["role"] != "patient":
        raise HTTPException(status_code=403, detail="Patients only")
    with get_db() as conn:
        conn.execute("DELETE FROM chat_messages WHERE patient_user_id = ?", (user["id"],))
    _refresh_exports()
    return {"ok": True}


def _direct_message_from_row(r: sqlite3.Row) -> dict:
    return {
        "id": r["id"],
        "channel": r["channel"],
        "senderRole": r["sender_role"],
        "senderDisplayName": r["sender_display_name"],
        "text": r["text"],
        "urgent": bool(r["urgent"]),
        "createdAt": r["created_at"],
    }


def _list_direct_messages(conn: sqlite3.Connection, patient_user_id: int, channel: str) -> list[dict]:
    rows = conn.execute(
        """
        SELECT m.id, m.channel, m.sender_role, m.sender_user_id, m.text, m.urgent, m.created_at,
               u.display_name AS sender_display_name
        FROM direct_messages m
        JOIN users u ON u.id = m.sender_user_id
        WHERE m.patient_user_id = ? AND m.channel = ?
        ORDER BY m.created_at ASC
        """,
        (patient_user_id, channel),
    ).fetchall()
    return [_direct_message_from_row(r) for r in rows]


def _insert_direct_message(
    conn: sqlite3.Connection,
    *,
    patient_user_id: int,
    channel: str,
    sender_role: str,
    sender_user_id: int,
    text: str,
    urgent: bool,
) -> dict:
    mid = str(uuid.uuid4())
    created = utcnow().isoformat()
    conn.execute(
        """
        INSERT INTO direct_messages
            (id, patient_user_id, channel, sender_role, sender_user_id, text, urgent, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (mid, patient_user_id, channel, sender_role, sender_user_id, text.strip(), 1 if urgent else 0, created),
    )
    row = conn.execute(
        """
        SELECT m.id, m.channel, m.sender_role, m.sender_user_id, m.text, m.urgent, m.created_at,
               u.display_name AS sender_display_name
        FROM direct_messages m
        JOIN users u ON u.id = m.sender_user_id
        WHERE m.id = ?
        """,
        (mid,),
    ).fetchone()
    return _direct_message_from_row(row)


def _patient_has_linked_doctor(conn: sqlite3.Connection, patient_user_id: int) -> bool:
    row = conn.execute(
        "SELECT 1 FROM doctor_patient_links WHERE patient_user_id = ? LIMIT 1",
        (patient_user_id,),
    ).fetchone()
    return row is not None


def _patient_has_linked_caregiver(conn: sqlite3.Connection, patient_user_id: int) -> bool:
    row = conn.execute(
        "SELECT 1 FROM caregiver_patient_links WHERE patient_user_id = ? LIMIT 1",
        (patient_user_id,),
    ).fetchone()
    return row is not None


@app.get("/api/direct-messages/contacts")
def direct_message_contacts(user: sqlite3.Row = Depends(get_current_user)) -> dict:
    if user["role"] != "patient":
        raise HTTPException(status_code=403, detail="Patients only")
    with get_db() as conn:
        doctors = conn.execute(
            """
            SELECT u.email, u.display_name, u.contact_phone FROM doctor_patient_links l
            JOIN users u ON u.id = l.doctor_user_id
            WHERE l.patient_user_id = ?
            ORDER BY l.created_at ASC
            """,
            (user["id"],),
        ).fetchall()
        caregivers = conn.execute(
            """
            SELECT u.email, u.display_name, u.contact_phone, l.relationship
            FROM caregiver_patient_links l
            JOIN users u ON u.id = l.caregiver_user_id
            WHERE l.patient_user_id = ?
            ORDER BY l.created_at ASC
            """,
            (user["id"],),
        ).fetchall()
    doctor = doctors[0] if doctors else None
    caregiver_rows = [
        {
            "displayName": r["display_name"],
            "email": r["email"],
            "phone": r["contact_phone"] or None,
            "relationship": r["relationship"] or "other",
        }
        for r in caregivers
    ]
    return {
        "hasLinkedDoctor": doctor is not None,
        "hasLinkedCaregiver": len(caregiver_rows) > 0,
        "doctorDisplayName": doctor["display_name"] if doctor else None,
        "doctorEmail": doctor["email"] if doctor else None,
        "doctorPhone": doctor["contact_phone"] if doctor else None,
        "caregiverDisplayNames": [r["displayName"] for r in caregiver_rows],
        "caregiverEmails": [r["email"] for r in caregiver_rows],
        "caregivers": caregiver_rows,
        "doctor": (
            {
                "displayName": doctor["display_name"],
                "email": doctor["email"],
                "phone": doctor["contact_phone"] or None,
            }
            if doctor
            else None
        ),
    }


@app.get("/api/direct-messages/{channel}")
def list_patient_direct_messages(channel: str, user: sqlite3.Row = Depends(get_current_user)) -> dict:
    if user["role"] != "patient":
        raise HTTPException(status_code=403, detail="Patients only")
    if channel not in ("doctor", "caregiver"):
        raise HTTPException(status_code=400, detail="Invalid channel")
    with get_db() as conn:
        if channel == "doctor" and not _patient_has_linked_doctor(conn, user["id"]):
            return {"linked": False, "messages": [], "message": "No linked clinician yet."}
        if channel == "caregiver" and not _patient_has_linked_caregiver(conn, user["id"]):
            return {"linked": False, "messages": [], "message": "No linked caregiver yet."}
        messages = _list_direct_messages(conn, user["id"], channel)
    return {"linked": True, "messages": messages}


@app.post("/api/direct-messages/{channel}")
def send_patient_direct_message(
    channel: str, body: DirectMessageBody, user: sqlite3.Row = Depends(get_current_user)
) -> dict:
    if user["role"] != "patient":
        raise HTTPException(status_code=403, detail="Patients only")
    if channel not in ("doctor", "caregiver"):
        raise HTTPException(status_code=400, detail="Invalid channel")
    with get_db() as conn:
        if channel == "doctor" and not _patient_has_linked_doctor(conn, user["id"]):
            raise HTTPException(status_code=404, detail="No linked clinician")
        if channel == "caregiver" and not _patient_has_linked_caregiver(conn, user["id"]):
            raise HTTPException(status_code=404, detail="No linked caregiver")
        msg = _insert_direct_message(
            conn,
            patient_user_id=user["id"],
            channel=channel,
            sender_role="patient",
            sender_user_id=user["id"],
            text=body.text,
            urgent=body.urgent,
        )
    return msg


def _enrich_moderation_guidance(r: sqlite3.Row, guidance: dict) -> dict:
    """Backfill guidance for rows saved before moderation_guidance_json existed."""
    body = (r["body"] or "").lower()
    reason = (r["moderation_reason"] or "").strip()
    flags = []
    try:
        flags = json.loads(r["moderation_flags_json"] or "[]")
    except json.JSONDecodeError:
        pass

    if r["status"] == "approved":
        return guidance

    gt = guidance.get("guidanceType") or "none"
    msg = (guidance.get("patientMessage") or "").strip()

    if gt == "none":
        if any(w in body for w in ("suicid", "kill myself", "want to die", "severe bleeding", "fainting")):
            gt = "emergency"
        elif any("emergency" in str(f).lower() for f in flags):
            gt = "emergency"
        elif any("policy" in str(f).lower() for f in flags):
            gt = "warning"
        elif reason:
            gt = "warning"

    if not msg and reason:
        msg = reason

    return {"guidanceType": gt, "patientMessage": msg[:800]}


COMMUNITY_GROUPS: list[dict[str, str]] = [
    {"id": "newly-diagnosed", "label": "Newly diagnosed", "desc": "Shock, first steps, telling family", "theme": "new"},
    {"id": "chemo", "label": "Chemotherapy", "desc": "Cycles, fatigue, nausea, hair loss", "theme": "chemo"},
    {"id": "surgery", "label": "Surgery & mastectomy", "desc": "Before/after op, recovery, scars", "theme": "surgery"},
    {"id": "radiation", "label": "Radiation", "desc": "Daily treatment, skin changes, tiredness", "theme": "radiation"},
    {"id": "body-image", "label": "Body image & reconstruction", "desc": "Mirrors, prosthetics, identity", "theme": "body"},
    {"id": "scanxiety", "label": "Scan & results anxiety", "desc": "Waiting between tests, recurrence fear", "theme": "scan"},
    {"id": "survivorship", "label": "Survivorship", "desc": "Life after active treatment", "theme": "survive"},
    {"id": "caregivers", "label": "Family & caregivers", "desc": "Partners, children, practical support", "theme": "family"},
]

VALID_COMMUNITY_GROUP_IDS = {g["id"] for g in COMMUNITY_GROUPS}

VALID_COMMUNITY_EMOJI_IDS = {"care", "hug", "strong", "together", "hope", "gentle"}

COMMUNITY_MEMBER_ROLES = {"patient", "caregiver"}


def _require_community_member(user: sqlite3.Row) -> None:
    if user["role"] not in COMMUNITY_MEMBER_ROLES:
        raise HTTPException(status_code=403, detail="Community is for patients and caregivers only")


def _reaction_summaries_for_targets(
    conn: sqlite3.Connection,
    target_type: str,
    target_ids: list[str],
    user_id: int,
) -> dict[str, list[dict]]:
    if not target_ids:
        return {}
    placeholders = ",".join("?" * len(target_ids))
    rows = conn.execute(
        f"""
        SELECT target_id, emoji_id, COUNT(*) AS cnt,
               MAX(CASE WHEN user_id = ? THEN 1 ELSE 0 END) AS mine
        FROM community_reactions
        WHERE target_type = ? AND target_id IN ({placeholders})
        GROUP BY target_id, emoji_id
        """,
        [user_id, target_type, *target_ids],
    ).fetchall()
    out: dict[str, list[dict]] = {tid: [] for tid in target_ids}
    for r in rows:
        if r["emoji_id"] not in VALID_COMMUNITY_EMOJI_IDS:
            continue
        out.setdefault(r["target_id"], []).append(
            {
                "emojiId": r["emoji_id"],
                "count": int(r["cnt"]),
                "reactedByMe": bool(r["mine"]),
            }
        )
    return out


def _attach_reactions_to_items(
    conn: sqlite3.Connection,
    items: list[dict],
    target_type: str,
    id_key: str,
    user_id: int,
) -> list[dict]:
    if not items:
        return items
    summaries = _reaction_summaries_for_targets(conn, target_type, [i[id_key] for i in items], user_id)
    for item in items:
        reactions = summaries.get(item[id_key], [])
        item["reactions"] = reactions
        item["totalReactions"] = sum(r["count"] for r in reactions)
    return items


def _toggle_community_reaction(
    conn: sqlite3.Connection,
    *,
    target_type: str,
    target_id: str,
    user_id: int,
    emoji_id: str,
) -> list[dict]:
    existing = conn.execute(
        """
        SELECT 1 FROM community_reactions
        WHERE target_type = ? AND target_id = ? AND user_id = ? AND emoji_id = ?
        """,
        (target_type, target_id, user_id, emoji_id),
    ).fetchone()
    if existing:
        conn.execute(
            """
            DELETE FROM community_reactions
            WHERE target_type = ? AND target_id = ? AND user_id = ? AND emoji_id = ?
            """,
            (target_type, target_id, user_id, emoji_id),
        )
    else:
        conn.execute(
            """
            INSERT INTO community_reactions (target_type, target_id, user_id, emoji_id, created_at)
            VALUES (?, ?, ?, ?, ?)
            """,
            (target_type, target_id, user_id, emoji_id, utcnow().isoformat()),
        )
    return _reaction_summaries_for_targets(conn, target_type, [target_id], user_id).get(target_id, [])


def _community_post_row(r: sqlite3.Row, comment_count: int = 0, *, patient_email: str | None = None) -> dict:
    guidance = _enrich_moderation_guidance(r, parse_moderation_guidance(r))
    out = {
        "id": r["id"],
        "authorDisplay": r["author_display"],
        "body": r["body"],
        "status": r["status"],
        "moderationReason": r["moderation_reason"],
        "moderationFlags": json.loads(r["moderation_flags_json"] or "[]"),
        "guidanceType": guidance["guidanceType"],
        "patientMessage": guidance["patientMessage"],
        "createdAt": r["created_at"],
        "commentCount": comment_count,
        "groupId": r["group_id"] if "group_id" in r.keys() else "survivorship",
    }
    if patient_email is not None:
        out["patientEmail"] = patient_email
    return out


def _community_comment_row(r: sqlite3.Row, *, patient_email: str | None = None) -> dict:
    guidance = _enrich_moderation_guidance(r, parse_moderation_guidance(r))
    out = {
        "id": r["id"],
        "postId": r["post_id"],
        "authorDisplay": r["author_display"],
        "body": r["body"],
        "status": r["status"],
        "moderationReason": r["moderation_reason"],
        "moderationFlags": json.loads(r["moderation_flags_json"] or "[]"),
        "guidanceType": guidance["guidanceType"],
        "patientMessage": guidance["patientMessage"],
        "createdAt": r["created_at"],
    }
    if patient_email is not None:
        out["patientEmail"] = patient_email
    return out


@app.get("/api/community/groups")
def list_community_groups(user: sqlite3.Row = Depends(get_current_user)) -> dict:
    with get_db() as conn:
        joined_rows = conn.execute(
            "SELECT group_id FROM community_group_memberships WHERE user_id = ?",
            (user["id"],),
        ).fetchall()
        joined = {r["group_id"] for r in joined_rows}
        counts = {
            r["group_id"]: r["n"]
            for r in conn.execute(
                """
                SELECT group_id, COUNT(*) AS n FROM community_group_memberships
                GROUP BY group_id
                """
            ).fetchall()
        }
    groups = []
    for g in COMMUNITY_GROUPS:
        groups.append(
            {
                **g,
                "memberCount": counts.get(g["id"], 0),
                "joined": g["id"] in joined,
            }
        )
    return {"groups": groups, "joinedGroupIds": sorted(joined)}


@app.post("/api/community/groups/{group_id}/join")
def join_community_group(group_id: str, user: sqlite3.Row = Depends(get_current_user)) -> dict:
    _require_community_member(user)
    if group_id not in VALID_COMMUNITY_GROUP_IDS:
        raise HTTPException(status_code=404, detail="Unknown group")
    with get_db() as conn:
        conn.execute(
            """
            INSERT OR IGNORE INTO community_group_memberships (user_id, group_id, joined_at)
            VALUES (?, ?, ?)
            """,
            (user["id"], group_id, utcnow().isoformat()),
        )
        joined = [
            r["group_id"]
            for r in conn.execute(
                "SELECT group_id FROM community_group_memberships WHERE user_id = ?",
                (user["id"],),
            ).fetchall()
        ]
    return {"ok": True, "joinedGroupIds": joined}


@app.delete("/api/community/groups/{group_id}/join")
def leave_community_group(group_id: str, user: sqlite3.Row = Depends(get_current_user)) -> dict:
    _require_community_member(user)
    if group_id not in VALID_COMMUNITY_GROUP_IDS:
        raise HTTPException(status_code=404, detail="Unknown group")
    with get_db() as conn:
        conn.execute(
            "DELETE FROM community_group_memberships WHERE user_id = ? AND group_id = ?",
            (user["id"], group_id),
        )
        joined = [
            r["group_id"]
            for r in conn.execute(
                "SELECT group_id FROM community_group_memberships WHERE user_id = ?",
                (user["id"],),
            ).fetchall()
        ]
    return {"ok": True, "joinedGroupIds": joined}


@app.get("/api/community/posts")
def list_community_posts(
    group_id: str | None = None,
    user: sqlite3.Row = Depends(get_current_user),
) -> list[dict]:
    with get_db() as conn:
        if group_id:
            if group_id not in VALID_COMMUNITY_GROUP_IDS:
                raise HTTPException(status_code=400, detail="Unknown group")
            where = "p.status = 'approved' AND p.group_id = ?"
            params: list = [group_id]
        else:
            joined = [
                r["group_id"]
                for r in conn.execute(
                    "SELECT group_id FROM community_group_memberships WHERE user_id = ?",
                    (user["id"],),
                ).fetchall()
            ]
            if not joined:
                return []
            placeholders = ",".join("?" * len(joined))
            where = f"p.status = 'approved' AND p.group_id IN ({placeholders})"
            params = joined
        rows = conn.execute(
            f"""
            SELECT p.*, (
              SELECT COUNT(*) FROM community_comments c
              WHERE c.post_id = p.id AND c.status = 'approved'
            ) AS cc
            FROM community_posts p
            WHERE {where}
            ORDER BY p.created_at DESC
            LIMIT 100
            """,
            params,
        ).fetchall()
        items = [_community_post_row(r, int(r["cc"])) for r in rows]
        return _attach_reactions_to_items(conn, items, "post", "id", user["id"])


@app.get("/api/community/posts/mine")
def list_my_community_posts(user: sqlite3.Row = Depends(get_current_user)) -> list[dict]:
    _require_community_member(user)
    with get_db() as conn:
        rows = conn.execute(
            """
            SELECT p.*, 0 AS cc FROM community_posts p
            WHERE p.author_user_id = ?
            ORDER BY p.created_at DESC
            """,
            (user["id"],),
        ).fetchall()
        items = [_community_post_row(r, 0) for r in rows]
        return _attach_reactions_to_items(conn, items, "post", "id", user["id"])


@app.post("/api/community/posts")
def create_community_post(body: CommunityPostBody, user: sqlite3.Row = Depends(get_current_user)) -> dict:
    _require_community_member(user)
    if body.group_id not in VALID_COMMUNITY_GROUP_IDS:
        raise HTTPException(status_code=400, detail="Unknown group")
    text = body.body.strip()
    mod = moderate_community_text(text, "post")
    status = "approved" if mod["approved"] else "rejected"
    pid = str(uuid.uuid4())
    created = utcnow().isoformat()
    with get_db() as conn:
        member = conn.execute(
            "SELECT 1 FROM community_group_memberships WHERE user_id = ? AND group_id = ?",
            (user["id"], body.group_id),
        ).fetchone()
        if member is None:
            raise HTTPException(status_code=403, detail="Join this group before posting")
        conn.execute(
            """
            INSERT INTO community_posts
            (id, author_user_id, author_display, body, status, moderation_reason, moderation_flags_json,
             moderation_guidance_json, group_id, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                pid,
                user["id"],
                user["display_name"],
                text,
                status,
                mod["reason"],
                json.dumps(mod.get("flags") or []),
                moderation_guidance_json(mod),
                body.group_id,
                created,
            ),
        )
        row = conn.execute("SELECT * FROM community_posts WHERE id = ?", (pid,)).fetchone()
    return _community_post_row(row, 0)


@app.get("/api/community/posts/{post_id}/comments")
def list_post_comments(post_id: str, user: sqlite3.Row = Depends(get_current_user)) -> list[dict]:
    with get_db() as conn:
        rows = conn.execute(
            """
            SELECT * FROM community_comments
            WHERE post_id = ? AND status = 'approved'
            ORDER BY created_at ASC
            """,
            (post_id,),
        ).fetchall()
        items = [_community_comment_row(r) for r in rows]
        return _attach_reactions_to_items(conn, items, "comment", "id", user["id"])


@app.post("/api/community/posts/{post_id}/reactions")
def toggle_post_reaction(
    post_id: str, body: CommunityReactionBody, user: sqlite3.Row = Depends(get_current_user)
) -> dict:
    _require_community_member(user)
    if body.emoji_id not in VALID_COMMUNITY_EMOJI_IDS:
        raise HTTPException(status_code=400, detail="Unknown reaction")
    with get_db() as conn:
        post = conn.execute(
            "SELECT id FROM community_posts WHERE id = ? AND status = 'approved'", (post_id,)
        ).fetchone()
        if post is None:
            raise HTTPException(status_code=404, detail="Post not found")
        reactions = _toggle_community_reaction(
            conn, target_type="post", target_id=post_id, user_id=user["id"], emoji_id=body.emoji_id
        )
    return {"reactions": reactions, "totalReactions": sum(r["count"] for r in reactions)}


@app.post("/api/community/comments/{comment_id}/reactions")
def toggle_comment_reaction(
    comment_id: str, body: CommunityReactionBody, user: sqlite3.Row = Depends(get_current_user)
) -> dict:
    _require_community_member(user)
    if body.emoji_id not in VALID_COMMUNITY_EMOJI_IDS:
        raise HTTPException(status_code=400, detail="Unknown reaction")
    with get_db() as conn:
        comment = conn.execute(
            "SELECT id FROM community_comments WHERE id = ? AND status = 'approved'", (comment_id,)
        ).fetchone()
        if comment is None:
            raise HTTPException(status_code=404, detail="Comment not found")
        reactions = _toggle_community_reaction(
            conn,
            target_type="comment",
            target_id=comment_id,
            user_id=user["id"],
            emoji_id=body.emoji_id,
        )
    return {"reactions": reactions, "totalReactions": sum(r["count"] for r in reactions)}


@app.post("/api/community/posts/{post_id}/comments")
def create_post_comment(
    post_id: str, body: CommunityBody, user: sqlite3.Row = Depends(get_current_user)
) -> dict:
    _require_community_member(user)
    text = body.body.strip()
    with get_db() as conn:
        post = conn.execute(
            "SELECT id FROM community_posts WHERE id = ? AND status = 'approved'", (post_id,)
        ).fetchone()
        if post is None:
            raise HTTPException(status_code=404, detail="Post not found")
    mod = moderate_community_text(text, "comment")
    status = "approved" if mod["approved"] else "rejected"
    cid = str(uuid.uuid4())
    created = utcnow().isoformat()
    with get_db() as conn:
        conn.execute(
            """
            INSERT INTO community_comments
            (id, post_id, author_user_id, author_display, body, status, moderation_reason, moderation_flags_json,
             moderation_guidance_json, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                cid,
                post_id,
                user["id"],
                user["display_name"],
                text,
                status,
                mod["reason"],
                json.dumps(mod.get("flags") or []),
                moderation_guidance_json(mod),
                created,
            ),
        )
        row = conn.execute("SELECT * FROM community_comments WHERE id = ?", (cid,)).fetchone()
    return _community_comment_row(row)


@app.get("/api/doctor/community/moderation")
def doctor_moderation_queue(user: sqlite3.Row = Depends(get_current_user)) -> dict:
    """Read-only safety log: flagged posts/comments (not published to the public feed)."""
    if user["role"] != "doctor":
        raise HTTPException(status_code=403, detail="Doctors only")
    doctor_id = user["id"]
    with get_db() as conn:
        all_posts = conn.execute(
            """
            SELECT p.*, u.email AS patient_email
            FROM community_posts p
            JOIN users u ON u.id = p.author_user_id
            WHERE p.status != 'approved'
            ORDER BY p.created_at DESC
            LIMIT 50
            """
        ).fetchall()
        all_comments = conn.execute(
            """
            SELECT c.*, u.email AS patient_email
            FROM community_comments c
            JOIN users u ON u.id = c.author_user_id
            WHERE c.status != 'approved'
            ORDER BY c.created_at DESC
            LIMIT 50
            """
        ).fetchall()
        linked_posts = conn.execute(
            """
            SELECT p.*, u.email AS patient_email
            FROM community_posts p
            JOIN users u ON u.id = p.author_user_id
            WHERE p.status != 'approved'
              AND p.author_user_id IN (
                SELECT patient_user_id FROM doctor_patient_links WHERE doctor_user_id = ?
              )
            ORDER BY p.created_at DESC
            LIMIT 50
            """,
            (doctor_id,),
        ).fetchall()
        linked_comments = conn.execute(
            """
            SELECT c.*, u.email AS patient_email
            FROM community_comments c
            JOIN users u ON u.id = c.author_user_id
            WHERE c.status != 'approved'
              AND c.author_user_id IN (
                SELECT patient_user_id FROM doctor_patient_links WHERE doctor_user_id = ?
              )
            ORDER BY c.created_at DESC
            LIMIT 50
            """,
            (doctor_id,),
        ).fetchall()
    return {
        "allPosts": [
            _community_post_row(r, 0, patient_email=r["patient_email"]) for r in all_posts
        ],
        "allComments": [
            _community_comment_row(r, patient_email=r["patient_email"]) for r in all_comments
        ],
        "linkedPosts": [
            _community_post_row(r, 0, patient_email=r["patient_email"]) for r in linked_posts
        ],
        "linkedComments": [
            _community_comment_row(r, patient_email=r["patient_email"]) for r in linked_comments
        ],
        "note": (
            "Read-only safety log. Rejected content never appears in the public feed. "
            "Use the Linked patients tab to follow up with your panel; All patients shows the full demo queue."
        ),
    }


@app.post("/api/chat/ai-reply")
def chat_ai_reply(body: AiReplyBody, user: sqlite3.Row = Depends(get_current_user)) -> dict:
    if user["role"] != "patient":
        raise HTTPException(status_code=403, detail="Patients only")
    if not ai_chat_configured():
        raise HTTPException(
            status_code=503,
            detail="AI support is not configured. Set OPENAI_API_KEY on the server.",
        )
    try:
        reply = generate_reply(body.message.strip(), body.context)
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e)) from e
    return {"reply": reply}


@app.post("/api/submissions")
def create_submission(body: AnswersBody, user: sqlite3.Row = Depends(get_current_user)) -> dict:
    if user["role"] != "patient":
        raise HTTPException(status_code=403, detail="Only patients can submit check-ins")
    ok, stored_answers, err = validate_checkin_answers(body.answers)
    if not ok or stored_answers is None:
        raise HTTPException(status_code=400, detail=err)
    with get_db() as conn:
        prior = _prior_submissions_for_user(conn, user["id"])
    sm = build_patient_summary(stored_answers, prior)
    sid = str(uuid.uuid4())
    submitted = utcnow().isoformat()
    with get_db() as conn:
        conn.execute(
            """
            INSERT INTO submissions (id, patient_user_id, submitted_at, answers_json, summary_model_json, summary_plain)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (
                sid,
                user["id"],
                submitted,
                json.dumps(stored_answers, ensure_ascii=False),
                json.dumps(sm, ensure_ascii=False),
                sm["plainText"],
            ),
        )
    _refresh_exports()
    return {
        "id": sid,
        "submittedAt": submitted,
        "answers": stored_answers,
        "summaryModel": sm,
        "summary": sm["plainText"],
    }


def _owned_submission_row(
    conn: sqlite3.Connection, patient_user_id: int, submission_id: str
) -> sqlite3.Row | None:
    return conn.execute(
        """
        SELECT id, submitted_at, answers_json, summary_model_json, summary_plain, deleted_at
        FROM submissions WHERE id = ? AND patient_user_id = ?
        """,
        (submission_id, patient_user_id),
    ).fetchone()


@app.get("/api/submissions/mine")
def list_mine(user: sqlite3.Row = Depends(get_current_user)) -> list[dict]:
    if user["role"] != "patient":
        raise HTTPException(status_code=403, detail="Patients only")
    with get_db() as conn:
        rows = conn.execute(
            """
            SELECT id, submitted_at, answers_json, summary_model_json, summary_plain, deleted_at
            FROM submissions
            WHERE patient_user_id = ? AND deleted_at IS NULL
            ORDER BY submitted_at DESC
            """,
            (user["id"],),
        ).fetchall()
    return [_submission_from_row(r) for r in rows]


@app.get("/api/submissions/mine/trash")
def list_mine_trash(user: sqlite3.Row = Depends(get_current_user)) -> list[dict]:
    if user["role"] != "patient":
        raise HTTPException(status_code=403, detail="Patients only")
    with get_db() as conn:
        rows = conn.execute(
            """
            SELECT id, submitted_at, answers_json, summary_model_json, summary_plain, deleted_at
            FROM submissions
            WHERE patient_user_id = ? AND deleted_at IS NOT NULL
            ORDER BY deleted_at DESC
            """,
            (user["id"],),
        ).fetchall()
    return [_submission_from_row(r) for r in rows]


@app.post("/api/submissions/{submission_id}/retract")
def retract_submission(submission_id: str, user: sqlite3.Row = Depends(get_current_user)) -> dict:
    if user["role"] != "patient":
        raise HTTPException(status_code=403, detail="Patients only")
    with get_db() as conn:
        row = _owned_submission_row(conn, user["id"], submission_id)
        if row is None:
            raise HTTPException(status_code=404, detail="Check-in not found")
        if row["deleted_at"]:
            return {"ok": True, "id": submission_id, "deletedAt": row["deleted_at"]}
        deleted = utcnow().isoformat()
        conn.execute(
            "UPDATE submissions SET deleted_at = ? WHERE id = ? AND patient_user_id = ?",
            (deleted, submission_id, user["id"]),
        )
    _refresh_exports()
    return {"ok": True, "id": submission_id, "deletedAt": deleted}


@app.post("/api/submissions/{submission_id}/restore")
def restore_submission(submission_id: str, user: sqlite3.Row = Depends(get_current_user)) -> dict:
    if user["role"] != "patient":
        raise HTTPException(status_code=403, detail="Patients only")
    with get_db() as conn:
        row = _owned_submission_row(conn, user["id"], submission_id)
        if row is None:
            raise HTTPException(status_code=404, detail="Check-in not found")
        if not row["deleted_at"]:
            return {"ok": True, "id": submission_id}
        conn.execute(
            "UPDATE submissions SET deleted_at = NULL WHERE id = ? AND patient_user_id = ?",
            (submission_id, user["id"]),
        )
    _refresh_exports()
    return {"ok": True, "id": submission_id}


@app.delete("/api/submissions/{submission_id}")
def purge_submission(submission_id: str, user: sqlite3.Row = Depends(get_current_user)) -> dict:
    if user["role"] != "patient":
        raise HTTPException(status_code=403, detail="Patients only")
    with get_db() as conn:
        row = _owned_submission_row(conn, user["id"], submission_id)
        if row is None:
            raise HTTPException(status_code=404, detail="Check-in not found")
        if not row["deleted_at"]:
            raise HTTPException(
                status_code=400,
                detail="Move the check-in to the recycle bin before deleting permanently.",
            )
        conn.execute(
            "DELETE FROM submissions WHERE id = ? AND patient_user_id = ?",
            (submission_id, user["id"]),
        )
    _refresh_exports()
    return {"ok": True, "id": submission_id}


@app.post("/api/links")
def link_patient(body: LinkBody, user: sqlite3.Row = Depends(get_current_user)) -> dict:
    if user["role"] != "doctor":
        raise HTTPException(status_code=403, detail="Only doctors can link patients")
    p_email = slug_email(str(body.patient_email))
    with get_db() as conn:
        prow = conn.execute(
            "SELECT id, role FROM users WHERE email = ?", (p_email,)
        ).fetchone()
        if prow is None:
            raise HTTPException(status_code=404, detail="Patient email not found")
        if prow["role"] != "patient":
            raise HTTPException(status_code=400, detail="Target user is not a patient account")
        conn.execute(
            """
            INSERT OR IGNORE INTO doctor_patient_links (doctor_user_id, patient_user_id, created_at)
            VALUES (?, ?, ?)
            """,
            (user["id"], prow["id"], utcnow().isoformat()),
        )
    _refresh_exports()
    return {"ok": True, "patient_email": p_email, "patient_user_id": prow["id"]}


@app.post("/api/caregiver/links")
def caregiver_link_patient(body: CaregiverLinkBody, user: sqlite3.Row = Depends(get_current_user)) -> dict:
    if user["role"] != "caregiver":
        raise HTTPException(status_code=403, detail="Only caregivers can link patients")
    p_email = slug_email(str(body.patient_email))
    relationship = body.relationship if body.relationship in ("partner", "child", "other") else "other"
    with get_db() as conn:
        prow = conn.execute(
            "SELECT id, role FROM users WHERE email = ?", (p_email,)
        ).fetchone()
        if prow is None:
            raise HTTPException(status_code=404, detail="Patient email not found")
        if prow["role"] != "patient":
            raise HTTPException(status_code=400, detail="Target user is not a patient account")
        conn.execute(
            """
            INSERT INTO caregiver_patient_links (caregiver_user_id, patient_user_id, created_at, relationship)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(caregiver_user_id, patient_user_id) DO UPDATE SET relationship = excluded.relationship
            """,
            (user["id"], prow["id"], utcnow().isoformat(), relationship),
        )
    return {"ok": True, "patient_email": p_email, "patient_user_id": prow["id"], "relationship": relationship}


@app.get("/api/caregiver/patients")
def caregiver_patients(user: sqlite3.Row = Depends(get_current_user)) -> list[dict]:
    if user["role"] != "caregiver":
        raise HTTPException(status_code=403, detail="Caregivers only")
    with get_db() as conn:
        rows = conn.execute(
            """
            SELECT u.id AS patient_id, u.email AS patient_email, u.display_name,
                   u.contact_phone, u.share_with_caregiver, u.share_with_partner, u.share_with_children,
                   l.relationship
            FROM caregiver_patient_links l
            JOIN users u ON u.id = l.patient_user_id
            WHERE l.caregiver_user_id = ?
            ORDER BY u.email
            """,
            (user["id"],),
        ).fetchall()
    out = []
    for r in rows:
        rel = _caregiver_relationship(r)
        out.append(
            {
                "patient_id": r["patient_id"],
                "patient_email": r["patient_email"],
                "display_name": r["display_name"],
                "phone": r["contact_phone"] or None,
                "relationship": rel,
                "share_with_partner": bool(int(r["share_with_partner"] or 0)),
                "share_with_children": bool(int(r["share_with_children"] or 0)),
                "share_with_caregiver": _patient_sharing_enabled_for_caregiver(r, rel),
                "sharing_enabled": _patient_sharing_enabled_for_caregiver(r, rel),
            }
        )
    return out


def _linked_caregiver_patient_row(conn: sqlite3.Connection, caregiver_id: int, email: str) -> sqlite3.Row | None:
    return conn.execute(
        """
        SELECT u.id, u.email, u.share_with_caregiver, u.share_with_partner, u.share_with_children,
               u.display_name, l.relationship
        FROM caregiver_patient_links l
        JOIN users u ON u.id = l.patient_user_id
        WHERE l.caregiver_user_id = ? AND u.email = ?
        """,
        (caregiver_id, email),
    ).fetchone()


@app.get("/api/caregiver/patients/{patient_email}/between-visit")
def caregiver_between_visit(patient_email: str, user: sqlite3.Row = Depends(get_current_user)) -> dict:
    if user["role"] != "caregiver":
        raise HTTPException(status_code=403, detail="Caregivers only")
    email = slug_email(patient_email)
    with get_db() as conn:
        prow = _linked_caregiver_patient_row(conn, user["id"], email)
        if prow is None:
            raise HTTPException(status_code=404, detail="Patient not linked")
        rel = _caregiver_relationship(prow)
        if not _patient_sharing_enabled_for_caregiver(prow, rel):
            detail = (
                "Patient has not enabled sharing with adult children"
                if rel == "child"
                else "Patient has not enabled sharing with partner or spouse"
            )
            raise HTTPException(status_code=403, detail=detail)
        row = conn.execute(
            "SELECT snapshot_json, updated_at FROM between_visit_snapshots WHERE patient_user_id = ?",
            (prow["id"],),
        ).fetchone()
    if row is None:
        return {"snapshot": {}, "updatedAt": None, "patientDisplayName": prow["display_name"], "relationship": rel}
    snapshot = _filter_snapshot_for_caregiver(json.loads(row["snapshot_json"]), rel)
    return {
        "snapshot": snapshot,
        "updatedAt": row["updated_at"],
        "patientDisplayName": prow["display_name"],
        "relationship": rel,
    }


@app.get("/api/caregiver/patients/{patient_email}/direct-messages")
def caregiver_patient_direct_messages(
    patient_email: str, user: sqlite3.Row = Depends(get_current_user)
) -> dict:
    if user["role"] != "caregiver":
        raise HTTPException(status_code=403, detail="Caregivers only")
    email = slug_email(patient_email)
    with get_db() as conn:
        prow = _linked_caregiver_patient_row(conn, user["id"], email)
        if prow is None:
            raise HTTPException(status_code=404, detail="Patient not linked")
        messages = _list_direct_messages(conn, prow["id"], "caregiver")
    return {"linked": True, "messages": messages}


@app.post("/api/caregiver/patients/{patient_email}/direct-messages")
def caregiver_send_direct_message(
    patient_email: str, body: DirectMessageBody, user: sqlite3.Row = Depends(get_current_user)
) -> dict:
    if user["role"] != "caregiver":
        raise HTTPException(status_code=403, detail="Caregivers only")
    email = slug_email(patient_email)
    with get_db() as conn:
        prow = _linked_caregiver_patient_row(conn, user["id"], email)
        if prow is None:
            raise HTTPException(status_code=404, detail="Patient not linked")
        msg = _insert_direct_message(
            conn,
            patient_user_id=prow["id"],
            channel="caregiver",
            sender_role="caregiver",
            sender_user_id=user["id"],
            text=body.text,
            urgent=body.urgent,
        )
    return msg


@app.get("/api/doctor/patients/{patient_email}/between-visit")
def doctor_between_visit(patient_email: str, user: sqlite3.Row = Depends(get_current_user)) -> dict:
    if user["role"] != "doctor":
        raise HTTPException(status_code=403, detail="Doctors only")
    email = slug_email(patient_email)
    with get_db() as conn:
        prow = _linked_patient_row(conn, user["id"], email)
        if prow is None:
            raise HTTPException(status_code=404, detail="Patient not linked")
        row = conn.execute(
            "SELECT snapshot_json, updated_at FROM between_visit_snapshots WHERE patient_user_id = ?",
            (prow["id"],),
        ).fetchone()
        display_row = conn.execute(
            "SELECT display_name FROM users WHERE id = ?", (prow["id"],)
        ).fetchone()
    if row is None:
        return {
            "snapshot": {},
            "updatedAt": None,
            "patientDisplayName": display_row["display_name"] if display_row else "",
        }
    return {
        "snapshot": json.loads(row["snapshot_json"]),
        "updatedAt": row["updated_at"],
        "patientDisplayName": display_row["display_name"] if display_row else "",
    }


@app.get("/api/doctor/patients")
def doctor_patients(user: sqlite3.Row = Depends(get_current_user)) -> list[dict]:
    if user["role"] != "doctor":
        raise HTTPException(status_code=403, detail="Doctors only")
    with get_db() as conn:
        rows = conn.execute(
            """
            SELECT u.id AS patient_id, u.email AS patient_email, u.display_name,
                   u.share_chat_with_doctor
            FROM doctor_patient_links l
            JOIN users u ON u.id = l.patient_user_id
            WHERE l.doctor_user_id = ?
            ORDER BY u.email
            """,
            (user["id"],),
        ).fetchall()
    return [
        {
            "patient_id": r["patient_id"],
            "patient_email": r["patient_email"],
            "display_name": r["display_name"],
            "share_chat_with_doctor": bool(r["share_chat_with_doctor"]),
        }
        for r in rows
    ]


def _linked_patient_row(conn: sqlite3.Connection, doctor_id: int, email: str) -> sqlite3.Row | None:
    return conn.execute(
        """
        SELECT u.id, u.email, u.share_chat_with_doctor
        FROM doctor_patient_links l
        JOIN users u ON u.id = l.patient_user_id
        WHERE l.doctor_user_id = ? AND u.email = ?
        """,
        (doctor_id, email),
    ).fetchone()


@app.get("/api/doctor/patients/{patient_email}/chat")
def doctor_patient_chat(patient_email: str, user: sqlite3.Row = Depends(get_current_user)) -> dict:
    if user["role"] != "doctor":
        raise HTTPException(status_code=403, detail="Doctors only")
    email = slug_email(patient_email)
    with get_db() as conn:
        prow = _linked_patient_row(conn, user["id"], email)
        if prow is None:
            raise HTTPException(status_code=404, detail="Patient not linked")
        consent = bool(prow["share_chat_with_doctor"])
        if not consent:
            return {
                "consent": False,
                "messages": [],
                "message": "Patient has not enabled chat sharing with linked clinicians.",
            }
        rows = conn.execute(
            """
            SELECT id, role, text, created_at FROM chat_messages
            WHERE patient_user_id = ? ORDER BY created_at ASC
            """,
            (prow["id"],),
        ).fetchall()
    return {
        "consent": True,
        "messages": [_chat_from_row(r) for r in rows],
    }


@app.get("/api/doctor/patients/{patient_email}/direct-messages")
def doctor_patient_direct_messages(patient_email: str, user: sqlite3.Row = Depends(get_current_user)) -> dict:
    if user["role"] != "doctor":
        raise HTTPException(status_code=403, detail="Doctors only")
    email = slug_email(patient_email)
    with get_db() as conn:
        prow = _linked_patient_row(conn, user["id"], email)
        if prow is None:
            raise HTTPException(status_code=404, detail="Patient not linked")
        messages = _list_direct_messages(conn, prow["id"], "doctor")
    return {"linked": True, "messages": messages}


@app.post("/api/doctor/patients/{patient_email}/direct-messages")
def doctor_send_direct_message(
    patient_email: str, body: DirectMessageBody, user: sqlite3.Row = Depends(get_current_user)
) -> dict:
    if user["role"] != "doctor":
        raise HTTPException(status_code=403, detail="Doctors only")
    email = slug_email(patient_email)
    with get_db() as conn:
        prow = _linked_patient_row(conn, user["id"], email)
        if prow is None:
            raise HTTPException(status_code=404, detail="Patient not linked")
        msg = _insert_direct_message(
            conn,
            patient_user_id=prow["id"],
            channel="doctor",
            sender_role="doctor",
            sender_user_id=user["id"],
            text=body.text,
            urgent=body.urgent,
        )
    return msg


@app.get("/api/doctor/patients/{patient_email}/submissions")
def doctor_patient_submissions(patient_email: str, user: sqlite3.Row = Depends(get_current_user)) -> list[dict]:
    if user["role"] != "doctor":
        raise HTTPException(status_code=403, detail="Doctors only")
    email = slug_email(patient_email)
    with get_db() as conn:
        link = _linked_patient_row(conn, user["id"], email)
        if link is None:
            raise HTTPException(status_code=404, detail="Patient not linked")
        pid = link["id"]
        rows = conn.execute(
            """
            SELECT id, submitted_at, answers_json, summary_model_json, summary_plain, deleted_at
            FROM submissions
            WHERE patient_user_id = ? AND deleted_at IS NULL
            ORDER BY submitted_at DESC
            """,
            (pid,),
        ).fetchall()
    return [_submission_from_row(r) for r in rows]


def _validate_linked_submission(
    conn: sqlite3.Connection, patient_id: int, submission_id: str | None
) -> None:
    if not submission_id:
        return
    row = conn.execute(
        """
        SELECT id FROM submissions
        WHERE id = ? AND patient_user_id = ? AND deleted_at IS NULL
        """,
        (submission_id, patient_id),
    ).fetchone()
    if row is None:
        raise HTTPException(
            status_code=400,
            detail="linked_submission_id does not belong to this patient",
        )


def _clinical_record_from_row(r: sqlite3.Row) -> dict:
    return {
        "id": r["id"],
        "diagnosisName": r["diagnosis_name"],
        "confirmed": bool(r["confirmed"]),
        "notes": r["notes"] or "",
        "linkedSubmissionId": r["linked_submission_id"],
        "linkedSubmissionAt": r["linked_submission_at"],
        "recordedAt": r["recorded_at"],
        "doctorDisplay": r["doctor_display"],
        "doctorEmail": r["doctor_email"],
    }


@app.get("/api/clinical-records/mine")
def list_my_clinical_records(user: sqlite3.Row = Depends(get_current_user)) -> list[dict]:
    if user["role"] != "patient":
        raise HTTPException(status_code=403, detail="Patients only")
    with get_db() as conn:
        rows = conn.execute(
            """
            SELECT cr.*, s.submitted_at AS linked_submission_at,
                   d.display_name AS doctor_display, d.email AS doctor_email
            FROM clinical_records cr
            JOIN users d ON d.id = cr.doctor_user_id
            LEFT JOIN submissions s ON s.id = cr.linked_submission_id
            WHERE cr.patient_user_id = ?
            ORDER BY cr.recorded_at DESC
            """,
            (user["id"],),
        ).fetchall()
    return [_clinical_record_from_row(r) for r in rows]


@app.get("/api/doctor/patients/{patient_email}/clinical-records")
def doctor_list_clinical_records(
    patient_email: str, user: sqlite3.Row = Depends(get_current_user)
) -> list[dict]:
    if user["role"] != "doctor":
        raise HTTPException(status_code=403, detail="Doctors only")
    email = slug_email(patient_email)
    with get_db() as conn:
        link = _linked_patient_row(conn, user["id"], email)
        if link is None:
            raise HTTPException(status_code=404, detail="Patient not linked")
        rows = conn.execute(
            """
            SELECT cr.*, s.submitted_at AS linked_submission_at,
                   d.display_name AS doctor_display, d.email AS doctor_email
            FROM clinical_records cr
            JOIN users d ON d.id = cr.doctor_user_id
            LEFT JOIN submissions s ON s.id = cr.linked_submission_id
            WHERE cr.patient_user_id = ?
            ORDER BY cr.recorded_at DESC
            """,
            (link["id"],),
        ).fetchall()
    return [_clinical_record_from_row(r) for r in rows]


@app.post("/api/doctor/patients/{patient_email}/clinical-records")
def doctor_create_clinical_record(
    patient_email: str,
    body: ClinicalRecordBody,
    user: sqlite3.Row = Depends(get_current_user),
) -> dict:
    if user["role"] != "doctor":
        raise HTTPException(status_code=403, detail="Doctors only")
    email = slug_email(patient_email)
    rid = str(uuid.uuid4())
    recorded = utcnow().isoformat()
    with get_db() as conn:
        link = _linked_patient_row(conn, user["id"], email)
        if link is None:
            raise HTTPException(status_code=404, detail="Patient not linked")
        pid = link["id"]
        _validate_linked_submission(conn, pid, body.linked_submission_id)
        conn.execute(
            """
            INSERT INTO clinical_records
            (id, patient_user_id, doctor_user_id, diagnosis_name, confirmed, notes,
             linked_submission_id, recorded_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                rid,
                pid,
                user["id"],
                body.diagnosis_name.strip(),
                1 if body.confirmed else 0,
                (body.notes or "").strip(),
                body.linked_submission_id,
                recorded,
            ),
        )
        row = conn.execute(
            """
            SELECT cr.*, s.submitted_at AS linked_submission_at,
                   d.display_name AS doctor_display, d.email AS doctor_email
            FROM clinical_records cr
            JOIN users d ON d.id = cr.doctor_user_id
            LEFT JOIN submissions s ON s.id = cr.linked_submission_id
            WHERE cr.id = ?
            """,
            (rid,),
        ).fetchone()
    _refresh_exports()
    return _clinical_record_from_row(row)


def _chat_from_row(r: sqlite3.Row) -> dict:
    return {
        "id": r["id"],
        "role": r["role"],
        "text": r["text"],
        "createdAt": r["created_at"],
    }


def _submission_from_row(r: sqlite3.Row) -> dict:
    answers = json.loads(r["answers_json"])
    summary_model = json.loads(r["summary_model_json"])
    out = {
        "id": r["id"],
        "submittedAt": r["submitted_at"],
        "answers": answers,
        "summaryModel": summary_model,
        "summary": r["summary_plain"],
    }
    if "deleted_at" in r.keys() and r["deleted_at"]:
        out["deletedAt"] = r["deleted_at"]
    return out


SCRNA_INVENTORY_HTML = BASE_DIR / "research-figures" / "scrna" / "inventory_report.html"


REFERENCE_PORTAL_URL = "/index.html#/doctor/research"


@app.get("/back/reference")
def back_to_reference_library():
    """Reliable return path from standalone inventory HTML into the SPA Reference tab."""
    return RedirectResponse(url=REFERENCE_PORTAL_URL, status_code=302)


@app.get("/back/reference/", include_in_schema=False)
def back_to_reference_library_slash():
    return RedirectResponse(url=REFERENCE_PORTAL_URL, status_code=302)


@app.get("/research-figures/scrna/inventory_report.html")
def serve_scrna_inventory_report():
    """Serve inventory HTML with no-cache so browsers do not keep the old JSON dump."""
    if not SCRNA_INVENTORY_HTML.is_file():
        raise HTTPException(status_code=404, detail="Inventory report not found")
    return FileResponse(
        SCRNA_INVENTORY_HTML,
        media_type="text/html; charset=utf-8",
        headers={
            "Cache-Control": "no-store, max-age=0, must-revalidate",
            "X-Inventory-Report-Version": "4",
        },
    )


app.mount("/", StaticFiles(directory=str(BASE_DIR), html=True), name="static")


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("server:app", host="127.0.0.1", port=8000, reload=False)

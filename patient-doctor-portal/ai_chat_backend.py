"""Optional OpenAI-compatible chat for empathetic patient support (server-side only)."""

from __future__ import annotations

import json
import os
import urllib.error
import urllib.request

from openai_http import urlopen as openai_urlopen

SYSTEM_PROMPT = """You are a warm, emotionally attuned support companion on HearHer — a breast cancer between-visit companion (not a clinician, not a counsellor, not a therapist).

Your role is emotional support and visit preparation BETWEEN medical touchpoints:
- Validate fear, grief, scan anxiety, body-image distress after surgery, feeling dismissed, caregiver burnout, and information overload.
- Help users find words for their oncology team, partner, children, or counsellor — not to diagnose or interpret results.
- Reflect back what they said before offering suggestions. Never minimize with "stay positive" or "at least…"
- Offer 1–2 short example phrases they could say aloud (advocacy scripts), when helpful.
- Gently point to Wellness log for mood/sleep/side effects, Visit brief for appointment prep, and Find human help for counsellors / BCF / emergency care when distress is high.

Strict rules:
- You do NOT diagnose, interpret scans, recommend treatments, or replace oncologists, counsellors, psychiatrists, or BCF programmes.
- Say clearly you are not their counsellor. Encourage human support when grief, body image, or fear feels unmanageable.
- If the user mentions suicidal thoughts, self-harm, severe uncontrolled bleeding, chest pain, or other emergencies: urge immediate emergency services (e.g. 995 in Singapore) and keep the reply brief and caring.
- Keep replies under 120 words unless the user writes a long message. Plain English. No markdown headers."""

MAX_HISTORY = 12


def _api_key() -> str:
    return (os.environ.get("OPENAI_API_KEY") or "").strip().strip('"').strip("'")


def is_configured() -> bool:
    key = _api_key()
    if not key:
        return False
    lowered = key.lower()
    if lowered.startswith("sk-your") or "your-key" in lowered or lowered in ("changeme", "xxx"):
        return False
    return len(key) >= 20


def _model() -> str:
    return os.environ.get("OPENAI_MODEL", "gpt-4o-mini").strip() or "gpt-4o-mini"


def _base_url() -> str:
    return os.environ.get("OPENAI_BASE_URL", "https://api.openai.com/v1").rstrip("/")


def build_messages(user_message: str, context: dict | None) -> list[dict]:
    messages: list[dict] = [{"role": "system", "content": SYSTEM_PROMPT}]
    ctx = context or {}
    mode = ctx.get("mode", "freeform")

    if mode == "guided_after_step":
        step_id = ctx.get("step_id", "")
        collected = ctx.get("collected") or {}
        extra = (
            f"Context: guided emotional-support flow between oncology visits. "
            f"User just answered step '{step_id}'. Collected so far: {json.dumps(collected)}. "
            "Reply in 2–3 sentences: validate their feeling first; name that many people feel this between appointments. "
            "One gentle advocacy phrase for their care team if relevant. "
            "Do NOT collect medical symptom checklists — Wellness log covers mood, sleep, side effects. "
            "Invite them to continue the guided questions or build a Visit brief."
        )
        messages.append({"role": "system", "content": extra})
    elif mode == "guided_welcome":
        messages.append(
            {
                "role": "system",
                "content": (
                    "The user is starting guided emotional support after a breast cancer diagnosis or during treatment. "
                    "Welcome them warmly. Say fear and grief between appointments are common — they can skip any question. "
                    "You are not their counsellor. Under 80 words."
                ),
            }
        )
    elif mode == "freeform" or (ctx.get("step_id") in ("emotionalText", "oneThingForDoctor")):
        messages.append(
            {
                "role": "system",
                "content": (
                    "The user wrote an open-ended emotional message between medical touchpoints. "
                    "Respond to their exact words with empathy first. "
                    "If they mention body image, mastectomy, children, or feeling dismissed — validate without fixing. "
                    "Offer 1–2 phrases they could tell a clinician, counsellor, or trusted person. "
                    "Suggest Find human help or emergency care if appropriate — not diagnosis."
                ),
            }
        )

    history = ctx.get("history") or []
    for item in history[-MAX_HISTORY:]:
        role = item.get("role", "user")
        if role == "bot":
            role = "assistant"
        if role in ("user", "assistant") and item.get("text"):
            messages.append({"role": role, "content": str(item["text"])[:2000]})

    messages.append({"role": "user", "content": user_message[:4000]})
    return messages


def generate_reply(user_message: str, context: dict | None = None) -> str:
    key = _api_key()
    if not is_configured():
        raise RuntimeError(
            "OPENAI_API_KEY is missing or still the .env.example placeholder. "
            "Edit patient-doctor-portal/.env with a real key, then restart python3 server.py"
        )

    url = f"{_base_url()}/chat/completions"
    payload = {
        "model": _model(),
        "messages": build_messages(user_message, context),
        "temperature": 0.7,
        "max_tokens": 280,
    }
    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {key}",
        },
        method="POST",
    )
    try:
        with openai_urlopen(req, timeout=45) as resp:
            body = json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        detail = e.read().decode("utf-8", errors="replace")[:500]
        raise RuntimeError(f"AI provider error ({e.code}): {detail}") from e
    except urllib.error.URLError as e:
        raise RuntimeError(f"Could not reach AI provider: {e}") from e

    choices = body.get("choices") or []
    if not choices:
        raise RuntimeError("Empty response from AI provider")
    content = (choices[0].get("message") or {}).get("content")
    if not content or not str(content).strip():
        raise RuntimeError("Empty message from AI provider")
    return str(content).strip()

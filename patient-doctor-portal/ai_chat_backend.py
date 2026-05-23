"""Optional OpenAI-compatible chat for empathetic patient support (server-side only)."""

from __future__ import annotations

import json
import os
import urllib.error
import urllib.request

from openai_http import urlopen as openai_urlopen

SYSTEM_PROMPT = """You are a warm, supportive health education assistant on HearHer (produced by BioHackzard), a PCOS and gynecology platform for patients and clinicians.

This chat is for emotions, stigma, care delays, and visit prep. The app has a separate **Structured check-in** for logging cycles, pain, skin/hair, bleeding, BMI, etc.

Your goals:
- Validate stress, anxiety, burnout, shame, fear of diagnosis, and feeling dismissed.
- Help users prepare what to say to a clinician (impact on life, feeling unheard)—not re-collect the same symptom checklist as check-in.
- If they list physical symptoms in free text, acknowledge briefly and point them to Structured check-in for a proper log; do not walk through cycle/pain/skin questions again.
- Offer 1–2 short example phrases for advocacy (e.g. "I was told it was stress but symptoms persist").

Strict rules:
- You do NOT diagnose, label someone with PCOS/endometriosis, or prescribe treatment.
- Do not claim certainty. Use phrases like "worth discussing with a clinician".
- If the user mentions severe pain, heavy bleeding, fainting, pregnancy emergency, or suicidal thoughts: urge urgent in-person or emergency care immediately and keep the reply brief.
- Keep replies under 120 words unless the user writes a long message. Use plain English. No markdown headers."""

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
            f"Context: guided emotional-support flow (NOT the structured symptom check-in). "
            f"User just answered step '{step_id}'. Collected fields so far: {json.dumps(collected)}. "
            "Reply in 2–3 sentences: validate feelings or care-journey themes. "
            "One example phrase for a clinician if relevant. "
            "Do NOT ask about cycle regularity, pain level, acne, or fertility—those belong in Structured check-in. "
            "Invite them to continue the guided questions."
        )
        messages.append({"role": "system", "content": extra})
    elif mode == "guided_welcome":
        messages.append(
            {
                "role": "system",
                "content": (
                    "The user is starting the guided chat. Welcome them warmly, "
                    "say it is normal to feel nervous discussing gynecologic symptoms, "
                    "and that they can skip any question. Under 80 words."
                ),
            }
        )
    elif mode == "freeform" or (ctx.get("step_id") in ("emotionalText", "oneThingForDoctor")):
        messages.append(
            {
                "role": "system",
                "content": (
                    "The user wrote an open-ended emotional or personal message. "
                    "Respond directly to their exact words. Validate stress, shame, or fear. "
                    "Give 1–2 example phrases they could tell a clinician."
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

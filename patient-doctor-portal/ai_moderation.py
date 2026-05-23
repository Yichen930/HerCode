"""AI + rule-based moderation for community posts and comments."""

from __future__ import annotations

import json
import re
import urllib.error
import urllib.request

from ai_chat_backend import _api_key, _base_url, _model, is_configured
from openai_http import urlopen as openai_urlopen

GUIDANCE_TYPES = frozenset({"none", "comfort", "see_doctor", "warning", "emergency"})

MODERATION_PROMPT = """You are a safety moderator for a gynecology patient education community (PCOS, endometriosis).

Review the user text BEFORE it is published. Return ONLY valid JSON:
{
  "approved": true|false,
  "reason": "short explanation for clinicians/logs",
  "flags": ["list", "of", "issues"],
  "guidanceType": "none"|"comfort"|"see_doctor"|"warning"|"emergency",
  "patientMessage": "2-4 warm sentences directly to the poster (required if approved=false; helpful if approved=true)"
}

guidanceType meanings:
- emergency: suicidal ideation, severe bleeding, fainting, immediate danger — urge emergency/local urgent care now
- warning: policy violation (diagnosis claims, dosing, contact info, dangerous remedies) — firm but kind
- see_doctor: symptoms or distress that should be discussed with a clinician soon (not an emergency)
- comfort: emotional venting, loneliness, fear — validate feelings; suggest check-in or clinician if appropriate
- none: brief neutral note when approved with no extra guidance needed

patientMessage must be compassionate, in plain English, and must NOT diagnose ("you have PCOS"). For rejected posts, explain why it was not published and what to do instead.

REJECT if the text:
- Claims to diagnose the reader or others
- Gives medical treatment prescriptions or dosages
- Promotes dangerous remedies or discourages urgent care when describing emergencies
- Contains harassment, hate, slurs, or sexual solicitation
- Shares personal contact info or full names of clinicians/patients
- Is spam or unrelated advertising

APPROVE supportive peer stories, emotional sharing, questions, and lived experience IF cautious language and no policy violations.

Be compassionate; do not reject solely because someone is venting about stress or shame."""

BLOCK_PATTERNS = [
    (r"\byou have pcos\b", "Claims a diagnosis for the reader"),
    (r"\b(take|use)\s+\d+\s*mg\b", "Specific medication dosing"),
    (r"\b(cure|guaranteed fix)\b", "Unverified treatment claims"),
    (r"\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b", "Possible phone number"),
    (r"[\w.-]+@[\w.-]+\.\w+", "Email address in post"),
]


def _normalize_mod_result(data: dict, *, approved: bool) -> dict:
    gt = str(data.get("guidanceType") or "none").strip().lower()
    if gt not in GUIDANCE_TYPES:
        gt = "warning" if not approved else "comfort"
    patient_msg = str(data.get("patientMessage") or data.get("reason") or "").strip()[:800]
    if not patient_msg and not approved:
        patient_msg = (
            "We could not publish this post as written. Please rephrase as your own experience "
            "or questions for a clinician, without diagnosis claims or contact details."
        )
    return {
        "approved": approved,
        "reason": str(data.get("reason", "Review complete."))[:500],
        "flags": list(data.get("flags") or [])[:10],
        "guidanceType": gt,
        "patientMessage": patient_msg,
    }


def _rule_moderate(text: str) -> dict:
    lowered = text.lower()
    flags: list[str] = []
    for pattern, label in BLOCK_PATTERNS:
        if re.search(pattern, lowered, re.I):
            flags.append(label)
    emergency = any(
        w in lowered
        for w in ("suicid", "kill myself", "want to die", "severe bleeding", "fainting")
    )
    if emergency:
        return _normalize_mod_result(
            {
                "approved": False,
                "reason": "Possible crisis or emergency symptoms — requires in-person care.",
                "flags": ["Possible emergency — seek in-person care"],
                "guidanceType": "emergency",
                "patientMessage": (
                    "If you are in crisis or have emergency symptoms (such as thoughts of self-harm, "
                    "severe bleeding, or fainting), please contact local emergency services or a clinician "
                    "right away. This community cannot provide urgent or crisis care, but you deserve "
                    "support in person."
                ),
            },
            approved=False,
        )
    if flags:
        return _normalize_mod_result(
            {
                "approved": False,
                "reason": "Content may include diagnosis claims, dosing advice, or personal contact info.",
                "flags": flags,
                "guidanceType": "warning",
                "patientMessage": (
                    "Your message was not published because it may contain content we cannot share here "
                    "(for example telling someone they have a disease, medication doses, or contact details). "
                    "Try sharing how you feel or what you want to ask your doctor, using phrases like "
                    "\"my doctor said\" or \"I wonder if…\"."
                ),
            },
            approved=False,
        )
    return _normalize_mod_result(
        {
            "approved": True,
            "reason": "Approved by community safety rules.",
            "flags": [],
            "guidanceType": "comfort",
            "patientMessage": (
                "Thank you for sharing. Your post is published. Remember this space is peer support, "
                "not medical advice — bring persistent symptoms to a clinician."
            ),
        },
        approved=True,
    )


def moderate_community_text(text: str, content_type: str = "post") -> dict:
    body = (text or "").strip()
    if len(body) < 3:
        return _normalize_mod_result(
            {
                "approved": False,
                "reason": "Message is too short.",
                "flags": ["empty"],
                "guidanceType": "none",
                "patientMessage": "Please write a little more so others can understand and support you.",
            },
            approved=False,
        )
    if len(body) > 2000:
        return _normalize_mod_result(
            {
                "approved": False,
                "reason": "Message exceeds 2000 characters.",
                "flags": ["too_long"],
                "guidanceType": "none",
                "patientMessage": "Your message is too long. Please shorten it to under 2000 characters.",
            },
            approved=False,
        )

    if is_configured():
        try:
            return _ai_moderate(body, content_type)
        except (RuntimeError, urllib.error.URLError, TimeoutError, json.JSONDecodeError):
            pass

    return _rule_moderate(body)


def _ai_moderate(text: str, content_type: str) -> dict:
    url = f"{_base_url()}/chat/completions"
    payload = {
        "model": _model(),
        "messages": [
            {"role": "system", "content": MODERATION_PROMPT},
            {
                "role": "user",
                "content": f"Content type: {content_type}\n\nText to moderate:\n{text}",
            },
        ],
        "temperature": 0.2,
        "max_tokens": 400,
        "response_format": {"type": "json_object"},
    }
    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {_api_key()}",
        },
        method="POST",
    )
    try:
        with openai_urlopen(req, timeout=45) as resp:
            raw = json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        detail = e.read().decode("utf-8", errors="replace")[:300]
        raise RuntimeError(f"Moderation API error: {detail}") from e

    content = (raw.get("choices") or [{}])[0].get("message", {}).get("content", "{}")
    data = json.loads(content)
    approved = bool(data.get("approved"))
    return _normalize_mod_result(data, approved=approved)


def moderation_guidance_json(mod: dict) -> str:
    return json.dumps(
        {
            "guidanceType": mod.get("guidanceType") or "none",
            "patientMessage": mod.get("patientMessage") or "",
        }
    )


def parse_moderation_guidance(row) -> dict:
    try:
        if hasattr(row, "keys") and "moderation_guidance_json" in row.keys():
            raw = row["moderation_guidance_json"] or "{}"
        elif isinstance(row, dict):
            raw = row.get("moderation_guidance_json", "{}")
        else:
            raw = "{}"
        g = json.loads(raw or "{}")
    except (json.JSONDecodeError, TypeError):
        g = {}
    gt = str(g.get("guidanceType") or "none")
    if gt not in GUIDANCE_TYPES:
        gt = "none"
    return {
        "guidanceType": gt,
        "patientMessage": str(g.get("patientMessage") or "")[:800],
    }

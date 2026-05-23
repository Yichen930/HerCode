"""Check-in completeness validation (mirrors js/checkinValidation.js)."""

from __future__ import annotations

SELECT_FIELDS = (
    "cycleRegularity",
    "painLevel",
    "painTiming",
    "skinHair",
    "bowelBladder",
    "weightChange",
    "heavyBleeding",
    "bmiCategory",
    "fertilityConcern",
)

MIN_NOTES_CHARS = 20
MIN_MEANINGFUL_FIELDS = 2


def _trim(v: object) -> str:
    return (v if v is not None else "").strip() if isinstance(v, str) else str(v or "").strip()


def _meaningful_age(raw: str) -> bool:
    if not raw:
        return False
    try:
        n = int(raw)
    except ValueError:
        return False
    return 8 <= n <= 80


def _meaningful_select(raw: str) -> bool:
    return len(raw) > 0


def _meaningful_notes(raw: str) -> bool:
    return len(raw) >= MIN_NOTES_CHARS


def count_meaningful_fields(answers: dict) -> int:
    n = 0
    if _meaningful_age(_trim(answers.get("age"))):
        n += 1
    for key in SELECT_FIELDS:
        if _meaningful_select(_trim(answers.get(key))):
            n += 1
    if _meaningful_notes(_trim(answers.get("notes"))):
        n += 1
    return n


def validate_checkin_answers(answers: dict) -> tuple[bool, dict | None, str]:
    normalized = {k: _trim(v) for k, v in (answers or {}).items()}
    meaningful = count_meaningful_fields(normalized)
    has_notes = _meaningful_notes(normalized.get("notes", ""))
    select_count = sum(1 for k in SELECT_FIELDS if _meaningful_select(normalized.get(k, "")))
    has_age = _meaningful_age(normalized.get("age", ""))

    if has_notes or meaningful >= MIN_MEANINGFUL_FIELDS:
        stored: dict[str, str] = {}
        if has_age:
            stored["age"] = normalized["age"]
        for key in SELECT_FIELDS:
            val = normalized.get(key, "")
            if _meaningful_select(val):
                stored[key] = val
        if has_notes:
            stored["notes"] = normalized["notes"]
        return True, stored, ""

    message = (
        "This check-in was not saved. Please answer at least 2 questions "
        "(choose an option other than “Prefer not to say”), or add a short note "
        "(at least 20 characters) for your clinician."
    )
    if has_age and select_count == 0 and not has_notes:
        message = (
            "Age alone is not enough to save a check-in. "
            "Please answer at least one symptom question or add a short note."
        )
    return False, None, message

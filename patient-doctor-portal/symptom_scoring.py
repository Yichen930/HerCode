"""Educational symptom pattern scoring (mirrors js/symptomScoring.js)."""

PCOS_COHORT_N = 541
PCOS_LABELED_RATE = 0.327
PCOS_CV_ROC_AUC = 0.942
PCOS_VS_ENDO_AUC = 0.726
PCOS_MEAN_AGE = 30.1
ENDO_MEAN_AGE = 33.6


def _s(answers: dict, key: str) -> str:
    return (answers.get(key) or "").strip()


def count_pcos_pattern_features(answers: dict) -> int:
    n = 0
    if _s(answers, "cycleRegularity") == "irregular":
        n += 1
    if _s(answers, "skinHair") == "yes":
        n += 1
    if _s(answers, "weightChange") == "yes":
        n += 1
    if _s(answers, "heavyBleeding") == "yes":
        n += 1
    if _s(answers, "bmiCategory") in ("overweight", "obese"):
        n += 1
    return n


def count_endo_pattern_features(answers: dict) -> int:
    n = 0
    if _s(answers, "painTiming") == "cyclical":
        n += 1
    if _s(answers, "bowelBladder") == "yes":
        n += 1
    if _s(answers, "painLevel") in ("moderate", "severe"):
        n += 1
    if _s(answers, "fertilityConcern") == "yes":
        n += 1
    return n


def educational_pcos_reference_percent(answers: dict) -> int:
    features = count_pcos_pattern_features(answers)
    overlap_ratio = features / 5
    adjusted = min(0.85, PCOS_LABELED_RATE + overlap_ratio * 0.45)
    return round(adjusted * 100)


def educational_endo_reference_percent(answers: dict) -> int:
    features = count_endo_pattern_features(answers)
    overlap_ratio = features / 4
    base = 4079 / (4079 + 177)
    adjusted = min(0.75, base * 0.15 + overlap_ratio * 0.35)
    return round(adjusted * 100)


def detect_persistent_pcos_pattern(answers: dict, prior_submissions: list[dict]) -> dict:
    current = count_pcos_pattern_features(answers)
    if current < 2:
        return {"persistent": False, "checkInCount": 0, "currentFeatures": current}
    similar = [
        s
        for s in prior_submissions
        if count_pcos_pattern_features(s.get("answers") or {}) >= 2
    ]
    return {
        "persistent": len(similar) >= 1,
        "checkInCount": len(similar) + 1,
        "currentFeatures": current,
    }


def build_scoring_blocks(answers: dict, prior_submissions: list[dict] | None = None) -> list[dict]:
    prior_submissions = prior_submissions or []
    blocks: list[dict] = []

    pcos_feat = count_pcos_pattern_features(answers)
    endo_feat = count_endo_pattern_features(answers)
    pcos_ref = educational_pcos_reference_percent(answers)
    endo_ref = educational_endo_reference_percent(answers)
    persistence = detect_persistent_pcos_pattern(answers, prior_submissions)

    if pcos_feat >= 1 or endo_feat >= 1:
        blocks.append(
            {
                "variant": "note",
                "title": "Symptom pattern (educational reference)",
                "text": (
                    f"Your answers overlap {pcos_feat} of 5 features often discussed in PCOS education "
                    f"and {endo_feat} of 4 features often discussed for endometriosis. "
                    "These patterns are not specific to one disease."
                ),
            }
        )
        blocks.append(
            {
                "variant": "note",
                "title": "Cohort reference scores (not your diagnosis)",
                "text": (
                    f"PCOS-labeled pattern reference ≈ {pcos_ref}% relative to cohort base "
                    f"(~{round(PCOS_LABELED_RATE * 100)}% in n={PCOS_COHORT_N}). "
                    f"Endometriosis-pattern reference ≈ {endo_ref}% for symptom overlap only. "
                    f"Research models: PCOS ROC-AUC ~{round(PCOS_CV_ROC_AUC * 100)}%, "
                    f"PCOS vs endo ~{round(PCOS_VS_ENDO_AUC * 100)}% on overlapping fields."
                ),
            }
        )

    if pcos_feat >= 2 and endo_feat >= 2:
        blocks.append(
            {
                "variant": "important",
                "title": "Overlapping conditions",
                "text": (
                    "PCOS and endometriosis frequently co-occur or mimic each other. "
                    "Clinicians often need history, exam, ultrasound, and selective labs."
                ),
            }
        )
    elif pcos_feat >= 2 and endo_feat <= 1:
        blocks.append(
            {
                "variant": "note",
                "title": "Conditions to discuss with your clinician",
                "text": (
                    "Your pattern aligns more with PCOS screening topics (ovulation, androgens, metabolic risk). "
                    "Thyroid and other causes of irregular cycles should still be considered."
                ),
            }
        )
    elif endo_feat >= 2 and pcos_feat <= 1:
        blocks.append(
            {
                "variant": "note",
                "title": "Conditions to discuss with your clinician",
                "text": (
                    "Your pattern aligns more with endometriosis evaluation features. "
                    "PCOS and adenomyosis can still overlap—share a symptom timeline."
                ),
            }
        )

    if persistence["persistent"] or (pcos_feat >= 3 and len(prior_submissions) == 0):
        if persistence["persistent"]:
            text = (
                f"You have reported a similar PCOS-related symptom pattern in "
                f"{persistence['checkInCount']} check-in(s). Many people wait years for PCOS evaluation. "
                "Consider booking a visit and asking about cycle tracking, androgens, glucose/insulin, and ultrasound."
            )
        else:
            text = (
                "You reported several features associated with PCOS in community data. "
                "If symptoms persist across many cycles, early evaluation can reduce long-term complications."
            )
        blocks.append(
            {
                "variant": "important",
                "title": "Timely check-up (delayed diagnosis awareness)",
                "text": text,
            }
        )

    age_raw = _s(answers, "age")
    if age_raw.isdigit():
        age = int(age_raw)
        if 18 <= age <= 45 and pcos_feat >= 2:
            blocks.append(
                {
                    "variant": "note",
                    "title": "Age context",
                    "text": (
                        f"In comparison data, PCOS-labeled mean age ~{PCOS_MEAN_AGE} vs "
                        f"endometriosis ~{ENDO_MEAN_AGE}; your age ({age}) is within typical reproductive-range discussions."
                    ),
                }
            )

    return blocks

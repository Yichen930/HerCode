"""Server-side patient summary (mirrors js/summary.js)."""

from symptom_scoring import build_scoring_blocks


def build_patient_summary(answers: dict, prior_submissions: list[dict] | None = None) -> dict:
    prior_submissions = prior_submissions or []
    blocks: list[dict] = []

    blocks.append(
        {
            "variant": "disclaimer",
            "title": "Read this first",
            "text": (
                "This summary is for general education only. It is not a medical diagnosis "
                "and does not replace a clinician’s assessment, examination, or tests."
            ),
        }
    )

    cycle = (answers.get("cycleRegularity") or "").strip()
    if cycle == "irregular":
        blocks.append(
            {
                "variant": "important",
                "title": "Menstrual pattern",
                "text": (
                    "You reported irregular cycles. Irregular bleeding can reflect anovulation "
                    "(often discussed in PCOS), thyroid disease, stress, or other causes. "
                    "If persistent, ask about ovulation, androgens, TSH, and pelvic ultrasound."
                ),
            }
        )
    elif cycle == "regular":
        blocks.append(
            {
                "variant": "note",
                "title": "Menstrual pattern",
                "text": (
                    "You reported relatively regular cycles. Regular cycles do not rule out "
                    "endometriosis, adenomyosis, or mild androgen excess."
                ),
            }
        )

    pain = (answers.get("painLevel") or "").strip()
    pain_timing = (answers.get("painTiming") or "").strip()
    if pain == "severe" or pain_timing == "progressive":
        blocks.append(
            {
                "variant": "important",
                "title": "Pelvic pain",
                "text": (
                    "You indicated severe or progressive pelvic pain. Strong or worsening pain "
                    "should be evaluated promptly in person."
                ),
            }
        )
    elif pain in ("mild", "moderate"):
        cyclical = pain_timing == "cyclical"
        blocks.append(
            {
                "variant": "note",
                "title": "Pelvic pain",
                "text": (
                    "You reported cyclical pelvic pain around menses—often discussed in endometriosis education."
                    if cyclical
                    else "You reported pelvic pain. Track timing with menses and bowel/bladder symptoms."
                ),
            }
        )

    if (answers.get("skinHair") or "").strip() == "yes":
        blocks.append(
            {
                "variant": "important",
                "title": "Skin / hair (androgen-related signs)",
                "text": (
                    "You noted skin or hair changes. In PCOS phenotypes, androgen excess is a core topic; "
                    "labs help distinguish PCOS from other causes."
                ),
            }
        )

    if (answers.get("weightChange") or "").strip() == "yes":
        blocks.append(
            {
                "variant": "note",
                "title": "Weight change",
                "text": (
                    "You reported weight gain or difficulty losing weight. Insulin resistance is "
                    "commonly discussed in PCOS metabolic screening."
                ),
            }
        )

    if (answers.get("heavyBleeding") or "").strip() == "yes":
        blocks.append(
            {
                "variant": "important",
                "title": "Heavy bleeding",
                "text": (
                    "You reported heavy menstrual bleeding. Seek urgent care if soaking pads hourly, "
                    "fainting, or bleeding with severe dizziness."
                ),
            }
        )

    if (answers.get("bowelBladder") or "").strip() == "yes":
        blocks.append(
            {
                "variant": "important",
                "title": "Bowel / bladder",
                "text": (
                    "You reported cyclical bowel or bladder symptoms—often highlighted in "
                    "endometriosis education."
                ),
            }
        )

    if (answers.get("fertilityConcern") or "").strip() == "yes":
        blocks.append(
            {
                "variant": "note",
                "title": "Fertility",
                "text": (
                    "You indicated fertility concerns. PCOS-related anovulation and endometriosis "
                    "are different mechanisms—early specialist referral can help."
                ),
            }
        )

    blocks.extend(build_scoring_blocks(answers, prior_submissions))

    blocks.append(
        {
            "variant": "footer",
            "title": "Bottom line",
            "text": (
                "Overlapping symptoms are common. Clinical criteria and imaging are required for diagnosis; "
                "this tool helps you prepare questions only."
            ),
        }
    )

    plain = "\n\n".join(b["text"] for b in blocks)
    return {"blocks": blocks, "plainText": plain}

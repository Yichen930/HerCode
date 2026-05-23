<h1 align="left" style="margin: 0 0 0.25em 0; padding: 0;">
<table>
<tr>
<td style="vertical-align: bottom; border: none; padding: 0 14px 0 0; font-size: inherit; font-weight: inherit;">HearHer</td>
<td style="vertical-align: bottom; border: none; padding: 0;"><img src="patient-doctor-portal/logo/HearHer-logo.png" alt="" width="72" /></td>
</tr>
</table>
</h1>

<p align="left"><em>Support between medical touchpoints.</em> · BCF Challenge demo — emotional support companion for breast cancer patients and caregivers (local web app).</p>

**HearHer** helps women diagnosed with breast cancer and their caregivers process difficult emotions, prepare questions for doctors, and access brief calming exercises **between oncology appointments**. It is **non-medical**, privacy-conscious, and designed to **complement** oncologists, counsellors, and [BCF support services](https://bcf.org.sg/guidance/caregiving) — not replace them.

## What it offers

**For patients**

- **Support** — AI-assisted or built-in emotional companion between touchpoints
- **Reflect** — qualitative reflection on mood, sleep, information overload
- **Visit brief & questions** — prepare conversations with your care team
- **Wellness log** — mood, sleep, side effects (not diagnosis)
- **Calm & learn** — breathing exercises, visit prep, caregiver tips
- **Community** — moderated breast cancer peer support
- **Caregiver sharing** — optional plain-language summaries for linked caregivers

**For caregivers**

- Read shared between-visit summaries (with patient consent)
- Link to [BCF caregiving guidance](https://bcf.org.sg/guidance/caregiving)

**For clinicians**

- Review linked wellness logs and optional support chat (with consent)
- No research/cohort reference tab in this BCF-focused demo

## Run the app

```bash
cd patient-doctor-portal
python3 -m pip install -r requirements-api.txt
python3 server.py
```

Open **http://127.0.0.1:8000** — hard refresh (`Cmd+Shift+R`) if you see old content.

### Optional AI chat

```bash
cd patient-doctor-portal
cp .env.example .env
python3 server.py
```

Add `OPENAI_API_KEY` to `.env`. Without it, support chat uses built-in fallback replies.

## Demo flow

1. Register **Patient** → Home prompt cards → Support / Reflect / Visit brief
2. Enable caregiver sharing under **Privacy**
3. Register **Caregiver** → link patient email → read shared summary
4. Register **Clinician** → link patient → review wellness logs

**Not medical advice.** Not a medical device. For emergencies, contact your oncology team or emergency services.

Produced by **BioHackzard** · BCF Challenge 2 — Emotional Support Between Medical Touchpoints

<h1 align="left" style="margin: 0 0 0.25em 0; padding: 0;">
<table>
<tr>
<td style="vertical-align: bottom; border: none; padding: 0 14px 0 0; font-size: inherit; font-weight: inherit;">Lune</td>
<td style="vertical-align: bottom; border: none; padding: 0;"><img src="patient-doctor-portal/logo/Lune-logo-mark.svg" alt="" width="56" /></td>
</tr>
</table>
</h1>

<p align="left"><em>A quiet light for difficult nights.</em> · BCF Challenge demo — a web app with three integrated portals for breast cancer patients, caregivers, and clinicians between oncology appointments.</p>

**Lune** helps people navigate the emotional gaps between medical touchpoints: reflect, prepare for visits, find peer support, and share only what they choose. It is **non-medical**, privacy-conscious, and designed to **complement** oncologists, counsellors, and [BCF support services](https://bcf.org.sg/guidance/caregiving) — not replace them.

## What it offers

**Patient portal**

- **Support** — guided emotional flow + open chat (optional AI; built-in fallback replies)
- **Visit brief & questions** — prepare what to say at your next appointment
- **Wellness log** — mood, sleep, side effects (not diagnosis)
- **Community (Witnesses)** — moderated peer support with Lune night-sky UI
- **Emergency contacts** — call/text linked clinician and caregivers
- **Find human help** — counsellors, BCF, screening prep
- **Privacy** — consent for caregiver and clinician sharing

**Caregiver portal**

- Plain-language between-visit summaries (with patient consent)
- Caregiver community + emergency contacts
- Link a patient by email

**Clinician portal**

- Review linked patients’ wellness logs and optional shared summaries
- Community moderation safety log

## Run the app

```bash
cd patient-doctor-portal
python3 -m pip install -r requirements-api.txt
python3 scripts/seed_demo.py   # optional — full demo data (stop server first)
python3 server.py
```

Open **http://127.0.0.1:8000** — hard refresh (`Cmd+Shift+R`) if you see old content.

Port busy: `kill $(lsof -t -i:8000) 2>/dev/null; python3 server.py`

### Optional AI chat

```bash
cd patient-doctor-portal
cp .env.example .env
# Add OPENAI_API_KEY to .env, then restart server
python3 server.py
```

`/api/health` shows `"ai_chat": true` when configured; otherwise support chat uses built-in empathetic replies.

## Demo accounts

After `seed_demo.py`, sign in at **http://127.0.0.1:8000** (password **`2026`** for all):

| Role | Email | Notes |
|------|-------|--------|
| Patient | `patient@gmail.com` | Mei Lin — main demo |
| Caregiver | `partner@gmail.com` | James — linked to Mei |
| Clinician | `doctor@gmail.com` | Dr. Tan — linked to Mei |

Clear browser site data for `localhost` if you previously used offline mode.

## Demo flow (2 min)

1. **Patient** → Home → Support (Open chat) or Community (Witnesses)
2. **Caregiver** → shared summary + caregiver community
3. **Clinician** → Mei’s wellness log + between-visit panel

**Not medical advice.** Not a medical device. For emergencies, call **995** or your oncology team.

Produced by **Lune** · BCF Challenge 2 — Emotional Support Between Medical Touchpoints

# Lune — Patient, Caregiver & Clinician Portal

SPA for breast cancer **between-visit emotional support**, **wellness logging**, **peer community**, and **clinician review** (BCF-focused demo).

Main overview and demo walkthrough: [../README.md](../README.md)  
Routes & architecture: [WEBSITE_LOGIC.md](WEBSITE_LOGIC.md)

## Run

```bash
cd patient-doctor-portal
python3 -m pip install -r requirements-api.txt
python3 scripts/seed_demo.py   # stop server first
python3 server.py
```

→ **http://127.0.0.1:8000**

| Mode | Command | Storage |
|------|---------|---------|
| **Server** (recommended) | `python3 server.py` | SQLite + `data/exports/*.csv` |
| Static only | `python3 -m http.server 5173` | `localStorage` only |

Port busy: `kill $(lsof -t -i:8000) 2>/dev/null; python3 server.py`

## Optional AI chat

```bash
cp .env.example .env   # set OPENAI_API_KEY=sk-...
python3 server.py
```

`/api/health` shows `"ai_chat": true` when configured.

## Demo accounts

```bash
python3 scripts/seed_demo.py
python3 server.py
```

Password **`2026`** for all seeded accounts — see [../README.md](../README.md#demo-accounts).

## Features (short)

**Patient:** Home · Support (guided + open chat) · Visit brief · Wellness log · Calm & learn · Community (Lune) · Emergency contacts · Privacy

**Caregiver:** Linked patient summaries · Community · Emergency contacts · Link patient

**Clinician:** Patient dashboard · Wellness check-ins · Shared between-visit summary · Community moderation

## API sketch

`GET /api/health` · auth · submissions · chat (+ optional `POST /api/chat/ai-reply`) · consent · clinical records · community · caregiver links · direct messages

Full list in [WEBSITE_LOGIC.md](WEBSITE_LOGIC.md) or `server.py`.

## Layout

```
patient-doctor-portal/
├── server.py, ai_chat_backend.py, requirements-api.txt
├── index.html, css/, js/, logo/
├── js/lune/                       # Lune community UI shell
└── data/                          # sqlite + exports (gitignored)
```

## Disclaimer

Educational demo — not a medical device, diagnosis tool, or HIPAA-certified EHR.

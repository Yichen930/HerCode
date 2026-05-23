# Website logic

**HearHer** (produced by BioHackzard) separates **patient education and self-management** from **clinician review**. It does **not** diagnose; it helps users organize symptoms and prepare for clinical visits.

## Architecture

| Layer | Role |
|-------|------|
| `index.html` + `js/app.js` | Hash-router SPA — no React/npm |
| `js/summary.js` + `js/symptomScoring.js` | Educational copy from check-in answers |
| `js/symptomChat.js` | Guided support Q&A (emotional / care journey) |
| `js/patientChatPage.js` | Support UI: guided + talk freely |
| `js/aiChat.js` + `ai_chat_backend.py` | Optional OpenAI (server-side); `empatheticFallback.js` offline |
| `js/researchData.js` | Embedded cohort statistics (reference only) |
| `server.py` | FastAPI + SQLite: auth, submissions, chat, community, clinical records |

On load, `sessionManager.js` probes `/api/health`. API available → **server mode**; otherwise → **localStorage**.

## Patient routes

| Route | Function |
|-------|----------|
| `#/patient` | Home: quick actions + recent check-ins (links to history) |
| `#/patient/chat` | **Support** — feelings & visit prep; not a symptom form |
| `#/patient/checkin` | Symptom questionnaire → educational summary |
| `#/patient/checkins` | Full check-in history (optional `?id=` focuses one entry) |
| `#/patient/learn` | Flashcards |
| `#/patient/community` | Peer feed (AI-reviewed before publish) |
| `#/patient/settings` | Privacy: share support chat with linked clinicians |

Navigation highlights the active section. **Check-in** nav is active on both check-in form and history pages.

## Clinician routes

| Route | Function |
|-------|----------|
| `#/doctor` | Dashboard: per-patient check-ins, optional chat, diagnosis log form |
| `#/doctor/link` | Link patient by email |
| `#/doctor/moderation` | Flagged community queue |
| `#/doctor/research` | Analysis library: cohort tables, model metrics, backup figures, scRNA inventory (`js/researchPage.js`) — not per-patient |

## How check-in summaries are built

```
Answers → symptomScoring.js (pattern counts, cohort reference %)
       → summary.js (disclaimer + symptom notes + scoring blocks)
       → UI summary stack
```

Reference percentages use population base rates from research cohorts plus symptom overlap — **not** individual diagnosis probabilities.

## Data & consent

| Data | Patient | Linked clinician |
|------|---------|------------------|
| Check-in submissions | Stored | Always visible when linked |
| Support chat | Stored | Only if patient enables sharing |
| Clinical diagnosis log | Stored | Visible on clinician dashboard + patient home |
| Community posts | Stored (if approved) | Public feed; moderation queue for clinicians |

## What the product is not

- Not a substitute for clinical judgment, exam, imaging, or labs  
- Not live ML inference on every keystroke (cohort stats are pre-embedded; check-in uses rules)  
- Not a certified EHR or HIPAA-ready deployment without additional engineering  

Emergency symptoms → in-person or urgent care.

# HearHer mobile app

The portal is a **web app** that can run as:

1. **Mobile-friendly browser** — responsive layout + bottom tab bar (≤768px)
2. **PWA (install on home screen)** — `manifest.webmanifest` + service worker
3. **Native app (App Store / Play Store)** — [Capacitor](https://capacitorjs.com/) wraps the same HTML/JS

Accounts and AI still require the **Python server** (`server.py`) running on a reachable HTTPS URL.

## Quick test — PWA on phone (same Wi‑Fi)

1. Start the server on your LAN (demo only):

   ```bash
   cd patient-doctor-portal
   python3 -m uvicorn server:app --host 0.0.0.0 --port 8000
   ```

2. On your phone browser, open `http://<your-laptop-ip>:8000`
3. **iOS Safari:** Share → **Add to Home Screen**
4. **Android Chrome:** menu → **Install app** / **Add to Home screen**

## Native app with Capacitor

### One-time setup

```bash
cd patient-doctor-portal
npm install
npx cap add ios      # Mac + Xcode
npx cap add android  # Android Studio
```

### Point the app at your API

Before building, set the API base in `index.html`:

```html
<meta name="hearher-api-base" content="https://your-deployed-server.com" />
```

Deploy `server.py` to a host with HTTPS (Railway, Render, Fly.io, etc.).

### Sync and run

```bash
npx cap sync
npx cap open ios
# or
npx cap open android
```

## What works offline

- App shell (HTML/CSS/JS) loads from cache via `sw.js`
- **Login, check-ins, chat, caregiver sharing** need network + API

## Production checklist

- Deploy `server.py` with HTTPS
- Set `hearher-api-base` for Capacitor builds
- Replace demo app id in `capacitor.config.json`
- Privacy policy URL for store submission

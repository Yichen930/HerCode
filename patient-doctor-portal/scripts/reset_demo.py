#!/usr/bin/env python3
"""
Wipe server demo data for a fresh start.

Removes SQLite (all users, check-ins, links, chat, community) and regenerated
CSV exports. Does NOT touch .env or source code.

Usage (stop server.py first):
  cd patient-doctor-portal
  python3 scripts/reset_demo.py

Then restart server and register accounts again in the browser.
Also clear site data in the browser (localStorage / session) — see README.
"""

from __future__ import annotations

import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DB = ROOT / "data" / "portal.sqlite3"
EXPORTS = ROOT / "data" / "exports"
KEEP_IN_EXPORTS = {"README.txt"}


def main() -> int:
    removed = []

    if DB.is_file():
        DB.unlink()
        removed.append(str(DB.relative_to(ROOT)))

    if EXPORTS.is_dir():
        for p in list(EXPORTS.iterdir()):
            if p.name in KEEP_IN_EXPORTS:
                continue
            if p.is_file():
                p.unlink()
                removed.append(str(p.relative_to(ROOT)))
            elif p.is_dir():
                shutil.rmtree(p)
                removed.append(str(p.relative_to(ROOT)) + "/")

    if not removed:
        print("Nothing to remove — already empty.")
    else:
        print("Removed:")
        for line in removed:
            print(f"  {line}")

    print("\nNext steps:")
    print("  1. In the browser: clear site data for this host (or DevTools → Application → Clear storage).")
    print("  2. python3 server.py")
    print("  3. Open http://127.0.0.1:8000 — use Create account / Register for new demo users.")
    return 0


if __name__ == "__main__":
    sys.exit(main())

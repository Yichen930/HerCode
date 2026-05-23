"""HTTPS helpers for OpenAI API calls (macOS-friendly CA bundle)."""

from __future__ import annotations

import ssl
import urllib.request


def ssl_context() -> ssl.SSLContext:
    try:
        import certifi

        return ssl.create_default_context(cafile=certifi.where())
    except ImportError:
        return ssl.create_default_context()


def urlopen(req: urllib.request.Request, timeout: float = 45):
    return urllib.request.urlopen(req, timeout=timeout, context=ssl_context())

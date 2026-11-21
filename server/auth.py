"""GitHub token storage.

The token is read once at import time from, in order:
  1. GITHUB_TOKEN / GH_TOKEN environment variables (source="env")
  2. data/.github-token.json written via the in-page dialog (source="file")

The token never leaves the server: API responses only expose login, source and
rate-limit numbers. The token file is excluded from version control.
"""

from __future__ import annotations

import json
import os
import threading
from typing import Any

from .config import TOKEN_PATH

TOKEN_LOCK = threading.Lock()


def _read_stored_auth() -> dict[str, Any]:
    env_token = (os.environ.get("GITHUB_TOKEN") or os.environ.get("GH_TOKEN") or "").strip()
    if env_token:
        return {"token": env_token, "login": "", "source": "env"}
    try:
        with TOKEN_PATH.open("r", encoding="utf-8") as handle:
            payload = json.load(handle)
    except (OSError, ValueError):
        return {"token": "", "login": "", "source": "anonymous"}
    token = str(payload.get("token") or "").strip()
    if not token:
        return {"token": "", "login": "", "source": "anonymous"}
    return {
        "token": token,
        "login": str(payload.get("login") or ""),
        "source": str(payload.get("source") or "file"),
    }


GITHUB_AUTH: dict[str, Any] = _read_stored_auth()


def reload_auth() -> dict[str, Any]:
    """Re-read the token store (used by tests and by long-running servers)."""
    with TOKEN_LOCK:
        GITHUB_AUTH.clear()
        GITHUB_AUTH.update(_read_stored_auth())
        return dict(GITHUB_AUTH)


def current_token() -> str:
    with TOKEN_LOCK:
        return str(GITHUB_AUTH.get("token") or "")


def auth_summary() -> dict[str, Any]:
    with TOKEN_LOCK:
        token = str(GITHUB_AUTH.get("token") or "")
        login = str(GITHUB_AUTH.get("login") or "")
        source = str(GITHUB_AUTH.get("source") or "anonymous")
    return {
        "connected": bool(token),
        "login": login,
        "source": source if token else "anonymous",
    }


def save_github_auth(token: str, login: str, source: str = "file") -> None:
    with TOKEN_LOCK:
        GITHUB_AUTH.update({"token": token, "login": login, "source": source})
    if source == "env":
        return
    TOKEN_PATH.parent.mkdir(parents=True, exist_ok=True)
    tmp_path = TOKEN_PATH.with_suffix(".tmp")
    tmp_path.write_text(
        json.dumps({"token": token, "login": login, "source": "file"}, ensure_ascii=False),
        encoding="utf-8",
    )
    tmp_path.replace(TOKEN_PATH)
    try:
        TOKEN_PATH.chmod(0o600)
    except OSError:
        pass


def clear_github_auth() -> None:
    with TOKEN_LOCK:
        GITHUB_AUTH.update({"token": "", "login": "", "source": "anonymous"})
    try:
        TOKEN_PATH.unlink()
    except FileNotFoundError:
        pass

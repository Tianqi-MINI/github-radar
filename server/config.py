"""Paths and tunables for the radar server.

Every path is derived from this file's location, so the project can be copied
to another machine or another folder without editing code. Runtime overrides
come from environment variables where it is genuinely useful (data dir, port).
"""

from __future__ import annotations

import os
import re
from pathlib import Path


def _env_int(name: str, default: int) -> int:
    """Read a positive integer env var, falling back on malformed input."""
    try:
        value = int(os.environ.get(name, ""))
    except ValueError:
        return default
    return value if value > 0 else default


def _env_flag(name: str, default: bool) -> bool:
    raw = os.environ.get(name)
    if raw is None:
        return default
    return raw.strip().lower() not in {"0", "false", "no", "off"}

# Project layout: <root>/server/config.py -> <root>
PROJECT_DIR = Path(__file__).resolve().parent.parent
APP_DIR = PROJECT_DIR / "app"
DATA_DIR = Path(os.environ.get("RADAR_DATA_DIR") or (PROJECT_DIR / "data")).resolve()

# Stable data file names (no version suffixes in the release tree).
FEED_PATH = DATA_DIR / "feed.json"
GUIDE_PATH = DATA_DIR / "repo-guides.json"
RESEARCH_KIT_PATH = DATA_DIR / "research-kits.json"
REPO_SNAPSHOT_PATH = DATA_DIR / "repo-snapshots.json"
SMALL_RESOURCES_PATH = DATA_DIR / "small-resources.json"

# Optional GitHub token file. Never committed; see .gitignore.
TOKEN_PATH = DATA_DIR / ".github-token.json"

GITHUB_API = "https://api.github.com"
GITHUB_USER_AGENT = "student-github-interest-radar/1.0"
GITHUB_API_VERSION = "2022-11-28"

LOOPBACK_HOSTS = {"127.0.0.1", "::1", "::ffff:127.0.0.1"}
REPO_PATTERN = re.compile(r"^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$")
TOKEN_PATTERN = re.compile(r"^[A-Za-z0-9_\-]{20,255}$")

# Match README links that point at a Chinese translation maintained by the repo.
ZH_README_PATTERN = re.compile(
    r"(?i)(?:\(|href=[\"'])([^)\"'\s]*readme[._-]?(?:zh|zh-cn|zh_cn|cn|chinese)[^)\"'\s]*)(?:\)|[\"'])"
)

# Static files the HTTP server is allowed to serve. Anything else is 404,
# which keeps source files and data out of the public surface.
STATIC_SUFFIXES = {".html", ".css", ".js", ".svg", ".png", ".jpg", ".jpeg", ".webp", ".ico", ".json", ".woff2"}

ENTRY_FILE = "index.html"
DEFAULT_HOST = os.environ.get("RADAR_HOST", "127.0.0.1")
# Render / Cloud Run inject PORT; the local default stays 4173.
DEFAULT_PORT = _env_int("PORT", _env_int("RADAR_PORT", 4173))

# Hosted deployments should set RADAR_ALLOW_LOCAL_TOKEN_WRITE=0 so the
# in-page token dialog can never be used from behind a platform proxy.
ALLOW_LOCAL_TOKEN_WRITE = _env_flag("RADAR_ALLOW_LOCAL_TOKEN_WRITE", True)

# Only trust X-Forwarded-For when the app is behind a known reverse proxy.
# Trusting it directly would let clients spoof their IP for rate limiting.
TRUST_PROXY = _env_flag("RADAR_TRUST_PROXY", False)

# Public live endpoints are limited per client IP.
LIVE_RATE_LIMIT = _env_int("RADAR_LIVE_RATE_LIMIT", 30)
LIVE_RATE_WINDOW_SECONDS = _env_int("RADAR_LIVE_RATE_WINDOW", 60)

# Live search results are cached in-process to protect the GitHub quota.
LIVE_CACHE_TTL_SECONDS = _env_int("RADAR_LIVE_CACHE_TTL", 90)

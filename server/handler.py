"""HTTP routing and static-file serving.

Only two things leave this process:
  * files under app/ with an allow-listed extension
  * JSON from the /api/* routes

Everything else returns 404. Server source, data files and the token store are
outside app/ and are never exposed by the static handler.
"""

from __future__ import annotations

import json
import mimetypes
import urllib.parse
from datetime import datetime, timezone
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler
from pathlib import Path
from typing import Any

from .auth import auth_summary, clear_github_auth, current_token, save_github_auth
from .config import (
    ALLOW_LOCAL_TOKEN_WRITE,
    APP_DIR,
    ENTRY_FILE,
    FEED_PATH,
    GUIDE_PATH,
    LIVE_RATE_LIMIT,
    LIVE_RATE_WINDOW_SECONDS,
    LIVE_CACHE_TTL_SECONDS,
    LOOPBACK_HOSTS,
    REPO_SNAPSHOT_PATH,
    RESEARCH_KIT_PATH,
    SMALL_RESOURCES_PATH,
    STATIC_SUFFIXES,
    TOKEN_PATTERN,
    TRUST_PROXY,
)
from .errors import GitHubRequestError
from .feed import get_live_feed, normalize_focuses
from .github_api import fetch_github_rate_limit, verify_github_token
from .ratelimit import SlidingWindowLimiter
from .readme import fetch_live_repo

TEXT_TYPES = {"text/html", "text/css", "text/javascript", "application/javascript", "application/json"}
LIVE_LIMITER = SlidingWindowLimiter(LIVE_RATE_LIMIT, LIVE_RATE_WINDOW_SECONDS)


def _read_json(path: Path) -> dict[str, Any]:
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


class RadarHandler(BaseHTTPRequestHandler):
    server_version = "RadarHTTP/1.0"

    # ------------------------------------------------------------------ send

    def send_json(
        self,
        payload: dict[str, Any],
        status: int = HTTPStatus.OK,
        extra_headers: dict[str, str] | None = None,
    ) -> None:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store, max-age=0")
        for name, value in (extra_headers or {}).items():
            self.send_header(name, value)
        self._send_common_headers()
        self.end_headers()
        try:
            self.wfile.write(body)
        except (BrokenPipeError, ConnectionAbortedError):
            pass

    def _send_common_headers(self) -> None:
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Referrer-Policy", "strict-origin-when-cross-origin")
        self.send_header("X-Frame-Options", "SAMEORIGIN")

    def serve_static(self, raw_path: str, *, head_only: bool = False) -> None:
        decoded = urllib.parse.unquote(raw_path) or "/"
        if decoded in ("/", ""):
            decoded = f"/{ENTRY_FILE}"
        target = (APP_DIR / decoded.lstrip("/")).resolve()
        # Path traversal guard plus extension allow-list.
        if not target.is_relative_to(APP_DIR) or target.suffix.lower() not in STATIC_SUFFIXES:
            self.send_error(HTTPStatus.NOT_FOUND)
            return
        if target.is_dir():
            target = target / ENTRY_FILE
        if not target.is_file():
            self.send_error(HTTPStatus.NOT_FOUND)
            return

        content_type, _ = mimetypes.guess_type(str(target))
        content_type = content_type or "application/octet-stream"
        if content_type in TEXT_TYPES:
            content_type = f"{content_type}; charset=utf-8"
        data = target.read_bytes()

        self.send_response(HTTPStatus.OK)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(data)))
        if target.suffix.lower() in {".html", ".js", ".css"}:
            self.send_header("Cache-Control", "no-store, max-age=0")
        self._send_common_headers()
        self.end_headers()
        if not head_only:
            try:
                self.wfile.write(data)
            except (BrokenPipeError, ConnectionAbortedError):
                pass

    # ------------------------------------------------------------------- GET

    def do_HEAD(self) -> None:  # noqa: N802
        parsed = urllib.parse.urlparse(self.path)
        if parsed.path.startswith("/api/"):
            self.send_error(HTTPStatus.METHOD_NOT_ALLOWED)
            return
        self.serve_static(parsed.path, head_only=True)

    def do_GET(self) -> None:  # noqa: N802
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
        if path == "/api/feed":
            self.send_local_json(FEED_PATH, "feed_unavailable")
            return
        if path == "/api/repo-guides":
            self.send_local_json(GUIDE_PATH, "repo_guides_unavailable")
            return
        if path == "/api/research-kits":
            self.send_local_json(RESEARCH_KIT_PATH, "research_kits_unavailable")
            return
        if path == "/api/repo-snapshots":
            self.send_local_json(REPO_SNAPSHOT_PATH, "repo_snapshots_unavailable")
            return
        if path == "/api/small-resources":
            self.send_local_json(SMALL_RESOURCES_PATH, "small_resources_unavailable")
            return
        if path == "/api/live-feed":
            self.handle_live_feed(parsed)
            return
        if path == "/api/live-repo":
            self.handle_live_repo(parsed)
            return
        if path == "/api/github-auth":
            self.handle_github_auth_status()
            return
        if path == "/api/health":
            self.send_json(
                {
                    "status": "ok",
                    "mode": "live-github+local-archive",
                    "authMode": "token" if current_token() else "anonymous",
                    "liveCacheTtlSeconds": LIVE_CACHE_TTL_SECONDS,
                    "liveRateLimit": {
                        "limit": LIVE_RATE_LIMIT,
                        "windowSeconds": LIVE_RATE_WINDOW_SECONDS,
                    },
                    "localTokenWrite": ALLOW_LOCAL_TOKEN_WRITE,
                    "trustProxy": TRUST_PROXY,
                    "time": datetime.now(timezone.utc).isoformat(),
                }
            )
            return
        if path.startswith("/api/"):
            self.send_json({"error": "not_found"}, status=HTTPStatus.NOT_FOUND)
            return
        self.serve_static(path)

    # ------------------------------------------------------------------ auth

    def client_key(self) -> str:
        """Best-effort client identity for rate limiting."""
        if TRUST_PROXY:
            forwarded = self.headers.get("X-Forwarded-For")
            if forwarded:
                return forwarded.split(",", 1)[0].strip()
        return str(self.client_address[0])

    def is_loopback_client(self) -> bool:
        # Hosted deployments disable local token writes entirely.
        return ALLOW_LOCAL_TOKEN_WRITE and self.client_key() in LOOPBACK_HOSTS

    def enforce_live_rate_limit(self) -> bool:
        """Return False after sending 429 when the client is over budget."""
        allowed, retry_after = LIVE_LIMITER.check(self.client_key())
        if allowed:
            return True
        self.send_json(
            {
                "error": "rate_limited",
                "message": f"实时接口请求过快，请 {retry_after} 秒后再试。",
                "retryAfter": retry_after,
            },
            status=HTTPStatus.TOO_MANY_REQUESTS,
            extra_headers={"Retry-After": str(retry_after)},
        )
        return False

    def read_json_body(self, limit: int = 4096) -> dict[str, Any]:
        try:
            length = int(self.headers.get("Content-Length") or "0")
        except ValueError:
            length = 0
        if length <= 0 or length > limit:
            raise ValueError("请求体为空或过大")
        raw = self.rfile.read(length)
        try:
            payload = json.loads(raw.decode("utf-8"))
        except ValueError as exc:
            raise ValueError("请求体不是合法 JSON") from exc
        if not isinstance(payload, dict):
            raise ValueError("请求体必须是 JSON 对象")
        return payload

    def handle_github_auth_status(self) -> None:
        summary = auth_summary()
        rate: dict[str, Any] = {}
        if summary["connected"]:
            if not summary["login"]:
                try:
                    login, _ = verify_github_token(current_token())
                    save_github_auth(
                        current_token(), login, "env" if summary["source"] == "env" else "file"
                    )
                    summary["login"] = login
                except GitHubRequestError as exc:
                    self.send_json({**summary, "rateLimit": {}, "warning": str(exc)})
                    return
            try:
                rate = fetch_github_rate_limit()
            except Exception:
                rate = {}
        self.send_json(
            {
                **summary,
                "canManage": self.is_loopback_client(),
                "rateLimit": {
                    "remaining": rate.get("remaining"),
                    "limit": rate.get("limit") or (5000 if summary["connected"] else 60),
                    "resetAt": rate.get("resetAt"),
                },
            }
        )

    def handle_github_auth_save(self) -> None:
        if not self.is_loopback_client():
            self.send_json(
                {
                    "error": "github_auth_local_only",
                    "message": "为安全起见，只能在运行服务器的这台电脑上保存 Token。",
                },
                status=HTTPStatus.FORBIDDEN,
            )
            return
        try:
            payload = self.read_json_body()
        except ValueError as exc:
            self.send_json(
                {"error": "github_auth_bad_request", "message": str(exc)},
                status=HTTPStatus.BAD_REQUEST,
            )
            return

        token = str(payload.get("token") or "").strip()
        if not token:
            clear_github_auth()
            self.send_json({**auth_summary(), "rateLimit": {"remaining": None, "limit": 60}})
            return
        if not TOKEN_PATTERN.fullmatch(token):
            self.send_json(
                {
                    "error": "github_token_format_invalid",
                    "message": "Token 格式看起来不对，请粘贴完整的 GitHub Token。",
                },
                status=HTTPStatus.BAD_REQUEST,
            )
            return
        try:
            login, rate = verify_github_token(token)
        except GitHubRequestError as exc:
            self.send_json(
                {"error": exc.code, "message": str(exc), "rateLimit": exc.rate},
                status=exc.status_code,
            )
            return
        save_github_auth(token, login)
        self.send_json(
            {
                "connected": True,
                "login": login,
                "source": "file",
                "rateLimit": {
                    "remaining": rate.get("remaining"),
                    "limit": 5000,
                    "resetAt": rate.get("resetAt"),
                },
            }
        )

    def do_POST(self) -> None:  # noqa: N802
        parsed = urllib.parse.urlparse(self.path)
        if parsed.path == "/api/github-auth":
            self.handle_github_auth_save()
            return
        self.send_json({"error": "not_found"}, status=HTTPStatus.NOT_FOUND)

    def do_DELETE(self) -> None:  # noqa: N802
        parsed = urllib.parse.urlparse(self.path)
        if parsed.path == "/api/github-auth":
            if not self.is_loopback_client():
                self.send_json(
                    {
                        "error": "github_auth_local_only",
                        "message": "为安全起见，只能在运行服务器的这台电脑上断开连接。",
                    },
                    status=HTTPStatus.FORBIDDEN,
                )
                return
            clear_github_auth()
            self.send_json(
                {
                    "connected": False,
                    "login": "",
                    "source": "anonymous",
                    "rateLimit": {"limit": 60},
                }
            )
            return
        self.send_json({"error": "not_found"}, status=HTTPStatus.NOT_FOUND)

    # ------------------------------------------------------------------ live

    def handle_live_feed(self, parsed: urllib.parse.ParseResult) -> None:
        if not self.enforce_live_rate_limit():
            return
        query = urllib.parse.parse_qs(parsed.query)
        focuses = normalize_focuses(query.get("focus") or ["study"])
        major = (query.get("major") or ["general"])[0]
        stage = (query.get("stage") or [""])[0]
        need = (query.get("need") or [""])[0]
        terms = [
            term.strip()
            for term in (query.get("terms") or [""])[0].split(",")
            if term.strip()
        ][:3]
        try:
            page = int((query.get("page") or ["1"])[0])
        except ValueError:
            page = 1
        try:
            self.send_json(
                get_live_feed(focuses, major, page, stage=stage, need=need, terms=terms)
            )
        except GitHubRequestError as exc:
            self.send_json(
                {
                    "error": exc.code,
                    "message": str(exc),
                    "rateLimit": exc.rate,
                    "authMode": "token" if current_token() else "anonymous",
                    "time": datetime.now(timezone.utc).isoformat(),
                },
                status=exc.status_code,
            )
        except Exception as exc:
            self.send_json(
                {"error": "live_feed_unavailable", "message": str(exc)},
                status=HTTPStatus.BAD_GATEWAY,
            )

    def handle_live_repo(self, parsed: urllib.parse.ParseResult) -> None:
        if not self.enforce_live_rate_limit():
            return
        query = urllib.parse.parse_qs(parsed.query)
        full_name = (query.get("repo") or [""])[0]
        try:
            self.send_json(fetch_live_repo(full_name))
        except GitHubRequestError as exc:
            self.send_json(
                {
                    "error": exc.code,
                    "message": str(exc),
                    "rateLimit": exc.rate,
                    "authMode": "token" if current_token() else "anonymous",
                },
                status=exc.status_code,
            )
        except Exception as exc:
            self.send_json(
                {"error": "live_repo_unavailable", "message": str(exc)},
                status=HTTPStatus.BAD_GATEWAY,
            )

    # ----------------------------------------------------------------- local

    def send_local_json(self, path: Path, error_code: str) -> None:
        try:
            self.send_json(_read_json(path))
        except Exception as exc:
            self.send_json(
                {"error": error_code, "detail": str(exc)},
                status=HTTPStatus.INTERNAL_SERVER_ERROR,
            )

    def log_message(self, message: str, *args: Any) -> None:
        timestamp = datetime.now().strftime("%H:%M:%S")
        print(f"[{timestamp}] {message % args}")

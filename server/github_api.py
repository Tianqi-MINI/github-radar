"""Thin wrapper around the GitHub REST API.

Responsibilities:
  * build authenticated headers
  * parse rate-limit headers
  * fall back to a direct connection when an inherited proxy is unusable
  * translate failures into GitHubRequestError
"""

from __future__ import annotations

import json
import urllib.error
import urllib.request
from datetime import datetime, timezone
from http import HTTPStatus
from typing import Any

from .auth import current_token
from .config import GITHUB_API, GITHUB_API_VERSION, GITHUB_USER_AGENT
from .errors import GitHubRequestError

# A proxy-free opener is built lazily and reused.
_DIRECT_OPENER: urllib.request.OpenerDirector | None = None


def _direct_opener() -> urllib.request.OpenerDirector:
    global _DIRECT_OPENER
    if _DIRECT_OPENER is None:
        _DIRECT_OPENER = urllib.request.build_opener(urllib.request.ProxyHandler({}))
    return _DIRECT_OPENER


def open_github(request: urllib.request.Request, timeout: int) -> Any:
    """Open a GitHub request, retrying without proxies if the proxy is broken."""
    try:
        return urllib.request.urlopen(request, timeout=timeout)
    except urllib.error.HTTPError:
        raise
    except (urllib.error.URLError, OSError) as first_error:
        try:
            return _direct_opener().open(request, timeout=timeout)
        except Exception:
            raise first_error


def github_headers(accept: str = "application/vnd.github+json") -> dict[str, str]:
    headers = {
        "Accept": accept,
        "User-Agent": GITHUB_USER_AGENT,
        "X-GitHub-Api-Version": GITHUB_API_VERSION,
    }
    token = current_token()
    if token:
        headers["Authorization"] = f"Bearer {token}"
    return headers


def parse_rate_limit(headers: Any) -> dict[str, Any]:
    remaining = headers.get("X-RateLimit-Remaining")
    reset = headers.get("X-RateLimit-Reset")
    resource = headers.get("X-RateLimit-Resource")
    return {
        "remaining": int(remaining) if remaining and remaining.isdigit() else None,
        "resetAt": (
            datetime.fromtimestamp(int(reset), tz=timezone.utc).isoformat()
            if reset and reset.isdigit()
            else None
        ),
        "resource": resource,
    }


def github_request_bytes(
    url: str,
    *,
    accept: str = "application/vnd.github+json",
    timeout: int = 15,
) -> tuple[bytes, dict[str, Any], int]:
    request = urllib.request.Request(url, headers=github_headers(accept), method="GET")
    try:
        with open_github(request, timeout) as response:
            body = response.read()
            rate = parse_rate_limit(response.headers)
            return body, rate, response.status
    except urllib.error.HTTPError as exc:
        body = exc.read()
        rate = parse_rate_limit(exc.headers)
        message = f"GitHub API 返回 HTTP {exc.code}"
        try:
            payload = json.loads(body.decode("utf-8"))
            message = payload.get("message") or message
        except Exception:
            pass
        code = (
            "github_rate_limited"
            if exc.code == 403 and rate.get("remaining") == 0
            else "github_api_error"
        )
        status = (
            HTTPStatus.TOO_MANY_REQUESTS
            if code == "github_rate_limited"
            else HTTPStatus.BAD_GATEWAY
        )
        raise GitHubRequestError(message, status_code=status, code=code, rate=rate) from exc
    except Exception as exc:
        raise GitHubRequestError(
            f"无法连接 GitHub API：{exc}",
            code="github_network_error",
        ) from exc


def github_request_json(
    path_or_url: str, *, timeout: int = 15
) -> tuple[Any, dict[str, Any]]:
    url = path_or_url if path_or_url.startswith("https://") else f"{GITHUB_API}{path_or_url}"
    body, rate, _ = github_request_bytes(url, timeout=timeout)
    try:
        return json.loads(body.decode("utf-8")), rate
    except Exception as exc:
        raise GitHubRequestError("GitHub API 返回了无法解析的数据") from exc


def verify_github_token(token: str) -> tuple[str, dict[str, Any]]:
    """Return (login, rate) for a token, or raise GitHubRequestError."""
    request = urllib.request.Request(
        f"{GITHUB_API}/user",
        headers={
            "Accept": "application/vnd.github+json",
            "Authorization": f"Bearer {token}",
            "User-Agent": GITHUB_USER_AGENT,
            "X-GitHub-Api-Version": GITHUB_API_VERSION,
        },
        method="GET",
    )
    try:
        with open_github(request, 15) as response:
            payload = json.loads(response.read().decode("utf-8"))
            rate = parse_rate_limit(response.headers)
    except urllib.error.HTTPError as exc:
        if exc.code == 401:
            raise GitHubRequestError(
                "Token 无效或已过期，请重新生成",
                status_code=HTTPStatus.UNAUTHORIZED,
                code="github_token_invalid",
            ) from exc
        raise GitHubRequestError(
            f"GitHub 验证 Token 时返回 HTTP {exc.code}",
            code="github_token_verify_failed",
        ) from exc
    except Exception as exc:
        raise GitHubRequestError(
            f"无法连接 GitHub 验证 Token：{exc}", code="github_network_error"
        ) from exc
    login = str(payload.get("login") or "")
    if not login:
        raise GitHubRequestError("GitHub 未返回账号信息", code="github_token_verify_failed")
    return login, rate


def fetch_github_rate_limit() -> dict[str, Any]:
    body, rate, _ = github_request_bytes(f"{GITHUB_API}/rate_limit", timeout=12)
    try:
        payload = json.loads(body.decode("utf-8"))
    except ValueError:
        return rate
    core = (payload.get("resources") or {}).get("core") or {}
    reset = core.get("reset")
    return {
        "remaining": core.get("remaining", rate.get("remaining")),
        "limit": core.get("limit"),
        "resetAt": (
            datetime.fromtimestamp(int(reset), tz=timezone.utc).isoformat()
            if str(reset or "").isdigit()
            else rate.get("resetAt")
        ),
    }

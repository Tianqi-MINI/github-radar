"""Live repository detail + README loading."""

from __future__ import annotations

import base64
import json
import urllib.parse
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from http import HTTPStatus
from typing import Any

from .auth import current_token
from .config import GITHUB_API, REPO_PATTERN, ZH_README_PATTERN
from .errors import GitHubRequestError
from .github_api import github_request_bytes, github_request_json

README_LIMIT = 24_000


def fetch_live_repo(full_name: str) -> dict[str, Any]:
    if not REPO_PATTERN.fullmatch(full_name):
        raise GitHubRequestError(
            "仓库名格式不正确",
            status_code=HTTPStatus.BAD_REQUEST,
            code="invalid_repo_name",
        )

    repo_payload: dict[str, Any] | None = None
    readme_text = ""
    zh_readme_text = ""
    zh_readme_path = ""
    rates: list[dict[str, Any]] = []
    warnings: list[str] = []
    with ThreadPoolExecutor(max_workers=2) as executor:
        repo_future = executor.submit(github_request_json, f"/repos/{full_name}", timeout=30)
        readme_future = executor.submit(
            github_request_bytes,
            f"{GITHUB_API}/repos/{full_name}/readme",
            accept="application/vnd.github+json",
            timeout=30,
        )
        try:
            repo_payload, rate = repo_future.result()
            rates.append(rate)
        except Exception as exc:
            warnings.append(f"仓库详情读取失败：{exc}")
        try:
            readme_body, rate, _ = readme_future.result()
            rates.append(rate)
            readme_payload = json.loads(readme_body.decode("utf-8"))
            encoded = readme_payload.get("content") or ""
            readme_text = base64.b64decode(encoded).decode("utf-8", errors="replace")[:README_LIMIT]
        except Exception as exc:
            warnings.append(f"README 读取失败：{exc}")

    if readme_text:
        match = ZH_README_PATTERN.search(readme_text)
        if match:
            raw_path = match.group(1).strip()
            parsed_path = (
                urllib.parse.urlparse(raw_path).path if raw_path.startswith("http") else raw_path
            )
            if "/blob/" in parsed_path:
                parsed_path = parsed_path.split("/blob/", 1)[1].split("/", 1)[-1]
            zh_readme_path = parsed_path.lstrip("./")
            if zh_readme_path.lower().endswith((".md", ".markdown")):
                try:
                    zh_payload, rate = github_request_json(
                        f"/repos/{full_name}/contents/{urllib.parse.quote(zh_readme_path)}"
                    )
                    rates.append(rate)
                    encoded = str(zh_payload.get("content") or "")
                    zh_readme_text = base64.b64decode(encoded).decode("utf-8", errors="replace")[
                        :README_LIMIT
                    ]
                except Exception as exc:
                    warnings.append(f"中文 README 读取失败：{exc}")

    if not repo_payload:
        raise GitHubRequestError(
            "无法读取该仓库的实时信息",
            code="live_repo_unavailable",
            rate=rates[0] if rates else {},
        )

    remaining_values = [rate["remaining"] for rate in rates if rate.get("remaining") is not None]
    return {
        "mode": "live-github",
        "fetchedAt": datetime.now(timezone.utc).isoformat(),
        "repo": repo_payload,
        "readme": readme_text,
        "zhReadme": zh_readme_text,
        "zhReadmePath": zh_readme_path,
        "warnings": warnings,
        "rateLimit": {
            "remaining": min(remaining_values) if remaining_values else None,
        },
        "authMode": "token" if current_token() else "anonymous",
    }

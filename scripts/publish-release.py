"""Publish the portable radar package as a GitHub release.

The script reads a GitHub token from GH_TOKEN/GITHUB_TOKEN first. If neither is
present on Windows, it reads the existing Credential Manager entry named
``GitHub - https://api.github.com/<owner>`` without writing the secret to disk.

Example:
  py -3.12 scripts/publish-release.py `
    --repo Tianqi-MINI/github-radar `
    --tag v1.0.0 `
    --asset outputs/github-radar-portable_1.zip `
    --asset outputs/github-radar-portable_1.zip.sha256
"""

from __future__ import annotations

import argparse
import ctypes
import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request
from ctypes import wintypes
from pathlib import Path
from typing import Any


API_ROOT = "https://api.github.com"
UPLOAD_ROOT = "https://uploads.github.com"
USER_AGENT = "github-radar-release-publisher"


class CREDENTIALW(ctypes.Structure):
    _fields_ = [
        ("Flags", wintypes.DWORD),
        ("Type", wintypes.DWORD),
        ("TargetName", wintypes.LPWSTR),
        ("Comment", wintypes.LPWSTR),
        ("LastWritten", wintypes.FILETIME),
        ("CredentialBlobSize", wintypes.DWORD),
        ("CredentialBlob", ctypes.POINTER(ctypes.c_ubyte)),
        ("Persist", wintypes.DWORD),
        ("AttributeCount", wintypes.DWORD),
        ("Attributes", ctypes.c_void_p),
        ("TargetAlias", wintypes.LPWSTR),
        ("UserName", wintypes.LPWSTR),
    ]


def _decode_secret(blob: bytes) -> str:
    odd_nuls = blob[1::2].count(0)
    encodings = ("utf-16-le", "utf-8-sig") if odd_nuls > len(blob) // 4 else ("utf-8-sig", "utf-16-le")
    for encoding in encodings:
        try:
            text = blob.decode(encoding).strip("\x00\r\n ")
        except UnicodeDecodeError:
            continue
        if text and "\x00" not in text:
            return text
    raise RuntimeError("Credential Manager returned an unreadable secret")


def _extract_token(text: str) -> str:
    try:
        payload = json.loads(text)
    except ValueError:
        return text
    if isinstance(payload, str):
        return payload.strip()
    if isinstance(payload, dict):
        for key in ("accessToken", "access_token", "token", "oauth_token"):
            value = payload.get(key)
            if isinstance(value, str) and value.strip():
                return value.strip()
    raise RuntimeError("Credential Manager secret did not contain a GitHub token")


def token_from_windows_credential(target: str) -> str:
    if os.name != "nt":
        raise RuntimeError("No GH_TOKEN/GITHUB_TOKEN is set and Credential Manager is Windows-only")

    advapi32 = ctypes.WinDLL("advapi32", use_last_error=True)
    advapi32.CredReadW.argtypes = [
        wintypes.LPCWSTR,
        wintypes.DWORD,
        wintypes.DWORD,
        ctypes.POINTER(ctypes.POINTER(CREDENTIALW)),
    ]
    advapi32.CredReadW.restype = wintypes.BOOL
    advapi32.CredFree.argtypes = [ctypes.c_void_p]
    advapi32.CredFree.restype = None

    credential = ctypes.POINTER(CREDENTIALW)()
    if not advapi32.CredReadW(target, 1, 0, ctypes.byref(credential)):
        error = ctypes.get_last_error()
        raise RuntimeError(
            f"GitHub credential not found ({target}); set GH_TOKEN or GITHUB_TOKEN instead"
        ) from OSError(error, "CredReadW failed")

    try:
        item = credential.contents
        blob = ctypes.string_at(item.CredentialBlob, item.CredentialBlobSize)
        return _extract_token(_decode_secret(blob))
    finally:
        advapi32.CredFree(credential)


def github_token(repo: str) -> str:
    for name in ("GH_TOKEN", "GITHUB_TOKEN"):
        value = os.environ.get(name, "").strip()
        if value:
            return value
    owner = repo.split("/", 1)[0]
    return token_from_windows_credential(f"GitHub - https://api.github.com/{owner}")


def request_json(
    method: str,
    url: str,
    token: str,
    payload: Any = None,
) -> tuple[int, Any, dict[str, str]]:
    body = None
    headers = {
        "Accept": "application/vnd.github+json",
        "Authorization": f"Bearer {token}",
        "User-Agent": USER_AGENT,
        "X-GitHub-Api-Version": "2022-11-28",
    }
    if payload is not None:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        headers["Content-Type"] = "application/json; charset=utf-8"

    request = urllib.request.Request(url, data=body, headers=headers, method=method)
    opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
    try:
        with opener.open(request, timeout=30) as response:
            raw = response.read()
            parsed = json.loads(raw.decode("utf-8")) if raw else None
            return response.status, parsed, dict(response.headers)
    except urllib.error.HTTPError as exc:
        raw = exc.read()
        detail = ""
        try:
            parsed = json.loads(raw.decode("utf-8"))
            detail = str(parsed.get("message") or "")
        except Exception:
            pass
        message = f"GitHub API returned HTTP {exc.code}"
        if detail:
            message = f"{message}: {detail}"
        raise RuntimeError(message) from exc


def upload_asset(
    repo: str,
    release_id: int,
    token: str,
    path: Path,
    asset_name: str,
) -> dict[str, Any]:
    url = f"{UPLOAD_ROOT}/repos/{repo}/releases/{release_id}/assets?name={urllib.parse.quote(asset_name)}"
    data = path.read_bytes()
    headers = {
        "Accept": "application/vnd.github+json",
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/octet-stream",
        "Content-Length": str(len(data)),
        "User-Agent": USER_AGENT,
        "X-GitHub-Api-Version": "2022-11-28",
    }
    request = urllib.request.Request(url, data=data, headers=headers, method="POST")
    opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
    try:
        with opener.open(request, timeout=180) as response:
            return json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        raw = exc.read()
        try:
            message = json.loads(raw.decode("utf-8")).get("message")
        except Exception:
            message = None
        raise RuntimeError(message or f"GitHub asset upload returned HTTP {exc.code}") from exc


def parse_asset(value: str) -> tuple[Path, str]:
    if "=" in value:
        source, name = value.split("=", 1)
    else:
        source, name = value, Path(value).name
    path = Path(source).resolve()
    if not path.is_file():
        raise FileNotFoundError(path)
    return path, name


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--repo", required=True, help="GitHub repository, e.g. owner/name")
    parser.add_argument("--tag", default="v1.0.0")
    parser.add_argument("--name", default="Windows 便携版 1.0.0")
    parser.add_argument("--target", default="master")
    parser.add_argument("--notes", default="Windows 便携版：解压后双击 start-github-radar.bat 即可运行。")
    parser.add_argument(
        "--asset",
        action="append",
        default=[],
        help="FILE or FILE=RELEASE_NAME; may be repeated",
    )
    parser.add_argument("--check-auth", action="store_true")
    args = parser.parse_args()

    token = github_token(args.repo)
    status, user, _ = request_json("GET", f"{API_ROOT}/user", token)
    login = str((user or {}).get("login") or "")
    if not login:
        raise RuntimeError(f"GitHub authentication returned HTTP {status} without a login")
    print(f"Authenticated as {login}")
    if args.check_auth:
        return 0

    release_url = f"{API_ROOT}/repos/{args.repo}/releases/tags/{args.tag}"
    try:
        _, release, _ = request_json("GET", release_url, token)
        print(f"Updating existing release {args.tag}")
    except RuntimeError as exc:
        if "HTTP 404" not in str(exc):
            raise
        _, release, _ = request_json(
            "POST",
            f"{API_ROOT}/repos/{args.repo}/releases",
            token,
            {
                "tag_name": args.tag,
                "target_commitish": args.target,
                "name": args.name,
                "body": args.notes,
                "draft": False,
                "prerelease": False,
            },
        )
        print(f"Created release {args.tag}")

    release_id = int(release["id"])
    assets = {item["name"]: item for item in release.get("assets", [])}
    for raw_asset in args.asset:
        path, asset_name = parse_asset(raw_asset)
        existing = assets.get(asset_name)
        if existing:
            request_json(
                "DELETE",
                f"{API_ROOT}/repos/{args.repo}/releases/assets/{existing['id']}",
                token,
            )
        uploaded = upload_asset(args.repo, release_id, token, path, asset_name)
        print(f"Uploaded {asset_name}: {uploaded.get('browser_download_url')}")

    print(release.get("html_url") or f"https://github.com/{args.repo}/releases/tag/{args.tag}")
    return 0


if __name__ == "__main__":
    sys.exit(main())

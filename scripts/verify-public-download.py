"""Download the public Windows package anonymously and smoke-test it.

This validates the user-facing path rather than the maintainer's local copy:
download the raw GitHub files without credentials, verify SHA-256, extract the
archive, start its bundled Python runtime, and request the key HTTP routes.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import socket
import subprocess
import sys
import time
import urllib.request
import zipfile
from pathlib import Path


DEFAULT_ZIP = (
    "https://github.com/Tianqi-MINI/github-radar/raw/refs/heads/master/"
    "downloads/github-radar-portable_1.zip"
)
DEFAULT_SHA = f"{DEFAULT_ZIP}.sha256"


def download(url: str, destination: Path) -> bytes:
    request = urllib.request.Request(url, headers={"User-Agent": "github-radar-download-check"})
    opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
    with opener.open(request, timeout=180) as response:
        data = response.read()
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_bytes(data)
    return data


def wait_health(url: str, process: subprocess.Popen[bytes]) -> None:
    deadline = time.monotonic() + 20
    while time.monotonic() < deadline:
        if process.poll() is not None:
            raise RuntimeError(f"packaged server exited with {process.returncode}")
        try:
            with urllib.request.urlopen(f"{url}/api/health", timeout=1) as response:
                if response.status == 200:
                    return
        except Exception:
            time.sleep(0.25)
    raise RuntimeError("packaged server did not become healthy")


def free_port() -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as probe:
        probe.bind(("127.0.0.1", 0))
        return int(probe.getsockname()[1])


def http_status(url: str) -> int:
    request = urllib.request.Request(url, headers={"User-Agent": "github-radar-download-check"})
    opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
    with opener.open(request, timeout=10) as response:
        response.read()
        return int(response.status)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--zip-url", default=DEFAULT_ZIP)
    parser.add_argument("--sha-url", default=DEFAULT_SHA)
    parser.add_argument(
        "--archive-url",
        default="",
        help="Optional official repository ZIP archive fallback containing the package",
    )
    parser.add_argument("--output-root", default="")
    args = parser.parse_args()

    root = Path(__file__).resolve().parent.parent
    output_root = (
        Path(args.output_root).resolve()
        if args.output_root
        else root / "outputs" / f"public-download-check-{int(time.time())}"
    )
    output_root.mkdir(parents=True, exist_ok=False)

    zip_file = output_root / "github-radar-portable_1.zip"
    sha_file = output_root / "github-radar-portable_1.zip.sha256"
    if args.archive_url:
        archive_file = output_root / "github-radar-master.zip"
        archive_bytes = download(args.archive_url, archive_file)
        with zipfile.ZipFile(archive_file) as repository_archive:
            names = repository_archive.namelist()
            package_member = next(
                name
                for name in names
                if name.endswith("/downloads/github-radar-portable_1.zip")
            )
            sha_member = f"{package_member}.sha256"
            sha_text = repository_archive.read(sha_member).decode("utf-8-sig").strip()
            zip_bytes = repository_archive.read(package_member)
        zip_file.write_bytes(zip_bytes)
        sha_file.write_text(f"{sha_text}\n", encoding="utf-8")
        download_mode = "repository-archive"
        source_url = args.archive_url
    else:
        archive_bytes = b""
        sha_text = download(args.sha_url, sha_file).decode("utf-8-sig").strip()
        zip_bytes = download(args.zip_url, zip_file)
        download_mode = "direct-asset"
        source_url = args.zip_url

    expected = sha_text.split()[0].lower()
    if len(expected) != 64:
        raise RuntimeError("SHA-256 file did not contain a 64-character digest")
    actual = hashlib.sha256(zip_bytes).hexdigest()
    if actual != expected:
        raise RuntimeError(f"SHA-256 mismatch: expected {expected}, got {actual}")

    package_root = output_root / "package"
    with zipfile.ZipFile(zip_file) as archive:
        archive.extractall(package_root)

    python_exe = package_root / "runtime" / "python" / "python.exe"
    if not python_exe.is_file():
        raise RuntimeError("downloaded package is missing the bundled Python runtime")

    port = free_port()
    base_url = f"http://127.0.0.1:{port}"
    env = os.environ.copy()
    env["PYTHONPATH"] = str(package_root)
    env["PYTHONUTF8"] = "1"
    env["PYTHONIOENCODING"] = "utf-8"
    process = subprocess.Popen(
        [
            str(python_exe),
            "-m",
            "server.app",
            "--host",
            "127.0.0.1",
            "--port",
            str(port),
        ],
        cwd=package_root,
        env=env,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.PIPE,
    )

    try:
        wait_health(base_url, process)
        routes = {
            "/": http_status(f"{base_url}/"),
            "/js/guide.js": http_status(f"{base_url}/js/guide.js"),
            "/api/feed": http_status(f"{base_url}/api/feed"),
        }
        if set(routes.values()) != {200}:
            raise RuntimeError(f"downloaded package returned unexpected HTTP statuses: {routes}")
        summary = {
            "downloadMode": download_mode,
            "sourceUrl": source_url,
            "archiveBytes": len(archive_bytes),
            "zipBytes": len(zip_bytes),
            "sha256": actual,
            "packageRoot": str(package_root),
            "http": routes,
        }
        print(json.dumps(summary, ensure_ascii=False, indent=2))
        return 0
    finally:
        process.terminate()
        try:
            process.wait(timeout=5)
        except subprocess.TimeoutExpired:
            process.kill()


if __name__ == "__main__":
    sys.exit(main())

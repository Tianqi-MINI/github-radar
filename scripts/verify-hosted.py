"""Verify hosted-mode behaviour: env-injected settings, cache, rate limit, 403.

Launches the real server as a subprocess with the same env variables Render
would provide, then runs HTTP requests against it.

Run with: python scripts/verify-hosted.py
"""

from __future__ import annotations

import json
import os
import socket
import subprocess
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PORT = int(os.environ.get("RADAR_TEST_PORT", "8124"))
BASE = f"http://127.0.0.1:{PORT}"


def get(path: str) -> tuple[int, dict | None, str]:
    request = urllib.request.Request(f"{BASE}{path}")
    try:
        with urllib.request.urlopen(request, timeout=15) as response:
            body = response.read().decode("utf-8")
            try:
                payload = json.loads(body)
            except json.JSONDecodeError:
                payload = None
            return response.status, payload, body
    except urllib.error.HTTPError as exc:
        raw = exc.read().decode("utf-8", "replace")
        try:
            payload = json.loads(raw)
        except json.JSONDecodeError:
            payload = None
        return exc.code, payload, raw


def post(path: str, payload: dict) -> int:
    request = urllib.request.Request(
        f"{BASE}{path}",
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=15) as response:
            return response.status
    except urllib.error.HTTPError as exc:
        return exc.code


def main() -> int:
    checks = 0
    failures = []

    def check(name: str, condition: bool, detail: str = "") -> None:
        nonlocal checks
        checks += 1
        print(f"  {'PASS' if condition else 'FAIL'}  {name}{f'  ({detail})' if detail else ''}")
        if not condition:
            failures.append(name)

    env = os.environ.copy()
    env.update(
        {
            "PORT": str(PORT),
            "RADAR_HOST": "0.0.0.0",
            "RADAR_ALLOW_LOCAL_TOKEN_WRITE": "0",
            "RADAR_TRUST_PROXY": "1",
            "RADAR_LIVE_RATE_LIMIT": "2",
            "RADAR_LIVE_RATE_WINDOW": "60",
            "RADAR_LIVE_CACHE_TTL": "90",
            "GITHUB_TOKEN": "",  # empty means no token; test unauthenticated
        }
    )
    # Launch with env-injected port (simulates Render/Cloud Run)
    proc = subprocess.Popen(
        [sys.executable, "-m", "server.app"],
        cwd=str(ROOT),
        env=env,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
    )

    # Wait for ready
    ready = False
    for _ in range(50):
        try:
            with socket.create_connection(("127.0.0.1", PORT), timeout=1):
                ready = True
                break
        except OSError:
            time.sleep(0.3)
    if not ready:
        log = proc.stdout.read().decode("utf-8", "replace") if proc.stdout else ""
        proc.kill()
        print(f"SERVER DID NOT START. Log:\n{log}")
        return 1

    print(f"Server ready at {BASE} (PID {proc.pid})")
    try:
        status, health, _ = get("/api/health")
        check("health 200", status == 200, f"HTTP {status}")
        check(
            "env config reflected",
            health.get("liveRateLimit", {}).get("limit") == 2
            and health.get("liveCacheTtlSeconds") == 90
            and health.get("localTokenWrite") is False
            and health.get("trustProxy") is True,
            json.dumps(health, ensure_ascii=False)[:200],
        )

        post_status = post("/api/github-auth", {"token": "fake"})
        check(
            "token write blocked (localTokenWrite=0)",
            post_status == 403,
            f"POST /api/github-auth → {post_status}",
        )

        feed1, _, _ = get("/api/live-feed?focus=study")
        feed2, _, _ = get("/api/live-feed?focus=study")
        feed3, body3, _ = get("/api/live-feed?focus=study")
        check(
            "rate limit: 1st+2nd pass, 3rd → 429",
            feed1 in (200, 502, 429) and feed2 in (200, 502, 429),
            f"1st={feed1}, 2nd={feed2}",
        )
        check("rate limit: 3rd → 429", feed3 == 429, f"got {feed3}")
        if feed3 == 429:
            check(
                "429 body has retryAfter",
                isinstance((body3 or {}).get("retryAfter"), int) and body3["retryAfter"] > 0,
                f"retryAfter={body3.get('retryAfter')}",
            )

        # Static and local endpoints still work
        static_status, _, _ = get("/")
        check("static index.html", static_status == 200, f"HTTP {static_status}")
        local_status, feed_payload, _ = get("/api/feed")
        check(
            "local /api/feed 24 items",
            local_status == 200 and len((feed_payload or {}).get("items", [])) == 24,
            f"count={len((feed_payload or {}).get('items', []))}",
        )
    finally:
        proc.terminate()
        proc.wait(timeout=5)
        proc.kill() if proc.poll() is None else None

    print(f"\n{checks - len(failures)}/{checks} passed")
    if failures:
        print("FAILED:", failures)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

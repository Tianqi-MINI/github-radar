"""Start the packaged radar server and open the local browser page."""

from __future__ import annotations

import os
import socket
import subprocess
import sys
import time
import urllib.request
import webbrowser
from pathlib import Path


PORT_START = 4173
PORT_END = 4190
STARTUP_TIMEOUT_SECONDS = 20


def find_free_port() -> int | None:
    for port in range(PORT_START, PORT_END + 1):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as probe:
            try:
                probe.bind(("127.0.0.1", port))
            except OSError:
                continue
            return port
    return None


def is_ready(url: str) -> bool:
    try:
        with urllib.request.urlopen(f"{url}/api/health", timeout=1) as response:
            return response.status == 200
    except Exception:
        return False


def wait_until_ready(url: str, process: subprocess.Popen[bytes]) -> bool:
    deadline = time.monotonic() + STARTUP_TIMEOUT_SECONDS
    while time.monotonic() < deadline:
        if process.poll() is not None:
            return False
        if is_ready(url):
            return True
        time.sleep(0.25)
    return False


def main() -> int:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")

    root = Path(__file__).resolve().parent
    python_exe = root / "runtime" / "python" / "python.exe"
    if not python_exe.is_file():
        print("没有找到内置 Python，压缩包可能没有解压完整。")
        return 1

    port = find_free_port()
    if port is None:
        print("4173 到 4190 端口都被占用了，请关闭其他程序后重试。")
        return 1

    url = f"http://127.0.0.1:{port}"
    env = os.environ.copy()
    env["PYTHONPATH"] = str(root)
    env["PYTHONUTF8"] = "1"
    env["PYTHONIOENCODING"] = "utf-8"

    print("正在启动 GitHub 兴趣雷达，请稍等……")
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
        cwd=root,
        env=env,
    )

    try:
        if not wait_until_ready(url, process):
            print("服务启动失败。请保留这个窗口，把上面的错误信息发给维护者。")
            return process.wait()

        print(f"启动成功：{url}")
        print("使用期间请保持这个窗口打开；关闭窗口即可停止服务。")
        webbrowser.open(url)
        return process.wait()
    except KeyboardInterrupt:
        print("\n正在停止服务……")
        process.terminate()
        try:
            process.wait(timeout=5)
        except subprocess.TimeoutExpired:
            process.kill()
        return 0


if __name__ == "__main__":
    raise SystemExit(main())

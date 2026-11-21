"""Per-client sliding-window rate limiter for the live GitHub endpoints."""

from __future__ import annotations

import threading
import time
from collections import defaultdict, deque


class SlidingWindowLimiter:
    def __init__(self, limit: int, window_seconds: float, max_clients: int = 10_000) -> None:
        self.limit = max(1, int(limit))
        self.window = max(1.0, float(window_seconds))
        self.max_clients = max(1, int(max_clients))
        self._hits: dict[str, deque[float]] = defaultdict(deque)
        self._lock = threading.Lock()

    def check(self, key: str) -> tuple[bool, int]:
        """Return (allowed, retry_after_seconds)."""
        now = time.monotonic()
        with self._lock:
            hits = self._hits[key]
            cutoff = now - self.window
            while hits and hits[0] <= cutoff:
                hits.popleft()

            if len(hits) >= self.limit:
                oldest = hits[0]
                retry_after = max(1, int(self.window - (now - oldest)) + 1)
                return False, retry_after

            hits.append(now)
            self._prune_clients_locked(now)
            return True, 0

    def _prune_clients_locked(self, now: float) -> None:
        if len(self._hits) <= self.max_clients:
            return
        cutoff = now - self.window
        for key in [k for k, hits in self._hits.items() if not hits or hits[-1] <= cutoff]:
            self._hits.pop(key, None)

    def clear(self) -> None:
        with self._lock:
            self._hits.clear()

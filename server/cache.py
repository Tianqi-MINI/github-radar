"""In-process TTL cache with single-flight loading.

Used for GitHub search results so a burst of visitors makes one upstream call
instead of one call per visitor. Nothing is persisted to disk.
"""

from __future__ import annotations

import threading
import time
from collections.abc import Callable, Hashable
from dataclasses import dataclass
from typing import Any, Generic, TypeVar

T = TypeVar("T")


@dataclass
class _Entry(Generic[T]):
    expires_at: float
    value: T


class TTLCache(Generic[T]):
    def __init__(self, ttl_seconds: float, max_entries: int = 256) -> None:
        self.ttl_seconds = max(1.0, float(ttl_seconds))
        self.max_entries = max(1, int(max_entries))
        self._lock = threading.Lock()
        self._entries: dict[Hashable, _Entry[T]] = {}
        self._key_locks: dict[Hashable, threading.Lock] = {}

    def get_or_create(
        self,
        key: Hashable,
        factory: Callable[[], T],
    ) -> tuple[T, bool]:
        """Return (value, cache_hit). Concurrent callers for one key share a single load."""
        now = time.monotonic()
        with self._lock:
            entry = self._entries.get(key)
            if entry and entry.expires_at > now:
                return entry.value, True
            key_lock = self._key_locks.setdefault(key, threading.Lock())

        with key_lock:
            now = time.monotonic()
            with self._lock:
                entry = self._entries.get(key)
                if entry and entry.expires_at > now:
                    return entry.value, True

            value = factory()
            with self._lock:
                self._entries[key] = _Entry(time.monotonic() + self.ttl_seconds, value)
                self._prune_locked()
            return value, False

    def _prune_locked(self) -> None:
        if len(self._entries) <= self.max_entries:
            return
        now = time.monotonic()
        for key in [k for k, entry in self._entries.items() if entry.expires_at <= now]:
            self._entries.pop(key, None)
        if len(self._entries) > self.max_entries:
            overflow = len(self._entries) - self.max_entries
            oldest = sorted(self._entries, key=lambda k: self._entries[k].expires_at)
            for key in oldest[:overflow]:
                self._entries.pop(key, None)

    def clear(self) -> None:
        with self._lock:
            self._entries.clear()

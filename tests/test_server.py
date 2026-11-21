"""Offline unit tests for the radar backend.

Run with: python -m unittest discover -s tests -v
No network access is required.
"""

from __future__ import annotations

import json
import sys
import unittest
from email.message import Message
from pathlib import Path
from unittest.mock import patch

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from server.cache import TTLCache  # noqa: E402
from server.config import DATA_DIR  # noqa: E402
from server.feed import (  # noqa: E402
    clear_feed_cache,
    get_live_feed,
    normalize_focuses,
    normalize_repo,
    pick_query,
    rotate_focuses,
)
from server.github_api import parse_rate_limit  # noqa: E402
from server.ratelimit import SlidingWindowLimiter  # noqa: E402


def make_repo(**overrides):
    repo = {
        "full_name": "owner/project",
        "name": "project",
        "html_url": "https://github.com/owner/project",
        "description": "A useful open-source project for students.",
        "license": {"spdx_id": "MIT"},
        "stargazers_count": 1234,
        "forks_count": 12,
        "open_issues_count": 3,
        "owner": {"login": "owner"},
        "topics": ["education"],
        "homepage": "https://example.com",
        "created_at": "2024-01-01T00:00:00Z",
        "pushed_at": "2026-01-01T00:00:00Z",
        "archived": False,
        "fork": False,
        "private": False,
        "disabled": False,
    }
    repo.update(overrides)
    return repo


class FeedTests(unittest.TestCase):
    def test_normalize_focuses_flattens_and_deduplicates(self):
        self.assertEqual(
            normalize_focuses(["study,music", "music", "unknown"]),
            ["study", "music"],
        )
        self.assertEqual(normalize_focuses([]), ["study"])

    def test_rotate_focuses_keeps_order(self):
        self.assertEqual(rotate_focuses(["a", "b", "c"], 2), ["b", "c", "a"])
        self.assertEqual(rotate_focuses([], 3), [])

    def test_pick_query_food_science_study(self):
        self.assertEqual(pick_query("study", "food-science"), ('"AI for science"', "ai-tools"))
        self.assertEqual(pick_query("music", "general"), ('"music production"', "music"))

    def test_normalize_repo_accepts_valid_project(self):
        item = normalize_repo(make_repo(), topic_id="ai-tools", lane="authority")
        self.assertIsNotNone(item)
        assert item is not None
        self.assertEqual(item["id"], "live:owner/project")
        self.assertEqual(item["metrics"]["license"], "MIT")
        self.assertEqual(item["metrics"]["documentationQuality"], 9)

    def test_normalize_repo_rejects_unsafe_or_incomplete(self):
        cases = [
            make_repo(archived=True),
            make_repo(fork=True),
            make_repo(private=True),
            make_repo(license={"spdx_id": "NOASSERTION"}),
            make_repo(license=None),
            make_repo(description="too short"),
            make_repo(full_name="no-slash"),
        ]
        for repo in cases:
            self.assertIsNone(normalize_repo(repo, topic_id="ai-tools", lane="recent"))


class RateLimitTests(unittest.TestCase):
    def test_parse_rate_limit(self):
        headers = Message()
        headers["X-RateLimit-Remaining"] = "42"
        headers["X-RateLimit-Reset"] = "1760000000"
        headers["X-RateLimit-Resource"] = "search"
        rate = parse_rate_limit(headers)
        self.assertEqual(rate["remaining"], 42)
        self.assertEqual(rate["resource"], "search")
        self.assertTrue(rate["resetAt"].endswith("+00:00"))

    def test_parse_rate_limit_missing_headers(self):
        rate = parse_rate_limit(Message())
        self.assertEqual(rate, {"remaining": None, "resetAt": None, "resource": None})


class DataFileTests(unittest.TestCase):
    def test_all_data_files_are_valid_json(self):
        files = [
            "feed.json",
            "repo-guides.json",
            "research-kits.json",
            "repo-snapshots.json",
            "small-resources.json",
        ]
        for name in files:
            path = DATA_DIR / name
            self.assertTrue(path.exists(), name)
            with path.open(encoding="utf-8") as handle:
                payload = json.load(handle)
            self.assertIsInstance(payload, (dict, list), name)

    def test_feed_items_have_required_fields(self):
        with (DATA_DIR / "feed.json").open(encoding="utf-8") as handle:
            feed = json.load(handle)
        items = feed.get("items") if isinstance(feed, dict) else feed
        self.assertTrue(items)
        for item in items:
            for field in ("id", "title", "topicIds"):
                self.assertIn(field, item)
            self.assertIsInstance(item["topicIds"], list)


class CacheTests(unittest.TestCase):
    def test_ttl_cache_loads_once(self):
        cache: TTLCache[dict] = TTLCache(60)
        calls = {"count": 0}

        def factory():
            calls["count"] += 1
            return {"value": calls["count"]}

        first, first_hit = cache.get_or_create("k", factory)
        second, second_hit = cache.get_or_create("k", factory)
        self.assertFalse(first_hit)
        self.assertTrue(second_hit)
        self.assertEqual(calls["count"], 1)
        self.assertEqual(first, second)

    def test_live_feed_is_cached(self):
        clear_feed_cache()
        payload = {"items": [{"id": "x"}], "rateLimit": {}}
        with patch("server.feed.fetch_live_feed", return_value=payload) as mocked:
            first = get_live_feed(["study"], "general", 1)
            second = get_live_feed(["study"], "general", 1)
        self.assertEqual(mocked.call_count, 1)
        self.assertFalse(first["cache"]["hit"])
        self.assertTrue(second["cache"]["hit"])
        self.assertEqual(second["items"], payload["items"])
        clear_feed_cache()


class RateLimitTests(unittest.TestCase):
    def test_third_request_is_rejected(self):
        limiter = SlidingWindowLimiter(limit=2, window_seconds=60)
        self.assertEqual(limiter.check("1.2.3.4"), (True, 0))
        self.assertEqual(limiter.check("1.2.3.4"), (True, 0))
        allowed, retry_after = limiter.check("1.2.3.4")
        self.assertFalse(allowed)
        self.assertGreater(retry_after, 0)

    def test_clients_have_independent_budgets(self):
        limiter = SlidingWindowLimiter(limit=1, window_seconds=60)
        self.assertTrue(limiter.check("a")[0])
        self.assertTrue(limiter.check("b")[0])
        self.assertFalse(limiter.check("a")[0])


if __name__ == "__main__":
    unittest.main()

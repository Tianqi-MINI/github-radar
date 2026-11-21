"""Live GitHub search for the radar.

The search model is intentionally simple and explainable:
  * one or more focus lanes (study / product / presentation / research /
    content / music) rotated per page
  * each lane runs either an "authority" search sorted by stars or a
    "recent" search sorted by push time
  * results are filtered for public, non-fork, non-archived repos with an
    explicit licence and a usable description
  * duplicate repos are merged so both lane hits are retained
"""

from __future__ import annotations

import urllib.parse
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timedelta, timezone
from typing import Any

from .auth import current_token
from .cache import TTLCache
from .config import LIVE_CACHE_TTL_SECONDS
from .errors import GitHubRequestError
from .github_api import github_request_json

_FEED_CACHE: TTLCache[dict[str, Any]] = TTLCache(LIVE_CACHE_TTL_SECONDS)

FOCUS_TOPIC = {
    "study": "ai-tools",
    "product": "micro-product",
    "presentation": "presentation",
    "research": "research",
    "content": "content",
    "music": "music",
}

FOCUS_QUERY = {
    "study": '"coding agent"',
    "product": '"ai product"',
    "presentation": "presentation",
    "research": '"research tools"',
    "content": '"content creation"',
    "music": '"music production"',
}

LIVE_TOPIC_WHY = {
    "ai-tools": "适合把 AI 能力接进学习或产品流程；先用 README 的最小示例验证，再决定是否长期使用。",
    "micro-product": "适合把想法做成可演示的小产品；先跑通最小功能，再扩展后端和部署。",
    "presentation": "适合课程汇报或路演；先看示例产出是否符合学校模板，再决定是否采用。",
    "research": "适合整理文献、数据或研究流程；先确认导出格式能配合你现有的写作工具。",
    "content": "适合自媒体内容生产；先用一条短内容测试流程，再批量使用。",
    "music": "适合音乐制作练习；先用一段短音频验证音质和工作流。",
}

MAJOR_QUERY = {
    "food-science": '"food science"',
    "cs-ai": '"artificial intelligence"',
    "marine": '"marine science"',
    "business": "business",
    "design": "design",
    "general": "productivity",
}

STAGE_QUERY = {
    "exploring": ('"awesome list"', "ai-tools"),
    "question": ('"literature review"', "research"),
    "literature": ("citation", "research"),
    "experiment": ('"data collection"', "research"),
    "analysis": ('"data analysis"', "research"),
    "writing": ("latex", "research"),
    "communication": ("presentation", "presentation"),
}

NEED_QUERY = {
    "direction": ('"awesome list"', "ai-tools"),
    "literature": ("zotero", "research"),
    "design": ('"experiment design"', "research"),
    "data": ('"data analysis"', "research"),
    "writing": ("latex", "research"),
    "presentation": ("presentation", "presentation"),
}


def pick_query(focus: str, major: str) -> tuple[str, str]:
    """Return (keyword, topic_id) for a focus/major pair."""
    normalized_focus = focus if focus in FOCUS_QUERY else "study"
    normalized_major = major if major in MAJOR_QUERY else "general"
    keyword = FOCUS_QUERY[normalized_focus]
    if normalized_focus == "study" and normalized_major == "food-science":
        keyword = '"AI for science"'
    return keyword, FOCUS_TOPIC[normalized_focus]


def normalize_repo(repo: dict[str, Any], *, topic_id: str, lane: str) -> dict[str, Any] | None:
    """Convert a GitHub search result into a feed item, or None if it fails the safety filter."""
    if repo.get("archived") or repo.get("fork") or repo.get("private") or repo.get("disabled"):
        return None
    license_info = repo.get("license") or {}
    license_name = license_info.get("spdx_id")
    if not license_name or license_name == "NOASSERTION":
        return None
    description = str(repo.get("description") or "").strip()
    if len(description) < 12:
        return None

    full_name = str(repo.get("full_name") or "")
    if "/" not in full_name:
        return None
    owner = (repo.get("owner") or {}).get("login") or full_name.split("/", 1)[0]
    topics = [str(topic) for topic in (repo.get("topics") or []) if topic][:4]
    homepage = str(repo.get("homepage") or "").strip()
    stars = int(repo.get("stargazers_count") or 0)
    documentation_quality = 6 + (2 if homepage else 0) + (1 if topics else 0)
    lane_label = "权威基准" if lane == "authority" else "近期活跃"
    topic_why = LIVE_TOPIC_WHY.get(topic_id, "先用 README 的最小示例验证，再决定是否长期使用。")
    why = f"{topic_why}（{lane_label}命中，{stars:,} stars，许可证 {license_name}）"

    return {
        "id": f"live:{full_name}",
        "type": "project",
        "title": repo.get("name") or full_name.split("/", 1)[1],
        "repo": full_name,
        "author": owner,
        "url": repo.get("html_url") or f"https://github.com/{full_name}",
        "description": description,
        "language": repo.get("language") or "未标注",
        "readMinutes": 5,
        "topicIds": [topic_id],
        "tags": topics or ["GitHub 实时"],
        "why": why,
        "source": "live",
        "liveLane": lane,
        "metrics": {
            "stars": stars,
            "createdAt": repo.get("created_at"),
            "pushedAt": repo.get("pushed_at"),
            "license": license_name,
            "documentationQuality": min(10, documentation_quality),
            "homepage": homepage,
            "forks": int(repo.get("forks_count") or 0),
            "openIssues": int(repo.get("open_issues_count") or 0),
        },
    }


def search_lane(
    *,
    query: str,
    sort: str,
    page: int,
    topic_id: str,
    lane: str,
) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    params = urllib.parse.urlencode(
        {"q": query, "sort": sort, "order": "desc", "per_page": 30, "page": page}
    )
    payload, rate = github_request_json(f"/search/repositories?{params}")
    items = []
    for repo in payload.get("items") or []:
        normalized = normalize_repo(repo, topic_id=topic_id, lane=lane)
        if normalized:
            items.append(normalized)
    return items, rate


def normalize_focuses(raw_focuses: list[str]) -> list[str]:
    """Flatten comma-separated focus values while preserving order."""
    result: list[str] = []
    for raw in raw_focuses:
        for part in str(raw).split(","):
            focus = part.strip()
            if focus in FOCUS_QUERY and focus not in result:
                result.append(focus)
    return result or ["study"]


def rotate_focuses(focuses: list[str], page: int) -> list[str]:
    """Rotate the starting focus so successive pages cover different topics."""
    if not focuses:
        return []
    offset = max(0, page - 1) % len(focuses)
    return focuses[offset:] + focuses[:offset]


def fetch_live_feed(
    focuses: list[str],
    major: str,
    page: int,
    *,
    stage: str = "",
    need: str = "",
    terms: list[str] | None = None,
) -> dict[str, Any]:
    """Search focus areas plus one research-need lane per refresh."""
    cutoff = (datetime.now(timezone.utc) - timedelta(days=120)).date().isoformat()
    page = min(5, max(1, page))
    ordered_focuses = rotate_focuses(normalize_focuses(focuses), page)
    extra_lane = NEED_QUERY.get(need) or STAGE_QUERY.get(stage)
    if not extra_lane and terms:
        first_term = str(terms[0]).strip()[:40]
        if first_term:
            extra_lane = (f'"{first_term}"', FOCUS_TOPIC.get(ordered_focuses[0], "ai-tools"))
    base_count = 2 if extra_lane else 3
    ordered_focuses = ordered_focuses[:base_count]

    lanes = []
    for index, focus in enumerate(ordered_focuses):
        keyword, topic_id = pick_query(focus, major)
        lane_name = "authority" if (index + page) % 2 == 0 else "recent"
        if lane_name == "authority":
            query = f"{keyword} stars:>=1000 archived:false fork:false"
            sort = "stars"
        else:
            query = f"{keyword} stars:>=50 archived:false fork:false pushed:>={cutoff}"
            sort = "updated"
        lanes.append(
            {
                "name": lane_name,
                "focus": focus,
                "topicId": topic_id,
                "keyword": keyword,
                "query": query,
                "sort": sort,
            }
        )
    if extra_lane:
        keyword, topic_id = extra_lane
        lane_name = "recent" if page % 2 else "authority"
        query = (
            f"{keyword} stars:>=1000 archived:false fork:false"
            if lane_name == "authority"
            else f"{keyword} stars:>=30 archived:false fork:false pushed:>={cutoff}"
        )
        lanes.append(
            {
                "name": lane_name,
                "focus": stage or need or "need",
                "topicId": topic_id,
                "keyword": keyword,
                "query": query,
                "sort": "stars" if lane_name == "authority" else "updated",
            }
        )

    merged: dict[str, dict[str, Any]] = {}
    warnings: list[str] = []
    rates: list[dict[str, Any]] = []
    successful_lanes = 0
    with ThreadPoolExecutor(max_workers=max(1, len(lanes))) as executor:
        futures = {
            executor.submit(
                search_lane,
                query=lane["query"],
                sort=lane["sort"],
                # Narrow queries often return fewer than 20 results, so keep the
                # API page at 1 and rotate focus/lane windows instead.
                page=1,
                topic_id=lane["topicId"],
                lane=lane["name"],
            ): lane
            for lane in lanes
        }
        for future in as_completed(futures):
            lane = futures[future]
            try:
                items, rate = future.result()
                successful_lanes += 1
                rates.append(rate)
                for item in items:
                    existing = merged.get(item["repo"])
                    if existing:
                        lanes_seen = set(existing.get("liveLanes") or [existing.get("liveLane")])
                        lanes_seen.add(lane["name"])
                        existing["liveLanes"] = sorted(lanes_seen)
                        existing_topics = existing.setdefault("topicIds", [])
                        for topic_id in item.get("topicIds") or []:
                            if topic_id not in existing_topics:
                                existing_topics.append(topic_id)
                    else:
                        item["liveLanes"] = [lane["name"]]
                        merged[item["repo"]] = item
            except Exception as exc:
                focus_label = FOCUS_TOPIC.get(lane["focus"], lane["focus"])
                warnings.append(f"{focus_label} / {lane['name']} 通道失败：{exc}")

    if not merged:
        if successful_lanes:
            raise GitHubRequestError(
                "本次搜索没有返回符合公开、非归档、明确许可证条件的项目",
                code="live_feed_empty",
                rate=rates[0] if rates else {},
            )
        raise GitHubRequestError(
            "GitHub 搜索暂时不可用或额度已用完",
            code="live_feed_unavailable",
            rate=rates[0] if rates else {},
        )

    remaining_values = [rate["remaining"] for rate in rates if rate.get("remaining") is not None]
    reset_values = [rate["resetAt"] for rate in rates if rate.get("resetAt")]
    keywords = [lane["keyword"] for lane in lanes]
    return {
        "mode": "live-github",
        "fetchedAt": datetime.now(timezone.utc).isoformat(),
        "query": " / ".join(keywords),
        "focuses": ordered_focuses,
        "stage": stage,
        "need": need,
        "page": page,
        "items": list(merged.values()),
        "warnings": warnings,
        "rateLimit": {
            "remaining": min(remaining_values) if remaining_values else None,
            "resetAt": min(reset_values) if reset_values else None,
        },
        "authMode": "token" if current_token() else "anonymous",
        "notice": "项目来自 GitHub 官方 Search API 的实时响应；许可证与公开状态在返回时重新核对。",
    }


def get_live_feed(
    focuses: list[str],
    major: str,
    page: int,
    *,
    stage: str = "",
    need: str = "",
    terms: list[str] | None = None,
) -> dict[str, Any]:
    """Cached entry point used by the HTTP layer.

    The cache key mirrors the inputs that actually change the upstream query.
    A cache hit is annotated so the UI/devs can tell the difference.
    """
    normalized = tuple(normalize_focuses(focuses))
    safe_page = min(5, max(1, page))
    term_tuple = tuple(terms or [])
    key = (normalized, major, safe_page, stage, need, term_tuple)
    payload, hit = _FEED_CACHE.get_or_create(
        key,
        lambda: fetch_live_feed(
            list(normalized),
            major,
            safe_page,
            stage=stage,
            need=need,
            terms=list(term_tuple),
        ),
    )
    return {
        **payload,
        "cache": {"hit": hit, "ttlSeconds": int(_FEED_CACHE.ttl_seconds)},
    }


def clear_feed_cache() -> None:
    """Exposed for tests; production never needs to clear it manually."""
    _FEED_CACHE.clear()

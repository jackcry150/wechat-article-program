#!/usr/bin/env python3
"""XHS fan count fetcher — scrapes user profile HTML pages for follower counts.
Usage: python3 xhs-fan-fetcher.py <user_id1> [user_id2 ...]
Output: JSON { "user_id": fan_count, ... }
"""

from __future__ import annotations

import json
import re
import ssl
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

COOKIE_FILE = Path.home() / ".xiaohongshu-cli" / "cookies.json"
CACHE_FILE = Path.home() / ".xiaohongshu-cli" / "fan_cache.json"
CACHE_TTL = 1800  # 30 minutes


def load_cookies() -> str:
    """Load cookie string from xhs CLI's stored cookies."""
    if not COOKIE_FILE.exists():
        print(json.dumps({"error": "No cookie file found. Run xhs login first."}))
        sys.exit(1)

    with open(COOKIE_FILE) as f:
        data = json.load(f)

    parts = []
    for k, v in data.items():
        if k == "saved_at":
            continue
        parts.append(f"{k}={v}")
    return "; ".join(parts)


def load_cache() -> dict[str, dict]:
    """Load fan count cache."""
    if not CACHE_FILE.exists():
        return {}
    try:
        with open(CACHE_FILE) as f:
            data = json.load(f)
        # Prune expired entries
        now = time.time()
        return {k: v for k, v in data.items() if now - v.get("ts", 0) < CACHE_TTL}
    except Exception:
        return {}


def save_cache(cache: dict) -> None:
    """Save fan count cache."""
    CACHE_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(CACHE_FILE, "w") as f:
        json.dump(cache, f, indent=2)


def fetch_user_page(user_id: str, cookie: str) -> str | None:
    """Fetch user profile HTML page."""
    url = f"https://www.xiaohongshu.com/user/profile/{user_id}"

    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE

    req = urllib.request.Request(url, headers={
        "Cookie": cookie,
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "zh-CN,zh;q=0.9",
        "Referer": "https://www.xiaohongshu.com/",
    })

    try:
        with urllib.request.urlopen(req, context=ctx, timeout=10) as resp:
            return resp.read().decode("utf-8", errors="replace")
    except urllib.error.HTTPError as e:
        print(json.dumps({"error": f"HTTP {e.code} for user {user_id}"}), file=sys.stderr)
        return None
    except Exception as e:
        print(json.dumps({"error": f"Failed for user {user_id}: {e}"}), file=sys.stderr)
        return None


def extract_fan_count(html: str) -> int | None:
    """Extract fan count from user profile HTML."""
    match = re.search(
        r"<script>window\.__INITIAL_STATE__=(.+?)</script>", html
    )
    if not match:
        return None

    try:
        raw = match.group(1).replace(":undefined", ":null")
        data = json.loads(raw, strict=False)
        interactions = (
            data.get("user", {})
            .get("userPageData", {})
            .get("interactions", [])
        )
        for entry in interactions:
            if entry.get("type") == "fans":
                return int(entry.get("count", 0))
        return None
    except Exception:
        return None


def main():
    user_ids = [uid.strip() for uid in sys.argv[1:] if uid.strip()]
    if not user_ids:
        print(json.dumps({}))
        return

    # Deduplicate
    unique_ids = list(dict.fromkeys(user_ids))

    cookie = load_cookies()
    cache = load_cache()

    result = {}
    for user_id in unique_ids:
        # Check cache
        if user_id in cache:
            result[user_id] = cache[user_id]["fans"]
            continue

        # Fetch and extract
        html = fetch_user_page(user_id, cookie)
        if html is None:
            result[user_id] = None
            continue

        fans = extract_fan_count(html)
        result[user_id] = fans

        # Cache
        cache[user_id] = {"fans": fans, "ts": time.time()}

        # Be polite
        time.sleep(0.5)

    save_cache(cache)
    print(json.dumps(result, ensure_ascii=False))


if __name__ == "__main__":
    main()

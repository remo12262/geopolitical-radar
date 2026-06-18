import httpx
import feedparser
import hashlib
from datetime import datetime
from typing import List, Dict

RSS_FEEDS = [
    {"url": "https://www.defense.gov/News/RSS/", "source": "US Department of Defense", "country": "US"},
    {"url": "https://breakingdefense.com/feed/", "source": "Breaking Defense", "country": "MULTI"},
    {"url": "https://thedefensepost.com/feed/", "source": "The Defense Post", "country": "MULTI"},
    {"url": "https://www.defensenews.com/arc/outboundfeeds/rss/?rss=true", "source": "Defense News", "country": "MULTI"},
    {"url": "https://feeds.reuters.com/Reuters/worldNews", "source": "Reuters World", "country": "MULTI"},
    {"url": "https://rss.dw.com/xml/rss-en-world", "source": "DW World", "country": "MULTI"},
    {"url": "https://www.nato.int/docu/review/en/rss.xml", "source": "NATO Review", "country": "NATO"},
    {"url": "https://feeds.bbci.co.uk/news/world/rss.xml", "source": "BBC World", "country": "MULTI"},
    {"url": "https://www.janes.com/feeds/news", "source": "Jane's Defense", "country": "MULTI"},
    {"url": "https://www.airforcetimes.com/arc/outboundfeeds/rss/", "source": "Air Force Times", "country": "US"},
]

DEFENSE_KEYWORDS = {
    "military", "defense", "defence", "army", "navy", "air force", "missile",
    "weapon", "troops", "nato", "pentagon", "ministry of defense", "armed forces",
    "war", "conflict", "sanction", "threat", "nuclear", "drone", "exercise",
    "procurement", "alliance", "deployment", "intelligence", "cyber", "satellite",
    "carrier", "submarine", "fighter", "bomber", "soldier", "combat",
    "геополітика", "difesa", "armée", "bundeswehr", "esercito"
}


def _is_defense_relevant(title: str, summary: str) -> bool:
    text = (title + " " + summary).lower()
    return any(kw in text for kw in DEFENSE_KEYWORDS)


def _make_id(url: str, title: str) -> str:
    return hashlib.md5(f"{url}{title}".encode()).hexdigest()[:16]


async def scrape_feeds() -> List[Dict]:
    articles = []
    async with httpx.AsyncClient(timeout=15, follow_redirects=True) as client:
        for feed_cfg in RSS_FEEDS:
            try:
                resp = await client.get(feed_cfg["url"])
                parsed = feedparser.parse(resp.text)
                for entry in parsed.entries[:10]:
                    title = getattr(entry, "title", "").strip()
                    summary = getattr(entry, "summary", "") or getattr(entry, "description", "")
                    summary = summary[:1200].strip()
                    url = getattr(entry, "link", "")
                    published = getattr(entry, "published", datetime.utcnow().isoformat())
                    if not title:
                        continue
                    if not _is_defense_relevant(title, summary):
                        continue
                    articles.append({
                        "id": _make_id(url, title),
                        "title": title,
                        "summary": summary,
                        "url": url,
                        "published": published,
                        "source": feed_cfg["source"],
                        "source_country": feed_cfg["country"],
                    })
            except Exception as e:
                print(f"[scraper] {feed_cfg['source']}: {e}")
    print(f"[scraper] fetched {len(articles)} defense-relevant articles")
    return articles

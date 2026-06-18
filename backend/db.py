from typing import List, Dict, Optional
from datetime import datetime


class RadarDB:
    def __init__(self):
        self.events: Dict[str, Dict] = {}
        self.last_refresh: Optional[str] = None

    async def init(self):
        pass

    async def upsert_events(self, events: List[Dict]):
        new = 0
        for event in events:
            eid = event.get("id", "")
            if eid and eid not in self.events:
                self.events[eid] = event
                new += 1
        self.last_refresh = datetime.utcnow().isoformat()
        print(f"[db] +{new} new events, total: {len(self.events)}")

    async def get_events(
        self,
        country: Optional[str] = None,
        severity: Optional[str] = None,
        event_type: Optional[str] = None,
        limit: int = 50,
    ) -> List[Dict]:
        events = list(self.events.values())
        if country:
            events = [e for e in events if country in (e.get("countries") or [])]
        if severity:
            events = [e for e in events if e.get("severity") == severity]
        if event_type:
            events = [e for e in events if e.get("event_type") == event_type]
        events.sort(key=lambda e: e.get("analyzed_at", ""), reverse=True)
        return events[:limit]

    async def get_alerts(self) -> List[Dict]:
        sev_order = {"CRITICAL": 3, "HIGH": 2}
        alerts = [e for e in self.events.values() if e.get("severity") in sev_order]
        alerts.sort(key=lambda e: sev_order.get(e.get("severity", ""), 0), reverse=True)
        return alerts[:20]

    async def get_radar(self) -> Dict:
        events = list(self.events.values())
        country_stats: Dict[str, Dict] = {}
        for event in events:
            for country in event.get("countries") or []:
                if country not in country_stats:
                    country_stats[country] = {"count": 0, "critical": 0, "high": 0, "types": []}
                cs = country_stats[country]
                cs["count"] += 1
                sev = event.get("severity", "")
                if sev == "CRITICAL":
                    cs["critical"] += 1
                elif sev == "HIGH":
                    cs["high"] += 1
                et = event.get("event_type", "")
                if et and et not in cs["types"]:
                    cs["types"].append(et)
        return {
            "country_stats": country_stats,
            "total_events": len(events),
            "critical_count": sum(1 for e in events if e.get("severity") == "CRITICAL"),
            "high_count": sum(1 for e in events if e.get("severity") == "HIGH"),
            "last_refresh": self.last_refresh,
        }

    async def get_stats(self) -> Dict:
        events = list(self.events.values())
        by_type: Dict[str, int] = {}
        by_severity: Dict[str, int] = {}
        by_region: Dict[str, int] = {}
        for e in events:
            t = e.get("event_type", "UNKNOWN")
            by_type[t] = by_type.get(t, 0) + 1
            s = e.get("severity", "UNKNOWN")
            by_severity[s] = by_severity.get(s, 0) + 1
            for r in e.get("regions_affected") or []:
                by_region[r] = by_region.get(r, 0) + 1
        return {
            "total": len(events),
            "by_type": by_type,
            "by_severity": by_severity,
            "by_region": by_region,
            "last_refresh": self.last_refresh,
        }
